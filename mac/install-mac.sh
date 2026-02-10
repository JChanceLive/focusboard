#!/bin/bash
# Install FocusBoard launchd sync job
set -euo pipefail

PLIST_SRC="$(cd "$(dirname "$0")" && pwd)/com.focusboard.sync.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.focusboard.sync.plist"

echo "Installing FocusBoard sync job..."

# Create state directory
mkdir -p "$HOME/.claude/pi"

# Copy plist
cp "$PLIST_SRC" "$PLIST_DEST"

# Load the job
launchctl load "$PLIST_DEST"

echo "Installed. Sync runs every 2 minutes."
echo "Check status: launchctl list | grep focusboard"
echo "View logs: cat ~/.claude/pi/sync.log"
