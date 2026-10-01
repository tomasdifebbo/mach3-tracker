/**
 * Conversor G-Code para DXF (100% Client-Side em Memória do Navegador)
 * Converte movimentos G00/G01/G02/G03 em contornos 2D e exporta formato DXF R2000 (AC1015) 100% compatível com CorelDRAW e AutoCAD.
 */

export function parseGCode(text) {
  const lines = text.split(/\r?\n/);
  const hasZ = /Z\s*-?\d+/i.test(text);

  let currX = 0.0, currY = 0.0, currZ = 20.0;
  let currG = null;

  const rawPaths = [];
  let currentPath = [];
  let isCutting = false;

  const paramRe = /([GXYZFSTHM])\s*(-?\d+(?:\.\d+)?)/gi;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    // Strip comments (parentheses)
    const line = rawLine.replace(/\(.*?\)/g, '').trim();
    if (!line || line.startsWith('%')) continue;

    const matches = [...line.matchAll(paramRe)];
    if (!matches || matches.length === 0) continue;

    const params = {};
    const gCodesInLine = [];

    for (let m = 0; m < matches.length; m++) {
      const match = matches[m];
      const letter = match[1].toUpperCase();
      const val = parseFloat(match[2]);
      if (letter === 'G') {
        gCodesInLine.push(Math.floor(val));
      } else {
        params[letter] = val;
      }
    }

    for (let g = 0; g < gCodesInLine.length; g++) {
      const gc = gCodesInLine[g];
      if (gc === 0 || gc === 1 || gc === 2 || gc === 3) {
        currG = gc;
      }
    }

    const newX = params.X !== undefined ? params.X : currX;
    const newY = params.Y !== undefined ? params.Y : currY;
    const newZ = params.Z !== undefined ? params.Z : currZ;

    // Smart Cutting Determination
    let cuttingNow = false;
    if (!hasZ) {
      // Pure 2D G-Code (no Z coordinates)
      cuttingNow = (currG === 1 || currG === 2 || currG === 3);
    } else {
      // 3D / Depth-based G-Code
      if (currG === 0 || newZ > 0.5) {
        cuttingNow = false;
      } else {
        cuttingNow = (currG === 1 || currG === 2 || currG === 3);
      }
    }

    if (cuttingNow) {
      if (!isCutting) {
        isCutting = true;
        currentPath = [[currX, currY]];
      }
      const last = currentPath[currentPath.length - 1];
      if (!last || last[0] !== newX || last[1] !== newY) {
        currentPath.push([newX, newY]);
      }
    } else {
      if (isCutting && currentPath.length > 1) {
        rawPaths.push(currentPath);
      }
      currentPath = [];
      isCutting = false;
    }

    currX = newX;
    currY = newY;
    currZ = newZ;
  }

  if (isCutting && currentPath.length > 1) {
    rawPaths.push(currentPath);
  }

  return rawPaths;
}

