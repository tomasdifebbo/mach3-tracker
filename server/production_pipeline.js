const fs = require('fs');
const path = require('path');

const CAD_EXTS = ['.cdr']; // Apenas arquivos .CDR do CorelDRAW
const ASPIRE_EXTS = ['.eps', '.dxf', '.crv', '.crv3d']; // Arquivos vetoriais/projetos para abrir e preparar no Aspire
const GCODE_EXTS = ['.txt', '.nc', '.tap', '.gcode', '.cnc'];

function scanDirRecursive(dir, maxDepth = 6, depth = 0) {
    let files = [];
    if (depth > maxDepth || !fs.existsSync(dir)) return files;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
            if (ent.name.startsWith('.') || ent.name === 'Thumbs.db') continue;
            const lowerName = ent.name.toLowerCase();
            if (lowerName.startsWith('cópia_de_segurança') || lowerName.startsWith('copia_de_seguranca') || lowerName.startsWith('backup_of_') || lowerName.startsWith('@')) continue;
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) {
                files = files.concat(scanDirRecursive(full, maxDepth, depth + 1));
            } else if (ent.isFile()) {
                const ext = path.extname(ent.name).toLowerCase();
                if (CAD_EXTS.includes(ext) || ASPIRE_EXTS.includes(ext) || GCODE_EXTS.includes(ext)) {
                    const stat = fs.statSync(full);
                    let type = 'cad';
                    if (ASPIRE_EXTS.includes(ext)) type = 'aspire';
                    else if (GCODE_EXTS.includes(ext)) type = 'gcode';
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
    } catch (e) {}
    return files;
}

// Extrai inteligentemente material, espessura e quantidade do nome do arquivo
function extractMaterialInfo(name) {
    const fn = (name || '').toLowerCase();
    let material = null;
    if (fn.includes('mdf')) material = 'MDF';
    else if (fn.includes('compensado') || fn.includes('comp ') || fn.includes('cambota')) material = 'Compensado';
    else if (fn.includes('pvc')) material = 'PVC';
    else if (fn.includes('isopor') || fn.includes('eps')) material = 'Isopor EPS';
    else if (fn.includes('acrilico') || fn.includes('acrílico')) material = 'Acrílico';
    else if (fn.includes('ps ') || fn.includes('ps3mm') || fn.includes('ps2mm') || fn.includes('ps1mm')) material = 'PS';
    else if (fn.includes('eva')) material = 'EVA';
    else if (fn.includes('ptg') || fn.includes('petg')) material = 'PETG';
    else if (fn.includes('acm') || fn.includes('aluminio') || fn.includes('alumínio')) material = 'ACM';

    const thickMatch = fn.match(/(\d+(?:[.,]\d+)?)\s*(?:mm|m\b)/i);
    const thickness = thickMatch ? `${thickMatch[1].replace(',', '.')}mm` : null;

    let tag = null;
    if (material && thickness) tag = `${material} ${thickness}`;
    else if (material) tag = material;
    else if (thickness) tag = thickness;

    // Detecta se é arquivo de chapa individual ou lote
    const chapaMatch = fn.match(/(?:chapa\s*(\d+)|(\d+)\s*x|parte\s*(\d+)|_(\d+)|(\d+)\s*(?:pvc|mdf|comp))/i);
    const chapaIndex = chapaMatch ? (chapaMatch[1] || chapaMatch[2] || chapaMatch[3] || chapaMatch[4] || chapaMatch[5]) : null;

    return { material, thickness, tag, chapaIndex };
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

    // 2. Arquivos de Compensado e Tijolos confirmados como concluídos pelo Tomas
    if (
        lower.includes('compensado 6mm e6mm_11') ||
        lower.includes('compensado 6mm e6mm_12') ||
        lower.includes('compensado 6mm e6mm_10') ||
        lower.includes('compensado 6mm e6mm_9') ||
        lower.includes('compensado 6mm e6mm_8') ||
        lower.includes('compensado 6mm e6mm_7') ||
        lower.includes('compensado 6mm e6mm_5') ||
        lower.includes('compensado 6mm e6mm_4') ||
        lower.includes('compensado 6mm e6mm_3') ||
        lower.includes('compensado 6mm e6mm_2') ||
        lower.includes('compensado 6mm e6mm_1') ||
        lower.includes('textura tijolos especiais e4mm') ||
        lower.includes('compensado 10mm e6mm_1') ||
        lower.includes('aplique mdf 9mm_1-corte 1') ||
        lower.includes('aplique mdf 9mm_2-corte 2') ||
        lower.includes('aplique mdf 9mm_3-corte 3') ||
        lower.includes('aplique mdf 9mm_4-corte 4') ||
        lower.includes('aplique mdf 9mm_1-corte 5') ||
        lower.includes('aplique mdf 9mm_2-corte 6')
    ) {
        return true;
    }

    return false;
}

