// FocusBoard - Day completion progress bar
(function () {
    'use strict';

    var $fill = FocusBoard.$('progress-fill');

    function renderProgress(blocks) {
        if (!blocks || !blocks.length) {
            $fill.style.width = '0%';
            return;
        }

        var done = 0;
        for (var i = 0; i < blocks.length; i++) {
            if (blocks[i].done) done++;
        }

        var pct = Math.round((done / blocks.length) * 100);
        $fill.style.width = pct + '%';
    }

    FocusBoard.renderProgress = renderProgress;
})();
