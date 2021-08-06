/*global Viewer*/

let UI = (function (Viewer) {
    "use strict";

    let rcsbURL = "https://www.rcsb.org/structure/";

    let fileInfo;
    let atomInfo;
    let loadButton;
    let pdbID;
    let loading;
    let uiControls;

    let updateFileInfo = function (protein) {
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

    let updateAtomInfo = function (atom) {
        if (atom === undefined) {
            return;
        }

        atomInfo.innerHTML = atom.atom + "<br>" + atom.resName + "<br>" + atom.chainID + "<br>" + atom.residue;
    };

    let showLoading = function () {
        loading.style.display = "block";
    };

    let hideLoading = function () {
        loading.style.display = "none";
    };

    let download = function () {
        let pdbId = pdbID.value;

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

    let bindEventListeners = function () {
        let settings = {};

        uiControls.forEach(function (control) {
            control.addEventListener("change", function () {
                let key = control.dataset.storageKey;
                let value = control.value;

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

    let loadSettingsFromStorage = function () {
        let settings = {};

        uiControls.forEach(function (control) {
            let key = control.dataset.storageKey;
            let storedValue = window.localStorage.getItem(key);

            if (storedValue) {
                control.value = storedValue;
                settings[key] = storedValue;

                if (control.type === "checkbox") {
                    let checked = storedValue === "true";
                    control.checked = checked;
                    settings[key] = checked;
                }
            }
        });

        Viewer.updateRenderSettings(settings);
    };

    let init = function () {
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
