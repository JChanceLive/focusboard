#!/bin/bash
# Monitor power schedule for FocusBoard
# Usage: monitor-schedule.sh on|off
# Called by cron to turn monitor off at night, on in morning

export XDG_RUNTIME_DIR=/run/user/$(id -u)
export WAYLAND_DISPLAY=wayland-0

case "$1" in
  off)
    wlr-randr --output HDMI-A-1 --off
    ;;
  on)
    wlr-randr --output HDMI-A-1 --on --transform 90
    ;;
  *)
    echo "Usage: $0 on|off"
    exit 1
    ;;
esac
