// FocusBoard - Hero block rendering (v3: TODAY.md-driven)
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var $currentBlock = FocusBoard.$('current-block');
    var $dateLabel = FocusBoard.$('date-label');

    // New hero elements
    var $heroPrimary = FocusBoard.$('hero-primary');
    var $heroIcon = FocusBoard.$('hero-icon');
    var $heroBlockName = FocusBoard.$('hero-block-name');
    var $heroTimeInfo = FocusBoard.$('hero-time-info');
    var $heroDetails = FocusBoard.$('hero-details');
    var $heroBehind = FocusBoard.$('hero-behind');
    var $heroPersonalEvent = FocusBoard.$('hero-personal-event');

    // Track previous state for transition detection
    var prevBlockName = '';
    var heroElements = [$heroPrimary, $heroPersonalEvent];

    function fadeHero(opacity) {
        for (var i = 0; i < heroElements.length; i++) {
            if (heroElements[i]) heroElements[i].style.opacity = opacity;
        }
    }

    function setBlockColor(color) {
        document.documentElement.style.setProperty('--block-color', color || '#3498db');
    }

    function formatDuration(minutes) {
        if (minutes <= 0) return '';
        var h = Math.floor(minutes / 60);
        var m = minutes % 60;
        if (h > 0 && m > 0) return h + 'h ' + m + 'm';
        if (h > 0) return h + 'h';
        return m + 'm';
    }

    function formatTimeRange12h(timeRange) {
        // Convert "6:00 - 7:05" to "6:00 AM - 7:05 AM"
        if (!timeRange || timeRange.indexOf(' - ') < 0) return timeRange || '';
        var parts = timeRange.split(' - ');
        return formatTime12h(parts[0]) + ' \u2013 ' + formatTime12h(parts[1]);
    }

    function formatTime12h(time) {
        var p = time.split(':');
        var h = parseInt(p[0], 10);
        var m = p[1] || '00';
        var ampm = h >= 12 ? 'PM' : 'AM';
        if (h === 0) h = 12;
        else if (h > 12) h -= 12;
        return h + ':' + m + ' ' + ampm;
    }

    // Live countdown: recompute remaining_min client-side every render (~30s)
    function getLiveRemaining(blocks) {
        var blockMinutes = FocusBoard.parseBlockMinutes(blocks);
        var currentMin = FocusBoard.getCurrentMinutes();
        var timePos = FocusBoard.findTimePosition(blockMinutes, currentMin);
        if (timePos >= 0 && timePos + 1 < blockMinutes.length) {
            return Math.max(0, blockMinutes[timePos + 1] - currentMin);
        }
        return 0;
    }

    function renderCurrentBlock(state) {
        var now = state.now || {};
        var blocks = state.blocks || [];
        var color = now.color || '#3498db';

        // Detect change for fade transition
        var currentName = now.block || '';
        var changed = prevBlockName && prevBlockName !== currentName;
        prevBlockName = currentName;

        if (changed) {
            fadeHero('0');
            setTimeout(function () {
                applyCurrentBlock(state, now, blocks, color);
                fadeHero('1');
            }, 500);
        } else {
            applyCurrentBlock(state, now, blocks, color);
        }
    }

    function applyCurrentBlock(state, now, blocks, color) {
        setBlockColor(color);
        $currentBlock.className = 'current-block';

        // Icon + block name
        var icon = now.icon || '';
        if ($heroIcon) $heroIcon.textContent = icon;
        if ($heroBlockName) $heroBlockName.textContent = now.block || '';

        // Time info with live countdown
        if ($heroTimeInfo) {
            var liveRemaining = getLiveRemaining(blocks);
            var parts = [];
            if (now.time_range) parts.push(formatTimeRange12h(now.time_range));
            if (now.duration_min > 0) parts.push(formatDuration(now.duration_min));
            if (liveRemaining > 0) {
                parts.push(formatDuration(liveRemaining) + ' left');
            }
            $heroTimeInfo.textContent = parts.join('  \u00B7  ');
        }

        // Details as compact list (max 4 items)
        if ($heroDetails) {
            var details = now.details || [];
            if (details.length > 0) {
                var html = '<ul>';
                var max = Math.min(details.length, 4);
                for (var i = 0; i < max; i++) {
                    html += '<li>' + esc(details[i]) + '</li>';
                }
                html += '</ul>';
                $heroDetails.innerHTML = html;
            } else {
                $heroDetails.innerHTML = '';
            }
        }

        // Behind schedule (unchecked blocks before time position)
        if ($heroBehind) {
            var blockMinutes = FocusBoard.parseBlockMinutes(blocks);
            var currentMin = FocusBoard.getCurrentMinutes();
            var timePos = FocusBoard.findTimePosition(blockMinutes, currentMin);
            var currentIdx = blocks.findIndex(function (b) { return b.is_current; });

            if (timePos > currentIdx && currentIdx >= 0) {
                var skipped = timePos - currentIdx;
                $heroBehind.textContent = '\u23F1 ' + skipped + ' block' + (skipped > 1 ? 's' : '') + ' behind schedule';
            } else {
                $heroBehind.textContent = '';
            }
        }

        // Personal calendar event (secondary line)
        if ($heroPersonalEvent) {
            var calEv = state.hero_calendar_event;
            if (calEv) {
                var evColor = calEv.calendar_color || '#3498db';
                var evIcon = calEv.icon || '\uD83D\uDCC5';
                $heroPersonalEvent.innerHTML =
                    '<span style="color:' + esc(evColor) + '">' + evIcon + '</span> ' +
                    esc(calEv.title || '') +
                    ' <span style="color:var(--text-muted);font-size:16px">' + esc(calEv.time_range || '') + '</span>';
            } else {
                $heroPersonalEvent.innerHTML = '';
            }
        }
    }

    function renderDayComplete(state) {
        var tf = state.tomorrow_focus || {};

        setBlockColor('#2ecc71');
        $currentBlock.className = 'current-block day-complete';

        if ($heroIcon) $heroIcon.textContent = '\u2714';
        if ($heroBlockName) $heroBlockName.textContent = 'Day Complete';
        if ($heroTimeInfo) $heroTimeInfo.textContent = '';
        if ($heroDetails) $heroDetails.innerHTML = '';
        if ($heroBehind) $heroBehind.textContent = '';
        if ($heroPersonalEvent) $heroPersonalEvent.innerHTML = '';

        // Remove old overlay
        var oldOverlay = $currentBlock.querySelector('.night-legacy-overlay');
        if (oldOverlay) oldOverlay.remove();

        var overlay = document.createElement('div');
        overlay.className = 'night-legacy-overlay';

        var dayQuote = FocusBoard.getDayCompleteQuote
            ? FocusBoard.getDayCompleteQuote(state.date)
            : null;
        var quoteText = (dayQuote && dayQuote.text) ? dayQuote.text : (state.quote || '');
        var quoteAuthor = (dayQuote && dayQuote.author) ? dayQuote.author : '';

        if (tf.task) {
            overlay.innerHTML =
                '<div class="night-tomorrow-label">Tomorrow</div>' +
                '<div class="night-tomorrow-task">' + esc(tf.task) + '</div>' +
                (tf.action ? '<div class="night-tomorrow-action">' + esc(tf.action) + '</div>' : '') +
                (tf.one_thing ? '<div class="night-quote">"' + esc(tf.one_thing) + '"</div>' : '');
        } else {
            overlay.innerHTML = '<div class="night-quote">\u201C' + esc(quoteText) + '\u201D</div>' +
                (quoteAuthor ? '<div class="night-quote" style="font-size:18px;margin-top:8px">\u2014 ' + esc(quoteAuthor) + '</div>' : '');
        }

        $currentBlock.appendChild(overlay);
    }

    function renderWaiting() {
        setBlockColor('#555');
        $currentBlock.className = 'current-block';
        if ($heroIcon) $heroIcon.textContent = '\u25CC';
        if ($heroBlockName) $heroBlockName.textContent = 'Waiting';
        if ($heroTimeInfo) $heroTimeInfo.textContent = '';
        if ($heroDetails) $heroDetails.innerHTML = '';
        if ($heroBehind) $heroBehind.textContent = '';
        if ($heroPersonalEvent) $heroPersonalEvent.innerHTML = '';
    }

    function render(state) {
        $dateLabel.textContent = FocusBoard.formatShortDate(state.date) || state.day_label || '';

        if (FocusBoard.isNightMode()) {
            FocusBoard.updateNightCountdown();
            return;
        }

        var allDone = state.meta && state.meta.all_done;
        var noSchedule = state.meta && state.meta.no_schedule;

        var oldOverlay = $currentBlock.querySelector('.night-legacy-overlay');
        if (oldOverlay) oldOverlay.remove();

        if (allDone) {
            renderDayComplete(state);
        } else if (noSchedule) {
            renderWaiting();
        } else {
            renderCurrentBlock(state);
        }

        FocusBoard.renderSchedule(state.blocks || [], state.habits || {});
        FocusBoard.renderCalendar(state.calendar || [], state.calendar_legend || [], state.calendar_now || []);
        FocusBoard.renderWeather(state.weather || {});
        FocusBoard.renderKeystones(state.keystones || []);
        FocusBoard.renderDoneToday(state.done_today || []);
        FocusBoard.renderQuoteBar(state.date);
        FocusBoard.renderRecordingReady(state.recording_ready || {});
        FocusBoard.renderBacklog(state.backlog_next || {});
        FocusBoard.renderTasks(state.tasks || {});
        FocusBoard.renderReminders(state.reminders || {});
        FocusBoard.renderDailyLog(state.daily_log || {});
        FocusBoard.renderHabits(state.habits || {});
        FocusBoard.renderPipeline(state.meta || {});
        FocusBoard.renderProgress(state.blocks || []);
    }

    FocusBoard.render = render;
})();
