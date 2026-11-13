const express = require('express');
const pool = require('../db/pool');
const { detectMaterialForJob, calculateMaterialCost } = require('../material_matcher');
const { authenticateToken } = require('../middleware/auth');
const { closeStaleJobs } = require('../db/initDb');
const { isNightShift, getNightOperator } = require('../services/shiftService');
const { sendPushToUser } = require('../services/pushService');
const { autoSyncKanban, syncJobToTimeline } = require('../services/kanbanSyncService');

const router = express.Router();

router.post('/api/jobs', authenticateToken, async (req, res) => {
    const body = req.body || {};
    const { file_name, folder, file_path, start_time, router_name, estimated_minutes } = body;
    const userId = req.user.id;
    let dt = start_time ? new Date(start_time) : new Date();
    let cleanFolder = folder || 'Desconhecido';
    let cleanFileName = file_name || 'Desconhecido';
    let cleanRouterName = router_name;
    const DEBOUNCE_SECONDS = 2;

    if (cleanRouterName && (cleanRouterName.includes('\\') || cleanRouterName.includes('/') || cleanRouterName.toLowerCase().endsWith('.txt') || cleanRouterName.length > 30)) {
        const up = cleanRouterName.toUpperCase();
        if (up.includes('ROUTER 2') || up.includes('ACT10')) cleanRouterName = 'Router 2';
        else if (up.includes('LASER') || up.includes('RUIDA')) cleanRouterName = 'Laser Ruida';
        else cleanRouterName = 'Router Central';
    }

    if (cleanFileName.includes('\\') || cleanFileName.includes('/')) {
        const pathParts = cleanFileName.replace(/\\/g, '/').split('/').filter(p => p.length > 0);
        if (pathParts.length > 0) cleanFileName = pathParts[pathParts.length - 1];
    }
    if (cleanFolder && cleanFolder.includes(' | ')) cleanFolder = cleanFolder.split(' | ').pop();

    const lastJob = (await pool.query('SELECT start_time, end_time FROM jobs WHERE "userId" = $1 AND (router_name = $2 OR router_name ILIKE $3) ORDER BY id DESC LIMIT 1', [userId, cleanRouterName || null, `%${cleanRouterName || ''}%`])).rows[0];
    if (lastJob) {
        const lastEventTime = new Date(lastJob.end_time || lastJob.start_time);
        const diffSeconds = (dt - lastEventTime) / 1000;
        if (diffSeconds >= 0 && diffSeconds < DEBOUNCE_SECONDS) {
            return res.json({ id: null, success: true, debounced: true });
        }
    }

    // Deduplication check: Is there already an active job on this machine?
    const existingActive = (await pool.query(
        `SELECT id, start_time, file_name FROM jobs 
         WHERE "userId" = $1 AND end_time IS NULL 
         AND (router_name = $2 OR router_name ILIKE $3) 
         ORDER BY id DESC LIMIT 1`,
        [userId, cleanRouterName || null, `%${cleanRouterName || ''}%`]
    )).rows[0];

    if (existingActive) {
        const prevStart = new Date(existingActive.start_time);
        const diffSec = Math.abs((dt - prevStart) / 1000);
        // If it's the exact same file or started within 20s, it's a concurrent/duplicate request: reuse it!
        if (existingActive.file_name.toLowerCase().trim() === cleanFileName.toLowerCase().trim() || diffSec < 20) {
            return res.json({ id: existingActive.id, success: true, debounced: true });
        }
    }

    const openJobs = (await pool.query('SELECT id, start_time FROM jobs WHERE "userId" = $1 AND end_time IS NULL AND (router_name = $2 OR router_name ILIKE $3 OR router_name LIKE \'%\\\\%\')', [userId, cleanRouterName || null, `%${cleanRouterName || ''}%`])).rows;
    for (const j of openJobs) {
        const prevStart = new Date(j.start_time);
        if (dt > prevStart) {
            const duration = Math.max(0, (dt - prevStart) / (1000 * 60));
            if (duration < 0.05) {
                await pool.query('DELETE FROM operator_time_logs WHERE job_id = $1 AND "userId" = $2', [j.id, userId]);
                await pool.query('DELETE FROM jobs WHERE id = $1', [j.id]);
            } else {
                await pool.query('UPDATE jobs SET end_time = $1, duration_minutes = $2 WHERE id = $3', [dt.toISOString(), duration, j.id]);
                await pool.query('UPDATE operator_time_logs SET end_time = $1, duration_minutes = $2 WHERE job_id = $3 AND "userId" = $4', [dt.toISOString(), parseFloat(duration.toFixed(2)), j.id, userId]);
            }
        } else {
            const fallbackEnd = new Date(prevStart.getTime() + 1000).toISOString();
            await pool.query('UPDATE jobs SET end_time = $1, duration_minutes = 0.01 WHERE id = $2', [fallbackEnd, j.id]);
            await pool.query('UPDATE operator_time_logs SET end_time = $1, duration_minutes = 0.01 WHERE job_id = $2 AND "userId" = $3', [fallbackEnd, j.id, userId]);
        }
    }

    // Regra do Período Noturno (22:00 às 05:59):
    // Todas as operações após as 22:00 são vinculadas ao operador noturno configurado para o turno noite (via banco ou fallback dinâmico) e ele é automaticamente alocado nas máquinas
    const isNight = isNightShift(dt);
    let operatorName = req.body.operator_name || null;

    if (isNight) {
        const nightOp = await getNightOperator(userId);
        operatorName = nightOp.name;
        // Aloca o operador noturno na máquina e nas routers ativas
        if (router_name) {
            await pool.query(
                `UPDATE routers SET operator_name = $1 WHERE "userId" = $2 AND (status = 'active' OR status = 'cortando' OR name ILIKE $3)`,
                [nightOp.name, userId, `%${router_name}%`]
            );
        }
        if (nightOp.id) {
            await pool.query(
                `UPDATE operators SET status = 'disponivel', location = $1 WHERE id = $2`,
                [`⚙️ ${router_name || 'Routers CNC'} (Turno Noite)`, nightOp.id]
            );
        }
    } else if (!operatorName && router_name) {
        const routerRes = (await pool.query('SELECT operator_name FROM routers WHERE (name ILIKE $1 OR name ILIKE $2) AND "userId" = $3 LIMIT 1', [`%${router_name}%`, `%${router_name.replace(/ruida/i, '').trim()}%`, userId])).rows[0];
        if (routerRes && routerRes.operator_name) {
            operatorName = routerRes.operator_name;
        }
    }

    let estMin = estimated_minutes ? parseFloat(estimated_minutes) : null;
    if (!estMin && router_name) {
        const isLaser = router_name.toLowerCase().includes('laser');
        const cleanName = router_name.replace(/ruida/i, '').replace(/co2|co₂/i, '').trim();
        const recentEst = (await pool.query(
            `SELECT estimated_minutes FROM jobs 
             WHERE "userId" = $1 
             AND (router_name ILIKE $2 OR router_name ILIKE $3 OR ($4 = true AND router_name ILIKE '%laser%')) 
             AND estimated_minutes IS NOT NULL 
             AND estimated_minutes > 0 
             ORDER BY start_time DESC LIMIT 1`,
            [userId, `%${router_name}%`, `%${cleanName}%`, isLaser]
        )).rows[0];

        if (recentEst && recentEst.estimated_minutes) {
            estMin = parseFloat(recentEst.estimated_minutes);
        }
    }

    const maxX = req.body.max_x ? parseFloat(req.body.max_x) : null;
    const maxY = req.body.max_y ? parseFloat(req.body.max_y) : null;
    const boundArea = req.body.bounding_area_m2 ? parseFloat(req.body.bounding_area_m2) : (maxX && maxY ? parseFloat(((maxX / 1000) * (maxY / 1000)).toFixed(3)) : null);
    let initialQty = req.body.quantity ? parseInt(req.body.quantity) : null;
    if (!initialQty || isNaN(initialQty)) {
        const qtyMatch = cleanFileName.match(/(?:^|[\s_-])(\d+)\s*[xX](?:\.|$|[\s_-])/);
        initialQty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
    }

    let matId = req.body.material_id ? parseInt(req.body.material_id) : null;
    let matName = req.body.material_name || null;
    let matPrice = req.body.material_price !== undefined && req.body.material_price !== null ? parseFloat(req.body.material_price) : null;

    if (!matId) {
        try {
            const userMaterials = (await pool.query('SELECT * FROM materials WHERE "userId" = $1', [userId])).rows;
            const autoMat = detectMaterialForJob({
                file_name: cleanFileName,
                max_x: maxX,
                max_y: maxY,
                bounding_area_m2: boundArea,
                quantity: initialQty
            }, userMaterials);
            if (autoMat) {
                matId = autoMat.material_id;
                if (!matName) matName = autoMat.material_name;
                if (matPrice === null || isNaN(matPrice) || matPrice === 0) matPrice = autoMat.material_price;
            }
        } catch (e) {
            console.error('Error auto-detecting material:', e);
        }
    } else if (matId && (matPrice === null || isNaN(matPrice))) {
        try {
            const matRow = (await pool.query('SELECT * FROM materials WHERE id = $1 AND "userId" = $2', [matId, userId])).rows[0];
            if (matRow) {
                matPrice = calculateMaterialCost({
                    max_x: maxX,
                    max_y: maxY,
                    bounding_area_m2: boundArea,
                    quantity: initialQty
                }, matRow);
            }
        } catch (e) {
            console.error('Error calculating material cost:', e);
        }
    }

    const result = await pool.query('INSERT INTO jobs (file_name, folder, file_path, start_time, day, month, year, "userId", router_name, estimated_minutes, material_id, material_name, material_price, operator_name, max_x, max_y, bounding_area_m2, quantity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id', 
        [cleanFileName, cleanFolder, file_path || 'Desconhecido', dt.toISOString(), dt.getDate(), dt.getMonth() + 1, dt.getFullYear(), userId, router_name || null, estMin, matId, matName, matPrice, operatorName, maxX, maxY, boundArea, initialQty]);
    
    // Auto-sync Kanban card: todo -> doing
    autoSyncKanban(userId, cleanFileName, cleanFolder, router_name, 'doing', operatorName);

    // Create a new distinct card in the operator's timeline for this machine job execution
    if (operatorName) {
        try {
            const opRes = (await pool.query(
                'SELECT id, name FROM operators WHERE LOWER(name) = LOWER($1) AND "userId" = $2 LIMIT 1',
                [operatorName.trim(), userId]
            )).rows[0];

            if (opRes) {
                // 1. Encerra apenas cards ociosos ('Na Fábrica' / sem job_id), preservando cortes simultâneos em outra máquina!
                const openIdleLogs = (await pool.query(
                    'SELECT * FROM operator_time_logs WHERE operator_id = $1 AND "userId" = $2 AND end_time IS NULL AND job_id IS NULL ORDER BY start_time DESC',
                    [opRes.id, userId]
                )).rows;

                for (const log of openIdleLogs) {
                    const startLogDt = new Date(log.start_time);
                    const durMin = (dt - startLogDt) / 60000;
                    if (durMin < 0.4) {
                        await pool.query('DELETE FROM operator_time_logs WHERE id = $1 AND "userId" = $2', [log.id, userId]);
                    } else {
                        await pool.query(
                            'UPDATE operator_time_logs SET end_time = $1, duration_minutes = $2 WHERE id = $3 AND "userId" = $4',
                            [dt.toISOString(), parseFloat(durMin.toFixed(2)), log.id, userId]
                        );
                    }
                }

                // 2. Abre um novo card vinculado diretamente ao job_id desta usinagem
                const machineLoc = cleanRouterName ? `⚙️ ${cleanRouterName}` : (router_name ? `⚙️ ${router_name}` : 'Na Máquina');
                const qtyNote = initialQty > 1 ? `Qtd: ${initialQty} UN` : null;
                await pool.query(
                    `INSERT INTO operator_time_logs (
                        "userId", operator_id, operator_name, status, location, kanban_title, start_time, notes, job_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [
                        userId,
                        opRes.id,
                        opRes.name,
                        'disponivel',
                        machineLoc,
                        cleanFileName,
                        dt.toISOString(),
                        qtyNote,
                        result.rows[0].id
                    ]
                );

                await pool.query(
                    `UPDATE operators SET status = 'disponivel', location = $1 WHERE id = $2 AND "userId" = $3`,
                    [machineLoc, opRes.id, userId]
                );
            }
        } catch (opErr) {
            console.error('Erro ao criar novo card no timeline do operador:', opErr);
        }
    }

    res.json({ id: result.rows[0].id, success: true });
});

router.patch('/api/jobs/latest', authenticateToken, async (req, res) => {
    const body = req.body || {};
    const { end_time, router_name } = body;
    const userId = req.user.id;
    const dt = end_time ? new Date(end_time) : new Date();

    const isLaser = router_name && router_name.toLowerCase().includes('laser');
    const cleanName = router_name ? router_name.replace(/ruida/i, '').replace(/co2|co₂/i, '').trim() : '';

    const row = (await pool.query(
        `SELECT * FROM jobs 
         WHERE "userId" = $1 
         AND end_time IS NULL 
         AND (
           router_name = $2 
           OR router_name ILIKE $3 
           OR ($4 = true AND router_name ILIKE '%laser%')
         ) 
         ORDER BY start_time DESC LIMIT 1`,
        [userId, router_name || null, `%${cleanName}%`, isLaser]
    )).rows[0];
    if (!row) {
        console.warn(`[WARN] Tentativa de finalizar job mas nenhum job aberto foi encontrado para '${router_name}' (usuário #${userId})`);
        return res.status(404).json({ error: "No open jobs found" });
    }

    const startDt = new Date(row.start_time);
    const durationMinutes = (dt - startDt) / (1000 * 60);

    if (durationMinutes < 0.4) {
        await pool.query('DELETE FROM operator_time_logs WHERE "userId" = $1 AND (job_id = $2 OR start_time = $3)', [userId, row.id, row.start_time]);
        await pool.query('DELETE FROM jobs WHERE id = $1', [row.id]);
        return res.json({ id: row.id, deleted: true });
    }

    await pool.query('UPDATE jobs SET end_time = $1, duration_minutes = $2 WHERE id = $3', [dt.toISOString(), durationMinutes, row.id]);
    
    // Auto-sync Kanban card: doing/todo -> done
    autoSyncKanban(userId, row.file_name, row.folder, router_name, 'done');

    // Close operator's specific machine cutting time log and open 'Na Fábrica' only if no other machine is still cutting for this operator
    if (row.operator_name) {
        try {
            const opRes = (await pool.query(
                'SELECT id, name, status FROM operators WHERE LOWER(name) = LOWER($1) AND "userId" = $2 LIMIT 1',
                [row.operator_name.trim(), userId]
            )).rows[0];

            if (opRes) {
                const targetLogs = (await pool.query(
                    `SELECT * FROM operator_time_logs
                     WHERE "userId" = $1
                       AND end_time IS NULL
                       AND (
                         job_id = $2
                         OR (job_id IS NULL AND operator_id = $3 AND kanban_title = $4)
                       )`,
                    [userId, row.id, opRes.id, row.file_name]
                )).rows;

                for (const log of targetLogs) {
                    const startLogDt = new Date(log.start_time);
                    const durMin = Math.max(0.1, (dt - startLogDt) / 60000);
                    await pool.query(
                        'UPDATE operator_time_logs SET end_time = $1, duration_minutes = $2, job_id = COALESCE(job_id, $3) WHERE id = $4',
                        [dt.toISOString(), parseFloat(durMin.toFixed(2)), row.id, log.id]
                    );
                }

                // Verifica se o operador ainda possui outra máquina cortando simultaneamente
                const remainingActiveCuts = (await pool.query(
                    'SELECT location, kanban_title FROM operator_time_logs WHERE operator_id = $1 AND "userId" = $2 AND end_time IS NULL AND job_id IS NOT NULL ORDER BY start_time DESC LIMIT 1',
                    [opRes.id, userId]
                )).rows[0];

                if (remainingActiveCuts) {
                    await pool.query(
                        `UPDATE operators SET location = $1 WHERE id = $2 AND "userId" = $3 AND status = 'disponivel'`,
                        [remainingActiveCuts.location || 'Na Máquina', opRes.id, userId]
                    );
                } else if (opRes.status === 'disponivel') {
                    // Cria card 'Na Fábrica' apenas se não houver outro card 'Na Fábrica' já aberto
                    const existingIdle = (await pool.query(
                        'SELECT id FROM operator_time_logs WHERE operator_id = $1 AND "userId" = $2 AND end_time IS NULL AND job_id IS NULL LIMIT 1',
                        [opRes.id, userId]
                    )).rows[0];
                    if (!existingIdle) {
                        await pool.query(
                            `INSERT INTO operator_time_logs (
                                "userId", operator_id, operator_name, status, location, start_time
                            ) VALUES ($1, $2, $3, $4, $5, $6)`,
                            [userId, opRes.id, opRes.name, 'disponivel', 'Na Fábrica', dt.toISOString()]
                        );
                    }
                    await pool.query(
                        `UPDATE operators SET location = $1 WHERE id = $2 AND "userId" = $3 AND status = 'disponivel'`,
                        ['Na Fábrica', opRes.id, userId]
                    );
                }
            }
        } catch (opErr) {
            console.error('Erro ao encerrar time log do operador no fim do job:', opErr);
        }
    }
    
    // Dispatch Webhook if user has one configured
    try {
        const user = (await pool.query('SELECT webhook_url, "costPerHour" FROM users WHERE id = $1', [userId])).rows[0];
        if (user && user.webhook_url) {
            const cost = (durationMinutes / 60) * (user.costPerHour || 0);
            const payload = {
                event: 'job_completed',
                job_id: row.id,
                router_name: row.router_name,
                file_name: row.file_name,
                material_name: row.material_name,
                start_time: row.start_time,
                end_time: dt.toISOString(),
                duration_minutes: durationMinutes,
                estimated_cost: cost
            };
            // Send webhook async (fire and forget)
            fetch(user.webhook_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(e => console.error(`[WEBHOOK FAIL] ${user.webhook_url}:`, e.message));
        }
    } catch (e) {
        console.error("Webhook processing error:", e);
    }

    // Dispatch Web Push Notification to connected mobile phones/browsers
    try {
        const durMin = Math.round(durationMinutes);
        const durFormatted = durMin >= 60 
            ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` 
            : `${Math.max(1, durMin)} min`;
        const machine = row.router_name || router_name || 'CNC Router';
        const file = row.file_name || 'Corte';

        await sendPushToUser(userId, {
            title: `🔔 Corte Concluído - ${machine}`,
            body: `Arquivo: ${file}\n⏱️ Duração: ${durFormatted}`,
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: `mach3-job-${row.id}`,
            job_id: row.id,
            timestamp: Date.now(),
            url: '/history'
        });
    } catch (pushErr) {
        console.error('[PUSH TRIGGER ERROR]:', pushErr);
    }

    res.json({ id: row.id, duration_minutes: durationMinutes, success: true });
});

router.get('/api/jobs', authenticateToken, async (req, res) => {
    await closeStaleJobs(req.user.id);
    const jobs = (await pool.query('SELECT * FROM jobs WHERE "userId" = $1 ORDER BY id DESC', [req.user.id])).rows;
    res.json(jobs);
});

router.patch('/api/jobs/:id', authenticateToken, async (req, res) => {
    const { material_id, material_name, material_price, folder, file_name, start_time, end_time, estimated_minutes, max_x, max_y, bounding_area_m2, operator_name, router_name } = req.body;
    const oldJob = (await pool.query('SELECT * FROM jobs WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id])).rows[0];
    if (!oldJob) return res.status(404).json({ error: "Job not found" });

    const fields = [];
    const values = [];
    let idx = 1;

    if (material_id !== undefined) { fields.push(`material_id = $${idx++}`); values.push(material_id); }
    if (material_name !== undefined) { fields.push(`material_name = $${idx++}`); values.push(material_name); }
    if (material_price !== undefined) { fields.push(`material_price = $${idx++}`); values.push(material_price); }
    if (folder !== undefined) { fields.push(`folder = $${idx++}`); values.push(folder); }
    if (file_name !== undefined) { fields.push(`file_name = $${idx++}`); values.push(file_name); }
    if (router_name !== undefined) { fields.push(`router_name = $${idx++}`); values.push(router_name); }
    if (start_time !== undefined) { fields.push(`start_time = $${idx++}`); values.push(start_time); }
    if (end_time !== undefined) { fields.push(`end_time = $${idx++}`); values.push(end_time); }
    if (start_time !== undefined || end_time !== undefined) {
        const effStart = start_time !== undefined ? start_time : oldJob.start_time;
        const effEnd = end_time !== undefined ? end_time : oldJob.end_time;
        if (effStart && effEnd) {
            const recalcDur = Math.max(0.1, (new Date(effEnd) - new Date(effStart)) / 60000);
            fields.push(`duration_minutes = $${idx++}`);
            values.push(recalcDur);
        }
    }
    if (estimated_minutes !== undefined) { fields.push(`estimated_minutes = $${idx++}`); values.push(estimated_minutes ? parseFloat(estimated_minutes) : null); }
    if (max_x !== undefined) { fields.push(`max_x = $${idx++}`); values.push(max_x ? parseFloat(max_x) : null); }
    if (max_y !== undefined) { fields.push(`max_y = $${idx++}`); values.push(max_y ? parseFloat(max_y) : null); }
    if (bounding_area_m2 !== undefined) { fields.push(`bounding_area_m2 = $${idx++}`); values.push(bounding_area_m2 ? parseFloat(bounding_area_m2) : null); }
    if (operator_name !== undefined) { fields.push(`operator_name = $${idx++}`); values.push(operator_name); }
    if (req.body.quantity !== undefined) { fields.push(`quantity = $${idx++}`); values.push(req.body.quantity ? parseInt(req.body.quantity) : 1); }

    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(req.params.id, req.user.id);
    const result = await pool.query(`UPDATE jobs SET ${fields.join(', ')} WHERE id = $${idx++} AND "userId" = $${idx++} RETURNING *`, values);
    if (result.rowCount > 0) {
        const updatedJob = result.rows[0];

        // Sincroniza imediatamente a Linha do Tempo (operator_time_logs) com a edição feita no Histórico!
        await syncJobToTimeline(req.user.id, updatedJob, oldJob);

        // Atualiza a máquina ao vivo e o cartão Kanban em execução apenas se este job ainda estiver ativo (!end_time)
        if (operator_name !== undefined && updatedJob && !updatedJob.end_time) {
            if (updatedJob.router_name) {
                await pool.query(
                    'UPDATE routers SET operator_name = $1 WHERE "userId" = $2 AND (name ILIKE $3 OR name ILIKE $4)',
                    [operator_name, req.user.id, `%${updatedJob.router_name}%`, `%${updatedJob.router_name.replace(/central|ruida/i, '').trim()}%`]
                );
            }
            if (updatedJob.file_name) {
                await pool.query(
                    'UPDATE kanban_tasks SET operator = $1 WHERE "userId" = $2 AND (title ILIKE $3 OR title ILIKE $4) AND column_id = $5',
                    [operator_name, req.user.id, `%${updatedJob.file_name}%`, `%${updatedJob.folder || updatedJob.file_name}%`, 'doing']
                );
            }
        }
        res.json({ success: true, job: updatedJob });
    } else {
        res.status(404).json({ error: "Job not found" });
    }
});

router.delete('/api/jobs/:id', authenticateToken, async (req, res) => {
    const oldJob = (await pool.query('SELECT * FROM jobs WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id])).rows[0];
    if (!oldJob) return res.status(404).json({ error: "Job not found" });

    // Remove o card correspondente da Linha do Tempo (tanto por job_id quanto por fallback legado)
    await pool.query(
        `DELETE FROM operator_time_logs
         WHERE "userId" = $1
           AND (
             job_id = $2
             OR (
               job_id IS NULL
               AND kanban_title = $3
               AND ABS(EXTRACT(EPOCH FROM (start_time - $4::timestamp))) < 120
             )
           )`,
        [req.user.id, oldJob.id, oldJob.file_name, new Date(oldJob.start_time).toISOString()]
    );

    const result = await pool.query('DELETE FROM jobs WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
    if (result.rowCount > 0) res.json({ success: true });
    else res.status(404).json({ error: "Job not found" });
});

router.get('/api/materials', authenticateToken, async (req, res) => {
    const mats = (await pool.query('SELECT * FROM materials WHERE "userId" = $1 ORDER BY id DESC', [req.user.id])).rows;
    res.json(mats);
});

router.post('/api/materials', authenticateToken, async (req, res) => {
    const { name, price, feed_rate, pass_width, sheet_width_mm, sheet_height_mm } = req.body;
    const fRate = parseFloat(feed_rate) || 3000;
    const pWidth = parseFloat(pass_width) || 100;
    const sWidth = parseFloat(sheet_width_mm) || 2750;
    const sHeight = parseFloat(sheet_height_mm) || 1850;
    const result = await pool.query(
        'INSERT INTO materials (name, price, feed_rate, pass_width, sheet_width_mm, sheet_height_mm, "userId") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [name, parseFloat(price), fRate, pWidth, sWidth, sHeight, req.user.id]
    );
    res.json({ success: true, material: result.rows[0] });
});

router.patch('/api/materials/:id', authenticateToken, async (req, res) => {
    const { name, price, feed_rate, pass_width, sheet_width_mm, sheet_height_mm } = req.body;
    const result = await pool.query(
        `UPDATE materials SET 
            name = COALESCE($1, name),
            price = COALESCE($2, price),
            feed_rate = COALESCE($3, feed_rate),
            pass_width = COALESCE($4, pass_width),
            sheet_width_mm = COALESCE($5, sheet_width_mm),
            sheet_height_mm = COALESCE($6, sheet_height_mm)
         WHERE id = $7 AND "userId" = $8 RETURNING *`,
        [
            name || null,
            price !== undefined && price !== null ? parseFloat(price) : null,
            feed_rate !== undefined && feed_rate !== null ? parseFloat(feed_rate) : null,
            pass_width !== undefined && pass_width !== null ? parseFloat(pass_width) : null,
            sheet_width_mm !== undefined && sheet_width_mm !== null ? parseFloat(sheet_width_mm) : null,
            sheet_height_mm !== undefined && sheet_height_mm !== null ? parseFloat(sheet_height_mm) : null,
            req.params.id,
            req.user.id
        ]
    );
    if (result.rowCount > 0) res.json({ success: true, material: result.rows[0] });
    else res.status(404).json({ error: "Material não encontrado" });
});

router.delete('/api/materials/:id', authenticateToken, async (req, res) => {
    const result = await pool.query('DELETE FROM materials WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
    if (result.rowCount > 0) res.json({ success: true });
    else res.status(404).json({ error: "Material não encontrado" });
});

router.get('/api/stats', authenticateToken, async (req, res) => {
    try {
        await closeStaleJobs(req.user.id);
        const jobs = (await pool.query('SELECT * FROM jobs WHERE "userId" = $1', [req.user.id])).rows;
        const totalJobs = jobs.length;
        let totalHours = 0, validCompletedJobs = 0, jobsToday = 0;
        const today = new Date(), hoursPerDay = {}, fileCounts = {};

        jobs.forEach(j => {
            const startDt = new Date(j.start_time);
            if (startDt.toDateString() === today.toDateString()) jobsToday++;
            if (j.end_time) {
                let dur = j.duration_minutes || 0;
                if (dur > 0.16) {
                    validCompletedJobs++;
                    totalHours += (dur / 60);
                    const dateKey = `${startDt.getDate().toString().padStart(2,'0')}/${(startDt.getMonth()+1).toString().padStart(2,'0')}`;
                    hoursPerDay[dateKey] = (hoursPerDay[dateKey] || 0) + (dur / 60);
                    fileCounts[j.file_name] = (fileCounts[j.file_name] || 0) + 1;
                }
            }
        });

        const sortedFiles = Object.keys(fileCounts).map(k => ({ name: k, count: fileCounts[k] })).sort((a,b) => b.count - a.count).slice(0, 10);
        const sortedDays = Object.keys(hoursPerDay).sort().slice(-30);

        res.json({
            totalJobs, totalHours, jobsToday, avgJobHours: validCompletedJobs > 0 ? totalHours / validCompletedJobs : 0,
            dailyHoursLabels: sortedDays, dailyHoursData: sortedDays.map(d => hoursPerDay[d]), topFiles: sortedFiles
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
