const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('../db/pool');
const { authenticateToken, authenticateSyncOrToken } = require('../middleware/auth');

const router = express.Router();

// ─── OFICINA / ONEDRIVE 3 - OFICINA SYNC & G-CODE PATCHING ───────────────────
let oficinaSyncCache = null;

router.get('/api/oficina-sync', authenticateToken, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');

        const userId = Number(req.user.id || 1) || 1;
        let userCfg = {};
        try {
            const cfgRes = await pool.query(
                'SELECT pipeline_cloud_root, pipeline_local_root FROM users WHERE id = $1 LIMIT 1',
                [userId]
            );
            userCfg = cfgRes.rows[0] || {};
        } catch { /* ignore */ }

        if (userId === 1) {
            // 1. Tenta estado mais recente salvo no PostgreSQL para o workspace principal
            try {
                const { rows } = await pool.query('SELECT payload, updated_at FROM oficina_sync_state ORDER BY id DESC LIMIT 1');
                if (rows.length > 0 && rows[0].payload) {
                    oficinaSyncCache = { ...rows[0].payload, updated_at: rows[0].updated_at };
                    return res.json(oficinaSyncCache);
                }
            } catch (dbErr) {
                console.warn('Erro ao consultar oficina_sync_state no banco:', dbErr.message);
            }

            // 2. Fallback em memória / snapshot em disco para o workspace #1
            if (oficinaSyncCache) {
                return res.json(oficinaSyncCache);
            }

            const snapFile = path.join(__dirname, '..', 'initial_snapshot.json');
            if (fs.existsSync(snapFile)) {
                const snap = JSON.parse(fs.readFileSync(snapFile, 'utf8'));
                oficinaSyncCache = snap;
                return res.json(oficinaSyncCache);
            }
        }

        return res.json({
            status: 'online',
            last_scan_time: null,
            total_projects: 0,
            jobs: [],
            active_config: {
                source_dir: userCfg.pipeline_cloud_root || (userId === 1 ? (process.env.PIPELINE_ONEDRIVE_ROOT || '') : ''),
                dest_dir: userCfg.pipeline_local_root || (userId === 1 ? (process.env.PIPELINE_LOCAL_ROOT || '') : ''),
                oficina_folder_pattern: '^\\s*3\\s*-\\s*OFICINA\\s*$',
                target_spindle_speed: '18000',
                patch_gcode_macros: true
            }
        });
    } catch (err) {
        console.error('Erro em GET /api/oficina-sync:', err);
        return res.status(500).json({ error: 'Erro ao buscar dados do assistente' });
    }
});

router.post('/api/oficina-sync', authenticateSyncOrToken, async (req, res) => {
    try {
        const payload = req.body || {};
        const nowIso = new Date().toISOString();
        oficinaSyncCache = {
            ...payload,
            updated_at: nowIso
        };
        await pool.query('INSERT INTO oficina_sync_state (payload, updated_at) VALUES ($1, NOW())', [payload]);
        await pool.query(
            'DELETE FROM oficina_sync_state WHERE id NOT IN (SELECT id FROM oficina_sync_state ORDER BY id DESC LIMIT 10)'
        ).catch(() => {});
        return res.json({ ok: true, received_at: nowIso });
    } catch (err) {
        console.error('Erro em POST /api/oficina-sync:', err);
        return res.status(500).json({ error: 'Erro ao atualizar dados do assistente' });
    }
});

