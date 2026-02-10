// FocusBoard Dashboard - app.js
// Polls state.json from disk, renders dashboard, handles offline/night mode

(function () {
    'use strict';

    const POLL_INTERVAL = 10000; // 10s - check for new state.json
    const CLOCK_INTERVAL = 1000; // 1s - update clock
    const OFFLINE_THRESHOLD = 5 * 60 * 1000; // 5 min - show offline banner
    const NIGHT_HOUR = 21; // 9 PM

    let lastState = null;
    let lastGeneratedAt = null;

    // ─── DOM refs ──────────────────────────────────────────────────────

    const $clock = document.getElementById('clock');
    const $dateLabel = document.getElementById('date-label');
    const $offlineBanner = document.getElementById('offline-banner');
    const $offlineTime = document.getElementById('offline-time');
    const $currentBlock = document.getElementById('current-block');
    const $currentBlockName = document.getElementById('current-block-name');
    const $currentTask = document.getElementById('current-task');
    const $currentFile = document.getElementById('current-file');
    const $currentBadge = document.getElementById('current-badge');
    const $scheduleList = document.getElementById('schedule-list');
    const $keystonesBar = document.getElementById('keystones-bar');
    const $tomorrowBar = document.getElementById('tomorrow-bar');
    const $syncDot = document.getElementById('sync-dot');
    const $syncText = document.getElementById('sync-text');

    // ─── Clock ─────────────────────────────────────────────────────────

    function updateClock() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const h12 = hours % 12 || 12;
        $clock.textContent = `${h12}:${minutes} ${ampm}`;

        // Night mode
        if (hours >= NIGHT_HOUR || hours < 5) {
            document.body.classList.add('night-mode');
        } else {
            document.body.classList.remove('night-mode');
        }
    }

    // ─── Fetch state ───────────────────────────────────────────────────

    async function fetchState() {
        try {
            // Cache-bust with timestamp
            const resp = await fetch('state.json?t=' + Date.now());
            if (!resp.ok) throw new Error('fetch failed');
            const state = await resp.json();

            lastState = state;
            lastGeneratedAt = new Date(state.generated_at);

            render(state);
            updateSyncStatus(true);
        } catch (e) {
            // state.json missing or corrupt - show offline if stale
            updateSyncStatus(false);
            if (lastState) {
                render(lastState);
            }
        }
    }

    // ─── Sync status ───────────────────────────────────────────────────

    function updateSyncStatus(fetchOk) {
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
            // Online
            $syncDot.className = 'sync-dot';
            $syncText.textContent = minutes < 1
                ? 'Synced just now'
                : `Synced ${minutes} min ago`;
            $offlineBanner.classList.add('hidden');
        } else {
            // Offline
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
        // Date label
        $dateLabel.textContent = state.day_label || '';

        const allDone = state.meta && state.meta.all_done;
        const noSchedule = state.meta && state.meta.no_schedule;
        const isNight = new Date().getHours() >= NIGHT_HOUR || new Date().getHours() < 5;

        // Current block hero
        if (isNight || allDone) {
            renderNightOrComplete(state, allDone);
        } else if (noSchedule) {
            renderWaiting(state);
        } else {
            renderCurrentBlock(state);
        }

        // Schedule
        renderSchedule(state.blocks || []);

        // Keystones
        renderKeystones(state.keystones || []);

        // Tomorrow
        renderTomorrow(state.tomorrow_focus);

        // Sync
        updateSyncStatus(true);
    }

    function renderCurrentBlock(state) {
        const now = state.now || {};
        const currentType = getBlockType(now.block, state.blocks);

        $currentBlock.className = `current-block type-${currentType}`;
        $currentBlockName.textContent = now.block || '—';
        $currentTask.textContent = now.task || '';

        // File + source
        if (now.file) {
            const source = now.source ? now.source : '';
            $currentFile.textContent = now.file + source;
        } else {
            $currentFile.textContent = '';
        }

        // Badge for required/keystone blocks
        const currentBlock = (state.blocks || []).find(b => b.is_current);
        if (currentBlock && currentBlock.required) {
            $currentBadge.textContent = '\u25C6 Keystone Trigger';
        } else {
            $currentBadge.textContent = '';
        }
    }

    function renderNightOrComplete(state, allDone) {
        const tf = state.tomorrow_focus || {};

        $currentBlock.className = 'current-block day-complete';

        if (allDone) {
            $currentBlockName.textContent = 'Day Complete';
        } else {
            $currentBlockName.textContent = '';
        }

        // Show tomorrow focus + quote in hero area
        const overlay = document.createElement('div');
        overlay.className = 'night-overlay';

        if (tf.task) {
            overlay.innerHTML = `
                <div class="night-tomorrow-label">Tomorrow</div>
                <div class="night-tomorrow-task">${escapeHtml(tf.task)}</div>
                ${tf.action ? `<div class="night-tomorrow-action">${escapeHtml(tf.action)}</div>` : ''}
                ${tf.one_thing ? `<div class="night-quote">"${escapeHtml(tf.one_thing)}"</div>` : ''}
            `;
        } else {
            overlay.innerHTML = `<div class="night-quote">"${escapeHtml(state.quote || '')}"</div>`;
        }

        // Clear and re-render
        $currentBlockName.textContent = allDone ? 'Day Complete' : '';
        $currentTask.textContent = '';
        $currentFile.textContent = '';
        $currentBadge.textContent = '';

        // Remove old overlay
        const old = $currentBlock.querySelector('.night-overlay');
        if (old) old.remove();

        // Clear the divider when showing overlay
        const divider = $currentBlock.querySelector('.current-block-divider');
        if (!allDone) {
            if (divider) divider.style.display = 'none';
        } else {
            if (divider) divider.style.display = '';
        }

        $currentBlock.appendChild(overlay);
    }

    function renderWaiting(state) {
        $currentBlock.className = 'current-block';
        $currentBlockName.textContent = 'Waiting';
        $currentTask.textContent = 'Schedule not generated yet';
        $currentFile.textContent = '';
        $currentBadge.textContent = '';

        // Remove overlay if present
        const old = $currentBlock.querySelector('.night-overlay');
        if (old) old.remove();
    }

    function renderSchedule(blocks) {
        $scheduleList.innerHTML = '';

        for (const b of blocks) {
            const div = document.createElement('div');

            let statusClass = 'pending';
            let icon = '\u2003'; // em space (blank)
            if (b.done) {
                statusClass = 'done';
                icon = '\u2705'; // green check
            } else if (b.is_current) {
                statusClass = 'current';
                icon = '\u25B6'; // play triangle
            }

            div.className = `schedule-item ${statusClass}`;

            const taskText = b.done
                ? `<s>${escapeHtml(b.task)}</s>`
                : escapeHtml(b.task);

            div.innerHTML = `
                <span class="s-icon">${icon}</span>
                <span class="s-time">${escapeHtml(b.time)}</span>
                <span class="s-block">${escapeHtml(b.block)}</span>
                <span class="s-task">${taskText}</span>
            `;

            $scheduleList.appendChild(div);
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
            const symbol = ks.done ? '\u25C6' : '\u25C7'; // filled/empty diamond
            html += `<span class="${cls}${critical}" title="${escapeHtml(ks.name)}">${symbol}</span>`;
        }

        $keystonesBar.innerHTML = html;
    }

    function renderTomorrow(tf) {
        if (!tf || !tf.task) {
            $tomorrowBar.innerHTML = '<span class="tm-label">Tomorrow:</span> Not planned yet';
            return;
        }

        // Truncate long task names
        let task = tf.task;
        if (task.length > 40) {
            task = task.substring(0, 37) + '...';
        }

        const action = tf.action ? `${tf.action}: ` : '';
        $tomorrowBar.innerHTML = `<span class="tm-label">Tomorrow:</span> ${escapeHtml(action)}${escapeHtml(task)}`;
    }

    // ─── Helpers ───────────────────────────────────────────────────────

    function getBlockType(blockName, blocks) {
        if (!blocks) return 'work';
        const block = blocks.find(b => b.block === blockName);
        return block ? block.type : 'work';
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ─── Init ──────────────────────────────────────────────────────────

    updateClock();
    setInterval(updateClock, CLOCK_INTERVAL);

    fetchState();
    setInterval(fetchState, POLL_INTERVAL);

})();
