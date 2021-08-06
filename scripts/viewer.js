/*global vec3, mat4, Grid, GridRenderer, DeferredRenderer, ShaderLoader, MoleculeLoader, MoleculeRenderer, Utilities*/

let Viewer = (function (DeferredRenderer, ShaderLoader, MoleculeLoader, MoleculeRenderer, GridRenderer, Utilities) {
    "use strict";

    let gl;
    let exts = {};

    let canvas;
    let canvasComputedStyle;

    let redrawRequested = false;

    let renderSettings = {
        aoIntensity: 0.25,
        altitude: 60,
        azimuth: 60,
        renderGrid: false,
        mode: 5,
    };

    let molecule = {};
    let atoms = [];

    let camera = {
        vMatrix: mat4.create(),
        pMatrix: mat4.create(),
        position: vec3.create(),
        vpMatrix: mat4.create(),
        inverseVPMatrix: mat4.create(),
        zoom: 0,
    };

    let light = {
        position: vec3.fromValues(0, 0, 1),
        vMatrix: mat4.create(),
        pMatrix: mat4.create(),
    };

    let mMatrix = mat4.create();

    let planemMatrix = mat4.create();
    let basePlaneVertexPositionBuffer;
    let basePlaneY;

    let grid = {};
    let pickingGrid = {};
    let selectedID = -1;

    let mouse = {
        down: false,
        lastX: null,
        lastY: null,
    };

    let initBasePlane = function () {
        basePlaneVertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, basePlaneVertexPositionBuffer);
        let vertices = [-1.0, 0.0, 1.0, 1.0, 0.0, 1.0, -1.0, 0.0, -1.0, 1.0, 0.0, -1.0];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        basePlaneVertexPositionBuffer.itemSize = 3;
        basePlaneVertexPositionBuffer.numItems = 4;
    };

    let renderBasePlane = function () {
        let shader = ShaderLoader.getShader("geom-pass");

        gl.useProgram(shader);

        mat4.identity(planemMatrix);
        mat4.translate(planemMatrix, planemMatrix, [0.0, -basePlaneY, 0.0]);
        mat4.scale(planemMatrix, planemMatrix, [basePlaneY * 3, 1, basePlaneY * 3]);

        gl.uniformMatrix4fv(shader.mMatrixUniform, false, planemMatrix);
        gl.uniformMatrix4fv(shader.vMatrixUniform, false, camera.vMatrix);
        gl.uniformMatrix4fv(shader.pMatrixUniform, false, camera.pMatrix);

        gl.uniform3f(shader.colourUniform, 0.5, 0.5, 0.5);

        gl.bindBuffer(gl.ARRAY_BUFFER, basePlaneVertexPositionBuffer);
        gl.vertexAttribPointer(
            shader.vertexPositionAttribute,
            basePlaneVertexPositionBuffer.itemSize,
            gl.FLOAT,
            false,
            0,
            0
        );
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, basePlaneVertexPositionBuffer.numItems);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(null);
    };

    let render = function () {
        redrawRequested = false;

        DeferredRenderer.beginGeometryPass();

        mat4.identity(camera.vMatrix);
        mat4.lookAt(camera.vMatrix, camera.position, [0, 0, 0], [0, 1, 0]);
        mat4.perspective(camera.pMatrix, 45, canvas.width / canvas.height, 1.0, 1000.0);

        MoleculeRenderer.render(atoms, camera, mMatrix);

        renderBasePlane();

        if (renderSettings.renderGrid) {
            GridRenderer.render(grid, camera, mMatrix, {
                screenWidth: canvas.width,
                screenHeight: canvas.height,
                mouse: mouse,
            });
        }

        DeferredRenderer.endGeometryPass();

        let azimuth = Utilities.degToRad(renderSettings.azimuth);
        let altitude = Utilities.degToRad(renderSettings.altitude);

        light.position[0] = camera.zoom * 1.2 * Math.sin(altitude) * Math.cos(azimuth);
        light.position[1] = camera.zoom * 1.2 * Math.cos(altitude);
        light.position[2] = camera.zoom * 1.2 * Math.sin(altitude) * Math.sin(azimuth);

        DeferredRenderer.renderLightPass(camera, light, mMatrix, renderSettings);
    };

    let requestRedraw = function () {
        if (redrawRequested) {
            return;
        }

        redrawRequested = true;
        window.requestAnimationFrame(render);
    };

    let calcGrid = function () {
        let boundingBox = MoleculeLoader.getBoundingBox();
        let maxRadius = MoleculeLoader.getMaxRadius();

        grid = new Grid();
        grid.init(boundingBox.min, boundingBox.max, maxRadius * 2);

        for (let i = 0; i < atoms.length; i++) {
            let index3D = grid.getObjectGridIndex3D(atoms[i].position);

            if (grid.insideGrid(index3D[0], index3D[1], index3D[2])) {
                let index = parseInt(
                    index3D[2] * grid.numBoxesX * grid.numBoxesY + index3D[1] * grid.numBoxesX + index3D[0]
                );

                if (grid.cells[index] === undefined) {
                    grid.cells[index] = [];
                }

                grid.cells[index].push(parseInt(i));
            }
        }

        pickingGrid = new Grid();
        pickingGrid.init(boundingBox.min, boundingBox.max, maxRadius * 2);

        for (let i = 0; i < atoms.length; i++) {
            // get the atoms grid index at its center
            let atomIndex3D = pickingGrid.getObjectGridIndex3D(atoms[i].position);

            // loop through the cell, as well as the surrounding cells, and check if the atom intersects with the cells
            for (let x = -1; x < 2; x++) {
                for (let y = -1; y < 2; y++) {
                    for (let z = -1; z < 2; z++) {
                        let cellX = atomIndex3D[0] + x;
                        let cellY = atomIndex3D[1] + y;
                        let cellZ = atomIndex3D[2] + z;

                        if (pickingGrid.insideGrid(cellX, cellY, cellZ)) {
                            let min = pickingGrid.getCellMinPoint(cellX, cellY, cellZ);
                            let max = pickingGrid.getCellMaxPoint(cellX, cellY, cellZ);

                            if (Utilities.intersectSphereAABB(atoms[i].position, atoms[i].radius, min, max)) {
                                let index =
                                    cellZ * pickingGrid.numBoxesX * pickingGrid.numBoxesY +
                                    cellY * pickingGrid.numBoxesX +
                                    cellX;

                                if (pickingGrid.cells[index] === undefined) {
                                    pickingGrid.cells[index] = [];
                                }

                                pickingGrid.cells[index].push(parseInt(i));
                            }
                        }
                    }
                }
            }
        }
    };

    let picking = function (x, y) {
        mat4.multiply(camera.vpMatrix, camera.pMatrix, camera.vMatrix);
        mat4.invert(camera.inverseVPMatrix, camera.vpMatrix);

        let origin = vec3.fromValues(camera.position[0], camera.position[1], camera.position[2]);
        let direction = Utilities.getEyeRay(
            camera.position,
            camera.inverseVPMatrix,
            (x / canvas.width) * 2 - 1,
            1 - (y / canvas.height) * 2
        );
        vec3.normalize(direction, direction);

        selectedID = -1;
        let tmin = Number.MAX_VALUE;

        let gridMax = vec3.create();
        let gridNumBoxes = vec3.fromValues(pickingGrid.numBoxesX, pickingGrid.numBoxesY, pickingGrid.numBoxesZ);
        vec3.scale(gridMax, gridNumBoxes, pickingGrid.cellSize);
        vec3.add(gridMax, gridMax, pickingGrid.min);

        let rayOrigin = Utilities.toLocal(origin, mMatrix);
        let rayDir = Utilities.toLocal(direction, mMatrix);

        let intersect = Utilities.intersectRayAABB(rayOrigin, rayDir, grid.min, gridMax);
        intersect.t0 += 0.001;

        for (let i = 0; i < atoms.length; i++) {
            atoms[i].tested = false;
        }

        if (intersect.hit) {
            let index = pickingGrid.getObjectGridIndex3D(rayOrigin);
            let indexX = index[0];
            let indexY = index[1];
            let indexZ = index[2];

            if (!pickingGrid.insideGrid(indexX, indexY, indexZ)) {
                let temp = vec3.create();
                vec3.scale(temp, rayDir, intersect.t0);
                vec3.add(rayOrigin, rayOrigin, temp);

                index = pickingGrid.getObjectGridIndex3D(rayOrigin);
                indexX = index[0];
                indexY = index[1];
                indexZ = index[2];
            }

            let tDeltaX = Math.abs(pickingGrid.cellSize / rayDir[0]);
            let tDeltaY = Math.abs(pickingGrid.cellSize / rayDir[1]);
            let tDeltaZ = Math.abs(pickingGrid.cellSize / rayDir[2]);

            let stepX = (rayDir[0] > 0) - (rayDir[0] < 0);
            let stepY = (rayDir[1] > 0) - (rayDir[1] < 0);
            let stepZ = (rayDir[2] > 0) - (rayDir[2] < 0);

            let cellBoundsMin = pickingGrid.getCellMinPoint(indexX, indexY, indexZ);
            let cellBoundsMax = pickingGrid.getCellMaxPoint(indexX, indexY, indexZ);

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
                let index1D = parseInt(
                    indexZ * pickingGrid.numBoxesX * pickingGrid.numBoxesY + indexY * pickingGrid.numBoxesX + indexX
                );

                let cell = pickingGrid.cells[index1D];

                // todo
                // use grid where atoms can be in more than once cell
                // counter possible mulitple collision tests using technique from woo

                if (cell !== undefined) {
                    for (let i = 0; i < cell.length; i++) {
                        let id = cell[i];

                        if (!atoms[id].tested) {
                            let t = Utilities.intersectRaySphere(
                                rayOrigin,
                                rayDir,
                                atoms[id].position,
                                atoms[id].radius
                            );
                            atoms[id].tested = true;

                            if (t < tmin) {
                                tmin = t;
                                selectedID = id;
                            }
                        }
                    }
                }

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

                done = !pickingGrid.insideGrid(indexX, indexY, indexZ);
            }
        }

        return atoms[selectedID];
    };

    let setupMolecule = function () {
        molecule = MoleculeLoader.getMolecule();
        atoms = molecule.atoms;

        let midPoint = MoleculeLoader.getMidPoint();
        let maxRadius = MoleculeLoader.getMaxRadius();
        let furthestDist = MoleculeLoader.getFurthestDistanceToMidPoint(midPoint);

        basePlaneY = furthestDist + maxRadius;
        camera.position[2] = camera.zoom = furthestDist / Math.tan(45 * 0.5 * (Math.PI / 180.0)) + maxRadius;

        MoleculeLoader.centerMoleculeOnMidPoint(midPoint);

        mat4.identity(mMatrix);

        calcGrid();

        DeferredRenderer.calcOccluders(atoms, grid);
    };

    let handleMouseDown = function (event) {
        if (event.which === 1) {
            mouse.down = true;
        }
    };

    let handleMouseUp = function (event) {
        if (event.which === 1) {
            mouse.down = false;
        }
    };

    let handleMouseMove = function (event) {
        requestRedraw();

        if (mouse.down) {
            let moleculeRotationMatrix = mat4.create();

            let deltaX = event.clientX - mouse.lastX;
            mat4.rotate(moleculeRotationMatrix, moleculeRotationMatrix, Utilities.degToRad(deltaX / 10), [0, 1, 0]);

            let deltaY = event.clientY - mouse.lastY;
            mat4.rotate(moleculeRotationMatrix, moleculeRotationMatrix, Utilities.degToRad(deltaY / 10), [1, 0, 0]);

            mat4.multiply(mMatrix, moleculeRotationMatrix, mMatrix);
        }

        mouse.lastX = event.clientX;
        mouse.lastY = event.clientY;
    };

    let handleMouseWheel = function (event) {
        requestRedraw();

        let delta = event.wheelDelta ? event.wheelDelta / 40 : event.detail ? -event.detail : 0;
        camera.position[2] -= delta * 0.5;
    };

    let handleResize = function () {
        let canvasWidth = canvasComputedStyle.width.replace("px", "");
        let canvasHeight = canvasComputedStyle.height.replace("px", "");
        resize(canvasWidth, canvasHeight);
    };

    let getImageDataURL = function () {
        return canvas.toDataURL("image/jpeg");
    };

    let updateRenderSettings = function (options) {
        renderSettings = { ...renderSettings, ...options };
    };

    let bindEventListeners = function () {
        canvas.addEventListener("mousedown", handleMouseDown);
        canvas.addEventListener("mouseup", handleMouseUp);
        canvas.addEventListener("mousemove", handleMouseMove);
        canvas.addEventListener("wheel", handleMouseWheel);
        window.addEventListener("resize", handleResize);
    };

    let loadFromFile = function (str) {
        MoleculeLoader.parsePDBFile(str);
        setupMolecule();
        requestRedraw();
    };

    let download = function (pdbID) {
        return MoleculeLoader.download(pdbID).then(function () {
            setupMolecule();
            requestRedraw();
        });
    };

    let getProtein = function () {
        return MoleculeLoader.getMolecule().protein;
    };

    let initGL = function () {
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.frontFace(gl.CCW);
        gl.depthMask(true);
        gl.clearDepth(1);
        gl.disable(gl.BLEND);
    };

    let initExtentions = function () {
        exts.fragDepth = gl.getExtension("EXT_frag_depth");
        exts.drawBuffers = gl.getExtension("WEBGL_draw_buffers");
        exts.textureFloat = gl.getExtension("OES_texture_float");
        exts.textureFloatLinear = gl.getExtension("OES_texture_float_linear");
        exts.depthTexture = gl.getExtension("WEBGL_depth_texture");
        //gl.getExtension('WEBGL_color_buffer_float');

        return exts.fragDepth && exts.drawBuffers && exts.textureFloat && exts.textureFloatLinear && exts.depthTexture;
    };

    let resize = function (width, height) {
        requestRedraw();

        canvas.width = width;
        canvas.height = height;

        DeferredRenderer.resize(width, height);

        gl.viewport(0, 0, width, height);

        mat4.perspective(camera.pMatrix, 45, width / height, 1.0, 1000.0);
    };

    let init = function (canvasElement) {
        canvas = canvasElement;
        canvasComputedStyle = getComputedStyle(canvas);
        canvas.width = canvasComputedStyle.width.replace("px", "");
        canvas.height = canvasComputedStyle.height.replace("px", "");

        gl = canvas.getContext("experimental-webgl", {
            preserveDrawingBuffer: true,
        });

        if (!gl || !initExtentions()) {
            alert("Could not initialise WebGL.");
            return Promise.reject("Could not initialise WebGL.");
        }

        initGL();
        initBasePlane();

        ShaderLoader.init(gl);

        let initPromises = [];
        initPromises.push(
            DeferredRenderer.init(gl, exts, {
                width: canvas.width,
                height: canvas.height,
            }),
            GridRenderer.init(gl),
            MoleculeRenderer.init(gl)
        );

        return Promise.all(initPromises).then(function () {
            bindEventListeners();
            resize(canvas.width, canvas.height);
        });
    };

    return {
        init: init,
        updateRenderSettings: updateRenderSettings,
        getImageDataURL: getImageDataURL,
        loadFromFile: loadFromFile,
        download: download,
        getProtein: getProtein,
        requestRedraw: requestRedraw,
        resize: resize,
        picking: picking,
    };
})(DeferredRenderer, ShaderLoader, MoleculeLoader, MoleculeRenderer, GridRenderer, Utilities);
