/*global jQuery, Viewer*/

var UI = (function ($, Viewer) {
    "use strict";

    var reader = new FileReader();

    var rcsbURL = "https://www.rcsb.org/structure/";

    var $fileInput = $("#file-input");
    var $fileInfo = $("#file-info");
    var $atomInfo = $("#atom-info");
    var $loadButton = $("#load-molecule");
    var $pdbID = $("#pdb-id");
    var $loading = $("#loading");

    var updateFileInfo = function (protein) {
        $fileInfo.html(
            '<a href="' +
                rcsbURL +
                protein.pdbID +
                '" target="_blank">' +
                protein.pdbID +
                "</a>" +
                "<br>" +
                protein.title
        );
    };

    var updateAtomInfo = function (atom) {
        if (atom === undefined) {
            return;
        }

        $atomInfo.html(atom.atom + "<br>" + atom.resName + "<br>" + atom.chainID + "<br>" + atom.residue);
    };

    var showLoading = function () {
        $loading.show();
    };

    var hideLoading = function () {
        $loading.hide();
    };

    var handleFileSelect = function (event) {
        reader.onerror = function (e) {
            switch (e.target.error.code) {
                case event.target.error.NOT_FOUND_ERR:
                    alert("File Not Found!");
                    break;
                case e.target.error.NOT_READABLE_ERR:
                    alert("File is not readable");
                    break;
                case e.target.error.ABORT_ERR:
                    break;
                default:
                    alert("An error occurred reading this file.");
            }
        };

        reader.onabort = function () {
            alert("File read cancelled");
        };

        reader.onload = function (e) {
            showLoading();
            Viewer.loadFromFile(e.target.result);
            updateFileInfo(Viewer.getProtein());
            hideLoading();
        };

        reader.readAsText(event.target.files[0]);
    };

    var download = function () {
        var pdbId = $pdbID.val();

        if (!pdbId) {
            return;
        }

        showLoading();

        Viewer.download(pdbId)
            .done(function () {
                updateFileInfo(Viewer.getProtein());
            })
            .always(hideLoading);
    };

    var bindEventListeners = function () {
        var settings = {};

        $(".ui-control").on("change", function () {
            var $input = $(this);
            var type = $input.attr("type");
            var key = $input.data("storage-key");
            var value = $input.val();

            if (type === "checkbox") {
                value = $input.prop("checked");
            }

            settings[key] = value;
            window.localStorage.setItem(key, value);

            Viewer.updateRenderSettings(settings);
            Viewer.requestRedraw();
        });

        $fileInput.on("change", handleFileSelect);
        $loadButton.on("click", download);
    };

    var loadSettingsFromStorage = function () {
        var settings = {};

        $(".ui-control").each(function () {
            var $input = $(this);
            var type = $input.attr("type");
            var key = $input.data("storage-key");
            var storedValue = window.localStorage.getItem(key);

            if (storedValue) {
                $input.val(storedValue);
                settings[key] = storedValue;

                if (type === "checkbox") {
                    var checked = storedValue === "true";
                    $input.prop("checked", checked);
                    settings[key] = checked;
                }
            }
        });

        Viewer.updateRenderSettings(settings);
    };

    var init = function () {
        loadSettingsFromStorage();
        bindEventListeners();
    };

    return {
        init: init,
        download: download,
        updateFileInfo: updateFileInfo,
        updateAtomInfo: updateAtomInfo,
        showLoading: showLoading,
        hideLoading: hideLoading,
    };
})(jQuery, Viewer);
