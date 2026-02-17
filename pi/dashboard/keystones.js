// FocusBoard - Keystone streaks rendering
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var $keystonesBar = FocusBoard.$('keystones-bar');

    function renderKeystones(keystones) {
        if (!keystones.length) {
            $keystonesBar.innerHTML = '';
            return;
        }

        var html = '<span class="ks-label">KEYSTONES</span>';
        for (var i = 0; i < keystones.length; i++) {
            var ks = keystones[i];
            var cls = ks.done ? 'ks-done' : 'ks-pending';
            var critical = ks.critical ? ' ks-critical' : '';
            var symbol = ks.done ? '\u25C6' : '\u25C7';
            var streak = ks.streak || 0;
            var streakLabel = streak > 0 ? streak + 'd' : '';

            html += '<span class="ks-item ' + cls + critical + '" title="' + esc(ks.name) + '">' +
                '<span class="ks-symbol">' + symbol + '</span>' +
                '<span class="ks-streak">' + streakLabel + '</span>' +
                '</span>';
        }
        $keystonesBar.innerHTML = html;
    }

    FocusBoard.renderKeystones = renderKeystones;
})();