router.post('/api/oficina-sync/patch-gcode', authenticateToken, (req, res) => {
    try {
        const { content, targetSpeed = '18000' } = req.body;
        if (!content || typeof content !== 'string') {
            return res.status(400).json({ error: 'Conteúdo G-Code inválido' });
        }
        const lines = content.split(/\r?\n/);
        const cleanLines = lines.filter(l => !['M101', 'M102'].includes(l.trim().toUpperCase()));
        const newLines = [];
        let m101Inserted = false;
        let m101Line = -1;

        for (let i = 0; i < cleanLines.length; i++) {
            let line = cleanLines[i];
            if (targetSpeed && line.includes('S12000')) {
                line = line.replace(/S12000/g, `S${targetSpeed}`);
            }
            newLines.push(line);
            const codePart = line.split('(')[0].toUpperCase();
            if ((codePart.includes('M03') || codePart.includes('M3')) && !codePart.includes('M30') && !m101Inserted) {
                newLines.push('M101');
                m101Inserted = true;
                m101Line = newLines.length;
            }
        }
        if (!m101Inserted && newLines.length > 0) {
            const insertIdx = Math.min(2, newLines.length);
            newLines.splice(insertIdx, 0, 'M101');
            m101Inserted = true;
            m101Line = insertIdx + 1;
        }

        const finalLines = [];
        let m102Inserted = false;
        let m102Line = -1;
        for (let i = 0; i < newLines.length; i++) {
            const line = newLines[i];
            const codePart = line.split('(')[0].toUpperCase();
            if (codePart.includes('M30') && !m102Inserted) {
                finalLines.push('M102');
                m102Inserted = true;
                m102Line = finalLines.length;
            }
            finalLines.push(line);
        }
        if (!m102Inserted) {
            finalLines.push('M102');
            m102Inserted = true;
            m102Line = finalLines.length;
        }

        return res.json({
            ok: true,
            patchedContent: finalLines.join('\n'),
            totalLines: finalLines.length,
            m101Line,
            m102Line,
            targetSpeed
        });
    } catch (err) {
        console.error('Erro ao processar G-Code:', err);
        return res.status(500).json({ error: 'Erro ao processar G-Code' });
    }
});

// ─── PIPELINE DE ARQUIVOS DE PRODUÇÃO (CAD/CAM, G-CODE, EXECUTADOS) ──────────
const {
    getProductionPipeline,
    invalidatePipelineCache,
    scopeFileKey,
    unscopeFileKey
} = require('../production_pipeline');
const { isNightShift, getNightOperator, getDayOperator } = require('../services/shiftService');

async function resolveDefaultPipelineOperator(userId) {
    try {
        const op = isNightShift() ? await getNightOperator(userId) : await getDayOperator(userId);
        return op?.name || 'Operador';
    } catch {
        return 'Operador';
    }
}

router.get('/api/arquivos-producao', authenticateToken, async (req, res) => {
    try {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        const forceRefresh = req.query.refresh === 'true' || req.query.refresh === '1';
        const data = await getProductionPipeline(pool, forceRefresh, { userId: req.user.id });
        res.json(data);
    } catch (err) {
        console.error('Erro em GET /api/arquivos-producao:', err);
        res.status(500).json({ error: 'Erro ao gerar pipeline de arquivos de produção' });
    }
});

// Busca todos os arquivos marcados manualmente como concluídos salvos no PostgreSQL
router.get('/api/pipeline/completed-files', authenticateToken, async (req, res) => {
    try {
        const userId = Number(req.user.id || 1) || 1;
        const { rows } = await pool.query(`
            SELECT file_key, file_name, stage, subfolder, job_name, done, operator_name, completed_at, updated_at
            FROM pipeline_completed_files
            WHERE ("userId" = $1 OR ($1::int = 1 AND "userId" IS NULL))
            ORDER BY updated_at DESC
        `, [userId]);
        const map = {};
        const files = rows.map(r => {
            const cleanKey = unscopeFileKey(userId, r.file_key);
            const rec = { ...r, file_key: cleanKey };
            map[cleanKey] = rec;
            return rec;
        });
        res.json({ success: true, count: files.length, files, map });
    } catch (err) {
        console.error('Erro em GET /api/pipeline/completed-files:', err);
        res.status(500).json({ error: 'Erro ao buscar arquivos concluídos' });
    }
});

