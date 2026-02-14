#!/bin/bash
# FocusBoard Pi Setup - Complete install for Raspberry Pi
# Run on the Pi via SSH: ssh youruser@focusboard.local 'bash -s' < pi/install.sh
#
# Prerequisites:
#   - Raspberry Pi OS (Bookworm or later recommended)
#   - Network connection (Wi-Fi or Ethernet)
#   - Monitor connected (HDMI, portrait orientation)
#
# What this does:
#   1. Installs packages (chromium, nginx, unclutter)
#   2. Creates directory structure
#   3. Configures nginx on port 8080
#   4. Configures Chromium kiosk via systemd
#   5. Sets portrait display rotation
#   6. Disables screen blanking
#   7. Enables auto-login
set -euo pipefail

PI_USER="${SUDO_USER:-$(whoami)}"
PI_HOME="/home/$PI_USER"
FB_DIR="$PI_HOME/focusboard"

echo "=== FocusBoard Pi Setup ==="
echo "User: $PI_USER | Home: $PI_HOME"

# Install dependencies
echo ""
echo "[1/7] Installing packages..."
sudo apt-get update -qq
sudo apt-get install -y -qq chromium-browser nginx unclutter xdotool

# Create directory structure
echo "[2/7] Creating directories..."
mkdir -p "$FB_DIR/dashboard"
mkdir -p "$FB_DIR/dashboard/videos"
mkdir -p "$FB_DIR/scripts"
mkdir -p "$FB_DIR/config"

# Create initial state.json placeholder
cat > "$FB_DIR/dashboard/state.json" << 'PLACEHOLDER'
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
  "calendar": [],
  "weather": {},
  "meta": {"sync_version": 2, "no_schedule": true}
}
PLACEHOLDER

# Configure nginx to serve dashboard on port 8080
echo "[3/7] Configuring nginx (port 8080)..."
sudo tee /etc/nginx/sites-available/focusboard > /dev/null << NGINX
server {
    listen 8080;
    server_name localhost;

    root $FB_DIR/dashboard;
    index index.html;

    location / {
        try_files \$uri \$uri/ =404;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Disable access logging to reduce SD card writes
    access_log off;
}
NGINX

# Enable site, disable default
sudo ln -sf /etc/nginx/sites-available/focusboard /etc/nginx/sites-enabled/focusboard
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

# Set display rotation to portrait
echo "[4/7] Configuring display rotation..."
# Bookworm uses /boot/firmware/config.txt, older uses /boot/config.txt
BOOT_CONFIG="/boot/firmware/config.txt"
if [ ! -f "$BOOT_CONFIG" ]; then
    BOOT_CONFIG="/boot/config.txt"
fi
if ! grep -q "display_rotate=1" "$BOOT_CONFIG" 2>/dev/null; then
    echo "display_rotate=1" | sudo tee -a "$BOOT_CONFIG" > /dev/null
    echo "  Added display_rotate=1 to $BOOT_CONFIG"
fi

# Disable screen blanking
echo "[5/7] Disabling screen blanking..."
mkdir -p "$PI_HOME/.config/lxsession/LXDE-pi"
cat > "$PI_HOME/.config/lxsession/LXDE-pi/autostart" << 'AUTOSTART'
@lxpanel --profile LXDE-pi
@pcmanfm --desktop --profile LXDE-pi
@xset s off
@xset -dpms
@xset s noblank
@unclutter -idle 0.5 -root
AUTOSTART

# Install systemd service (substitute username)
echo "[6/7] Installing systemd service..."
sed "s|__USER__|$PI_USER|g" "$FB_DIR/config/focusboard.service" | sudo tee /etc/systemd/system/focusboard.service > /dev/null
sudo systemctl daemon-reload
sudo systemctl enable focusboard.service

# Enable auto-login
echo "[7/7] Enabling auto-login..."
sudo raspi-config nonint do_boot_behaviour B4 2>/dev/null || {
    echo "  Auto-login: set manually via raspi-config if needed"
}

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  1. From your Mac, set up SSH keys:  bash setup-ssh.sh"
echo "  2. From your Mac, deploy dashboard:  bash deploy.sh"
echo "  3. From your Mac, set up sync job:   bash mac/install-mac.sh"
echo "  4. Create config with API keys:      cp focusboard-config.example.json ~/.claude/pi/focusboard-config.json"
echo "     Then edit ~/.claude/pi/focusboard-config.json with your real keys"
echo "  5. Reboot Pi:  sudo reboot"
echo "  6. Verify: monitor shows dashboard in portrait mode"
echo ""
echo "Pi IP address: $(hostname -I | awk '{print $1}')"
