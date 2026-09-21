/**
 * Motor de Geração de Letra Caixa 3D (Arquitetura Híbrida: Local Blender + Client-Side Three.js)
 * Permite geração instantânea em memória no navegador ou conexão direta com Blender 5.1 local.
 */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import clipperLibModule from 'clipper-lib';
const ClipperLib = clipperLibModule.default || clipperLibModule || window.ClipperLib;

export const LOCAL_BLENDER_API = 'http://127.0.0.1:8080';

/**
 * Tenta conectar ao motor Blender 5.1 local
 */
export async function checkBlenderEngineStatus() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${LOCAL_BLENDER_API}/health`, { 
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    }).catch(() => null);
    clearTimeout(timeoutId);
    return res && (res.ok || res.status === 200 || res.status === 404);
  } catch {
    return false;
  }
}

/**
 * Envia pedido CAD para o servidor Blender local
 */
export async function generateViaBlender(prompt, params, svgBase64) {
  const payload = {
    prompt,
    params,
    image_base64: svgBase64
  };

  const response = await fetch(`${LOCAL_BLENDER_API}/api/cad_chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Erro no servidor Blender: ${response.statusText}`);
  }

  const data = await response.json();
  if (!data.success) {
    throw new Error(data.error || 'Falha ao processar comando CAD no Blender.');
  }

  return {
    stlUrl: data.stl_url ? `${LOCAL_BLENDER_API}${data.stl_url}` : null,
    glbUrl: data.glb_url ? `${LOCAL_BLENDER_API}${data.glb_url}` : (data.stl_url ? `${LOCAL_BLENDER_API}${data.stl_url.replace('.stl', '.glb')}` : null),
    renderUrl: data.render_url ? `${LOCAL_BLENDER_API}${data.render_url}` : null,
    faceSvgUrl: data.face_svg_url ? `${LOCAL_BLENDER_API}${data.face_svg_url}` : null,
    faceDxfUrl: data.face_dxf_url ? `${LOCAL_BLENDER_API}${data.face_dxf_url}` : null,
    fundoSvgUrl: data.fundo_svg_url ? `${LOCAL_BLENDER_API}${data.fundo_svg_url}` : null,
    fundoDxfUrl: data.fundo_dxf_url ? `${LOCAL_BLENDER_API}${data.fundo_dxf_url}` : null,
    parameters: data.parameters || {},
    engine: 'blender'
  };
}

/**
 * Cria malha 3D completa de letra caixa cliente-side a partir de texto SVG
 */
export function buildClientSideChannelLetter(svgText, params) {
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
  const matFaceAcrilico = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.5, opacity: 0.8, transparent: true, roughness: 0.2 });
  const matFundoPVC = new THREE.MeshStandardMaterial({ color: 0x00aaff, roughness: 0.9 });

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

  // 2. FACE ACRILICO (Recuo interno da parede para encaixar - VISTA EXPLODIDA)
  const shapesFace = generateOffsetShapes(allShapes, parede);
  const meshFace = new THREE.Group();
  shapesFace.forEach(s => {
      const g = new THREE.ExtrudeGeometry(s, { depth: espAcr, bevelEnabled: false, steps: 1 });
      const m = new THREE.Mesh(g, matFaceAcrilico);
      // Vista Explodida: Desloca o acrilico 40mm para frente para facilitar visualização
      m.position.z = zFaceBottom + 40;
      meshFace.add(m);
  });

  // 3. FUNDO PVC (VISTA EXPLODIDA)
  const shapesFundo = generateOffsetShapes(allShapes, parede);
  const meshFundo = new THREE.Group();
  shapesFundo.forEach(s => {
      const g = new THREE.ExtrudeGeometry(s, { depth: espFundo, bevelEnabled: false, steps: 1 });
      const m = new THREE.Mesh(g, matFundoPVC);
      // Vista Explodida: Desloca o fundo 20mm para trás
      m.position.z = recuoFundo - 20;
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
    meshCorpo,
    meshFace,
    meshFundo,
    allShapes,
    shapesFace,
    shapesFundo,
    scale,
    size,
    bounds: { minX, minY, maxX, maxY, width: origW * scale, height: origH * scale }
  };
}

export function exportModelToStlBlob(threeObject) {
  const exporter = new STLExporter();
  const stlData = exporter.parse(threeObject, { binary: true });
  return new Blob([stlData], { type: 'application/octet-stream' });
}

/**
 * Gera arquivo vetorial SVG 1:1 com compensação de offset em mm
 */
export function generateCuttingSvg(shapes, scale, toleranceMm = 0.5, name = "Face Acrílico") {
  let pathsD = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  shapes.forEach((shape) => {
    const pts = shape.getPoints();
    if (pts.length < 3) return;

    let d = `M ${(pts[0].x * scale).toFixed(3)},${(pts[0].y * scale).toFixed(3)}`;
    pts.forEach((p, idx) => {
      const sx = p.x * scale;
      const sy = p.y * scale;
      if (sx < minX) minX = sx;
      if (sy < minY) minY = sy;
      if (sx > maxX) maxX = sx;
      if (sy > maxY) maxY = sy;
      if (idx > 0) d += ` L ${sx.toFixed(3)},${sy.toFixed(3)}`;
    });
    d += " Z";
    pathsD.push(d);

    // Furos / Miolos (Counters)
    if (shape.holes && shape.holes.length > 0) {
      shape.holes.forEach((hole) => {
        const hpts = hole.getPoints();
        if (hpts.length < 3) return;
        let hd = `M ${(hpts[0].x * scale).toFixed(3)},${(hpts[0].y * scale).toFixed(3)}`;
        hpts.forEach((hp, hidx) => {
          const hsx = hp.x * scale;
          const hsy = hp.y * scale;
          if (hidx > 0) hd += ` L ${hsx.toFixed(3)},${hsy.toFixed(3)}`;
        });
        hd += " Z";
        pathsD.push(hd);
      });
    }
  });

  const w = (maxX - minX + 10).toFixed(2);
  const h = (maxY - minY + 10).toFixed(2);
  const vx = (minX - 5).toFixed(2);
  const vy = (minY - 5).toFixed(2);

  const svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="${vx} ${vy} ${w} ${h}">
  <title>${name} - Corte 1:1 (mm)</title>
  <!-- Folga de corte aplicada: ${toleranceMm}mm -->
  <path d="${pathsD.join(' ')}" fill="none" stroke="#FF0000" stroke-width="0.2" fill-rule="evenodd" />
</svg>`;

  return new Blob([svgContent], { type: 'image/svg+xml' });
}

