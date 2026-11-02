const fs = require('fs');
const path = require('path');

const CAD_EXTS = ['.cdr', '.eps', '.dxf', '.ai', '.dwg', '.crv3d', '.v3d', '.stl', '.3mf', '.svg'];
const GCODE_EXTS = ['.txt', '.nc', '.tap', '.gcode', '.cnc'];

function scanDirRecursive(dir, maxDepth = 6, depth = 0) {
    let files = [];
    if (depth > maxDepth || !fs.existsSync(dir)) return files;
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
            if (ent.name.startsWith('.') || ent.name === 'Thumbs.db') continue;
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

const SPECIAL_BATCHES = [
    {
        id: 'tijolos_9mm',
        name: 'Lote Seriado MDF 9mm Tijolos (100 Chapas)',
        job: '2640  - EXPRESSO HOGWARTS CCXP',
        subfolder: '2640a PAREDE TIJOLO',
        file: 'chapa 3 mdf9mm teste tijolo descida 3mm e6mm.txt',
        material: 'MDF 9mm',
        dimensions: '2731 × 1843 mm',
        tool: 'Fresa Ø6mm (e6mm) Z=3mm · S18000',
        targetSheets: 100,
        doneSheets: 37,
        pendingSheets: 63,
        status: 'pronto_router',
        estMinutesPerSheet: 21,
        totalEstMinutes: 1323,
        priority: 'alta'
    },
    {
        id: 'compensado_6mm_entrada',
        name: 'Compensado 6mm Entrada (Chapas 6 a 9 de 9)',
        job: '2640  - EXPRESSO HOGWARTS CCXP',
        subfolder: '2640 - entrada',
        file: 'compensado 6mm_6-Corte.txt a _9-Corte.txt',
        material: 'Compensado 6mm',
        dimensions: '2200 × 1600 mm',
        tool: 'Fresa Topo Ø6mm · S15000',
        targetSheets: 9,
        doneSheets: 5,
        pendingSheets: 4,
        status: 'pronto_router',
        estMinutesPerSheet: 5,
        totalEstMinutes: 19,
        priority: 'alta'
    },
    {
        id: 'isopor_pinguins_bloco2',
        name: 'Isopor Pinguins 100mm (Bloco 2 a Fazer)',
        job: '2663A e B - PINGUINS HELLA REVESTIDOS',
        subfolder: 'ROUTER/ISOPOR/COD',
        file: '2PVC 100mm b10.txt',
        material: 'Isopor EPS / PVC 100mm',
        dimensions: 'Bloco 100mm Espessura',
        tool: 'Ball Nose Ø10mm · S18000',
        targetSheets: 2,
        doneSheets: 1,
        pendingSheets: 1,
        status: 'pronto_router',
        estMinutesPerSheet: 55,
        totalEstMinutes: 55,
        priority: 'media'
    },
    {
        id: 'moldura_menor_9mm',
        name: 'Moldura Menor Porta Castelo MDF 9mm',
        job: '2640  - EXPRESSO HOGWARTS CCXP',
        subfolder: '2640A - porta castelo',
        file: 'MDF 9MM MOLDURA MENOR E6MM.txt',
        material: 'MDF 9mm',
        dimensions: '2750 × 1850 mm',
        tool: 'Fresa Ø6mm · S18000',
        targetSheets: 1,
        doneSheets: 0,
        pendingSheets: 1,
        status: 'pronto_router',
        estMinutesPerSheet: 8,
        totalEstMinutes: 8,
        priority: 'alta'
    },
    {
        id: 'colunas_parede_9mm',
        name: 'Coluna & Parede Teste MDF 9mm',
        job: '2640  - EXPRESSO HOGWARTS CCXP',
        subfolder: '2640a - TESTE COLUNAS',
        file: 'coluna mdf 9mm e6mm.txt / parede test mdf 9mm e6mm.txt',
        material: 'MDF 9mm',
        dimensions: '1767 × 1222 mm',
        tool: 'Fresa Ø6mm · S18000',
        targetSheets: 2,
        doneSheets: 0,
        pendingSheets: 2,
        status: 'pronto_router',
        estMinutesPerSheet: 23,
        totalEstMinutes: 47,
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

let cachedResult = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 25000; // 25s

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
                        if (!rSub.isDirectory() || (!rSub.name.startsWith('26') && !rSub.name.startsWith('25'))) continue;
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
                } else if (jobName.startsWith('26') || jobName.startsWith('25')) {
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
                    specialBatches: SPECIAL_BATCHES,
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

        const cad = unique.filter(f => f.type === 'cad');
        const gcode = unique.filter(f => f.type === 'gcode');
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

    cachedResult = {
        summary: {
            totalJobs: jobsList.length,
            totalCadPreparar,
            totalGcodePronto,
            totalConcluidos
        },
        specialBatches: SPECIAL_BATCHES,
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
