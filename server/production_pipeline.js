const fs = require('fs');
const path = require('path');

const CAD_EXTS = ['.cdr']; // Apenas arquivos .CDR do CorelDRAW
const ASPIRE_EXTS = ['.eps', '.dxf']; // Arquivos vetoriais (.EPS/.DXF) para abrir e preparar no Aspire
const ASPIRE_CRV_EXTS = ['.crv3d', '.crv']; // Arquivos nativos de projeto do Aspire/VCarve
const GCODE_EXTS = ['.txt', '.nc', '.tap', '.gcode', '.cnc'];
const DOC_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp']; // PDFs e fotos de layout das peças na pasta
const IGNORED_DOC_RE = /^(ficha[_\s-]*tecnica|relatorio|requisicao|manual[_\s-])/i;

function scanDirRecursive(dir, maxDepth = 8, depth = 0) {
    let files = [];
    if (depth > maxDepth || !fs.existsSync(dir)) return files;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
            if (ent.name.startsWith('.') || ent.name === 'Thumbs.db') continue;
            const lowerName = ent.name.toLowerCase();
            if (lowerName.startsWith('cópia_de_segurança') || lowerName.startsWith('copia_de_seguranca') || lowerName.startsWith('backup_of_') || lowerName.startsWith('manual_') || lowerName.startsWith('@')) continue;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                if (lowerName.includes('backup') || lowerName.includes('cópia') || lowerName.includes('copia') || lowerName === 'lixeira' || lowerName.startsWith('@')) continue;
                files = files.concat(scanDirRecursive(full, maxDepth, depth + 1));
            } else if (ent.isFile()) {
                const ext = path.extname(ent.name).toLowerCase();
                const isDoc = DOC_EXTS.includes(ext) && !IGNORED_DOC_RE.test(ent.name);
                if (CAD_EXTS.includes(ext) || ASPIRE_EXTS.includes(ext) || ASPIRE_CRV_EXTS.includes(ext) || GCODE_EXTS.includes(ext) || isDoc) {
                    const stat = fs.statSync(full);
                    let type = 'cad';
                    if (ASPIRE_EXTS.includes(ext)) type = 'aspire';
                    else if (ASPIRE_CRV_EXTS.includes(ext)) type = 'crv';
                    else if (GCODE_EXTS.includes(ext)) type = 'gcode';
                    else if (isDoc) type = 'doc';
                    files.push({
                        name: ent.name,
                        ext,
                        type,
                        fullPath: full,
                        size: stat.size,
                        mtime: stat.mtimeMs,
                        mtimeDate: stat.mtime
                    });
                }
            }
        }
    } catch { /* ignore */ }
    return files;
}

// Gera SVG vetorial compacto (vista de cima do percurso de corte) para o operador identificar e anotar peças
function generateGCodePreviewSvg(rawPaths, bounds, materialSize = null) {
    if (!Array.isArray(rawPaths) || rawPaths.length === 0) return null;
    if (!bounds || !isFinite(bounds.minX) || !isFinite(bounds.maxX) || !isFinite(bounds.minY) || !isFinite(bounds.maxY)) {
        return null;
    }

    const cutW = Math.max(1, bounds.maxX - bounds.minX);
    const cutH = Math.max(1, bounds.maxY - bounds.minY);
    if (cutW < 1 && cutH < 1) return null;

    // Deduplica passes repetidos em Z (mesmo contorno cortado em múltiplas profundidades)
    const uniquePaths = [];
    const seenBboxes = [];
    const bboxTol = Math.max(3, Math.min(cutW, cutH) * 0.005);

    for (let i = 0; i < rawPaths.length; i++) {
        const pts = rawPaths[i];
        if (!pts || pts.length < 2) continue;
        let pMinX = Infinity, pMaxX = -Infinity, pMinY = Infinity, pMaxY = -Infinity;
        for (let j = 0; j < pts.length; j++) {
            const x = pts[j][0];
            const y = pts[j][1];
            if (x < pMinX) pMinX = x;
            if (x > pMaxX) pMaxX = x;
            if (y < pMinY) pMinY = y;
            if (y > pMaxY) pMaxY = y;
        }
        const pw = pMaxX - pMinX;
        const ph = pMaxY - pMinY;
        if (pw < 1 && ph < 1) continue;

        let isDup = false;
        for (let k = 0; k < seenBboxes.length; k++) {
            const b = seenBboxes[k];
            if (
                Math.abs(pMinX - b[0]) <= bboxTol &&
                Math.abs(pMinY - b[1]) <= bboxTol &&
                Math.abs(pMaxX - b[2]) <= bboxTol &&
                Math.abs(pMaxY - b[3]) <= bboxTol &&
                Math.abs(pts.length - b[4]) <= Math.max(6, Math.round(b[4] * 0.25))
            ) {
                isDup = true;
                break;
            }
        }
        if (!isDup) {
            seenBboxes.push([pMinX, pMinY, pMaxX, pMaxY, pts.length]);
            uniquePaths.push(pts);
            if (uniquePaths.length >= 220) break;
        }
    }

    if (uniquePaths.length === 0) return null;

    // Define área da chapa (usa materialSize se cobrir o corte razoavelmente; caso contrário usa bounding box do corte)
    let viewMinX = bounds.minX;
    let viewMaxX = bounds.maxX;
    let viewMinY = bounds.minY;
    let viewMaxY = bounds.maxY;
    let showSheetFrame = false;
    let sheetW = cutW;
    let sheetH = cutH;

    if (materialSize && materialSize.width > 10 && materialSize.height > 10) {
        const msW = Number(materialSize.width);
        const msH = Number(materialSize.height);
        if (bounds.minX >= -50 && bounds.minY >= -50 && bounds.maxX <= msW + 100 && bounds.maxY <= msH + 100) {
            viewMinX = Math.min(0, bounds.minX);
            viewMinY = Math.min(0, bounds.minY);
            viewMaxX = Math.max(msW, bounds.maxX);
            viewMaxY = Math.max(msH, bounds.maxY);
            sheetW = msW;
            sheetH = msH;
            showSheetFrame = true;
        }
    }

    const spanX = Math.max(1, viewMaxX - viewMinX);
    const spanY = Math.max(1, viewMaxY - viewMinY);

    // Projeta coordenadas para um canvas SVG normalizado (largura máx 600px, altura proporcional)
    const targetW = 600;
    const scale = Math.min(targetW / spanX, 420 / spanY);
    const pad = 16;
    const svgW = Math.round(spanX * scale + pad * 2);
    const svgH = Math.round(spanY * scale + pad * 2);

    const tx = (x) => ((x - viewMinX) * scale + pad).toFixed(1);
    const ty = (y) => ((viewMaxY - y) * scale + pad).toFixed(1);

    // Limita pontos totais no SVG para manter payload rápido (~2-6 KB) mesmo em arquivos 3D densos
    const totalPtsRaw = uniquePaths.reduce((s, p) => s + p.length, 0);
    const step = totalPtsRaw > 1400 ? Math.ceil(totalPtsRaw / 1400) : 1;

    const pathSegments = [];
    for (let i = 0; i < uniquePaths.length; i++) {
        const pts = uniquePaths[i];
        const parts = [`M${tx(pts[0][0])},${ty(pts[0][1])}`];
        let lastKeptX = pts[0][0];
        let lastKeptY = pts[0][1];
        const minSegDist = Math.max(1.2 / Math.max(0.01, scale), 1.5);

        for (let j = step; j < pts.length; j += step) {
            const px = pts[j][0];
            const py = pts[j][1];
            const dx = px - lastKeptX;
            const dy = py - lastKeptY;
            if (j === pts.length - 1 || (dx * dx + dy * dy) >= minSegDist * minSegDist) {
                parts.push(`L${tx(px)},${ty(py)}`);
                lastKeptX = px;
                lastKeptY = py;
            }
        }
        const lastPt = pts[pts.length - 1];
        if (lastPt[0] !== lastKeptX || lastPt[1] !== lastKeptY) {
            parts.push(`L${tx(lastPt[0])},${ty(lastPt[1])}`);
        }
        pathSegments.push(parts.join(''));
    }

    const dAttr = pathSegments.join(' ');
    if (!dAttr) return null;

    const sheetRect = showSheetFrame
        ? `<rect x="${tx(0)}" y="${ty(sheetH)}" width="${(sheetW * scale).toFixed(1)}" height="${(sheetH * scale).toFixed(1)}" fill="#ffffff" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="6,4" rx="2"/>`
        : `<rect x="${pad}" y="${pad}" width="${(spanX * scale).toFixed(1)}" height="${(spanY * scale).toFixed(1)}" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="4,4" rx="2"/>`;

    const dimLabel = showSheetFrame
        ? `Chapa ${Math.round(sheetW)}×${Math.round(sheetH)}mm · Corte ${Math.round(cutW)}×${Math.round(cutH)}mm`
        : `Área de Corte ${Math.round(cutW)}×${Math.round(cutH)}mm`;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgW} ${svgH}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" style="background:#ffffff;display:block;">${sheetRect}<path d="${dAttr}" fill="rgba(241,245,249,0.55)" stroke="#0f172a" stroke-width="1.35" stroke-linejoin="round" stroke-linecap="round"/><text x="${pad + 4}" y="${svgH - 4}" font-family="Arial,sans-serif" font-size="9.5" font-weight="700" fill="#475569">${dimLabel} (${uniquePaths.length} contornos)</text></svg>`;
}

// Cache em memória para parser ultrarrápido de arquivos G-Code
const gcodeMetadataCache = new Map();

function getGCodeMetadata(filePath, mtime = 0) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const cacheKey = `${filePath}_${mtime}`;
    if (gcodeMetadataCache.has(cacheKey)) {
        return gcodeMetadataCache.get(cacheKey);
    }

    try {
        const text = fs.readFileSync(filePath, 'utf8');
        const lines = text.split(/\r?\n/);
        const hasZ = /Z\s*-?\d+/i.test(text);
        let curX = 0, curY = 0, curZ = 20;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
        let hasCoords = false;
        let curFeed = 3000;
        const rapidFeed = 8000;
        let mode = 0; // 0 = G0, 1 = G1/G2/G3
        let cutTimeMin = 0;
        let rapidTimeMin = 0;
        let cutDistMm = 0;
        const feedsSet = new Set();
        const spindlesSet = new Set();
        let materialSize = null;

        // Coleta contornos 2D durante a mesma varredura para gerar preview SVG da chapa
        const rawPaths = [];
        let currentPath = [];
        let isCuttingPath = false;

        const numRe = /([XYZFS])([-+]?\d*\.?\d+)/gi;
        const gRe = /G0*([0123])(?=[A-Z\s]|$)/i;
        const matSizeRe = /X=\s*([\d.]+),\s*Y=\s*([\d.]+),\s*Z=\s*([\d.]+)/i;

        for (let i = 0; i < lines.length; i++) {
            const raw = lines[i].trim();
            if (!raw) continue;
            if (raw.startsWith('(') || raw.startsWith(';') || raw.startsWith('%')) {
                const matM = raw.match(matSizeRe);
                if (matM) {
                    materialSize = {
                        width: parseFloat(matM[1]),
                        height: parseFloat(matM[2]),
                        thickness: parseFloat(matM[3])
                    };
                }
                continue;
            }

            const gMatch = raw.match(gRe);
            if (gMatch) {
                mode = parseInt(gMatch[1], 10) === 0 ? 0 : 1;
            }

            let nx = curX, ny = curY, nz = curZ;
            let moved = false;
            numRe.lastIndex = 0;
            let m;
            while ((m = numRe.exec(raw)) !== null) {
                const axis = m[1].toUpperCase();
                const val = parseFloat(m[2]);
                if (isNaN(val)) continue;
                if (axis === 'X') { nx = val; moved = true; }
                else if (axis === 'Y') { ny = val; moved = true; }
                else if (axis === 'Z') { nz = val; moved = true; }
                else if (axis === 'F' && val > 0) { curFeed = val; feedsSet.add(Math.round(val)); }
                else if (axis === 'S' && val > 0) { spindlesSet.add(Math.round(val)); }
            }

            if (moved) {
                const dx = nx - curX;
                const dy = ny - curY;
                const dz = nz - curZ;
                const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                if (dist > 0) {
                    if (mode === 0) {
                        rapidTimeMin += dist / rapidFeed;
                    } else {
                        const effFeed = curFeed > 0 ? curFeed : 2500;
                        cutTimeMin += (dist / effFeed) * 1.12; // desaceleração e curvas Mach3
                        cutDistMm += dist;
                        if (nx !== curX || ny !== curY) {
                            hasCoords = true;
                            if (nx < minX) minX = nx;
                            if (nx > maxX) maxX = nx;
                            if (ny < minY) minY = ny;
                            if (ny > maxY) maxY = ny;
                        }
                        if (nz < minZ) minZ = nz;
                        if (nz > maxZ) maxZ = nz;
                    }
                }

                // Rastreia polilinhas 2D de corte (Z abaixo da superfície segura ou 2D puro)
                const cuttingNow = hasZ ? (mode === 1 && nz <= 0.5) : (mode === 1);
                if (cuttingNow) {
                    if (!isCuttingPath) {
                        isCuttingPath = true;
                        currentPath = [[curX, curY]];
                    }
                    if (nx !== curX || ny !== curY) {
                        const last = currentPath[currentPath.length - 1];
                        if (!last || Math.abs(nx - last[0]) >= 1.5 || Math.abs(ny - last[1]) >= 1.5) {
                            currentPath.push([nx, ny]);
                        }
                    }
                } else if (isCuttingPath) {
                    if (currentPath.length >= 2 && rawPaths.length < 1500) {
                        rawPaths.push(currentPath);
                    }
                    currentPath = [];
                    isCuttingPath = false;
                }

                curX = nx; curY = ny; curZ = nz;
            }
        }

        if (isCuttingPath && currentPath.length >= 2 && rawPaths.length < 1500) {
            rawPaths.push(currentPath);
        }

        const widthMm = hasCoords ? Math.round(maxX - minX) : (materialSize ? Math.round(materialSize.width) : 0);
        const heightMm = hasCoords ? Math.round(maxY - minY) : (materialSize ? Math.round(materialSize.height) : 0);
        const depthMm = minZ !== Infinity && maxZ !== -Infinity ? Math.round(Math.abs(maxZ - minZ)) : (materialSize ? Math.round(materialSize.thickness) : 0);
        const cutMeters = Math.round(cutDistMm / 1000);
        const estimatedMinutes = Math.max(0.5, parseFloat((cutTimeMin + rapidTimeMin).toFixed(1)));
        const previewSvg = hasCoords ? generateGCodePreviewSvg(rawPaths, { minX, maxX, minY, maxY }, materialSize) : null;

        const result = {
            widthMm,
            heightMm,
            depthMm,
            cutMeters,
            estimatedMinutes,
            cutTimeMin: parseFloat(cutTimeMin.toFixed(1)),
            rapidTimeMin: parseFloat(rapidTimeMin.toFixed(1)),
            feeds: Array.from(feedsSet).sort((a, b) => b - a).slice(0, 2),
            spindles: Array.from(spindlesSet).sort((a, b) => b - a).slice(0, 1),
            materialSize,
            previewSvg
        };
        gcodeMetadataCache.set(cacheKey, result);
        return result;
    } catch {
        return null;
    }
}

