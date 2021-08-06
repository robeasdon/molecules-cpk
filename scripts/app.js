window.addEventListener("DOMContentLoaded", function () {
    let canvasSelector = "#canvas";
    let canvas = document.querySelector(canvasSelector);
    let computedStyle = getComputedStyle(canvas);
    let canvasWidth = computedStyle.width.replace("px", "");
    let canvasHeight = computedStyle.height.replace("px", "");
    UI.init();

    Viewer.init({
        width: canvasWidth,
        height: canvasHeight,
        canvasSelector: canvasSelector,
    })
        .then(
            function () {
                UI.showLoading();
                return Viewer.download("1CRN");
            },
            function () {
                return Promise.reject();
            }
        )
        .then(function () {
            UI.updateFileInfo(Viewer.getProtein());
            UI.hideLoading();

            window.addEventListener("resize", function () {
                canvasWidth = computedStyle.width.replace("px", "");
                canvasHeight = computedStyle.height.replace("px", "");
                Viewer.resize(canvasWidth, canvasHeight);
            });

            window.addEventListener("mousemove", function (event) {
                var atom = Viewer.picking(event.clientX, event.clientY);
                UI.updateAtomInfo(atom);
            });
        })
        .catch(function () {
            alert("Could not initialize molecule viewer.");
        });
});
