const test = require('node:test');
const assert = require('node:assert/strict');
const {
    normalize,
    parseMaterialText,
    matchMaterial,
    calculateMaterialCost,
    detectMaterialForJob
} = require('../material_matcher');

test('parseMaterialText extracts type, thickness, and naval flag accurately', () => {
    assert.deepEqual(parseMaterialText('chapa_mdf9mm_e6mm.txt'), {
        type: 'mdf',
        thickness: 9,
        naval: false
    });

    // Common shop typo "COMPERNSADO"
    assert.deepEqual(parseMaterialText('PAINEL_COMPERNSADO_10MM.txt'), {
        type: 'compensado',
        thickness: 10,
        naval: false
    });

    // "Naval" modifier preserved accurately
    assert.deepEqual(parseMaterialText('Compensado Naval 15mm corte'), {
        type: 'compensado',
        thickness: 15,
        naval: true
    });

    // Picks sheet thickness (15mm) instead of tool bit indicator (e6mm) and parses type without thickness
    assert.deepEqual(parseMaterialText('MDF 15mm e6mm chapa frontal'), {
        type: 'mdf',
        thickness: 15,
        naval: false
    });
    assert.deepEqual(parseMaterialText('MDF chapa frontal'), {
        type: 'mdf',
        thickness: null,
        naval: false
    });

    assert.equal(parseMaterialText('arquivo_sem_material.txt'), null);
    assert.equal(normalize('AcrÍlico Çrystal 5mm'), 'acrilico crystal 5mm');
});

test('matchMaterial prefers exact thickness and naval match, rejects mismatched thickness', () => {
    const catalog = [
        { id: 1, name: 'MDF 9mm', price: 85 },
        { id: 2, name: 'MDF 15mm', price: 130 },
        { id: 3, name: 'Compensado 15mm', price: 140 },
        { id: 4, name: 'Compensado Naval 15mm', price: 195 },
        { id: 5, name: 'Compensado', price: 110 }
    ];

    assert.equal(matchMaterial('peca_mdf9mm_fresa6.txt', catalog)?.id, 1);
    assert.equal(matchMaterial('CORTE COMPENSADO NAVAL 15MM.txt', catalog)?.id, 4);
    assert.equal(matchMaterial('CORTE COMPENSADO 15MM.txt', catalog)?.id, 3);

    // 18mm compensado falls back to generic "Compensado" without guessing wrong thickness
    assert.equal(matchMaterial('COMPERNSADO 18MM.txt', catalog)?.id, 5);

    // 6mm MDF must NOT match MDF 9mm or MDF 15mm
    assert.equal(matchMaterial('MDF 6MM TESTE.txt', catalog), null);
    assert.equal(matchMaterial('MDF 9MM', []), null);
});

test('calculateMaterialCost handles bounding area, XY dimensions, and sheet fallback', () => {
    const mat = { id: 1, name: 'MDF 9mm', price: 100, sheet_width_mm: 2700, sheet_height_mm: 1800 };

    // Explicit bounding area in m2
    assert.equal(calculateMaterialCost({ bounding_area_m2: 2.5, quantity: 2 }, mat), 500);

    // Explicit max_x / max_y in mm -> (1000/1000)*(500/1000) = 0.5m2
    assert.equal(calculateMaterialCost({ max_x: 1000, max_y: 500, quantity: 1 }, mat), 50);

    // Default full sheet fallback -> 2.7m * 1.8m = 4.86m2 * 100 = 486
    assert.equal(calculateMaterialCost({}, mat), 486);

    // Zero or invalid price
    assert.equal(calculateMaterialCost({ bounding_area_m2: 2 }, { price: 0 }), 0);
});

test('detectMaterialForJob resolves catalog match and unlinked parsed fallback', () => {
    const catalog = [{ id: 10, name: 'MDF 15mm', price: 100 }];

    const matched = detectMaterialForJob(
        { file_name: 'FACHADA_MDF_15MM.txt', bounding_area_m2: 1.5, quantity: 2 },
        catalog
    );
    assert.equal(matched.material_id, 10);
    assert.equal(matched.material_name, 'MDF 15mm');
    assert.equal(matched.material_price, 300);

    const parsedOnly = detectMaterialForJob(
        { file_name: 'PAINEL_COMPERNSADO_10MM.txt', bounding_area_m2: 2 },
        catalog
    );
    assert.deepEqual(parsedOnly, {
        material_id: null,
        material_name: 'compensado 10mm',
        material_price: 0,
        matchedMaterial: null
    });

    assert.equal(detectMaterialForJob({ file_name: 'teste_generico.txt' }, catalog), null);
});
