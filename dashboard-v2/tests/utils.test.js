import test from 'node:test';
import assert from 'node:assert/strict';

import { patchGcodeContent } from '../src/utils/gcodePatcher.js';
import { parseGCode, deduplicatePaths, generateDxfContent, processGCodeToDxf } from '../src/utils/gcodeToDxf.js';
import { calculateInsumo } from '../src/utils/insumoCalculator.js';
import { isFileMarkedOk } from '../src/utils/fileChecklistUtils.js';
import { normalizeStr, matchKanbanTitle } from '../src/components/encarregado/kanbanUtils.js';
import { formatDuration, matchesOperatorLog, calcMergedWorkedMinutes } from '../src/components/operador/operadorUtils.js';
import { isNightShiftHour, resolveShiftOperator, extractProjectName } from '../src/utils/tenantUtils.js';

test('patchGcodeContent injects M101/M102 macros, updates spindle speed, and deduplicates', () => {
  const res = patchGcodeContent('G0 Z10\nM03 S12000\nG1 X10 Y10\nM30', '18000');
  assert.equal(res.patchedContent, 'G0 Z10\nM03 S18000\nM101\nG1 X10 Y10\nM102\nM30');
  assert.equal(res.m101Line, 3);
  assert.equal(res.m102Line, 5);
  assert.equal(res.spindleReplacedCount, 1);

  // Idempotent on already-patched G-Code (does not double M101 / M102)
  const repatched = patchGcodeContent(res.patchedContent, '18000');
  assert.equal(repatched.patchedContent, res.patchedContent);

  // Fallback when M03 and M30 are missing
  const fallback = patchGcodeContent('G0 Z10\nG0 X0 Y0\nG1 X50 Y50');
  const lines = fallback.patchedContent.split('\n');
  assert.equal(lines.filter(l => l === 'M101').length, 1);
  assert.equal(lines.filter(l => l === 'M102').length, 1);
  assert.equal(lines[lines.length - 1], 'M102');

  // Empty input
  assert.equal(patchGcodeContent('').patchedContent, '');
});

test('gcodeToDxf parses G0/G1 passes, deduplicates repeated Z depth passes, and generates DXF', () => {
  const twoPassSquare = [
    'G0 Z5',
    'G0 X0 Y0',
    'G1 Z-2',
    'G1 X10 Y0',
    'G1 X10 Y10',
    'G1 X0 Y10',
    'G1 X0 Y0',
    'G0 Z5',
    'G0 X0 Y0',
    'G1 Z-4',
    'G1 X10 Y0',
    'G1 X10 Y10',
    'G1 X0 Y10',
    'G1 X0 Y0',
    'G0 Z5'
  ].join('\n');

  const rawPaths = parseGCode(twoPassSquare);
  assert.equal(rawPaths.length, 2);

  const uniquePaths = deduplicatePaths(rawPaths);
  assert.equal(uniquePaths.length, 1);

  const dxf = generateDxfContent(uniquePaths, rawPaths);
  assert.ok(dxf.includes('PECAS_2D'));
  assert.ok(dxf.includes('PASSADAS_COMPLETAS'));
  assert.ok(dxf.includes('POLYLINE'));
  assert.ok(dxf.includes('EOF'));

  const result = processGCodeToDxf(twoPassSquare, 'quadrado.txt');
  assert.equal(result.success, true);
  assert.equal(result.outFileName, 'quadrado.dxf');
  assert.equal(result.stats.rawPassesCount, 2);
  assert.equal(result.stats.uniquePiecesCount, 1);
  assert.equal(result.stats.totalWidth, 10);
  assert.equal(result.stats.totalHeight, 10);
  assert.equal(result.pieceDetails[0].isClosed, true);
  if (result.downloadUrl) URL.revokeObjectURL(result.downloadUrl);

  assert.throws(
    () => processGCodeToDxf('G0 Z15\nM30'),
    /Nenhum movimento de corte/
  );
});

test('calculateInsumo computes m2 area and cost across bounding area, XY, and sheet fallback', () => {
  assert.deepEqual(calculateInsumo({ pricePerM2: 100, boundingAreaM2: 2.5 }), {
    linearMeters: 0,
    areaM2: 2.5,
    totalCost: 250
  });

  assert.deepEqual(calculateInsumo({ pricePerM2: 100, maxXMm: 1000, maxYMm: 500 }), {
    linearMeters: 0,
    areaM2: 0.5,
    totalCost: 50
  });

  assert.deepEqual(calculateInsumo({ pricePerM2: 100 }), {
    linearMeters: 0,
    areaM2: 4.86,
    totalCost: 486
  });

  assert.deepEqual(calculateInsumo({ pricePerM2: 50, sheetWidthMm: 2000, sheetHeightMm: 1000 }), {
    linearMeters: 0,
    areaM2: 2,
    totalCost: 100
  });
});

