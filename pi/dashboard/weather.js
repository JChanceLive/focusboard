// FocusBoard - Weather widget (compact sidebar, top-left)
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var $weatherSidebar = FocusBoard.$('weather-sidebar');

    function renderWeather(weather) {
        if (!$weatherSidebar) return;

        if (!weather || !weather.temp) {
            $weatherSidebar.style.display = 'none';
            return;
        }

        $weatherSidebar.style.display = '';

        var html = '<div class="ws-main">' +
            '<span class="ws-icon">' + (weather.icon_char || '\u2600') + '</span>' +
            '<span class="ws-temp">' + weather.temp + '\u00B0</span>' +
            '</div>';

        var line2 = [];
        if (weather.feels_like) line2.push('Feels ' + weather.feels_like + '\u00B0');
        if (weather.high && weather.low) line2.push('H:' + weather.high + '\u00B0 L:' + weather.low + '\u00B0');

        if (line2.length) {
            html += '<div class="ws-details">' + esc(line2.join(' \u00B7 ')) + '</div>';
        }

        $weatherSidebar.innerHTML = html;
    }

    FocusBoard.renderWeather = renderWeather;
})();
