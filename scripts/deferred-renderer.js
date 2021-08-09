/*global vec3, mat4, GBuffer, ShaderLoader*/

let DeferredRenderer = (function (GBuffer, ShaderLoader) {
    "use strict";

    let gl;

    let quadVertexPositionBuffer;
    let quadVertexIndexBuffer;

    let occludersTexture;
    let occludersTextureWidth;
    let occludersTextureHeight;

    let initQuad = function () {
        let vertices = [-1.0, -1.0, 0.0, 1.0, -1.0, 0.0, 1.0, 1.0, 0.0, -1.0, 1.0, 0.0];
        let indices = [0, 1, 2, 0, 2, 3];

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

    let calcOccluders = function (atoms, grid) {
        let maxOccludersPerAtom = 64; // also need to change constant in shader
        let sphereOccluders = [];

        // get occluder atoms for each sphere
        // only taking into account spheres in current and neighbouring grid cells

        for (let i = 0; i < atoms.length; i++) {
            let atomPos = atoms[i].position;
            let index3D = grid.getObjectGridIndex3D(atomPos);
            let proximateAtoms = [];

            for (let x = -1; x < 2; x++) {
                for (let y = -1; y < 2; y++) {
                    for (let z = -1; z < 2; z++) {
                        let cellX = index3D[0] + x;
                        let cellY = index3D[1] + y;
                        let cellZ = index3D[2] + z;

                        if (
                            cellX >= 0 &&
                            cellY >= 0 &&
                            cellZ >= 0 &&
                            cellX < grid.numBoxesX &&
                            cellY < grid.numBoxesY &&
                            cellZ < grid.numBoxesZ
                        ) {
                            let index = parseInt(
                                cellZ * grid.numBoxesX * grid.numBoxesY + cellY * grid.numBoxesX + cellX
                            );

                            if (grid.cells[index] === undefined) {
                                continue;
                            }

                            for (let j = 0; j < grid.cells[index].length; j++) {
                                proximateAtoms.push(grid.cells[index][j]);
                            }
                        }
                    }
                }
            }

            sphereOccluders[i] = [];

            for (let j = 0; j < proximateAtoms.length; j++) {
                let aid = proximateAtoms[j];

                if (i === aid) {
                    continue;
                }

                let occluderPos = atoms[aid].position;
                let dir = vec3.create();

                vec3.subtract(dir, atomPos, occluderPos);
                let dist = vec3.squaredLength(dir);

                // the ao technique dosen't handle spheres very close to
                // other spheres very well
                //if (dist < atoms[aid].radius) {
                //continue;
                //}

                let occluderAtom = {
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
        let sortOccluders = function (a, b) {
            return a.dist - b.dist;
        };

        for (let i = 0; i < sphereOccluders.length; i++) {
            sphereOccluders[i].sort(sortOccluders);
        }

        // if webgl supported single channel floating point textures
        // then should just store the lookup id, and have a separate texture for atom positions
        // have to wait for webgl 2 for that

        let texWidth = 2048;
        let texHeight = parseInt((atoms.length + texWidth - 1) / texWidth);
        let occluderTexHeight = texHeight * maxOccludersPerAtom;

        let occluderData = new Float32Array(texWidth * occluderTexHeight * 4);

        let id = 0;

        for (let i = 0, heightOffset = 0; i < texHeight; i++, heightOffset += maxOccludersPerAtom) {
            for (let j = 0; j < texWidth; j++) {
                if (id < atoms.length) {
                    for (let k = 0; k < sphereOccluders[id].length; k++) {
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

    let initLightPassShader = function (program) {
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

    let initGeometryPassShader = function (program) {
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

    let loadShaders = function () {
        let promises = [];
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
        return Promise.all(promises);
    };

    let renderLightPass = function (camera, light, mMatrix, settings) {
        let lightPosViewSpace = vec3.create();
        vec3.transformMat4(lightPosViewSpace, light.position, camera.vMatrix);

        let mvMatrix = mat4.create();
        mat4.multiply(mvMatrix, camera.vMatrix, mMatrix);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST);

        let shader = ShaderLoader.getShader("light-pass");

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

    let beginGeometryPass = function () {
        GBuffer.bindGeometryPass();

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
    };

    let endGeometryPass = function () {
        GBuffer.unbindGeometryPass();
    };

    let resize = function (width, height) {
        GBuffer.resize(width, height);
    };

    let init = function (ctx, exts, options) {
        gl = ctx;

        GBuffer.init(gl, exts, {
            width: options.width,
            height: options.height,
        });

        initQuad();
        return loadShaders();
    };

    return {
        init: init,
        resize: resize,
        calcOccluders: calcOccluders,
        beginGeometryPass: beginGeometryPass,
        endGeometryPass: endGeometryPass,
        renderLightPass: renderLightPass,
    };
})(GBuffer, ShaderLoader);
