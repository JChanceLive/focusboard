#!/bin/bash
# Launch Chromium in kiosk mode for FocusBoard dashboard
# Called by focusboard.service

export XDG_RUNTIME_DIR=/run/user/$(id -u)
export WAYLAND_DISPLAY=wayland-0

# Wait for Wayland compositor
while ! wlr-randr > /dev/null 2>&1; do
    sleep 1
done

# Apply portrait rotation
wlr-randr --output HDMI-A-1 --transform 90 2>/dev/null || true

# Wait for desktop to settle
sleep 3

# Start local HTTP server for dashboard (fetch needs http://)
cd /home/jopi/focusboard/dashboard
python3 -m http.server 8080 --bind 127.0.0.1 &
HTTP_PID=$!
sleep 1

# Disable Chromium crash recovery popup
for prefs in /home/jopi/.config/chromium/Default/Preferences; do
    if [ -f "$prefs" ]; then
        sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$prefs" 2>/dev/null
        sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$prefs" 2>/dev/null
    fi
done

# Launch Chromium in kiosk mode
CHROMIUM=$(which chromium-browser 2>/dev/null || which chromium)
$CHROMIUM \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --disable-translate \
    --no-first-run \
    --disable-features=TranslateUI \
    --check-for-update-interval=31536000 \
    --disable-session-crashed-bubble \
    --disable-component-update \
    --autoplay-policy=no-user-gesture-required \
    --ozone-platform=wayland \
    http://127.0.0.1:8080/index.html

# Cleanup
kill $HTTP_PID 2>/dev/null
