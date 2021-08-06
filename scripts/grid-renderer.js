/*global ShaderLoader, Utilities, vec3, mat4*/

let GridRenderer = (function (ShaderLoader, Utilities) {
    "use strict";

    let gl;

    let cubeVertexPositionBuffer;
    let cubeVertexIndexBuffer;

    let initBuffers = function () {
        // prettier-ignore
        let vertices = [
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
        // prettier-ignore
        let indices = [
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

    let initShader = function (program) {
        // attributes

        program.vertexPositionAttribute = gl.getAttribLocation(program, "aPosition");
        gl.enableVertexAttribArray(program.vertexPositionAttribute);

        // uniforms

        program.instancePositionUniform = gl.getUniformLocation(program, "uInstancePosition");
        program.colourUniform = gl.getUniformLocation(program, "uColour");
        program.cellSizeUniform = gl.getUniformLocation(program, "uCellSize");
        program.mMatrixUniform = gl.getUniformLocation(program, "uModelMatrix");
        program.vMatrixUniform = gl.getUniformLocation(program, "uViewMatrix");
        program.pMatrixUniform = gl.getUniformLocation(program, "uProjectionMatrix");

        return program;
    };

    let loadShaders = function () {
        return ShaderLoader.loadProgram("grid", "shaders/grid.vert", "shaders/grid.frag", initShader);
    };

    let render = function (grid, camera, mMatrix, params) {
        let shader = ShaderLoader.getShader("grid");

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

        // 3d-dda cells

        let inverseVPMatrix = mat4.create();
        let vpMatrix = mat4.create();

        mat4.multiply(vpMatrix, camera.pMatrix, camera.vMatrix);
        mat4.invert(inverseVPMatrix, vpMatrix);

        let ro = vec3.fromValues(camera.position[0], camera.position[1], camera.position[2]);
        let rd = Utilities.getEyeRay(
            camera.position,
            inverseVPMatrix,
            (params.mouse.lastX / params.screenWidth) * 2 - 1,
            1 - (params.mouse.lastY / params.screenHeight) * 2
        );
        vec3.normalize(rd, rd);

        let gridMax = vec3.create();
        let gridNumBoxes = vec3.fromValues(grid.numBoxesX, grid.numBoxesY, grid.numBoxesZ);
        vec3.scale(gridMax, gridNumBoxes, grid.cellSize);
        vec3.add(gridMax, gridMax, grid.min);

        let rayOrigin = Utilities.toLocal(ro, mMatrix);
        let rayDir = Utilities.toLocal(rd, mMatrix);

        let intersect = Utilities.intersectRayAABB(rayOrigin, rayDir, grid.min, gridMax);
        intersect.t0 += 0.001;

        if (intersect.hit) {
            let index = grid.getObjectGridIndex3D(rayOrigin);
            let indexX = index[0];
            let indexY = index[1];
            let indexZ = index[2];

            if (!grid.insideGrid(indexX, indexY, indexZ)) {
                let temp = vec3.create();
                vec3.scale(temp, rayDir, intersect.t0);
                vec3.add(rayOrigin, rayOrigin, temp);

                index = grid.getObjectGridIndex3D(rayOrigin);
                indexX = index[0];
                indexY = index[1];
                indexZ = index[2];
            }

            let tDeltaX = Math.abs(grid.cellSize / rayDir[0]);
            let tDeltaY = Math.abs(grid.cellSize / rayDir[1]);
            let tDeltaZ = Math.abs(grid.cellSize / rayDir[2]);

            let stepX = (rayDir[0] > 0) - (rayDir[0] < 0);
            let stepY = (rayDir[1] > 0) - (rayDir[1] < 0);
            let stepZ = (rayDir[2] > 0) - (rayDir[2] < 0);

            let cellBoundsMin = grid.getCellMinPoint(indexX, indexY, indexZ);
            let cellBoundsMax = grid.getCellMaxPoint(indexX, indexY, indexZ);

            let tMaxNegX = (cellBoundsMin[0] - rayOrigin[0]) / rayDir[0];
            let tMaxNegY = (cellBoundsMin[1] - rayOrigin[1]) / rayDir[1];
            let tMaxNegZ = (cellBoundsMin[2] - rayOrigin[2]) / rayDir[2];

            let tMaxPosX = (cellBoundsMax[0] - rayOrigin[0]) / rayDir[0];
            let tMaxPosY = (cellBoundsMax[1] - rayOrigin[1]) / rayDir[1];
            let tMaxPosZ = (cellBoundsMax[2] - rayOrigin[2]) / rayDir[2];

            let tMaxX = rayDir[0] < 0 ? tMaxNegX : tMaxPosX;
            let tMaxY = rayDir[1] < 0 ? tMaxNegY : tMaxPosY;
            let tMaxZ = rayDir[2] < 0 ? tMaxNegZ : tMaxPosZ;

            let done = false;

            while (!done) {
                gl.uniform3f(
                    shader.instancePositionUniform,
                    grid.min[0] + indexX * grid.cellSize,
                    grid.min[1] + indexY * grid.cellSize,
                    grid.min[2] + indexZ * grid.cellSize
                );

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

        for (let x = 0; x < grid.numBoxesX; x++) {
            for (let y = 0; y < grid.numBoxesY; y++) {
                for (let z = 0; z < grid.numBoxesZ; z++) {
                    gl.uniform3f(
                        shader.instancePositionUniform,
                        grid.min[0] + x * grid.cellSize,
                        grid.min[1] + y * grid.cellSize,
                        grid.min[2] + z * grid.cellSize
                    );

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

    let init = function (ctx) {
        gl = ctx;
        initBuffers();
        return loadShaders();
    };

    return {
        init: init,
        render: render,
        initShader: initShader,
    };
})(ShaderLoader, Utilities);
