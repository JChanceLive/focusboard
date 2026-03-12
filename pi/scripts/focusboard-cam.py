#!/usr/bin/env python3
"""FocusBoard camera controller — shows live camera feed on motion.

Listens for Unix signals from the PiCam motion daemon (same Pi):
    SIGUSR1  Show camera (spawn mpv fullscreen Wayland window)
    SIGUSR2  Hide camera (kill mpv immediately)
    SIGTERM  Clean shutdown

Time-gated: only responds during night hours (18:00-05:00) unless
override is enabled in cam-config.json. Override resets on service start.

Screen wake: When the screen is off (marker file from monitor-schedule.sh),
motion wakes the screen, shows the camera feed, and turns it back off
after the revert timeout. No dashboard is ever shown — just camera → off.

mpv runs as a Wayland client on top of labwc, so Chromium (night mode)
stays running underneath. Killing mpv instantly reveals the dashboard.
"""

import json
import os
import signal
import subprocess
import sys
import threading
import time
from datetime import datetime
from pathlib import Path

PIDFILE = "/tmp/focusboard-cam.pid"
SCREEN_OFF_MARKER = "/tmp/focusboard-screen-off"
CONFIG_PATH = Path(__file__).parent.parent / "config" / "cam-config.json"
RTSP_URL = "rtsp://localhost:8554/cam"

# Default config (used if file is missing or unreadable)
DEFAULT_CONFIG = {
    "enabled": True,
    "override": False,
    "night_start_hour": 18,
    "night_end_hour": 5,
    "revert_seconds": 30,
    "panscan": 0.3,
    "motion_threshold": 8.0,
}


def log(msg):
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def load_config():
    """Load cam config, falling back to defaults on error."""
    try:
        with open(CONFIG_PATH) as f:
            cfg = json.load(f)
        # Merge with defaults for any missing keys
        merged = dict(DEFAULT_CONFIG)
        merged.update(cfg)
        return merged
    except (FileNotFoundError, json.JSONDecodeError, OSError) as e:
        log(f"Config error ({e}), using defaults")
        return dict(DEFAULT_CONFIG)


def save_config(cfg):
    """Write config back to disk."""
    try:
        with open(CONFIG_PATH, "w") as f:
            json.dump(cfg, f, indent=2)
            f.write("\n")
    except OSError as e:
        log(f"WARNING: Could not save config: {e}")


def is_night_hour(cfg):
    """Check if current hour is within night window."""
    hour = datetime.now().hour
    start = cfg["night_start_hour"]
    end = cfg["night_end_hour"]
    if start > end:
        # Wraps midnight: e.g. 18-5 means 18,19,...,23,0,1,2,3,4
        return hour >= start or hour < end
    else:
        return start <= hour < end


