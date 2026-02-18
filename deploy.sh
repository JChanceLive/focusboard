#!/bin/bash
# Deploy dashboard files to FocusBoard Pi
# Run from project root on Mac
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# Use SSH config alias "focusboard" (defines HostName, User, IdentityFile)
# Override with FOCUSBOARD_HOST env var if needed
PI_HOST="${FOCUSBOARD_HOST:-focusboard}"
PI_USER="${FOCUSBOARD_USER:-jopi}"
PI_BASE="/home/${PI_USER}/focusboard"

echo "Deploying FocusBoard dashboard to ${PI_HOST}..."

# Deploy dashboard files (recursive for subdirectories like videos/)
scp -r -o ConnectTimeout=5 \
    "$SCRIPT_DIR/pi/dashboard/"* \
    "$PI_HOST:$PI_BASE/dashboard/"

# Deploy scripts
scp -o ConnectTimeout=5 \
    "$SCRIPT_DIR/pi/scripts/"* \
    "$PI_HOST:$PI_BASE/scripts/"

# Make scripts executable
ssh "$PI_HOST" "chmod +x $PI_BASE/scripts/*.sh"

# Deploy config files (service, timers)
scp -o ConnectTimeout=5 \
    "$SCRIPT_DIR/pi/config/"* \
    "$PI_HOST:$PI_BASE/config/"

# Restart Chromium to pick up new files (clears cache)
echo "Restarting focusboard service..."
ssh -o ConnectTimeout=5 "$PI_HOST" "sudo systemctl restart focusboard" 2>/dev/null \
    && echo "Done. Dashboard is live." \
    || echo "Warning: restart failed (Pi may need manual restart)"
