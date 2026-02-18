// FocusBoard - Background image rotation
(function () {
    'use strict';

    var $bgImage = FocusBoard.$('bg-image');

    // Curated nature collection IDs from Unsplash
    // 3330448 = Nature, 1319040 = Landscapes, 3348849 = Mountains & Forests
    var NATURE_COLLECTIONS = '3330448,1319040,3348849';

    function loadBackgroundImage() {
        var url = 'https://source.unsplash.com/collection/' + NATURE_COLLECTIONS + '/1080x1920';
        var img = new Image();
        img.onload = function () {
            $bgImage.style.backgroundImage = 'url(' + img.src + ')';
            $bgImage.classList.add('loaded');
        };
        img.onerror = function () {
            // Fallback: Unsplash random nature query
            var fallback = 'https://source.unsplash.com/1080x1920/?nature,forest,mountain,ocean&sig=' + Math.floor(Math.random() * 10000);
            var fb = new Image();
            fb.onload = function () {
                $bgImage.style.backgroundImage = 'url(' + fb.src + ')';
                $bgImage.classList.add('loaded');
            };
            fb.src = fallback;
        };
        img.src = url;
    }

    function rotateBackgroundImage() {
        $bgImage.classList.remove('loaded');
        setTimeout(loadBackgroundImage, 2000);
    }

    FocusBoard.loadBackgroundImage = loadBackgroundImage;
    FocusBoard.rotateBackgroundImage = rotateBackgroundImage;
})();
