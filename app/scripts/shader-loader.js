/*global jQuery*/

var ShaderLoader = (function($) {
    'use strict';

    var gl;
    var shaders = {};

    var createShader = function(str, type) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, str);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw gl.getShaderInfoLog(shader);
        }
        return shader;
    };

    var createProgram = function(vstr, fstr) {
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

    var loadShaderFromFile = function(url) {
        return $.ajax(url, {
            dataType: 'text'
        });
    };

    var loadProgram = function(name, vert, frag, initShader) {
        return $.when(loadShaderFromFile(vert), loadShaderFromFile(frag)).done(function(vshader, fshader) {
            var program = createProgram(vshader[0], fshader[0]);
            initShader(program);
            shaders[name] = program;
        });
    };

    var getShader = function(name) {
        return shaders[name];
    };

    var init = function(ctx) {
        gl = ctx;
    };

    return {
        loadProgram: loadProgram,
        getShader: getShader,
        init: init
    };
})(jQuery);
