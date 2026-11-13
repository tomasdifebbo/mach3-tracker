const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');
const { getProductionPipeline, invalidatePipelineCache } = require('./production_pipeline');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
    console.error('[PipelineDaemon] Pool error (reconectando automaticamente):', err.message);
});

process.on('uncaughtException', (err) => {
    console.error('[PipelineDaemon] Uncaught Exception (recuperando):', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('[PipelineDaemon] Unhandled Rejection (recuperando):', reason ? (reason.message || reason) : 'desconhecido');
});

let lastSignature = '';
let isSyncing = false;
let pendingSync = false;
let debounceTimer = null;

async function syncFoldersToCloud(reason = 'interval') {
    if (isSyncing) {
        pendingSync = true;
        return;
    }
    isSyncing = true;
    try {
        invalidatePipelineCache(1);
        const data = await getProductionPipeline(pool, true, { userId: 1 });
        if (!data || !data.summary) {
            isSyncing = false;
            return;
        }

        // Assinatura completa para detectar QUALQUER arquivo novo, modificado ou concluído
        const sig = JSON.stringify({
            s: data.summary,
            c: (data.cadPreparar || []).map(f => `${f.name}_${f.mtime}`),
            a: (data.aspirePreparar || []).map(f => `${f.name}_${f.mtime}_${f.chapasCount}`),
            g: (data.gcodeProntos || []).map(f => `${f.name}_${f.mtime}_${f.isCurrentlyRunning}`)
        });

        await pool.query(`
            INSERT INTO pipeline_live_snapshot (id, snapshot_data, updated_at)
            VALUES (1, $1, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET snapshot_data = EXCLUDED.snapshot_data, updated_at = CURRENT_TIMESTAMP
        `, [JSON.stringify(data)]);

        if (sig !== lastSignature) {
            lastSignature = sig;
            const snapPath = path.join(__dirname, 'initial_pipeline_snapshot.json');
            fs.writeFileSync(snapPath, JSON.stringify(data, null, 2), 'utf8');
            console.log(`[${new Date().toLocaleTimeString('pt-BR')}] [${reason}] Pipeline sincronizado! Prontos: ${data.summary.totalGcodePronto} | Aspire: ${data.summary.totalAspirePreparar} | Concluídos: ${data.summary.totalConcluidos}`);
        }
    } catch (err) {
        console.error('[PipelineDaemon] Erro na varredura:', err.message);
    } finally {
        isSyncing = false;
        if (pendingSync) {
            pendingSync = false;
            setTimeout(() => syncFoldersToCloud('pending'), 500);
        }
    }
}

function triggerInstantSync(fileInfo) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        syncFoldersToCloud(`watch: ${fileInfo || 'arquivo modificado'}`);
    }, 1200);
}

// Resolve watch directories dynamically from tenant #1 PostgreSQL config or environment variables
async function resolveWatchDirs() {
    const dirs = new Set([
        'E:\\arquivos 2024\\ARQUIVOS 2026\\router',
        'C:\\Users\\Atelier Arte\\Atelier Casa do Trem LTDA\\dados2 - Jobs Ativos'
    ]);
    if (process.env.PIPELINE_LOCAL_ROOT) dirs.add(process.env.PIPELINE_LOCAL_ROOT.trim());
    if (process.env.PIPELINE_ONEDRIVE_ROOT) dirs.add(process.env.PIPELINE_ONEDRIVE_ROOT.trim());

    try {
        const res = await pool.query(
            'SELECT pipeline_local_root, pipeline_cloud_root FROM users WHERE id = 1 LIMIT 1'
        );
        const cfg = res.rows[0];
        if (cfg?.pipeline_local_root) dirs.add(cfg.pipeline_local_root.trim());
        if (cfg?.pipeline_cloud_root) dirs.add(cfg.pipeline_cloud_root.trim());
    } catch (err) {
        console.warn('[PipelineDaemon] Aviso ao carregar pastas do banco:', err.message);
    }
    return Array.from(dirs).filter(Boolean);
}

async function startDaemon() {
    const watchDirs = await resolveWatchDirs();
    if (watchDirs.length === 0) {
        console.log('ℹ️ [PipelineDaemon] Nenhuma pasta local configurada (configure PIPELINE_LOCAL_ROOT / PIPELINE_ONEDRIVE_ROOT ou salve em Configurações no painel).');
    }

    watchDirs.forEach(dir => {
        if (fs.existsSync(dir)) {
            try {
                fs.watch(dir, { recursive: true }, (eventType, filename) => {
                    if (!filename) return;
                    const lower = filename.toLowerCase();
                    // Ignora arquivos temporários e de lock do sistema
                    if (lower.endsWith('.tmp') || lower.includes('~$') || lower === 'thumbs.db' || lower.startsWith('.')) return;
                    if (lower.endsWith('.txt') || lower.endsWith('.crv3d') || lower.endsWith('.crv') || lower.endsWith('.eps') || lower.endsWith('.dxf') || lower.endsWith('.cdr')) {
                        triggerInstantSync(path.basename(filename));
                    }
                });
                console.log(`👁️ Monitor em tempo real (fs.watch) ativo em: ${dir}`);
            } catch (e) {
                console.warn(`[PipelineDaemon] Não foi possível ativar fs.watch em ${dir}:`, e.message);
            }
        }
    });

    console.log('🚀 Daemon de Monitoramento Contínuo e em Tempo Real de Pastas CNC iniciado...');
    await syncFoldersToCloud('inicio');
    setInterval(() => syncFoldersToCloud('heartbeat'), 15000);
}

startDaemon();
