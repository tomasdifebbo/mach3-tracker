const ClipperLib = require('clipper-lib');
const scale = 1000;

// Example points
const poly = [{X:0,Y:0}, {X:10,Y:0}, {X:10,Y:10}, {X:0,Y:10}];
poly.forEach(p => { p.X *= scale; p.Y *= scale; });

const co = new ClipperLib.ClipperOffset();
co.AddPath(poly, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);

const offsetPaths = new ClipperLib.Paths();
co.Execute(offsetPaths, -2 * scale); // inward offset by 2

console.log('Resulting paths:', offsetPaths.length);
if (offsetPaths.length > 0) {
    const res = offsetPaths[0];
    res.forEach(p => { p.X /= scale; p.Y /= scale; });
    console.log(res);
}
