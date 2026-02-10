// FocusBoard Dashboard - app.js
// Polls state.json, renders dashboard with per-block icons/colors/details

(function () {
    'use strict';

    const POLL_INTERVAL = 10000;
    const CLOCK_INTERVAL = 1000;
    const OFFLINE_THRESHOLD = 5 * 60 * 1000;
    const NIGHT_HOUR = 21;
    const BG_ROTATE_INTERVAL = 30 * 60 * 1000; // rotate bg image every 30 min

    let lastState = null;
    let lastGeneratedAt = null;

    // ─── DOM refs ──────────────────────────────────────────────────────

    const $ = (id) => document.getElementById(id);
    const $clock = $('clock');
    const $dateLabel = $('date-label');
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
    const $keystonesBar = $('keystones-bar');
    const $tomorrowBar = $('tomorrow-bar');
    const $syncDot = $('sync-dot');
    const $syncText = $('sync-text');

    // ─── Clock ─────────────────────────────────────────────────────────

    function updateClock() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h12 = hours % 12 || 12;
        $clock.textContent = `${h12}:${minutes} ${ampm}`;

        if (hours >= NIGHT_HOUR || hours < 5) {
            document.body.classList.add('night-mode');
        } else {
            document.body.classList.remove('night-mode');
        }
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

    function render(state) {
        $dateLabel.textContent = state.day_label || '';

        const allDone = state.meta && state.meta.all_done;
        const noSchedule = state.meta && state.meta.no_schedule;
        const isNight = new Date().getHours() >= NIGHT_HOUR || new Date().getHours() < 5;

        // Remove old overlay
        const oldOverlay = $currentBlock.querySelector('.night-overlay');
        if (oldOverlay) oldOverlay.remove();

        if (isNight || allDone) {
            renderNightOrComplete(state, allDone);
        } else if (noSchedule) {
            renderWaiting(state);
        } else {
            renderCurrentBlock(state);
        }

        renderSchedule(state.blocks || []);
        renderKeystones(state.keystones || []);
        renderTomorrow(state.tomorrow_focus);
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
        if (now.label && now.label !== now.block.toUpperCase()) {
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

    function renderNightOrComplete(state, allDone) {
        const tf = state.tomorrow_focus || {};

        setBlockColor(allDone ? '#2ecc71' : '#555');
        $currentBlock.className = allDone ? 'current-block day-complete' : 'current-block';

        $currentIcon.textContent = allDone ? '\u2714' : '\u263E';
        $currentIcon.style.display = '';
        $currentBlockName.textContent = allDone ? 'Day Complete' : '';
        $currentSublabel.style.display = 'none';
        $currentTask.textContent = '';
        $currentFile.textContent = '';
        $currentBadge.textContent = '';
        $currentBehind.textContent = '';
        $currentDetails.innerHTML = '';

        const divider = $currentBlock.querySelector('.current-block-divider');
        if (divider) divider.style.display = 'none';

        const overlay = document.createElement('div');
        overlay.className = 'night-overlay';

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

    function renderKeystones(keystones) {
        if (!keystones.length) {
            $keystonesBar.innerHTML = '';
            return;
        }

        let html = '<span class="ks-label">K:</span>';
        for (const ks of keystones) {
            const cls = ks.done ? 'ks-done' : 'ks-pending';
            const critical = ks.critical ? ' ks-critical' : '';
            const symbol = ks.done ? '\u25C6' : '\u25C7';
            html += `<span class="${cls}${critical}" title="${esc(ks.name)}">${symbol}</span>`;
        }
        $keystonesBar.innerHTML = html;
    }

    function renderTomorrow(tf) {
        if (!tf || !tf.task) {
            $tomorrowBar.innerHTML = '<span class="tm-label">Tomorrow:</span> Not planned yet';
            return;
        }
        let task = tf.task;
        if (task.length > 35) task = task.substring(0, 32) + '...';
        const action = tf.action ? `${tf.action}: ` : '';
        $tomorrowBar.innerHTML = `<span class="tm-label">Tomorrow:</span> ${esc(action)}${esc(task)}`;
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

    // ─── Helpers ───────────────────────────────────────────────────────

    function esc(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // ─── Background Image ────────────────────────────────────────────

    const $bgImage = $('bg-image');

    function loadBackgroundImage() {
        // loremflickr: free random images filtered by keyword, no API key
        const url = 'https://loremflickr.com/1080/1920/nature,forest,mountain,ocean?lock=' + Math.floor(Math.random() * 10000);
        const img = new Image();
        img.onload = function () {
            $bgImage.style.backgroundImage = 'url(' + img.src + ')';
            $bgImage.classList.add('loaded');
        };
        img.onerror = function () {
            // Fallback to picsum if loremflickr is down
            const fallback = 'https://picsum.photos/1080/1920?t=' + Date.now();
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

    // ─── Init ──────────────────────────────────────────────────────────

    updateClock();
    setInterval(updateClock, CLOCK_INTERVAL);
    fetchState();
    setInterval(fetchState, POLL_INTERVAL);
    loadBackgroundImage();
    setInterval(rotateBackgroundImage, BG_ROTATE_INTERVAL);

})();
