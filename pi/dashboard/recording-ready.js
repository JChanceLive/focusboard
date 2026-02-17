// FocusBoard - Recording Ready counts
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

    function renderRecordingReady(data) {
        var container = FocusBoard.$('recording-ready');
        if (!container) return;

        if (!data || data.total === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = '';
        var html = '<span class="rr-label">REC READY</span>';
        var brands = ['cc', 'pioneers', 'ha', 'zendo'];

        for (var i = 0; i < brands.length; i++) {
            var b = brands[i];
            var count = data[b] || 0;
            if (count > 0) {
                html += '<span class="rr-brand" style="color:' + BRAND_COLORS[b] + '">' +
                    BRAND_LABELS[b] + ':' + count + '</span>';
            }
        }

        html += '<span class="rr-total">(' + data.total + ')</span>';
        container.innerHTML = html;
    }

    FocusBoard.renderRecordingReady = renderRecordingReady;
})();