function calculateDynamicBatches(dbJobs = []) {
    // 1. Tijolos MDF 9mm (Meta: 100 chapas)
    const tijoloRuns = dbJobs.filter(j => 
        (j.file_name || '').toLowerCase().includes('tijolo') &&
        new Date(j.start_time) >= new Date('2026-10-29T00:00:00Z') &&
        (Number(j.duration_minutes) >= 18 || (!j.duration_minutes && (Date.now() - new Date(j.start_time).getTime() < 5400000)))
    );
    const tijoloDone = Math.min(100, Math.max(37, tijoloRuns.length));
    const tijoloPending = Math.max(0, 100 - tijoloDone);

    // 2. Pinguins Hella 100mm (Meta: 8 chapas/blocos PVC)
    const pvcNumbers = [1, 2, 3, 4, 5, 6, 7, 8];
    const pvcDoneList = pvcNumbers.filter(n => 
        dbJobs.some(j => (j.file_name || '').toLowerCase().includes(n + ' pvc 100mm') && new Date(j.start_time) >= new Date('2026-11-04T00:00:00Z'))
    );
    const pinguinsDone = pvcDoneList.length;
    const pinguinsPending = Math.max(0, 8 - pinguinsDone);

    // 3. Arcos & Pilares Entrada (Meta: 8 chapas: 3x 15mm + 5x 9mm)
    const arcos15Done = [1, 2, 3].filter(n =>
        dbJobs.some(j => (j.file_name || '').toLowerCase().includes('mdf 15mm') && (j.file_name || '').toLowerCase().includes('arco corte ' + n) && new Date(j.start_time) >= new Date('2026-11-04T00:00:00Z'))
    ).length;
    const arcos9Done = [1, 2, 3, 4, 5].filter(n =>
        dbJobs.some(j => (j.file_name || '').toLowerCase().includes('arcos corte ' + n) && new Date(j.start_time) >= new Date('2026-11-04T00:00:00Z'))
    ).length;
    const arcosTotalDone = arcos15Done + arcos9Done;
    const arcosPending = Math.max(0, 8 - arcosTotalDone);

    // 4. Compensado 6mm Entrada (Meta: 12 chapas - 100% Concluído/OK)
    const compDoneCount = 12;
    const compPending = 0;

    // 5. Moldura Menor 9mm
    const molduraRuns = dbJobs.filter(j => (j.file_name || '').toLowerCase().includes('moldura menor') && (j.file_name || '').toLowerCase().includes('9mm'));
    const molduraDone = molduraRuns.length > 0 ? 1 : 0;
    const molduraPending = Math.max(0, 1 - molduraDone);

    // 6. Coluna & Parede Teste 9mm
    const hasColuna = dbJobs.some(j => (j.file_name || '').toLowerCase().includes('coluna mdf 9mm'));
    const hasParede = dbJobs.some(j => (j.file_name || '').toLowerCase().includes('parede test mdf 9mm'));
    const colDone = (hasColuna ? 1 : 0) + (hasParede ? 1 : 0);
    const colPending = Math.max(0, 2 - colDone);

    // 7. Torres MDF 9mm
    const torresDone = 12;

    // 8. Hogsmead Apliques MDF 9mm & 15mm (11 cortes no total)
    const apliqueRuns = dbJobs.filter(j => 
        ((j.file_name || '').toLowerCase().includes('aplique mdf 9mm') || (j.file_name || '').toLowerCase().includes('aplique mdf 15')) &&
        new Date(j.start_time) >= new Date('2026-11-07T00:00:00Z')
    );
    const apliqueDone = Math.min(11, Math.max(6, apliqueRuns.length));
    const apliquePending = Math.max(0, 11 - apliqueDone);

    // 9. Parede Especial Photo Opp (33 cortes executados na madrugada de 07/11)
    const paredeEspDone = 33;

    return [
        {
            id: 'tijolos_9mm',
            name: `Lote Seriado MDF 9mm Tijolos (${tijoloDone} de 100)`,
            job: '2640  - EXPRESSO HOGWARTS CCXP',
            subfolder: '2640a PAREDE TIJOLO',
            file: 'chapa 3 mdf9mm teste tijolo descida 3mm e6mm.txt',
            material: 'MDF 9mm',
            dimensions: '2731 × 1843 mm',
            tool: 'Fresa Ø6mm (e6mm) Z=3mm · S18000',
            targetSheets: 100,
            doneSheets: tijoloDone,
            pendingSheets: tijoloPending,
            status: tijoloPending === 0 ? 'concluido' : 'pronto_router',
            estMinutesPerSheet: 21,
            totalEstMinutes: tijoloPending * 21,
            priority: 'alta'
        },
        {
            id: 'pinguins_hella_100mm',
            name: `Pinguins Hella EPS/PVC 100mm (${pinguinsDone} de 8)`,
            job: '2663A e B - PINGUINS HELLA REVESTIDOS',
            subfolder: 'ROUTER',
            file: '1 PVC a 8 PVC 100mm b10mm.txt',
            material: 'Isopor EPS / PVC 100mm',
            dimensions: 'Blocos 100mm',
            tool: 'Ball Nose Ø10mm / Ø12mm',
            targetSheets: 8,
            doneSheets: pinguinsDone,
            pendingSheets: pinguinsPending,
            status: pinguinsPending === 0 ? 'concluido' : 'em_andamento',
            estMinutesPerSheet: 50,
            totalEstMinutes: pinguinsPending * 50,
            priority: 'alta'
        },
        {
            id: 'arcos_pilares_entrada',
            name: `Arcos & Pilares Entrada (${arcosTotalDone} de 8)`,
            job: '2640  - EXPRESSO HOGWARTS CCXP',
            subfolder: 'FACHADA CASAS/CNC',
            file: 'MDF 15MM E6MM ARCO (3x) + MDF 9MM ARCOS (5x)',
            material: 'MDF 15mm & MDF 9mm',
            dimensions: 'Chapas 2750 × 1850 mm',
            tool: 'Fresa Topo Ø6mm · S18000',
            targetSheets: 8,
            doneSheets: arcosTotalDone,
            pendingSheets: arcosPending,
            status: arcosPending === 0 ? 'concluido' : 'pronto_router',
            estMinutesPerSheet: 20,
            totalEstMinutes: arcosPending * 20,
            priority: 'alta'
        },
        {
            id: 'compensado_6mm_entrada',
            name: 'Compensado 6mm Entrada (12 de 12)',
            job: '2640  - EXPRESSO HOGWARTS CCXP',
            subfolder: 'FACHADA PHOTO OPP',
            file: 'compensado 6mm e6mm (Chapas 1 a 12)',
            material: 'Compensado 6mm',
            dimensions: '2200 × 1600 mm',
            tool: 'Fresa Topo Ø6mm · S15000',
            targetSheets: 12,
            doneSheets: 12,
            pendingSheets: 0,
            status: 'concluido',
            estMinutesPerSheet: 5,
            totalEstMinutes: 0,
            priority: 'alta'
        },
        {
            id: 'moldura_menor_9mm',
            name: `Moldura Menor Porta Castelo MDF 9mm (${molduraDone} de 1)`,
            job: '2640  - EXPRESSO HOGWARTS CCXP',
            subfolder: '2640A - porta castelo',
            file: 'MDF 9MM MOLDURA MENOR E6MM.txt',
            material: 'MDF 9mm',
            dimensions: '2750 × 1850 mm',
            tool: 'Fresa Ø6mm · S18000',
            targetSheets: 1,
            doneSheets: molduraDone,
            pendingSheets: molduraPending,
            status: molduraPending === 0 ? 'concluido' : 'pronto_router',
            estMinutesPerSheet: 8,
            totalEstMinutes: molduraPending * 8,
            priority: 'media'
        },
        {
            id: 'colunas_parede_9mm',
            name: `Coluna & Parede Teste MDF 9mm (${colDone} de 2)`,
            job: '2640  - EXPRESSO HOGWARTS CCXP',
            subfolder: '2640a - TESTE COLUNAS',
            file: 'coluna mdf 9mm e6mm.txt / parede test mdf 9mm e6mm.txt',
            material: 'MDF 9mm',
            dimensions: '1767 × 1222 mm',
            tool: 'Fresa Ø6mm · S18000',
            targetSheets: 2,
            doneSheets: colDone,
            pendingSheets: colPending,
            status: colPending === 0 ? 'concluido' : 'pronto_router',
            estMinutesPerSheet: 23,
            totalEstMinutes: colPending * 23,
            priority: 'media'
        },
        {
            id: 'hogsmead_apliques_9mm',
            name: `Apliques Hogsmead MDF 9mm & 15mm (${apliqueDone} de 11 cortes)`,
            job: '2640  - EXPRESSO HOGWARTS CCXP',
            subfolder: 'ROUTER/HOGSMEAD',
            file: 'APLIQUE MDF 9MM & 15MM (Cortes 1 a 11)',
            material: 'MDF 9mm & 15mm',
            dimensions: 'Chapas 2750 × 1850 mm',
            tool: 'Fresa Topo Ø6mm / Ø4mm',
            targetSheets: 11,
            doneSheets: apliqueDone,
            pendingSheets: apliquePending,
            status: apliquePending === 0 ? 'concluido' : 'em_andamento',
            estMinutesPerSheet: 18,
            totalEstMinutes: apliquePending * 18,
            priority: 'alta'
        },
        {
            id: 'parede_especial_photo_opp',
            name: 'Parede Especial Photo Opp (33 de 33 chapas)',
            job: '2640  - EXPRESSO HOGWARTS CCXP',
            subfolder: 'FACHADA PHOTO OPP/PAREDE ESPECIAL',
            file: 'MDF 9 MM E4MM CHAPA_1 a 34',
            material: 'MDF 9mm',
            dimensions: 'Chapas 2750 × 1850 mm',
            tool: 'Fresa Topo Ø4mm (e4mm)',
            targetSheets: 33,
            doneSheets: 33,
            pendingSheets: 0,
            status: 'concluido',
            estMinutesPerSheet: 32,
            totalEstMinutes: 0,
            priority: 'alta'
        },
        {
            id: 'torres_mdf_9mm',
            name: 'Torres MDF 9mm (Chapas 1 e 2)',
            job: '2640  - EXPRESSO HOGWARTS CCXP',
            subfolder: 'TORRES',
            file: 'chapa 1 mdf 9mm e6mm.txt / chapa 2 mdf 9mm e6mm.txt',
            material: 'MDF 9mm',
            dimensions: '2750 × 1850 mm',
            tool: 'Fresa Ø6mm',
            targetSheets: 12,
            doneSheets: 12,
            pendingSheets: 0,
            status: 'concluido',
            estMinutesPerSheet: 35,
            totalEstMinutes: 0,
            priority: 'concluido'
        }
    ];
}

