const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { Pool } = require('pg');
const { getProductionPipeline, invalidatePipelineCache } = require('./production_pipeline');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2
});

let lastSignature = '';

async function syncFoldersToCloud() {
    try {
        invalidatePipelineCache();
        const data = await getProductionPipeline(pool, true);
        if (!data || !data.summary) return;

        // Assinatura rápida para detectar qualquer arquivo novo, modificado ou concluído
        const sig = JSON.stringify({
            s: data.summary,
            c: (data.cadPreparar || []).slice(0, 10).map(f => `${f.name}_${f.mtime}`),
            a: (data.aspirePreparar || []).slice(0, 10).map(f => `${f.name}_${f.mtime}_${f.chapasCount}`),
            g: (data.gcodeProntos || []).slice(0, 15).map(f => `${f.name}_${f.mtime}_${f.isCurrentlyRunning}`)
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
            console.log(`[${new Date().toLocaleTimeString('pt-BR')}] Pipeline sincronizado! Prontos: ${data.summary.totalGcodePronto} | Aspire: ${data.summary.totalAspirePreparar} | Concluídos: ${data.summary.totalConcluidos}`);
        }
    } catch (err) {
        console.error('[PipelineDaemon] Erro na varredura:', err.message);
    }
}

console.log('🚀 Daemon de Monitoramento Contínuo de Pastas CNC iniciado (varredura a cada 10s)...');
syncFoldersToCloud();
setInterval(syncFoldersToCloud, 10000);
