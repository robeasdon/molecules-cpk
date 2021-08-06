let ShaderLoader = (function () {
    "use strict";

    let gl;
    let shaders = {};

    let createShader = function (str, type) {
        let shader = gl.createShader(type);
        gl.shaderSource(shader, str);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw gl.getShaderInfoLog(shader);
        }

        return shader;
    };

    let createProgram = function (vstr, fstr) {
        let program = gl.createProgram();
        let vshader = createShader(vstr, gl.VERTEX_SHADER);
        let fshader = createShader(fstr, gl.FRAGMENT_SHADER);
        gl.attachShader(program, vshader);
        gl.attachShader(program, fshader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw gl.getProgramInfoLog(program);
        }

        return program;
    };

    let loadShaderFromFile = function (url) {
        return fetch(url).then(function (response) {
            return response.text();
        });
    };

    let loadProgram = function (name, vert, frag, initShader) {
        return Promise.all([loadShaderFromFile(vert), loadShaderFromFile(frag)]).then(function ([vshader, fshader]) {
            let program = createProgram(vshader, fshader);
            initShader(program);
            shaders[name] = program;
        });
    };

    let getShader = function (name) {
        return shaders[name];
    };

    let init = function (ctx) {
        gl = ctx;
    };

    return {
        loadProgram: loadProgram,
        getShader: getShader,
        init: init,
    };
})();
