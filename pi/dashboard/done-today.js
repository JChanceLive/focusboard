// FocusBoard - Done Today rendering
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var MAX_ITEMS = 5;

    function renderDoneToday(items) {
        var container = FocusBoard.$('done-today');
        if (!container) return;

        if (!items || items.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = '';

        // Show last N items
        var visible = items.slice(-MAX_ITEMS);
        var html = '<div class="section-title done-today-title">DONE TODAY' +
            '<span class="done-today-count">' + items.length + '</span></div>';

        for (var i = 0; i < visible.length; i++) {
            html += '<div class="done-today-item">' +
                '<span class="dt-check">\u2713</span>' +
                '<span class="dt-text">' + esc(visible[i]) + '</span>' +
                '</div>';
        }

        if (items.length > MAX_ITEMS) {
            html += '<div class="done-today-more">+' +
                (items.length - MAX_ITEMS) + ' more</div>';
        }

        container.innerHTML = html;
    }

    FocusBoard.renderDoneToday = renderDoneToday;
})();
