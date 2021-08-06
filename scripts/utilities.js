/*global vec2, vec3, vec4*/

let Utilities = (function () {
    "use strict";

    let utils = {};

    utils.getEyeRay = function (eye, matrix, x, y) {
        let ray = vec4.create();
        vec4.transformMat4(ray, vec4.fromValues(x, y, 0, 1), matrix);

        let w = ray[3];
        let xnew = ray[0] / w;
        let ynew = ray[1] / w;
        let znew = ray[2] / w;
        let newRay = vec3.fromValues(xnew, ynew, znew);

        let finalRay = vec3.create();
        vec3.subtract(finalRay, newRay, eye);

        return finalRay;
    };

    utils.intersectRaySphere = function (origin, ray, center, radius) {
        let toSphere = vec3.create();
        vec3.subtract(toSphere, origin, center);
        let a = vec3.dot(ray, ray);
        let b = 2 * vec3.dot(toSphere, ray);
        let c = vec3.dot(toSphere, toSphere) - radius * radius;
        let disc = b * b - 4 * a * c;

        if (disc > 0) {
            let t = (-b - Math.sqrt(disc)) / (2 * a);
            
            if (t > 0) {
                return t;
            }
        }

        return Number.MAX_VALUE;
    };

    utils.intersectRayAABB = function (ro, rd, gridMin, gridMax) {
        let invR = vec3.create();
        invR[0] = 1 / rd[0];
        invR[1] = 1 / rd[1];
        invR[2] = 1 / rd[2];

        let tbot = vec3.create();
        vec3.subtract(tbot, gridMin, ro);
        vec3.multiply(tbot, tbot, invR);

        let ttop = vec3.create();
        vec3.subtract(ttop, gridMax, ro);
        vec3.multiply(ttop, ttop, invR);

        let tmin = vec3.create();
        tmin[0] = Math.min(ttop[0], tbot[0]);
        tmin[1] = Math.min(ttop[1], tbot[1]);
        tmin[2] = Math.min(ttop[2], tbot[2]);

        let tmax = vec3.create();
        tmax[0] = Math.max(ttop[0], tbot[0]);
        tmax[1] = Math.max(ttop[1], tbot[1]);
        tmax[2] = Math.max(ttop[2], tbot[2]);

        let t = vec2.create();
        t[0] = Math.max(tmin[0], tmin[1]);
        t[1] = Math.max(tmin[0], tmin[2]);

        let t0 = Math.max(t[0], t[1]);

        t[0] = Math.min(tmax[0], tmax[1]);
        t[1] = Math.min(tmax[0], tmax[2]);

        let t1 = Math.min(t[0], t[1]);

        return {
            t0: t0,
            t1: t1,
            hit: t0 <= t1,
        };
    };

    utils.sqDistPointAABB = function (p, min, max) {
        let sqDist = 0;
        let v = p[0];

        if (v < min[0]) {
            sqDist += (min[0] - v) * (min[0] - v);
        }

        if (v > max[0]) {
            sqDist += (v - max[0]) * (v - max[0]);
        }

        v = p[1];

        if (v < min[1]) {
            sqDist += (min[1] - v) * (min[1] - v);
        }

        if (v > max[1]) {
            sqDist += (v - max[1]) * (v - max[1]);
        }

        v = p[2];

        if (v < min[2]) {
            sqDist += (min[2] - v) * (min[2] - v);
        }

        if (v > max[2]) {
            sqDist += (v - max[2]) * (v - max[2]);
        }

        return sqDist;
    };

    utils.intersectSphereAABB = function (center, radius, min, max) {
        let sqDist = utils.sqDistPointAABB(center, min, max);
        return sqDist <= radius * radius;
    };

    utils.toLocal = function (p, matrix) {
        let a = matrix[0],
            b = matrix[1],
            c = matrix[2],
            d = matrix[4],
            e = matrix[5],
            f = matrix[6],
            g = matrix[8],
            h = matrix[9],
            j = matrix[10],
            k = matrix[12],
            l = matrix[13],
            m = matrix[14];

        let newP = vec3.create();
        newP[0] = a * p[0] + b * p[1] + c * p[2] + (a * -k + b * -l + c * -m);
        newP[1] = d * p[0] + e * p[1] + f * p[2] + (d * -k + e * -l + f * -m);
        newP[2] = g * p[0] + h * p[1] + j * p[2] + (g * -k + h * -l + j * -m);

        return newP;
    };

    utils.degToRad = function (degrees) {
        return (degrees * Math.PI) / 180;
    };

    return utils;
})();
