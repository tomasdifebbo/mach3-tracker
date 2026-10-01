const clipperLibModule = require('clipper-lib');
const ClipperLib = clipperLibModule.default || clipperLibModule || window.ClipperLib;

const subjPaths = [
  [{X: 0, Y: 0}, {X: 100, Y: 0}, {X: 100, Y: 20}, {X: 0, Y: 20}],
  [{X: 80, Y: 0}, {X: 180, Y: 0}, {X: 180, Y: 20}, {X: 80, Y: 20}]
];

const cUnion = new ClipperLib.Clipper();
cUnion.AddPaths(subjPaths, ClipperLib.PolyType.ptSubject, true);
const unifiedPaths = new ClipperLib.Paths();
cUnion.Execute(ClipperLib.ClipType.ctUnion, unifiedPaths, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero);

const co = new ClipperLib.ClipperOffset();
co.AddPaths(unifiedPaths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
const airPaths = new ClipperLib.Paths();
co.Execute(airPaths, -2);

const c = new ClipperLib.Clipper();
c.AddPaths(unifiedPaths, ClipperLib.PolyType.ptSubject, true);
c.AddPaths(airPaths, ClipperLib.PolyType.ptClip, true);
const solutionTree = new ClipperLib.PolyTree();
c.Execute(ClipperLib.ClipType.ctDifference, solutionTree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);

console.log('Unified Paths:', unifiedPaths.length);
console.log('Air Paths:', airPaths.length);
console.log('Solution Tree Childs (Outer boundaries):', solutionTree.Childs().length);
if (solutionTree.Childs().length > 0) {
  console.log('Solution Tree Holes:', solutionTree.Childs()[0].Childs().length);
}
