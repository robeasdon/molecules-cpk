var GBuffer = (function () {
    "use strict";

    var gl;
    var exts;

    var depthTexture;
    var normalTexture;
    var positionTexture;
    var colorTexture;
    var framebuffer;

    var width;
    var height;

    var initBuffers = function () {
        depthTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, depthTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.DEPTH_COMPONENT,
            width,
            height,
            0,
            gl.DEPTH_COMPONENT,
            gl.UNSIGNED_SHORT,
            null
        );

        normalTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, normalTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);

        positionTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, positionTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);

        colorTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, colorTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);

        framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depthTexture, 0);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            exts.drawBuffers.COLOR_ATTACHMENT0_WEBGL,
            gl.TEXTURE_2D,
            normalTexture,
            0
        );
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            exts.drawBuffers.COLOR_ATTACHMENT1_WEBGL,
            gl.TEXTURE_2D,
            positionTexture,
            0
        );
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            exts.drawBuffers.COLOR_ATTACHMENT2_WEBGL,
            gl.TEXTURE_2D,
            colorTexture,
            0
        );

        var status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            alert("Invalid FBO status: " + status);
        }

        gl.bindTexture(gl.TEXTURE_2D, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    var bindGeometryPass = function () {
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

        exts.drawBuffers.drawBuffersWEBGL([
            exts.drawBuffers.COLOR_ATTACHMENT0_WEBGL,
            exts.drawBuffers.COLOR_ATTACHMENT1_WEBGL,
            exts.drawBuffers.COLOR_ATTACHMENT2_WEBGL,
        ]);
    };

    var unbindGeometryPass = function () {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };

    var resizeBuffers = function () {
        gl.bindTexture(gl.TEXTURE_2D, depthTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.DEPTH_COMPONENT,
            width,
            height,
            0,
            gl.DEPTH_COMPONENT,
            gl.UNSIGNED_SHORT,
            null
        );
        gl.bindTexture(gl.TEXTURE_2D, null);

        gl.bindTexture(gl.TEXTURE_2D, normalTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
        gl.bindTexture(gl.TEXTURE_2D, null);

        gl.bindTexture(gl.TEXTURE_2D, positionTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
        gl.bindTexture(gl.TEXTURE_2D, null);

        gl.bindTexture(gl.TEXTURE_2D, colorTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    };

    var resize = function (w, h) {
        width = w;
        height = h;

        resizeBuffers();
    };

    var getDepthTexture = function () {
        return depthTexture;
    };

    var getNormalTexture = function () {
        return normalTexture;
    };

    var getPositionTexture = function () {
        return positionTexture;
    };

    var getColorTexture = function () {
        return colorTexture;
    };

    var init = function (ctx, extensions, options) {
        gl = ctx;
        exts = extensions;
        width = options.width;
        height = options.height;

        initBuffers();
    };

    return {
        init: init,
        bindGeometryPass: bindGeometryPass,
        unbindGeometryPass: unbindGeometryPass,
        resize: resize,
        getDepthTexture: getDepthTexture,
        getNormalTexture: getNormalTexture,
        getPositionTexture: getPositionTexture,
        getColorTexture: getColorTexture,
    };
})();