// Salva ou alterna o status de conclusão de um arquivo de forma definitiva no PostgreSQL
router.post('/api/pipeline/toggle-completed', authenticateToken, async (req, res) => {
    try {
        const userId = Number(req.user.id || 1) || 1;
        const { file_key, file_name, stage, subfolder, job_name, done, operator_name } = req.body;
        if (!file_key && !file_name) {
            return res.status(400).json({ error: 'file_key ou file_name é obrigatório' });
        }
        const key = (file_key || file_name).trim();
        const scopedKey = scopeFileKey(userId, key);
        const name = (file_name || file_key).trim();
        const isDone = done !== undefined ? Boolean(done) : true;
        const op = operator_name || (await resolveDefaultPipelineOperator(userId));

        const query = `
            INSERT INTO pipeline_completed_files (file_key, file_name, stage, subfolder, job_name, done, operator_name, "userId", completed_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (file_key) 
            DO UPDATE SET 
                done = EXCLUDED.done,
                operator_name = EXCLUDED.operator_name,
                stage = COALESCE(EXCLUDED.stage, pipeline_completed_files.stage),
                subfolder = COALESCE(EXCLUDED.subfolder, pipeline_completed_files.subfolder),
                job_name = COALESCE(EXCLUDED.job_name, pipeline_completed_files.job_name),
                "userId" = EXCLUDED."userId",
                completed_at = CASE WHEN EXCLUDED.done = TRUE THEN CURRENT_TIMESTAMP ELSE pipeline_completed_files.completed_at END,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        const result = await pool.query(query, [scopedKey, name, stage || null, subfolder || null, job_name || null, isDone, op, userId]);

        // Se marcou como feito, sincroniza variantes de chaves e limpa de pipeline_reopen_files
        if (isDone) {
            try {
                const normKey = scopeFileKey(userId, key).toLowerCase().replace(/\\/g, '/');
                await pool.query(`
                    UPDATE pipeline_completed_files 
                    SET done = TRUE, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                    WHERE ("userId" = $4 OR ($4::int = 1 AND "userId" IS NULL))
                      AND (
                        LOWER(REPLACE(file_key, '\\', '/')) = $1
                        OR (LOWER(file_name) = LOWER($2) AND subfolder IS NOT NULL AND LOWER(subfolder) = LOWER($3))
                      )
                `, [normKey, name, subfolder || '', userId]);

                await pool.query(`
                    DELETE FROM pipeline_reopen_files
                    WHERE ("userId" = $5 OR ($5::int = 1 AND "userId" IS NULL))
                      AND (
                        LOWER(file_key) = LOWER($1) 
                        OR LOWER(file_key) = LOWER($2)
                        OR LOWER(REPLACE(file_key, '\\', '/')) = $3
                        OR (LOWER(file_key) LIKE '%' || LOWER($2) AND LOWER(file_key) LIKE '%' || LOWER($4) || '%')
                      )
                `, [scopedKey, scopeFileKey(userId, name), normKey, subfolder || '____none____', userId]);
            } catch (syncDoneErr) {
                console.warn('Erro ao sincronizar conclusão em toggle-completed:', syncDoneErr.message);
            }
        }

        // Se desmarcou (reverteu), garante a reabertura no pipeline e atualiza variantes
        if (!isDone) {
            try {
                await pool.query(`
                    UPDATE pipeline_completed_files 
                    SET done = FALSE, updated_at = CURRENT_TIMESTAMP
                    WHERE ("userId" = $3 OR ($3::int = 1 AND "userId" IS NULL))
                      AND (LOWER(file_key) = LOWER($1) OR LOWER(file_name) = LOWER($2))
                `, [scopedKey, name, userId]);

                await pool.query(`
                    INSERT INTO pipeline_reopen_files (file_key, "userId", reopened_at, reason)
                    VALUES ($1, $2, CURRENT_TIMESTAMP, 'Reaberto pelo operador no Pipeline')
                    ON CONFLICT (file_key) DO UPDATE SET reopened_at = CURRENT_TIMESTAMP, "userId" = EXCLUDED."userId"
                `, [scopedKey.toLowerCase().trim(), userId]);

                if (name && name.toLowerCase().trim() !== key.toLowerCase().trim()) {
                    await pool.query(`
                        INSERT INTO pipeline_reopen_files (file_key, "userId", reopened_at, reason)
                        VALUES ($1, $2, CURRENT_TIMESTAMP, 'Reaberto pelo operador no Pipeline')
                        ON CONFLICT (file_key) DO UPDATE SET reopened_at = CURRENT_TIMESTAMP, "userId" = EXCLUDED."userId"
                    `, [scopeFileKey(userId, name.toLowerCase().trim()), userId]);
                }
            } catch (reopenErr) {
                console.warn('Erro ao atualizar reabertura em toggle-completed:', reopenErr.message);
            }
        } else {
            // Se marcou como feito, limpa de pipeline_reopen_files
            try {
                await pool.query(`
                    DELETE FROM pipeline_reopen_files
                    WHERE ("userId" = $3 OR ($3::int = 1 AND "userId" IS NULL))
                      AND (LOWER(file_key) = LOWER($1) OR LOWER(file_key) = LOWER($2))
                `, [scopedKey, scopeFileKey(userId, name), userId]);
            } catch (delErr) {
                console.warn('Erro ao remover de pipeline_reopen_files:', delErr.message);
            }
        }

        invalidatePipelineCache(userId);
        const outItem = result.rows[0] ? { ...result.rows[0], file_key: unscopeFileKey(userId, result.rows[0].file_key) } : null;
        res.json({ success: true, item: outItem });
    } catch (err) {
        console.error('Erro em POST /api/pipeline/toggle-completed:', err);
        res.status(500).json({ error: 'Erro ao salvar conclusão de arquivo no banco' });
    }
});

// Sincronização em massa de arquivos já concluídos (migração de localStorage para PostgreSQL)
router.post('/api/pipeline/bulk-completed', authenticateToken, async (req, res) => {
    try {
        const userId = Number(req.user.id || 1) || 1;
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.json({ success: true, synced: 0 });
        }
        const fallbackOp = await resolveDefaultPipelineOperator(userId);
        let synced = 0;
        for (const item of items) {
            const key = (item.file_key || item.key || item.name || item.title || '').trim();
            const name = (item.file_name || item.name || item.title || key).trim();
            if (!key) continue;
            const scopedKey = scopeFileKey(userId, key);
            const isDone = item.done !== undefined ? Boolean(item.done) : true;
            const op = item.operator_name || item.operator || fallbackOp;
            const stage = item.stage || null;
            const subfolder = item.subfolder || null;
            const job_name = item.job_name || item.jobName || null;

            await pool.query(`
                INSERT INTO pipeline_completed_files (file_key, file_name, stage, subfolder, job_name, done, operator_name, "userId", completed_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                ON CONFLICT (file_key) 
                DO UPDATE SET 
                    done = EXCLUDED.done,
                    operator_name = EXCLUDED.operator_name,
                    stage = COALESCE(EXCLUDED.stage, pipeline_completed_files.stage),
                    subfolder = COALESCE(EXCLUDED.subfolder, pipeline_completed_files.subfolder),
                    job_name = COALESCE(EXCLUDED.job_name, pipeline_completed_files.job_name),
                    "userId" = EXCLUDED."userId",
                    updated_at = CURRENT_TIMESTAMP;
            `, [scopedKey, name, stage, subfolder, job_name, isDone, op, userId]);
            synced++;
        }
        invalidatePipelineCache(userId);
        res.json({ success: true, synced });
    } catch (err) {
        console.error('Erro em POST /api/pipeline/bulk-completed:', err);
        res.status(500).json({ error: 'Erro ao sincronizar arquivos em lote' });
    }
});

// Reabrir arquivo para usinagem ("rodar novamente"), limpando conclusões antigas e forçando o retorno à fila
router.post('/api/pipeline/reopen-file', authenticateToken, async (req, res) => {
    try {
        const userId = Number(req.user.id || 1) || 1;
        const { file_key, reason } = req.body;
        if (!file_key) return res.status(400).json({ error: 'file_key é obrigatório' });
        const key = file_key.trim();
        const scopedKey = scopeFileKey(userId, key);
        await pool.query(`
            INSERT INTO pipeline_reopen_files (file_key, "userId", reopened_at, reason)
            VALUES ($1, $2, CURRENT_TIMESTAMP, $3)
            ON CONFLICT (file_key)
            DO UPDATE SET reopened_at = CURRENT_TIMESTAMP, reason = EXCLUDED.reason, "userId" = EXCLUDED."userId"
        `, [scopedKey, userId, reason || 'Reaberto pelo operador']);

        await pool.query(`
            UPDATE pipeline_completed_files
            SET done = FALSE
            WHERE ("userId" = $3 OR ($3::int = 1 AND "userId" IS NULL))
              AND (file_key = $1 OR file_name = $2)
        `, [scopedKey, key, userId]);

        invalidatePipelineCache(userId);
        res.json({ success: true, file_key: key });
    } catch (err) {
        console.error('Erro em POST /api/pipeline/reopen-file:', err);
        res.status(500).json({ error: 'Erro ao reabrir arquivo no pipeline' });
    }
});

// Definir quantidade em lote de um arquivo G-Code da fila da router
router.post('/api/pipeline/batch-quantity', authenticateToken, async (req, res) => {
    try {
        const userId = Number(req.user.id || 1) || 1;
        const { file_key, file_name, subfolder, job_name, quantity } = req.body;
        if (!file_key && !file_name) return res.status(400).json({ error: 'file_key ou file_name é obrigatório' });
        
        const targetQty = parseInt(quantity, 10);
        if (isNaN(targetQty) || targetQty < 1) {
            return res.status(400).json({ error: 'Quantidade inválida' });
        }

        const lowerFn = (file_name || '').toLowerCase().trim();
        const lowerSub = (subfolder || '').toLowerCase().trim();
        const primaryKey = (file_key || file_name).trim();

        const keysToSet = [primaryKey];
        if (primaryKey.includes('\\')) keysToSet.push(primaryKey.replace(/\\/g, '/'));
        if (primaryKey.includes('/')) keysToSet.push(primaryKey.replace(/\//g, '\\'));
        if (lowerFn && lowerSub) {
            keysToSet.push(`${lowerFn}___${lowerSub}`);
            keysToSet.push(`${lowerSub}/${lowerFn}`);
        }

        if (targetQty === 1) {
            for (const k of keysToSet) {
                await pool.query(
                    'DELETE FROM pipeline_file_batches WHERE file_key = $1 AND ("userId" = $2 OR ($2::int = 1 AND "userId" IS NULL))',
                    [scopeFileKey(userId, k), userId]
                );
            }
        } else {
            for (const k of keysToSet) {
                await pool.query(`
                    INSERT INTO pipeline_file_batches (file_key, file_name, subfolder, job_name, target_quantity, "userId", updated_at)
                    VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
                    ON CONFLICT (file_key)
                    DO UPDATE SET target_quantity = EXCLUDED.target_quantity, "userId" = EXCLUDED."userId", updated_at = CURRENT_TIMESTAMP
                `, [scopeFileKey(userId, k), file_name || null, subfolder || null, job_name || null, targetQty, userId]);
            }
        }

        invalidatePipelineCache(userId);
        res.json({ success: true, target_quantity: targetQty });
    } catch (err) {
        console.error('Erro em POST /api/pipeline/batch-quantity:', err);
        res.status(500).json({ error: 'Erro ao definir quantidade do lote' });
    }
});

module.exports = router;
