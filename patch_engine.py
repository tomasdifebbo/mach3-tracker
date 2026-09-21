import re
import sys

with open(r'c:\DASHBOARD\dashboard-v2\src\utils\letraCaixaEngine.js', 'r', encoding='utf-8') as f:
    text = f.read()

start_idx = text.find('export function buildClientSideChannelLetter')
end_idx = text.find('export function exportModelToStlBlob')

if start_idx == -1 or end_idx == -1:
    print("Could not find function bounds!")
    sys.exit(1)

new_func = """export function buildClientSideChannelLetter(svgText, params) {
  const loader = new SVGLoader();
  const svgData = loader.parse(svgText);
  const group = new THREE.Group();

  const allShapes = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  svgData.paths.forEach((path) => {
    const shapes = path.toShapes();
    shapes.forEach((shape) => {
      const pts = shape.getPoints();
      if (pts.length < 3) return;
      pts.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      });
      allShapes.push(shape);
    });
  });

  const largura = parseFloat(params.largura) || 100;
  const altura = parseFloat(params.altura) || 100;
  const profundidade = parseFloat(params.profundidade) || 10;
  
  const parede = parseFloat(params.parede) || 2;
  const denteWidth = 3; // Dente fixo de 3mm inward
  const recuoFrente = parseFloat(params.recuoDente) || 0; // recuoDente na vdd eh recuoFrente
  const espAcr = parseFloat(params.espAcr) || 2;
  const recuoFundo = parseFloat(params.recuoFundo) || 0;
  const espFundo = parseFloat(params.espFundo) || 2;

  const origW = maxX - minX || 100;
  const origH = maxY - minY || 100;
  const scale = Math.min(largura / origW, altura / origH);

  const matCorpo = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8, metalness: 0.1 });
  const matFaceAcrilico = new THREE.MeshPhysicalMaterial({ color: 0x00aaff, transmission: 0.5, opacity: 0.8, transparent: true, roughness: 0.2 });
  const matFundoPVC = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });

  const scaleFactor = 1000;

  function generateOffsetShapes(shapesArray, offsetMm) {
      if (offsetMm === 0) return shapesArray;
      const offsetInClipper = offsetMm / scale;
      const subjPaths = [];

      function addThreePath(path, isHole) {
          const pts = path.getPoints();
          if (pts.length < 3) return;
          const cPath = pts.map(p => ({X: Math.round(p.x * scaleFactor), Y: Math.round(p.y * scaleFactor)}));
          if (ClipperLib.Clipper.Orientation(cPath) === isHole) cPath.reverse();
          subjPaths.push(cPath);
      }

      shapesArray.forEach(shape => {
          addThreePath(shape, false);
          shape.holes.forEach(h => addThreePath(h, true));
      });

      const co = new ClipperLib.ClipperOffset();
      co.AddPaths(subjPaths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
      const solutionPaths = new ClipperLib.Paths();
      co.Execute(solutionPaths, Math.round(-offsetInClipper * scaleFactor));

      // Build hierarchy
      const c = new ClipperLib.Clipper();
      c.AddPaths(solutionPaths, ClipperLib.PolyType.ptSubject, true);
      const solutionTree = new ClipperLib.PolyTree();
      c.Execute(ClipperLib.ClipType.ctUnion, solutionTree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
      
      const outShapes = [];
      function parseNode(node) {
          if (!node.IsHole() && node.Contour().length > 0) {
              const newShape = new THREE.Shape();
              node.Contour().forEach((p, i) => {
                  const x = p.X / scaleFactor;
                  const y = p.Y / scaleFactor;
                  if (i === 0) newShape.moveTo(x, y);
                  else newShape.lineTo(x, y);
              });
              newShape.closePath();
              
              node.Childs().forEach(child => {
                  if (child.Contour().length > 0) {
                      const hole = new THREE.Path();
                      child.Contour().forEach((p, i) => {
                          const x = p.X / scaleFactor;
                          const y = p.Y / scaleFactor;
                          if (i === 0) hole.moveTo(x, y);
                          else hole.lineTo(x, y);
                      });
                      hole.closePath();
                      newShape.holes.push(hole);
                  }
              });
              outShapes.push(newShape);
          }
          node.Childs().forEach(child => {
              if (child.IsHole()) child.Childs().forEach(grandchild => parseNode(grandchild));
              else parseNode(child);
          });
      }
      solutionTree.Childs().forEach(child => parseNode(child));
      return outShapes;
  }

  function generateHollowWall(shapesArray, thicknessMm) {
      const offsetInClipper = thicknessMm / scale;
      const subjPaths = [];

      function addThreePath(path, isHole) {
          const pts = path.getPoints();
          if (pts.length < 3) return;
          const cPath = pts.map(p => ({X: Math.round(p.x * scaleFactor), Y: Math.round(p.y * scaleFactor)}));
          if (ClipperLib.Clipper.Orientation(cPath) === isHole) cPath.reverse();
          subjPaths.push(cPath);
      }

      shapesArray.forEach(shape => {
          addThreePath(shape, false);
          shape.holes.forEach(h => addThreePath(h, true));
      });

      const co = new ClipperLib.ClipperOffset();
      co.AddPaths(subjPaths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
      const airPaths = new ClipperLib.Paths();
      co.Execute(airPaths, Math.round(-offsetInClipper * scaleFactor));

      const c = new ClipperLib.Clipper();
      c.AddPaths(subjPaths, ClipperLib.PolyType.ptSubject, true);
      c.AddPaths(airPaths, ClipperLib.PolyType.ptClip, true);
      const solutionTree = new ClipperLib.PolyTree();
      c.Execute(ClipperLib.ClipType.ctDifference, solutionTree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
      
      const outShapes = [];
      function parseNode(node) {
          if (!node.IsHole() && node.Contour().length > 0) {
              const newShape = new THREE.Shape();
              node.Contour().forEach((p, i) => {
                  const x = p.X / scaleFactor;
                  const y = p.Y / scaleFactor;
                  if (i === 0) newShape.moveTo(x, y);
                  else newShape.lineTo(x, y);
              });
              newShape.closePath();
              
              node.Childs().forEach(child => {
                  if (child.Contour().length > 0) {
                      const hole = new THREE.Path();
                      child.Contour().forEach((p, i) => {
                          const x = p.X / scaleFactor;
                          const y = p.Y / scaleFactor;
                          if (i === 0) hole.moveTo(x, y);
                          else hole.lineTo(x, y);
                      });
                      hole.closePath();
                      newShape.holes.push(hole);
                  }
              });
              outShapes.push(newShape);
          }
          node.Childs().forEach(child => {
              if (child.IsHole()) child.Childs().forEach(grandchild => parseNode(grandchild));
              else parseNode(child);
          });
      }
      solutionTree.Childs().forEach(child => parseNode(child));
      return outShapes;
  }

  // Z heights
  const zFundoBottom = 0;
  const zFundoTop = recuoFundo + espFundo;
  const zFaceBottom = profundidade - recuoFrente - espAcr;
  const zFaceTop = profundidade;

  const hasMiddle = zFaceBottom > zFundoTop;

  // Gerar as formas 2D das secoes
  const shapesParedeFina = generateHollowWall(allShapes, parede);
  const shapesParedeGrossa = generateHollowWall(allShapes, parede + denteWidth);
  
  // 1. CORPO (Canaleta com Dente de apoio tipo 'H')
  const meshCorpo = new THREE.Group();
  
  // Base (apoio do PVC)
  if (zFundoTop > 0) {
      shapesParedeFina.forEach(s => {
         const g = new THREE.ExtrudeGeometry(s, { depth: zFundoTop, bevelEnabled: false, steps: 1 });
         const m = new THREE.Mesh(g, matCorpo);
         m.position.z = 0;
         meshCorpo.add(m);
      });
  }
  
  // Dente Central (onde apoiam face e fundo)
  if (hasMiddle) {
      shapesParedeGrossa.forEach(s => {
         const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.1, zFaceBottom - zFundoTop), bevelEnabled: false, steps: 1 });
         const m = new THREE.Mesh(g, matCorpo);
         m.position.z = zFundoTop;
         meshCorpo.add(m);
      });
  }
  
  // Topo (apoio do Acrilico)
  if (zFaceTop > zFaceBottom) {
      shapesParedeFina.forEach(s => {
         const g = new THREE.ExtrudeGeometry(s, { depth: zFaceTop - zFaceBottom, bevelEnabled: false, steps: 1 });
         const m = new THREE.Mesh(g, matCorpo);
         m.position.z = zFaceBottom;
         meshCorpo.add(m);
      });
  }

  // 2. FACE ACRILICO (Recuo interno da parede para encaixar)
  const shapesFace = generateOffsetShapes(allShapes, parede);
  const meshFace = new THREE.Group();
  shapesFace.forEach(s => {
      const g = new THREE.ExtrudeGeometry(s, { depth: espAcr, bevelEnabled: false, steps: 1 });
      const m = new THREE.Mesh(g, matFaceAcrilico);
      m.position.z = zFaceBottom;
      meshFace.add(m);
  });

  // 3. FUNDO PVC
  const shapesFundo = generateOffsetShapes(allShapes, parede);
  const meshFundo = new THREE.Group();
  shapesFundo.forEach(s => {
      const g = new THREE.ExtrudeGeometry(s, { depth: espFundo, bevelEnabled: false, steps: 1 });
      const m = new THREE.Mesh(g, matFundoPVC);
      m.position.z = recuoFundo;
      meshFundo.add(m);
  });

  group.add(meshCorpo);
  group.add(meshFace);
  group.add(meshFundo);

  // Escala para os milimetros nominais
  group.scale.set(scale, scale, 1.0);

  // Deixa em pe no plano XZ (Y = altura, Z = profundidade)
  group.rotation.x = Math.PI / 2;

  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  group.position.x = -center.x;
  group.position.z = -center.z;
  group.position.y = -box.min.y;

  return {
    group,
    allShapes,
    shapesFace,
    shapesFundo,
    scale,
    size,
    bounds: { minX, minY, maxX, maxY, width: origW * scale, height: origH * scale }
  };
}

"""

new_text = text[:start_idx] + new_func + text[end_idx:]

with open(r'c:\DASHBOARD\dashboard-v2\src\utils\letraCaixaEngine.js', 'w', encoding='utf-8') as f:
    f.write(new_text)

print("letraCaixaEngine.js patched!")
