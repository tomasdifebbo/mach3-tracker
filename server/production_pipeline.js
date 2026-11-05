const fs = require('fs');
const path = require('path');

const CAD_EXTS = ['.cdr']; // Apenas arquivos .CDR do CorelDRAW
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
                if (CAD_EXTS.includes(ext) || GCODE_EXTS.includes(ext)) {
                    const stat = fs.statSync(full);
                    files.push({
                        name: ent.name,
                        ext,
                        type: CAD_EXTS.includes(ext) ? 'cad' : 'gcode',
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

    // 4. Compensado 6mm Entrada (Meta: 9 chapas, chapas 1 a 5 ok, 6 a 9 a finalizar)
    const recentComp6to9 = [6, 7, 8, 9].filter(n =>
        dbJobs.some(j => (j.file_name || '').toLowerCase().includes('compensado 6mm_' + n) && Number(j.duration_minutes) >= 8 && new Date(j.start_time) >= new Date('2026-11-03T00:00:00Z'))
    ).length;
    const compDoneCount = 5 + recentComp6to9;
    const compPending = Math.max(0, 9 - compDoneCount);

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
            name: `Compensado 6mm Entrada (${compDoneCount} de 9)`,
            job: '2640  - EXPRESSO HOGWARTS CCXP',
            subfolder: '2640 - entrada',
            file: 'compensado 6mm_6-Corte.txt a _9-Corte.txt',
            material: 'Compensado 6mm',
            dimensions: '2200 × 1600 mm',
            tool: 'Fresa Topo Ø6mm · S15000',
            targetSheets: 9,
            doneSheets: compDoneCount,
            pendingSheets: compPending,
            status: compPending === 0 ? 'concluido' : 'pronto_router',
            estMinutesPerSheet: 5,
            totalEstMinutes: compPending * 5,
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
const CACHE_TTL_MS = 10000; // 25s

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

    // Fallback if running on Railway/Cloud where local Windows drives don't exist
    if (!scannedFromDisk || Object.keys(jobMap).length === 0) {
        const snapFile = path.join(__dirname, 'initial_pipeline_snapshot.json');
        if (fs.existsSync(snapFile)) {
            try {
                const snap = JSON.parse(fs.readFileSync(snapFile, 'utf8'));
                // Recalculate G-code execution matches with live DB
                const gcodeFeitos = [];
                const gcodeProntos = [];
                (snap.gcodeProntos || []).concat(snap.gcodeFeitos || []).forEach(gf => {
                    const lower = (gf.name || '').toLowerCase().trim();
                    const execs = execMap[lower] || [];
                    if (execs.length > 0) {
                        gcodeFeitos.push({
                            ...gf,
                            execCount: execs.length,
                            lastExec: execs[0],
                            totalDurationMinutes: execs.reduce((a, b) => a + (parseFloat(b.duration_minutes) || 0), 0)
                        });
                    } else {
                        gcodeProntos.push(gf);
                    }
                });

                cachedResult = {
                    summary: {
                        totalJobs: snap.jobs?.length || 0,
                        totalCadPreparar: snap.cadPreparar?.length || 0,
                        totalGcodePronto: gcodeProntos.length,
                        totalConcluidos: gcodeFeitos.length
                    },
                    specialBatches: calculateDynamicBatches(dbJobs),
                    jobs: snap.jobs || [],
                    cadPreparar: snap.cadPreparar || [],
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
    let totalGcodePronto = 0;
    let totalConcluidos = 0;

    const allCadPreparar = [];
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

        const cad = activeFiles.filter(f => f.type === 'cad');
        const gcode = activeFiles.filter(f => f.type === 'gcode');
        const gcodeBases = new Set(gcode.map(g => path.parse(g.name).name.toLowerCase().replace(/[-_]/g, ' ')));

        const cadPreparar = [];
        const cadComGcode = [];

        cad.forEach(cf => {
            const base = path.parse(cf.name).name.toLowerCase().replace(/[-_]/g, ' ');
            let hasGcode = false;
            for (const gb of gcodeBases) {
                if (gb.includes(base) || base.includes(gb)) {
                    hasGcode = true;
                    break;
                }
            }
            const item = { ...cf, jobName: jName };
            if (hasGcode) {
                cadComGcode.push(item);
            } else {
                cadPreparar.push(item);
                allCadPreparar.push(item);
            }
        });

        const gcodeProntos = [];
        const gcodeFeitos = [];

        gcode.forEach(gf => {
            const lower = gf.name.toLowerCase().trim();
            const execs = execMap[lower] || [];
            if (execs.length > 0) {
                const item = {
                    ...gf,
                    jobName: jName,
                    execCount: execs.length,
                    lastExec: execs[0],
                    totalDurationMinutes: execs.reduce((a, b) => a + (parseFloat(b.duration_minutes) || 0), 0)
                };
                gcodeFeitos.push(item);
                allGcodeFeitos.push(item);
            } else {
                const item = { ...gf, jobName: jName };
                gcodeProntos.push(item);
                allGcodeProntos.push(item);
            }
        });

        totalCadPreparar += cadPreparar.length;
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
            gcodeCount: gcode.length,
            gcodeProntoCount: gcodeProntos.length,
            gcodeFeitoCount: gcodeFeitos.length,
            progressPercent: (cad.length + gcode.length) > 0 
                ? Math.round((gcodeFeitos.length / (cad.length + gcode.length)) * 100) 
                : 0
        });
    }

    jobsList.sort((a, b) => (b.cadPrepararCount + b.gcodeProntoCount) - (a.cadPrepararCount + a.gcodeProntoCount));

    allCadPreparar.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    allGcodeProntos.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
    allGcodeFeitos.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));

    cachedResult = {
        summary: {
            totalJobs: jobsList.length,
            totalCadPreparar,
            totalGcodePronto,
            totalConcluidos
        },
        specialBatches: calculateDynamicBatches(dbJobs),
        jobs: jobsList,
        cadPreparar: allCadPreparar,
        gcodeProntos: allGcodeProntos,
        gcodeFeitos: allGcodeFeitos,
        updatedAt: new Date().toISOString()
    };
    lastCacheTime = now;

    return cachedResult;
}

module.exports = { getProductionPipeline };
