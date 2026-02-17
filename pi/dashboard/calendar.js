// FocusBoard - Calendar panel rendering
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var $calendarList = FocusBoard.$('calendar-list');

    function formatEventTime(isoStr) {
        if (!isoStr) return '';
        try {
            var d = new Date(isoStr);
            var h = d.getHours();
            var m = d.getMinutes().toString().padStart(2, '0');
            var ampm = h >= 12 ? 'PM' : 'AM';
            var h12 = h % 12 || 12;
            return h12 + ':' + m + ' ' + ampm;
        } catch (e) {
            return isoStr;
        }
    }

    function renderCalendar(events) {
        $calendarList.innerHTML = '';

        if (!events || !events.length) {
            var empty = document.createElement('div');
            empty.className = 'cal-empty';
            empty.textContent = 'No upcoming events';
            $calendarList.appendChild(empty);
            return;
        }

        var today = new Date();
        var todayStr = today.toISOString().slice(0, 10);
        var tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        var tomorrowStr = tomorrow.toISOString().slice(0, 10);

        var currentGroup = '';

        for (var i = 0; i < events.length; i++) {
            var evt = events[i];
            var startStr = evt.start || '';
            var eventDate = startStr.slice(0, 10);

            var groupLabel = '';
            if (eventDate === todayStr) {
                groupLabel = 'TODAY';
            } else if (eventDate === tomorrowStr) {
                groupLabel = 'TOMORROW';
            } else {
                try {
                    var d = new Date(startStr);
                    groupLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                } catch (e) {
                    groupLabel = eventDate;
                }
            }

            if (groupLabel !== currentGroup) {
                var divider = document.createElement('div');
                divider.className = 'cal-day-divider';
                divider.textContent = groupLabel;
                $calendarList.appendChild(divider);
                currentGroup = groupLabel;
            }

            var card = document.createElement('div');
            card.className = 'cal-event' + (evt.all_day ? ' all-day' : '');

            var timeHtml = '';
            if (evt.all_day) {
                timeHtml = '<span class="cal-time">All day</span>';
            } else {
                var startTime = formatEventTime(evt.start);
                var endTime = formatEventTime(evt.end);
                timeHtml = '<span class="cal-time">' + startTime + ' \u2013 ' + endTime + '</span>';
            }

            var locationHtml = evt.location
                ? '<span class="cal-location">' + esc(evt.location) + '</span>'
                : '';

            card.innerHTML = timeHtml +
                '<span class="cal-title">' + esc(evt.title) + '</span>' +
                locationHtml;

            $calendarList.appendChild(card);
        }
    }

    FocusBoard.renderCalendar = renderCalendar;
})();
