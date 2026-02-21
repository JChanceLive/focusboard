// FocusBoard - Tasks summary widget
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var $tasks = FocusBoard.$('tasks-summary');

    function renderTasks(tasks) {
        if (!tasks || (!tasks.p1_count && !tasks.p2_count && !tasks.quick_wins)) {
            $tasks.style.display = 'none';
            return;
        }

        $tasks.style.display = '';
        var html = '<div class="section-title" style="margin-bottom:4px">TASKS</div>';
        html += '<div class="tasks-row">';

        if (tasks.p1_count) {
            html += '<span class="task-badge task-p1">P1:' + tasks.p1_count + '</span>';
        }
        if (tasks.p2_count) {
            html += '<span class="task-badge task-p2">P2:' + tasks.p2_count + '</span>';
        }
        if (tasks.quick_wins) {
            html += '<span class="task-badge task-qw">' + tasks.quick_wins + ' QW</span>';
        }

        html += '</div>';

        if (tasks.top_p1) {
            html += '<div class="task-top-p1">' + esc(tasks.top_p1) + '</div>';
        }

        $tasks.innerHTML = html;
    }

    FocusBoard.renderTasks = renderTasks;
})();
