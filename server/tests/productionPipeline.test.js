const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    getGCodeMetadata,
    generateGCodePreviewSvg,
    matchFolderDocsForGcode,
    extractMaterialInfo,
    isFileMarkedOk,
    classifyFileExecutions
} = require('../production_pipeline');

test('getGCodeMetadata parses dimensions, feeds, spindles, and Aspire material header', (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mach3-gcode-'));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    const filePath = path.join(tmpDir, 'chapa1_mdf_15mm.txt');
    const sampleGCode = [
        '( Material Size: X=2750, Y=1850, Z=15 )',
        'G0 Z15',
        'M03 S18000',
        'G0 X0 Y0',
        'G1 Z-3 F600',
        'G1 X0 Y0 F3000',
        'G1 X100 Y0',
        'G1 X100 Y50',
        'G1 X0 Y50',
        'G1 X0 Y0',
        'G0 Z15',
        'M30'
    ].join('\n');
    fs.writeFileSync(filePath, sampleGCode, 'utf8');

    const meta = getGCodeMetadata(filePath, 1001);
    assert.ok(meta);
    assert.equal(meta.widthMm, 100);
    assert.equal(meta.heightMm, 50);
    assert.ok(meta.feeds.includes(600));
    assert.ok(meta.feeds.includes(3000));
    assert.deepEqual(meta.spindles, [18000]);
    assert.deepEqual(meta.materialSize, { width: 2750, height: 1850, thickness: 15 });
    assert.ok(meta.estimatedMinutes >= 0.5);
    assert.equal(getGCodeMetadata(filePath, 1001), meta); // cached by filePath + mtime

    assert.equal(getGCodeMetadata(path.join(tmpDir, 'does_not_exist.txt'), 1), null);
    assert.equal(getGCodeMetadata('', 0), null);
});

test('extractMaterialInfo identifies material, thickness, and batch multiplier', () => {
    const info = extractMaterialInfo('2x CHAPA MDF 15MM_CORTE.txt', 'CLIENTE DEMO');
    assert.equal(info.material, 'MDF');
    assert.equal(info.thickness, '15mm');
    assert.equal(info.targetQuantity, 2);

    const psInfo = extractMaterialInfo('PS 3MM LETREIRO.txt', 'LOJA');
    assert.equal(psInfo.material, 'PS');
    assert.equal(psInfo.thickness, '3mm');
    assert.equal(psInfo.targetQuantity, 1);
});

test('isFileMarkedOk detects completed tags and legacy confirmed files', () => {
    assert.equal(isFileMarkedOk('peca_chapa1_ok.txt'), true);
    assert.equal(isFileMarkedOk('frente_chapaok.txt'), true);
    assert.equal(isFileMarkedOk('painel_cortado.txt'), true);
    assert.equal(isFileMarkedOk('Compensado 6mm e6mm_11.txt'), true);

    assert.equal(isFileMarkedOk('painel_frente_mdf15mm.txt'), false);
    assert.equal(isFileMarkedOk(''), false);
});


test('scopeFileKey and unscopeFileKey isolate multi-tenant keys cleanly', () => {
    const { scopeFileKey, unscopeFileKey, calculateDynamicBatches } = require('../production_pipeline');

    // Legacy userId=1 keeps raw unprefixed keys for backward compatibility
    assert.equal(scopeFileKey(1, 'Projeto/chapa1.txt'), 'Projeto/chapa1.txt');
    assert.equal(unscopeFileKey(1, 'Projeto/chapa1.txt'), 'Projeto/chapa1.txt');

    // Additional tenants isolate keys with u<id>:: prefix without double-prefixing
    assert.equal(scopeFileKey(3, 'Projeto/chapa1.txt'), 'u3::Projeto/chapa1.txt');
    assert.equal(scopeFileKey(3, 'u3::Projeto/chapa1.txt'), 'u3::Projeto/chapa1.txt');
    assert.equal(unscopeFileKey(3, 'u3::Projeto/chapa1.txt'), 'Projeto/chapa1.txt');
    assert.equal(unscopeFileKey(3, 'Projeto/chapa1.txt'), 'Projeto/chapa1.txt');

    // Unconfigured tenant yields zero hardcoded client batches
    assert.deepEqual(calculateDynamicBatches([], {}), []);

    // Custom JSONB batches configured per tenant compute progress accurately
    const customBatches = calculateDynamicBatches(
        [{ file_name: 'chapa_mdf_9_parte1.txt', folder: 'ROUTER', duration_minutes: 25, start_time: '2026-06-15T10:00:00Z' }],
        {},
        [{ id: 'lote_mdf', name: 'Lote Seriado MDF', material: 'MDF 9mm', targetSheets: 12, matchKeyword: 'mdf_9' }]
    );
    assert.equal(customBatches.length, 1);
    assert.equal(customBatches[0].id, 'lote_mdf');
    assert.equal(customBatches[0].name, 'Lote Seriado MDF');
    assert.equal(customBatches[0].targetSheets, 12);
    assert.equal(customBatches[0].doneSheets, 1);
    assert.equal(customBatches[0].pendingSheets, 11);
    assert.equal(customBatches[0].status, 'em_andamento');
});

