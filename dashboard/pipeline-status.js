// FocusBoard - Pipeline status (top-left sidebar, opposite habits)
(function () {
    'use strict';

    var BRAND_COLORS = {
        cc: '#3498db',
        pioneers: '#e84393',
        ha: '#f39c12',
        zendo: '#00e676'
    };

    var BRAND_LABELS = {
        cc: 'CC',
        pioneers: 'P',
        ha: 'HA',
        zendo: 'Z'
    };

    function renderPipeline(pipeline) {
        var sidebar = FocusBoard.$('pipeline-sidebar');
        if (!sidebar) return;

        if (!pipeline || !pipeline.total_active) {
            sidebar.style.display = 'none';
            return;
        }

        sidebar.style.display = '';
        var html = '';

        // Total + rec ready
        html += '<span class="pipe-stat">' +
            '<span class="pipe-val" style="color:var(--text-primary)">' + pipeline.total_active + '</span> active' +
            '</span>';
        html += '<span class="pipe-stat">' +
            '<span class="pipe-val" style="color:var(--done)">' + pipeline.ready_to_record + '</span> rec ready' +
            '</span>';

        // Channel breakdown
        var brands = ['cc', 'pioneers', 'ha', 'zendo'];
        for (var i = 0; i < brands.length; i++) {
            var b = brands[i];
            var count = (pipeline.by_channel || {})[b] || 0;
            if (count > 0) {
                html += '<span class="pipe-brand" style="color:' + BRAND_COLORS[b] + '">' +
                    BRAND_LABELS[b] + ':' + count + '</span>';
            }
        }

        sidebar.innerHTML = html;
    }

    FocusBoard.renderPipeline = renderPipeline;
})();
