// FocusBoard - Schedule rendering and time helpers
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var $scheduleList = FocusBoard.$('schedule-list');

    // ─── Time Helpers (Hybrid Mode) ─────────────────────────────────

    function parseBlockMinutes(blocks) {
        var result = [];
        var prev = 0;
        for (var i = 0; i < blocks.length; i++) {
            var parts = blocks[i].time.split(':');
            var h = parseInt(parts[0], 10);
            var m = parseInt(parts[1], 10);
            var total = h * 60 + m;
            if (total < prev && h < 12) {
                total += 12 * 60;
            }
            prev = total;
            result.push(total);
        }
        return result;
    }

    function getCurrentMinutes() {
        var now = new Date();
        return now.getHours() * 60 + now.getMinutes();
    }

    function findTimePosition(blockMinutes, currentMin) {
        var pos = -1;
        for (var i = 0; i < blockMinutes.length; i++) {
            if (currentMin >= blockMinutes[i]) pos = i;
        }
        return pos;
    }

    // Cached habits data (set by render pass)
    var _habitsData = null;

    function renderSchedule(blocks, habits) {
        if (habits !== undefined) _habitsData = habits;
        $scheduleList.innerHTML = '';

        var blockMinutes = parseBlockMinutes(blocks);
        var currentMin = getCurrentMinutes();
        var timePos = findTimePosition(blockMinutes, currentMin);
        var currentIdx = blocks.findIndex(function (b) { return b.is_current; });
        var markerInserted = false;

        for (var i = 0; i < blocks.length; i++) {
            var b = blocks[i];

            if (!markerInserted && timePos >= 0 && i === timePos + 1 && timePos !== currentIdx) {
                var marker = document.createElement('div');
                marker.className = 'schedule-now-marker';
                marker.innerHTML = '<span class="now-label">NOW</span><span class="now-line"></span>';
                $scheduleList.appendChild(marker);
                markerInserted = true;
            }

            var div = document.createElement('div');
            var color = b.color || '#888';

            var statusClass = 'pending';
            var icon = '';
            if (b.done) {
                statusClass = 'done';
                icon = '\u2713';
            } else if (b.is_current) {
                statusClass = 'current';
                icon = '\u25B6';
            } else if (!b.done && currentIdx >= 0 && i < currentIdx) {
                statusClass = 'skipped';
                icon = '\u25CB';
            } else if (!b.done && timePos >= 0 && i < timePos && i > currentIdx) {
                statusClass = 'skipped';
                icon = '\u25CB';
            }

            div.className = 'schedule-item ' + statusClass;

            var taskText = b.done
                ? '<s>' + esc(b.task) + '</s>'
                : esc(b.task);

            var detailsHtml = '';
            if (b.details && b.details.length && b.type !== 'health' && (b.is_current || !b.done)) {
                detailsHtml = '<div class="s-details">';
                for (var d = 0; d < b.details.length; d++) {
                    detailsHtml += '<span class="s-detail">' + esc(b.details[d]) + '</span>';
                }
                detailsHtml += '</div>';
            }

            // Build habit dots HTML
            var habitDotsHtml = '';
            if (_habitsData && FocusBoard.findMatchingHabits) {
                var matched = FocusBoard.findMatchingHabits(b.task, b.type || b.block, _habitsData);
                for (var m = 0; m < matched.length; m++) {
                    var dotCls = matched[m].done ? 's-habit-dot done' : 's-habit-dot';
                    habitDotsHtml += '<span class="' + dotCls + '" title="' + esc(matched[m].name) + '"></span>';
                }
            }

            div.innerHTML =
                '<span class="s-dot" style="background:' + (b.done ? '#555' : color) + '"></span>' +
                '<span class="s-icon">' + icon + '</span>' +
                '<span class="s-time">' + esc(b.time) + '</span>' +
                '<span class="s-block" style="' + (b.is_current ? 'color:' + color : '') + '">' + esc(b.block) + '</span>' +
                habitDotsHtml +
                '<span class="s-task">' + taskText + '</span>' +
                detailsHtml;

            $scheduleList.appendChild(div);
        }

        if (!markerInserted && timePos >= blocks.length - 1 && timePos !== currentIdx) {
            var endMarker = document.createElement('div');
            endMarker.className = 'schedule-now-marker';
            endMarker.innerHTML = '<span class="now-label">NOW</span><span class="now-line"></span>';
            $scheduleList.appendChild(endMarker);
        }

        // Auto-scroll to current block
        var currentEl = $scheduleList.querySelector('.schedule-item.current');
        if (currentEl) {
            var container = $scheduleList.parentElement;
            var elTop = currentEl.offsetTop - container.offsetTop;
            var elBottom = elTop + currentEl.offsetHeight;
            var viewTop = container.scrollTop;
            var viewBottom = viewTop + container.clientHeight;

            if (elTop < viewTop || elBottom > viewBottom) {
                currentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    // Expose time helpers (used by render.js for behind-schedule calc)
    FocusBoard.parseBlockMinutes = parseBlockMinutes;
    FocusBoard.getCurrentMinutes = getCurrentMinutes;
    FocusBoard.findTimePosition = findTimePosition;
    FocusBoard.renderSchedule = renderSchedule;
})();
