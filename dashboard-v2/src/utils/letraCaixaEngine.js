/**
 * Motor de Modelagem e Vetorização de Letra Caixa 3D (Mach3 Tracker)
 * Suporta:
 * 1. Processamento e extrusão 3D client-side via Three.js (100% no navegador)
 * 2. Geração de vetores 1:1 DXF (CorelDRAW/AutoCAD) e SVG (Laser) para Face e Fundo
 * 3. Exportação de STL para Impressão 3D (Corpo com dentes de apoio)
 * 4. Conexão híbrida opcional com o Motor Blender 5.1 Local (http://127.0.0.1:8080)
 */

import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

// ─── GERAÇÃO DE DXF VETORIAL ──────────────────────────────────────────────────
export function generateDxfFromPaths(paths, filename = 'vetor_corte.dxf') {
  let dxf = '';
  dxf += '  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1015\n  9\n$INSUNITS\n 70\n4\n  0\nENDSEC\n';
  dxf += '  0\nSECTION\n  2\nTABLES\n';
  dxf += '  0\nTABLE\n  2\nLAYER\n 70\n2\n';
  dxf += '  0\nLAYER\n  2\nCORTE_EXTERNO\n 70\n0\n 62\n1\n  6\nCONTINUOUS\n';
  dxf += '  0\nLAYER\n  2\nCORTE_MIOLO\n 70\n0\n 62\n3\n  6\nCONTINUOUS\n';
  dxf += '  0\nENDTAB\n  0\nENDSEC\n';
  dxf += '  0\nSECTION\n  2\nENTITIES\n';

  paths.forEach((p, idx) => {
    const layer = p.isHole ? 'CORTE_MIOLO' : 'CORTE_EXTERNO';
    const color = p.isHole ? 3 : 1;
    const pts = p.points;
    if (!pts || pts.length < 2) return;

    dxf += '  0\nLWPOLYLINE\n';
    dxf += '  5\n' + (100 + idx).toString(16) + '\n';
    dxf += '100\nAcDbEntity\n';
    dxf += '  8\n' + layer + '\n';
    dxf += ' 62\n' + color + '\n';
    dxf += '100\nAcDbPolyline\n';
    dxf += ' 90\n' + pts.length + '\n';
    dxf += ' 70\n1\n'; // 1 = closed

    for (const pt of pts) {
      dxf += ' 10\n' + pt.x.toFixed(4) + '\n';
      dxf += ' 20\n' + pt.y.toFixed(4) + '\n';
    }
  });

  dxf += '  0\nENDSEC\n  0\nEOF\n';
  return dxf;
}

