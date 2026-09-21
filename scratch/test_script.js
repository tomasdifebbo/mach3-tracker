const fs = require('fs');

function generateDxfContent(uniquePaths, rawPaths) {
  let handleIndex = 100;
  const getHandle = () => (handleIndex++).toString(16).toUpperCase();

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const path of uniquePaths.concat(rawPaths)) {
    for (const [x, y] of path) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!isFinite(minX)) { minX = 0; maxX = 100; minY = 0; maxY = 100; }

  const lines = [
    '0', 'SECTION',
    '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1015',
    '9', '$INSUNITS', '70', '6',
    '9', '$EXTMIN', '10', minX.toFixed(4), '20', minY.toFixed(4), '30', '0.0',
    '9', '$EXTMAX', '10', maxX.toFixed(4), '20', maxY.toFixed(4), '30', '0.0',
    '9', '$LIMMIN', '10', minX.toFixed(4), '20', minY.toFixed(4),
    '9', '$LIMMAX', '10', maxX.toFixed(4), '20', maxY.toFixed(4),
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'TABLES',
    '0', 'TABLE',
    '2', 'LAYER',
    '70', '2',
    '0', 'LAYER', '2', 'PECAS_2D', '70', '0', '62', '3', '6', 'CONTINUOUS',
    '0', 'LAYER', '2', 'PASSADAS_COMPLETAS', '70', '0', '62', '1', '6', 'CONTINUOUS',
    '0', 'ENDTAB',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'BLOCKS',
    '0', 'ENDSEC',
    '0', 'SECTION',
    '2', 'ENTITIES'
  ];

  // Layer: PECAS_2D (Green - Color 3)
  for (const path of uniquePaths) {
    if (path.length < 2) continue;
    const startP = path[0];
    const endP = path[path.length - 1];
    const dist = Math.hypot(startP[0] - endP[0], startP[1] - endP[1]);
    const isClosed = dist < 2.0 ? 1 : 0;

    lines.push(
      '0', 'LWPOLYLINE',
      '5', getHandle(),
      '100', 'AcDbEntity',
      '8', 'PECAS_2D',
      '100', 'AcDbPolyline',
      '90', path.length.toString(),
      '70', isClosed.toString()
    );

    for (const [x, y] of path) {
      lines.push('10', x.toFixed(4), '20', y.toFixed(4));
    }
  }

  // Layer: PASSADAS_COMPLETAS (Red - Color 1)
  for (const path of rawPaths) {
    if (path.length < 2) continue;
    lines.push(
      '0', 'LWPOLYLINE',
      '5', getHandle(),
      '100', 'AcDbEntity',
      '8', 'PASSADAS_COMPLETAS',
      '100', 'AcDbPolyline',
      '90', path.length.toString(),
      '70', '0'
    );

    for (const [x, y] of path) {
      lines.push('10', x.toFixed(4), '20', y.toFixed(4));
    }
  }

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n');
}

const samplePaths = [[[10, 10], [50, 10], [50, 50], [10, 50], [10, 10]]];
const dxfText = generateDxfContent(samplePaths, samplePaths);
fs.writeFileSync('c:/DASHBOARD/scratch/test_from_file.dxf', dxfText);
console.log('Written to test_from_file.dxf');