let cachedResult = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 10000; // 10s

async function getProductionPipeline(pool, forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedResult && (now - lastCacheTime < CACHE_TTL_MS)) {
        return cachedResult;
    }

    // 1. Get executions from PostgreSQL
    let dbJobs = [];
    try {
        const { rows } = await pool.query(`
            SELECT id, file_name, folder, router_name, operator_name, start_time, end_time, duration_minutes 
            FROM jobs 
            ORDER BY start_time DESC
        `);
        dbJobs = rows;
    } catch (e) {
        console.error('Error fetching jobs in getProductionPipeline:', e.message);
    }

    const execMap = {};
    dbJobs.forEach(j => {
        const fn = (j.file_name || '').toLowerCase().trim();
        if (!execMap[fn]) execMap[fn] = [];
        execMap[fn].push(j);
    });

    const oneDriveRoot = 'C:\\Users\\Atelier Arte\\Atelier Casa do Trem LTDA\\dados2 - Jobs Ativos';
    const localRouterRoot = 'E:\\arquivos 2024\\ARQUIVOS 2026';

    const jobMap = {};
    let scannedFromDisk = false;

    // 1. Scan OneDrive 3 - OFICINA (if accessible)
    if (fs.existsSync(oneDriveRoot)) {
        try {
            const list = fs.readdirSync(oneDriveRoot, { withFileTypes: true });
            for (const d of list) {
                if (!d.isDirectory() || d.name.startsWith('.')) continue;
                const jobDir = path.join(oneDriveRoot, d.name);
                try {
                    const sub = fs.readdirSync(jobDir, { withFileTypes: true });
                    const oficina = sub.find(e => e.isDirectory() && /3\s*-\s*OFICINA/i.test(e.name));
                    if (oficina) {
                        const oficinaPath = path.join(jobDir, oficina.name);
                        const files = scanDirRecursive(oficinaPath);
                        jobMap[d.name] = {
                            name: d.name,
                            source: 'OneDrive (3 - OFICINA)',
                            path: oficinaPath,
                            files: files
                        };
                        scannedFromDisk = true;
                    }
                } catch (e) {}
            }
        } catch (e) {}
    }

    // 2. Scan Local E:\arquivos 2024\ARQUIVOS 2026\router and active folders (if accessible)
    if (fs.existsSync(localRouterRoot)) {
        try {
            const list = fs.readdirSync(localRouterRoot, { withFileTypes: true });
            for (const d of list) {
                if (!d.isDirectory() || d.name === 'node_modules' || d.name === '.git') continue;
                const jobName = d.name;
                const targetDir = path.join(localRouterRoot, jobName);
                if (jobName === 'router') {
                    const routerSubs = fs.readdirSync(targetDir, { withFileTypes: true });
                    for (const rSub of routerSubs) {
                        if (!rSub.isDirectory() || !rSub.name.startsWith('26')) continue;
                        const subPath = path.join(targetDir, rSub.name);
                        const subFiles = scanDirRecursive(subPath);
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
                } else if (jobName.startsWith('26')) {
                    const files = scanDirRecursive(targetDir);
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
        } catch (e) {}
    }

    // Helper: normaliza o diretório removendo subpastas técnicas (CNC, cod, etc)
    function getNormDir(filePath) {
        return path.dirname(filePath || '').replace(/[\\/](cod|cnc|gcode|cortes)$/i, '');
    }

    // Fallback if running on Railway/Cloud where local Windows drives don't exist
    if (!scannedFromDisk || Object.keys(jobMap).length === 0) {
        const snapFile = path.join(__dirname, 'initial_pipeline_snapshot.json');
        if (fs.existsSync(snapFile)) {
            try {
                const snap = JSON.parse(fs.readFileSync(snapFile, 'utf8'));
                const gcodeFeitos = [];
                const gcodeProntos = [];
                (snap.gcodeProntos || []).concat(snap.gcodeFeitos || []).forEach(gf => {
                    const lower = (gf.name || '').toLowerCase().trim();
                    const execs = execMap[lower] || [];
                    const isOk = isFileMarkedOk(gf.name) || (execs.length > 0);
                    if (isOk) {
                        gcodeFeitos.push({
                            ...gf,
                            execCount: execs.length > 0 ? execs.length : 1,
                            lastExec: execs[0] || {
                                operator_name: 'Tomas',
                                machine_name: 'Router 2',
                                start_time: gf.mtimeDate || new Date().toISOString(),
                                duration_minutes: 15
                            },
                            totalDurationMinutes: execs.length > 0 ? execs.reduce((a, b) => a + (parseFloat(b.duration_minutes) || 0), 0) : 15
                        });
                    } else {
                        gcodeProntos.push(gf);
                    }
                });

                cachedResult = {
                    summary: {
                        totalJobs: snap.jobs?.length || 0,
                        totalCadPreparar: snap.cadPreparar?.length || 0,
                        totalAspirePreparar: snap.aspirePreparar?.length || (snap.cadPreparar?.filter(c => ASPIRE_EXTS.includes(c.ext))?.length || 0),
                        totalGcodePronto: gcodeProntos.length,
                        totalConcluidos: gcodeFeitos.length
                    },
                    specialBatches: calculateDynamicBatches(dbJobs),
                    jobs: snap.jobs || [],
                    cadPreparar: snap.cadPreparar || [],
                    aspirePreparar: snap.aspirePreparar || [],
                    gcodeProntos,
                    gcodeFeitos,
                    updatedAt: new Date().toISOString()
                };
                lastCacheTime = now;
                return cachedResult;
            } catch (err) {
                console.error('Error loading initial_pipeline_snapshot.json:', err);
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

    for (const [jName, jData] of Object.entries(jobMap)) {
        // Deduplicate files by filename + size
        const unique = [];
        const seen = new Set();
        jData.files.forEach(f => {
            const k = f.name.toLowerCase() + '_' + f.size;
            if (!seen.has(k)) {
                seen.add(k);
                unique.push(f);
            }
        });

        // Filtrar apenas arquivos liberados recentemente (a partir de 01/10/2026 ou OneDrive)
        const recentCutoff = new Date('2026-10-01T00:00:00Z').getTime();
        const activeFiles = unique.filter(f => (f.mtime && f.mtime >= recentCutoff) || jData.source.startsWith('OneDrive'));

        // Agrupa por pasta normalizada para cruzamento de hierarquia (Corel -> Materiais -> Lote Chapas)
        const folderGroups = {};
        activeFiles.forEach(f => {
            const dir = getNormDir(f.fullPath);
            if (!folderGroups[dir]) folderGroups[dir] = { cad: [], aspire: [], gcode: [] };
            if (f.type === 'cad') folderGroups[dir].cad.push(f);
            else if (f.type === 'aspire') folderGroups[dir].aspire.push(f);
            else if (f.type === 'gcode') folderGroups[dir].gcode.push(f);
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
            const subfolderName = path.basename(dir);
            const folderFiles = folderGroups[dir] || { cad: [], aspire: [], gcode: [] };
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
                detectedMaterials
            };

            if (hasGcode) {
                cadComGcode.push(item);
            } else {
                if (hasAspire) cadComAspire.push(item);
                cadPreparar.push(item);
                allCadPreparar.push(item);
            }
        });

        // 2. Processamento Inteligente do Aspire (.EPS / .DXF / .CRV - Arquivos de Materiais)
        const aspirePreparar = [];
        const aspireComGcode = [];

        aspire.forEach(af => {
            const dir = getNormDir(af.fullPath);
            const subfolderName = path.basename(dir);
            const folderFiles = folderGroups[dir] || { cad: [], aspire: [], gcode: [] };
            const matInfo = extractMaterialInfo(af.name);

            // Cruza com G-Codes da mesma pasta pelo Material ou pelo nome base
            const base = path.parse(af.name).name.toLowerCase().replace(/[-_]/g, ' ');
            const matchingGcodes = folderFiles.gcode.filter(g => {
                const gMat = extractMaterialInfo(g.name);
                if (matInfo.tag && gMat.tag && matInfo.tag === gMat.tag) return true;
                const gBase = path.parse(g.name).name.toLowerCase().replace(/[-_]/g, ' ');
                return gBase.includes(base) || base.includes(gBase);
            });

            const hasGcode = matchingGcodes.length > 0;
            const chapasCount = matchingGcodes.length;

            let stageStatus = hasGcode ? 'lote_liberado' : 'aguardando_lote_aspire';
            let statusLabel = hasGcode 
                ? `Lote Pronto: ${chapasCount} chapas geradas` 
                : 'Aguardando Gerar Chapas no Aspire';

            const item = {
                ...af,
                jobName: jName,
                subfolderName,
                matInfo,
                stageStatus,
                statusLabel,
                hasGcode,
                chapasCount,
                chapasList: matchingGcodes.map(g => g.name)
            };

            if (hasGcode) {
                aspireComGcode.push(item);
            } else {
                aspirePreparar.push(item);
                allAspirePreparar.push(item);
            }
        });

        // 3. Processamento dos G-Codes (.TXT, .TAP, etc. - Chapas Liberadas p/ Router)
        const gcodeProntos = [];
        const gcodeFeitos = [];

        gcode.forEach(gf => {
            const dir = getNormDir(gf.fullPath);
            const subfolderName = path.basename(dir);
            const matInfo = extractMaterialInfo(gf.name);
            const lower = gf.name.toLowerCase().trim();
            const execs = execMap[lower] || [];
            const isOk = isFileMarkedOk(gf.name) || (execs.length > 0);

            if (isOk) {
                const item = {
                    ...gf,
                    jobName: jName,
                    subfolderName,
                    matInfo,
                    execCount: execs.length > 0 ? execs.length : 1,
                    lastExec: execs[0] || {
                        operator_name: 'Tomas',
                        machine_name: 'Router 2',
                        start_time: gf.mtimeDate || new Date().toISOString(),
                        duration_minutes: 15
                    },
                    totalDurationMinutes: execs.length > 0 ? execs.reduce((a, b) => a + (parseFloat(b.duration_minutes) || 0), 0) : 15
                };
                gcodeFeitos.push(item);
                allGcodeFeitos.push(item);
            } else {
                const item = {
                    ...gf,
                    jobName: jName,
                    subfolderName,
                    matInfo
                };
                gcodeProntos.push(item);
                allGcodeProntos.push(item);
            }
        });

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
    allGcodeProntos.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    allGcodeFeitos.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

    cachedResult = {
        summary: {
            totalJobs: jobsList.length,
            totalCadPreparar,
            totalAspirePreparar,
            totalGcodePronto,
            totalConcluidos
        },
        specialBatches: calculateDynamicBatches(dbJobs),
        jobs: jobsList,
        cadPreparar: allCadPreparar,
        aspirePreparar: allAspirePreparar,
        gcodeProntos: allGcodeProntos,
        gcodeFeitos: allGcodeFeitos,
        updatedAt: new Date().toISOString()
    };
    lastCacheTime = now;

    return cachedResult;
}

module.exports = { getProductionPipeline, calculateDynamicBatches };
