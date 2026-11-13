const express = require('express');
const pool = require('../db/pool');
const { SEED_CHECKLIST_ITEMS } = require('../config/checklistSeeds');
const { authenticateToken } = require('../middleware/auth');
const { isNightShift, getNightOperator, getDayOperator, applyShiftAllocationRule } = require('../services/shiftService');
const { syncJobToTimeline } = require('../services/kanbanSyncService');

const router = express.Router();

// Checklists API
router.get('/api/checklists', authenticateToken, async (req, res) => {
    const { machine_key, date } = req.query;
    if (!machine_key || !date) return res.status(400).json({ error: "Parâmetros machine_key e date obrigatórios." });
    try {
        const rows = (await pool.query(
            'SELECT item_index, done FROM checklists WHERE machine_key = $1 AND date = $2 AND "userId" = $3',
            [machine_key, date, req.user.id]
        )).rows;
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/checklists/toggle', authenticateToken, async (req, res) => {
    const { machine_key, item_index, done, date } = req.body;
    try {
        await pool.query(
            `INSERT INTO checklists (machine_key, item_index, done, date, "userId") 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT (machine_key, item_index, date, "userId") 
             DO UPDATE SET done = EXCLUDED.done`,
            [machine_key, item_index, done, date, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/checklists/clear', authenticateToken, async (req, res) => {
    const { machine_key, date } = req.body;
    try {
        await pool.query(
            'DELETE FROM checklists WHERE machine_key = $1 AND date = $2 AND "userId" = $3',
            [machine_key, date, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Custom Checklist Items API
router.get('/api/checklists/items', authenticateToken, async (req, res) => {
    const { machine_key } = req.query;
    if (!machine_key) return res.status(400).json({ error: "Parâmetro machine_key obrigatório." });
    try {
        let rows = (await pool.query(
            'SELECT id, machine_key, item_text FROM checklist_items WHERE machine_key = $1 AND "userId" = $2 ORDER BY id ASC',
            [machine_key, req.user.id]
        )).rows;

        // Auto-seed default items if no items exist for this user & machine_key
        // OR if existing items are in old format (missing [Encarregado]/[Operador] role tags)
        const needsReseed = rows.length === 0 || (
            SEED_CHECKLIST_ITEMS[machine_key] &&
            rows.length > 0 &&
            !rows.some(r => r.item_text.includes('[Encarregado]') || r.item_text.includes('[Operador]'))
        );

        if (needsReseed && SEED_CHECKLIST_ITEMS[machine_key]) {
            // Delete old-format items (only default ones, preserve any user-added custom items)
            if (rows.length > 0) {
                await pool.query(
                    'DELETE FROM checklist_items WHERE machine_key = $1 AND "userId" = $2',
                    [machine_key, req.user.id]
                );
            }
            const defaults = SEED_CHECKLIST_ITEMS[machine_key];
            for (const text of defaults) {
                await pool.query(
                    'INSERT INTO checklist_items (machine_key, item_text, "userId") VALUES ($1, $2, $3)',
                    [machine_key, text, req.user.id]
                );
            }
            rows = (await pool.query(
                'SELECT id, machine_key, item_text FROM checklist_items WHERE machine_key = $1 AND "userId" = $2 ORDER BY id ASC',
                [machine_key, req.user.id]
            )).rows;
        }

        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/checklists/items', authenticateToken, async (req, res) => {
    const { machine_key, item_text } = req.body;
    if (!machine_key || !item_text || !item_text.trim()) {
        return res.status(400).json({ error: "Texto do item e machine_key obrigatórios." });
    }
    try {
        const result = await pool.query(
            'INSERT INTO checklist_items (machine_key, item_text, "userId") VALUES ($1, $2, $3) RETURNING *',
            [machine_key, item_text.trim(), req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/checklists/items/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query(
            'DELETE FROM checklist_items WHERE id = $1 AND "userId" = $2',
            [req.params.id, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/checklists/items/:id', authenticateToken, async (req, res) => {
    const { item_text } = req.body;
    if (!item_text || !item_text.trim()) return res.status(400).json({ error: "Texto do item inválido." });
    try {
        const result = await pool.query(
            'UPDATE checklist_items SET item_text = $1 WHERE id = $2 AND "userId" = $3 RETURNING *',
            [item_text.trim(), req.params.id, req.user.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: "Item não encontrado." });
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Operator & Machine Assignment API
router.get('/api/operators', authenticateToken, async (req, res) => {
    try {
        await applyShiftAllocationRule(req.user.id);
        const ops = (await pool.query('SELECT * FROM operators WHERE "userId" = $1 ORDER BY name ASC', [req.user.id])).rows;
        res.json(ops);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint explícito para forçar/validar a regra de alocação de turno
router.post('/api/operators/apply-shift-rule', authenticateToken, async (req, res) => {
    try {
        await applyShiftAllocationRule(req.user.id);
        const night = isNightShift();
        const nightOp = await getNightOperator(req.user.id);
        const dayOp = await getDayOperator(req.user.id);
        res.json({
            success: true,
            isNightShift: night,
            activeShift: night ? 'Noite' : 'Dia',
            allocatedOperator: night ? nightOp.name : dayOp.name
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/operators', authenticateToken, async (req, res) => {
    const { name, shift } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Nome do operador é obrigatório." });
    try {
        const result = await pool.query(
            'INSERT INTO operators (name, shift, "userId", status, location) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name.trim(), shift || 'Geral', req.user.id, 'disponivel', 'Na Fábrica']
        );
        const newOp = result.rows[0];

        // Create initial timeline log for newly created operator
        await pool.query(
            `INSERT INTO operator_time_logs (
                "userId", operator_id, operator_name, status, location, start_time
            ) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)`,
            [req.user.id, newOp.id, newOp.name, 'disponivel', 'Na Fábrica']
        );

        res.json(newOp);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/operators/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM operators WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/operators/:id/status', authenticateToken, async (req, res) => {
    const { status, location, kanban_task_id, kanban_title, notes } = req.body;
    const validStatuses = ['disponivel', 'externo', 'outro_setor', 'almoco', 'limpeza', 'ausente', 'fim_expediente'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Status inválido. Use: disponivel, externo, outro_setor, almoco, limpeza, ausente, fim_expediente' });
    }
    try {
        const opResult = await pool.query('SELECT * FROM operators WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
        if (opResult.rowCount === 0) return res.status(404).json({ error: 'Operador não encontrado' });
        const operator = opResult.rows[0];

        // 1. Update status in operators table
        await pool.query(
            'UPDATE operators SET status = $1, location = $2 WHERE id = $3 AND "userId" = $4',
            [status, location || '', req.params.id, req.user.id]
        );

        // 2. Close any open log for this operator
        const openLogs = (await pool.query(
            'SELECT * FROM operator_time_logs WHERE operator_id = $1 AND "userId" = $2 AND end_time IS NULL ORDER BY start_time DESC',
            [req.params.id, req.user.id]
        )).rows;

        const now = new Date();
        for (const log of openLogs) {
            const startDt = new Date(log.start_time);
            const durMin = Math.max(0.1, (now - startDt) / 60000);
            await pool.query(
                'UPDATE operator_time_logs SET end_time = $1, duration_minutes = $2 WHERE id = $3',
                [now.toISOString(), parseFloat(durMin.toFixed(2)), log.id]
            );
        }

        // 3. Open new log for new status/location/kanban task
        const newLogResult = await pool.query(
            `INSERT INTO operator_time_logs (
                "userId", operator_id, operator_name, status, location, kanban_task_id, kanban_title, notes, start_time
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                req.user.id,
                operator.id,
                operator.name,
                status,
                location || status,
                kanban_task_id || null,
                kanban_title || null,
                notes || null,
                now.toISOString()
            ]
        );

        res.json({ success: true, operator: { ...operator, status, location }, newLog: newLogResult.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/operators/time-logs', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { date } = req.query;

        // Auto-reconcile (multi-machine safe via job_id):
        // 1) Se algum log com job_id ficou em aberto mas o job já finalizou (ex: closeStaleJobs), fecha o log com o mesmo end_time do job
        await pool.query(
            `UPDATE operator_time_logs otl
             SET end_time = j.end_time,
                 duration_minutes = ROUND((EXTRACT(EPOCH FROM (j.end_time - otl.start_time)) / 60.0)::numeric, 2)
             FROM jobs j
             WHERE otl.job_id = j.id
               AND otl."userId" = $1
               AND otl.end_time IS NULL
               AND j.end_time IS NOT NULL`,
            [userId]
        );

        // 2) Garante que todo job ativo (end_time IS NULL) possua seu card correspondente na Linha do Tempo, sem cortar outra máquina ativa!
        const activeJobs = (await pool.query(
            'SELECT * FROM jobs WHERE "userId" = $1 AND end_time IS NULL ORDER BY start_time ASC',
            [userId]
        )).rows;

        for (const activeJob of activeJobs) {
            if (!activeJob.operator_name) continue;
            await syncJobToTimeline(userId, activeJob, null);

            // Fecha eventuais cards ociosos ('Na Fábrica' sem job_id) abertos antes do início deste corte para o mesmo operador
            const jobStart = new Date(activeJob.start_time);
            const openIdleLogs = (await pool.query(
                `SELECT * FROM operator_time_logs
                 WHERE "userId" = $1
                   AND LOWER(operator_name) = LOWER($2)
                   AND end_time IS NULL
                   AND job_id IS NULL
                   AND status = 'disponivel'`,
                [userId, activeJob.operator_name.trim()]
            )).rows;

            for (const idleLog of openIdleLogs) {
                const logStart = new Date(idleLog.start_time);
                if (jobStart > logStart) {
                    const durMin = (jobStart - logStart) / 60000;
                    if (durMin < 0.4) {
                        await pool.query('DELETE FROM operator_time_logs WHERE id = $1 AND "userId" = $2', [idleLog.id, userId]);
                    } else {
                        await pool.query(
                            'UPDATE operator_time_logs SET end_time = $1, duration_minutes = $2 WHERE id = $3 AND "userId" = $4',
                            [jobStart.toISOString(), parseFloat(durMin.toFixed(2)), idleLog.id, userId]
                        );
                    }
                } else {
                    await pool.query('DELETE FROM operator_time_logs WHERE id = $1 AND "userId" = $2', [idleLog.id, userId]);
                }
            }
        }

        // Auto-cleanup micro duplicate logs (< 0.4 min / 24s) from operator timeline
        await pool.query('DELETE FROM operator_time_logs WHERE "userId" = $1 AND duration_minutes IS NOT NULL AND duration_minutes < 0.4', [userId]);

        let query = 'SELECT * FROM operator_time_logs WHERE "userId" = $1';
        const params = [userId];

        const todaySP = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
        const todayUTC = new Date().toISOString().split('T')[0];

        if (date) {
            const isToday = (date === todaySP || date === todayUTC || date === 'today');
            const targetDate = isToday ? todaySP : date;

            if (isToday) {
                query += ' AND ((start_time - INTERVAL \'3 hours\')::date = DATE($' + (params.length + 1) + ') OR (end_time IS NULL AND (start_time - INTERVAL \'3 hours\')::date >= (DATE($' + (params.length + 1) + ') - INTERVAL \'1 day\')))';
                params.push(targetDate);
            } else {
                query += ' AND (start_time - INTERVAL \'3 hours\')::date = DATE($' + (params.length + 1) + ')';
                params.push(targetDate);
            }
        } else if (req.query.date_from && req.query.date_to) {
            query += ' AND (start_time - INTERVAL \'3 hours\')::date >= DATE($' + (params.length + 1) + ') AND (start_time - INTERVAL \'3 hours\')::date <= DATE($' + (params.length + 2) + ')';
            params.push(req.query.date_from, req.query.date_to);
        } else if (req.query.date_from) {
            query += ' AND (start_time - INTERVAL \'3 hours\')::date >= DATE($' + (params.length + 1) + ')';
            params.push(req.query.date_from);
        }
        query += ' ORDER BY start_time DESC';

        const logs = (await pool.query(query, params)).rows;
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/operators/time-logs/:logId', authenticateToken, async (req, res) => {
    try {
        const { kanban_task_id, kanban_title, notes } = req.body;
        const result = await pool.query(
            `UPDATE operator_time_logs 
             SET kanban_task_id = COALESCE($1, kanban_task_id), 
                 kanban_title = COALESCE($2, kanban_title), 
                 notes = COALESCE($3, notes)
             WHERE id = $4 AND "userId" = $5 RETURNING *`,
            [kanban_task_id || null, kanban_title || null, notes || null, req.params.logId, req.user.id]
        );
        if (result.rowCount === 0) return res.status(404).json({ error: 'Registro não encontrado' });
        res.json({ success: true, log: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/routers/:id/operator', authenticateToken, async (req, res) => {
    const { operator_name } = req.body;
    try {
        const router = (await pool.query('SELECT * FROM routers WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id])).rows[0];
        if (!router) return res.status(404).json({ error: 'Máquina não encontrada' });

        const opVal = operator_name ? operator_name.trim() : null;
        await pool.query(
            'UPDATE routers SET operator_name = $1 WHERE id = $2 AND "userId" = $3',
            [opVal, req.params.id, req.user.id]
        );

        // Sync operator_name on active open job on this machine
        await pool.query(
            'UPDATE jobs SET operator_name = $1 WHERE "userId" = $2 AND (router_name ILIKE $3 OR router_name ILIKE $4) AND end_time IS NULL',
            [opVal, req.user.id, `%${router.name}%`, `%${router.name.replace(/ruida/i, '').trim()}%`]
        );

        // Sync operator on active Kanban task assigned to this machine
        await pool.query(
            'UPDATE kanban_tasks SET operator = $1 WHERE "userId" = $2 AND (machine ILIKE $3 OR machine ILIKE $4) AND column_id = $5',
            [opVal, req.user.id, `%${router.name}%`, `%${router.name.replace(/ruida/i, '').trim()}%`, 'doing']
        );

        // Sync operator's active time log location
        if (opVal) {
            const opRes = (await pool.query(
                'SELECT id FROM operators WHERE LOWER(name) = LOWER($1) AND "userId" = $2 LIMIT 1',
                [opVal, req.user.id]
            )).rows[0];

            if (opRes) {
                const activeJob = (await pool.query(
                    'SELECT file_name FROM jobs WHERE "userId" = $1 AND (router_name ILIKE $2 OR router_name ILIKE $3) AND end_time IS NULL ORDER BY id DESC LIMIT 1',
                    [req.user.id, `%${router.name}%`, `%${router.name.replace(/ruida/i, '').trim()}%`]
                )).rows[0];

                await pool.query(
                    `UPDATE operator_time_logs 
                     SET location = $1, kanban_title = COALESCE($2, kanban_title) 
                     WHERE operator_id = $3 AND "userId" = $4 AND end_time IS NULL AND status = 'disponivel'`,
                    [router.name, activeJob ? activeJob.file_name : null, opRes.id, req.user.id]
                );
                await pool.query(
                    `UPDATE operators SET location = $1 WHERE id = $2 AND "userId" = $3 AND status = 'disponivel'`,
                    [router.name, opRes.id, req.user.id]
                );
            }
        }

        res.json({ success: true, operator_name: opVal });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stock Items API
router.get('/api/stock', authenticateToken, async (req, res) => {
    try {
        const rows = (await pool.query(
            'SELECT * FROM stock_items WHERE "userId" = $1 ORDER BY machine, name',
            [req.user.id]
        )).rows;
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/stock', authenticateToken, async (req, res) => {
    const { name, machine, unit, qty_current, qty_min, qty_max } = req.body;
    try {
        const r = await pool.query(
            `INSERT INTO stock_items (name, machine, unit, qty_current, qty_min, qty_max, "userId")
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, machine, unit || 'un', qty_current ?? 0, qty_min ?? 0, qty_max ?? 100, req.user.id]
        );
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/stock/:id', authenticateToken, async (req, res) => {
    const { name, machine, unit, qty_current, qty_min, qty_max } = req.body;
    try {
        const r = await pool.query(
            `UPDATE stock_items SET
                name        = COALESCE($1, name),
                machine     = COALESCE($2, machine),
                unit        = COALESCE($3, unit),
                qty_current = COALESCE($4, qty_current),
                qty_min     = COALESCE($5, qty_min),
                qty_max     = COALESCE($6, qty_max),
                updated_at  = CURRENT_TIMESTAMP
             WHERE id = $7 AND "userId" = $8 RETURNING *`,
            [name, machine, unit, qty_current, qty_min, qty_max, req.params.id, req.user.id]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: 'Item não encontrado.' });
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/stock/:id', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query(
            'DELETE FROM stock_items WHERE id = $1 AND "userId" = $2',
            [req.params.id, req.user.id]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: 'Item não encontrado.' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Kaizens API
router.get('/api/kaizens', authenticateToken, async (req, res) => {
    try {
        const rows = (await pool.query(
            'SELECT * FROM kaizens WHERE "userId" = $1 ORDER BY id DESC',
            [req.user.id]
        )).rows;
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/kaizens', authenticateToken, async (req, res) => {
    const { title, description, status } = req.body;
    try {
        const r = await pool.query(
            'INSERT INTO kaizens (title, description, status, "userId") VALUES ($1, $2, $3, $4) RETURNING *',
            [title, description, status || 'Em avaliação', req.user.id]
        );
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/kaizens/:id', authenticateToken, async (req, res) => {
    const { title, description, status } = req.body;
    try {
        const r = await pool.query(
            'UPDATE kaizens SET title = COALESCE($1, title), description = COALESCE($2, description), status = COALESCE($3, status) WHERE id = $4 AND "userId" = $5 RETURNING *',
            [title, description, status, req.params.id, req.user.id]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "Kaizen não encontrado." });
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/kaizens/:id', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query('DELETE FROM kaizens WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
        if (r.rowCount === 0) return res.status(404).json({ error: "Kaizen não encontrado." });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Occurrences API
router.get('/api/occurrences', authenticateToken, async (req, res) => {
    try {
        const rows = (await pool.query(
            'SELECT * FROM occurrences WHERE "userId" = $1 ORDER BY id DESC',
            [req.user.id]
        )).rows;
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/occurrences', authenticateToken, async (req, res) => {
    const { machine, type, description, severity, status } = req.body;
    try {
        const r = await pool.query(
            'INSERT INTO occurrences (machine, type, description, severity, status, "userId") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [machine, type, description, severity || 'media', status || 'pending', req.user.id]
        );
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/occurrences/:id', authenticateToken, async (req, res) => {
    const { status, severity, description } = req.body;
    try {
        const r = await pool.query(
            'UPDATE occurrences SET status = COALESCE($1, status), severity = COALESCE($2, severity), description = COALESCE($3, description) WHERE id = $4 AND "userId" = $5 RETURNING *',
            [status, severity, description, req.params.id, req.user.id]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "Ocorrência não encontrada." });
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/occurrences/:id', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query('DELETE FROM occurrences WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
        if (r.rowCount === 0) return res.status(404).json({ error: "Ocorrência não encontrada." });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
