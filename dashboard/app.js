// FocusBoard Dashboard V2 - app.js
// Init, polling, state management. Modules loaded via separate scripts.

(function () {
    'use strict';

    var POLL_INTERVAL = 10000;
    var CLOCK_INTERVAL = 1000;
    var BG_ROTATE_INTERVAL = 5 * 60 * 1000;

    var OFFLINE_THRESHOLD = 5 * 60 * 1000;
    var lastGeneratedAt = null;

    var $syncDot = FocusBoard.$('sync-dot');
    var $syncText = FocusBoard.$('sync-text');
    var $offlineBanner = FocusBoard.$('offline-banner');
    var $offlineTime = FocusBoard.$('offline-time');

    // Shared state accessible by other modules
    FocusBoard.lastState = null;
    FocusBoard.override = { mode: 'auto' };

    // ─── Fetch override ──────────────────────────────────────────────

    function fetchOverride() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'override.json?t=' + Date.now());
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    FocusBoard.override = JSON.parse(xhr.responseText);
                } catch (e) {
                    FocusBoard.override = { mode: 'auto' };
                }
            }
        };
        xhr.onerror = function () {
            FocusBoard.override = { mode: 'auto' };
        };
        xhr.send();
    }

    // ─── Fetch state ───────────────────────────────────────────────────

    function fetchState() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'state.json?t=' + Date.now());
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    var state = JSON.parse(xhr.responseText);
                    FocusBoard.lastState = state;
                    lastGeneratedAt = new Date(state.generated_at);
                    FocusBoard.render(state);
                    updateSyncStatus();
                } catch (e) {
                    updateSyncStatus();
                }
            } else {
                updateSyncStatus();
                if (FocusBoard.lastState) FocusBoard.render(FocusBoard.lastState);
            }
        };
        xhr.onerror = function () {
            updateSyncStatus();
            if (FocusBoard.lastState) FocusBoard.render(FocusBoard.lastState);
        };
        xhr.send();
    }

    // ─── Sync status ───────────────────────────────────────────────────

    function updateSyncStatus() {
        var now = new Date();

        if (!lastGeneratedAt) {
            $syncDot.className = 'sync-dot offline';
            $syncText.textContent = 'Waiting for first sync...';
            $offlineBanner.classList.add('hidden');
            return;
        }

        var age = now - lastGeneratedAt;
        var minutes = Math.floor(age / 60000);

        if (age < OFFLINE_THRESHOLD) {
            $syncDot.className = 'sync-dot';
            $syncText.textContent = minutes < 1
                ? 'Synced just now'
                : 'Synced ' + minutes + ' min ago';
            $offlineBanner.classList.add('hidden');
        } else {
            $syncDot.className = 'sync-dot offline';
            $syncText.textContent = 'Last sync ' + minutes + ' min ago';
            $offlineBanner.classList.remove('hidden');
            $offlineTime.textContent = FocusBoard.formatTime(lastGeneratedAt);
        }
    }

    // ─── Init ──────────────────────────────────────────────────────────

    FocusBoard.updateClock();
    setInterval(FocusBoard.updateClock, CLOCK_INTERVAL);

    FocusBoard.updateLifeCounters();
    setInterval(FocusBoard.updateLifeCounters, POLL_INTERVAL);

    fetchOverride();
    fetchState();
    setInterval(function () { fetchOverride(); fetchState(); }, POLL_INTERVAL);

    FocusBoard.loadBackgroundImage();
    setInterval(FocusBoard.rotateBackgroundImage, BG_ROTATE_INTERVAL);
})();