test('classifyFileExecutions counts only cuts matching previous average duration and flags stop/reload errors', () => {
    const runs = [
        { id: 1, start_time: '2026-11-17T18:01:30Z', end_time: '2026-11-17T18:12:40Z', duration_minutes: 11.17, estimated_minutes: 10.18 },
        { id: 2, start_time: '2026-11-17T18:31:28Z', end_time: '2026-11-17T18:32:35Z', duration_minutes: 1.12, estimated_minutes: 10.18 },
        { id: 3, start_time: '2026-11-17T18:32:51Z', end_time: '2026-11-17T18:41:20Z', duration_minutes: 8.48, estimated_minutes: 10.18 }
    ];
    const res = classifyFileExecutions(runs, 10.18);
    assert.equal(res.validExecs.length, 2);
    assert.equal(res.errorExecs.length, 1);
    assert.equal(res.errorExecs[0].id, 2);
    assert.equal(res.errorExecs[0].isOpError, true);

    // Multiple short stops before any full cut completes should all be flagged as operational errors
    const abortedOnly = [
        { id: 10, start_time: '2026-11-18T02:03:56Z', end_time: '2026-11-18T02:07:38Z', duration_minutes: 3.70, estimated_minutes: 36.90 },
        { id: 11, start_time: '2026-11-18T02:07:49Z', end_time: '2026-11-18T02:10:57Z', duration_minutes: 3.13, estimated_minutes: 36.90 },
        { id: 12, start_time: '2026-11-18T02:11:47Z', end_time: '2026-11-18T02:18:12Z', duration_minutes: 6.42, estimated_minutes: 36.90 }
    ];
    const resAborted = classifyFileExecutions(abortedOnly, 36.90);
    assert.equal(resAborted.validExecs.length, 0);
    assert.equal(resAborted.errorExecs.length, 3);
});