// Associa automaticamente PDFs e imagens dentro da mesma pasta cujo nome corresponda ao material do G-Code
function matchFolderDocsForGcode(gf, matInfo, docsInFolder = []) {
    if (!gf || !Array.isArray(docsInFolder) || docsInFolder.length === 0) return [];

    const normText = (s) => String(s || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/(\d+)\s*mn\b/gi, '$1mm')
        .replace(/[_\-()[\]]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const gStem = normText(path.parse(gf.name || '').name);
    const gMat = matInfo?.material ? normText(matInfo.material) : '';
    const gThick = matInfo?.thickness ? normText(matInfo.thickness) : '';

    const GENERIC_TOKENS = new Set([
        'de', 'da', 'do', 'dos', 'das', 'em', 'para', 'com', 'ok', 'chapa', 'chapas',
        'corte', 'cortes', 'todas', 'as', 'os', 'cotadas', 'vetorial', 'escalonada', 'final', 'otimizado'
    ]);

    const scored = [];
    for (const d of docsInFolder) {
        const dStemRaw = path.parse(d.name || '').name;
        const dStem = normText(dStemRaw);
        if (!dStem) continue;

        const dMatInfo = extractMaterialInfo(dStemRaw.replace(/(\d+)\s*mn\b/gi, '$1mm'), d.fullPath || '');
        const dMat = dMatInfo?.material ? normText(dMatInfo.material) : '';
        const dThick = dMatInfo?.thickness ? normText(dMatInfo.thickness) : '';

        let score = 0;

        // 1. Prefixo exato (ex: "compensado de 6mm.pdf" -> "compensado de 6mm e6mm_1-° chapa 2x.txt")
        if (gStem === dStem || gStem.startsWith(dStem + ' ') || dStem.startsWith(gStem + ' ')) {
            score = 100;
        }

        // 2. Casamento por material + espessura (ex: "MDF 9MM.pdf", "compensado 10mm.pdf", "MDF 9MM RAMPA A.pdf")
        if (score === 0 && gMat && dMat && gMat === dMat) {
            const thickCompatible = !dThick || !gThick || dThick === gThick;
            if (thickCompatible) {
                // Verifica se o PDF possui qualificadores extras (ex: "rampa a", "escada c", "portas")
                const matWords = new Set([...dMat.split(' '), dThick, 'mdf', 'compensado', 'comp', 'isopor', 'eps', 'pvc', 'acm', 'acrilico', 'ps']);
                const extraTokens = dStem.split(' ').filter(t => t && !GENERIC_TOKENS.has(t) && !matWords.has(t) && !/^\d+mm$/.test(t));

                if (extraTokens.length === 0) {
                    score = dThick && gThick ? 85 : 65;
                } else {
                    const matchedExtra = extraTokens.filter(t => gStem.includes(t));
                    if (matchedExtra.length === extraTokens.length) {
                        score = 95;
                    } else if (matchedExtra.length > 0) {
                        score = 75;
                    }
                }
            }
        }

        if (score > 0) {
            const ext = (d.ext || path.extname(d.name || '')).toLowerCase();
            const mimeType = ext === '.pdf'
                ? 'application/pdf'
                : ext === '.png'
                    ? 'image/png'
                    : ext === '.webp'
                        ? 'image/webp'
                        : 'image/jpeg';
            scored.push({
                score,
                doc: {
                    name: d.name,
                    ext,
                    fullPath: d.fullPath,
                    size: d.size || 0,
                    mtime: d.mtime || 0,
                    mimeType,
                    autoMatched: true
                }
            });
        }
    }

    scored.sort((a, b) => b.score - a.score || (b.doc.ext === '.pdf' ? 1 : 0) - (a.doc.ext === '.pdf' ? 1 : 0));
    return scored.map(s => s.doc);
}

// Extrai inteligentemente material, espessura e quantidade do nome do arquivo (sem a extensão .eps/.cdr/.txt)
function extractMaterialInfo(name, folderPath = '') {
    const fn = path.parse(name || '').name.toLowerCase();
    const folder = (folderPath || '').toLowerCase();
    let material = null;
    if (folder.includes('isopor') || folder.includes('eps') || fn.includes('isopor') || fn.includes('eps')) material = 'Isopor EPS';
    else if (fn.includes('mdf')) material = 'MDF';
    else if (fn.includes('compensado') || fn.includes('comp ') || fn.includes('cambota')) material = 'Compensado';
    else if (fn.includes('pvc')) material = 'PVC';
    else if (fn.includes('acrilico') || fn.includes('acrílico')) material = 'Acrílico';
    else if (fn.includes('ps ') || fn.includes('ps3mm') || fn.includes('ps2mm') || fn.includes('ps1mm')) material = 'PS';
    else if (fn.includes('eva')) material = 'EVA';
    else if (fn.includes('ptg') || fn.includes('petg')) material = 'PETG';
    else if (fn.includes('acm') || fn.includes('aluminio') || fn.includes('alumínio')) material = 'ACM';

    const thickMatch = fn.match(/(\d+(?:[.,]\d+)?)\s*(?:mm|m\b)/i);
    const thickness = thickMatch ? `${thickMatch[1].replace(',', '.')}mm` : (material === 'Isopor EPS' ? '100mm' : null);

    let tag = null;
    if (material && thickness) tag = `${material} ${thickness}`;
    else if (material) tag = material;
    else if (thickness) tag = thickness;

    // Detecta se é arquivo de chapa individual ou lote
    const chapaMatch = fn.match(/(?:chapa\s*(\d+)|(\d+)\s*x|parte\s*(\d+)|_(\d+)|(\d+)\s*(?:pvc|mdf|comp))/i);
    const chapaIndex = chapaMatch ? (chapaMatch[1] || chapaMatch[2] || chapaMatch[3] || chapaMatch[4] || chapaMatch[5]) : null;

    // Detecta quantidade de repetições (ex: 4X, 2X, 3X, 14x, rodar 2x)
    let targetQuantity = 1;
    const qtyMatch = fn.match(/^(\d+)\s*x|\b(\d+)\s*x\b/i) || folder.match(/rodar\s*(\d+)\s*x|\b(\d+)\s*x\b/i);
    if (qtyMatch) {
        targetQuantity = parseInt(qtyMatch[1] || qtyMatch[2], 10);
    }

    if (targetQuantity === 1 && folderPath) {
        try {
            const dirToCheck = fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()
                ? folderPath
                : path.dirname(folderPath);
            if (fs.existsSync(dirToCheck)) {
                const entries = fs.readdirSync(dirToCheck);
                for (const ent of entries) {
                    const m = ent.match(/^rodar\s*(\d+)\s*x$/i);
                    if (m) {
                        targetQuantity = parseInt(m[1], 10);
                        break;
                    }
                }
            }
        } catch { /* ignore */ }
    }

    return { material, thickness, tag, chapaIndex, targetQuantity };
}

// Identifica se o arquivo já foi usinado, testado ou dado baixa pelo operador
function isFileMarkedOk(filename = '') {
    if (!filename) return false;
    const lower = filename.toLowerCase().trim();

    // 1. Tag explícita no nome do arquivo (OK, chapaok, chapa ok, _ok, -ok, cortado, feito)
    if (
        lower.includes('chapaok') ||
        lower.includes('chapa ok') ||
        lower.includes(' ok.txt') ||
        lower.includes('_ok.txt') ||
        lower.includes('-ok.txt') ||
        lower.includes(' ok ') ||
        lower.includes('ja foi') ||
        lower.includes('cortado') ||
        lower.includes('feito') ||
        lower.endsWith('ok.txt')
    ) {
        return true;
    }

    // 2. Arquivos confirmados como concluídos por padrão legado de lote
    if (
        lower === 'compensado 6mm e6mm_11.txt' ||
        lower === 'compensado 6mm e6mm_12.txt' ||
        lower === 'compensado 6mm e6mm_10.txt' ||
        lower === 'compensado 6mm e6mm_9.txt' ||
        lower === 'compensado 6mm e6mm_8.txt' ||
        lower === 'compensado 6mm e6mm_7.txt' ||
        lower === 'compensado 6mm e6mm_5.txt' ||
        lower === 'compensado 6mm e6mm_4.txt' ||
        lower === 'compensado 6mm e6mm_3.txt' ||
        lower === 'compensado 6mm e6mm_2.txt' ||
        lower === 'compensado 6mm e6mm_1.txt' ||
        lower.includes('textura tijolos especiais e4mm') ||
        lower === 'compensado 10mm e6mm_1.txt' ||
        lower.includes('aplique mdf 9mm_1-corte 1') ||
        lower.includes('aplique mdf 9mm_2-corte 2') ||
        lower.includes('aplique mdf 9mm_3-corte 3') ||
        lower.includes('aplique mdf 9mm_4-corte 4') ||
        lower.includes('aplique mdf 9mm_1-corte 5') ||
        lower.includes('aplique mdf 9mm_2-corte 6') ||
        lower.includes('aplique mdf 9mm_4-corte 7') ||
        lower === '4x compensado 6mm e6mm.txt' ||
        lower === '2x compensado 6mm e6mm_1-corte 2.txt'
    ) {
        return true;
    }

    return false;
}

// Gera variantes equivalentes de nome para casar arquivos regerados ou com tags adicionadas (ex: OK 2X, OK, prefixo de número)
function getBaseFileVariants(fileName) {
    if (!fileName) return [];
    const variants = new Set();
    const raw = String(fileName).toLowerCase().trim();
    variants.add(raw);

    const extMatch = raw.match(/\.(txt|nc|tap|gcode|cnc)$/i);
    const ext = extMatch ? extMatch[0] : '.txt';
    const withoutExt = raw.replace(/\.(txt|nc|tap|gcode|cnc)$/i, '').trim();

    // Suffixes: ok 2x, ok 2 x, ok 4x, ok, _ok, - ok
    const cleaned = withoutExt.replace(/(?:[\s\-_]+ok(?:\s*\d+\s*x)?(?:\s*\d+)?|\s+ok\s*\d+\s*x)$/i, '').trim();
    variants.add(cleaned + ext);
    variants.add(cleaned);

    // Prefix ok: ok 3...
    const noPrefixOk = withoutExt.replace(/^ok[\s\-_]+/i, '').trim();
    variants.add(noPrefixOk + ext);
    variants.add(noPrefixOk);

    // Omitted tool tag: b10mm, e6mm, etc.
    const withoutTool = cleaned.replace(/\s+[be]\d+mm/i, '').replace(/\s+/g, ' ').trim();
    variants.add(withoutTool + ext);
    variants.add(withoutTool);

    // Transpose number prefix: "3 mdf 9mm..." <-> "mdf 9mm 3..."
    const numPrefixMatch = withoutExt.match(/^(\d+)\s+([a-zA-Z]+)\s*(\d+mm)?\s*(.*)$/i);
    if (numPrefixMatch) {
        const [, num, mat, thick, rest] = numPrefixMatch;
        const transposed = `${mat} ${thick || ''} ${num} ${rest}`.replace(/\s+/g, ' ').trim();
        variants.add(transposed + ext);
        const transClean = transposed.replace(/(?:[\s\-_]+ok(?:\s*\d+\s*x)?(?:\s*\d+)?|\s+ok\s*\d+\s*x)$/i, '').trim();
        variants.add(transClean + ext);
    }
    const numInsideMatch = withoutExt.match(/^([a-zA-Z]+)\s*(\d+mm)?\s*(\d+)\s+(.*)$/i);
    if (numInsideMatch) {
        const [, mat, thick, num, rest] = numInsideMatch;
        const transposed = `${num} ${mat} ${thick || ''} ${rest}`.replace(/\s+/g, ' ').trim();
        variants.add(transposed + ext);
        const transClean = transposed.replace(/(?:[\s\-_]+ok(?:\s*\d+\s*x)?(?:\s*\d+)?|\s+ok\s*\d+\s*x)$/i, '').trim();
        variants.add(transClean + ext);
    }

    return Array.from(variants).filter(Boolean);
}

// Nome limpo canônico para agrupamento e deduplicação de chapas
function getCleanBaseGCodeName(fileName) {
    if (!fileName) return '';
    const raw = String(fileName).toLowerCase().trim();
    const extMatch = raw.match(/\.(txt|nc|tap|gcode|cnc)$/i);
    const ext = extMatch ? extMatch[0] : '.txt';
    const withoutExt = raw.replace(/\.(txt|nc|tap|gcode|cnc)$/i, '').trim();

    let cleaned = withoutExt.replace(/(?:[\s\-_]+ok(?:\s*\d+\s*x)?(?:\s*\d+)?|\s+ok\s*\d+\s*x)$/i, '').trim();
    cleaned = cleaned.replace(/^ok[\s\-_]+/i, '').trim();
    cleaned = cleaned.replace(/\s+[be]\d+mm/i, '').trim();

    const numPrefixMatch = cleaned.match(/^(\d+)\s+([a-zA-Z]+)\s*(\d+mm)?\s*(.*)$/i);
    if (numPrefixMatch) {
        const [, num, mat, thick, rest] = numPrefixMatch;
        cleaned = `${mat} ${thick || ''} ${num} ${rest}`.replace(/\s+/g, ' ').trim();
    }
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned + ext;
}

// Regra de Turno Noturno: Todas as operações entre 22:00 e 05:59 pertencem ao operador noturno do tenant
function isNightShiftHour(date) {
    if (!date) return false;
    try {
        const d = (date instanceof Date) ? date : new Date(date);
        const hourStr = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: 'numeric',
            hour12: false
        }).format(d);
        const hour = parseInt(hourStr, 10);
        return hour >= 22 || hour < 6;
    } catch {
        const h = (new Date(date)).getHours();
        return h >= 22 || h < 6;
    }
}

