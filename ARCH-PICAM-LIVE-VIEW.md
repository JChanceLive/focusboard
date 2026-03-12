# ARCH: PiCam Live View on FocusBoard

**Status:** SHELVED (S1-S3 complete, Pi 3 B+ CPU ceiling hit)
**Date:** 2026-03-09 (created) / 2026-03-10 (shelved)
**Projects:** FocusBoard + PiCam (shared Pi 3 B+ at 10.0.0.58)
**Next:** Dedicated Pi Zero 2 W display (Option C) when ready

---

## Overview

When FocusBoard is in night/screensaver mode (6 PM - 5 AM) and PiCam detects motion, the dashboard is replaced by a full-screen live camera feed. After motion stops (~30s timeout), it returns to the screensaver. A Mac CLI override enables this behavior at any time of day.

---

## Interview Summary

| Question | Answer |
|----------|--------|
| Dashboard changes? | NONE — do not touch existing dashboard code |
| Camera display | Full-screen takeover, slight zoom (between letterbox and fill) |
| Return timeout | ~30 seconds (match PiDash pattern) |
| Override UX | Mac CLI: `focusboard live-view on/off` (SSH to Pi) |
| Day override behavior | Same as evening — full screen switch on motion |
| Override persistence | Resets to OFF on Pi reboot |
| Signal mechanism | Direct Unix signal (same-machine, lowest latency) |

---

## Existing Infrastructure (Battle-Tested)

### PiDash Camera System (Reference Implementation)

The PiDash camera system on Pi Zero 2W was extensively debugged:

**Architecture:**
```
PiCam motion daemon → HTTP POST → PiDash Flask API
    → pidash-switch.sh → signal persistent GStreamer controller
    → stop framebuffer display → swap to kmssink → 30s revert timer
```

**Key components:**
- `pidash-cam-controller.py` — Persistent GStreamer decoder (keeps decoder warm with fakevideosink, signal-swaps to kmssink for display)
- `pidash-cam-relay.service` — ffmpeg RTSP-to-UDP relay (needed because PiCam is on different Pi)
- `pidash-switch.sh` — PID-based signal dispatcher (USR1=show, USR2=hide)
- Flask `/api/display/cam` — 30s auto-revert timer with threading.Timer
- `auto-cam.json` — Persisted toggle for enabling/disabling auto-switch

**What failed on PiDash (Pi Zero 2W):**
- mpv `--hwdec=auto` — wrong platform, fell back to software decode, overwhelmed CPU
- mpv `--hwdec=v4l2m2m` — hardware decode worked but DRM VO did HW-downloading (GPU→CPU→GPU), ~288% CPU
- UDP RTSP — packet loss on WiFi caused visual artifacts
- Low-latency mpv flags — marginal improvement, couldn't overcome CPU bottleneck

**What works:** GStreamer `rtspsrc → v4l2h264dec → kmssink` = true zero-copy, 18% CPU

### FocusBoard Night Mode

- `clock.js`: `NIGHT_START_HOUR = 18`, `NIGHT_END_HOUR = 5`
- `override.json`: Polled every 10s, supports `mode: 'night'` / `mode: 'day'` / `mode: 'auto'`
- Monitor cron: OFF at 8:30 PM, ON at 5:30 AM
- Night mode: moon phase, clock, date, countdown to first morning block, quote/tomorrow's focus

### PiCam Motion Detection

- `motion_realtime_daemon.py` runs on same Pi as FocusBoard
- Frame differencing at 2fps (80x45 grayscale)
- `PIDASH_CAM_THRESHOLD = 8.0` — any motion triggers cam switch (separate from alert threshold of 50.0)
- `notify_pidash_cam()` — fire-and-forget HTTP POST to PiDash
- Event gap: 5 seconds (EVENT_GAP_SEC)
- Independent of armed/vacation state (always triggers)

---

## Architecture: FocusBoard Implementation

### Critical Difference from PiDash

**PiDash** (Pi Zero 2W): No compositor. Raw framebuffer + KMS direct access. GStreamer kmssink renders directly.

**FocusBoard** (Pi 3 B+): Wayland compositor (labwc) manages display. Chromium runs as Wayland client. Portrait rotation via `wlr-randr --transform 90`.

**Consequence:** Cannot use kmssink while labwc is running (DRM conflict). Two viable approaches:

### Approach A: Wayland Video Overlay (RECOMMENDED)

Keep labwc + Chromium running. Spawn a fullscreen video player as a Wayland window on top of Chromium.

