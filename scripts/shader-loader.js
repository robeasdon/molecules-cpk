var ShaderLoader = (function () {
    "use strict";

    var gl;
    var shaders = {};

    var createShader = function (str, type) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, str);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw gl.getShaderInfoLog(shader);
        }

        return shader;
    };

    var createProgram = function (vstr, fstr) {
        var program = gl.createProgram();
        var vshader = createShader(vstr, gl.VERTEX_SHADER);
        var fshader = createShader(fstr, gl.FRAGMENT_SHADER);
        gl.attachShader(program, vshader);
        gl.attachShader(program, fshader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw gl.getProgramInfoLog(program);
        }

        return program;
    };

    var loadShaderFromFile = function (url) {
        return fetch(url).then(function (response) {
            return response.text();
        });
    };

    var loadProgram = function (name, vert, frag, initShader) {
        return Promise.all([loadShaderFromFile(vert), loadShaderFromFile(frag)]).then(function ([vshader, fshader]) {
            var program = createProgram(vshader, fshader);
            initShader(program);
            shaders[name] = program;
        });
    };

    var getShader = function (name) {
        return shaders[name];
    };

    var init = function (ctx) {
        gl = ctx;
    };

    return {
        loadProgram: loadProgram,
        getShader: getShader,
        init: init,
    };
})();
