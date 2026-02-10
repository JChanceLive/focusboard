#!/usr/bin/env python3
"""
FocusBoard Sync Runner - called by launchd every 2 min.
Generates state.json and scp's to Pi. Pure Python, no shell wrapper.
"""

import subprocess
import sys
import os
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).parent
STATE_DIR = Path.home() / ".claude" / "pi"
STATE_FILE = STATE_DIR / "state.json"
PI_HOST = os.environ.get("FOCUSBOARD_HOST", "jopi@10.0.0.58")
PI_DEST = "/home/jopi/focusboard/dashboard/state.json"
LOG_FILE = STATE_DIR / "sync.log"


def log(msg: str):
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().isoformat(timespec="seconds")
    with open(LOG_FILE, "a") as f:
        f.write(f"{timestamp} {msg}\n")
    # Trim log
    try:
        lines = LOG_FILE.read_text().splitlines()
        if len(lines) > 100:
            LOG_FILE.write_text("\n".join(lines[-100:]) + "\n")
    except Exception:
        pass


def main():
    STATE_DIR.mkdir(parents=True, exist_ok=True)

    # Generate state.json
    gen = SCRIPT_DIR / "generate_state.py"
    result = subprocess.run(
        [sys.executable, str(gen), "--output", str(STATE_FILE)],
        capture_output=True, text=True, timeout=30
    )
    if result.returncode != 0:
        log(f"ERROR: generate_state.py failed: {result.stderr.strip()}")
        return

    # SCP to Pi
    result = subprocess.run(
        ["scp", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=no",
         "-o", "BatchMode=yes", str(STATE_FILE), f"{PI_HOST}:{PI_DEST}"],
        capture_output=True, text=True, timeout=15
    )
    if result.returncode == 0:
        log("OK: synced to Pi")
    else:
        log(f"WARN: scp failed ({result.stderr.strip() or 'Pi offline?'})")


if __name__ == "__main__":
    main()
