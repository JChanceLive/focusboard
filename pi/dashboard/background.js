// FocusBoard - Background image rotation
(function () {
    'use strict';

    var $bgImage = FocusBoard.$('bg-image');

    function loadBackgroundImage() {
        var url = 'https://picsum.photos/1080/1920?random=' + Math.floor(Math.random() * 10000);
        var img = new Image();
        img.onload = function () {
            $bgImage.style.backgroundImage = 'url(' + img.src + ')';
            $bgImage.classList.add('loaded');
        };
        img.onerror = function () {
            var fallback = 'https://loremflickr.com/1080/1920/nature,forest,mountain,ocean?lock=' + Math.floor(Math.random() * 10000);
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
