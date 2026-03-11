// FocusBoard - Hero block rendering (v2: calendar-driven)
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var $currentBlock = FocusBoard.$('current-block');
    var $currentIcon = FocusBoard.$('current-icon');
    var $currentBehind = FocusBoard.$('current-behind');
    var $dateLabel = FocusBoard.$('date-label');
    var $heroCalStack = FocusBoard.$('hero-cal-stack');
    var $heroBlockChip = FocusBoard.$('hero-block-chip');

    // Track previous state for transition detection
    var prevCalTitle = '';
    var heroElements = [$currentIcon, $heroCalStack, $heroBlockChip, $currentBehind];

    function fadeHero(opacity) {
        for (var i = 0; i < heroElements.length; i++) {
            if (heroElements[i]) heroElements[i].style.opacity = opacity;
        }
    }

    function setBlockColor(color) {
        document.documentElement.style.setProperty('--block-color', color || '#3498db');
    }

    // Find block icon by time match (not sequence)
    function getTimeIcon(blocks) {
        if (!blocks || !blocks.length) return '';
        var blockMinutes = FocusBoard.parseBlockMinutes(blocks);
        var currentMin = FocusBoard.getCurrentMinutes();
        var timePos = FocusBoard.findTimePosition(blockMinutes, currentMin);
        if (timePos >= 0 && timePos < blocks.length) {
            return blocks[timePos].icon || '';
        }
        return '';
    }

    function renderCalendarStack(calNow) {
        if (!$heroCalStack) return;
        if (!calNow || !calNow.length) {
            $heroCalStack.innerHTML = '';
            return;
        }

        var html = '';
        for (var i = 0; i < calNow.length; i++) {
            var ev = calNow[i];
            var color = ev.calendar_color || '#3498db';
            var staleClass = ev.stale ? ' hero-cal-stale' : '';
            var upcomingClass = ev.upcoming ? ' hero-cal-upcoming' : '';

            html += '<div class="hero-cal-event' + staleClass + upcomingClass + '" style="border-left-color:' + esc(color) + '">';

            if (ev.upcoming) {
                var minText = ev.starts_in_min !== undefined ? ev.starts_in_min + ' min' : '';
                html += '<div class="hero-cal-chip">starts in ' + esc(minText) + '</div>';
            }

            html += '<div class="hero-cal-title" style="color:' + esc(color) + '">' + esc(ev.title || '') + '</div>';
            html += '<div class="hero-cal-time">' + esc(ev.time_range || '') + '</div>';

            // Show full_description in hero, fall back to description
            var desc = ev.full_description || ev.description || '';
            if (desc) {
                // Render newlines as line breaks
                var descLines = desc.split('\n');
                html += '<div class="hero-cal-desc">';
                for (var d = 0; d < descLines.length; d++) {
                    if (descLines[d].trim()) {
                        html += '<div>' + esc(descLines[d]) + '</div>';
                    }
                }
                html += '</div>';
            }

            html += '</div>';
        }

        $heroCalStack.innerHTML = html;
    }

    function renderBlockChip(state) {
        if (!$heroBlockChip) return;
        var now = state.now || {};
        if (!now.block || now.block === 'Day Complete' || !now.block.trim()) {
            $heroBlockChip.innerHTML = '';
            return;
        }

        var color = now.color || '#3498db';
        var chipIcon = now.icon || '';

        // Calculate behind-schedule count
        var blocks = state.blocks || [];
        var blockMinutes = FocusBoard.parseBlockMinutes(blocks);
        var currentMin = FocusBoard.getCurrentMinutes();
        var timePos = FocusBoard.findTimePosition(blockMinutes, currentMin);
        var currentIdx = blocks.findIndex(function (b) { return b.is_current; });
        var behind = (timePos > currentIdx && currentIdx >= 0) ? timePos - currentIdx : 0;

        var html = '<span class="chip-icon" style="color:' + esc(color) + '">' + chipIcon + '</span>';
        html += '<span class="chip-label">' + esc(now.block) + '</span>';
        if (behind > 0) {
            html += '<span class="chip-behind">' + behind + ' behind</span>';
        }

        $heroBlockChip.innerHTML = html;
    }

    function renderCurrentBlock(state) {
        var calNow = state.calendar_now || [];
        var now = state.now || {};
        var blocks = state.blocks || [];

        // Determine primary color: first calendar event color, or block color
        var color = (calNow.length && calNow[0].calendar_color) ? calNow[0].calendar_color : (now.color || '#3498db');

        // Detect change for fade transition
        var currentTitle = calNow.length ? calNow[0].title : (now.block || '');
        var changed = prevCalTitle && prevCalTitle !== currentTitle;
        prevCalTitle = currentTitle;

        if (changed) {
            fadeHero('0');
            setTimeout(function () {
                applyCurrentBlock(state, calNow, now, blocks, color);
                fadeHero('1');
            }, 500);
        } else {
            applyCurrentBlock(state, calNow, now, blocks, color);
        }
    }

    function applyCurrentBlock(state, calNow, now, blocks, color) {
        setBlockColor(color);
        $currentBlock.className = 'current-block';

        // Icon: block emoji matched by time
        var icon = getTimeIcon(blocks);
        if (icon) {
            $currentIcon.textContent = icon;
            $currentIcon.style.display = '';
        } else {
            $currentIcon.style.display = 'none';
        }

        // Calendar event stack
        renderCalendarStack(calNow);

        // Block mini chip
        renderBlockChip(state);

        // Behind schedule on hero
        var blockMinutes = FocusBoard.parseBlockMinutes(blocks);
        var currentMin = FocusBoard.getCurrentMinutes();
        var timePos = FocusBoard.findTimePosition(blockMinutes, currentMin);
        var currentIdx = blocks.findIndex(function (b) { return b.is_current; });

        if (timePos > currentIdx && currentIdx >= 0) {
            var skipped = timePos - currentIdx;
            $currentBehind.textContent = '\u23F1 ' + skipped + ' block' + (skipped > 1 ? 's' : '') + ' behind schedule';
        } else {
            $currentBehind.textContent = '';
        }
    }

    function renderDayComplete(state) {
        var tf = state.tomorrow_focus || {};

        setBlockColor('#2ecc71');
        $currentBlock.className = 'current-block day-complete';

        $currentIcon.textContent = '\u2714';
        $currentIcon.style.display = '';
        if ($heroCalStack) $heroCalStack.innerHTML = '';
        if ($heroBlockChip) $heroBlockChip.innerHTML = '';
        $currentBehind.textContent = '';

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
        $currentIcon.textContent = '\u25CC';
        $currentIcon.style.display = '';
        if ($heroCalStack) $heroCalStack.innerHTML = '';
        if ($heroBlockChip) $heroBlockChip.innerHTML = '';
        $currentBehind.textContent = '';
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
        FocusBoard.renderCalendar(state.calendar || [], state.calendar_legend || []);
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
