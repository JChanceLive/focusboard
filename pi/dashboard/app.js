// FocusBoard Dashboard V2 - app.js
// Polls state.json, renders dashboard with per-block icons/colors/details,
// weather widget, Google Calendar panel, and keystone streaks

(function () {
    'use strict';

    const POLL_INTERVAL = 10000;
    const CLOCK_INTERVAL = 1000;
    const OFFLINE_THRESHOLD = 5 * 60 * 1000;
    const NIGHT_START_HOUR = 18;
    const NIGHT_END_HOUR = 5;
    const BG_ROTATE_INTERVAL = 5 * 60 * 1000; // rotate bg image every 5 min

    let lastState = null;
    let lastGeneratedAt = null;
    let nightModeActive = false;
    let nightCountdownId = null;

    // ─── DOM refs ──────────────────────────────────────────────────────

    const $ = (id) => document.getElementById(id);
    const $heroClock = $('hero-clock');
    const $dateLabel = $('date-label');
    const $heroWeather = $('hero-weather');
    const $offlineBanner = $('offline-banner');
    const $offlineTime = $('offline-time');
    const $currentBlock = $('current-block');
    const $currentIcon = $('current-icon');
    const $currentBlockName = $('current-block-name');
    const $currentSublabel = $('current-block-sublabel');
    const $currentTask = $('current-task');
    const $currentFile = $('current-file');
    const $currentBadge = $('current-badge');
    const $currentBehind = $('current-behind');
    const $currentDetails = $('current-details');
    const $scheduleList = $('schedule-list');
    const $calendarList = $('calendar-list');
    const $bottomZone = $('bottom-zone');
    const $keystonesBar = $('keystones-bar');
    const $syncDot = $('sync-dot');
    const $syncText = $('sync-text');
    const $nightMoon = $('night-moon');
    const $nightClock = $('night-clock');
    const $nightDate = $('night-date');
    const $nightCountdown = $('night-countdown');

    // ─── Clock ─────────────────────────────────────────────────────────

    function isNightTime() {
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

    function updateClock() {
        var now = new Date();
        var timeStr = formatClockString(now);
        $heroClock.textContent = timeStr;

        if (isNightTime()) {
            if (!nightModeActive) enterNightMode();
            // Update night clock every tick
            $nightClock.textContent = timeStr;
        } else {
            if (nightModeActive) exitNightMode();
        }
    }

    // ─── Moon Phase ─────────────────────────────────────────────────

    function getMoonPhase() {
        // Calculate moon phase from a known new moon reference date
        // Jan 6, 2000 18:14 UTC was a new moon
        var ref = new Date(2000, 0, 6, 18, 14, 0);
        var now = new Date();
        var diff = now.getTime() - ref.getTime();
        var days = diff / 86400000;
        var cycle = 29.53058770576;
        var phase = ((days % cycle) + cycle) % cycle;
        var index = Math.round(phase / cycle * 8) % 8;
        // Emoji sequence: new, waxing crescent, first quarter, waxing gibbous,
        // full, waning gibbous, last quarter, waning crescent
        var emojis = ['\uD83C\uDF11', '\uD83C\uDF12', '\uD83C\uDF13', '\uD83C\uDF14',
                      '\uD83C\uDF15', '\uD83C\uDF16', '\uD83C\uDF17', '\uD83C\uDF18'];
        return emojis[index];
    }

    // ─── Night Mode Lifecycle ────────────────────────────────────────

    function enterNightMode() {
        nightModeActive = true;
        document.body.classList.add('night-mode');

        // Update night overlay content
        $nightMoon.textContent = getMoonPhase();
        var now = new Date();
        $nightClock.textContent = formatClockString(now);
        $nightDate.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
        });

        // Start countdown
        updateNightCountdown();
        nightCountdownId = setInterval(updateNightCountdown, 60000);
    }

    function exitNightMode() {
        nightModeActive = false;
        document.body.classList.remove('night-mode');

        // Clear intervals
        if (nightCountdownId) { clearInterval(nightCountdownId); nightCountdownId = null; }
    }

    function updateNightCountdown() {
        if (!lastState || !lastState.blocks || !lastState.blocks.length) {
            $nightCountdown.innerHTML = '';
            return;
        }

        // Find first block of the day
        var firstBlock = lastState.blocks[0];
        var now = new Date();

        // Parse block time (e.g., "6:30")
        var parts = firstBlock.time.split(':');
        var blockHour = parseInt(parts[0], 10);
        var blockMin = parseInt(parts[1], 10);

        // Build target date: if we're before midnight and block is morning,
        // target is tomorrow. If we're after midnight, target is today.
        var target = new Date(now);
        target.setHours(blockHour, blockMin, 0, 0);

        // If target is in the past (we're in the evening, block is morning), add a day
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
            '<div class="nc-block">' + esc(blockName) + ' in</div>' +
            '<div class="nc-time">' + timeStr + '</div>';

        // Update night date too (in case it rolls past midnight)
        $nightDate.textContent = now.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric'
        });
    }

    // ─── Fetch state ───────────────────────────────────────────────────

    async function fetchState() {
        try {
            const resp = await fetch('state.json?t=' + Date.now());
            if (!resp.ok) throw new Error('fetch failed');
            const state = await resp.json();
            lastState = state;
            lastGeneratedAt = new Date(state.generated_at);
            render(state);
            updateSyncStatus(true);
        } catch (e) {
            updateSyncStatus(false);
            if (lastState) render(lastState);
        }
    }

    // ─── Sync status ───────────────────────────────────────────────────

    function updateSyncStatus() {
        const now = new Date();

        if (!lastGeneratedAt) {
            $syncDot.className = 'sync-dot offline';
            $syncText.textContent = 'Waiting for first sync...';
            $offlineBanner.classList.add('hidden');
            return;
        }

        const age = now - lastGeneratedAt;
        const minutes = Math.floor(age / 60000);

        if (age < OFFLINE_THRESHOLD) {
            $syncDot.className = 'sync-dot';
            $syncText.textContent = minutes < 1
                ? 'Synced just now'
                : `Synced ${minutes} min ago`;
            $offlineBanner.classList.add('hidden');
        } else {
            $syncDot.className = 'sync-dot offline';
            $syncText.textContent = `Last sync ${minutes} min ago`;
            $offlineBanner.classList.remove('hidden');
            $offlineTime.textContent = formatTime(lastGeneratedAt);
        }
    }

    function formatTime(date) {
        const h = date.getHours();
        const m = date.getMinutes().toString().padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        return `${h % 12 || 12}:${m} ${ampm}`;
    }

    // ─── Render ────────────────────────────────────────────────────────

    function formatShortDate(isoDate) {
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        if (isoDate) {
            var parts = isoDate.split('-');
            var month = parseInt(parts[1], 10) - 1;
            var day = parseInt(parts[2], 10);
            return months[month] + ' ' + day;
        }
        var now = new Date();
        return months[now.getMonth()] + ' ' + now.getDate();
    }

    function render(state) {
        $dateLabel.textContent = formatShortDate(state.date) || state.day_label || '';

        // During night mode, only update countdown data (overlay is handled by lifecycle)
        if (nightModeActive) {
            updateNightCountdown();
            return;
        }

        const allDone = state.meta && state.meta.all_done;
        const noSchedule = state.meta && state.meta.no_schedule;

        // Remove old legacy overlay
        const oldOverlay = $currentBlock.querySelector('.night-legacy-overlay');
        if (oldOverlay) oldOverlay.remove();

        if (allDone) {
            renderDayComplete(state);
        } else if (noSchedule) {
            renderWaiting(state);
        } else {
            renderCurrentBlock(state);
        }

        renderSchedule(state.blocks || []);
        renderCalendar(state.calendar || []);
        renderWeather(state.weather || {});
        renderKeystones(state.keystones || []);
    }

    function setBlockColor(color) {
        document.documentElement.style.setProperty('--block-color', color || '#3498db');
    }

    function renderCurrentBlock(state) {
        const now = state.now || {};
        const color = now.color || '#3498db';

        setBlockColor(color);
        $currentBlock.className = 'current-block';

        // Icon
        $currentIcon.textContent = now.icon || '';
        $currentIcon.style.display = now.icon ? '' : 'none';

        // Block name
        $currentBlockName.textContent = now.block || '';

        // Sublabel (e.g., "CREATION" label distinct from block name like "Creation")
        // Hide if label matches block name OR task name (case-insensitive)
        var labelUpper = (now.label || '').toUpperCase();
        var taskUpper = (now.task || '').toUpperCase();
        var blockUpper = (now.block || '').toUpperCase();
        if (now.label && labelUpper !== blockUpper && labelUpper !== taskUpper) {
            $currentSublabel.textContent = now.label;
            $currentSublabel.style.display = '';
        } else {
            $currentSublabel.style.display = 'none';
        }

        // Task
        $currentTask.textContent = now.task || '';

        // File + source
        if (now.file) {
            $currentFile.textContent = now.file + (now.source || '');
        } else {
            $currentFile.textContent = '';
        }

        // Badge
        const currentBlockData = (state.blocks || []).find(b => b.is_current);
        if (currentBlockData && currentBlockData.required) {
            $currentBadge.textContent = '\u25C6 Keystone Trigger';
        } else {
            $currentBadge.textContent = '';
        }

        // Behind schedule indicator
        var blocks = state.blocks || [];
        var blockMinutes = parseBlockMinutes(blocks);
        var currentMin = getCurrentMinutes();
        var timePos = findTimePosition(blockMinutes, currentMin);
        var currentIdx = blocks.findIndex(function(b) { return b.is_current; });

        if (timePos > currentIdx && currentIdx >= 0) {
            var skipped = timePos - currentIdx;
            $currentBehind.textContent = '\u23F1 ' + skipped + ' block' + (skipped > 1 ? 's' : '') + ' behind schedule';
        } else {
            $currentBehind.textContent = '';
        }

        // Details
        const details = now.details || [];
        $currentDetails.innerHTML = '';
        for (const d of details) {
            const div = document.createElement('div');
            div.className = 'detail-item';
            div.textContent = d;
            $currentDetails.appendChild(div);
        }

        // Show divider
        const divider = $currentBlock.querySelector('.current-block-divider');
        if (divider) divider.style.display = '';
    }

    function renderDayComplete(state) {
        const tf = state.tomorrow_focus || {};

        setBlockColor('#2ecc71');
        $currentBlock.className = 'current-block day-complete';

        $currentIcon.textContent = '\u2714';
        $currentIcon.style.display = '';
        $currentBlockName.textContent = 'Day Complete';
        $currentSublabel.style.display = 'none';
        $currentTask.textContent = '';
        $currentFile.textContent = '';
        $currentBadge.textContent = '';
        $currentBehind.textContent = '';
        $currentDetails.innerHTML = '';

        const divider = $currentBlock.querySelector('.current-block-divider');
        if (divider) divider.style.display = 'none';

        const overlay = document.createElement('div');
        overlay.className = 'night-legacy-overlay';

        if (tf.task) {
            overlay.innerHTML = `
                <div class="night-tomorrow-label">Tomorrow</div>
                <div class="night-tomorrow-task">${esc(tf.task)}</div>
                ${tf.action ? `<div class="night-tomorrow-action">${esc(tf.action)}</div>` : ''}
                ${tf.one_thing ? `<div class="night-quote">"${esc(tf.one_thing)}"</div>` : ''}
            `;
        } else {
            overlay.innerHTML = `<div class="night-quote">"${esc(state.quote || '')}"</div>`;
        }

        $currentBlock.appendChild(overlay);
    }

    function renderWaiting(state) {
        setBlockColor('#555');
        $currentBlock.className = 'current-block';
        $currentIcon.textContent = '\u25CC';
        $currentIcon.style.display = '';
        $currentBlockName.textContent = 'Waiting';
        $currentSublabel.style.display = 'none';
        $currentTask.textContent = 'Schedule not generated yet';
        $currentFile.textContent = '';
        $currentBadge.textContent = '';
        $currentBehind.textContent = '';
        $currentDetails.innerHTML = '';
    }

    function renderSchedule(blocks) {
        $scheduleList.innerHTML = '';

        var blockMinutes = parseBlockMinutes(blocks);
        var currentMin = getCurrentMinutes();
        var timePos = findTimePosition(blockMinutes, currentMin);
        var currentIdx = blocks.findIndex(function(b) { return b.is_current; });
        var markerInserted = false;

        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];

            // Insert NOW marker before the block that time says we're in
            // but only if it differs from the current (checked) position
            if (!markerInserted && timePos >= 0 && i === timePos + 1 && timePos !== currentIdx) {
                var marker = document.createElement('div');
                marker.className = 'schedule-now-marker';
                marker.innerHTML = '<span class="now-label">NOW</span><span class="now-line"></span>';
                $scheduleList.appendChild(marker);
                markerInserted = true;
            }

            var div = document.createElement('div');
            var color = b.color || '#888';

            var statusClass = 'pending';
            var icon = '';
            if (b.done) {
                statusClass = 'done';
                icon = '\u2713';
            } else if (b.is_current) {
                statusClass = 'current';
                icon = '\u25B6';
            } else if (!b.done && currentIdx >= 0 && i < currentIdx) {
                // Unchecked block before the current one (shouldn't happen normally)
                statusClass = 'skipped';
                icon = '\u25CB'; // ○
            } else if (!b.done && timePos >= 0 && i < timePos && i > currentIdx) {
                // Unchecked, time has passed this block, between current and time position
                statusClass = 'skipped';
                icon = '\u25CB'; // ○
            }

            div.className = 'schedule-item ' + statusClass;

            var taskText = b.done
                ? '<s>' + esc(b.task) + '</s>'
                : esc(b.task);

            div.innerHTML =
                '<span class="s-dot" style="background:' + (b.done ? '#555' : color) + '"></span>' +
                '<span class="s-icon">' + icon + '</span>' +
                '<span class="s-time">' + esc(b.time) + '</span>' +
                '<span class="s-block" style="' + (b.is_current ? 'color:' + color : '') + '">' + esc(b.block) + '</span>' +
                '<span class="s-task">' + taskText + '</span>';

            $scheduleList.appendChild(div);
        }

        // If NOW marker should be after the last block
        if (!markerInserted && timePos >= blocks.length - 1 && timePos !== currentIdx) {
            var marker = document.createElement('div');
            marker.className = 'schedule-now-marker';
            marker.innerHTML = '<span class="now-label">NOW</span><span class="now-line"></span>';
            $scheduleList.appendChild(marker);
        }
    }

    // ─── Calendar Panel ─────────────────────────────────────────────

    function renderCalendar(events) {
        $calendarList.innerHTML = '';

        if (!events || !events.length) {
            var empty = document.createElement('div');
            empty.className = 'cal-empty';
            empty.textContent = 'No upcoming events';
            $calendarList.appendChild(empty);
            return;
        }

        var today = new Date();
        var todayStr = today.toISOString().slice(0, 10);
        var tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        var tomorrowStr = tomorrow.toISOString().slice(0, 10);

        var currentGroup = '';

        for (var i = 0; i < events.length; i++) {
            var evt = events[i];
            var startStr = evt.start || '';
            var eventDate = startStr.slice(0, 10);

            // Determine group label
            var groupLabel = '';
            if (eventDate === todayStr) {
                groupLabel = 'TODAY';
            } else if (eventDate === tomorrowStr) {
                groupLabel = 'TOMORROW';
            } else {
                // Future date
                try {
                    var d = new Date(startStr);
                    groupLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                } catch (e) {
                    groupLabel = eventDate;
                }
            }

            // Insert day divider if group changed
            if (groupLabel !== currentGroup) {
                var divider = document.createElement('div');
                divider.className = 'cal-day-divider';
                divider.textContent = groupLabel;
                $calendarList.appendChild(divider);
                currentGroup = groupLabel;
            }

            // Event card
            var card = document.createElement('div');
            card.className = 'cal-event' + (evt.all_day ? ' all-day' : '');

            var timeHtml = '';
            if (evt.all_day) {
                timeHtml = '<span class="cal-time">All day</span>';
            } else {
                var startTime = formatEventTime(evt.start);
                var endTime = formatEventTime(evt.end);
                timeHtml = '<span class="cal-time">' + startTime + ' \u2013 ' + endTime + '</span>';
            }

            var locationHtml = evt.location
                ? '<span class="cal-location">' + esc(evt.location) + '</span>'
                : '';

            card.innerHTML = timeHtml +
                '<span class="cal-title">' + esc(evt.title) + '</span>' +
                locationHtml;

            $calendarList.appendChild(card);
        }
    }

    function formatEventTime(isoStr) {
        if (!isoStr) return '';
        try {
            var d = new Date(isoStr);
            var h = d.getHours();
            var m = d.getMinutes().toString().padStart(2, '0');
            var ampm = h >= 12 ? 'PM' : 'AM';
            var h12 = h % 12 || 12;
            return h12 + ':' + m + ' ' + ampm;
        } catch (e) {
            return isoStr;
        }
    }

    // ─── Weather Widget ──────────────────────────────────────────────

    function renderWeather(weather) {
        if (!weather || !weather.temp) {
            $heroWeather.innerHTML = '';
            return;
        }

        var html = '<div class="weather-main">' +
            '<span class="weather-icon">' + (weather.icon_char || '\u2600') + '</span>' +
            '<span class="weather-temp">' + weather.temp + '\u00B0</span>' +
            '</div>';

        // Detail row: feels like, high/low, humidity
        var details = [];
        if (weather.feels_like) details.push('Feels ' + weather.feels_like + '\u00B0');
        if (weather.high && weather.low) details.push('H:' + weather.high + '\u00B0 L:' + weather.low + '\u00B0');
        if (weather.humidity) details.push(weather.humidity + '% humidity');

        if (details.length) {
            html += '<div class="weather-details">';
            for (var i = 0; i < details.length; i++) {
                html += '<span>' + esc(details[i]) + '</span>';
            }
            html += '</div>';
        }

        if (weather.description) {
            html += '<div class="weather-desc">' + esc(weather.description) + '</div>';
        }

        $heroWeather.innerHTML = html;
    }

    // ─── Keystones (with streaks) ────────────────────────────────────

    function renderKeystones(keystones) {
        if (!keystones.length) {
            $keystonesBar.innerHTML = '';
            return;
        }

        var html = '<span class="ks-label">KEYSTONES</span>';
        for (var i = 0; i < keystones.length; i++) {
            var ks = keystones[i];
            var cls = ks.done ? 'ks-done' : 'ks-pending';
            var critical = ks.critical ? ' ks-critical' : '';
            var symbol = ks.done ? '\u25C6' : '\u25C7';
            var streak = ks.streak || 0;
            var streakLabel = streak > 0 ? streak + 'd' : '';

            html += '<span class="ks-item ' + cls + critical + '" title="' + esc(ks.name) + '">' +
                '<span class="ks-symbol">' + symbol + '</span>' +
                '<span class="ks-streak">' + streakLabel + '</span>' +
                '</span>';
        }
        $keystonesBar.innerHTML = html;
    }

    // ─── Time Helpers (Hybrid Mode) ─────────────────────────────────

    function parseBlockMinutes(blocks) {
        // Convert block time strings to minutes-since-midnight
        // Handles AM/PM ambiguity: if a time < previous, assume PM
        var result = [];
        var prev = 0;
        for (var i = 0; i < blocks.length; i++) {
            var parts = blocks[i].time.split(':');
            var h = parseInt(parts[0], 10);
            var m = parseInt(parts[1], 10);
            var total = h * 60 + m;
            if (total < prev && h < 12) {
                total += 12 * 60; // PM
            }
            prev = total;
            result.push(total);
        }
        return result;
    }

    function getCurrentMinutes() {
        var now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    }

    function findTimePosition(blockMinutes, currentMin) {
        // Returns the index of the block the clock says we should be in
        // (last block whose start time <= current time)
        var pos = -1;
        for (var i = 0; i < blockMinutes.length; i++) {
            if (currentMin >= blockMinutes[i]) pos = i;
        }
        return pos;
    }

    // ─── Life Counters ──────────────────────────────────────────────────

    var LIFE_DATES = {
        alive: new Date(1987, 5, 3),     // June 3, 1987
        allIn: new Date(2025, 5, 29),    // June 29, 2025
        baby: new Date(2026, 0, 18),     // January 18, 2026
        launch: null                      // Set date here when ready, e.g. new Date(2026, 2, 1)
    };

    var $counterAlive = $('counter-alive');
    var $counterAllIn = $('counter-allin');
    var $counterBaby = $('counter-baby');
    var $counterLaunch = $('counter-launch');
    var $counterLaunchItem = $('counter-launch-item');
    var $counterLaunchSep = $('counter-launch-sep');

    function daysSince(startDate) {
        var now = new Date();
        now.setHours(0, 0, 0, 0);
        var start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        return Math.floor((now - start) / 86400000);
    }

    function formatNumber(n) {
        return n.toLocaleString('en-US');
    }

    function updateLifeCounters() {
        $counterAlive.textContent = formatNumber(daysSince(LIFE_DATES.alive));
        $counterAllIn.textContent = formatNumber(daysSince(LIFE_DATES.allIn));
        $counterBaby.textContent = formatNumber(daysSince(LIFE_DATES.baby));

        if (LIFE_DATES.launch) {
            $counterLaunch.textContent = formatNumber(daysSince(LIFE_DATES.launch));
            $counterLaunchItem.style.display = '';
            $counterLaunchSep.style.display = '';
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────

    function esc(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ─── Background Image ────────────────────────────────────────────

    const $bgImage = $('bg-image');

    function loadBackgroundImage() {
        // picsum.photos: reliable, always returns exact dimensions requested (portrait 1080x1920)
        const url = 'https://picsum.photos/1080/1920?random=' + Math.floor(Math.random() * 10000);
        const img = new Image();
        img.onload = function () {
            $bgImage.style.backgroundImage = 'url(' + img.src + ')';
            $bgImage.classList.add('loaded');
        };
        img.onerror = function () {
            // Fallback to loremflickr
            const fallback = 'https://loremflickr.com/1080/1920/nature,forest,mountain,ocean?lock=' + Math.floor(Math.random() * 10000);
            const fb = new Image();
            fb.onload = function () {
                $bgImage.style.backgroundImage = 'url(' + fb.src + ')';
                $bgImage.classList.add('loaded');
            };
            fb.src = fallback;
        };
        img.src = url;
    }

    function rotateBackgroundImage() {
        $bgImage.classList.remove('loaded'); // fade out
        setTimeout(loadBackgroundImage, 2000); // load new after fade-out
    }

    // ─── Night Mode Test Toggle ─────────────────────────────────────

    var nightForced = false;

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
                // Re-render day view
                if (lastState) render(lastState);
            }
        }
    });

    // Override isNightTime to respect forced mode
    var _origIsNight = isNightTime;
    isNightTime = function () {
        if (nightForced) return true;
        return _origIsNight();
    };

    // ─── Init ──────────────────────────────────────────────────────────

    updateClock();
    setInterval(updateClock, CLOCK_INTERVAL);
    updateLifeCounters();
    setInterval(updateLifeCounters, POLL_INTERVAL);
    fetchState();
    setInterval(fetchState, POLL_INTERVAL);
    loadBackgroundImage();
    setInterval(rotateBackgroundImage, BG_ROTATE_INTERVAL);

})();
