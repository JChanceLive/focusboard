#!/bin/bash
# Monitor power schedule for FocusBoard
# Usage: monitor-schedule.sh on|off
# Called by cron to turn monitor off at night, on in morning
#
# Writes /tmp/focusboard-screen-off marker so focusboard-cam.py
# knows to wake the screen on motion (and turn it back off after).

export XDG_RUNTIME_DIR=/run/user/$(id -u)
export WAYLAND_DISPLAY=wayland-0

SCREEN_OFF_MARKER="/tmp/focusboard-screen-off"

case "$1" in
  off)
    touch "$SCREEN_OFF_MARKER"
    wlr-randr --output HDMI-A-1 --off
    ;;
  on)
    rm -f "$SCREEN_OFF_MARKER"
    wlr-randr --output HDMI-A-1 --on --transform 90
    ;;
  *)
    echo "Usage: $0 on|off"
    exit 1
    ;;
esac
