/*global jQuery, vec3, mat4, Grid, GridRenderer, DeferredRenderer, ShaderLoader, MoleculeLoader, MoleculeRenderer, Utilities*/

var Viewer = (function($, DeferredRenderer, ShaderLoader, MoleculeLoader, MoleculeRenderer, GridRenderer, Utilities) {
    'use strict';

    var gl;
    var exts = {};

    var $canvas;

    var settings = {
        canvas: '#canvas',
        width: 512,
        height: 512
    };

    var redrawRequested = false;

    var renderSettings = {
        aoIntensity: 0.25,
        altitude: 60,
        azimuth: 60,
        renderGrid: false,
        mode: 5
    };

    var molecule = {};
    var atoms = [];

    var camera = {
        vMatrix: mat4.create(),
        pMatrix: mat4.create(),
        position: vec3.create(),
        vpMatrix: mat4.create(),
        inverseVPMatrix: mat4.create(),
        zoom: 0
    };

    var light = {
        position: vec3.fromValues(0, 0, 1),
        vMatrix: mat4.create(),
        pMatrix: mat4.create()
    };

    var mMatrix = mat4.create();

    var planemMatrix = mat4.create();
    var basePlaneVertexPositionBuffer;
    var basePlaneY;

    var grid = {};
    var pickingGrid = {};
    var selectedID = -1;

    var mouse = {
        down: false,
        lastX: null,
        lastY: null
    };

    var initBasePlane = function() {
        basePlaneVertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, basePlaneVertexPositionBuffer);
        var vertices = [
            -1.0, 0.0, 1.0,
            1.0, 0.0, 1.0,
            -1.0, 0.0, -1.0,
            1.0, 0.0, -1.0
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        basePlaneVertexPositionBuffer.itemSize = 3;
        basePlaneVertexPositionBuffer.numItems = 4;
    };

    var renderBasePlane = function() {
        var shader = ShaderLoader.getShader('geom-pass');

        gl.useProgram(shader);

        mat4.identity(planemMatrix);
        mat4.translate(planemMatrix, planemMatrix, [0.0, -basePlaneY, 0.0]);
        mat4.scale(planemMatrix, planemMatrix, [basePlaneY * 3, 1, basePlaneY * 3]);

        gl.uniformMatrix4fv(shader.mMatrixUniform, false, planemMatrix);
        gl.uniformMatrix4fv(shader.vMatrixUniform, false, camera.vMatrix);
        gl.uniformMatrix4fv(shader.pMatrixUniform, false, camera.pMatrix);

        gl.uniform3f(shader.colourUniform, 0.5, 0.5, 0.5);

        gl.bindBuffer(gl.ARRAY_BUFFER, basePlaneVertexPositionBuffer);
        gl.vertexAttribPointer(shader.vertexPositionAttribute, basePlaneVertexPositionBuffer.itemSize, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, basePlaneVertexPositionBuffer.numItems);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(null);
    };

    var render = function() {
        redrawRequested = false;

        DeferredRenderer.beginGeometryPass();

        mat4.identity(camera.vMatrix);
        mat4.lookAt(camera.vMatrix, camera.position, [0, 0, 0], [0, 1, 0]);
        mat4.perspective(camera.pMatrix, 45, settings.width / settings.height, 1.0, 1000.0);

        MoleculeRenderer.render(atoms, camera, mMatrix);

        renderBasePlane();

        if (renderSettings.renderGrid) {
            GridRenderer.render(grid, camera, mMatrix, {
                screenWidth: settings.width,
                screenHeight: settings.height,
                mouse: mouse
            });
        }

        DeferredRenderer.endGeometryPass();

        var azimuth = Utilities.degToRad(renderSettings.azimuth);
        var altitude = Utilities.degToRad(renderSettings.altitude);

        light.position[0] = camera.zoom * 1.2 * Math.sin(altitude) * Math.cos(azimuth);
        light.position[1] = camera.zoom * 1.2 * Math.cos(altitude);
        light.position[2] = camera.zoom * 1.2 * Math.sin(altitude) * Math.sin(azimuth);

        DeferredRenderer.renderLightPass(camera, light, mMatrix, renderSettings);
    };

    var requestRedraw = function() {
        if (redrawRequested) {
            return;
        }

        redrawRequested = true;
        window.requestAnimationFrame(render);
    };

    var calcGrid = function() {
        var boundingBox = MoleculeLoader.getBoundingBox();
        var maxRadius = MoleculeLoader.getMaxRadius();

        grid = new Grid();
        grid.init(boundingBox.min, boundingBox.max, maxRadius * 2);

        for (var i = 0; i < atoms.length; i++) {
            var index3D = grid.getObjectGridIndex3D(atoms[i].position);

            if (grid.insideGrid(index3D[0], index3D[1], index3D[2])) {
                var index = parseInt((index3D[2] * grid.numBoxesX * grid.numBoxesY) +
                    (index3D[1] * grid.numBoxesX) + index3D[0]);

                if (grid.cells[index] === undefined) {
                    grid.cells[index] = [];
                }

                grid.cells[index].push(parseInt(i));
            }
        }

        pickingGrid = new Grid();
        pickingGrid.init(boundingBox.min, boundingBox.max, maxRadius * 2);

        for (var i = 0; i < atoms.length; i++) {
            // get the atoms grid index at its center
            var atomIndex3D = pickingGrid.getObjectGridIndex3D(atoms[i].position);

            // loop through the cell, as well as the surrounding cells, and check if the atom intersects with the cells
            for (var x = -1; x < 2; x++) {
                for (var y = -1; y < 2; y++) {
                    for (var z = -1; z < 2; z++) {
                        var cellX = atomIndex3D[0] + x;
                        var cellY = atomIndex3D[1] + y;
                        var cellZ = atomIndex3D[2] + z;

                        if (pickingGrid.insideGrid(cellX, cellY, cellZ)) {
                            var min = pickingGrid.getCellMinPoint(cellX, cellY, cellZ);
                            var max = pickingGrid.getCellMaxPoint(cellX, cellY, cellZ);

                            if (Utilities.intersectSphereAABB(atoms[i].position, atoms[i].radius, min, max)) {
                                var index = (cellZ * pickingGrid.numBoxesX * pickingGrid.numBoxesY) +
                                    (cellY * pickingGrid.numBoxesX) + cellX;

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

    var picking = function(x, y) {
        mat4.multiply(camera.vpMatrix, camera.pMatrix, camera.vMatrix);
        mat4.invert(camera.inverseVPMatrix, camera.vpMatrix);

        var origin = vec3.fromValues(camera.position[0], camera.position[1], camera.position[2]);
        var direction = Utilities.getEyeRay(camera.position, camera.inverseVPMatrix, (x / settings.width) * 2 - 1, 1 - (y / settings.height) * 2);
        vec3.normalize(direction, direction);

        selectedID = -1;
        var tmin = Number.MAX_VALUE;

        var gridMax = vec3.create();
        var gridNumBoxes = vec3.fromValues(pickingGrid.numBoxesX, pickingGrid.numBoxesY, pickingGrid.numBoxesZ);
        vec3.scale(gridMax, gridNumBoxes, pickingGrid.cellSize);
        vec3.add(gridMax, gridMax, pickingGrid.min);

        var rayOrigin = Utilities.toLocal(origin, mMatrix);
        var rayDir = Utilities.toLocal(direction, mMatrix);

        var intersect = Utilities.intersectRayAABB(rayOrigin, rayDir, grid.min, gridMax);
        intersect.t0 += 0.001;

        for (var i = 0; i < atoms.length; i++) {
            atoms[i].tested = false;
        }

        if (intersect.hit) {
            var index = pickingGrid.getObjectGridIndex3D(rayOrigin);
            var indexX = index[0];
            var indexY = index[1];
            var indexZ = index[2];

            if (!pickingGrid.insideGrid(indexX, indexY, indexZ)) {
                var temp = vec3.create();
                vec3.scale(temp, rayDir, intersect.t0);
                vec3.add(rayOrigin, rayOrigin, temp);

                index = pickingGrid.getObjectGridIndex3D(rayOrigin);
                indexX = index[0];
                indexY = index[1];
                indexZ = index[2];
            }

            var tDeltaX = Math.abs(pickingGrid.cellSize / rayDir[0]);
            var tDeltaY = Math.abs(pickingGrid.cellSize / rayDir[1]);
            var tDeltaZ = Math.abs(pickingGrid.cellSize / rayDir[2]);

            var stepX = (rayDir[0] > 0) - (rayDir[0] < 0);
            var stepY = (rayDir[1] > 0) - (rayDir[1] < 0);
            var stepZ = (rayDir[2] > 0) - (rayDir[2] < 0);

            var cellBoundsMin = pickingGrid.getCellMinPoint(indexX, indexY, indexZ);
            var cellBoundsMax = pickingGrid.getCellMaxPoint(indexX, indexY, indexZ);

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
                var index1D = parseInt((indexZ * pickingGrid.numBoxesX * pickingGrid.numBoxesY) +
                    (indexY * pickingGrid.numBoxesX) + indexX);

                var cell = pickingGrid.cells[index1D];

                // todo
                // use grid where atoms can be in more than once cell
                // counter possible mulitple collision tests using technique from woo

                if (cell !== undefined) {
                    for (var i = 0; i < cell.length; i++) {
                        var id = cell[i];

                        if (!atoms[id].tested) {
                            var t = Utilities.intersectRaySphere(rayOrigin, rayDir, atoms[id].position, atoms[id].radius);
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

    var setupMolecule = function() {
        molecule = MoleculeLoader.getMolecule();
        atoms = molecule.atoms;

        var midPoint = MoleculeLoader.getMidPoint();
        var maxRadius = MoleculeLoader.getMaxRadius();
        var furthestDist = MoleculeLoader.getFurthestDistanceToMidPoint(midPoint);

        basePlaneY = furthestDist + maxRadius;
        camera.position[2] = camera.zoom = (furthestDist / Math.tan((45 * 0.5) * (Math.PI / 180.0))) + maxRadius;

        MoleculeLoader.centerMoleculeOnMidPoint(midPoint);

        mat4.identity(mMatrix);

        calcGrid();

        DeferredRenderer.calcOccluders(atoms, grid);
    };

    var handleMouseDown = function(event) {
        if (event.which === 1) {
            mouse.down = true;
        }
    };

    var handleMouseUp = function(event) {
        if (event.which === 1) {
            mouse.down = false;
        }
    };

    var handleMouseMove = function(event) {
        requestRedraw();

        if (mouse.down) {
            var moleculeRotationMatrix = mat4.create();

            var deltaX = event.clientX - mouse.lastX;
            mat4.rotate(moleculeRotationMatrix, moleculeRotationMatrix, Utilities.degToRad(deltaX / 10), [0, 1, 0]);

            var deltaY = event.clientY - mouse.lastY;
            mat4.rotate(moleculeRotationMatrix, moleculeRotationMatrix, Utilities.degToRad(deltaY / 10), [1, 0, 0]);

            mat4.multiply(mMatrix, moleculeRotationMatrix, mMatrix);
        }

        mouse.lastX = event.clientX;
        mouse.lastY = event.clientY;
    };

    var handleMouseWheel = function(event) {
        requestRedraw();

        var delta = event.originalEvent.wheelDelta ? event.originalEvent.wheelDelta / 40 : event.originalEvent.detail ? -event.originalEvent.detail : 0;
        camera.position[2] -= delta * 0.5;
    };

    var getImageDataURL = function() {
        return $canvas[0].toDataURL('image/jpeg');
    };

    var updateRenderSettings = function(options) {
        renderSettings = $.extend({}, renderSettings, options);
    };

    var bindEventListeners = function() {
        $canvas.on('mousedown', handleMouseDown);
        $canvas.on('mouseup', handleMouseUp);
        $canvas.on('mousemove', handleMouseMove);
        $canvas.bind('mousewheel DOMMouseScroll', handleMouseWheel);
    };

    var loadFromFile = function(str) {
        MoleculeLoader.parsePDBFile(str);
        setupMolecule();
        requestRedraw();
    };

    var download = function(pdbID) {
        return MoleculeLoader.download(pdbID).done(function() {
            setupMolecule();
            requestRedraw();
        });
    };

    var getProtein = function() {
        return MoleculeLoader.getMolecule().protein;
    };

    var initGL = function() {
        gl.clearColor(1.0, 1.0, 1.0, 1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.enable(gl.CULL_FACE);
        gl.frontFace(gl.CCW);
        gl.depthMask(true);
        gl.clearDepth(1);
        gl.disable(gl.BLEND);
    };

    var initExtentions = function() {
        exts.fragDepth = gl.getExtension('EXT_frag_depth');
        exts.drawBuffers = gl.getExtension('WEBGL_draw_buffers');
        exts.textureFloat = gl.getExtension('OES_texture_float');
        exts.textureFloatLinear = gl.getExtension('OES_texture_float_linear');
        exts.depthTexture = gl.getExtension('WEBGL_depth_texture');
        //gl.getExtension('WEBGL_color_buffer_float');

        return exts.fragDepth && exts.drawBuffers && exts.textureFloat && exts.textureFloatLinear && exts.depthTexture;
    };

    var resize = function(width, height) {
        requestRedraw();

        $canvas[0].width = width;
        $canvas[0].height = height;

        settings.width = width;
        settings.height = height;

        DeferredRenderer.resize(width, height);

        gl.viewport(0, 0, width, height);

        mat4.perspective(camera.pMatrix, 45, width / height, 1.0, 1000.0);
    };

    var init = function(options) {
        settings = $.extend({}, settings, options);
        $canvas = $(settings.canvas);

        gl = $canvas[0].getContext('experimental-webgl', {
            preserveDrawingBuffer: true
        });

        if (!gl || !initExtentions()) {
            return $.Deferred().reject('Could not initialise WebGL.');
        }

        initGL();
        initBasePlane();
        bindEventListeners();

        ShaderLoader.init(gl);

        var initPromises = [];

        initPromises.push(
            DeferredRenderer.init(gl, exts, {
                width: settings.width,
                height: settings.height
            }),
            GridRenderer.init(gl),
            MoleculeRenderer.init(gl)
        );

        return $.when.apply($, initPromises).done(function() {
            resize(settings.width, settings.height);
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
        picking: picking
    };
})(jQuery, DeferredRenderer, ShaderLoader, MoleculeLoader, MoleculeRenderer, GridRenderer, Utilities);
