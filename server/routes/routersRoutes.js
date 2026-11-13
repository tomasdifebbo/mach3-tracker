const express = require('express');
const pool = require('../db/pool');
const { authenticateToken } = require('../middleware/auth');
const { applyShiftAllocationRule } = require('../services/shiftService');

const router = express.Router();

// ===== ROUTERS STATUS =====
router.get('/api/routers', authenticateToken, async (req, res) => {
    try {
        await applyShiftAllocationRule(req.user.id);
        let routers = (await pool.query('SELECT * FROM routers WHERE "userId" = $1 ORDER BY id ASC', [req.user.id])).rows;
        
        // Auto-provision generic first router only for fresh tenant workspaces
        if (routers.length === 0) {
            const starterRouter = (await pool.query(
                'INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3) RETURNING *',
                ['Router CNC 1', 'active', req.user.id]
            )).rows[0];
            if (starterRouter) routers.push(starterRouter);
        }

        for (const r of routers) {
            const isLaser = r.name.toLowerCase().includes('laser');
            const isCentral = r.name.toLowerCase().includes('central') || r.name.toLowerCase().includes('1');
            const isRouter2 = r.name.toLowerCase().includes('2') || r.name.toLowerCase().includes('act10');
            const isVacuo = r.name.toLowerCase().includes('vacuo') || r.name.toLowerCase().includes('vácuo');
            const cleanName = r.name.replace(/ruida/i, '').replace(/co2|co₂/i, '').trim();

            const activeJob = (await pool.query(
                `SELECT * FROM jobs 
                 WHERE "userId" = $1 
                 AND (
                   router_name ILIKE $2 
                   OR router_name ILIKE $3 
                   OR ($4 = true AND router_name ILIKE '%laser%')
                   OR ($5 = true AND (router_name ILIKE '%central%' OR router_name ILIKE '%router 1%'))
                   OR ($6 = true AND (router_name ILIKE '%router 2%' OR router_name ILIKE '%act10%'))
                   OR ($7 = true AND (router_name ILIKE '%vacuo%' OR router_name ILIKE '%vácuo%'))
                 ) 
                 AND end_time IS NULL 
                 ORDER BY start_time DESC LIMIT 1`,
                [req.user.id, `%${r.name}%`, `%${cleanName}%`, isLaser, isCentral, isRouter2, isVacuo]
            )).rows[0];

            if (activeJob) {
                let estMin = activeJob.estimated_minutes ? parseFloat(activeJob.estimated_minutes) : null;
                
                if (!estMin) {
                    const recentEst = (await pool.query(
                        `SELECT estimated_minutes FROM jobs 
                         WHERE "userId" = $1 
                         AND (
                           router_name ILIKE $2 
                           OR router_name ILIKE $3 
                           OR ($4 = true AND router_name ILIKE '%laser%')
                           OR ($5 = true AND (router_name ILIKE '%central%' OR router_name ILIKE '%router 1%'))
                           OR ($6 = true AND (router_name ILIKE '%router 2%' OR router_name ILIKE '%act10%'))
                         ) 
                         AND estimated_minutes IS NOT NULL 
                         AND estimated_minutes > 0 
                         ORDER BY start_time DESC LIMIT 1`,
                        [req.user.id, `%${r.name}%`, `%${cleanName}%`, isLaser, isCentral, isRouter2]
                    )).rows[0];

                    if (recentEst && recentEst.estimated_minutes) {
                        estMin = parseFloat(recentEst.estimated_minutes);
                        await pool.query('UPDATE jobs SET estimated_minutes = $1 WHERE id = $2 AND "userId" = $3', [estMin, activeJob.id, req.user.id]);
                    }
                }

                r.current_job = activeJob.file_name;
                r.current_job_id = activeJob.id;
                r.start_time = activeJob.start_time;
                r.estimated_minutes = estMin;
                r.operator_name = activeJob.operator_name || r.operator_name || null;
                r.status = 'cortando';
            } else {
                r.current_job = null;
                r.start_time = null;
                r.estimated_minutes = null;
            }
        }
        res.json(routers);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/routers/:id/status', authenticateToken, async (req, res) => {
    const { status, status_note } = req.body;
    const validStatuses = ['active', 'maintenance', 'offline'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Status inválido. Use: ${validStatuses.join(', ')}` });
    }
    try {
        const router = (await pool.query('SELECT * FROM routers WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id])).rows[0];
        if (!router) return res.status(404).json({ error: 'Router não encontrada' });
        
        if (router.status !== status) {
            // Close old log
            const openLog = (await pool.query('SELECT id, started_at FROM router_status_log WHERE router_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1', [router.id])).rows[0];
            if (openLog) {
                const endedAt = new Date();
                const durationMinutes = (endedAt - new Date(openLog.started_at)) / 60000;
                await pool.query('UPDATE router_status_log SET ended_at = $1, duration_minutes = $2 WHERE id = $3', [endedAt.toISOString(), durationMinutes, openLog.id]);
            }
            // Create new log
            await pool.query('INSERT INTO router_status_log (router_id, router_name, status, "userId") VALUES ($1, $2, $3, $4)', [router.id, router.name, status, req.user.id]);
        }

        await pool.query(
            'UPDATE routers SET status = $1, status_note = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3 AND "userId" = $4',
            [status, status_note || null, req.params.id, req.user.id]
        );
        const updatedRouter = (await pool.query('SELECT * FROM routers WHERE id = $1', [req.params.id])).rows[0];
        res.json({ success: true, router: updatedRouter });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/routers/status-log', authenticateToken, async (req, res) => {
    try {
        const logs = (await pool.query('SELECT * FROM router_status_log WHERE "userId" = $1 ORDER BY started_at DESC', [req.user.id])).rows;
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== MAINTENANCE SCHEDULE =====
router.get('/api/maintenance', authenticateToken, async (req, res) => {
    try {
        const records = (await pool.query('SELECT * FROM maintenance_schedule WHERE "userId" = $1 ORDER BY scheduled_date ASC, scheduled_time ASC', [req.user.id])).rows;
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/maintenance', authenticateToken, async (req, res) => {
    const { router_id, router_name, scheduled_date, scheduled_time, type, description, technician } = req.body;
    if (!router_id || !scheduled_date || !description) return res.status(400).json({ error: 'Faltam dados obrigatórios' });
    try {
        const result = await pool.query(
            'INSERT INTO maintenance_schedule (router_id, router_name, scheduled_date, scheduled_time, type, description, technician, "userId") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [router_id, router_name, scheduled_date, scheduled_time || null, type || 'preventive', description, technician || null, req.user.id]
        );
        res.json({ success: true, maintenance: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/maintenance/:id', authenticateToken, async (req, res) => {
    const { status, parts_replaced, parts_cost, completed_at, description, scheduled_date, scheduled_time, technician } = req.body;
    try {
        const maintenance = (await pool.query('SELECT * FROM maintenance_schedule WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id])).rows[0];
        if (!maintenance) return res.status(404).json({ error: 'Manutenção não encontrada' });
        
        let query = 'UPDATE maintenance_schedule SET ';
        let values = [];
        let index = 1;
        
        if (status !== undefined) { query += `status = $${index++}, `; values.push(status); }
        if (parts_replaced !== undefined) { query += `parts_replaced = $${index++}, `; values.push(parts_replaced); }
        if (parts_cost !== undefined) { query += `parts_cost = $${index++}, `; values.push(parts_cost); }
        if (completed_at !== undefined) { query += `completed_at = $${index++}, `; values.push(completed_at); }
        if (description !== undefined) { query += `description = $${index++}, `; values.push(description); }
        if (scheduled_date !== undefined) { query += `scheduled_date = $${index++}, `; values.push(scheduled_date); }
        if (scheduled_time !== undefined) { query += `scheduled_time = $${index++}, `; values.push(scheduled_time); }
        if (technician !== undefined) { query += `technician = $${index++}, `; values.push(technician); }
        
        if (values.length === 0) return res.json({ success: true, maintenance });
        
        query = query.slice(0, -2) + ` WHERE id = $${index++} AND "userId" = $${index} RETURNING *`;
        values.push(req.params.id, req.user.id);
        
        const result = await pool.query(query, values);
        res.json({ success: true, maintenance: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/maintenance/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM maintenance_schedule WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
        if (result.rowCount > 0) res.json({ success: true });
        else res.status(404).json({ error: 'Manutenção não encontrada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/routers', authenticateToken, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome obrigatório' });
    try {
        const result = await pool.query(
            'INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3) RETURNING *',
            [name, 'active', req.user.id]
        );
        res.json({ success: true, router: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/api/routers/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM routers WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
        if (result.rowCount > 0) res.json({ success: true });
        else res.status(404).json({ error: 'Router não encontrada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
