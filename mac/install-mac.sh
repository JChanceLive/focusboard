#!/bin/bash
# Install FocusBoard Mac sync job
# Installs the launchd job that generates state.json and scp's it to the Pi every 2 min
#
# Prerequisites:
#   - Python 3 with: requests, pyyaml (pip3 install requests pyyaml)
#   - SSH key access to Pi (run setup-ssh.sh first)
#   - focusboard-config.json with API keys
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLIST_SRC="$SCRIPT_DIR/com.focusboard.sync.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.focusboard.sync.plist"
CONFIG_DIR="$HOME/.claude/pi"
CONFIG_FILE="$CONFIG_DIR/focusboard-config.json"

echo "=== Installing FocusBoard Mac Sync ==="

# Create state directory
mkdir -p "$CONFIG_DIR"

# Check for config file
if [ ! -f "$CONFIG_FILE" ]; then
    echo ""
    echo "Config file not found at: $CONFIG_FILE"
    echo "Creating from template..."
    cp "$PROJECT_DIR/focusboard-config.example.json" "$CONFIG_FILE"
    echo ""
    echo "IMPORTANT: Edit $CONFIG_FILE with your real API keys:"
    echo "  - Google Calendar: client_id, client_secret, refresh_token"
    echo "  - OpenWeatherMap: api_key (free at https://openweathermap.org/api)"
    echo ""
    echo "Then re-run this script."
    exit 1
fi

# Check Python dependencies
echo "Checking Python dependencies..."
python3 -c "import requests, yaml" 2>/dev/null || {
    echo "Missing Python packages. Installing..."
    pip3 install requests pyyaml
}

# Copy plist
cp "$PLIST_SRC" "$PLIST_DEST"

# Load the job (unload first if exists)
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

echo ""
echo "=== Installed ==="
echo "Sync runs every 2 minutes."
echo "Check status:  launchctl list | grep focusboard"
echo "View logs:     cat ~/.claude/pi/sync.log"
echo "Test now:      bash $SCRIPT_DIR/generate-state.sh"
