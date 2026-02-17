// FocusBoard - Weather widget rendering
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var $heroWeather = FocusBoard.$('hero-weather');

    function renderWeather(weather) {
        if (!weather || !weather.temp) {
            $heroWeather.innerHTML = '';
            return;
        }

        var html = '<div class="weather-main">' +
            '<span class="weather-icon">' + (weather.icon_char || '\u2600') + '</span>' +
            '<span class="weather-temp">' + weather.temp + '\u00B0</span>' +
            '</div>';

        var details = [];
        if (weather.feels_like) details.push('Feels ' + weather.feels_like + '\u00B0');
        if (weather.high && weather.low) details.push('H:' + weather.high + '\u00B0 L:' + weather.low + '\u00B0');
        if (weather.humidity) details.push(weather.humidity + '% humidity');

        if (details.length) {
            html += '<div class="weather-details">';
            for (var i = 0; i < details.length; i++) {
                html += '<span>' + esc(details[i]) + '</span>';
            }
            html += '</div>';
        }

        if (weather.description) {
            html += '<div class="weather-desc">' + esc(weather.description) + '</div>';
        }

        $heroWeather.innerHTML = html;
    }

    FocusBoard.renderWeather = renderWeather;
})();
