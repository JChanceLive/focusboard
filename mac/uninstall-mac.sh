#!/bin/bash
# Uninstall FocusBoard launchd sync job
set -euo pipefail

PLIST_DEST="$HOME/Library/LaunchAgents/com.focusboard.sync.plist"

echo "Removing FocusBoard sync job..."

if [ -f "$PLIST_DEST" ]; then
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
    rm "$PLIST_DEST"
    echo "Removed."
else
    echo "Not installed."
fi
