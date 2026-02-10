#!/bin/bash
# Launch Chromium in kiosk mode for FocusBoard dashboard
# Called by focusboard.service

# Wait for X server
while ! xdotool getactivewindow > /dev/null 2>&1; do
    sleep 1
done

# Wait a bit more for desktop to settle
sleep 3

# Disable Chromium crash recovery popup
sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' \
    /home/jopi/.config/chromium/Default/Preferences 2>/dev/null || true
sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' \
    /home/jopi/.config/chromium/Default/Preferences 2>/dev/null || true

# Launch Chromium in kiosk mode
exec chromium-browser \
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
    /home/jopi/focusboard/dashboard/index.html
