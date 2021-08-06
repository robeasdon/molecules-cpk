/*global Viewer*/

var UI = (function (Viewer) {
    "use strict";

    var rcsbURL = "https://www.rcsb.org/structure/";

    var fileInfo;
    var atomInfo;
    var loadButton;
    var pdbID;
    var loading;
    var uiControls;

    var updateFileInfo = function (protein) {
        fileInfo.innerHTML =
            '<a href="' +
            rcsbURL +
            protein.pdbID +
            '" target="_blank">' +
            protein.pdbID +
            "</a>" +
            "<br>" +
            protein.title;
    };

    var updateAtomInfo = function (atom) {
        if (atom === undefined) {
            return;
        }

        atomInfo.innerHTML = atom.atom + "<br>" + atom.resName + "<br>" + atom.chainID + "<br>" + atom.residue;
    };

    var showLoading = function () {
        loading.style.display = "block";
    };

    var hideLoading = function () {
        loading.style.display = "none";
    };

    var download = function () {
        var pdbId = pdbID.value;

        if (!pdbId) {
            return;
        }

        showLoading();

        Viewer.download(pdbId)
            .then(function () {
                updateFileInfo(Viewer.getProtein());
            })
            .then(hideLoading);
    };

    var bindEventListeners = function () {
        var settings = {};

        uiControls.forEach(function (control) {
            control.addEventListener("change", function () {
                var key = control.dataset.storageKey;
                var value = control.value;

                if (control.type === "checkbox") {
                    value = control.checked;
                }

                settings[key] = value;
                window.localStorage.setItem(key, value);

                Viewer.updateRenderSettings(settings);
                Viewer.requestRedraw();
            });
        });

        loadButton.addEventListener("click", download);
    };

    var loadSettingsFromStorage = function () {
        var settings = {};

        uiControls.forEach(function (control) {
            var key = control.dataset.storageKey;
            var storedValue = window.localStorage.getItem(key);

            if (storedValue) {
                control.value = storedValue;
                settings[key] = storedValue;

                if (control.type === "checkbox") {
                    var checked = storedValue === "true";
                    control.checked = checked;
                    settings[key] = checked;
                }
            }
        });

        Viewer.updateRenderSettings(settings);
    };

    var init = function () {
        fileInfo = document.querySelector("#file-info");
        atomInfo = document.querySelector("#atom-info");
        loadButton = document.querySelector("#load-molecule");
        pdbID = document.querySelector("#pdb-id");
        loading = document.querySelector("#loading");
        uiControls = document.querySelectorAll(".ui-control");

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
})(Viewer);
