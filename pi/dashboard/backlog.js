// FocusBoard - BACKLOG Quick-Pull widget
(function () {
    'use strict';

    var esc = FocusBoard.esc;

    function renderBacklog(data) {
        var container = FocusBoard.$('backlog-next');
        if (!container) return;

        if (!data || !data.task) {
            container.style.display = 'none';
            return;
        }

        container.style.display = '';
        var html = '<span class="bl-label">NEXT UP</span>' +
            '<span class="bl-priority">' + esc(data.priority) + '</span>' +
            '<span class="bl-task">' + esc(data.task) + '</span>';

        if (data.time) {
            html += '<span class="bl-time">' + esc(data.time) + '</span>';
        }

        container.innerHTML = html;
    }

    FocusBoard.renderBacklog = renderBacklog;
})();
