// FocusBoard - Life counters
(function () {
    'use strict';

    var LIFE_DATES = {
        alive: new Date(1987, 5, 3),
        allIn: new Date(2025, 5, 29),
        baby: new Date(2026, 0, 18),
        launch: null
    };

    var $counterAlive = FocusBoard.$('counter-alive');
    var $counterAllIn = FocusBoard.$('counter-allin');
    var $counterBaby = FocusBoard.$('counter-baby');
    var $counterLaunch = FocusBoard.$('counter-launch');
    var $counterLaunchItem = FocusBoard.$('counter-launch-item');
    var $counterLaunchSep = FocusBoard.$('counter-launch-sep');

    function daysSince(startDate) {
        var now = new Date();
        now.setHours(0, 0, 0, 0);
        var start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        return Math.floor((now - start) / 86400000);
    }

    function formatNumber(n) {
        return n.toLocaleString('en-US');
    }

    function updateLifeCounters() {
        $counterAlive.textContent = formatNumber(daysSince(LIFE_DATES.alive));
        $counterAllIn.textContent = formatNumber(daysSince(LIFE_DATES.allIn));
        $counterBaby.textContent = formatNumber(daysSince(LIFE_DATES.baby));

        if (LIFE_DATES.launch) {
            $counterLaunch.textContent = formatNumber(daysSince(LIFE_DATES.launch));
            $counterLaunchItem.style.display = '';
            $counterLaunchSep.style.display = '';
        }
    }

    FocusBoard.updateLifeCounters = updateLifeCounters;
})();
