#!/bin/bash
# FocusBoard State Generator Wrapper
# Called by launchd every 2 minutes
# Generates state.json and scp's to Pi

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_DIR="$HOME/.claude/pi"
STATE_FILE="$STATE_DIR/state.json"
PI_USER="${FOCUSBOARD_USER:-jopi}"
PI_HOST="${FOCUSBOARD_HOST:-focusboard}"
PI_DEST="/home/${PI_USER}/focusboard/dashboard/state.json"
LOG_FILE="$STATE_DIR/sync.log"

# Ensure state directory exists
mkdir -p "$STATE_DIR"

# Generate state.json
python3 "$SCRIPT_DIR/generate_state.py" --output "$STATE_FILE"

if [ $? -ne 0 ]; then
    echo "$(date -Iseconds) ERROR: generate_state.py failed" >> "$LOG_FILE"
    exit 1
fi

# SCP to Pi (timeout 5s, no strict host checking for local network)
scp -o ConnectTimeout=5 \
    -o StrictHostKeyChecking=no \
    -o BatchMode=yes \
    "$STATE_FILE" "$PI_HOST:$PI_DEST" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "$(date -Iseconds) OK: synced to Pi" >> "$LOG_FILE"
else
    echo "$(date -Iseconds) WARN: scp failed (Pi offline?)" >> "$LOG_FILE"
fi

# Keep log file trimmed (last 100 lines)
if [ -f "$LOG_FILE" ]; then
    tail -100 "$LOG_FILE" > "$LOG_FILE.tmp" && mv "$LOG_FILE.tmp" "$LOG_FILE"
fi