test('isFileMarkedOk identifies operator OK patterns and confirmed archive files', () => {
  assert.equal(isFileMarkedOk('chapa_1_ok.txt'), true);
  assert.equal(isFileMarkedOk('lateral_chapaok.txt'), true);
  assert.equal(isFileMarkedOk('fundo_cortado.txt'), true);
  assert.equal(isFileMarkedOk('Compensado 6mm e6mm_11.txt'), true);

  assert.equal(isFileMarkedOk('chapa_1_mdf9mm.txt'), false);
  assert.equal(isFileMarkedOk(''), false);
});

test('kanbanUtils normalizes filenames and rejects non-specific false positive matches', () => {
  assert.equal(normalizeStr('Peça Acrílico #2.txt'), 'peca acrilico 2');
  assert.equal(matchKanbanTitle('Frente Hogwarts.txt', '2640', 'Frente Hogwarts'), true);
  assert.equal(matchKanbanTitle('mdf 9mm.txt', '', 'chapa 2 MDF 9MM VETOR LOGO TARTARUGA e4mm'), false);
});

test('operadorUtils formats durations, matches logs, and merges overlapping shift intervals', () => {
  assert.equal(formatDuration(null), '00:00:00');
  assert.equal(formatDuration(90), '01:30:00');

  const op = { id: 6, name: 'Tomas' };
  assert.equal(matchesOperatorLog({ operator_id: 6, operator_name: 'Outro' }, op), true);
  assert.equal(matchesOperatorLog({ operator_name: ' tomas ' }, op), true);
  assert.equal(matchesOperatorLog({ operator_id: 9, operator_name: 'Brenno' }, op), false);

  const workedMin = calcMergedWorkedMinutes([
    { status: 'disponivel', start_time: '2026-06-15T10:00:00Z', end_time: '2026-06-15T11:00:00Z' },
    { status: 'limpeza',    start_time: '2026-06-15T10:30:00Z', end_time: '2026-06-15T11:30:00Z' }, // overlaps 30m -> merged = 90m
    { status: 'externo',    start_time: '2026-06-15T12:00:00Z', end_time: '2026-06-15T12:30:00Z' }, // +30m = 120m
    { status: 'almoco',     start_time: '2026-06-15T11:30:00Z', end_time: '2026-06-15T12:00:00Z' }, // excluded
    { status: 'ausente',    start_time: '2026-06-15T13:00:00Z', end_time: '2026-06-15T14:00:00Z' }, // excluded
    { status: 'fim_expediente', start_time: '2026-06-15T18:00:00Z', end_time: '2026-06-15T19:00:00Z' } // excluded
  ]);
  assert.equal(Math.round(workedMin), 120);
});

test('tenantUtils resolves shift operators and normalizes project names dynamically', () => {
  assert.equal(isNightShiftHour(new Date('2026-06-15T22:30:00')), true);
  assert.equal(isNightShiftHour(new Date('2026-06-15T14:00:00')), false);

  const dayOp = resolveShiftOperator({
    user: { default_day_operator: 'Carlos', default_night_operator: 'Mateus' },
    operators: [],
    date: new Date('2026-06-15T14:00:00')
  });
  assert.equal(dayOp, 'Carlos');

  const nightOpFromList = resolveShiftOperator({
    user: { default_night_operator: 'Mateus' },
    operators: [{ name: 'Rafael', shift: 'Noite' }],
    date: new Date('2026-06-15T23:00:00')
  });
  assert.equal(nightOpFromList, 'Rafael');

  const neutralFallback = resolveShiftOperator({
    user: null,
    operators: [],
    date: new Date('2026-06-15T23:00:00')
  });
  assert.equal(neutralFallback, 'Operador Noite');

  assert.equal(
    extractProjectName('E:\\ARQUIVOS 2026\\ROUTER\\STAND ALPHA\\ISOPOR\\chapa1.txt'),
    'STAND ALPHA'
  );
  assert.equal(
    extractProjectName('D:\\CLIENTES\\LOJA BETA\\chapa2.txt'),
    'CLIENTES'
  );
});
