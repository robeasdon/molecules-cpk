/*global jQuery, ShaderLoader*/

var MoleculeRenderer = (function ($, ShaderLoader) {
    "use strict";

    var gl;

    var cubeVertexPositionBuffer;
    var cubeVertexIndexBuffer;

    var initBuffers = function () {
        // prettier-ignore
        var vertices = [
            // Front face
            -1.0, -1.0, 1.0,
            1.0, -1.0, 1.0,
            1.0, 1.0, 1.0,
            -1.0, 1.0, 1.0,

            // Back face
            -1.0, -1.0, -1.0,
            -1.0, 1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, -1.0, -1.0,

            // Top face
            -1.0, 1.0, -1.0,
            -1.0, 1.0, 1.0,
            1.0, 1.0, 1.0,
            1.0, 1.0, -1.0,

            // Bottom face
            -1.0, -1.0, -1.0,
            1.0, -1.0, -1.0,
            1.0, -1.0, 1.0,
            -1.0, -1.0, 1.0,

            // Right face
            1.0, -1.0, -1.0,
            1.0, 1.0, -1.0,
            1.0, 1.0, 1.0,
            1.0, -1.0, 1.0,

            // Left face
            -1.0, -1.0, -1.0,
            -1.0, -1.0, 1.0,
            -1.0, 1.0, 1.0,
            -1.0, 1.0, -1.0
        ];
        // prettier-ignore
        var indices = [
            0, 1, 2, 0, 2, 3,  // front
            4, 5, 6, 4, 6, 7,  // back
            8, 9, 10, 8, 10, 11, // top
            12, 13, 14, 12, 14, 15, // bottom
            16, 17, 18, 16, 18, 19, // right
            20, 21, 22, 20, 22, 23  // left
        ];

        cubeVertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        cubeVertexPositionBuffer.itemSize = 3;
        cubeVertexPositionBuffer.numItems = vertices.length / 3;

        cubeVertexIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        cubeVertexIndexBuffer.itemSize = 1;
        cubeVertexIndexBuffer.numItems = indices.length;
    };

    var initShader = function (program) {
        // attributes

        program.vertexPositionAttribute = gl.getAttribLocation(program, "aPosition");
        gl.enableVertexAttribArray(program.vertexPositionAttribute);

        // uniforms

        program.instancePositionUniform = gl.getUniformLocation(program, "uInstancePosition");
        program.radiusUniform = gl.getUniformLocation(program, "uRadius");
        program.atomIdUniform = gl.getUniformLocation(program, "uAtomId");
        program.colourUniform = gl.getUniformLocation(program, "uColour");
        program.mMatrixUniform = gl.getUniformLocation(program, "uModelMatrix");
        program.vMatrixUniform = gl.getUniformLocation(program, "uViewMatrix");
        program.pMatrixUniform = gl.getUniformLocation(program, "uProjectionMatrix");

        return program;
    };

    var loadShaders = function () {
        return ShaderLoader.loadProgram("molecule", "shaders/molecule.vert", "shaders/molecule.frag", initShader);
    };

    var render = function (atoms, camera, mMatrix) {
        var shader = ShaderLoader.getShader("molecule");

        gl.useProgram(shader);

        gl.uniformMatrix4fv(shader.mMatrixUniform, false, mMatrix);
        gl.uniformMatrix4fv(shader.vMatrixUniform, false, camera.vMatrix);
        gl.uniformMatrix4fv(shader.pMatrixUniform, false, camera.pMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
        gl.vertexAttribPointer(
            shader.vertexPositionAttribute,
            cubeVertexPositionBuffer.itemSize,
            gl.FLOAT,
            false,
            0,
            0
        );

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);

        for (var i = 0; i < atoms.length; i++) {
            gl.uniform3f(
                shader.instancePositionUniform,
                atoms[i].position[0],
                atoms[i].position[1],
                atoms[i].position[2]
            );
            gl.uniform1f(shader.radiusUniform, atoms[i].radius);
            gl.uniform1f(shader.atomIdUniform, i);
            gl.uniform3f(shader.colourUniform, atoms[i].colour[0], atoms[i].colour[1], atoms[i].colour[2]);

            gl.drawElements(gl.TRIANGLES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(null);
    };

    var init = function (ctx) {
        gl = ctx;
        initBuffers();
        return $.when(loadShaders());
    };

    return {
        init: init,
        initShader: initShader,
        render: render,
    };
})(jQuery, ShaderLoader);
