/*global jQuery, ShaderLoader, Utilities, vec3, mat4*/

var GridRenderer = (function($, ShaderLoader, Utilities) {
    'use strict';

    var gl;

    var cubeVertexPositionBuffer;
    var cubeVertexIndexBuffer;

    var initBuffers = function() {
        var vertices = [
            // front
            0, 0, 1,
            1, 0, 1,
            1, 1, 1,
            0, 1, 1,
            // back
            0, 0, 0,
            0, 1, 0,
            1, 1, 0,
            1, 0, 0
        ];

        var indices = [
            0, 1, 1, 2, 2, 3, 3, 0, // front
            4, 5, 5, 6, 6, 7, 7, 4, // back
            // connect front to back
            0, 4,
            1, 7,
            2, 6,
            3, 5
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

    var initShader = function(program) {
        // attributes

        program.vertexPositionAttribute = gl.getAttribLocation(program, 'aPosition');
        gl.enableVertexAttribArray(program.vertexPositionAttribute);

        // uniforms

        program.instancePositionUniform = gl.getUniformLocation(program, 'uInstancePosition');
        program.colourUniform = gl.getUniformLocation(program, 'uColour');
        program.cellSizeUniform = gl.getUniformLocation(program, 'uCellSize');
        program.mMatrixUniform = gl.getUniformLocation(program, 'uModelMatrix');
        program.vMatrixUniform = gl.getUniformLocation(program, 'uViewMatrix');
        program.pMatrixUniform = gl.getUniformLocation(program, 'uProjectionMatrix');

        return program;
    };

    var loadShaders = function() {
        return ShaderLoader.loadProgram('grid', 'shaders/grid.vert', 'shaders/grid.frag', initShader);
    };

    var render = function(grid, camera, mMatrix, params) {
        var shader = ShaderLoader.getShader('grid');

        gl.useProgram(shader);

        gl.uniformMatrix4fv(shader.mMatrixUniform, false, mMatrix);
        gl.uniformMatrix4fv(shader.vMatrixUniform, false, camera.vMatrix);
        gl.uniformMatrix4fv(shader.pMatrixUniform, false, camera.pMatrix);

        gl.bindBuffer(gl.ARRAY_BUFFER, cubeVertexPositionBuffer);
        gl.vertexAttribPointer(shader.vertexPositionAttribute, cubeVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeVertexIndexBuffer);

        // 3d-dda cells

        var inverseVPMatrix = mat4.create();
        var vpMatrix = mat4.create();

        mat4.multiply(vpMatrix, camera.pMatrix, camera.vMatrix);
        mat4.invert(inverseVPMatrix, vpMatrix);

        var ro = vec3.fromValues(camera.position[0], camera.position[1], camera.position[2]);
        var rd = Utilities.getEyeRay(camera.position, inverseVPMatrix, (params.mouse.lastX / params.screenWidth) * 2 - 1, 1 - (params.mouse.lastY / params.screenHeight) * 2);
        vec3.normalize(rd, rd);

        var gridMax = vec3.create();
        var gridNumBoxes = vec3.fromValues(grid.numBoxesX, grid.numBoxesY, grid.numBoxesZ);
        vec3.scale(gridMax, gridNumBoxes, grid.cellSize);
        vec3.add(gridMax, gridMax, grid.min);

        var rayOrigin = Utilities.toLocal(ro, mMatrix);
        var rayDir = Utilities.toLocal(rd, mMatrix);

        var intersect = Utilities.intersectRayAABB(rayOrigin, rayDir, grid.min, gridMax);
        intersect.t0 += 0.001;

        if (intersect.hit) {
            var index = grid.getObjectGridIndex3D(rayOrigin);
            var indexX = index[0];
            var indexY = index[1];
            var indexZ = index[2];

            if (!grid.insideGrid(indexX, indexY, indexZ)) {
                var temp = vec3.create();
                vec3.scale(temp, rayDir, intersect.t0);
                vec3.add(rayOrigin, rayOrigin, temp);

                index = grid.getObjectGridIndex3D(rayOrigin);
                indexX = index[0];
                indexY = index[1];
                indexZ = index[2];
            }

            var tDeltaX = Math.abs(grid.cellSize / rayDir[0]);
            var tDeltaY = Math.abs(grid.cellSize / rayDir[1]);
            var tDeltaZ = Math.abs(grid.cellSize / rayDir[2]);

            var stepX = (rayDir[0] > 0) - (rayDir[0] < 0);
            var stepY = (rayDir[1] > 0) - (rayDir[1] < 0);
            var stepZ = (rayDir[2] > 0) - (rayDir[2] < 0);

            var cellBoundsMin = grid.getCellMinPoint(indexX, indexY, indexZ);
            var cellBoundsMax = grid.getCellMaxPoint(indexX, indexY, indexZ);

            var tMaxNegX = (cellBoundsMin[0] - rayOrigin[0]) / rayDir[0];
            var tMaxNegY = (cellBoundsMin[1] - rayOrigin[1]) / rayDir[1];
            var tMaxNegZ = (cellBoundsMin[2] - rayOrigin[2]) / rayDir[2];

            var tMaxPosX = (cellBoundsMax[0] - rayOrigin[0]) / rayDir[0];
            var tMaxPosY = (cellBoundsMax[1] - rayOrigin[1]) / rayDir[1];
            var tMaxPosZ = (cellBoundsMax[2] - rayOrigin[2]) / rayDir[2];

            var tMaxX = rayDir[0] < 0 ? tMaxNegX : tMaxPosX;
            var tMaxY = rayDir[1] < 0 ? tMaxNegY : tMaxPosY;
            var tMaxZ = rayDir[2] < 0 ? tMaxNegZ : tMaxPosZ;

            var done = false;

            while (!done) {
                gl.uniform3f(shader.instancePositionUniform,
                    grid.min[0] + indexX * grid.cellSize,
                    grid.min[1] + indexY * grid.cellSize,
                    grid.min[2] + indexZ * grid.cellSize);

                gl.uniform3f(shader.colourUniform, 0.0, 0.0, 1.0);
                gl.uniform1f(shader.cellSizeUniform, grid.cellSize);

                gl.drawElements(gl.LINES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

                if (tMaxX < tMaxY) {
                    if (tMaxX < tMaxZ) {
                        indexX += stepX;
                        tMaxX += tDeltaX;
                    } else {
                        indexZ += stepZ;
                        tMaxZ += tDeltaZ;
                    }
                } else {
                    if (tMaxY < tMaxZ) {
                        indexY += stepY;
                        tMaxY += tDeltaY;
                    } else {
                        indexZ += stepZ;
                        tMaxZ += tDeltaZ;
                    }
                }

                done = !grid.insideGrid(indexX, indexY, indexZ);
            }
        }

        for (var x = 0; x < grid.numBoxesX; x++) {
            for (var y = 0; y < grid.numBoxesY; y++) {
                for (var z = 0; z < grid.numBoxesZ; z++) {
                    gl.uniform3f(shader.instancePositionUniform,
                        grid.min[0] + x * grid.cellSize,
                        grid.min[1] + y * grid.cellSize,
                        grid.min[2] + z * grid.cellSize);

                    gl.uniform3f(shader.colourUniform, 0.5, 0.5, 0.5);
                    gl.uniform1f(shader.cellSizeUniform, grid.cellSize);

                    gl.drawElements(gl.LINES, cubeVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);
                }
            }
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(null);
    };

    var init = function(ctx) {
        gl = ctx;
        initBuffers();
        return $.when(loadShaders());
    };

    return {
        init: init,
        render: render,
        initShader: initShader
    };
})(jQuery, ShaderLoader, Utilities);
