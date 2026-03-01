// FocusBoard - Hero block rendering
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var $currentBlock = FocusBoard.$('current-block');
    var $currentIcon = FocusBoard.$('current-icon');
    var $currentBlockName = FocusBoard.$('current-block-name');
    var $currentSublabel = FocusBoard.$('current-block-sublabel');
    var $currentBadge = FocusBoard.$('current-badge');
    var $currentBehind = FocusBoard.$('current-behind');
    var $dateLabel = FocusBoard.$('date-label');
    var $heroCard = FocusBoard.$('hero-card');
    var $heroFields = FocusBoard.$('hero-card-fields');
    var $heroDetails = FocusBoard.$('hero-card-details');

    // Track previous block for transition detection
    var prevBlockName = '';
    var heroElements = [$currentIcon, $currentBlockName, $currentSublabel, $heroCard, $currentBadge, $currentBehind];

    function fadeHero(opacity) {
        for (var i = 0; i < heroElements.length; i++) {
            if (heroElements[i]) heroElements[i].style.opacity = opacity;
        }
    }

    function setBlockColor(color) {
        document.documentElement.style.setProperty('--block-color', color || '#3498db');
    }

    function renderHeroCard(now) {
        if (!$heroFields) return;

        // Uses clear field names (do, from_ref, duration) with legacy fallbacks
        var html = '';

        var doText = now['do'] || now.file || '';
        var fromText = now.from_ref || now.task || '';
        var timeText = now.duration || now.source || '';

        if (doText && doText !== '--') {
            html += '<div class="hero-field">' +
                '<span class="hero-field-value">' + esc(doText) + '</span>' +
                '</div>';
        }

        if (fromText && fromText !== '(fixed)' && fromText !== '(protected)') {
            html += '<div class="hero-field">' +
                '<span class="hero-field-value small">' + esc(fromText) + '</span>' +
                '</div>';
        }

        if (timeText && timeText !== '--') {
            var timeDisplay = timeText;
            if (now.time_range) {
                timeDisplay = timeText + ' \u00B7 ' + now.time_range;
            }
            html += '<div class="hero-field">' +
                '<span class="hero-field-value time">' + esc(timeDisplay) + '</span>' +
                '</div>';
        }

        $heroFields.innerHTML = html;

        // Details (no label, just bullet list)
        var details = now.details || [];
        if (details.length > 0 && $heroDetails) {
            $heroDetails.style.display = '';
            var dhtml = '';
            for (var i = 0; i < details.length; i++) {
                dhtml += '<div class="detail-item">' + esc(details[i]) + '</div>';
            }
            $heroDetails.innerHTML = dhtml;
        } else if ($heroDetails) {
            $heroDetails.style.display = 'none';
        }

        if ($heroCard) $heroCard.style.display = '';
    }

    function renderCurrentBlock(state) {
        var now = state.now || {};
        var color = now.color || '#3498db';
        var blockChanged = prevBlockName && prevBlockName !== (now.block || '');
        prevBlockName = now.block || '';

        if (blockChanged) {
            fadeHero('0');
            setTimeout(function () {
                applyCurrentBlock(state, now, color);
                fadeHero('1');
            }, 500);
        } else {
            applyCurrentBlock(state, now, color);
        }
    }

    function applyCurrentBlock(state, now, color) {
        setBlockColor(color);
        $currentBlock.className = 'current-block';

        $currentIcon.textContent = now.icon || '';
        $currentIcon.style.display = now.icon ? '' : 'none';

        $currentBlockName.textContent = now.block || '';

        // Show active keystone as sublabel (replaces redundant label like "FOUNDATION")
        var activeKs = (state.keystones || []).find(function (k) { return k.active; });
        if (activeKs) {
            $currentSublabel.textContent = '\u25C6 ' + activeKs.id;
            $currentSublabel.style.display = '';
        } else {
            var labelUpper = (now.label || '').toUpperCase();
            var blockUpper = (now.block || '').toUpperCase();
            // Only show label if it's not redundant with block name
            if (now.label && blockUpper.indexOf(labelUpper) === -1 && labelUpper.indexOf(blockUpper) === -1) {
                $currentSublabel.textContent = now.label;
                $currentSublabel.style.display = '';
            } else {
                $currentSublabel.style.display = 'none';
            }
        }

        renderHeroCard(now);

        // Badge cleared - keystone name now shown in sublabel above
        $currentBadge.textContent = '';

        var blocks = state.blocks || [];
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
        $currentBlockName.textContent = 'Day Complete';
        $currentSublabel.style.display = 'none';
        $currentBadge.textContent = '';
        $currentBehind.textContent = '';
        if ($heroCard) $heroCard.style.display = 'none';

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
        $currentBlockName.textContent = 'Waiting';
        $currentSublabel.style.display = 'none';
        $currentBadge.textContent = '';
        $currentBehind.textContent = '';
        if ($heroCard) $heroCard.style.display = 'none';
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
        FocusBoard.renderPipeline(state.pipeline || {});
        FocusBoard.renderProgress(state.blocks || []);
    }

    FocusBoard.render = render;
})();
