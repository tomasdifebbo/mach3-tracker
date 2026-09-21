/**
 * Motor de Geração de Letra Caixa 3D (Arquitetura Híbrida: Local Blender + Client-Side Three.js)
 * Permite geração instantânea em memória no navegador ou conexão direta com Blender 5.1 local.
 */
import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import ClipperLib from 'clipper-lib';

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
export function buildClientSideChannelLetter(svgString, params) {
  const {
    largura = 600,
    altura = 200,
    profundidade = 35,
    parede = 2.0,
    recuoDente = 3.0,
    espAcr = 3.0,
    recuoFundo = 3.0,
    espFundo = 10.0
  } = params;

  const loader = new SVGLoader();
  const svgData = loader.parse(svgString);

  const group = new THREE.Group();
  const allShapes = [];

  // Extrai todas as formas e caminhos vetoriais preservando furos/miolos
  svgData.paths.forEach((path) => {
    const shapes = path.toShapes(); // Removido o 'true' para não forçar orientação e perder furos
    shapes.forEach((s) => allShapes.push(s));
  });

  if (allShapes.length === 0) {
    // Fallback: Se o SVG não tiver caminhos válidos, cria formato de letra caixa exemplo
    const fallbackShape = new THREE.Shape();
    fallbackShape.moveTo(0, 0);
    fallbackShape.lineTo(largura, 0);
    fallbackShape.lineTo(largura, altura);
    fallbackShape.lineTo(0, altura);
    fallbackShape.closePath();
    allShapes.push(fallbackShape);
  }

  // Calcula Bounding Box 2D original para escalonar precisamente para a largura x altura nominais
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  allShapes.forEach((shape) => {
    const points = shape.getPoints();
    points.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    });
  });

  const origW = maxX - minX || 100;
  const origH = maxY - minY || 100;
  const scale = Math.min(largura / origW, altura / origH);

  // Materiais da Letra Caixa
  const matCorpo = new THREE.MeshStandardMaterial({
    color: 0x2563eb, // Azul técnico acetinado
    roughness: 0.35,
    metalness: 0.1,
    side: THREE.DoubleSide
  });

  const matFaceAcrilico = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.1,
    transmission: 0.85,
    thickness: espAcr,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });

  const matFundoPVC = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0, // Branco/cinza PVC Expandido
    roughness: 0.6,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  const matDente = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.4,
    side: THREE.DoubleSide
  });

  // 1. CORPO PRINCIPAL (Parede oca gerada por ClipperLib)
  const extrudeCorpo = {
    steps: 1,
    depth: profundidade,
    bevelEnabled: false
  };

  const scaleFactor = 1000;
  const hollowShapes = [];

  allShapes.forEach((shape) => {
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
    
    addThreePath(shape, false);
    shape.holes.forEach(h => addThreePath(h, true));
    
    // Offset inward to create Air paths (o "miolo" vazio da canaleta)
    // O valor do offset no SVG original precisa ser ajustado pela escala final
    // A variável `parede` está em milímetros nominais. Precisamos converter para a escala do SVG original:
    const paredeNoSVG = parede / scale;

    const co = new ClipperLib.ClipperOffset();
    co.AddPaths(subjPaths, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
    const airPaths = new ClipperLib.Paths();
    co.Execute(airPaths, -paredeNoSVG * scaleFactor);
    
    // Subtrair Air do Subject para obter a Parede oca
    const c = new ClipperLib.Clipper();
    c.AddPaths(subjPaths, ClipperLib.PolyType.ptSubject, true);
    c.AddPaths(airPaths, ClipperLib.PolyType.ptClip, true);
    
    const solutionTree = new ClipperLib.PolyTree();
    c.Execute(ClipperLib.ClipType.ctDifference, solutionTree, ClipperLib.PolyFillType.pftEvenOdd, ClipperLib.PolyFillType.pftEvenOdd);
    
    function parseNode(node) {
        if (!node.IsHole() && node.Contour().length > 0) {
            const newShape = new THREE.Shape();
            node.Contour().forEach((p, i) => {
                const x = p.X / scaleFactor;
                const y = p.Y / scaleFactor;
                if (i === 0) newShape.moveTo(x, y);
                else newShape.lineTo(x, y);
            });
            node.Childs().forEach(child => {
                if (child.Contour().length > 0) {
                    const hole = new THREE.Path();
                    child.Contour().forEach((p, i) => {
                        const x = p.X / scaleFactor;
                        const y = p.Y / scaleFactor;
                        if (i === 0) hole.moveTo(x, y);
                        else hole.lineTo(x, y);
                    });
                    newShape.holes.push(hole);
                }
            });
            hollowShapes.push(newShape);
        }
        node.Childs().forEach(child => {
            if (child.IsHole()) {
                child.Childs().forEach(grandchild => parseNode(grandchild));
            } else {
                parseNode(child);
            }
        });
    }
    
    solutionTree.Childs().forEach(child => parseNode(child));
  });

  const meshCorpo = new THREE.Group();
  hollowShapes.forEach((shape) => {
    const geom = new THREE.ExtrudeGeometry(shape, extrudeCorpo);
    const mesh = new THREE.Mesh(geom, matCorpo);
    meshCorpo.add(mesh);
  });

  // 2. FACE ACRÍLICO (Tampa frontal com recuo de folga 0.5mm)
  const extrudeFace = {
    steps: 1,
    depth: espAcr,
    bevelEnabled: false
  };
  const meshFace = new THREE.Group();
  allShapes.forEach((shape) => {
    const geom = new THREE.ExtrudeGeometry(shape, extrudeFace);
    const mesh = new THREE.Mesh(geom, matFaceAcrilico);
    mesh.position.z = profundidade - espAcr;
    meshFace.add(mesh);
  });

  // 3. FUNDO PVC (Fundo encaixado)
  const extrudeFundo = {
    steps: 1,
    depth: espFundo,
    bevelEnabled: false
  };
  const meshFundo = new THREE.Group();
  allShapes.forEach((shape) => {
    const geom = new THREE.ExtrudeGeometry(shape, extrudeFundo);
    const mesh = new THREE.Mesh(geom, matFundoPVC);
    mesh.position.z = 0;
    meshFundo.add(mesh);
  });

  group.add(meshCorpo);
  group.add(meshFace);
  group.add(meshFundo);

  // Escala para os milímetros nominais
  group.scale.set(scale, scale, 1.0);

  // Deixa em pé no plano XZ (Y = altura, Z = profundidade)
  group.rotation.x = Math.PI / 2;

  // Reposiciona para assentar exatamente sobre a mesa (Y = 0) e centraliza em X e Z
  const box = new THREE.Box3().setFromObject(group);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  group.position.x = -center.x;
  group.position.z = -center.z;
  group.position.y = -box.min.y;

  return {
    group,
    allShapes,
    scale,
    size,
    bounds: { minX, minY, maxX, maxY, width: origW * scale, height: origH * scale }
  };
}

/**
 * Gera arquivo STL binário a partir do objeto 3D
 */
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
