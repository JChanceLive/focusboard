// FocusBoard - Habits sidebar (right-aligned) and schedule dot matching
(function () {
    'use strict';

    var esc = FocusBoard.esc;

    // Smooth opacity gradient: full visibility for items 0-6, then fade out
    function calcFadeOpacity(index) {
        if (index <= 6) return 1.0;
        if (index === 7) return 0.75;
        if (index === 8) return 0.50;
        if (index === 9) return 0.25;
        return 0;
    }

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

        // Collect all habits: incomplete first, then completed
        var incomplete = [];
        var completed = [];
        var tiers = habits.tiers || [];
        for (var t = 0; t < tiers.length; t++) {
            var habs = tiers[t].habits;
            for (var h = 0; h < habs.length; h++) {
                if (habs[h].done) {
                    completed.push(habs[h]);
                } else {
                    incomplete.push(habs[h]);
                }
            }
        }

        var allItems = incomplete.concat(completed);

        // Render with opacity gradient
        var html = '';
        for (var i = 0; i < allItems.length; i++) {
            var opacity = calcFadeOpacity(i);
            if (opacity <= 0) break;

            var hab = allItems[i];
            var streakHtml = '';
            if (hab.streak && hab.streak > 0) {
                streakHtml = '<span class="habit-streak">\uD83D\uDD25' + hab.streak + '</span>';
            }

            if (hab.done) {
                html += '<div class="habit-row habit-done" style="opacity:' + opacity + '">' +
                    '<span class="habit-check">\u2714</span>' +
                    esc(hab.name) +
                    streakHtml +
                    '</div>';
            } else {
                html += '<div class="habit-row" style="opacity:' + opacity + '">' +
                    '<span class="habit-circle"></span>' +
                    esc(hab.name) +
                    streakHtml +
                    '</div>';
            }
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
