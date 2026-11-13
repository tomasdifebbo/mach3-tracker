const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    getGCodeMetadata,
    extractMaterialInfo,
    isFileMarkedOk
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
