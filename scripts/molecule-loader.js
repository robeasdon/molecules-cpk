/*global vec3*/

var MoleculeLoader = (function () {
    "use strict";

    var atoms = [];
    var protein = {
        pdbID: "",
        title: "",
    };

    var VDWList = {
        AG: 1.72,
        AR: 1.85,
        AS: 1.85,
        AU: 1.66,
        BR: 1.85,
        C: 1.7,
        CD: 1.58,
        CL: 1.75,
        CU: 1.4,
        F: 1.47,
        FE: 1.47,
        GA: 1.87,
        H: 1.2,
        HE: 1.4,
        HG: 1.55,
        I: 1.98,
        IN: 1.93,
        K: 2.75,
        KR: 2.02,
        LI: 1.82,
        MG: 1.73,
        N: 1.55,
        NA: 2.27,
        NE: 1.54,
        NI: 1.63,
        O: 1.52,
        P: 1.8,
        PB: 2.02,
        PD: 1.63,
        PT: 1.72,
        S: 1.8,
        SE: 1.9,
        SI: 2.1,
        SN: 2.17,
        TE: 2.06,
        TL: 1.96,
        U: 1.86,
        XE: 2.16,
        ZN: 1.39,
    };

    var lightGrey = [200.0 / 255.0, 200.0 / 255.0, 200.0 / 255.0];
    var red = [240.0 / 255.0, 0.0, 0.0];
    var white = [255.0 / 255.0, 255.0 / 255.0, 255.0 / 255.0];
    var lightBlue = [143.0 / 255.0, 143.0 / 255.0, 255.0 / 255.0];
    var yellow = [255.0 / 255.0, 200.0 / 255.0, 50.0 / 255.0];
    var orange = [255.0 / 255.0, 165.0 / 255.0, 0.0];
    var green = [0.0, 255.0 / 255.0, 0.0];
    var brown = [165.0 / 255.0, 42.0 / 255.0, 42.0 / 255.0];
    var blue = [0.0, 0.0, 255.0 / 255.0];
    var darkGreen = [42.0 / 255.0, 128.0 / 255.0, 42.0 / 255.0];
    var darkGrey = [128.0 / 255.0, 128.0 / 255.0, 128.0 / 255.0];
    var deepPink = [255.0 / 255.0, 20.0 / 255.0, 147.0 / 255.0];

    var colours = {
        C: lightGrey,
        O: red,
        H: white,
        N: lightBlue,
        S: yellow,
        P: orange,
        CL: green,
        BR: brown,
        ZN: brown,
        NA: blue,
        FE: orange,
        F: orange,
        MG: darkGreen,
        CA: darkGrey,
        UNKNOWN: deepPink,
    };

    var parsePDBFile = function (str) {
        var lines = str.split("\n");

        // clear any previous molecule data
        atoms.length = 0;

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i]; //.replace(/^\s*/, ''); // remove indent

            var recordName = line.substr(0, 6).trim();

            if (recordName === "ATOM" || recordName === "HETATM") {
                var serial = parseInt(line.substr(6, 5).trim());
                var atomType = line.substr(12, 4).trim();
                var resName = line.substr(17, 3).trim();
                var chainID = line.substr(21, 1).trim();
                var residue = parseInt(line.substr(22, 5).trim());
                var x = parseFloat(line.substr(30, 8).trim());
                var y = parseFloat(line.substr(38, 8).trim());
                var z = parseFloat(line.substr(46, 8).trim());
                var rad = parseFloat(line.substr(60, 8).trim());
                var element = line.substr(76, 2).trim();

                if (element === "") {
                    element = atomType;
                }

                var hetFlag = false;
                if (line[0] === "H") {
                    hetFlag = true;
                }

                var radVDW = VDWList[element];
                var col = colours[element];

                if (col === undefined) {
                    col = [0.5, 0.5, 0.5];
                }

                if (rad === undefined) {
                    rad = 1;
                }

                var atom = {
                    serial: serial,
                    atom: atomType,
                    resName: resName,
                    chainID: chainID,
                    residue: residue,
                    position: vec3.fromValues(x, y, z),
                    radius: radVDW,
                    element: element,
                    colourCPK: col,
                    colour: col,
                    hetFlag: hetFlag,
                    selected: false,
                };

                atoms.push(atom);
            } else if (recordName === "HEADER") {
                protein.pdbID = line.substr(62, 4);
            } else if (recordName === "TITLE") {
                protein.title = line.substr(10, 70);
            }
        }
    };

    var download = function (pdbID) {
        protein.pdbID = pdbID.toUpperCase();

        if (!protein.pdbID.match(/^[1-9][A-Za-z0-9]{3}$/)) {
            alert("Invalid PDB ID");
            return Promise.reject("Invalid PDB ID");
        }

        var url = "https://files.rcsb.org/view/" + protein.pdbID + ".pdb";

        return fetch(url)
            .then(function (response) {
                return response.text();
            })
            .then(function (text) {
                parsePDBFile(text);
            });
    };

    var centerMoleculeOnMidPoint = function (midPoint) {
        for (var i = 0; i < atoms.length; i++) {
            vec3.subtract(atoms[i].position, atoms[i].position, midPoint);
        }
    };

    var getMidPoint = function () {
        var middle = vec3.create();

        for (var i = 0; i < atoms.length; i++) {
            vec3.add(middle, middle, atoms[i].position);
        }

        vec3.divide(middle, middle, vec3.fromValues(atoms.length, atoms.length, atoms.length));

        return middle;
    };

    var getFurthestDistanceToMidPoint = function (midPoint) {
        var maxDistance = 0;

        for (var i = 0; i < atoms.length; i++) {
            var dir = vec3.create();
            vec3.subtract(dir, midPoint, atoms[i].position);

            var dist = vec3.length(dir);

            if (dist > maxDistance) {
                maxDistance = dist;
            }
        }

        return maxDistance;
    };

    var getBoundingBox = function () {
        var firstPos = atoms[0].position;
        var firstRad = atoms[0].radius;

        var min = vec3.create();
        min[0] = firstPos[0] - firstRad;
        min[1] = firstPos[1] - firstRad;
        min[2] = firstPos[2] - firstRad;

        var max = vec3.create();
        max[0] = firstPos[0] + firstRad;
        max[1] = firstPos[1] + firstRad;
        max[2] = firstPos[2] + firstRad;

        for (var i = 1; i < atoms.length; i++) {
            var pos = atoms[i].position;
            var rad = atoms[i].radius;

            if (pos[0] - rad < min[0]) {
                min[0] = pos[0] - rad;
            } else if (pos[0] + rad > max[0]) {
                max[0] = pos[0] + rad;
            }

            if (pos[1] - rad < min[1]) {
                min[1] = pos[1] - rad;
            } else if (pos[1] + rad > max[1]) {
                max[1] = pos[1] + rad;
            }

            if (pos[2] - rad < min[2]) {
                min[2] = pos[2] - rad;
            } else if (pos[2] + rad > max[2]) {
                max[2] = pos[2] + rad;
            }
        }

        return {
            min: min,
            max: max,
        };
    };

    var getMaxRadius = function () {
        var max = atoms[0].radius;
        for (var i = 1; i < atoms.length; i++) {
            if (atoms[i].radius > max) {
                max = atoms[i].radius;
            }
        }
        return max;
    };

    var getMolecule = function () {
        return {
            atoms: atoms,
            protein: protein,
        };
    };

    return {
        download: download,
        parsePDBFile: parsePDBFile,
        getMolecule: getMolecule,
        centerMoleculeOnMidPoint: centerMoleculeOnMidPoint,
        getBoundingBox: getBoundingBox,
        getMaxRadius: getMaxRadius,
        getMidPoint: getMidPoint,
        getFurthestDistanceToMidPoint: getFurthestDistanceToMidPoint,
    };
})();
