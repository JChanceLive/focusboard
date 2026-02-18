// FocusBoard - Habits sidebar (right-aligned) and schedule dot matching
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var MAX_SIDEBAR_ITEMS = 8;

    // Map habit names (lowercase) to schedule block keywords for dot matching.
    // Each habit maps to block types/tasks it should match against.
    var HABIT_BLOCK_MAP = {
        // Morning Engagement
        'am skool': ['morning', 'skool'],
        'am twitter': ['morning', 'twitter'],
        'creation stack': ['creation'],
        // Production
        'record video': ['creation', 'record'],
        'livestream': ['creation', 'stream'],
        'write/script': ['creation', 'write', 'script'],
        // Development
        'pro-1: leadgen/jintent': ['dev', 'jintent', 'leadgen'],
        'pro-2: job hunt': ['dev', 'job'],
        'pro-3: pro bono/outreach': ['dev', 'outreach', 'pro bono'],
        'pro-4: communities': ['dev', 'communit'],
        // Execution
        'sys-1: video editing': ['exec', 'edit'],
        'sys-2: communities 2nd pass': ['exec', 'communit'],
        'sys-3: pipeline/process': ['exec', 'pipeline'],
        'pm skool': ['exec', 'skool'],
        'pm twitter': ['exec', 'twitter'],
        // Night Lab
        'lab-1: research block': ['research'],
        'lab-2: render queue': ['research', 'render'],
        'lab-3: tech sprints': ['research', 'tech', 'sprint'],
        'lab-5: prep tomorrow': ['research', 'prep'],
        'lab-4: pm reflection (tim)': ['research', 'reflect', 'tim']
    };

    function renderHabits(habits) {
        var sidebar = FocusBoard.$('habits-sidebar');
        var header = FocusBoard.$('habits-header');
        var incompleteEl = FocusBoard.$('habits-incomplete');

        if (!sidebar || !header || !incompleteEl) return;

        if (!habits || !habits.total) {
            sidebar.style.display = 'none';
            return;
        }

        sidebar.style.display = '';
        var pct = habits.completion_pct || 0;
        var barColor = pct >= 80 ? 'var(--done)' : pct >= 40 ? '#f39c12' : 'var(--text-muted)';

        // Header strip: count + bar + label
        header.innerHTML =
            '<span class="habits-hdr-count">' + habits.completed + '/' + habits.total + '</span>' +
            '<span class="habits-hdr-bar">' +
                '<span class="habits-hdr-fill" style="width:' + pct + '%;background:' + barColor + '"></span>' +
            '</span>' +
            '<span class="habits-hdr-label">HABITS</span>';

        // Collect incomplete habits
        var incomplete = [];
        var tiers = habits.tiers || [];
        for (var t = 0; t < tiers.length; t++) {
            var habs = tiers[t].habits;
            for (var h = 0; h < habs.length; h++) {
                if (!habs[h].done) {
                    incomplete.push(habs[h]);
                }
            }
        }

        // Render up to MAX items, with overflow counter
        var html = '';
        var show = Math.min(incomplete.length, MAX_SIDEBAR_ITEMS);
        for (var i = 0; i < show; i++) {
            var streakHtml = '';
            if (incomplete[i].streak && incomplete[i].streak > 0) {
                streakHtml = '<span class="habit-streak">\uD83D\uDD25' + incomplete[i].streak + '</span>';
            }
            html += '<div class="habit-row">' +
                '<span class="habit-circle"></span>' +
                esc(incomplete[i].name) +
                streakHtml +
                '</div>';
        }

        var remaining = incomplete.length - show;
        if (remaining > 0) {
            html += '<div class="habit-row" style="opacity:0.5;font-size:11px">+' + remaining + ' more</div>';
        }

        incompleteEl.innerHTML = html;
    }

    // Find habits that match a schedule block (for dot overlay)
    function findMatchingHabits(blockTask, blockType, habits) {
        if (!habits || !habits.tiers) return [];
        var matches = [];
        var taskLower = (blockTask || '').toLowerCase();
        var typeLower = (blockType || '').toLowerCase();

        var allHabits = [];
        for (var t = 0; t < habits.tiers.length; t++) {
            var habs = habits.tiers[t].habits;
            for (var h = 0; h < habs.length; h++) {
                allHabits.push(habs[h]);
            }
        }

        for (var i = 0; i < allHabits.length; i++) {
            var hab = allHabits[i];
            var nameLower = hab.name.toLowerCase();
            var blockTypes = HABIT_BLOCK_MAP[nameLower];
            if (blockTypes) {
                for (var b = 0; b < blockTypes.length; b++) {
                    var keyword = blockTypes[b];
                    if (typeLower.indexOf(keyword) !== -1 ||
                        taskLower.indexOf(keyword) !== -1 ||
                        taskLower.indexOf(nameLower) !== -1) {
                        matches.push(hab);
                        break;
                    }
                }
            }
        }
        return matches;
    }

    FocusBoard.renderHabits = renderHabits;
    FocusBoard.findMatchingHabits = findMatchingHabits;
})();
