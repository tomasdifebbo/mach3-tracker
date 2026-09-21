const ClipperLib = require('clipper-lib');
const THREE = require('three');

function createHollowWalls(threeShape, wallThickness) {
    const scale = 1000;
    
    // 1. Extract paths from THREE.Shape
    const subjPaths = [];
    
    function addThreePath(path, isHole) {
        const pts = path.getPoints();
        const cPath = pts.map(p => ({X: Math.round(p.x * scale), Y: Math.round(p.y * scale)}));
        if (ClipperLib.Clipper.Orientation(cPath) === isHole) {
            cPath.reverse(); // Ensure standard orientation
        }
        subjPaths.push(cPath);
    }
    
    addThreePath(threeShape, false);
    threeShape.holes.forEach(h => addThreePath(h, true));
    
    // 2. Offset inward to create Air paths
    const co = new ClipperLib.ClipperOffset();
    co.AddPaths(subjPaths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    const airPaths = new ClipperLib.Paths();
    co.Execute(airPaths, -wallThickness * scale);
    
    // 3. Subtract Air from Subject to get Walls
    const c = new ClipperLib.Clipper();
    c.AddPaths(subjPaths, ClipperLib.PolyType.ptSubject, true);
    c.AddPaths(airPaths, ClipperLib.PolyType.ptClip, true);
    
    const solutionTree = new ClipperLib.PolyTree();
    c.Execute(ClipperLib.ClipType.ctDifference, solutionTree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
    
    // 4. Convert PolyTree to THREE.Shape
    const outShapes = [];
    
    function parseNode(node) {
        if (!node.IsHole()) {
            // It's an outer contour
            if (node.Contour().length > 0) {
                const shape = new THREE.Shape();
                node.Contour().forEach((p, i) => {
                    const x = p.X / scale;
                    const y = p.Y / scale;
                    if (i === 0) shape.moveTo(x, y);
                    else shape.lineTo(x, y);
                });
                // Add holes
                node.Childs().forEach(child => {
                    if (child.Contour().length > 0) {
                        const hole = new THREE.Path();
                        child.Contour().forEach((p, i) => {
                            const x = p.X / scale;
                            const y = p.Y / scale;
                            if (i === 0) hole.moveTo(x, y);
                            else hole.lineTo(x, y);
                        });
                        shape.holes.push(hole);
                    }
                });
                outShapes.push(shape);
            }
        }
        
        // Traverse children
        node.Childs().forEach(child => {
            // If the child was a hole, its children are outer contours
            if (child.IsHole()) {
                child.Childs().forEach(grandchild => parseNode(grandchild));
            } else {
                parseNode(child);
            }
        });
    }
    
    // The top-level nodes of the tree are outer contours
    solutionTree.Childs().forEach(child => parseNode(child));
    
    return outShapes;
}

// Test with a Donut
const outer = new THREE.Shape();
outer.moveTo(0,0); outer.lineTo(100,0); outer.lineTo(100,100); outer.lineTo(0,100);
const inner = new THREE.Path();
inner.moveTo(20,20); inner.lineTo(80,20); inner.lineTo(80,80); inner.lineTo(20,80);
outer.holes.push(inner);

const walls = createHollowWalls(outer, 5);
console.log('Number of wall shapes:', walls.length);
walls.forEach((w, i) => {
    console.log(`Wall ${i} - points: ${w.getPoints().length}, holes: ${w.holes.length}`);
});
