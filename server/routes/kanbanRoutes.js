const express = require('express');
const pool = require('../db/pool');
const { authenticateToken, authenticateSyncOrToken } = require('../middleware/auth');
const { autoSyncKanban } = require('../services/kanbanSyncService');

const router = express.Router();

// Kanban API
router.get('/api/kanban', authenticateToken, async (req, res) => {
    try {
        // Auto-sync open running jobs to 'doing'
        const openJobs = (await pool.query('SELECT * FROM jobs WHERE "userId" = $1 AND end_time IS NULL', [req.user.id])).rows;
        for (const j of openJobs) {
            await autoSyncKanban(req.user.id, j.file_name, j.folder, j.router_name, 'doing', j.operator_name);
        }

        const rows = (await pool.query(
            'SELECT * FROM kanban_tasks WHERE "userId" = $1 ORDER BY id ASC',
            [req.user.id]
        )).rows;
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Endpoint protegido (JWT ou X-Sync-Key) para o Robô da Oficina (assistente_pastas) e apps detectarem tarefas em 'todo' (A Fazer)
router.get('/api/kanban/todo-updates', authenticateSyncOrToken, async (req, res) => {
    try {
        const { since_id, since_time } = req.query;
        const params = [req.user.id];
        let query = `
            SELECT id, title, machine, operator, date, priority, column_id, "userId", estimated_minutes,
                   created_at, updated_at
            FROM kanban_tasks
            WHERE "userId" = $1 AND column_id = 'todo'
        `;
        if (since_id && !isNaN(parseInt(since_id))) {
            params.push(parseInt(since_id));
            query += ` AND id > $${params.length}`;
        }
        if (since_time) {
            params.push(new Date(since_time));
            query += ` AND updated_at > $${params.length}`;
        }
        query += ` ORDER BY updated_at DESC, id DESC LIMIT 50`;
        const { rows } = await pool.query(query, params);
        res.json({ success: true, count: rows.length, tasks: rows });
    } catch (err) {
        console.error('Erro em GET /api/kanban/todo-updates:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/kanban', authenticateToken, async (req, res) => {
    const { title, machine, operator, date, priority, column_id, estimated_minutes } = req.body;
    const estMin = estimated_minutes ? parseFloat(estimated_minutes) : null;
    try {
        const r = await pool.query(
            'INSERT INTO kanban_tasks (title, machine, operator, date, priority, column_id, "userId", estimated_minutes, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING *',
            [title, machine || null, operator || null, date || null, priority || 'media', column_id || 'todo', req.user.id, estMin]
        );
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/kanban/:id', authenticateToken, async (req, res) => {
    const { title, machine, operator, date, priority, column_id, reschedule_reason, rescheduled_date, reschedule_count, estimated_minutes } = req.body;
    const estMin = estimated_minutes !== undefined ? (estimated_minutes ? parseFloat(estimated_minutes) : null) : null;
    try {
        const oldTask = (await pool.query('SELECT * FROM kanban_tasks WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id])).rows[0];

        const r = await pool.query(
            `UPDATE kanban_tasks 
             SET title = COALESCE($1, title), 
                 machine = COALESCE($2, machine), 
                 operator = COALESCE($3, operator), 
                 date = COALESCE($4, date), 
                 priority = COALESCE($5, priority), 
                 column_id = COALESCE($6, column_id),
                 reschedule_reason = COALESCE($7, reschedule_reason),
                 rescheduled_date = COALESCE($8, rescheduled_date),
                 reschedule_count = COALESCE($9, reschedule_count),
                 estimated_minutes = COALESCE($10, estimated_minutes),
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $11 AND "userId" = $12 RETURNING *`,
            [title, machine, operator, date, priority, column_id, reschedule_reason, rescheduled_date, reschedule_count, estMin, req.params.id, req.user.id]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "Tarefa não encontrada." });
        const updatedTask = r.rows[0];

        // If title changed, sync active jobs so router logs match the updated card title
        if (title && oldTask && oldTask.title !== title) {
            await pool.query(
                `UPDATE jobs SET file_name = $1 
                 WHERE "userId" = $2 AND end_time IS NULL AND (file_name ILIKE $3 OR (router_name IS NOT NULL AND router_name ILIKE $4))`,
                [title, req.user.id, `%${oldTask.title}%`, `%${updatedTask.machine || ''}%`]
            );
        }

        if (estMin) {
            await pool.query(
                `UPDATE jobs SET estimated_minutes = $1 
                 WHERE "userId" = $2 AND end_time IS NULL AND (file_name ILIKE $3 OR folder ILIKE $3)`,
                [estMin, req.user.id, `%${updatedTask.title}%`]
            );
        }

        res.json(updatedTask);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/kanban/:id/reschedule', authenticateToken, async (req, res) => {
    const { new_date, reason } = req.body;
    if (!reason || !reason.trim()) {
        return res.status(400).json({ error: "Motivo do reagendamento é obrigatório." });
    }
    try {
        const task = (await pool.query('SELECT * FROM kanban_tasks WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id])).rows[0];
        if (!task) return res.status(404).json({ error: "Tarefa não encontrada." });

        const dateVal = new_date || task.date || new Date().toISOString().split('T')[0];
        const newCount = (task.reschedule_count || 0) + 1;

        const updated = await pool.query(
            `UPDATE kanban_tasks 
             SET date = $1, 
                 rescheduled_date = $1, 
                 reschedule_reason = $2, 
                 reschedule_count = $3, 
                 column_id = 'todo',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $4 AND "userId" = $5 RETURNING *`,
            [dateVal, reason.trim(), newCount, req.params.id, req.user.id]
        );

        res.json(updated.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/kanban/:id', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query('DELETE FROM kanban_tasks WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
        if (r.rowCount === 0) return res.status(404).json({ error: "Tarefa não encontrada." });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/kanban/batch', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('DELETE FROM kanban_tasks WHERE "userId" = $1', [req.user.id]);
        const cards = req.body;
        const inserted = [];
        for (const card of cards) {
            const r = await client.query(
                'INSERT INTO kanban_tasks (title, machine, operator, date, priority, column_id, "userId") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
                [card.title, card.machine || null, card.operator || null, card.date || null, card.priority || 'media', card.column_id || 'todo', req.user.id]
            );
            inserted.push(r.rows[0]);
        }
        await client.query('COMMIT');
        res.json(inserted);
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// Kanban Archive API
router.post('/api/kanban/archive', authenticateToken, async (req, res) => {
    const { kanban_id, title, machine, operator, priority, quality_rating, qty_approved, qty_rejected, observations } = req.body;
    try {
        // Save to archive
        const r = await pool.query(
            `INSERT INTO kanban_archive (title, machine, operator, priority, quality_rating, qty_approved, qty_rejected, observations, "userId")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [title, machine, operator, priority, quality_rating ?? 5, qty_approved ?? 0, qty_rejected ?? 0, observations ?? '', req.user.id]
        );
        // Delete from kanban
        if (kanban_id) {
            await pool.query('DELETE FROM kanban_tasks WHERE id = $1 AND "userId" = $2', [kanban_id, req.user.id]);
        }
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/kanban/archive-all', authenticateToken, async (req, res) => {
    try {
        const clientCards = Array.isArray(req.body?.cards) ? req.body.cards : null;
        let tasksToArchive = clientCards;

        if (!tasksToArchive || tasksToArchive.length === 0) {
            tasksToArchive = (await pool.query(
                'SELECT * FROM kanban_tasks WHERE "userId" = $1 AND column_id = $2 ORDER BY id ASC',
                [req.user.id, 'done']
            )).rows;
        }

        if (tasksToArchive.length > 0) {
            for (const task of tasksToArchive) {
                await pool.query(
                    `INSERT INTO kanban_archive (title, machine, operator, priority, quality_rating, qty_approved, qty_rejected, observations, "userId")
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                    [
                        task.title || 'Sem título',
                        task.machine || '',
                        task.operator || '',
                        task.priority || 'media',
                        task.quality_rating ?? 5,
                        task.qty_approved ?? 1,
                        task.qty_rejected ?? 0,
                        task.observations ?? 'Arquivado em lote',
                        req.user.id
                    ]
                );
            }

            const numericIds = tasksToArchive
                .map(t => Number(t.id))
                .filter(n => Number.isInteger(n) && n > 0);

            if (numericIds.length > 0) {
                await pool.query(
                    'DELETE FROM kanban_tasks WHERE "userId" = $1 AND (column_id = $2 OR id = ANY($3::int[]))',
                    [req.user.id, 'done', numericIds]
                );
            } else {
                await pool.query(
                    'DELETE FROM kanban_tasks WHERE "userId" = $1 AND column_id = $2',
                    [req.user.id, 'done']
                );
            }
        }

        res.json({ success: true, count: tasksToArchive.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/kanban/archive', authenticateToken, async (req, res) => {
    try {
        const rows = (await pool.query(
            'SELECT * FROM kanban_archive WHERE "userId" = $1 ORDER BY archived_at DESC LIMIT 50',
            [req.user.id]
        )).rows;
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
