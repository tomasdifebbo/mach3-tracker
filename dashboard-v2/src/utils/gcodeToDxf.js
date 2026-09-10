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

  for (let rawLine of lines) {
    // Strip comments (parentheses)
    const line = rawLine.replace(/\(.*?\)/g, '').trim();
    if (!line || line.startsWith('%')) continue;

    const matches = [...line.matchAll(paramRe)];
    if (!matches || matches.length === 0) continue;

    const params = {};
    const gCodesInLine = [];

    for (const match of matches) {
      const letter = match[1].toUpperCase();
      const val = parseFloat(match[2]);
      if (letter === 'G') {
        gCodesInLine.push(Math.floor(val));
      } else {
        params[letter] = val;
      }
    }

    for (const gc of gCodesInLine) {
      if ([0, 1, 2, 3].includes(gc)) {
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
      cuttingNow = [1, 2, 3].includes(currG);
    } else {
      // 3D / Depth-based G-Code
      if (currG === 0 || newZ > 0.5) {
        cuttingNow = false;
      } else {
        cuttingNow = [1, 2, 3].includes(currG);
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
        rawPaths.push([...currentPath]);
      }
      currentPath = [];
      isCutting = false;
    }

    currX = newX;
    currY = newY;
    currZ = newZ;
  }

  if (isCutting && currentPath.length > 1) {
    rawPaths.push([...currentPath]);
  }

  return rawPaths;
}

export function deduplicatePaths(rawPaths, bboxTol = 2.0) {
  const unique = [];

  for (const path of rawPaths) {
    if (path.length < 3) continue;

    const xs = path.map(p => p[0]);
    const ys = path.map(p => p[1]);
    const bbox = [
      Math.round(Math.min(...xs)),
      Math.round(Math.min(...ys)),
      Math.round(Math.max(...xs)),
      Math.round(Math.max(...ys))
    ];

    let isDup = false;
    for (const u of unique) {
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
  // Compute global bounding box for $EXTMIN / $EXTMAX / $LIMMIN / $LIMMAX
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  const allPaths = uniquePaths.concat(rawPaths);
  for (const path of allPaths) {
    for (const [x, y] of path) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (!isFinite(minX) || !isFinite(maxX)) {
    minX = 0; maxX = 100;
    minY = 0; maxY = 100;
  }

  const lines = [
    '  0', 'SECTION',
    '  2', 'HEADER',
    '  9', '$ACADVER',
    '  1', 'AC1009',
    '  9', '$EXTMIN',
    ' 10', minX.toFixed(4),
    ' 20', minY.toFixed(4),
    ' 30', '0.0',
    '  9', '$EXTMAX',
    ' 10', maxX.toFixed(4),
    ' 20', maxY.toFixed(4),
    ' 30', '0.0',
    '  9', '$LIMMIN',
    ' 10', minX.toFixed(4),
    ' 20', minY.toFixed(4),
    '  9', '$LIMMAX',
    ' 10', maxX.toFixed(4),
    ' 20', maxY.toFixed(4),
    '  0', 'ENDSEC',
    '  0', 'SECTION',
    '  2', 'TABLES',
    '  0', 'TABLE',
    '  2', 'LAYER',
    ' 70', '2',
    '  0', 'LAYER',
    '  2', 'PECAS_2D',
    ' 70', '0',
    ' 62', '3', // Color 3 = Green
    '  6', 'CONTINUOUS',
    '  0', 'LAYER',
    '  2', 'PASSADAS_COMPLETAS',
    ' 70', '0',
    ' 62', '1', // Color 1 = Red
    '  6', 'CONTINUOUS',
    '  0', 'ENDTAB',
    '  0', 'ENDSEC',
    '  0', 'SECTION',
    '  2', 'BLOCKS',
    '  0', 'ENDSEC',
    '  0', 'SECTION',
    '  2', 'ENTITIES'
  ];

  function addPolyline(path, layerName) {
    if (path.length < 2) return;
    const startP = path[0];
    const endP = path[path.length - 1];
    const dist = Math.hypot(startP[0] - endP[0], startP[1] - endP[1]);
    const isClosed = dist < 2.0 ? 1 : 0;

    lines.push(
      '  0', 'POLYLINE',
      '  8', layerName,
      ' 66', '1',
      ' 10', '0.0',
      ' 20', '0.0',
      ' 30', '0.0',
      ' 70', isClosed.toString()
    );

    for (const [x, y] of path) {
      lines.push(
        '  0', 'VERTEX',
        '  8', layerName,
        ' 10', x.toFixed(4),
        ' 20', y.toFixed(4),
        ' 30', '0.0',
        ' 70', '0'
      );
    }

    lines.push(
      '  0', 'SEQEND',
      '  8', layerName
    );
  }

  // Unique extracted 2D pieces (Green)
  for (const path of uniquePaths) {
    addPolyline(path, 'PECAS_2D');
  }

  // Full raw toolpaths (Red)
  for (const path of rawPaths) {
    addPolyline(path, 'PASSADAS_COMPLETAS');
  }

  lines.push('  0', 'ENDSEC', '  0', 'EOF');
  return lines.join('\n');
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

  // Compute bounding box and stats
  let globalMinX = Infinity, globalMaxX = -Infinity;
  let globalMinY = Infinity, globalMaxY = -Infinity;

  const pieceDetails = pathsToExport.map((p, idx) => {
    const xs = p.map(pt => pt[0]);
    const ys = p.map(pt => pt[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const width = Math.round(maxX - minX);
    const height = Math.round(maxY - minY);

    globalMinX = Math.min(globalMinX, minX);
    globalMaxX = Math.max(globalMaxX, maxX);
    globalMinY = Math.min(globalMinY, minY);
    globalMaxY = Math.max(globalMaxY, maxY);

    const dist = Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]);
    const isClosed = dist < 2.0;

    return {
      index: idx + 1,
      points: p.length,
      width,
      height,
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
