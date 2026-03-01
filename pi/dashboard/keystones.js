// FocusBoard - Keystone named pill rendering
(function () {
    'use strict';

    var $keystonesBar = FocusBoard.$('keystones-bar');

    function renderKeystones(keystones) {
        if (!keystones.length) {
            $keystonesBar.innerHTML = '';
            return;
        }

        var html = '';
        for (var i = 0; i < keystones.length; i++) {
            var ks = keystones[i];
            // State priority: done > active > pending
            var cls = ks.done ? 'ks-done' : (ks.active ? 'ks-active' : 'ks-pending');
            var streak = ks.streak || 0;
            var streakLabel = streak > 0 ? streak + 'd' : '';

            html += '<span class="ks-pill ' + cls + '">' +
                '<span class="ks-name">' + ks.id + '</span>' +
                (streakLabel ? '<span class="ks-streak">' + streakLabel + '</span>' : '') +
                '</span>';
        }
        $keystonesBar.innerHTML = html;
    }

    FocusBoard.renderKeystones = renderKeystones;
})();
