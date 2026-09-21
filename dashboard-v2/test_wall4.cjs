const ClipperLib = require('clipper-lib');
const THREE = require('three');

// Simple square (outer contour)
const outer = new THREE.Shape();
outer.moveTo(0, 0);
outer.lineTo(100, 0);
outer.lineTo(100, 100);
outer.lineTo(0, 100);
// Hole
const inner = new THREE.Path();
inner.moveTo(25, 25);
inner.lineTo(75, 25);
inner.lineTo(75, 75);
inner.lineTo(25, 75);
outer.holes.push(inner);

// Let's run the exact same logic
const scaleFactor = 1000;
const subjPaths = [];

function addThreePath(path, isHole) {
    const pts = path.getPoints();
    if (pts.length < 3) return;
    const cPath = pts.map(p => ({X: Math.round(p.x * scaleFactor), Y: Math.round(p.y * scaleFactor)}));
    if (ClipperLib.Clipper.Orientation(cPath) === isHole) {
        cPath.reverse();
    }
    subjPaths.push(cPath);
}

addThreePath(outer, false);
outer.holes.forEach(h => addThreePath(h, true));

// parede = 2, scale = 1.0
const paredeNoSVG = 2;

const co = new ClipperLib.ClipperOffset();
co.AddPaths(subjPaths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
const airPaths = new ClipperLib.Paths();
co.Execute(airPaths, -paredeNoSVG * scaleFactor);

console.log("subjPaths:", subjPaths.length);
console.log("airPaths:", airPaths.length);

const c = new ClipperLib.Clipper();
c.AddPaths(subjPaths, ClipperLib.PolyType.ptSubject, true);
c.AddPaths(airPaths, ClipperLib.PolyType.ptClip, true);

const solutionTree = new ClipperLib.PolyTree();
c.Execute(ClipperLib.ClipType.ctDifference, solutionTree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);

console.log("Solution top level children:", solutionTree.Childs().length);

solutionTree.Childs().forEach(c => console.log(c.IsHole(), c.Childs().length));
solutionTree.Childs()[0].Childs().forEach(c => console.log(c.IsHole(), c.Childs().length));