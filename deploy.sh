#!/bin/bash
# Deploy dashboard files to FocusBoard Pi
# Run from project root on Mac
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PI_USER="${FOCUSBOARD_USER:-}"
if [ -z "$PI_USER" ]; then
    read -rp "Pi username [$(whoami)]: " PI_USER
    PI_USER="${PI_USER:-$(whoami)}"
fi
PI_HOST="${FOCUSBOARD_HOST:-${PI_USER}@focusboard.local}"
PI_BASE="/home/${PI_USER}/focusboard"

echo "Deploying FocusBoard dashboard to ${PI_HOST}..."

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

# NOTE: Pi uses nginx on port 8080 (not python http.server).
# nginx must be installed and configured: /etc/nginx/sites-enabled/focusboard
# Restart service after deploy to pick up changes:
echo "Deployed. Restart focusboard service on Pi:"
echo "  ssh $PI_HOST 'sudo systemctl restart focusboard'"
