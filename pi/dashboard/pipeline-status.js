// FocusBoard - Pipeline status (compact footer, inside sync bar)
(function () {
    'use strict';

    function renderPipeline(meta) {
        var $el = FocusBoard.$('sync-pipeline');
        if (!$el) return;

        var active = meta.pipeline_active || 0;
        var rec = meta.pipeline_rec_ready || 0;

        if (!active) {
            $el.textContent = '';
            return;
        }

        $el.textContent = active + ' active \u00B7 ' + rec + ' rec';
    }

    FocusBoard.renderPipeline = renderPipeline;
})();
