// FocusBoard - Daily LOG highlights widget
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var $dailyLog = FocusBoard.$('daily-log');

    function renderDailyLog(log) {
        if (!log || (!log.wins.length && !log.blockers.length)) {
            $dailyLog.style.display = 'none';
            return;
        }

        $dailyLog.style.display = '';
        var html = '';

        // Wins
        if (log.wins.length) {
            html += '<div class="log-section">';
            for (var i = 0; i < log.wins.length; i++) {
                html += '<div class="log-win">';
                html += '<span class="log-icon log-win-icon">\u2713</span>';
                html += '<span class="log-text">' + esc(log.wins[i]) + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        // Blockers
        if (log.blockers.length) {
            html += '<div class="log-section">';
            for (var j = 0; j < log.blockers.length; j++) {
                html += '<div class="log-blocker">';
                html += '<span class="log-icon log-blocker-icon">\u26A0</span>';
                html += '<span class="log-text">' + esc(log.blockers[j]) + '</span>';
                html += '</div>';
            }
            html += '</div>';
        }

        $dailyLog.innerHTML = html;
    }

    FocusBoard.renderDailyLog = renderDailyLog;
})();
