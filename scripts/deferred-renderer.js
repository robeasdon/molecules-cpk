/*global jQuery, vec3, mat4, GBuffer, ShaderLoader, Utilities*/

var DeferredRenderer = (function ($, GBuffer, ShaderLoader, Utilities) {
    "use strict";

    var gl;

    var quadVertexPositionBuffer;
    var quadVertexIndexBuffer;

    var occludersTexture;
    var occludersTextureWidth;
    var occludersTextureHeight;

    var initQuad = function () {
        var vertices = [-1.0, -1.0, 0.0, 1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, 1.0, 0.0];
        var indices = [0, 1, 2, 0, 2, 3];

        quadVertexPositionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quadVertexPositionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        quadVertexPositionBuffer.itemSize = 3;
        quadVertexPositionBuffer.numItems = vertices.length / 3;

        quadVertexIndexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadVertexIndexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
        quadVertexIndexBuffer.itemSize = 1;
        quadVertexIndexBuffer.numItems = indices.length;
    };

    var calcOccluders = function (atoms, grid) {
        var maxOccludersPerAtom = 16; // also need to change constant in shader
        var sphereOccluders = [];

        // get occluder atoms for each sphere
        // only taking into account spheres in current and neighbouring grid cells

        for (var i = 0; i < atoms.length; i++) {
            var atomPos = atoms[i].position;
            var index3D = grid.getObjectGridIndex3D(atomPos);
            var proximateAtoms = [];

            for (var x = -1; x < 2; x++) {
                for (var y = -1; y < 2; y++) {
                    for (var z = -1; z < 2; z++) {
                        var cellX = index3D[0] + x;
                        var cellY = index3D[1] + y;
                        var cellZ = index3D[2] + z;

                        if (
                            cellX >= 0 &&
                            cellY >= 0 &&
                            cellZ >= 0 &&
                            cellX < grid.numBoxesX &&
                            cellY < grid.numBoxesY &&
                            cellZ < grid.numBoxesZ
                        ) {
                            var index = parseInt(
                                cellZ * grid.numBoxesX * grid.numBoxesY + cellY * grid.numBoxesX + cellX
                            );

                            if (grid.cells[index] === undefined) {
                                continue;
                            }

                            for (var j = 0; j < grid.cells[index].length; j++) {
                                proximateAtoms.push(grid.cells[index][j]);
                            }
                        }
                    }
                }
            }

            sphereOccluders[i] = [];

            for (var j = 0; j < proximateAtoms.length; j++) {
                var aid = proximateAtoms[j];

                if (i === aid) {
                    continue;
                }

                var occluderPos = atoms[aid].position;
                var dir = vec3.create();

                vec3.subtract(dir, atomPos, occluderPos);
                var dist = vec3.squaredLength(dir);

                // the ao technique dosen't handle spheres very close to
                // other spheres very well
                //if (dist < atoms[aid].radius) {
                //continue;
                //}

                var occluderAtom = {
                    id: aid,
                    dist: dist,
                    position: occluderPos,
                    radius: atoms[aid].radius,
                };

                sphereOccluders[i].push(occluderAtom);
            }
        }

        // sort the occluders by distance, closest first
        // add the closest occluders to the atoms array for each atom
        var sortOccluders = function (a, b) {
            return a.dist - b.dist;
        };

        for (var i = 0; i < sphereOccluders.length; i++) {
            sphereOccluders[i].sort(sortOccluders);
        }

        // if webgl supported single channel floating point textures
        // then should just store the lookup id, and have a separate texture for atom positions
        // have to wait for webgl 2 for that

        var texWidth = 2048;
        var texHeight = parseInt((atoms.length + texWidth - 1) / texWidth);
        var occluderTexHeight = texHeight * maxOccludersPerAtom;

        var occluderData = new Float32Array(texWidth * occluderTexHeight * 4);

        var id = 0;

        for (var i = 0, heightOffset = 0; i < texHeight; i++, heightOffset += maxOccludersPerAtom) {
            for (var j = 0; j < texWidth; j++) {
                if (id < atoms.length) {
                    for (var k = 0; k < sphereOccluders[id].length; k++) {
                        if (k < maxOccludersPerAtom) {
                            occluderData[j * 4 + 0 + (heightOffset + k) * 4 * texWidth] =
                                sphereOccluders[id][k].position[0];
                            occluderData[j * 4 + 1 + (heightOffset + k) * 4 * texWidth] =
                                sphereOccluders[id][k].position[1];
                            occluderData[j * 4 + 2 + (heightOffset + k) * 4 * texWidth] =
                                sphereOccluders[id][k].position[2];
                            occluderData[j * 4 + 3 + (heightOffset + k) * 4 * texWidth] = sphereOccluders[id][k].radius;
                        }
                    }
                }
                
                id++;
            }
        }

        occludersTextureWidth = texWidth;
        occludersTextureHeight = occluderTexHeight;

        occludersTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, occludersTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, texWidth, occluderTexHeight, 0, gl.RGBA, gl.FLOAT, occluderData);
        gl.bindTexture(gl.TEXTURE_2D, null);
    };

    var initLightPassShader = function (program) {
        // attributes

        program.vertexPositionAttribute = gl.getAttribLocation(program, "aPosition");
        gl.enableVertexAttribArray(program.vertexPositionAttribute);

        // uniforms

        program.mMatrixUniform = gl.getUniformLocation(program, "uModelMatrix");
        program.vMatrixUniform = gl.getUniformLocation(program, "uViewMatrix");
        program.pMatrixUniform = gl.getUniformLocation(program, "uProjectionMatrix");
        program.mvMatrixUniform = gl.getUniformLocation(program, "uModelViewMatrix");
        program.lightPosUniform = gl.getUniformLocation(program, "uLightPos");
        program.depthTextureUniform = gl.getUniformLocation(program, "uDepthTexture");
        program.normalTextureUniform = gl.getUniformLocation(program, "uNormalTexture");
        program.positionTextureUniform = gl.getUniformLocation(program, "uPositionTexture");
        program.colorTextureUniform = gl.getUniformLocation(program, "uColorTexture");
        program.occludersTextureUniform = gl.getUniformLocation(program, "uOccludersTexture");
        program.occludersTextureSizeUniform = gl.getUniformLocation(program, "uOccludersTextureSize");
        program.renderModeUniform = gl.getUniformLocation(program, "uRenderMode");
        program.aoIntensityLocation = gl.getUniformLocation(program, "uAOIntensity");

        return program;
    };

    var initGeometryPassShader = function (program) {
        // attributes

        program.vertexPositionAttribute = gl.getAttribLocation(program, "aPosition");
        gl.enableVertexAttribArray(program.vertexPositionAttribute);

        // uniforms

        program.colourUniform = gl.getUniformLocation(program, "uColour");
        program.mMatrixUniform = gl.getUniformLocation(program, "uModelMatrix");
        program.vMatrixUniform = gl.getUniformLocation(program, "uViewMatrix");
        program.pMatrixUniform = gl.getUniformLocation(program, "uProjectionMatrix");

        return program;
    };

    var loadShaders = function () {
        var promises = [];
        promises.push(
            ShaderLoader.loadProgram(
                "geom-pass",
                "shaders/geom-pass.vert",
                "shaders/geom-pass.frag",
                initGeometryPassShader
            )
        );
        promises.push(
            ShaderLoader.loadProgram(
                "light-pass",
                "shaders/light-pass.vert",
                "shaders/light-pass.frag",
                initLightPassShader
            )
        );
        return $.when.apply($, promises);
    };

    var renderLightPass = function (camera, light, mMatrix, settings) {
        var lightPosViewSpace = vec3.create();
        vec3.transformMat4(lightPosViewSpace, light.position, camera.vMatrix);

        var mvMatrix = mat4.create();
        mat4.multiply(mvMatrix, camera.vMatrix, mMatrix);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST);

        var shader = ShaderLoader.getShader("light-pass");

        gl.useProgram(shader);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, GBuffer.getDepthTexture());
        gl.uniform1i(shader.depthTextureUniform, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, GBuffer.getNormalTexture());
        gl.uniform1i(shader.normalTextureUniform, 1);

        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, GBuffer.getPositionTexture());
        gl.uniform1i(shader.positionTextureUniform, 2);

        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, GBuffer.getColorTexture());
        gl.uniform1i(shader.colorTextureUniform, 3);

        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, occludersTexture);
        gl.uniform1i(shader.occludersTextureUniform, 4);

        gl.uniform2f(shader.occludersTextureSizeUniform, occludersTextureWidth, occludersTextureHeight);
        gl.uniform3f(shader.lightPosUniform, lightPosViewSpace[0], lightPosViewSpace[1], lightPosViewSpace[2]);
        gl.uniformMatrix4fv(shader.mMatrixUniform, false, mMatrix);
        gl.uniformMatrix4fv(shader.vMatrixUniform, false, camera.vMatrix);
        gl.uniformMatrix4fv(shader.mvMatrixUniform, false, mvMatrix);
        gl.uniform1i(shader.renderModeUniform, settings.mode);
        gl.uniform1f(shader.aoIntensityLocation, settings.aoIntensity);

        gl.bindBuffer(gl.ARRAY_BUFFER, quadVertexPositionBuffer);
        gl.vertexAttribPointer(
            shader.vertexPositionAttribute,
            quadVertexPositionBuffer.itemSize,
            gl.FLOAT,
            false,
            0,
            0
        );

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadVertexIndexBuffer);

        gl.drawElements(gl.TRIANGLES, quadVertexIndexBuffer.numItems, gl.UNSIGNED_SHORT, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(null);
    };

    var beginGeometryPass = function () {
        GBuffer.bindGeometryPass();

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
    };

    var endGeometryPass = function () {
        GBuffer.unbindGeometryPass();
    };

    var resize = function (width, height) {
        GBuffer.resize(width, height);
    };

    var init = function (ctx, exts, options) {
        gl = ctx;

        GBuffer.init(gl, exts, {
            width: options.width,
            height: options.height,
        });

        initQuad();
        return $.when(loadShaders());
    };

    return {
        init: init,
        resize: resize,
        calcOccluders: calcOccluders,
        beginGeometryPass: beginGeometryPass,
        endGeometryPass: endGeometryPass,
        renderLightPass: renderLightPass,
    };
})(jQuery, GBuffer, ShaderLoader, Utilities);
