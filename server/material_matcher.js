/**
 * Reconhecimento automático e tolerante de material a partir do nome do arquivo.
 *
 * Aceita variações de digitação como:
 *   "mdf 9mm", "mdf9mm", "mdf 9 mm", "MDF_9MM", "MDF-9", "chapa 3 mdf9mm e6mm"
 *   "compensado 10mm", "comp 10", "COMPERNSADO 10MM" (erro de digitação)
 *   "pvc100mm", "acrilico 4mm", "acrílico cristal 4 mm", etc.
 *
 * Regras:
 *  - Identifica o TIPO do material (mdf, compensado, pvc, acm...) com tolerância a erros (Levenshtein).
 *  - A ESPESSURA é o número imediatamente após o tipo (ignora a fresa "E6MM"/"B10MM").
 *  - Escolhe o material cadastrado de mesmo tipo + mesma espessura.
 *    Se o arquivo citar "naval", prioriza o material naval (e vice-versa).
 *  - Se nenhum cadastro tiver a espessura, usa um cadastro genérico do tipo sem espessura (ex: "pvc", "acm").
 */

const TYPE_ALIASES = {
    mdf: ['mdf'],
    compensado: ['compensado', 'comp', 'compens', 'compensad'],
    pvc: ['pvc'],
    pvb: ['pvb'],
    acm: ['acm', 'aluminio composto'],
    acrilico: ['acrilico', 'acril'],
    policarbonato: ['policarbonato', 'policarb'],
    psai: ['psai'],
    ps: ['ps'],
    isopor: ['isopor', 'eps'],
    inox: ['inox']
};

function stripAccents(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalize(s) {
    return stripAccents(s)
        .toLowerCase()
        .replace(/\.[a-z0-9]{2,5}$/i, '')      // remove extensão
        .replace(/[_\-+().,;]/g, ' ')
        .replace(/(\d),(\d)/g, '$1.$2')
        .replace(/\s+/g, ' ')
        .trim();
}

function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
        const cur = [i];
        for (let j = 1; j <= n; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        }
        prev = cur;
    }
    return prev[n];
}

// Separa palavras grudadas em números: "mdf9mm" -> "mdf 9mm", "1pvc100mm" -> "1 pvc 100mm"
function splitTokens(text) {
    return normalize(text)
        .replace(/([a-z])(\d)/g, '$1 $2')
        .replace(/(\d)([a-z])/g, '$1 $2')
        .replace(/(\d)\s*mm\b/g, '$1mm')
        .split(' ')
        .filter(Boolean);
}

function matchTypeWord(word) {
    if (!word || /^\d/.test(word)) return null;
    for (const [type, aliases] of Object.entries(TYPE_ALIASES)) {
        for (const alias of aliases) {
            if (word === alias) return type;
        }
    }
    // Tolerância a erros de digitação apenas para palavras longas (evita falsos positivos)
    if (word.length >= 5) {
        for (const [type, aliases] of Object.entries(TYPE_ALIASES)) {
            for (const alias of aliases) {
                if (alias.length < 5) continue;
                const maxDist = alias.length >= 8 ? 2 : 1;
                if (levenshtein(word, alias) <= maxDist) return type;
                if (word.startsWith(alias) && alias.length >= 6) return type;
            }
        }
    }
    return null;
}

/**
 * Extrai {type, thickness, naval} de um texto (nome de arquivo ou nome do material cadastrado).
 */
function parseMaterialText(text) {
    const tokens = splitTokens(text);
    for (let i = 0; i < tokens.length; i++) {
        const type = matchTypeWord(tokens[i]);
        if (!type) continue;

        // Espessura: primeiro número logo após o tipo (pulando palavras descritivas curtas como "cru", "cristal", "expandido")
        let thickness = null;
        for (let j = i + 1; j < Math.min(tokens.length, i + 4); j++) {
            const t = tokens[j];
            const num = t.match(/^(\d+(?:\.\d+)?)(?:mm|m)?$/);
            if (num) { thickness = parseFloat(num[1]); break; }
            // Para ao encontrar a fresa (e6mm, b10mm) ou outro material
            if (/^[eb]\d/.test(t) || matchTypeWord(t)) break;
        }
        const naval = /\bnaval\b/.test(normalize(text));
        return { type, thickness, naval };
    }
    return null;
}

/**
 * Retorna o material cadastrado que melhor corresponde ao nome do arquivo, ou null.
 */
function matchMaterial(fileName, materials = []) {
    const parsed = parseMaterialText(fileName);
    if (!parsed || !materials.length) return null;

    const candidates = materials
        .map(m => ({ m, p: parseMaterialText(m.name) }))
        .filter(c => c.p && c.p.type === parsed.type);
    if (!candidates.length) return null;

    const score = (c) => {
        let s = 0;
        if (parsed.thickness != null && c.p.thickness != null) {
            if (Math.abs(parsed.thickness - c.p.thickness) < 0.01) s += 100;
            else return -1; // espessura diferente: descarta
        } else if (parsed.thickness != null && c.p.thickness == null) {
            s += 10; // cadastro genérico do tipo (ex: "pvc")
        } else if (parsed.thickness == null && c.p.thickness == null) {
            s += 50;
        } else {
            s += 5;
        }
        if (parsed.naval === c.p.naval) s += 20;
        return s;
    };

    let best = null, bestScore = -1;
    for (const c of candidates) {
        const s = score(c);
        if (s > bestScore) { bestScore = s; best = c.m; }
    }
    return bestScore > 0 ? best : null;
}

/**
 * Mesmo cálculo de insumo usado no frontend (insumoCalculator.js).
 */
function calculateMaterialCost(job, mat) {
    const price = Math.max(0, Number(mat.price) || 0);
    let areaM2;
    if (job.bounding_area_m2 && Number(job.bounding_area_m2) > 0) {
        areaM2 = Number(job.bounding_area_m2);
    } else if (job.max_x && job.max_y && Number(job.max_x) > 0 && Number(job.max_y) > 0) {
        areaM2 = (Number(job.max_x) / 1000) * (Number(job.max_y) / 1000);
    } else {
        const w = Math.max(100, Number(mat.sheet_width_mm) || 2700);
        const h = Math.max(100, Number(mat.sheet_height_mm) || 1800);
        areaM2 = (w / 1000) * (h / 1000);
    }
    return Number((areaM2 * price * (Number(job.quantity) || 1)).toFixed(2));
}

/**
 * Retorna { material_id, material_name, material_price } para um job.
 */
function detectMaterialForJob(job, materials = []) {
    const fileName = job.file_name || '';
    const matched = matchMaterial(fileName, materials);
    if (matched) {
        return {
            material_id: matched.id,
            material_name: matched.name,
            material_price: calculateMaterialCost(job, matched),
            matchedMaterial: matched
        };
    }
    const parsed = parseMaterialText(fileName);
    if (parsed) {
        let name = parsed.type;
        if (parsed.thickness) name += ` ${parsed.thickness}mm`;
        if (parsed.naval) name += ' naval';
        return {
            material_id: null,
            material_name: name,
            material_price: 0,
            matchedMaterial: null
        };
    }
    return null;
}

module.exports = { matchMaterial, parseMaterialText, calculateMaterialCost, detectMaterialForJob, normalize };
