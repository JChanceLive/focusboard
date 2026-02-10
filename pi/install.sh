#!/bin/bash
# FocusBoard Pi Setup
# Run on the Pi via SSH: ssh jopi@focusboard.local 'bash -s' < pi/install.sh
set -euo pipefail

echo "=== FocusBoard Pi Setup ==="

# Install dependencies
echo "Installing packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq chromium-browser unclutter xdotool

# Create directory structure
echo "Creating directories..."
mkdir -p /home/jopi/focusboard/dashboard
mkdir -p /home/jopi/focusboard/scripts
mkdir -p /home/jopi/focusboard/config

# Create initial state.json placeholder
cat > /home/jopi/focusboard/dashboard/state.json << 'PLACEHOLDER'
{
  "generated_at": "1970-01-01T00:00:00",
  "date": "",
  "day_label": "Setup",
  "now": {"block": "", "task": "Waiting for first sync from Mac", "file": "", "source": ""},
  "blocks": [],
  "keystones": [],
  "sop_tasks": [],
  "done_today": [],
  "tomorrow_focus": {"task": "", "action": "", "one_thing": "Run install-mac.sh on your Mac", "file": ""},
  "recording_ready": {"cc": 0, "pioneers": 0, "ha": 0, "zendo": 0, "total": 0},
  "quote": "Structure creates freedom. Trust the stacks.",
  "meta": {"sync_version": 1, "no_schedule": true}
}
PLACEHOLDER

# Set display rotation to portrait
echo "Configuring display rotation..."
if ! grep -q "display_rotate=1" /boot/config.txt 2>/dev/null; then
    echo "display_rotate=1" | sudo tee -a /boot/config.txt > /dev/null
    echo "Added display_rotate=1 to /boot/config.txt"
fi

# Disable screen blanking
echo "Disabling screen blanking..."
mkdir -p /home/jopi/.config/lxsession/LXDE-pi
cat > /home/jopi/.config/lxsession/LXDE-pi/autostart << 'AUTOSTART'
@lxpanel --profile LXDE-pi
@pcmanfm --desktop --profile LXDE-pi
@xset s off
@xset -dpms
@xset s noblank
@unclutter -idle 0.5 -root
AUTOSTART

# Install systemd service
echo "Installing systemd service..."
sudo cp /home/jopi/focusboard/config/focusboard.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable focusboard.service

# Enable auto-login
echo "Enabling auto-login..."
sudo raspi-config nonint do_boot_behaviour B4 2>/dev/null || {
    echo "Auto-login: set manually via raspi-config if needed"
}

echo ""
echo "=== Setup Complete ==="
echo "Next steps:"
echo "  1. Copy dashboard files: run deploy.sh from Mac"
echo "  2. Reboot: sudo reboot"
echo "  3. Verify: monitor shows dashboard in portrait mode"
