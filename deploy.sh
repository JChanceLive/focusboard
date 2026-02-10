#!/bin/bash
# Deploy dashboard files to FocusBoard Pi
# Run from project root on Mac
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PI_HOST="${FOCUSBOARD_HOST:-jopi@10.0.0.58}"
PI_BASE="/home/jopi/focusboard"

echo "Deploying FocusBoard dashboard to Pi..."

# Deploy dashboard files
scp -o ConnectTimeout=5 \
    "$SCRIPT_DIR/pi/dashboard/"* \
    "$PI_HOST:$PI_BASE/dashboard/"

# Deploy scripts
scp -o ConnectTimeout=5 \
    "$SCRIPT_DIR/pi/scripts/"* \
    "$PI_HOST:$PI_BASE/scripts/"

# Make scripts executable
ssh "$PI_HOST" "chmod +x $PI_BASE/scripts/*.sh"

# Deploy service file
scp -o ConnectTimeout=5 \
    "$SCRIPT_DIR/pi/config/focusboard.service" \
    "$PI_HOST:$PI_BASE/config/"

echo "Deployed. Refresh browser on Pi:"
echo "  ssh $PI_HOST 'DISPLAY=:0 xdotool key F5'"