test('generateGCodePreviewSvg creates compact top-down SVG and matchFolderDocsForGcode matches material PDFs', () => {
    const svg = generateGCodePreviewSvg(
        [
            [[0, 0], [500, 0], [500, 300], [0, 300], [0, 0]],
            [[0, 0], [500, 0], [500, 300], [0, 300], [0, 0]] // duplicate Z pass
        ],
        { minX: 0, maxX: 500, minY: 0, maxY: 300 },
        { width: 2750, height: 1850, thickness: 9 }
    );
    assert.ok(svg && svg.startsWith('<svg '));
    assert.ok(svg.includes('2750×1850mm'));
    assert.ok(svg.includes('(1 contornos)'));

    const docs = [
        { name: 'compensado de 6mm.pdf', ext: '.pdf', fullPath: 'E:\\router\\TOPO\\compensado de 6mm.pdf', size: 65000, mtime: 100 },
        { name: 'MDF 9MM.pdf', ext: '.pdf', fullPath: 'E:\\router\\TOPO\\MDF 9MM.pdf', size: 120000, mtime: 100 },
        { name: 'MDF 15MM.pdf', ext: '.pdf', fullPath: 'E:\\router\\TOPO\\MDF 15MM.pdf', size: 110000, mtime: 100 },
        { name: 'mdf 9mn fundo isopor.pdf', ext: '.pdf', fullPath: 'E:\\router\\TOPO\\mdf 9mn fundo isopor.pdf', size: 75000, mtime: 100 }
    ];

    const compMatches = matchFolderDocsForGcode(
        { name: 'compensado de 6mm e6mm_1-° chapa 2x.txt', fullPath: 'E:\\router\\TOPO\\compensado de 6mm e6mm_1-° chapa 2x.txt' },
        extractMaterialInfo('compensado de 6mm e6mm_1-° chapa 2x.txt'),
        docs
    );
    assert.equal(compMatches.length, 1);
    assert.equal(compMatches[0].name, 'compensado de 6mm.pdf');

    const mdf9Matches = matchFolderDocsForGcode(
        { name: 'mdf 9mm fundo isopor_1-° chapa.txt', fullPath: 'E:\\router\\TOPO\\mdf 9mm fundo isopor_1-° chapa.txt' },
        extractMaterialInfo('mdf 9mm fundo isopor_1-° chapa.txt'),
        docs
    );
    assert.ok(mdf9Matches.some(d => d.name === 'mdf 9mn fundo isopor.pdf'));
    assert.ok(mdf9Matches.some(d => d.name === 'MDF 9MM.pdf'));
    assert.ok(!mdf9Matches.some(d => d.name === 'MDF 15MM.pdf'));

    // Casamento específico por material + número da chapa para imagens salvas na pasta
    const sheetDocs = [
        { name: 'mdf 6mm chapa 1.png', ext: '.png', fullPath: 'E:\\router\\PORTA\\mdf 6mm chapa 1.png', size: 80000, mtime: 200 },
        { name: 'mdf 6mm chapa 2.jpg', ext: '.jpg', fullPath: 'E:\\router\\PORTA\\mdf 6mm chapa 2.jpg', size: 82000, mtime: 200 },
        { name: 'mdf 6mm.pdf', ext: '.pdf', fullPath: 'E:\\router\\PORTA\\mdf 6mm.pdf', size: 120000, mtime: 200 },
        { name: 'isopor 100mm chapa 1.jpg', ext: '.jpg', fullPath: 'E:\\router\\ISOPOR\\isopor 100mm chapa 1.jpg', size: 90000, mtime: 200 }
    ];

    const chapa1Matches = matchFolderDocsForGcode(
        { name: 'mdf 6mm_1-° chapa e6mm.txt', fullPath: 'E:\\router\\PORTA\\mdf 6mm_1-° chapa e6mm.txt' },
        extractMaterialInfo('mdf 6mm_1-° chapa e6mm.txt'),
        sheetDocs
    );
    assert.equal(chapa1Matches[0].name, 'mdf 6mm chapa 1.png');
    assert.equal(chapa1Matches[0].exactSheetMatch, true);
    assert.ok(chapa1Matches.some(d => d.name === 'mdf 6mm.pdf'));
    assert.ok(!chapa1Matches.some(d => d.name === 'mdf 6mm chapa 2.jpg'));

    const chapa2Matches = matchFolderDocsForGcode(
        { name: 'mdf 6mm_2-° chapa vbit.txt', fullPath: 'E:\\router\\PORTA\\mdf 6mm_2-° chapa vbit.txt' },
        extractMaterialInfo('mdf 6mm_2-° chapa vbit.txt'),
        sheetDocs
    );
    assert.equal(chapa2Matches[0].name, 'mdf 6mm chapa 2.jpg');
    assert.ok(!chapa2Matches.some(d => d.name === 'mdf 6mm chapa 1.png'));
    const chapa2Pdf = chapa2Matches.find(d => d.name === 'mdf 6mm.pdf');
    assert.ok(chapa2Pdf);
    assert.equal(chapa2Pdf.targetPage, 2);

    const isopor1Matches = matchFolderDocsForGcode(
        { name: '1 pvc 100mm b10mm.txt', fullPath: 'E:\\router\\ISOPOR\\1 pvc 100mm b10mm.txt' },
        extractMaterialInfo('1 pvc 100mm b10mm.txt', 'E:\\router\\ISOPOR'),
        sheetDocs
    );
    assert.equal(isopor1Matches[0].name, 'isopor 100mm chapa 1.jpg');
    assert.equal(isopor1Matches[0].exactSheetMatch, true);
});
