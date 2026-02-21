// FocusBoard - Shared utilities
var FocusBoard = FocusBoard || {};

FocusBoard.esc = function (str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;')
              .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};

FocusBoard.formatTime = function (date) {
    var h = date.getHours();
    var m = date.getMinutes().toString().padStart(2, '0');
    var ampm = h >= 12 ? 'PM' : 'AM';
    return (h % 12 || 12) + ':' + m + ' ' + ampm;
};

FocusBoard.formatShortDate = function (isoDate) {
    var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (isoDate) {
        var parts = isoDate.split('-');
        var month = parseInt(parts[1], 10) - 1;
        var day = parseInt(parts[2], 10);
        return months[month] + ' ' + day;
    }
    var now = new Date();
    return months[now.getMonth()] + ' ' + now.getDate();
};

FocusBoard.$ = function (id) { return document.getElementById(id); };