```
Motion detected
    → cam controller receives SIGUSR1
    → spawn mpv --fs --vo=gpu --gpu-context=wayland rtsp://localhost:8554/cam
    → fullscreen window appears ON TOP of Chromium (night mode still behind)

Motion timeout (30s)
    → cam controller kills mpv process
    → mpv window gone → Chromium night mode immediately visible
```

**Pros:**
- Portrait rotation handled automatically by labwc compositor
- Instant return to dashboard (no Chromium restart)
- Slight zoom achievable via mpv `--panscan` flag
- No service restarts needed

**Cons:**
- mpv Wayland + hardware decode on Pi 3 B+ is unproven
- May fall back to software decode (but 720p@15fps should be manageable on Pi 3 B+ at 1.4GHz)

**Latency estimate:**
- Motion to display: ~2-3s (0.5s detection + 1-2s mpv start + RTSP connect)
- Return to dashboard: <1s (kill process, Chromium already showing)

### Approach B: Service Swap Fallback (If Approach A Fails)

Same as PiDash pattern: stop everything, use kmssink directly, restart everything.

```
Motion detected
    → cam controller receives SIGUSR1
    → systemctl stop focusboard.service (kills Chromium + labwc)
    → GStreamer kmssink renders directly to DRM plane

Motion timeout (30s)
    → swap to fakevideosink
    → systemctl start focusboard.service
    → labwc starts (~1s) → Chromium starts (~3-5s) → dashboard visible
```

**Pros:**
- Proven pattern (exact PiDash approach)
- True hardware decode, zero CPU overhead

