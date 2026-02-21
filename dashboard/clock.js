// FocusBoard - Clock, night mode, moon phase
(function () {
    'use strict';

    var NIGHT_START_HOUR = 18;
    var NIGHT_END_HOUR = 5;

    var nightModeActive = false;
    var nightCountdownId = null;
    var nightForced = false;

    var $heroClock = FocusBoard.$('hero-clock');
    var $dateLabel = FocusBoard.$('date-label');
    var $nightMoon = FocusBoard.$('night-moon');
    var $nightClock = FocusBoard.$('night-clock');
    var $nightDate = FocusBoard.$('night-date');
    var $nightCountdown = FocusBoard.$('night-countdown');

    function isNightTime() {
        if (nightForced) return true;
        var override = FocusBoard.override;
        if (override && override.mode === 'day') return false;
        if (override && override.mode === 'night') return true;
        var h = new Date().getHours();
        return h >= NIGHT_START_HOUR || h < NIGHT_END_HOUR;
    }

    function formatClockString(date) {
        var hours = date.getHours();
        var minutes = date.getMinutes().toString().padStart(2, '0');
        var ampm = hours >= 12 ? 'PM' : 'AM';
        var h12 = hours % 12 || 12;
        return h12 + ':' + minutes + ' ' + ampm;
    }

    function getMoonPhase() {
        var ref = new Date(2000, 0, 6, 18, 14, 0);
        var now = new Date();
        var diff = now.getTime() - ref.getTime();
        var days = diff / 86400000;
        var cycle = 29.53058770576;
        var phase = ((days % cycle) + cycle) % cycle;
        var index = Math.round(phase / cycle * 8) % 8;
        var emojis = ['\uD83C\uDF11', '\uD83C\uDF12', '\uD83C\uDF13', '\uD83C\uDF14',
                      '\uD83C\uDF15', '\uD83C\uDF16', '\uD83C\uDF17', '\uD83C\uDF18'];
        return emojis[index];
    }

    function updateNightCountdown() {
        var state = FocusBoard.lastState;
        if (!state || !state.blocks || !state.blocks.length) {
            $nightCountdown.innerHTML = '';
            return;
        }

        var firstBlock = state.blocks[0];
        var now = new Date();
        var parts = firstBlock.time.split(':');
        var blockHour = parseInt(parts[0], 10);
        var blockMin = parseInt(parts[1], 10);

        var target = new Date(now);
        target.setHours(blockHour, blockMin, 0, 0);
        if (target <= now) {
            target.setDate(target.getDate() + 1);
        }

        var diffMs = target - now;
        var diffH = Math.floor(diffMs / 3600000);
        var diffM = Math.floor((diffMs % 3600000) / 60000);

        var blockName = firstBlock.block || 'First Block';
        var timeStr = diffH > 0
            ? diffH + 'h ' + diffM + 'm'
            : diffM + 'm';

        $nightCountdown.innerHTML =
            '<div class="nc-block">' + FocusBoard.esc(blockName) + ' in</div>' +
            '<div class="nc-time">' + timeStr + '</div>';

        $nightDate.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
        });
    }

    function enterNightMode() {
        nightModeActive = true;
        document.body.classList.add('night-mode');

        $nightMoon.textContent = getMoonPhase();
        var now = new Date();
        $nightClock.textContent = formatClockString(now);
        $nightDate.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
        });

        updateNightCountdown();
        nightCountdownId = setInterval(updateNightCountdown, 60000);
    }

    function exitNightMode() {
        nightModeActive = false;
        document.body.classList.remove('night-mode');
        if (nightCountdownId) { clearInterval(nightCountdownId); nightCountdownId = null; }
    }

    function updateClock() {
        var now = new Date();
        var timeStr = formatClockString(now);
        $heroClock.textContent = timeStr;

        if (isNightTime()) {
            if (!nightModeActive) enterNightMode();
            $nightClock.textContent = timeStr;
        } else {
            if (nightModeActive) exitNightMode();
        }
    }

    // URL param ?night forces night mode for testing
    if (window.location.search.indexOf('night') !== -1) {
        nightForced = true;
    }

    // Press 'N' to toggle night mode for testing
    document.addEventListener('keydown', function (e) {
        if (e.key === 'n' || e.key === 'N') {
            nightForced = !nightForced;
            if (nightForced) {
                enterNightMode();
            } else {
                exitNightMode();
                if (FocusBoard.lastState) FocusBoard.render(FocusBoard.lastState);
            }
        }
    });

    // Expose for app.js init
    FocusBoard.updateClock = updateClock;
    FocusBoard.isNightMode = function () { return nightModeActive; };
    FocusBoard.updateNightCountdown = updateNightCountdown;
})();
