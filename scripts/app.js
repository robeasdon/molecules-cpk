window.addEventListener("DOMContentLoaded", function () {
    UI.init();
    let canvas = document.querySelector("#canvas");

    Viewer.init(canvas)
        .then(function () {
            UI.showLoading();
            return Viewer.download("1CRN");
        })
        .then(function () {
            UI.updateFileInfo(Viewer.getProtein());
            UI.hideLoading();

            window.addEventListener("mousemove", function (event) {
                let atom = Viewer.picking(event.clientX, event.clientY);
                UI.updateAtomInfo(atom);
            });
        })
        .catch(function () {
            alert("Could not initialize molecule viewer.");
        });
});