**Cons:**
- 4-6 second black screen when returning to dashboard
- Portrait rotation lost during camera display (kmssink doesn't apply wlr-randr transform)
  - Mitigation: could pre-rotate the video in GStreamer pipeline (videoflip) but adds CPU cost
- Service restart on every motion trigger

### Display Geometry (Portrait + Landscape Camera)

Display: 1050 x 1680 (portrait, Dell 2007WFP)
Camera: 1280 x 720 (landscape, IMX219 via MediaMTX)

**Slight zoom strategy (user preference: between letterbox and fill):**

| Mode | Video Size | Black Bars | Crop |
|------|-----------|------------|------|
| Full letterbox | 1050 x 591 | 544px each side | 0% |
| Slight zoom (1.3x) | 1050 x 769 | 455px each side | ~23% sides cropped |
| Fill width (2.33x) | 1050 x 1680 | 0 | ~57% sides cropped |

**Recommendation:** ~1.3x zoom via `mpv --panscan=0.3` — shows most of the frame while reducing the black bar gap. The center of the camera view (where a person walking is most likely) stays visible.

With Approach A (mpv as Wayland client), the portrait rotation is automatic. mpv flags:
```
mpv --fs --vo=gpu --gpu-context=wayland --panscan=0.3 \
    --hwdec=auto --no-terminal --no-osc --no-input-default-bindings \
    rtsp://localhost:8554/cam
```

---

## Component Design

### 1. focusboard-cam-config.json (Pi-side config)

Location: `~/.config/focusboard/cam-config.json`

```json
{
  "enabled": false,
  "override": false,
  "night_start_hour": 18,
  "night_end_hour": 5,
  "revert_seconds": 30,
  "panscan": 0.3,
  "motion_threshold": 8.0
}
```

- `enabled`: Master switch (cam service running)
- `override`: When true, motion triggers camera at any hour (not just night)
- `night_start_hour` / `night_end_hour`: Match clock.js constants
- Resets `override: false` on service start (reboot safety)

### 2. focusboard-cam.py (Cam Controller Daemon)

Systemd service on the FocusBoard Pi. Listens for signals from motion daemon.

**Responsibilities:**
- Listen for SIGUSR1 (show camera) and SIGUSR2 (hide camera)
- Time-gate: only respond during night hours OR when override is active
- Spawn/kill mpv process for camera display
- Auto-revert timer (30s default)
- Write PID file for signal targeting
- Log events

**Signal flow (same-machine, no HTTP needed):**
```python
# Motion daemon (already running on this Pi)
def notify_focusboard_cam(peak_score):
    """Signal focusboard cam controller directly via PID file."""
    try:
        with open("/tmp/focusboard-cam.pid") as f:
            pid = int(f.read().strip())
        os.kill(pid, signal.SIGUSR1)
    except (FileNotFoundError, ProcessLookupError, ValueError):
        pass  # Controller not running — ignore
```

### 3. Motion Daemon Integration (picam)

Add to `motion_realtime_daemon.py`:

```python
# FocusBoard camera auto-switch (same Pi — direct signal, no HTTP)
FOCUSBOARD_CAM_PID = "/tmp/focusboard-cam.pid"
FOCUSBOARD_CAM_THRESHOLD = 8.0  # Same as PiDash

def notify_focusboard_cam(peak_score):
    """Signal focusboard cam controller to show camera feed."""
    try:
        with open(FOCUSBOARD_CAM_PID) as f:
            pid = int(f.read().strip())
        os.kill(pid, signal.SIGUSR1)
    except (FileNotFoundError, ProcessLookupError, ValueError, PermissionError):
        pass
```

Add to the motion loop (alongside existing PiDash notification, line ~405-409):
```python
# FocusBoard auto-cam: always trigger, independent of armed/vacation
if (not focusboard_cam_sent_for_event
        and event_peak >= FOCUSBOARD_CAM_THRESHOLD):
    notify_focusboard_cam(event_peak)
    focusboard_cam_sent_for_event = True
```

### 4. Mac CLI Override

`focusboard` shell script on Mac (in `~/bin/` or `~/.local/bin/`):

```bash
#!/bin/bash
# FocusBoard display control
case "${1:-status}" in
    live-view)
        case "${2:-status}" in
            on)  ssh focusboard "python3 ~/focusboard/scripts/cam-control.py override on" ;;
            off) ssh focusboard "python3 ~/focusboard/scripts/cam-control.py override off" ;;
            *)   ssh focusboard "python3 ~/focusboard/scripts/cam-control.py override status" ;;
        esac
        ;;
    *)
        echo "Usage: focusboard live-view {on|off|status}"
        ;;
esac
```

### 5. Systemd Services

**focusboard-cam.service:**
```ini
[Unit]
Description=FocusBoard Camera Controller
After=focusboard.service mediamtx.service

[Service]
Type=simple
User=jopi
Environment=WAYLAND_DISPLAY=wayland-0
Environment=XDG_RUNTIME_DIR=/run/user/1000
ExecStart=/usr/bin/python3 /home/jopi/focusboard/scripts/focusboard-cam.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Note: Needs `WAYLAND_DISPLAY` and `XDG_RUNTIME_DIR` so mpv can connect to labwc.

---

## Data Flow

```
                    ┌─────────────────────────────────────┐
                    │     FocusBoard Pi (10.0.0.58)        │
                    │                                      │
                    │  ┌──────────────┐  ┌──────────────┐ │
                    │  │ MediaMTX     │  │ motion       │ │
                    │  │ RTSP :8554   │←─│ _realtime    │ │
                    │  │ cam stream   │  │ _daemon.py   │ │
                    │  └──────┬───────┘  └──────┬───────┘ │
                    │         │                  │         │
                    │         │      SIGUSR1     │         │
                    │         │    (same machine)│         │
                    │         │                  ▼         │
                    │         │  ┌──────────────────────┐  │
                    │         │  │ focusboard-cam.py    │  │
                    │         │  │ - time gate check    │  │
                    │         │  │ - spawn/kill mpv     │  │
                    │         │  │ - 30s revert timer   │  │
                    │         │  └──────────┬───────────┘  │
                    │         │             │              │
                    │         ▼             ▼              │
                    │  ┌──────────┐  ┌──────────┐         │
                    │  │ mpv      │  │ labwc    │         │
                    │  │ --fs     │  │ (Wayland)│         │
                    │  │ Wayland  │  │          │         │
                    │  │ window   │  │ Chromium │         │
                    │  │ ON TOP   │  │ (night   │         │
                    │  │          │  │  mode)   │         │
                    │  └──────────┘  └──────────┘         │
                    │         │             │              │
                    │         └──────┬──────┘              │
                    │                ▼                     │
Mac (M3 Max)       │  ┌──────────────────────┐            │
┌──────────────┐   │  │    Dell 2007WFP       │            │
│ focusboard   │──SSH──│    Portrait 1050x1680 │            │
│ live-view    │   │  │    Camera or Night    │            │
│ on/off       │   │  └──────────────────────┘            │
└──────────────┘   └──────────────────────────────────────┘
```

---

## Implementation Sessions

### Session 1: Core Camera Controller + Integration Test

**Goal:** Camera shows on motion, returns to dashboard after timeout.

1. Create `focusboard-cam.py` (signal handler, mpv spawn/kill, time gate, revert timer)
2. Create `cam-config.json` with defaults
3. Create `focusboard-cam.service` systemd unit
4. Test mpv on FocusBoard Pi with Wayland:
   - `mpv --fs --vo=gpu --gpu-context=wayland --panscan=0.3 --hwdec=auto rtsp://localhost:8554/cam`
   - Verify: video appears over Chromium, portrait rotation correct, ~reasonable FPS
   - If mpv Wayland fails: fall back to Approach B (service swap)
5. Add `notify_focusboard_cam()` to PiCam's `motion_realtime_daemon.py`
6. Deploy both services, test end-to-end: walk past camera → live feed appears → stops → dashboard returns
7. Measure latencies: motion→display, display→return

### Session 2: Mac Override + Polish

**Goal:** Mac CLI control, final tuning.

1. Create `focusboard` Mac CLI script
2. Create `cam-control.py` Pi-side helper (reads/writes cam-config.json)
3. Test override: `focusboard live-view on` → motion triggers camera during day
4. Tune panscan value on the physical display (find sweet spot between 0.2-0.4)
5. Verify reboot safety (override resets, cam service auto-starts)
6. Update deploy.sh to include new scripts
7. Update PROJECT-FOCUSBOARD.md and CLAUDE.md

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| mpv Wayland fails on Pi 3 B+ | Medium | High | Fallback to Approach B (service swap with kmssink) |
| mpv software decode too slow | Low | Medium | 720p@15fps on 1.4GHz quad-core should be OK. Can reduce to 480p. |
| labwc doesn't layer mpv on top | Low | Medium | Test with `wl-present` or GStreamer waylandsink as alternative |
| Signal lost (PID file stale) | Low | Low | Health check: if PID file exists but process dead, remove file |
| Motion too sensitive (constant triggers) | Low | Low | Threshold tunable in cam-config.json |

---

## Open Questions — ANSWERED (S1-S3)

| # | Question | Answer |
|---|----------|--------|
| 1 | Does `--hwdec=v4l2m2m` work with mpv Wayland on Pi 3 B+? | YES. Uses bcm2835-codec `/dev/video10`. drmprime fails, falls back to copy mode. 38% CPU (vs 47% software). |
| 2 | Actual CPU usage during playback? | 38% (v4l2m2m) or 47% (software). Total system load during motion: ~268% of 400% max. |
| 3 | Does mpv layer on top of Chromium in labwc? | YES. Fullscreen Wayland window overlays Chromium correctly. |
| 4 | Is 0.3 panscan the right zoom? | YES. Works well on the physical display. |
| 5 | Motion overlay text? | Not implemented. Shelved before this was attempted. |

---

## S3 Findings: Root Cause + Shelving Decision

### Root Cause: CPU Contention (Hardware Ceiling)

The Pi 3 B+ (4 cores, 400% max) runs too many concurrent processes during motion events:

| Process | CPU% | Purpose |
|---------|------|---------|
| motion_scan.py + ffmpeg | ~150% | Scans segments (bursts every 30s) |
| ffmpeg sidecar (motion) | ~21% | RTSP h264_v4l2m2m decode for detection |
| ffmpeg sidecar (snapshot) | ~21% | RTSP to /tmp/picam_latest.jpg |
| mediamtx rpicamera | ~12% | Camera capture + H.264 encode |
| mpv (v4l2m2m) | ~38% | Display camera feed |
| labwc + Chromium | ~17% | Wayland compositor + dashboard |
| **TOTAL** | **~259%** | Load average: 5-7 |

**The cascade:** Motion triggers -> motion_scan.py bursts to 150% -> mpv can't decode fast enough -> TCP buffer accumulates -> 5-20s delay that never recovers.

### Key Technical Discoveries

1. **`--hwdec=auto` broken on Pi 3 B+ Wayland:** Tries CUDA/VAAPI (missing), does NOT try v4l2m2m. Falls back to software decode at 47% CPU.
2. **`--profile=low-latency` broken:** Sets `video-sync=audio` which fails with no audio stream.
3. **MediaMTX writeQueueSize is not a latency knob** for fast local readers (output max buffer, not mandatory delay).
4. **UDP RTSP broken on Pi:** Massive packet loss even on localhost.
5. **`--untimed` works** with sane probesize (500000) to catch up to live edge, but can't overcome CPU starvation.

### Test Results Summary

| Test | Result |
|------|--------|
| Cherry-picked low-latency flags | 15-20s delay (CPU is bottleneck) |
| MediaMTX writeQueueSize 128 | No effect |
| MediaMTX writeQueueSize 8 | Broke recording |
| UDP transport | Crashed (packet loss) |
| --hwdec=v4l2m2m | Works, 38% CPU |
| --hwdec=v4l2m2m + --untimed | ~5s delay (best result, still too much) |
| --profile=low-latency | Crashes (video-sync=audio) |

### Decision: Shelve on Pi 3 B+ -> Dedicated Pi Zero 2 W

Sub-1s latency is impossible on the shared Pi 3 B+ with all services running. A dedicated Pi Zero 2 W for display only (Option C) gives 4 clean cores for decode + display with no contention.

---

## Shelving Details (2026-03-10)

### What Was Disabled

| Item | Action | Location |
|------|--------|----------|
| `focusboard-cam.service` | `systemctl stop + disable` | Pi (10.0.0.58) |
| `notify_focusboard_cam()` | Function commented out | `picam/scripts/motion_realtime_daemon.py` |
| Call site + tracking vars | Commented out (4 locations) | `picam/scripts/motion_realtime_daemon.py` |
| deploy.sh cam restart | Lines removed | `focusboard/deploy.sh` |
| `fbcam-show`/`fbcam-hide` | User to remove manually | `~/.zshrc` |

### What Was Left Dormant (Harmless)

| File | Location | Notes |
|------|----------|-------|
| `focusboard-cam.py` | `focusboard/pi/scripts/` | Full daemon code, ready to reuse |
| `focusboard-cam.service` | `focusboard/pi/config/` | Service unit, disabled on Pi |
| `cam-config.json` | `focusboard/pi/config/` | Config file with all settings |
| `monitor-schedule.sh` | `focusboard/pi/scripts/` | Screen on/off cron (still used for dashboard) |

### S2 Fixes That Remain Deployed

These improvements in `motion_realtime_daemon.py` are still active (benefit motion alerts independently):

1. **Signal ordering (Fix 1):** Notifications send before FocusBoard signal — saves ~7s on alert delivery
2. **Grace timer (Fix 3):** In focusboard-cam.py (dormant since service disabled)

### Git Tags for Restoration

```bash
# See what was changed during shelving
cd ~/Documents/Projects/Claude/terminal/focusboard
git diff focusboard-picam-live-v1

cd ~/Documents/Projects/Claude/terminal/picam
git diff picam-focusboard-cam-v1
```

### How to Restore (Future Pi Zero 2 W or Re-enable)

1. **Re-enable on same Pi (quick test):**
   ```bash
   # On Pi
   sudo systemctl enable focusboard-cam
   sudo systemctl start focusboard-cam

   # On Mac: uncomment notify_focusboard_cam() in motion_realtime_daemon.py
   # Restore from: git diff picam-focusboard-cam-v1
   # Add focusboard-cam restart back to deploy.sh
   ```

2. **Dedicated Pi Zero 2 W (recommended):**
   - New Pi reads RTSP over network (not localhost)
   - Reuse `focusboard-cam.py` as base (change RTSP_URL to `rtsp://10.0.0.58:8554/cam`)
   - No sidecar contention = sub-1s latency expected
   - Pi Zero 2 W: 4 cores @ 1GHz, 512MB RAM, WiFi, $15

---

## picam-display Deployed (2026-03-10)

**Status:** LIVE on Pi Zero 2 W at 10.0.0.56 (hostname: picam-display)

Dedicated camera display node replaces the shelved FocusBoard live view. 4 clean cores for video decode with zero contention. Uses PiDash's proven GStreamer persistent controller architecture.

### Architecture

```
FocusBoard Pi (10.0.0.58)              picam-display (10.0.0.56)
========================              ================================
MediaMTX RTSP :8554  ----TCP---->     ffmpeg relay (RTSP -> UDP :1234)
motion_realtime_daemon.py             GStreamer persistent controller
  notify_pidash_cam()                   v4l2h264dec -> fakevideosink (idle)
  notify_picam_display() --HTTP-->      v4l2h264dec -> kmssink (active)
                                      Flask API (:5061)
```

### Performance

| Metric | Value |
|--------|-------|
| CPU (idle, decoder warm) | ~5% |
| CPU (camera showing) | ~11% total |
| Display swap latency | ~1s |
| Auto-revert | 30s |

### Services

| Service | Purpose |
|---------|---------|
| `picam-display-relay` | ffmpeg RTSP-to-UDP relay |
| `picam-display` | GStreamer persistent decoder (root) |
| `picam-display-api` | Flask API on :5061 |

### Motion Integration

`motion_realtime_daemon.py` on FocusBoard Pi calls `notify_picam_display()` (fire-and-forget HTTP POST) alongside the existing `notify_pidash_cam()`. Both displays show camera simultaneously on motion.

### Project Location

Mac: `~/Documents/Projects/Claude/terminal/picam-display/`
Deploy: `./deploy.sh`