class CamController:
    def __init__(self):
        self._lock = threading.Lock()
        self._mpv_proc = None
        self._revert_timer = None
        self._screen_woke = False  # True if WE turned the screen on
        self._grace_timer = None   # Kills mpv after grace period
        self._mpv_grace_sec = 300  # 5 minutes

    def _build_mpv_cmd(self, cfg):
        """Build mpv command with Wayland flags and low-latency RTSP."""
        panscan = cfg.get("panscan", 0.3)
        return [
            "mpv",
            "--fs",
            "--vo=gpu",
            "--gpu-context=wayland",
            f"--panscan={panscan}",
            "--hwdec=auto",
            "--no-terminal",
            "--no-osc",
            "--no-input-default-bindings",
            "--really-quiet",
            # Low-latency: minimize probe time and buffering
            "--demuxer-lavf-analyzeduration=0.5",
            "--demuxer-lavf-probesize=500000",
            "--cache=no",
            "--demuxer-readahead-secs=0.5",
            "--interpolation=no",
            "--framedrop=decoder+vo",
            "--vd-lavc-threads=2",
            RTSP_URL,
        ]

    def show(self):
        """Show camera feed (called from SIGUSR1 handler thread).

        If the screen is off (marker file exists), wakes the screen first,
        shows the camera feed, and turns the screen back off on revert.
        """
        cfg = load_config()

        if not cfg.get("enabled", True):
            return

        screen_off = os.path.exists(SCREEN_OFF_MARKER)

        # If screen is off, motion always wakes it (bypass time gate).
        # If screen is on, apply normal time gate.
        if not screen_off:
            if not cfg.get("override", False) and not is_night_hour(cfg):
                return

        revert_sec = cfg.get("revert_seconds", 30)

        with self._lock:
            # Cancel any pending revert timer
            if self._revert_timer is not None:
                self._revert_timer.cancel()
                self._revert_timer = None

            # Cancel grace timer (we're active again)
            if self._grace_timer is not None:
                self._grace_timer.cancel()
                self._grace_timer = None

            # Wake screen if it was off
            if screen_off and not self._screen_woke:
                self._screen_on()
                self._screen_woke = True

            if self._mpv_proc is not None and self._mpv_proc.poll() is None:
                # mpv already running — just reset the revert timer
                # (covers both "motion refresh" and "grace period re-trigger")
                self._revert_timer = threading.Timer(revert_sec, self._revert)
                self._revert_timer.daemon = True
                self._revert_timer.start()
                log(f"Motion refresh — mpv already running, revert reset to {revert_sec}s")
                return

            # Spawn mpv (only if not already running)
            cmd = self._build_mpv_cmd(cfg)
            try:
                self._mpv_proc = subprocess.Popen(
                    cmd,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                log(f"SHOW: mpv started (pid={self._mpv_proc.pid})")
            except OSError as e:
                log(f"ERROR: Could not start mpv: {e}")
                self._mpv_proc = None
                # If we woke the screen but mpv failed, turn it back off
                if self._screen_woke:
                    self._screen_off()
                    self._screen_woke = False
                return

            # Start revert timer
            self._revert_timer = threading.Timer(revert_sec, self._revert)
            self._revert_timer.daemon = True
            self._revert_timer.start()

    def hide(self):
        """Hide camera feed immediately (called from SIGUSR2 handler thread)."""
        with self._lock:
            self._cancel_revert()
            if self._grace_timer is not None:
                self._grace_timer.cancel()
                self._grace_timer = None
            self._kill_mpv()
            if self._screen_woke:
                self._screen_off()
                self._screen_woke = False

    def _revert(self):
        """Keep mpv + screen alive for grace period.

        Don't turn screen off here — keep HDMI link alive so re-triggers
        during grace period skip the 8-10s HDMI handshake entirely.
        Screen and mpv are killed together in _grace_kill after 5 min idle.
        """
        with self._lock:
            self._revert_timer = None
            log("REVERT: timeout — mpv + screen alive for fast re-trigger")
            # Start grace timer to eventually kill mpv + screen
            self._grace_timer = threading.Timer(self._mpv_grace_sec, self._grace_kill)
            self._grace_timer.daemon = True
            self._grace_timer.start()

    def _grace_kill(self):
        """Kill mpv and turn screen off after grace period with no motion."""
        with self._lock:
            self._grace_timer = None
            self._kill_mpv()
            if self._screen_woke:
                self._screen_off()
                self._screen_woke = False
            log(f"GRACE: mpv killed + screen off after {self._mpv_grace_sec}s idle")

    def _kill_mpv(self):
        """Kill mpv process. Must be called with _lock held."""
        if self._mpv_proc is not None:
            if self._mpv_proc.poll() is None:
                self._mpv_proc.terminate()
                try:
                    self._mpv_proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    self._mpv_proc.kill()
                    self._mpv_proc.wait()
                log(f"HIDE: mpv killed (pid={self._mpv_proc.pid})")
            self._mpv_proc = None

    def _cancel_revert(self):
        """Cancel pending revert timer. Must be called with _lock held."""
        if self._revert_timer is not None:
            self._revert_timer.cancel()
            self._revert_timer = None

    def _screen_on(self):
        """Turn HDMI output on via wlr-randr. Must be called with _lock held."""
        try:
            subprocess.run(
                ["wlr-randr", "--output", "HDMI-A-1", "--on", "--transform", "90"],
                check=True,
                capture_output=True,
                timeout=10,
            )
            log("SCREEN: turned ON (motion wake)")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
            log(f"WARNING: Could not turn screen on: {e}")

    def _screen_off(self):
        """Turn HDMI output off via wlr-randr. Must be called with _lock held."""
        try:
            subprocess.run(
                ["wlr-randr", "--output", "HDMI-A-1", "--off"],
                check=True,
                capture_output=True,
                timeout=10,
            )
            log("SCREEN: turned OFF (revert)")
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as e:
            log(f"WARNING: Could not turn screen off: {e}")

    def cleanup(self):
        """Clean shutdown."""
        with self._lock:
            self._cancel_revert()
            if self._grace_timer is not None:
                self._grace_timer.cancel()
                self._grace_timer = None
            self._kill_mpv()
            if self._screen_woke:
                self._screen_off()
                self._screen_woke = False


def main():
    ctrl = CamController()

    # Write PID file
    with open(PIDFILE, "w") as f:
        f.write(str(os.getpid()))

    # Reset override on start (reboot safety)
    cfg = load_config()
    if cfg.get("override", False):
        cfg["override"] = False
        save_config(cfg)
        log("Reset override to false (service start)")

    log(f"FocusBoard Camera Controller started (pid={os.getpid()})")
    log(f"Config: night={cfg['night_start_hour']:02d}:00-{cfg['night_end_hour']:02d}:00, "
        f"revert={cfg['revert_seconds']}s, panscan={cfg['panscan']}")

    # Signal handlers — run actions in threads to avoid signal handler restrictions
    def on_show(signum, frame):
        threading.Thread(target=ctrl.show, daemon=True).start()

    def on_hide(signum, frame):
        threading.Thread(target=ctrl.hide, daemon=True).start()

    def on_term(signum, frame):
        log("Shutting down...")
        ctrl.cleanup()
        try:
            os.unlink(PIDFILE)
        except OSError:
            pass
        sys.exit(0)

    signal.signal(signal.SIGUSR1, on_show)
    signal.signal(signal.SIGUSR2, on_hide)
    signal.signal(signal.SIGTERM, on_term)
    signal.signal(signal.SIGINT, on_term)

    # Main loop: just wait for signals
    try:
        while True:
            signal.pause()
    except KeyboardInterrupt:
        pass
    finally:
        ctrl.cleanup()
        try:
            os.unlink(PIDFILE)
        except OSError:
            pass
        log("Stopped")


if __name__ == "__main__":
    main()
