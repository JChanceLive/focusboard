// FocusBoard - Quote rotation from quotes.json
(function () {
    'use strict';

    var esc = FocusBoard.esc;
    var quotes = [];
    var loaded = false;

    function loadQuotes() {
        if (loaded) return;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'quotes.json?t=' + Math.floor(Date.now() / 86400000));
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    quotes = JSON.parse(xhr.responseText);
                    loaded = true;
                } catch (e) { /* ignore */ }
            }
        };
        xhr.send();
    }

    function getDailyQuote(dateStr) {
        if (quotes.length === 0) return null;

        // Hash date string to get stable daily index
        var hash = 0;
        var str = dateStr || new Date().toISOString().slice(0, 10);
        for (var i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        var idx = Math.abs(hash) % quotes.length;
        var q = quotes[idx];

        // Handle both string and {text, author} formats
        if (typeof q === 'string') {
            return { text: q, author: '' };
        }
        return { text: q.text || '', author: q.author || '' };
    }

    function renderQuoteBar(dateStr) {
        var el = FocusBoard.$('quote-bar');
        if (!el) return;

        var q = getDailyQuote(dateStr);
        if (!q || !q.text) {
            el.style.display = 'none';
            return;
        }

        el.style.display = '';
        var html = '<span class="qb-text">\u201C' + esc(q.text) + '\u201D</span>';
        if (q.author) {
            html += '<span class="qb-author">\u2014 ' + esc(q.author) + '</span>';
        }
        el.innerHTML = html;
    }

    function getDayCompleteQuote(dateStr) {
        return getDailyQuote(dateStr);
    }

    // Load on init
    loadQuotes();

    FocusBoard.renderQuoteBar = renderQuoteBar;
    FocusBoard.getDayCompleteQuote = getDayCompleteQuote;
})();
