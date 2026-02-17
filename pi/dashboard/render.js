// FocusBoard - Hero block rendering
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var $currentBlock = FocusBoard.$('current-block');
    var $currentIcon = FocusBoard.$('current-icon');
    var $currentBlockName = FocusBoard.$('current-block-name');
    var $currentSublabel = FocusBoard.$('current-block-sublabel');
    var $currentTask = FocusBoard.$('current-task');
    var $currentFile = FocusBoard.$('current-file');
    var $currentBadge = FocusBoard.$('current-badge');
    var $currentBehind = FocusBoard.$('current-behind');
    var $currentDetails = FocusBoard.$('current-details');
    var $dateLabel = FocusBoard.$('date-label');

    function setBlockColor(color) {
        document.documentElement.style.setProperty('--block-color', color || '#3498db');
    }

    function renderCurrentBlock(state) {
        var now = state.now || {};
        var color = now.color || '#3498db';

        setBlockColor(color);
        $currentBlock.className = 'current-block';

        $currentIcon.textContent = now.icon || '';
        $currentIcon.style.display = now.icon ? '' : 'none';

        $currentBlockName.textContent = now.block || '';

        var labelUpper = (now.label || '').toUpperCase();
        var taskUpper = (now.task || '').toUpperCase();
        var blockUpper = (now.block || '').toUpperCase();
        if (now.label && labelUpper !== blockUpper && labelUpper !== taskUpper) {
            $currentSublabel.textContent = now.label;
            $currentSublabel.style.display = '';
        } else {
            $currentSublabel.style.display = 'none';
        }

        $currentTask.textContent = now.task || '';

        if (now.file) {
            $currentFile.textContent = now.file + (now.source || '');
        } else {
            $currentFile.textContent = '';
        }

        var currentBlockData = (state.blocks || []).find(function (b) { return b.is_current; });
        if (currentBlockData && currentBlockData.required) {
            $currentBadge.textContent = '\u25C6 Keystone Trigger';
        } else {
            $currentBadge.textContent = '';
        }

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

        var details = now.details || [];
        $currentDetails.innerHTML = '';
        for (var i = 0; i < details.length; i++) {
            var div = document.createElement('div');
            div.className = 'detail-item';
            div.textContent = details[i];
            $currentDetails.appendChild(div);
        }

        var divider = $currentBlock.querySelector('.current-block-divider');
        if (divider) divider.style.display = '';
    }

    function renderDayComplete(state) {
        var tf = state.tomorrow_focus || {};

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

        var divider = $currentBlock.querySelector('.current-block-divider');
        if (divider) divider.style.display = 'none';

        var overlay = document.createElement('div');
        overlay.className = 'night-legacy-overlay';

        // Use daily quote from quotes.json if available, fall back to state.quote
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
        $currentTask.textContent = 'Schedule not generated yet';
        $currentFile.textContent = '';
        $currentBadge.textContent = '';
        $currentBehind.textContent = '';
        $currentDetails.innerHTML = '';
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

        FocusBoard.renderSchedule(state.blocks || []);
        FocusBoard.renderCalendar(state.calendar || [], state.calendar_legend || []);
        FocusBoard.renderWeather(state.weather || {});
        FocusBoard.renderKeystones(state.keystones || []);
        FocusBoard.renderDoneToday(state.done_today || []);
        FocusBoard.renderQuoteBar(state.date);
        FocusBoard.renderRecordingReady(state.recording_ready || {});
        FocusBoard.renderBacklog(state.backlog_next || {});
    }

    FocusBoard.render = render;
})();
