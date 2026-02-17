// FocusBoard - Apple Reminders widget
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var $reminders = FocusBoard.$('reminders');

    function renderReminders(reminders) {
        if (!reminders || !reminders.count) {
            $reminders.style.display = 'none';
            return;
        }

        $reminders.style.display = '';
        var html = '<div class="section-title" style="margin-bottom:4px">REMINDERS <span class="rem-count">' + reminders.count + '</span></div>';

        var items = reminders.items || [];
        for (var i = 0; i < items.length && i < 5; i++) {
            var item = items[i];
            html += '<div class="rem-item">';
            html += '<span class="rem-dot">\u25CB</span>';
            html += '<span class="rem-title">' + esc(item.title) + '</span>';
            if (item.due) {
                html += '<span class="rem-due">' + esc(item.due) + '</span>';
            }
            html += '</div>';
        }

        if (items.length > 5) {
            html += '<div class="rem-more">+' + (items.length - 5) + ' more</div>';
        }

        $reminders.innerHTML = html;
    }

    FocusBoard.renderReminders = renderReminders;
})();
