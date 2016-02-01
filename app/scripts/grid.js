/*global vec3*/

function Grid () {
    'use strict';

    this.min = vec3.create();
    this.max = vec3.create();
    this.cellSize = 0;
    this.numBoxesX = 0;
    this.numBoxesY = 0;
    this.numBoxesZ = 0;
    this.cells = [];

    this.init = function(min, max, cellSize) {
        this.min = min;
        this.max = max;
        this.cellSize = cellSize;

        var width = this.max[0] - this.min[0];
        var height = this.max[1] - this.min[1];
        var depth = this.max[2] - this.min[2];

        var w = Math.ceil(width / this.cellSize) * this.cellSize;
        var h = Math.ceil(height / this.cellSize) * this.cellSize;
        var d = Math.ceil(depth / this.cellSize) * this.cellSize;

        this.numBoxesX = parseInt(w / this.cellSize);
        this.numBoxesY = parseInt(h / this.cellSize);
        this.numBoxesZ = parseInt(d / this.cellSize);
    };

    this.getObjectGridIndex3D = function(pos) {
        var indexX = parseInt((pos[0] - this.min[0]) / this.cellSize);
        var indexY = parseInt((pos[1] - this.min[1]) / this.cellSize);
        var indexZ = parseInt((pos[2] - this.min[2]) / this.cellSize);

        return [indexX, indexY, indexZ];
    };

    this.getObjectGridIndex1D = function(pos) {
        var index = this.getObjectGridIndex3D(pos);

        return parseInt((index[2] * this.numBoxesX * this.numBoxesY) +
            (index[1] * this.numBoxesX) + index[0]);
    };

    this.insideGrid = function(x, y, z) {
        return ((x >= 0) && (y >= 0) && (z >= 0)) &&
            ((x < this.numBoxesX) && (y < this.numBoxesY) && (z < this.numBoxesZ));
    };

    this.getCellMinPoint = function(x, y, z) {
        var cellBoundsMin = vec3.create();

        cellBoundsMin[0] = (x * this.cellSize) + this.min[0];
        cellBoundsMin[1] = (y * this.cellSize) + this.min[1];
        cellBoundsMin[2] = (z * this.cellSize) + this.min[2];

        return cellBoundsMin;
    };

    this.getCellMaxPoint = function(x, y, z) {
        var cellBoundsMax = vec3.create();

        cellBoundsMax[0] = ((x + 1) * this.cellSize) + this.min[0];
        cellBoundsMax[1] = ((y + 1) * this.cellSize) + this.min[1];
        cellBoundsMax[2] = ((z + 1) * this.cellSize) + this.min[2];

        return cellBoundsMax;
    };
}