// ─── GERAÇÃO DE SVG VETORIAL 1:1 ──────────────────────────────────────────────
export function generateSvgFromPaths(paths, widthMm, heightMm) {
  const margin = 5.0;
  const viewW = widthMm + margin * 2;
  const viewH = heightMm + margin * 2;

  let pathData = '';
  paths.forEach(p => {
    const pts = p.points;
    if (!pts || pts.length < 2) return;
    pathData += `M ${pts[0].x.toFixed(3)},${(heightMm - pts[0].y).toFixed(3)} `;
    for (let i = 1; i < pts.length; i++) {
      pathData += `L ${pts[i].x.toFixed(3)},${(heightMm - pts[i].y).toFixed(3)} `;
    }
    pathData += 'Z ';
  });

  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${viewW.toFixed(2)}mm" height="${viewH.toFixed(2)}mm" viewBox="-${margin} -${margin} ${viewW.toFixed(2)} ${viewH.toFixed(2)}">
  <title>Vetor de Corte 1:1 (mm)</title>
  <path d="${pathData.trim()}" fill="none" stroke="#FF0000" stroke-width="0.2" fill-rule="evenodd" />
</svg>`;
}

// ─── PARSER E CONSTRUTOR 3D DE LETRA CAIXA ────────────────────────────────────
export function buildChannelLetterMesh(svgText, params) {
  const {
    largura = 600,
    altura = 200,
    profundidade = 35,
    parede = 2.0,
    recuoFrente = 3.0,
    espAcr = 3.0,
    recuoFundo = 3.0,
    espFundo = 10.0
  } = params;

  const loader = new SVGLoader();
  const svgData = loader.parse(svgText);
  const shapes = [];

  svgData.paths.forEach(path => {
    const pathShapes = SVGLoader.createShapes(path);
    shapes.push(...pathShapes);
  });

  if (shapes.length === 0) {
    throw new Error('Nenhum contorno válido encontrado no arquivo SVG.');
  }

  // Obter bounding box inicial do SVG para escalonar exatamente para largura x altura
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  shapes.forEach(shape => {
    shape.getPoints().forEach(pt => {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });
  });

  const origW = maxX - minX || 1;
  const origH = maxY - minY || 1;
  const scale = Math.min(largura / origW, altura / origH);

  // Normalizar e escalonar shapes
  const scaledShapes = shapes.map(shape => {
    const newShape = new THREE.Shape();
    const pts = shape.getPoints().map(p => new THREE.Vector2((p.x - minX) * scale, (p.y - minY) * scale));
    if (pts.length > 0) {
      newShape.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) newShape.lineTo(pts[i].x, pts[i].y);
    }
    // Furos (miolos)
    newShape.holes = shape.holes.map(hole => {
      const newHole = new THREE.Path();
      const holePts = hole.getPoints().map(p => new THREE.Vector2((p.x - minX) * scale, (p.y - minY) * scale));
      if (holePts.length > 0) {
        newHole.moveTo(holePts[0].x, holePts[0].y);
        for (let i = 1; i < holePts.length; i++) newHole.lineTo(holePts[i].x, holePts[i].y);
      }
      return newHole;
    });
    return newShape;
  });

  const group = new THREE.Group();
  group.name = "LetraCaixa_Assembly";

  // Materiais
  const matCorpo = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.2,
    roughness: 0.35,
    side: THREE.DoubleSide
  });

  const matAcrilico = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    metalness: 0.05,
    roughness: 0.1,
    transmission: 0.7,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide
  });

  const matPvc = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.5,
    metalness: 0.1,
    side: THREE.DoubleSide
  });

  const matDente = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.4,
    side: THREE.DoubleSide
  });

  // 1. Corpo Oco (Extrusão total)
  scaledShapes.forEach(shape => {
    const geomCorpo = new THREE.ExtrudeGeometry(shape, {
      depth: profundidade,
      bevelEnabled: false,
      curveSegments: 36
    });
    const meshCorpo = new THREE.Mesh(geomCorpo, matCorpo);
    group.add(meshCorpo);

    // 2. Dente de apoio (frontal e fundo)
    const geomDente = new THREE.ExtrudeGeometry(shape, {
      depth: recuoFrente,
      bevelEnabled: false,
      curveSegments: 36
    });
    const meshDente = new THREE.Mesh(geomDente, matDente);
    meshDente.position.z = profundidade - recuoFrente;
    group.add(meshDente);

    // 3. Face Acrílico (rebaixada no bolso frontal)
    const geomAcr = new THREE.ExtrudeGeometry(shape, {
      depth: espAcr,
      bevelEnabled: false,
      curveSegments: 36
    });
    const meshAcr = new THREE.Mesh(geomAcr, matAcrilico);
    meshAcr.position.z = profundidade - espAcr + 2; // leve destaque visual
    group.add(meshAcr);

    // 4. Fundo PVC (encaixe no fundo)
    const geomPvc = new THREE.ExtrudeGeometry(shape, {
      depth: espFundo,
      bevelEnabled: false,
      curveSegments: 36
    });
    const meshPvc = new THREE.Mesh(geomPvc, matPvc);
    meshPvc.position.z = 0;
    group.add(meshPvc);
  });

  // Extrair contornos 2D para DXF e SVG (Face Acrílico e Fundo PVC)
  const pathsFace = [];
  const pathsFundo = [];

  scaledShapes.forEach(shape => {
    const extPts = shape.getPoints();
    pathsFace.push({ isHole: false, points: extPts });
    pathsFundo.push({ isHole: false, points: extPts });

    shape.holes.forEach(hole => {
      const hPts = hole.getPoints();
      pathsFace.push({ isHole: true, points: hPts });
      pathsFundo.push({ isHole: true, points: hPts });
    });
  });

  const finalW = origW * scale;
  const finalH = origH * scale;

  const faceDxf = generateDxfFromPaths(pathsFace, 'face_acrilico.dxf');
  const faceSvg = generateSvgFromPaths(pathsFace, finalW, finalH);
  const fundoDxf = generateDxfFromPaths(pathsFundo, 'fundo_pvc.dxf');
  const fundoSvg = generateSvgFromPaths(pathsFundo, finalW, finalH);

  // Gerar STL do Corpo + Dente para impressão 3D
  const exporter = new STLExporter();
  const stlOutput = exporter.parse(group, { binary: true });

  return {
    meshGroup: group,
    dimensions: { width: finalW, height: finalH, depth: profundidade },
    faceDxf,
    faceSvg,
    fundoDxf,
    fundoSvg,
    stlOutput
  };
}

// ─── CONEXÃO COM O MOTOR BLENDER LOCAL (SE DISPONÍVEL) ─────────────────────────
export async function checkBlenderServer(url = 'http://127.0.0.1:8080') {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${url}/api/latest_model`, { signal: controller.signal });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}