function scopeFileKey(userId, key) {
    const clean = String(key || '').trim();
    if (!clean) return '';
    const uId = Number(userId || 1) || 1;
    if (uId <= 1) return clean;
    const prefix = `u${uId}::`;
    return clean.startsWith(prefix) ? clean : `${prefix}${clean}`;
}

function unscopeFileKey(userId, storedKey) {
    const raw = String(storedKey || '').trim();
    if (!raw) return '';
    const uId = Number(userId || 1) || 1;
    if (uId <= 1) return raw;
    const prefix = `u${uId}::`;
    return raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
}

/**
 * Classifica execuções concluídas de um mesmo arquivo G-Code comparando o tempo de corte
 * com o tempo médio do corte anterior (ou tempo estimado de referência quando ainda não há corte completo).
 * Cortes abortados precocemente (Stop & Reload / erro na operação) abaixo de 55% do tempo médio
 * NÃO incrementam a contagem de lote (2x, 3x, 4x) e são sinalizados em errorExecs.
 */
function classifyFileExecutions(execs = [], estimatedMinutes = null) {
    if (!Array.isArray(execs) || execs.length === 0) {
        return { validExecs: [], errorExecs: [], avgValidMinutes: Number(estimatedMinutes) || 0 };
    }

    const getDur = (j) => {
        const d = parseFloat(j.duration_minutes);
        if (!isNaN(d) && d > 0) return d;
        if (j.start_time && j.end_time) {
            return Math.max(0, (new Date(j.end_time) - new Date(j.start_time)) / 60000);
        }
        return 0;
    };

    const chronological = [...execs].sort(
        (a, b) => new Date(a.start_time || 0).getTime() - new Date(b.start_time || 0).getTime()
    );

    const jobEst = chronological.map(j => parseFloat(j.estimated_minutes) || 0).find(v => v > 0 && v !== 5.5) || 0;
    const est = parseFloat(estimatedMinutes) || jobEst || 0;
    const durs = chronological.map(getDur).filter(d => d > 0);
    const maxDur = durs.length > 0 ? Math.max(...durs) : 0;

    let initialRef = est > 0 ? est : maxDur;
    if (durs.length > 0) {
        const minSubstantive = est > 0 ? Math.min(est * 0.45, Math.max(maxDur * 0.55, 2.0)) : maxDur * 0.55;
        const substantive = durs.filter(d => d >= minSubstantive && (est <= 0 || d >= est * 0.45 || maxDur >= 10));
        if (substantive.length > 0) {
            const validCandidates = est > 0
                ? substantive.filter(d => d >= est * 0.45)
                : substantive;
            if (validCandidates.length > 0) {
                initialRef = validCandidates[0];
            } else if (maxDur >= 10 && substantive.length >= 2) {
                initialRef = substantive[0];
            }
        }
    }

    const validExecs = [];
    const errorExecs = [];
    const validDurs = [];

    for (const job of chronological) {
        const dur = getDur(job);
        const currentRef = validDurs.length > 0
            ? (validDurs.reduce((a, b) => a + b, 0) / validDurs.length)
            : initialRef;

        const isShortError = currentRef > 1.5 && dur < currentRef * 0.55;

        if (isShortError) {
            errorExecs.push({
                ...job,
                duration_minutes: Math.round(dur * 100) / 100,
                expected_minutes: Math.round(currentRef * 10) / 10,
                isOpError: true
            });
        } else {
            validExecs.push(job);
            if (dur > 0) validDurs.push(dur);
        }
    }

    validExecs.sort((a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime());
    errorExecs.sort((a, b) => new Date(b.start_time || 0).getTime() - new Date(a.start_time || 0).getTime());

    const avgValidMinutes = validDurs.length > 0
        ? Math.round((validDurs.reduce((a, b) => a + b, 0) / validDurs.length) * 10) / 10
        : (Math.round(initialRef * 10) / 10);

    return { validExecs, errorExecs, avgValidMinutes };
}

function resolveExecutionMeta(execs, dbCompRec, gf, dur, dayOpName, nightOpName) {
    if (execs && execs[0]) {
        return {
            ...execs[0],
            operator_name: isNightShiftHour(execs[0].start_time)
                ? nightOpName
                : (execs[0].operator_name || dayOpName)
        };
    }
    return {
        operator_name: isNightShiftHour(dbCompRec?.completed_at || gf.mtimeDate)
            ? nightOpName
            : (dbCompRec?.operator_name || dayOpName),
        machine_name: 'Router 2',
        start_time: dbCompRec?.completed_at || gf.mtimeDate || new Date().toISOString(),
        duration_minutes: gf.estimatedMinutes || dur
    };
}

function calculateDynamicBatches(dbJobs = [], completedFilesMap = {}, customBatches = [], fileBatchMeta = []) {
    const batches = [];
    const seenIds = new Set();

    // 1. Lotes personalizados configurados para o tenant (users.pipeline_batches JSONB)
    if (Array.isArray(customBatches)) {
        customBatches.forEach((cfg, idx) => {
            if (!cfg || !cfg.name) return;
            const id = String(cfg.id || `custom_${idx + 1}`);
            const targetSheets = Math.max(1, parseInt(cfg.targetSheets, 10) || 1);
            const keyword = String(cfg.matchKeyword || '').toLowerCase().trim();
            const folderKw = String(cfg.matchFolder || '').toLowerCase().trim();
            const minDur = Number(cfg.minMinutes) || 0;
            const sinceMs = cfg.sinceDate ? new Date(cfg.sinceDate).getTime() : 0;

            let matchedDone = Number(cfg.baseDone) || 0;
            if (keyword || folderKw) {
                matchedDone += dbJobs.filter(j => {
                    const fn = (j.file_name || '').toLowerCase();
                    const fld = (j.folder || '').toLowerCase();
                    const st = new Date(j.start_time).getTime();
                    if (sinceMs && st < sinceMs) return false;
                    if (minDur > 0 && Number(j.duration_minutes) < minDur) return false;
                    const okFile = !keyword || fn.includes(keyword);
                    const okFolder = !folderKw || fld.includes(folderKw);
                    return okFile && okFolder;
                }).length;
            }
            const doneSheets = Math.min(targetSheets, Math.max(0, matchedDone));
            const pendingSheets = Math.max(0, targetSheets - doneSheets);
            const estMin = Math.max(1, Number(cfg.estMinutesPerSheet) || 20);
            seenIds.add(id);
            batches.push({
                id,
                name: cfg.name,
                job: cfg.job || 'Produção',
                subfolder: cfg.subfolder || 'ROUTER',
                file: cfg.file || keyword || cfg.name,
                material: cfg.material || 'Material CNC',
                dimensions: cfg.dimensions || 'Padrão CNC',
                tool: cfg.tool || 'Fresa CNC',
                targetSheets,
                doneSheets,
                pendingSheets,
                status: pendingSheets === 0 ? 'concluido' : (doneSheets > 0 ? 'em_andamento' : 'pronto_router'),
                estMinutesPerSheet: estMin,
                totalEstMinutes: pendingSheets * estMin,
                priority: cfg.priority || 'alta'
            });
        });
    }

    // 2. Lotes dinâmicos criados automaticamente a partir de metas definidas na fila (pipeline_file_batches)
    if (Array.isArray(fileBatchMeta)) {
        fileBatchMeta.forEach((bMeta) => {
            const qty = parseInt(bMeta.target_quantity, 10) || 1;
            if (qty <= 1 || !bMeta.file_name) return;
            const cleanName = bMeta.file_name.trim();
            const lowerName = cleanName.toLowerCase();
            const lowerSub = (bMeta.subfolder || '').toLowerCase().trim();
            const id = `batch_file_${lowerSub || 'root'}_${lowerName}`.replace(/[^a-z0-9_]+/g, '_');
            if (seenIds.has(id)) return;
            seenIds.add(id);

            const variants = new Set(getBaseFileVariants(lowerName));
            const cleanBase = getCleanBaseGCodeName(lowerName);
            const execRuns = dbJobs.filter(j => {
                const jn = (j.file_name || '').toLowerCase().trim();
                const jnClean = getCleanBaseGCodeName(jn);
                if (!variants.has(jn) && (!cleanBase || jnClean !== cleanBase)) return false;
                if (lowerSub) {
                    const jf = (j.folder || '').toLowerCase().trim();
                    if (!jf || !jf.includes(lowerSub)) return false;
                }
                return true;
            });
            const finishedRuns = execRuns.filter(j => j.end_time != null || j.duration_minutes);
            const { validExecs: validBatchRuns, errorExecs: errorBatchRuns, avgValidMinutes } = classifyFileExecutions(finishedRuns, null);
            const doneSheets = Math.min(qty, validBatchRuns.length);
            const pendingSheets = Math.max(0, qty - doneSheets);
            const avgDur = avgValidMinutes > 0
                ? Math.max(1, Math.round(avgValidMinutes))
                : 25;

            batches.push({
                id,
                name: `${cleanName} (${doneSheets} de ${qty})`,
                job: bMeta.job_name || bMeta.subfolder || 'Produção CNC',
                subfolder: bMeta.subfolder || 'ROUTER',
                file: cleanName,
                material: extractMaterialInfo(cleanName, bMeta.subfolder || '').tag || 'CNC',
                dimensions: 'Série Programada',
                tool: 'Conforme G-Code',
                targetSheets: qty,
                doneSheets,
                pendingSheets,
                errorExecsCount: errorBatchRuns.length,
                hasOpError: errorBatchRuns.length > 0,
                status: pendingSheets === 0 ? 'concluido' : (doneSheets > 0 ? 'em_andamento' : 'pronto_router'),
                estMinutesPerSheet: avgDur,
                totalEstMinutes: pendingSheets * avgDur,
                priority: 'alta'
            });
        });
    }

    return batches.map(b => {
        const isBatchChecked = Boolean(
            completedFilesMap[`batch_${b.id}`] ||
            completedFilesMap[b.id] ||
            completedFilesMap[(b.file || '').toLowerCase().trim()] ||
            completedFilesMap[(b.name || '').toLowerCase().trim()]
        );
        if (isBatchChecked) {
            return {
                ...b,
                doneSheets: b.targetSheets,
                pendingSheets: 0,
                status: 'concluido',
                totalEstMinutes: 0
            };
        }
        return b;
    });
}

const pipelineCache = new Map();
const CACHE_TTL_MS = 4000; // 4s para atualização rápida e tempo real

function invalidatePipelineCache(userId = null) {
    if (userId !== null && userId !== undefined) {
        pipelineCache.delete(String(userId));
    } else {
        pipelineCache.clear();
    }
}

async function getProductionPipeline(pool, forceRefresh = false, options = {}) {
    const userId = Number(options?.userId || 1) || 1;
    const cacheKey = String(userId);
    const now = Date.now();
    const cachedEntry = pipelineCache.get(cacheKey);
    if (!forceRefresh && cachedEntry && (now - cachedEntry.ts < CACHE_TTL_MS)) {
        return cachedEntry.data;
    }

    // 0. Carregar configuração multi-tenant e operadores do tenant
    let tenantUser = {};
    let tenantOperators = [];
    try {
        const uRes = await pool.query(
            'SELECT default_day_operator, default_night_operator, pipeline_local_root, pipeline_cloud_root, pipeline_batches FROM users WHERE id = $1 LIMIT 1',
            [userId]
        );
        tenantUser = uRes.rows[0] || {};
    } catch { /* ignore */ }
    try {
        const oRes = await pool.query(
            'SELECT id, name, shift FROM operators WHERE "userId" = $1 ORDER BY id ASC',
            [userId]
        );
        tenantOperators = oRes.rows || [];
    } catch { /* ignore */ }

    const nightOpName =
        (tenantOperators.find(o => /noite|night|noturno/i.test(o.shift || ''))?.name || '').trim() ||
        (tenantUser.default_night_operator || '').trim() ||
        (process.env.DEFAULT_NIGHT_OPERATOR || '').trim() ||
        'Operador Noite';
    const dayOpName =
        (tenantOperators.find(o => /manha|manhã|dia|day|diurno|tarde/i.test(o.shift || ''))?.name || '').trim() ||
        (tenantUser.default_day_operator || '').trim() ||
        (process.env.DEFAULT_DAY_OPERATOR || '').trim() ||
        'Operador';

    let customBatches = [];
    if (Array.isArray(tenantUser.pipeline_batches)) {
        customBatches = tenantUser.pipeline_batches;
    } else if (typeof tenantUser.pipeline_batches === 'string' && tenantUser.pipeline_batches.trim()) {
        try {
            const parsed = JSON.parse(tenantUser.pipeline_batches);
            if (Array.isArray(parsed)) customBatches = parsed;
        } catch { /* ignore */ }
    }

    // 1. Get executions from PostgreSQL (escopo por tenant)
    let dbJobs = [];
    try {
        const { rows } = await pool.query(`
            SELECT id, file_name, folder, router_name, operator_name, start_time, end_time, duration_minutes, estimated_minutes
            FROM jobs
            WHERE ("userId" = $1 OR ($1::int = 1 AND "userId" IS NULL))
            ORDER BY start_time DESC
        `, [userId]);
        dbJobs = rows.map(j => {
            if (isNightShiftHour(j.start_time)) {
                return { ...j, operator_name: nightOpName };
            }
            return j;
        });
    } catch (e) {
        console.error('Error fetching jobs in getProductionPipeline:', e.message);
    }

    // 1.1 Obter arquivos marcados como concluídos manualmente pelo operador (salvos permanentemente no PostgreSQL)
    let completedFilesMap = {};
    try {
        const { rows } = await pool.query(`
            SELECT file_key, file_name, stage, subfolder, job_name, done, operator_name,
                   (completed_at AT TIME ZONE 'UTC') AS completed_at
            FROM pipeline_completed_files
            WHERE done = TRUE
              AND ("userId" = $1 OR ($1::int = 1 AND "userId" IS NULL))
        `, [userId]);
        rows.forEach(r => {
            const cleanKey = unscopeFileKey(userId, r.file_key);
            const rec = { ...r, file_key: cleanKey };
            if (cleanKey) completedFilesMap[cleanKey.toLowerCase().trim()] = rec;
            const subLower = (r.subfolder || '').toLowerCase().trim();
            const fnLower = (r.file_name || '').toLowerCase().trim();
            if (subLower && fnLower) {
                completedFilesMap[`${fnLower}___${subLower}`] = rec;
                completedFilesMap[`${subLower}/${fnLower}`] = rec;
            }
            if (fnLower && !subLower && (!cleanKey || (!cleanKey.includes('\\') && !cleanKey.includes('/')))) {
                completedFilesMap[fnLower] = rec;
            }
        });
    } catch (e) {
        console.error('Error fetching pipeline_completed_files in getProductionPipeline:', e.message);
    }

    // 1.2 Obter arquivos que foram reabertos para rodar novamente ("rodar novamente")
    let reopenFilesMap = {};
    try {
        const { rows: reopenRows } = await pool.query(`
            SELECT file_key, (reopened_at AT TIME ZONE 'UTC') AS reopened_at, reason
            FROM pipeline_reopen_files
            WHERE ("userId" = $1 OR ($1::int = 1 AND "userId" IS NULL))
        `, [userId]);
        reopenRows.forEach(r => {
            const cleanKey = unscopeFileKey(userId, r.file_key);
            if (cleanKey) reopenFilesMap[cleanKey.toLowerCase().trim()] = { ...r, file_key: cleanKey };
        });
    } catch (e) {
        console.error('Error fetching pipeline_reopen_files in getProductionPipeline:', e.message);
    }

    const getFileReopenRec = (fileObj, subfolderName) => {
        if (!fileObj || !reopenFilesMap) return null;
        const lower = (fileObj.name || '').toLowerCase().trim();
        const fullKeyWin = (fileObj.fullPath || '').toLowerCase().trim();
        const fullKeyFwd = fullKeyWin.replace(/\\/g, '/');
        const sub = (subfolderName || fileObj.subfolderName || '').toLowerCase().trim();
        const compoundKey = `${lower}___${sub}`;
        const subSlashKey = `${sub}/${lower}`;

        return reopenFilesMap[fullKeyWin] ||
               reopenFilesMap[fullKeyFwd] ||
               reopenFilesMap[compoundKey] ||
               reopenFilesMap[subSlashKey] ||
               reopenFilesMap[lower] ||
               null;
    };

    // 1.3 Obter lotes e quantidades personalizadas definidas pelo operador
    let fileBatchesMap = {};
    let fileBatchMeta = [];
    try {
        const { rows: batchRows } = await pool.query(`
            SELECT file_key, file_name, subfolder, job_name, target_quantity
            FROM pipeline_file_batches
            WHERE ("userId" = $1 OR ($1::int = 1 AND "userId" IS NULL))
        `, [userId]);
        const seenMeta = new Set();
        batchRows.forEach(r => {
            const cleanKey = unscopeFileKey(userId, r.file_key);
            if (cleanKey && r.target_quantity) {
                fileBatchesMap[cleanKey.toLowerCase().trim()] = parseInt(r.target_quantity, 10);
            }
            const fn = (r.file_name || '').toLowerCase().trim();
            const sub = (r.subfolder || '').toLowerCase().trim();
            if (fn && r.target_quantity) {
                const qty = parseInt(r.target_quantity, 10);
                const variants = getBaseFileVariants(fn);
                variants.forEach(v => {
                    if (sub) {
                        fileBatchesMap[`${v}___${sub}`] = qty;
                        fileBatchesMap[`${sub}/${v}`] = qty;
                    } else {
                        fileBatchesMap[v] = qty;
                    }
                });
                const cleanBase = getCleanBaseGCodeName(fn);
                if (cleanBase) {
                    if (sub) {
                        fileBatchesMap[`${cleanBase}___${sub}`] = qty;
                        fileBatchesMap[`${sub}/${cleanBase}`] = qty;
                    } else {
                        fileBatchesMap[cleanBase] = qty;
                    }
                }
            }
            const metaKey = `${(r.file_name || '').toLowerCase()}___${(r.subfolder || '').toLowerCase()}`;
            if (r.file_name && !seenMeta.has(metaKey)) {
                seenMeta.add(metaKey);
                fileBatchMeta.push(r);
            }
        });
    } catch (e) {
        console.error('Error fetching pipeline_file_batches in getProductionPipeline:', e.message);
    }

    const getFileBatchQuantity = (fileObj, subfolderName) => {
        if (!fileObj || !fileBatchesMap) return null;
        const variants = getBaseFileVariants(fileObj.name || '');
        const sub = (subfolderName || fileObj.subfolderName || '').toLowerCase().trim();
        for (const v of variants) {
            if (sub) {
                const compoundKey = `${v}___${sub}`;
                const subSlashKey = `${sub}/${v}`;
                const q = fileBatchesMap[compoundKey] || fileBatchesMap[subSlashKey];
                if (q) return q;
            } else {
                const q = fileBatchesMap[v];
                if (q) return q;
            }
        }
        const cleanBase = getCleanBaseGCodeName(fileObj.name || '');
        if (cleanBase) {
            if (sub) {
                const compoundKey = `${cleanBase}___${sub}`;
                const subSlashKey = `${sub}/${cleanBase}`;
                const q = fileBatchesMap[compoundKey] || fileBatchesMap[subSlashKey];
                if (q) return q;
            } else {
                const q = fileBatchesMap[cleanBase];
                if (q) return q;
            }
        }
        const fullKeyWin = (fileObj.fullPath || '').toLowerCase().trim();
        const fullKeyFwd = fullKeyWin.replace(/\\/g, '/');
        return fileBatchesMap[fullKeyWin] || fileBatchesMap[fullKeyFwd] || null;
    };

    // Detecção real de "RODANDO AGORA": execução sem fim registrado, iniciada há menos de 12h,
    // e que seja a execução mais recente daquela máquina (se a máquina já começou outro arquivo, a anterior não está mais rodando).
    // Substitui o antigo limite fixo de 1h, que fazia blocos longos de isopor/PVC "sumirem" da fila durante o corte.
    const latestJobIdByRouter = {};
    dbJobs.forEach(j => {
        const r = (j.router_name || '').toLowerCase().trim();
        const st = new Date(j.start_time).getTime();
        if (!latestJobIdByRouter[r] || st > latestJobIdByRouter[r].st) latestJobIdByRouter[r] = { id: j.id, st };
    });
    const isJobActive = (j) => {
        if (!j || j.end_time != null || j.duration_minutes) return false;
        const st = new Date(j.start_time).getTime();
        if (!st || Date.now() - st > 12 * 3600 * 1000) return false;
        const latest = latestJobIdByRouter[(j.router_name || '').toLowerCase().trim()];
        return Boolean(latest && latest.id === j.id);
    };

    // Só conta execuções feitas DEPOIS que o arquivo foi salvo (margem de 2 min). Um .txt salvo de novo pelo Aspire
    // é um corte novo, e um nome genérico (ex: "mdf 15mm e4mm.txt") usado em outro projeto antigo não pode dar baixa nele.
    const execsAfterFile = (execs, fileObj) => {
        const fm = fileObj?.mtime || (fileObj?.mtimeDate ? new Date(fileObj.mtimeDate).getTime() : 0);
        if (!fm) return execs;
        return execs.filter(j => new Date(j.start_time).getTime() >= fm - 120000);
    };

    const GENERIC_FOLDER_NAMES = new Set([
        '', 'desconhecido', 'router', 'router 2', 'router central',
        'laser ruida', 'lasercad', 'cnc', 'isopor', 'cod', '3 - oficina',
        'oficina', 'dados2 - jobs ativos', 'dados2', 'arquivos 2026',
        'arquivos 2024', 'arquivos 2025', 'arquivos', 'c:', 'd:', 'e:', 'users'
    ]);

    // Execuções de um G-Code: associa execuções registradas no Mach3 garantindo que pertençam
    // à mesma subpasta ou ancestrais do arquivo, sem vazar cortes entre subpastas irmãs ou nomes genéricos.
    const getFileExecs = (fileObj, lower) => {
        const variants = getBaseFileVariants(lower || fileObj?.name || '');
        const cleanBase = getCleanBaseGCodeName(lower || fileObj?.name || '');
        if (cleanBase && !variants.includes(cleanBase)) variants.push(cleanBase);
        const seenIds = new Set();
        const all = [];
        for (const v of variants) {
            const list = execMap[v] || [];
            for (const j of list) {
                if (!seenIds.has(j.id)) {
                    seenIds.add(j.id);
                    all.push(j);
                }
            }
        }
        if (!all.length) return [];

        // Só conta execuções feitas DEPOIS que o arquivo foi salvo (margem de 2 min)
        const execsCandidate = execsAfterFile(all, fileObj);
        if (!execsCandidate.length) return [];

        // Constrói conjunto de ancestrais significativos (ignora pastas genéricas como "ROUTER", "ISOPOR", "COD", "3 - OFICINA")
        const fullAncestors = String(fileObj?.fullPath || '').split(/[\\/]/).slice(0, -1)
            .map(s => s.toLowerCase().trim().replace(/\s+/g, ' '))
            .filter(Boolean);
        const meaningfulAncestors = new Set(
            fullAncestors.filter(s => !GENERIC_FOLDER_NAMES.has(s))
        );

        const sub = String(fileObj?.subfolderName || '').toLowerCase().trim().replace(/\s+/g, ' ');
        if (sub && !GENERIC_FOLDER_NAMES.has(sub)) {
            meaningfulAncestors.add(sub);
        }
        const job = String(fileObj?.jobName || '').toLowerCase().trim().replace(/\s+/g, ' ');
        if (job && !GENERIC_FOLDER_NAMES.has(job)) {
            meaningfulAncestors.add(job);
        }

        const ffp = String(fileObj?.fullPath || '').toLowerCase().replace(/\\/g, '/');

        let matched = execsCandidate.filter(j => {
            // 1. Caminho direto idêntico ou sufixo
            const jfp = String(j.file_path || '').toLowerCase().replace(/\\/g, '/');
            if (jfp && ffp && (jfp === ffp || jfp.endsWith(ffp) || ffp.endsWith(jfp))) return true;

            const jf = String(j.folder || '').toLowerCase().trim().replace(/\s+/g, ' ');

            // Se o Mach3 não registrou pasta ou gravou pasta genérica (ex: "ROUTER" ou "Desconhecido"):
            if (!jf || GENERIC_FOLDER_NAMES.has(jf)) {
                // Só casa se o próprio arquivo também não tem subpasta específica (arquivo solto na raiz)
                return !sub || GENERIC_FOLDER_NAMES.has(sub);
            }

            // O Mach3 registrou uma subpasta específica (ex: 'TOPO ISOPOR COLUNAS', 'ARCO A', 'SUPORTE ARCO ISOPOR'):
            if (sub && sub.length >= 3) {
                // Previne colisões entre arcos numerados (ex: 'arco a' vs 'arco a2' vs 'arco a3' vs 'arco a4')
                const numJf = jf.match(/\d+$/)?.[0] || '';
                const numSub = sub.match(/\d+$/)?.[0] || '';
                if (numJf !== numSub && (jf.includes('arco') || sub.includes('arco'))) return false;

                if (jf.includes('arco a') && !sub.includes('arco a')) return false;
                if (jf.includes('arco b') && !sub.includes('arco b')) return false;

                // Casos especiais de topo isopor colunas
                if (jf.includes('topo') && sub.includes('topo')) return true;
                if (jf.includes('topo') && !sub.includes('topo')) return false;
                if (!jf.includes('topo') && sub.includes('topo')) return false;

                if (jf === sub || jf.includes(sub) || sub.includes(jf)) return true;
            }

            // Se a pasta do corte bate com um dos ancestrais significativos do arquivo
            if (meaningfulAncestors.has(jf)) return true;

            // Casamento pelo código do projeto (ex: '2662a' casa '2662A - CAPACETE' com '2662A - capaacete senna')
            const codeFile = job.match(/^\s*(\d+[a-zA-Z]?)/)?.[1]?.toLowerCase();
            const codeJob = jf.match(/^\s*(\d+[a-zA-Z]?)/)?.[1]?.toLowerCase();
            if (codeFile && codeJob && codeFile === codeJob) {
                if (sub && !GENERIC_FOLDER_NAMES.has(sub)) {
                    if (jf.includes('topo') && !sub.includes('topo')) return false;
                    if (!jf.includes('topo') && sub.includes('topo')) return false;
                    if (jf.includes('arco') || sub.includes('arco')) {
                        const numJf = jf.match(/\d+$/)?.[0] || '';
                        const numSub = sub.match(/\d+$/)?.[0] || '';
                        if (numJf !== numSub) return false;
                    }
                }
                return true;
            }

            return false;
        });

        // Se o arquivo foi reaberto para rodar novamente, descartar execuções de corte anteriores ao momento da reabertura!
        const reopenRec = getFileReopenRec(fileObj, fileObj?.subfolderName);
        if (reopenRec && reopenRec.reopened_at) {
            const rTime = new Date(reopenRec.reopened_at).getTime();
            matched = matched.filter(j => new Date(j.start_time).getTime() > rTime);
        }

        return matched;
    };

    // Localiza a execução ativa de um arquivo na Router CNC (Mach3), associando por pasta, subpasta, ancestrais ou nome
    const findActiveExec = (fileObj, lower) => {
        const variants = getBaseFileVariants(lower || fileObj?.name || '');
        const cleanBase = getCleanBaseGCodeName(lower || fileObj?.name || '');
        if (cleanBase && !variants.includes(cleanBase)) variants.push(cleanBase);
        const seenIds = new Set();
        const list = [];
        for (const v of variants) {
            const l = execMap[v] || [];
            for (const j of l) {
                if (!seenIds.has(j.id)) {
                    seenIds.add(j.id);
                    list.push(j);
                }
            }
        }
        if (!list.length) return null;
        const fullAncestors = String(fileObj?.fullPath || '').split(/[\\/]/).slice(0, -1)
            .map(s => s.toLowerCase().trim().replace(/\s+/g, ' '))
            .filter(Boolean);
        const meaningfulAncestors = new Set(
            fullAncestors.filter(s => !GENERIC_FOLDER_NAMES.has(s))
        );
        if (fileObj?.subfolderName) {
            const s = String(fileObj.subfolderName).toLowerCase().trim().replace(/\s+/g, ' ');
            if (!GENERIC_FOLDER_NAMES.has(s)) meaningfulAncestors.add(s);
        }
        if (fileObj?.jobName) {
            const jn = String(fileObj.jobName).toLowerCase().trim().replace(/\s+/g, ' ');
            if (!GENERIC_FOLDER_NAMES.has(jn)) meaningfulAncestors.add(jn);
        }

        const sub = String(fileObj?.subfolderName || '').toLowerCase().trim().replace(/\s+/g, ' ');

        // 1. Execução ativa cuja pasta no Mach3 seja ou contenha uma das pastas ancestrais
        const matchAncestor = list.find(j => {
            if (!isJobActive(j) || !j.folder) return false;
            const jf = String(j.folder).toLowerCase().trim().replace(/\s+/g, ' ');
            if (GENERIC_FOLDER_NAMES.has(jf)) return false;

            if (sub && sub.length >= 3) {
                // Evita cross-match entre pastas irmãs ou numeradas (ex: 'colunas' vs 'colunas 5', 'arco a' vs 'arco a2')
                const numJf = jf.match(/\d+$/)?.[0] || '';
                const numSub = sub.match(/\d+$/)?.[0] || '';
                if (numJf !== numSub) return false;

                if (jf.includes('arco a') && !sub.includes('arco a')) return false;
                if (jf.includes('arco b') && !sub.includes('arco b')) return false;
                if (jf.includes('topo') && !sub.includes('topo')) return false;
                if (!jf.includes('topo') && sub.includes('topo')) return false;
                if (jf.includes(sub) || sub.includes(jf)) return true;
            }
            if (meaningfulAncestors.has(jf)) return true;

            const codeFile = (fileObj?.jobName || '').match(/^\s*(\d+[a-zA-Z]?)/)?.[1]?.toLowerCase();
            const codeJob = jf.match(/^\s*(\d+[a-zA-Z]?)/)?.[1]?.toLowerCase();
            if (codeFile && codeJob && codeFile === codeJob) {
                if (sub && !GENERIC_FOLDER_NAMES.has(sub)) {
                    if (jf.includes('topo') && !sub.includes('topo')) return false;
                    if (!jf.includes('topo') && sub.includes('topo')) return false;
                    const numJf = jf.match(/\d+$/)?.[0] || '';
                    const numSub = sub.match(/\d+$/)?.[0] || '';
                    if (numJf !== numSub) return false;
                }
                return true;
            }

            return false;
        });
        if (matchAncestor) return matchAncestor;

        // 2. Execução ativa sem pasta informada no Mach3 (apenas se o próprio arquivo for na raiz / sem subpasta)
        if (!sub || GENERIC_FOLDER_NAMES.has(sub)) {
            const matchNoFolder = list.find(j => isJobActive(j) && (!j.folder || GENERIC_FOLDER_NAMES.has(String(j.folder).toLowerCase().trim())));
            if (matchNoFolder) return matchNoFolder;
        }

        return null;
    };

    const execMap = {};
    dbJobs.forEach(j => {
        const fn = (j.file_name || '').toLowerCase().trim();
        const fld = (j.folder || '').toLowerCase().trim();
        const variants = getBaseFileVariants(fn);
        const cleanBase = getCleanBaseGCodeName(fn);
        if (cleanBase && !variants.includes(cleanBase)) variants.push(cleanBase);

        for (const v of variants) {
            if (!execMap[v]) execMap[v] = [];
            execMap[v].push(j);

            if (fld) {
                const compoundKey = `${v}___${fld}`;
                if (!execMap[compoundKey]) execMap[compoundKey] = [];
                execMap[compoundKey].push(j);
            }
        }
    });

    const oneDriveRoot = (
        tenantUser.pipeline_cloud_root ||
        (userId === 1 ? process.env.PIPELINE_ONEDRIVE_ROOT : '') ||
        ''
    ).trim();
    const localRouterRoot = (
        tenantUser.pipeline_local_root ||
        (userId === 1 ? process.env.PIPELINE_LOCAL_ROOT : '') ||
        ''
    ).trim();

    const jobMap = {};
    let scannedFromDisk = false;

    // Helper: verifica se o arquivo foi dado baixa no banco, respeitando a data de modificação (se o arquivo foi salvo/modificado DEPOIS da baixa, ele volta a ficar pendente!)
    function isFileCompletedInDb(fileObj, jobName, subfolderName, compMap) {
        const variants = getBaseFileVariants(fileObj?.name || '');
        const cleanBase = getCleanBaseGCodeName(fileObj?.name || '');
        if (cleanBase && !variants.includes(cleanBase)) variants.push(cleanBase);
        const subLower = (subfolderName || '').toLowerCase().trim();
        for (const v of variants) {
            const compoundKey = `${v}___${subLower}`;
            const subSlashKey = `${subLower}/${v}`;
            const rec = compMap[compoundKey] || compMap[subSlashKey] || (!subLower ? compMap[v] : null);
            if (rec) {
                const fileMtime = fileObj.mtime || (fileObj.mtimeDate ? new Date(fileObj.mtimeDate).getTime() : 0);
                const compTime = rec.completed_at ? new Date(rec.completed_at).getTime() : 0;
                if (fileMtime && compTime && fileMtime > compTime + 60000) continue;
                const reopenRec = getFileReopenRec(fileObj, subfolderName);
                if (reopenRec && reopenRec.reopened_at) {
                    const reopenTime = new Date(reopenRec.reopened_at).getTime();
                    if (compTime && compTime <= reopenTime) continue;
                }
                return rec;
            }
        }
        const fullKey = (fileObj?.fullPath || `${jobName || ''}_${fileObj?.name || ''}`).toLowerCase().trim();
        const rec = compMap[fullKey];
        if (rec) {
            const fileMtime = fileObj.mtime || (fileObj.mtimeDate ? new Date(fileObj.mtimeDate).getTime() : 0);
            const compTime = rec.completed_at ? new Date(rec.completed_at).getTime() : 0;
            if (fileMtime && compTime && fileMtime > compTime + 60000) return null;
            const reopenRec = getFileReopenRec(fileObj, subfolderName);
            if (reopenRec && reopenRec.reopened_at) {
                const reopenTime = new Date(reopenRec.reopened_at).getTime();
                if (compTime && compTime <= reopenTime) return null;
            }
            return rec;
        }
        return null;
    }

    // 1. Scan OneDrive / Pasta Nuvem (3 - OFICINA, Nova pasta, e subpastas CNC/ROUTER)
    if (oneDriveRoot && fs.existsSync(oneDriveRoot)) {
        try {
            const list = fs.readdirSync(oneDriveRoot, { withFileTypes: true });
            for (const d of list) {
                if (!d.isDirectory() || d.name.startsWith('.')) continue;
                const jobDir = path.join(oneDriveRoot, d.name);
                try {
                    const sub = fs.readdirSync(jobDir, { withFileTypes: true });
                    let collectedFiles = [];
                    let primaryPath = jobDir;
                    for (const s of sub) {
                        if (!s.isDirectory() || s.name.startsWith('.')) continue;
                        if (/3\s*-\s*OFICINA|nova\s*pasta|router|cnc/i.test(s.name)) {
                            const sPath = path.join(jobDir, s.name);
                            if (/3\s*-\s*OFICINA/i.test(s.name)) primaryPath = sPath;
                            collectedFiles = collectedFiles.concat(scanDirRecursive(sPath));
                        } else if (/2\s*-\s*CRIATIVO/i.test(s.name)) {
                            const criativoPath = path.join(jobDir, s.name);
                            const criativoFiles = scanDirRecursive(criativoPath).filter(f => /cnc|router/i.test(f.fullPath));
                            collectedFiles = collectedFiles.concat(criativoFiles);
                        }
                    }
                    if (collectedFiles.length > 0) {
                        jobMap[d.name] = {
                            name: d.name,
                            source: 'OneDrive (3 - OFICINA)',
                            path: primaryPath,
                            files: collectedFiles
                        };
                        scannedFromDisk = true;
                    }
                } catch { /* ignore */ }
            }
        } catch { /* ignore */ }
    }

    // 2. Scan Local CNC root and active folders (todas as subpastas de projetos)
    if (localRouterRoot && fs.existsSync(localRouterRoot)) {
        try {
            const list = fs.readdirSync(localRouterRoot, { withFileTypes: true });
            for (const d of list) {
                if (!d.isDirectory() || d.name === 'node_modules' || d.name === '.git' || d.name.toLowerCase() === 'impressao 3d') continue;
                const jobName = d.name;
                const targetDir = path.join(localRouterRoot, jobName);
                if (jobName === 'router') {
                    const routerSubs = fs.readdirSync(targetDir, { withFileTypes: true });
                    for (const rSub of routerSubs) {
                        if (!rSub.isDirectory() || rSub.name.startsWith('.')) continue;
                        const subPath = path.join(targetDir, rSub.name);
                        const subFiles = scanDirRecursive(subPath);
                        if (subFiles.length === 0) continue;
                        const matchedKey = Object.keys(jobMap).find(k => k.toLowerCase().includes(rSub.name.toLowerCase()) || rSub.name.toLowerCase().includes(k.toLowerCase()));
                        if (matchedKey) {
                            jobMap[matchedKey].files.push(...subFiles);
                        } else {
                            jobMap[rSub.name] = {
                                name: rSub.name,
                                source: 'Router Local',
                                path: subPath,
                                files: subFiles
                            };
                        }
                        scannedFromDisk = true;
                    }
                } else {
                    const files = scanDirRecursive(targetDir);
                    if (files.length === 0) continue;
                    const matchedKey = Object.keys(jobMap).find(k => k.toLowerCase().includes(jobName.toLowerCase()) || jobName.toLowerCase().includes(k.toLowerCase()));
                    if (matchedKey) {
                        jobMap[matchedKey].files.push(...files);
                    } else {
                        jobMap[jobName] = {
                            name: jobName,
                            source: 'ARQUIVOS 2026',
                            path: targetDir,
                            files: files
                        };
                    }
                    scannedFromDisk = true;
                }
            }
        } catch { /* ignore */ }
    }

    // Helper: normaliza o diretório removendo subpastas técnicas (CNC, cod, etc) ou de instrução de lote (RODAR 2x)
    function getNormDir(filePath) {
        let d = path.dirname(filePath || '');
        let prev;
        do {
            prev = d;
            d = d.replace(/[\\/](cod|cnc|gcode|cortes|rodar\s*\d+\s*x)$/i, '');
        } while (d !== prev);
        return d;
    }

    // Helper: resolve nome amigável e hierárquico da subpasta (ex: 'PORTA PRINCIPAL - ISOPOR' ao invés de apenas 'ISOPOR')
    function getSubfolderName(filePath) {
        const dir = getNormDir(filePath);
        let sub = path.basename(dir);
        if (/^(isopor|eps|cnc|router|cod|gcode)$/i.test(sub)) {
            const parentName = path.basename(path.dirname(dir));
            if (parentName && !GENERIC_FOLDER_NAMES.has(parentName.toLowerCase())) {
                sub = `${parentName} - ${sub}`;
            }
        }
        return sub;
    }

    // Fallback if running on Railway/Render/Cloud where local Windows drives don't exist
    if (!scannedFromDisk || Object.keys(jobMap).length === 0) {
        let snap = null;
        try {
            const dbSnap = await pool.query('SELECT snapshot_data FROM pipeline_live_snapshot WHERE id = $1', [userId]);
            if (dbSnap.rows.length > 0 && dbSnap.rows[0].snapshot_data) {
                snap = dbSnap.rows[0].snapshot_data;
            }
        } catch { /* ignore */ }

        if (!snap && userId === 1) {
            const snapFile = path.join(__dirname, 'initial_pipeline_snapshot.json');
            if (fs.existsSync(snapFile)) {
                try {
                    snap = JSON.parse(fs.readFileSync(snapFile, 'utf8'));
                } catch (err) {
                    console.error('Error loading initial_pipeline_snapshot.json:', err);
                }
            }
        }

        if (snap) {
            try {
                const gcodeFeitos = [];
                const gcodeProntos = [];
                const seenGcodeNames = new Set();

                (snap.gcodeProntos || []).concat(snap.gcodeFeitos || []).forEach(gf => {
                    const lower = (gf.name || '').toLowerCase().trim();
                    let subfolderName = gf.subfolderName;
                    if (/^(isopor|eps|cnc|router|cod|gcode)$/i.test(subfolderName || '')) {
                        const dir = getNormDir(gf.fullPath || '');
                        const parentName = path.basename(path.dirname(dir));
                        if (parentName && !GENERIC_FOLDER_NAMES.has(parentName.toLowerCase())) {
                            subfolderName = `${parentName} - ${subfolderName}`;
                        }
                    }
                    const subLower = (subfolderName || '').toLowerCase().trim();
                    const dedupKey = `${lower}___${subLower}`;
                    if (seenGcodeNames.has(dedupKey)) return;
                    seenGcodeNames.add(dedupKey);
                    seenGcodeNames.add(lower);

                    const execs = getFileExecs({ ...gf, subfolderName }, lower);
                    const rawCompletedExecs = execs.filter(j => !isJobActive(j));
                    const activeExec = findActiveExec({ ...gf, subfolderName }, lower);
                    const isCurrentlyRunning = Boolean(activeExec);
                    let matInfo = gf.matInfo?.tag ? { ...gf.matInfo } : extractMaterialInfo(gf.name, gf.fullPath || subfolderName);
                    const meta = getGCodeMetadata(gf.fullPath, gf.mtime) || {};
                    const estMinutes = meta.estimatedMinutes || gf.estimatedMinutes || (gf.cutMeters ? Math.max(1, Math.round((gf.cutMeters * 1000 / (matInfo?.material === 'MDF' ? 1800 : 2500)) * 1.15)) : (gf.name.toLowerCase().includes('isopor') ? 90 : null));
                    const { validExecs: completedExecs, errorExecs, avgValidMinutes } = classifyFileExecutions(rawCompletedExecs, estMinutes);
                    const errorExecsSummary = errorExecs.map(e => ({
                        id: e.id,
                        start_time: e.start_time,
                        end_time: e.end_time,
                        duration_minutes: e.duration_minutes,
                        expected_minutes: e.expected_minutes,
                        operator_name: e.operator_name,
                        router_name: e.router_name
                    }));
                    const customQty = getFileBatchQuantity(gf, subfolderName);
                    if (customQty) {
                        matInfo.targetQuantity = customQty;
                    }
                    const targetQty = customQty || matInfo.targetQuantity || 1;
                    if (targetQty > 1) {
                        matInfo.targetQuantity = targetQty;
                        matInfo.tag = `${matInfo.material || 'Material'} ${matInfo.thickness || ''} (${completedExecs.length}/${targetQty})`.trim();
                        matInfo.quantityLabel = `${completedExecs.length}/${targetQty}`;
                        matInfo.completedCount = completedExecs.length;
                    }
                    const dbCompRec = isFileCompletedInDb(gf, gf.jobName, subfolderName, completedFilesMap);
                    const isDbDone = Boolean(dbCompRec);
                    const reopenRec = getFileReopenRec(gf, subfolderName);
                    const isOk = (!reopenRec && (targetQty > 1 ? completedExecs.length >= targetQty : (completedExecs.length > 0 || isFileMarkedOk(gf.name)))) || isDbDone;

                    if (isOk && !isCurrentlyRunning) {
                        const dur = completedExecs.length > 0 
                            ? completedExecs.reduce((a, b) => a + (parseFloat(b.duration_minutes) || 0), 0) 
                            : (estMinutes || 15);
                        gcodeFeitos.push({
                            ...gf,
                            subfolderName,
                            matInfo,
                            estimatedMinutes: estMinutes || dur,
                            cutMeters: gf.cutMeters || null,
                            widthMm: gf.widthMm || null,
                            heightMm: gf.heightMm || null,
                            depthMm: gf.depthMm || null,
                            feeds: gf.feeds || null,
                            spindles: gf.spindles || null,
                            execCount: completedExecs.length > 0 ? completedExecs.length : (targetQty > 1 ? targetQty : 1),
                            targetQuantity: targetQty,
                            completedExecsCount: completedExecs.length > 0 ? completedExecs.length : targetQty,
                            errorExecsCount: errorExecs.length,
                            hasOpError: errorExecs.length > 0,
                            errorExecs: errorExecsSummary,
                            avgValidMinutes,
                            quantityProgress: targetQty > 1 ? `${targetQty}/${targetQty}` : null,
                            statusLabel: targetQty > 1 ? `Concluído (${targetQty}/${targetQty})` : 'Concluído',
                            lastExec: resolveExecutionMeta(completedExecs.length > 0 ? completedExecs : rawCompletedExecs, dbCompRec, gf, dur, dayOpName, nightOpName),
                            totalDurationMinutes: dur,
                            isManuallyDone: isDbDone
                        });
                    } else {
                        gcodeProntos.push({
                            ...gf,
                            subfolderName,
                            matInfo,
                            execCount: completedExecs.length,
                            targetQuantity: targetQty,
                            completedExecsCount: completedExecs.length,
                            errorExecsCount: errorExecs.length,
                            hasOpError: errorExecs.length > 0,
                            errorExecs: errorExecsSummary,
                            avgValidMinutes,
                            quantityProgress: targetQty > 1 ? `${completedExecs.length}/${targetQty}` : null,
                            statusLabel: isCurrentlyRunning
                                ? `Usinando (${completedExecs.length + 1}/${targetQty})`
                                : (targetQty > 1
                                    ? (completedExecs.length > 0 ? `Em progresso (${completedExecs.length}/${targetQty})` : `Pendente (0/${targetQty})`)
                                    : 'Pronto p/ Usinar na Router'),
                            estimatedMinutes: estMinutes || gf.estimatedMinutes || null,
                            cutMeters: meta.cutMeters !== undefined ? meta.cutMeters : (gf.cutMeters || null),
                            widthMm: meta.widthMm || gf.widthMm || null,
                            heightMm: meta.heightMm || gf.heightMm || null,
                            depthMm: meta.depthMm || gf.depthMm || null,
                            feeds: meta.feeds || gf.feeds || null,
                            spindles: meta.spindles || gf.spindles || null,
                            isCurrentlyRunning,
                            isReopened: Boolean(reopenRec),
                            runningMachine: activeExec?.router_name || null,
                            runningStartTime: activeExec?.start_time || null
                        });
                    }
                });

                // Auto-injetar qualquer arquivo que esteja rodando agora ou tenha rodado recentemente no Mach3
                const recentJobCutoff = Date.now() - 48 * 3600 * 1000;
                dbJobs.forEach(j => {
                    const isRunning = isJobActive(j);
                    const st = new Date(j.start_time).getTime();
                    if (!st || (!isRunning && st < recentJobCutoff)) return;
                    const lower = (j.file_name || '').toLowerCase().trim();
                    if (!lower) return;

                    // Se está rodando AGORA na máquina, garante que esteja na Fila Router (.TXT) no topo
                    if (isRunning) {
                        const alreadyInProntos = gcodeProntos.some(p => p.isCurrentlyRunning && p.name.toLowerCase().trim() === lower);
                        if (!alreadyInProntos) {
                            // Se estava em gcodeFeitos por engano, remove
                            const fIdx = gcodeFeitos.findIndex(f => f.name.toLowerCase().trim() === lower);
                            if (fIdx !== -1) gcodeFeitos.splice(fIdx, 1);

                            const matInfo = extractMaterialInfo(j.file_name);
                            gcodeProntos.unshift({
                                name: j.file_name,
                                ext: path.extname(j.file_name).toLowerCase() || '.txt',
                                type: 'gcode',
                                fullPath: `${j.folder || 'Router'}\\${j.file_name}`,
                                size: 0,
                                mtime: st,
                                mtimeDate: j.start_time,
                                jobName: j.folder || 'Fila Router Mach3',
                                subfolderName: j.folder || 'Mach3',
                                matInfo,
                                isCurrentlyRunning: true,
                                runningMachine: j.router_name || 'Router CNC',
                                runningStartTime: j.start_time
                            });
                        }
                        return;
                    }

                    if (seenGcodeNames.has(lower)) return;
                    seenGcodeNames.add(lower);
                });

                // Deduplica e reconcilia arquivos variantes da mesma chapa física (ex: OK 2X vs base, sem tool tag, prefixos invertidos)
                const feitosByCleanKey = new Map();
                gcodeFeitos.forEach(f => {
                    const cleanKey = `${getCleanBaseGCodeName(f.name)}___${(f.subfolderName || '').toLowerCase().trim()}`;
                    if (!feitosByCleanKey.has(cleanKey)) {
                        feitosByCleanKey.set(cleanKey, f);
                    } else {
                        const prev = feitosByCleanKey.get(cleanKey);
                        const prevTime = prev.lastExec?.start_time ? new Date(prev.lastExec.start_time).getTime() : (prev.mtime || 0);
                        const currTime = f.lastExec?.start_time ? new Date(f.lastExec.start_time).getTime() : (f.mtime || 0);
                        if (currTime >= prevTime || (f.name.toLowerCase().includes('ok') && !prev.name.toLowerCase().includes('ok'))) {
                            feitosByCleanKey.set(cleanKey, f);
                        }
                    }
                });

                const prontosByCleanKey = new Map();
                gcodeProntos.forEach(p => {
                    const cleanKey = `${getCleanBaseGCodeName(p.name)}___${(p.subfolderName || '').toLowerCase().trim()}`;
                    if (feitosByCleanKey.has(cleanKey)) return;

                    if (!prontosByCleanKey.has(cleanKey)) {
                        prontosByCleanKey.set(cleanKey, p);
                    } else {
                        const prev = prontosByCleanKey.get(cleanKey);
                        if (p.isCurrentlyRunning) {
                            prontosByCleanKey.set(cleanKey, p);
                        } else if (!prev.isCurrentlyRunning) {
                            const pExecs = p.completedExecsCount || 0;
                            const prevExecs = prev.completedExecsCount || 0;
                            if (pExecs > prevExecs || (p.name.toLowerCase().includes('ok') && !prev.name.toLowerCase().includes('ok')) || (p.mtime || 0) > (prev.mtime || 0)) {
                                prontosByCleanKey.set(cleanKey, p);
                            }
                        }
                    }
                });

                gcodeFeitos.length = 0;
                gcodeFeitos.push(...Array.from(feitosByCleanKey.values()));
                gcodeProntos.length = 0;
                gcodeProntos.push(...Array.from(prontosByCleanKey.values()));

                gcodeProntos.sort((a, b) => (b.isCurrentlyRunning ? 1 : 0) - (a.isCurrentlyRunning ? 1 : 0) || (b.mtime || 0) - (a.mtime || 0));

                const cadPrepararList = (snap.cadPreparar || []).map(cf => {
                    return {
                        ...cf,
                        isManuallyDone: Boolean(isFileCompletedInDb(cf, cf.jobName, cf.subfolderName, completedFilesMap))
                    };
                });

                const aspirePrepararList = (snap.aspirePreparar || [])
                    .filter(af => af.ext !== '.crv3d' && af.ext !== '.crv' && !(af.name || '').toLowerCase().endsWith('.crv3d') && !(af.name || '').toLowerCase().endsWith('.crv'))
                    .map(af => {
                        return {
                            ...af,
                            isManuallyDone: Boolean(isFileCompletedInDb(af, af.jobName, af.subfolderName, completedFilesMap))
                        };
                    });

                const snapResult = {
                    summary: {
                        totalJobs: snap.jobs?.length || 0,
                        totalCadPreparar: cadPrepararList.length,
                        totalAspirePreparar: aspirePrepararList.length || (cadPrepararList.filter(c => ASPIRE_EXTS.includes(c.ext))?.length || 0),
                        totalGcodePronto: gcodeProntos.length,
                        totalConcluidos: gcodeFeitos.length
                    },
                    specialBatches: calculateDynamicBatches(dbJobs, completedFilesMap, customBatches, fileBatchMeta),
                    jobs: snap.jobs || [],
                    cadPreparar: cadPrepararList,
                    aspirePreparar: aspirePrepararList,
                    gcodeProntos,
                    gcodeFeitos,
                    updatedAt: new Date().toISOString()
                };
                pipelineCache.set(cacheKey, { data: snapResult, ts: now });
                return snapResult;
            } catch (err) {
                console.error('Error processing snapshot in getProductionPipeline:', err);
            }
        }
    }

    let totalCadPreparar = 0;
    let totalAspirePreparar = 0;
    let totalGcodePronto = 0;
    let totalConcluidos = 0;

    const allCadPreparar = [];
    const allAspirePreparar = [];
    const allGcodeProntos = [];
    const allGcodeFeitos = [];
    const jobsList = [];

    // Coleta todos os G-Codes recentes globalmente para cruzar caso o Aspire salve o .txt em outra pasta (ex: JANELAS (1).eps -> MDF 3MM E4 MM JANELAS_1-Corte 2.txt)
    const globalGcodes = [];
    const recentCutoffGlobal = new Date('2026-10-01T00:00:00Z').getTime();
    for (const jData of Object.values(jobMap)) {
        (jData.files || []).forEach(f => {
            if (f.type === 'gcode' && ((f.mtime && f.mtime >= recentCutoffGlobal) || jData.source.startsWith('OneDrive'))) {
                globalGcodes.push(f);
            }
        });
    }

    for (const [jName, jData] of Object.entries(jobMap)) {
        // Deduplicate files by subfolder + filename, keeping the newest mtime first
        const unique = [];
        const seen = new Set();
        const sortedFiles = [...(jData.files || [])].sort((a, b) => {
            if ((b.mtime || 0) !== (a.mtime || 0)) {
                return (b.mtime || 0) - (a.mtime || 0);
            }
            const aHasRodar = /rodar\s*\d+\s*x/i.test(a.fullPath || '');
            const bHasRodar = /rodar\s*\d+\s*x/i.test(b.fullPath || '');
            if (aHasRodar !== bHasRodar) return bHasRodar ? 1 : -1;
            return 0;
        });
        sortedFiles.forEach(f => {
            const subDir = getSubfolderName(f.fullPath).toLowerCase().trim();
            const k = `${subDir}___${f.name.toLowerCase().trim()}`;
            if (!seen.has(k)) {
                seen.add(k);
                unique.push(f);
            }
        });

        // Filtrar apenas arquivos liberados recentemente (a partir de 01/10/2026) — mantendo PDFs/fotos de referência
        const recentCutoff = new Date('2026-10-01T00:00:00Z').getTime();
        const activeFiles = unique.filter(f => f.type === 'doc' || (f.mtime && f.mtime >= recentCutoff));

        // Agrupa por pasta normalizada para cruzamento de hierarquia (Corel -> Materiais -> Lote Chapas)
        // Usa a subpasta relativa (ex: 'SALA DE MAGIA') para unificar arquivos do OneDrive (C:) e do Router Local (E:)
        const folderGroups = {};
        activeFiles.forEach(f => {
            const dir = getNormDir(f.fullPath);
            const subfolderName = getSubfolderName(f.fullPath);
            const subName = subfolderName.toLowerCase().trim();
            const rawBase = path.basename(dir).toLowerCase().trim();
            const groupKey = subName || dir.toLowerCase();
            if (!folderGroups[groupKey]) folderGroups[groupKey] = { cad: [], aspire: [], crv: [], gcode: [], docs: [] };
            if (!folderGroups[rawBase]) folderGroups[rawBase] = folderGroups[groupKey];
            if (f.type === 'cad') folderGroups[groupKey].cad.push(f);
            else if (f.type === 'aspire') folderGroups[groupKey].aspire.push(f);
            else if (f.type === 'crv') folderGroups[groupKey].crv.push(f);
            else if (f.type === 'gcode') folderGroups[groupKey].gcode.push(f);
            else if (f.type === 'doc') folderGroups[groupKey].docs.push(f);
        });

        const cad = activeFiles.filter(f => f.type === 'cad');
        const aspire = activeFiles.filter(f => f.type === 'aspire');
        const gcode = activeFiles.filter(f => f.type === 'gcode');

        // 1. Processamento Inteligente do Corel (.CDR Mestre)
        const cadPreparar = [];
        const cadComGcode = [];
        const cadComAspire = [];

        cad.forEach(cf => {
            const dir = getNormDir(cf.fullPath);
            const subfolderName = getSubfolderName(cf.fullPath);
            const subName = subfolderName.toLowerCase().trim();
            const folderFiles = folderGroups[subName] || folderGroups[path.basename(dir).toLowerCase().trim()] || folderGroups[dir] || { cad: [], aspire: [], gcode: [] };
            const matInfo = extractMaterialInfo(cf.name);

            // Arquivos de Aspire na mesma pasta
            let matchingAspire = folderFiles.aspire;
            if (matInfo.tag) {
                const specific = folderFiles.aspire.filter(a => {
                    const aMat = extractMaterialInfo(a.name);
                    return aMat.tag === matInfo.tag || (a.name || '').toLowerCase().includes((cf.name || '').toLowerCase());
                });
                if (specific.length > 0) matchingAspire = specific;
            }

            // Arquivos G-Code de chapas na mesma pasta
            let matchingGcodes = folderFiles.gcode;
            if (matInfo.tag) {
                const specificGcode = folderFiles.gcode.filter(g => {
                    const gMat = extractMaterialInfo(g.name);
                    return gMat.tag === matInfo.tag || (g.name || '').toLowerCase().includes((cf.name || '').toLowerCase());
                });
                if (specificGcode.length > 0) matchingGcodes = specificGcode;
            }

            const hasGcode = matchingGcodes.length > 0;
            const hasAspire = matchingAspire.length > 0;
            const detectedMaterials = [...new Set(matchingAspire.map(a => extractMaterialInfo(a.name).tag).filter(Boolean))];

            let stageStatus = 'aguardando_separar_materiais';
            let statusLabel = 'Aguardando Separar Materiais';

            if (hasGcode) {
                stageStatus = 'lote_liberado';
                statusLabel = `Lote Liberado (${matchingGcodes.length} chapas p/ Router)`;
            } else if (hasAspire) {
                stageStatus = 'materiais_gerados';
                statusLabel = detectedMaterials.length > 0 
                    ? `Separado: ${detectedMaterials.join(', ')}` 
                    : `Separado em ${matchingAspire.length} arquivos Aspire`;
            }

            const isManuallyDone = Boolean(isFileCompletedInDb(cf, jName, subfolderName, completedFilesMap));

            const item = {
                ...cf,
                jobName: jName,
                subfolderName,
                matInfo,
                stageStatus,
                statusLabel,
                hasAspire,
                hasGcode,
                chapasCount: matchingGcodes.length,
                detectedMaterials,
                isManuallyDone
            };

            if (hasGcode) {
                cadComGcode.push(item);
            } else {
                if (hasAspire) cadComAspire.push(item);
                cadPreparar.push(item);
            }
            allCadPreparar.push(item);
        });

        // 2. Processamento Inteligente do Aspire (.EPS / .DXF / .CRV - Arquivos de Materiais)
        const aspirePreparar = [];
        const aspireComGcode = [];

        aspire.forEach(af => {
            const dir = getNormDir(af.fullPath);
            const subfolderName = getSubfolderName(af.fullPath);
            const subName = subfolderName.toLowerCase().trim();
            const folderFiles = folderGroups[subName] || folderGroups[path.basename(dir).toLowerCase().trim()] || folderGroups[dir] || { cad: [], aspire: [], crv: [], gcode: [] };
            let matInfo = extractMaterialInfo(af.name);

            // Cruza com G-Codes da mesma pasta pelo Material ou pelo nome base
            const base = path.parse(af.name).name.toLowerCase().replace(/[-_()]/g, ' ').replace(/\s+/g, ' ').trim();
            let matchingGcodes = folderFiles.gcode.filter(g => {
                const gMat = extractMaterialInfo(g.name);
                if (matInfo.tag && gMat.tag && matInfo.tag === gMat.tag) return true;
                const gBase = path.parse(g.name).name.toLowerCase().replace(/[-_()]/g, ' ').replace(/\s+/g, ' ').trim();
                return gBase.includes(base) || base.includes(gBase);
            });

            // Cruza por tokens/palavras-chave (ex: "moldura 52 unidadesRAMPA B.eps" -> "rampa" e "b")
            if (matchingGcodes.length === 0) {
                const cleanName = path.parse(af.name).name
                    .replace(/([a-z])([A-Z])/g, '$1 $2')
                    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
                    .replace(/[-_()]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .toLowerCase();
                const tokens = cleanName.split(' ').filter(t => t.length >= 2 || /^[a-z0-9]$/i.test(t)).filter(t => !['52', 'unidades', 'moldura', 'fundo', 'em', 'pecas', 'detalhe'].includes(t));
                if (tokens.length > 0) {
                    matchingGcodes = folderFiles.gcode.filter(g => {
                        const gl = g.name.toLowerCase().replace(/[-_()]/g, ' ');
                        return tokens.every(t => gl.includes(t) || (t === 'b' && (gl.includes('r.b') || gl.includes('rb'))));
                    });
                }
            }

            // Se ainda não achou e a subpasta tem poucos G-Codes (ex: ARCO COM PILAR INTERNO com mdf15mm 6mm.txt), vincula os G-Codes da subpasta
            if (matchingGcodes.length === 0 && folderFiles.gcode.length > 0 && folderFiles.gcode.length <= 5) {
                const sameMat = folderFiles.gcode.filter(g => {
                    const gm = extractMaterialInfo(g.name);
                    return !matInfo.tag || !gm.tag || matInfo.tag === gm.tag;
                });
                if (sameMat.length > 0) matchingGcodes = sameMat;
            }

            // Se não achou na mesma pasta, busca globalmente por palavra-chave específica (ex: JANELAS (1).eps -> MDF 3MM E4 MM JANELAS_1-Corte 2.txt)
            if (matchingGcodes.length === 0) {
                const cleanKeyword = base
                    .replace(/\b(?:e|b)?\d+(?:[.,]\d+)?\s*mm\b/gi, '')
                    .replace(/\b(\d+|mdf|comp|compensado|mm|chapa|corte|parte|pvc|isopor|eps)\b/gi, '')
                    .replace(/\s+/g, ' ').trim();
                if (cleanKeyword.length >= 4) {
                    matchingGcodes = globalGcodes.filter(g => {
                        const gLower = g.name.toLowerCase();
                        const timeClose = af.mtime && g.mtime ? Math.abs(g.mtime - af.mtime) < 12 * 3600 * 1000 : true;
                        return timeClose && gLower.includes(cleanKeyword);
                    });
                }
            }

            // Cruza também com arquivos de projeto do Aspire (.crv3d e .crv) salvos na mesma pasta
            const matchingCrv = (folderFiles.crv || []).filter(c => {
                const cl = path.parse(c.name).name.toLowerCase().replace(/[-_()]/g, ' ');
                const cMat = extractMaterialInfo(c.name);
                if (matInfo.tag && cMat.tag && matInfo.tag === cMat.tag) return true;
                const cleanName = path.parse(af.name).name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
                const tokens = cleanName.split(' ').filter(t => t.length >= 2 || /^[a-z0-9]$/i.test(t)).filter(t => !['52', 'unidades', 'moldura', 'fundo', 'em', 'pecas', 'detalhe'].includes(t));
                return tokens.length > 0 && tokens.every(t => cl.includes(t));
            });

            // Se o arquivo .eps não tinha o material escrito no nome, herda do G-Code ou do CRV gerado
            if (!matInfo.tag) {
                if (matchingGcodes.length > 0) {
                    const inherited = extractMaterialInfo(matchingGcodes[0].name);
                    if (inherited.tag) matInfo = inherited;
                } else if (matchingCrv.length > 0) {
                    const inherited = extractMaterialInfo(matchingCrv[0].name);
                    if (inherited.tag) matInfo = inherited;
                }
            }

            const hasGcode = matchingGcodes.length > 0;
            const hasCrv = matchingCrv.length > 0;
            const isReady = hasGcode || hasCrv;
            const chapasCount = matchingGcodes.length || (hasCrv ? 1 : 0);

            let stageStatus = isReady ? 'lote_liberado' : 'aguardando_lote_aspire';
            let statusLabel = hasGcode 
                ? `Lote Pronto: ${chapasCount} chapas geradas` 
                : hasCrv
                ? `Salvo no Aspire (${matchingCrv[0].name})`
                : 'Aguardando Gerar Chapas no Aspire';

            const isManuallyDone = Boolean(isFileCompletedInDb(af, jName, subfolderName, completedFilesMap));

            const item = {
                ...af,
                jobName: jName,
                subfolderName,
                matInfo,
                stageStatus,
                statusLabel,
                hasGcode,
                hasCrv,
                crvName: matchingCrv[0]?.name || null,
                chapasCount,
                chapasList: matchingGcodes.map(g => g.name),
                isManuallyDone
            };

            if (hasGcode) {
                aspireComGcode.push(item);
            } else {
                aspirePreparar.push(item);
            }
            allAspirePreparar.push(item);
        });

        // 3. Processamento dos G-Codes (.TXT, .TAP, etc. - Chapas Liberadas p/ Router)
        const gcodeProntos = [];
        const gcodeFeitos = [];
        const seenJobGcodes = new Set();

        gcode.forEach(gf => {
            const normDir = getNormDir(gf.fullPath);
            const subfolderName = getSubfolderName(gf.fullPath);
            let matInfo = extractMaterialInfo(gf.name, gf.fullPath || subfolderName);
            const customQty = getFileBatchQuantity(gf, subfolderName);
            if (customQty) {
                matInfo.targetQuantity = customQty;
            }
            const lower = gf.name.toLowerCase().trim();
            const subLower = (subfolderName || '').toLowerCase().trim();
            const compoundKey = `${lower}___${subLower}`;
            if (seenJobGcodes.has(compoundKey)) return;
            seenJobGcodes.add(compoundKey);

            // Auto-associa PDFs/fotos dentro da pasta cujo nome corresponda ao material do G-Code
            const folderGroup = folderGroups[subLower] || folderGroups[path.basename(normDir).toLowerCase().trim()] || folderGroups[normDir.toLowerCase()] || null;
            const folderDocs = matchFolderDocsForGcode(gf, matInfo, folderGroup?.docs || []);

            const execs = getFileExecs({ ...gf, subfolderName, jobName: jName }, lower);
            const rawCompletedExecs = execs.filter(j => !isJobActive(j));
            const activeExec = findActiveExec({ ...gf, subfolderName, jobName: jName }, lower);
            const isCurrentlyRunning = Boolean(activeExec);
            const meta = getGCodeMetadata(gf.fullPath, gf.mtime) || {};
            const estMinutes = meta.estimatedMinutes || gf.estimatedMinutes || (gf.cutMeters ? Math.max(1, Math.round((gf.cutMeters * 1000 / (matInfo?.material === 'MDF' ? 1800 : 2500)) * 1.15)) : (gf.name.toLowerCase().includes('isopor') ? 90 : null));
            const { validExecs: completedExecs, errorExecs, avgValidMinutes } = classifyFileExecutions(rawCompletedExecs, estMinutes);
            const errorExecsSummary = errorExecs.map(e => ({
                id: e.id,
                start_time: e.start_time,
                end_time: e.end_time,
                duration_minutes: e.duration_minutes,
                expected_minutes: e.expected_minutes,
                operator_name: e.operator_name,
                router_name: e.router_name
            }));
            const targetQty = customQty || matInfo.targetQuantity || 1;
            if (targetQty > 1) {
                matInfo.targetQuantity = targetQty;
                matInfo.tag = `${matInfo.material || 'Material'} ${matInfo.thickness || ''} (${completedExecs.length}/${targetQty})`.trim();
                matInfo.quantityLabel = `${completedExecs.length}/${targetQty}`;
                matInfo.completedCount = completedExecs.length;
            }
            const dbCompRec = isFileCompletedInDb(gf, jName, subfolderName, completedFilesMap);
            const isDbDone = Boolean(dbCompRec);
            const reopenRec = getFileReopenRec(gf, subfolderName);
            const isOk = (!reopenRec && (targetQty > 1 ? completedExecs.length >= targetQty : (completedExecs.length > 0 || isFileMarkedOk(gf.name)))) || isDbDone;

            if (isOk && !isCurrentlyRunning) {
                const dur = completedExecs.length > 0 
                    ? completedExecs.reduce((a, b) => a + (parseFloat(b.duration_minutes) || 0), 0) 
                    : (estMinutes || 15);
                const item = {
                    ...gf,
                    jobName: jName,
                    subfolderName,
                    matInfo,
                    estimatedMinutes: estMinutes || dur,
                    cutMeters: meta.cutMeters !== undefined ? meta.cutMeters : (gf.cutMeters || null),
                    widthMm: meta.widthMm || gf.widthMm || null,
                    heightMm: meta.heightMm || gf.heightMm || null,
                    depthMm: meta.depthMm || gf.depthMm || null,
                    feeds: meta.feeds || gf.feeds || null,
                    spindles: meta.spindles || gf.spindles || null,
                    folderDocs,
                    execCount: completedExecs.length > 0 ? completedExecs.length : (targetQty > 1 ? targetQty : 1),
                    targetQuantity: targetQty,
                    completedExecsCount: completedExecs.length > 0 ? completedExecs.length : targetQty,
                    errorExecsCount: errorExecs.length,
                    hasOpError: errorExecs.length > 0,
                    errorExecs: errorExecsSummary,
                    avgValidMinutes,
                    quantityProgress: targetQty > 1 ? `${targetQty}/${targetQty}` : null,
                    statusLabel: targetQty > 1 ? `Concluído (${targetQty}/${targetQty})` : 'Concluído',
                    lastExec: resolveExecutionMeta(completedExecs.length > 0 ? completedExecs : rawCompletedExecs, dbCompRec, gf, dur, dayOpName, nightOpName),
                    totalDurationMinutes: dur,
                    isManuallyDone: isDbDone
                };
                gcodeFeitos.push(item);
            } else {
                const item = {
                    ...gf,
                    jobName: jName,
                    subfolderName,
                    matInfo,
                    estimatedMinutes: estMinutes || gf.estimatedMinutes || null,
                    cutMeters: meta.cutMeters !== undefined ? meta.cutMeters : (gf.cutMeters || null),
                    widthMm: meta.widthMm || gf.widthMm || null,
                    heightMm: meta.heightMm || gf.heightMm || null,
                    depthMm: meta.depthMm || gf.depthMm || null,
                    feeds: meta.feeds || gf.feeds || null,
                    spindles: meta.spindles || gf.spindles || null,
                    folderDocs,
                    isCurrentlyRunning,
                    isReopened: Boolean(reopenRec),
                    runningMachine: activeExec?.router_name || null,
                    runningStartTime: activeExec?.start_time || null,
                    targetQuantity: targetQty,
                    completedExecsCount: completedExecs.length,
                    execCount: completedExecs.length,
                    errorExecsCount: errorExecs.length,
                    hasOpError: errorExecs.length > 0,
                    errorExecs: errorExecsSummary,
                    avgValidMinutes,
                    quantityProgress: targetQty > 1 ? `${completedExecs.length}/${targetQty}` : null,
                    statusLabel: isCurrentlyRunning
                        ? `Usinando (${completedExecs.length + 1}/${targetQty})`
                        : (targetQty > 1
                            ? (completedExecs.length > 0 ? `Em progresso (${completedExecs.length}/${targetQty})` : `Pendente (0/${targetQty})`)
                            : 'Pronto p/ Usinar na Router')
                };
                gcodeProntos.push(item);
            }
        });

        // Deduplica e reconcilia arquivos variantes da mesma chapa física (ex: OK 2X vs base, sem tool tag, prefixos invertidos)
        const feitosByCleanKey = new Map();
        gcodeFeitos.forEach(f => {
            const cleanKey = `${getCleanBaseGCodeName(f.name)}___${(f.subfolderName || '').toLowerCase().trim()}`;
            if (!feitosByCleanKey.has(cleanKey)) {
                feitosByCleanKey.set(cleanKey, f);
            } else {
                const prev = feitosByCleanKey.get(cleanKey);
                const prevTime = prev.lastExec?.start_time ? new Date(prev.lastExec.start_time).getTime() : (prev.mtime || 0);
                const currTime = f.lastExec?.start_time ? new Date(f.lastExec.start_time).getTime() : (f.mtime || 0);
                if (currTime >= prevTime || (f.name.toLowerCase().includes('ok') && !prev.name.toLowerCase().includes('ok'))) {
                    feitosByCleanKey.set(cleanKey, f);
                }
            }
        });

        const prontosByCleanKey = new Map();
        gcodeProntos.forEach(p => {
            const cleanKey = `${getCleanBaseGCodeName(p.name)}___${(p.subfolderName || '').toLowerCase().trim()}`;
            if (feitosByCleanKey.has(cleanKey)) return;

            if (!prontosByCleanKey.has(cleanKey)) {
                prontosByCleanKey.set(cleanKey, p);
            } else {
                const prev = prontosByCleanKey.get(cleanKey);
                if (p.isCurrentlyRunning) {
                    prontosByCleanKey.set(cleanKey, p);
                } else if (!prev.isCurrentlyRunning) {
                    const pExecs = p.completedExecsCount || 0;
                    const prevExecs = prev.completedExecsCount || 0;
                    if (pExecs > prevExecs || (p.name.toLowerCase().includes('ok') && !prev.name.toLowerCase().includes('ok')) || (p.mtime || 0) > (prev.mtime || 0)) {
                        prontosByCleanKey.set(cleanKey, p);
                    }
                }
            }
        });

        const finalFeitos = Array.from(feitosByCleanKey.values());
        const finalProntos = Array.from(prontosByCleanKey.values());

        gcodeFeitos.length = 0;
        gcodeFeitos.push(...finalFeitos);
        allGcodeFeitos.push(...finalFeitos);

        gcodeProntos.length = 0;
        gcodeProntos.push(...finalProntos);
        allGcodeProntos.push(...finalProntos);

        totalCadPreparar += cadPreparar.length;
        totalAspirePreparar += aspirePreparar.length;
        totalGcodePronto += gcodeProntos.length;
        totalConcluidos += gcodeFeitos.length;

        jobsList.push({
            name: jName,
            source: jData.source,
            path: jData.path,
            totalFiles: unique.length,
            cadCount: cad.length,
            cadPrepararCount: cadPreparar.length,
            cadComGcodeCount: cadComGcode.length,
            cadComAspireCount: cadComAspire.length,
            aspireCount: aspire.length,
            aspirePrepararCount: aspirePreparar.length,
            aspireComGcodeCount: aspireComGcode.length,
            gcodeCount: gcode.length,
            gcodeProntoCount: gcodeProntos.length,
            gcodeFeitoCount: gcodeFeitos.length,
            progressPercent: (cad.length + aspire.length + gcode.length) > 0 
                ? Math.round((gcodeFeitos.length / (cad.length + aspire.length + gcode.length)) * 100) 
                : 0
        });
    }

    jobsList.sort((a, b) => (b.cadPrepararCount + b.aspirePrepararCount + b.gcodeProntoCount) - (a.cadPrepararCount + a.aspirePrepararCount + a.gcodeProntoCount));

    allCadPreparar.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    allAspirePreparar.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    allGcodeProntos.sort((a, b) => (b.isCurrentlyRunning ? 1 : 0) - (a.isCurrentlyRunning ? 1 : 0) || (b.mtime || 0) - (a.mtime || 0));
    allGcodeFeitos.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

    const result = {
        summary: {
            totalJobs: jobsList.length,
            totalCadPreparar,
            totalAspirePreparar,
            totalGcodePronto,
            totalConcluidos
        },
        specialBatches: calculateDynamicBatches(dbJobs, completedFilesMap, customBatches, fileBatchMeta),
        jobs: jobsList,
        cadPreparar: allCadPreparar,
        aspirePreparar: allAspirePreparar,
        gcodeProntos: allGcodeProntos,
        gcodeFeitos: allGcodeFeitos,
        updatedAt: new Date().toISOString()
    };
    pipelineCache.set(cacheKey, { data: result, ts: now });

    // Salva automaticamente no PostgreSQL para sincronizar em tempo real por tenant
    if (scannedFromDisk) {
        try {
            await pool.query(`
                INSERT INTO pipeline_live_snapshot (id, snapshot_data, updated_at)
                VALUES ($1, $2, CURRENT_TIMESTAMP)
                ON CONFLICT (id) DO UPDATE SET snapshot_data = EXCLUDED.snapshot_data, updated_at = CURRENT_TIMESTAMP
            `, [userId, JSON.stringify(result)]);
        } catch (saveErr) {
            console.error('Erro ao salvar pipeline_live_snapshot:', saveErr.message);
        }
    }

    return result;
}

module.exports = {
    getProductionPipeline,
    calculateDynamicBatches,
    classifyFileExecutions,
    invalidatePipelineCache,
    getGCodeMetadata,
    generateGCodePreviewSvg,
    matchFolderDocsForGcode,
    extractMaterialInfo,
    isFileMarkedOk,
    scopeFileKey,
    unscopeFileKey
};
