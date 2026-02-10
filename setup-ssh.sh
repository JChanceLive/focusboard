#!/bin/bash
# Setup SSH key-based auth to FocusBoard Pi
# Run from Mac after Pi is on the network
set -euo pipefail

PI_HOST="focusboard.local"
PI_USER="jopi"

echo "Setting up SSH keys for $PI_USER@$PI_HOST..."

# Generate key if needed
if [ ! -f "$HOME/.ssh/id_ed25519" ]; then
    echo "No SSH key found. Generate one first:"
    echo "  ssh-keygen -t ed25519"
    exit 1
fi

# Copy key to Pi
ssh-copy-id "$PI_USER@$PI_HOST"

echo ""
echo "Testing connection..."
ssh "$PI_USER@$PI_HOST" "echo 'SSH connection OK - hostname: \$(hostname)'"

echo ""
echo "Done. Passwordless SSH configured."