export function deduplicatePaths(rawPaths, bboxTol = 2.0) {
  const unique = [];

  for (let i = 0; i < rawPaths.length; i++) {
    const path = rawPaths[i];
    if (!path || path.length < 3) continue;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (let j = 0; j < path.length; j++) {
      const pt = path[j];
      const x = pt[0], y = pt[1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const bbox = [
      Math.round(minX),
      Math.round(minY),
      Math.round(maxX),
      Math.round(maxY)
    ];

    let isDup = false;
    for (let k = 0; k < unique.length; k++) {
      const u = unique[k];
      const ub = u.bbox;
      if (
        Math.abs(bbox[0] - ub[0]) < bboxTol &&
        Math.abs(bbox[1] - ub[1]) < bboxTol &&
        Math.abs(bbox[2] - ub[2]) < bboxTol &&
        Math.abs(bbox[3] - ub[3]) < bboxTol
      ) {
        if (path.length > u.path.length) {
          u.path = path;
          u.bbox = bbox;
        }
        isDup = true;
        break;
      }
    }

    if (!isDup) {
      unique.push({ path, bbox });
    }
  }

  return unique.map(u => u.path);
}

export function generateDxfContent(uniquePaths, rawPaths) {
  // Compute global bounding box for $EXTMIN / $EXTMAX / $LIMMIN / $LIMMAX safely
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  const updateBounds = (paths) => {
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      for (let j = 0; j < path.length; j++) {
        const pt = path[j];
        if (pt[0] < minX) minX = pt[0];
        if (pt[0] > maxX) maxX = pt[0];
        if (pt[1] < minY) minY = pt[1];
        if (pt[1] > maxY) maxY = pt[1];
      }
    }
  };

  updateBounds(uniquePaths);
  updateBounds(rawPaths);

  if (!isFinite(minX) || !isFinite(maxX)) {
    minX = 0; maxX = 100;
    minY = 0; maxY = 100;
  }

  const chunks = [
`  0\nSECTION\n  2\nHEADER\n  9\n$ACADVER\n  1\nAC1009\n  9\n$MEASUREMENT\n 70\n1\n  9\n$LUNITS\n 70\n2\n  9\n$LUPREC\n 70\n4\n  9\n$INSUNITS\n 70\n4\n  9\n$EXTMIN\n 10\n${minX.toFixed(4)}\n 20\n${minY.toFixed(4)}\n 30\n0.0\n  9\n$EXTMAX\n 10\n${maxX.toFixed(4)}\n 20\n${maxY.toFixed(4)}\n 30\n0.0\n  9\n$LIMMIN\n 10\n${minX.toFixed(4)}\n 20\n${minY.toFixed(4)}\n  9\n$LIMMAX\n 10\n${maxX.toFixed(4)}\n 20\n${maxY.toFixed(4)}\n  0\nENDSEC`,
`  0\nSECTION\n  2\nTABLES\n  0\nTABLE\n  2\nLAYER\n 70\n2\n  0\nLAYER\n  2\nPECAS_2D\n 70\n0\n 62\n3\n  6\nCONTINUOUS\n  0\nLAYER\n  2\nPASSADAS_COMPLETAS\n 70\n0\n 62\n1\n  6\nCONTINUOUS\n  0\nENDTAB\n  0\nENDSEC`,
`  0\nSECTION\n  2\nBLOCKS\n  0\nENDSEC`,
`  0\nSECTION\n  2\nENTITIES`
  ];

  function addPolyline(path, layerName) {
    if (!path || path.length < 2) return;
    const startP = path[0];
    const endP = path[path.length - 1];
    const dist = Math.hypot(startP[0] - endP[0], startP[1] - endP[1]);
    const isClosed = dist < 2.0 ? 1 : 0;

    chunks.push(`  0\nPOLYLINE\n  8\n${layerName}\n 66\n1\n 10\n0.0\n 20\n0.0\n 30\n0.0\n 70\n${isClosed}`);

    for (let i = 0; i < path.length; i++) {
      const pt = path[i];
      chunks.push(`  0\nVERTEX\n  8\n${layerName}\n 10\n${pt[0].toFixed(4)}\n 20\n${pt[1].toFixed(4)}\n 30\n0.0\n 70\n0`);
    }

    chunks.push(`  0\nSEQEND\n  8\n${layerName}`);
  }

  // Unique extracted 2D pieces (Green)
  for (let i = 0; i < uniquePaths.length; i++) {
    addPolyline(uniquePaths[i], 'PECAS_2D');
  }

  // Full raw toolpaths (Red)
  for (let i = 0; i < rawPaths.length; i++) {
    addPolyline(rawPaths[i], 'PASSADAS_COMPLETAS');
  }

  chunks.push('  0\nENDSEC\n  0\nEOF\n');
  return chunks.join('\n');
}

export function processGCodeToDxf(gcodeText, fileName = 'desenho.txt') {
  const rawPaths = parseGCode(gcodeText);
  if (!rawPaths || rawPaths.length === 0) {
    throw new Error('Nenhum movimento de corte (G1/G2/G3) foi identificado no arquivo.');
  }

  const uniquePaths = deduplicatePaths(rawPaths);

  // If no paths were extracted with standard 0.5 threshold, fallback to raw cut lines
  const pathsToExport = uniquePaths.length > 0 ? uniquePaths : rawPaths;

  const dxfContent = generateDxfContent(pathsToExport, rawPaths);

  // Compute bounding box and stats safely without stack overflow
  let globalMinX = Infinity, globalMaxX = -Infinity;
  let globalMinY = Infinity, globalMaxY = -Infinity;

  const pieceDetails = pathsToExport.map((p, idx) => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (let i = 0; i < p.length; i++) {
      const pt = p[i];
      const x = pt[0], y = pt[1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const width = Math.round(maxX - minX);
    const height = Math.round(maxY - minY);

    if (minX < globalMinX) globalMinX = minX;
    if (maxX > globalMaxX) globalMaxX = maxX;
    if (minY < globalMinY) globalMinY = minY;
    if (maxY > globalMaxY) globalMaxY = maxY;

    const startPt = p[0];
    const endPt = p[p.length - 1];
    const dist = Math.hypot(startPt[0] - endPt[0], startPt[1] - endPt[1]);
    const isClosed = dist < 2.0;

    return {
      index: idx + 1,
      points: p.length,
      width: isFinite(width) ? width : 0,
      height: isFinite(height) ? height : 0,
      isClosed
    };
  });

  const totalWidth = isFinite(globalMaxX - globalMinX) ? Math.round(globalMaxX - globalMinX) : 0;
  const totalHeight = isFinite(globalMaxY - globalMinY) ? Math.round(globalMaxY - globalMinY) : 0;

  // Generate downloadable Blob & URL
  const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);

  const outFileName = fileName.replace(/\.(txt|tap|nc|cnc|gcode)$/i, '') + '.dxf';

  return {
    success: true,
    outFileName,
    downloadUrl,
    stats: {
      rawPassesCount: rawPaths.length,
      uniquePiecesCount: pathsToExport.length,
      totalWidth,
      totalHeight
    },
    pieceDetails
  };
}
