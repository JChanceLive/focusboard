// FocusBoard - Background image rotation (nature only)
(function () {
    'use strict';

    var $bgImage = FocusBoard.$('bg-image');

    // Curated picsum.photos IDs: landscapes, forests, mountains, oceans, skies
    var NATURE_IDS = [
        10, 11, 15, 16, 28, 29, 37, 41, 47, 54, 56, 58, 73, 82, 100,
        104, 106, 110, 119, 129, 134, 142, 146, 155, 167, 173, 181, 192,
        193, 200, 210, 219, 235, 240, 243, 248, 250, 256, 259, 261, 264,
        267, 274, 280, 284, 292, 300, 306, 314, 318, 325, 327, 329, 334,
        340, 343, 353, 358, 360, 365, 371, 376, 385, 391, 392, 395, 396,
        399, 401, 403, 411, 413, 416, 417, 418, 421, 425, 426, 429, 433,
        440, 441, 449, 451, 456, 464, 468, 469, 471, 476, 484, 493, 501,
        504, 506, 509, 514, 516, 518, 519, 520, 527, 533, 535, 540, 545,
        551, 553, 555, 556, 559, 564, 571, 573, 576, 580, 585, 590, 593,
        598, 606, 610, 614, 615, 621, 624, 626, 627, 628, 632, 633, 639,
        640, 646, 651, 653, 658, 667, 670, 671, 672, 674, 682, 683, 685,
        690, 691, 695, 700, 707, 712, 716, 718, 723, 730, 733, 737, 738,
        740, 743, 751, 753, 756, 758, 767, 769, 775, 782, 790, 795, 807,
        813, 815, 820, 823, 826, 828, 831, 835, 836, 842, 851, 855, 860,
        865, 866, 872, 876, 883, 890, 893, 897, 903, 909, 910, 914, 916,
        919, 921, 924, 927, 935, 940, 943, 950, 955, 959, 963, 967, 970,
        973, 975, 979, 984, 989, 993, 996, 1000, 1002, 1004, 1009, 1011,
        1012, 1013, 1015, 1018, 1019, 1020, 1021, 1022, 1025, 1029, 1032,
        1035, 1036, 1039, 1041, 1043, 1044, 1045, 1047, 1049, 1051, 1052,
        1053, 1055, 1056, 1057, 1058, 1059, 1060, 1061, 1063, 1064, 1067,
        1069, 1073, 1076, 1078, 1080, 1082, 1083, 1085, 1088
    ];

    function pickNatureId() {
        return NATURE_IDS[Math.floor(Math.random() * NATURE_IDS.length)];
    }

    function loadBackgroundImage() {
        var id = pickNatureId();
        var url = 'https://picsum.photos/id/' + id + '/1080/1920';
        var img = new Image();
        img.onload = function () {
            $bgImage.style.backgroundImage = 'url(' + img.src + ')';
            $bgImage.classList.add('loaded');
        };
        img.onerror = function () {
            // Fallback: try another random nature ID
            var fallbackId = pickNatureId();
            var fb = new Image();
            fb.onload = function () {
                $bgImage.style.backgroundImage = 'url(' + fb.src + ')';
                $bgImage.classList.add('loaded');
            };
            fb.src = 'https://picsum.photos/id/' + fallbackId + '/1080/1920';
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