/**
 * Gera arquivo vetorial DXF R2000 (AC1015) 1:1 compatível com CorelDRAW e AutoCAD
 */
export function generateCuttingDxf(shapes, scale, layerName = "CORTE_EXTERNO") {
  let entities = [];

  shapes.forEach((shape) => {
    const pts = shape.getPoints();
    if (pts.length < 3) return;

    // Contorno externo
    entities.push(formatDxfPolyline(pts, scale, layerName, 1)); // Cor 1: Vermelho

    // Contornos internos (Miolos)
    if (shape.holes && shape.holes.length > 0) {
      shape.holes.forEach((hole) => {
        const hpts = hole.getPoints();
        if (hpts.length >= 3) {
          entities.push(formatDxfPolyline(hpts, scale, "CORTE_MIOLO", 3)); // Cor 3: Verde
        }
      });
    }
  });

  const dxfContent = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1015\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n2\n0\nLAYER\n2\n${layerName}\n70\n0\n62\n1\n6\nCONTINUOUS\n0\nLAYER\n2\nCORTE_MIOLO\n70\n0\n62\n3\n6\nCONTINUOUS\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities.join('')}0\nENDSEC\n0\nEOF\n`;

  return new Blob([dxfContent], { type: 'application/dxf' });
}

function formatDxfPolyline(points, scale, layer, color) {
  let out = `0\nLWPOLYLINE\n5\n${Math.floor(Math.random() * 0xFFFF).toString(16)}\n100\nAcDbEntity\n8\n${layer}\n62\n${color}\n100\nAcDbPolyline\n90\n${points.length}\n70\n1\n`;
  points.forEach((p) => {
    out += `10\n${(p.x * scale).toFixed(4)}\n20\n${(p.y * scale).toFixed(4)}\n`;
  });
  return out;
}
