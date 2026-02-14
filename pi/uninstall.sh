#!/bin/bash
# Uninstall FocusBoard from Pi
set -euo pipefail

echo "Removing FocusBoard..."

sudo systemctl stop focusboard.service 2>/dev/null || true
sudo systemctl disable focusboard.service 2>/dev/null || true
sudo rm -f /etc/systemd/system/focusboard.service
sudo systemctl daemon-reload

PI_USER="${SUDO_USER:-$(whoami)}"
echo "Service removed. Dashboard files remain at /home/$PI_USER/focusboard/"
echo "To fully remove: rm -rf /home/$PI_USER/focusboard"
