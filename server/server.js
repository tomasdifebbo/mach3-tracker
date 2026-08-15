const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
require('dotenv').config();
const { Pool } = require('pg');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

// Mercado Pago config
const mpClient = new MercadoPagoConfig({ 
    accessToken: process.env.MP_ACCESS_TOKEN || 'TEST-your-mp-access-token-here' 
});

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mach3_secret_2026';
const DOMAIN = process.env.RENDER_EXTERNAL_URL || process.env.DOMAIN || `http://localhost:${port}`;

// P0: Restricted CORS (production + localhost dev)
const allowedOrigins = [
    DOMAIN,
    'https://mach3-tracker.onrender.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173'
];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('CORS não permitido'));
    },
    credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    maxAge: 0,
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

// Database setup using PostgreSQL (Supabase)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Helper to close stale jobs (> 3 hours or corrupted router_name)
async function closeStaleJobs(userId) {
    try {
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
        const staleJobs = (await pool.query(
            'SELECT id, start_time, estimated_minutes, router_name FROM jobs WHERE "userId" = $1 AND end_time IS NULL AND (start_time < $2 OR router_name LIKE \'%\\\\%\' OR router_name LIKE \'%.TXT%\' OR router_name LIKE \'%.txt%\')',
            [userId, threeHoursAgo]
        )).rows;

        for (const job of staleJobs) {
            const start = new Date(job.start_time);
            const estMin = job.estimated_minutes ? parseFloat(job.estimated_minutes) : 15;
            const end = new Date(start.getTime() + estMin * 60 * 1000).toISOString();
            await pool.query('UPDATE jobs SET end_time = $1, duration_minutes = $2 WHERE id = $3', [end, estMin, job.id]);
            console.log(`[CLEANUP] Locked stale job #${job.id}`);
        }
    } catch (e) {
        console.error("Cleanup stale jobs error:", e);
    }
}

// Maintenance: Keep only X days of history
async function runMaintenance() {
    try {
        const RETENTION_DAYS = 60; 
        if (RETENTION_DAYS > 0) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
            const cutoffStr = cutoffDate.toISOString();
            
            const result = await pool.query('DELETE FROM jobs WHERE start_time < $1 AND end_time IS NOT NULL', [cutoffStr]);
            if (result.rowCount > 0) {
                console.log(`[MAINTENANCE] Removed ${result.rowCount} old jobs (beyond ${RETENTION_DAYS} days)`);
            }
        }
    } catch (e) {
        console.error("Maintenance error:", e);
    }
}

// Initialize tables
async function initDb() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE,
                password TEXT,
                plan TEXT,
                trial_expiry TEXT,
                payment_status TEXT,
                "costPerHour" REAL DEFAULT 50,
                "plannedHours" REAL DEFAULT 8,
                role TEXT DEFAULT 'user'
            );
            CREATE TABLE IF NOT EXISTS materials (
                id SERIAL PRIMARY KEY,
                name TEXT,
                price REAL,
                feed_rate REAL DEFAULT 3000,
                pass_width REAL DEFAULT 100,
                "userId" INTEGER
            );
            CREATE TABLE IF NOT EXISTS jobs (
                id SERIAL PRIMARY KEY,
                file_name TEXT,
                folder TEXT,
                file_path TEXT,
                start_time TEXT,
                end_time TEXT,
                duration_minutes REAL,
                day INTEGER,
                month INTEGER,
                year INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "userId" INTEGER,
                material_id INTEGER,
                material_name TEXT,
                material_price REAL,
                router_name TEXT,
                estimated_minutes REAL,
                quantity INTEGER DEFAULT 1
            );
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
            CREATE TABLE IF NOT EXISTS routers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                status_note TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "userId" INTEGER
            );
            CREATE TABLE IF NOT EXISTS router_status_log (
                id SERIAL PRIMARY KEY,
                router_id INTEGER NOT NULL,
                router_name TEXT,
                status TEXT NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                duration_minutes REAL,
                "userId" INTEGER
            );
            CREATE TABLE IF NOT EXISTS maintenance_schedule (
                id SERIAL PRIMARY KEY,
                router_id INTEGER NOT NULL,
                router_name TEXT,
                scheduled_date DATE NOT NULL,
                scheduled_time TIME,
                type TEXT DEFAULT 'preventive',
                description TEXT,
                parts_replaced TEXT,
                status TEXT DEFAULT 'pending',
                completed_at TIMESTAMP,
                technician TEXT,
                parts_cost REAL,
                "userId" INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Alter table if missing parts_cost (for backward compatibility)
            ALTER TABLE maintenance_schedule ADD COLUMN IF NOT EXISTS parts_cost REAL;
            
            -- Alter jobs table if missing new columns (migration from old schema)
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "userId" INTEGER;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS material_id INTEGER;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS material_name TEXT;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS material_price REAL;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS router_name TEXT;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_minutes REAL;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

            -- Alter materials table for m² calculation & sheet dimensions
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS feed_rate REAL DEFAULT 3000;
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS pass_width REAL DEFAULT 100;
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS sheet_width_mm REAL DEFAULT 2750;
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS sheet_height_mm REAL DEFAULT 1850;

            -- Alter jobs table for bounding box coordinates from G-code
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_x REAL;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_y REAL;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS bounding_area_m2 REAL;

            -- Payments table
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                "userId" INTEGER NOT NULL,
                mp_preference_id TEXT,
                mp_payment_id TEXT,
                plan TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                amount REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Add plan and trial to users if missing
            ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_expiry TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'none';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS webhook_url TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expiry TIMESTAMP;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS features_override TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS company_role TEXT DEFAULT 'gerente';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS gerente_pin TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor_pin TEXT;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS operator_name TEXT;

            -- Kanban and Checklist tables
            CREATE TABLE IF NOT EXISTS kanban_tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                machine TEXT,
                operator TEXT,
                date TEXT,
                priority TEXT,
                column_id TEXT NOT NULL,
                "userId" INTEGER
            );
            ALTER TABLE kanban_tasks ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;
            ALTER TABLE kanban_tasks ADD COLUMN IF NOT EXISTS rescheduled_date TEXT;
            ALTER TABLE kanban_tasks ADD COLUMN IF NOT EXISTS reschedule_count INTEGER DEFAULT 0;
            ALTER TABLE kanban_tasks ADD COLUMN IF NOT EXISTS estimated_minutes REAL;

            CREATE TABLE IF NOT EXISTS checklists (
                id SERIAL PRIMARY KEY,
                machine_key TEXT NOT NULL,
                item_index INTEGER NOT NULL,
                done BOOLEAN NOT NULL DEFAULT FALSE,
                date TEXT NOT NULL,
                "userId" INTEGER,
                UNIQUE(machine_key, item_index, date, "userId")
            );

            CREATE TABLE IF NOT EXISTS checklist_items (
                id SERIAL PRIMARY KEY,
                machine_key TEXT NOT NULL,
                item_text TEXT NOT NULL,
                "userId" INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE routers ADD COLUMN IF NOT EXISTS operator_name TEXT;

            CREATE TABLE IF NOT EXISTS operators (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                shift TEXT DEFAULT 'Geral',
                "userId" INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE operators ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'disponivel';
            ALTER TABLE operators ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'Na Fábrica';

            CREATE TABLE IF NOT EXISTS operator_time_logs (
                id SERIAL PRIMARY KEY,
                "userId" INTEGER NOT NULL,
                operator_id INTEGER REFERENCES operators(id) ON DELETE CASCADE,
                operator_name TEXT NOT NULL,
                status TEXT NOT NULL,
                location TEXT,
                kanban_task_id INTEGER REFERENCES kanban_tasks(id) ON DELETE SET NULL,
                kanban_title TEXT,
                start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP,
                duration_minutes REAL,
                notes TEXT
            );

            CREATE TABLE IF NOT EXISTS kaizens (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Em avaliação',
                "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS occurrences (
                id SERIAL PRIMARY KEY,
                machine TEXT NOT NULL,
                type TEXT NOT NULL,
                description TEXT NOT NULL,
                severity TEXT NOT NULL DEFAULT 'media',
                status TEXT NOT NULL DEFAULT 'pending',
                "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS stock_items (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                machine TEXT NOT NULL,
                unit TEXT NOT NULL DEFAULT 'un',
                qty_current NUMERIC NOT NULL DEFAULT 0,
                qty_min NUMERIC NOT NULL DEFAULT 0,
                qty_max NUMERIC NOT NULL DEFAULT 100,
                "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS kanban_archive (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                machine TEXT,
                operator TEXT,
                priority TEXT,
                quality_rating INTEGER NOT NULL DEFAULT 5,
                qty_approved INTEGER NOT NULL DEFAULT 0,
                qty_rejected INTEGER NOT NULL DEFAULT 0,
                observations TEXT,
                archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE
            );
        `);

        // SEED: Ensure Casadotrem exists
        const userRes = await pool.query('SELECT * FROM users WHERE email = $1', ['casadotrem@gmail.com']);
        if (userRes.rowCount === 0) {
            console.log("[SEED] Criando conta administradora casadotrem@gmail.com...");
            const hash = bcrypt.hashSync('123456', 10);
            await pool.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3)', ['casadotrem@gmail.com', hash, 'admin']);
        }

        // SEED MATERIALS
        const matRes = await pool.query('SELECT count(*) as count FROM materials');
        if (parseInt(matRes.rows[0].count) === 0) {
            console.log("[SEED] Populando materiais padrão...");
            const masterUser = (await pool.query('SELECT id FROM users WHERE email = $1', ['casadotrem@gmail.com'])).rows[0];
            if (masterUser) {
                const defaultMaterials = [
                    ["mdf 15mm", 180, masterUser.id],
                    ["mdf 9mm", 100, masterUser.id],
                    ["mdf 9mm naval", 250, masterUser.id],
                    ["mdf 6mm", 90, masterUser.id],
                    ["mdf 3mm", 80, masterUser.id],
                    ["pvc", 60, masterUser.id],
                    ["pvc +", 120, masterUser.id],
                    ["isopor N", 60, masterUser.id],
                    ["isopor +", 120, masterUser.id]
                ];
                for (const m of defaultMaterials) {
                    await pool.query('INSERT INTO materials (name, price, "userId") VALUES ($1, $2, $3)', m);
                }
            }
        }

        // SEED ROUTERS
        const masterUser = (await pool.query('SELECT id FROM users WHERE email = $1', ['casadotrem@gmail.com'])).rows[0];
        if (masterUser) {
            const routerRes = await pool.query('SELECT count(*) as count FROM routers WHERE "userId" = $1', [masterUser.id]);
            if (parseInt(routerRes.rows[0].count) === 0) {
                console.log("[SEED] Criando routers padrão...");
                await pool.query('INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3)', ['Router Central', 'active', masterUser.id]);
                await pool.query('INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3)', ['Router 2', 'active', masterUser.id]);
                await pool.query('INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3)', ['Laser Ruida', 'active', masterUser.id]);
            } else {
                // Rename Router 1 to Router Central if present
                await pool.query("UPDATE routers SET name = 'Router Central' WHERE (name ILIKE '%router 1%' OR name ILIKE '%router1%') AND \"userId\" = $1", [masterUser.id]);
                // Guarantee Laser Ruida router exists
                const laserCheck = await pool.query("SELECT id FROM routers WHERE name ILIKE '%laser%' AND \"userId\" = $1", [masterUser.id]);
                if (laserCheck.rows.length === 0) {
                    console.log("[SEED] Adicionando máquina Laser Ruida...");
                    await pool.query('INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3)', ['Laser Ruida', 'active', masterUser.id]);
                }
                // Guarantee Máquina a Vácuo router exists
                const vacuoCheck = await pool.query("SELECT id FROM routers WHERE (name ILIKE '%vacuo%' OR name ILIKE '%vácuo%') AND \"userId\" = $1", [masterUser.id]);
                if (vacuoCheck.rows.length === 0) {
                    console.log("[SEED] Adicionando Máquina a Vácuo...");
                    await pool.query('INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3)', ['Máquina a Vácuo', 'active', masterUser.id]);
                }
            }
        }

        // SEED ROUTER STATUS LOG
        const logRes = await pool.query('SELECT count(*) as count FROM router_status_log');
        if (parseInt(logRes.rows[0].count) === 0) {
            console.log("[SEED] Populando histórico de status inicial...");
            const allRouters = (await pool.query('SELECT * FROM routers')).rows;
            for (const r of allRouters) {
                await pool.query(
                    'INSERT INTO router_status_log (router_id, router_name, status, status_note, started_at, "userId") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)',
                    [r.id, r.name, r.status, 'Status inicial', r.userId]
                );
            }
        }
        console.log("Banco de dados PostgreSQL inicializado com sucesso.");
        runMaintenance();
        setInterval(runMaintenance, 24 * 60 * 60 * 1000);
    } catch (err) {
        console.error("DB Seed Error:", err);
    }
}

const RuidaMonitor = require('./ruida_monitor');

initDb().then(() => {
    try {
        const ruida = new RuidaMonitor(pool, autoSyncKanban);
        ruida.start();
    } catch (err) {
        console.error('[RUIDA MONITOR START ERROR]', err);
    }
});

// Middleware to protect routes
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// ===== ROUTERS STATUS =====
app.get('/api/routers', authenticateToken, async (req, res) => {
    try {
        let routers = (await pool.query('SELECT * FROM routers WHERE "userId" = $1 ORDER BY id ASC', [req.user.id])).rows;
        
        // Auto-provision "Máquina a Vácuo" if missing for user
        const hasVacuo = routers.some(r => r.name.toLowerCase().includes('vacuo') || r.name.toLowerCase().includes('vácuo'));
        if (!hasVacuo) {
            const newVacuo = (await pool.query(
                'INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3) RETURNING *',
                ['Máquina a Vácuo', 'active', req.user.id]
            )).rows[0];
            routers.push(newVacuo);
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
                        await pool.query('UPDATE jobs SET estimated_minutes = $1 WHERE id = $2', [estMin, activeJob.id]);
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

app.patch('/api/routers/:id/status', authenticateToken, async (req, res) => {
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

app.get('/api/routers/status-log', authenticateToken, async (req, res) => {
    try {
        const logs = (await pool.query('SELECT * FROM router_status_log WHERE "userId" = $1 ORDER BY started_at DESC', [req.user.id])).rows;
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ===== MAINTENANCE SCHEDULE =====
app.get('/api/maintenance', authenticateToken, async (req, res) => {
    try {
        const records = (await pool.query('SELECT * FROM maintenance_schedule WHERE "userId" = $1 ORDER BY scheduled_date ASC, scheduled_time ASC', [req.user.id])).rows;
        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/maintenance', authenticateToken, async (req, res) => {
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

app.patch('/api/maintenance/:id', authenticateToken, async (req, res) => {
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

app.delete('/api/maintenance/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM maintenance_schedule WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
        if (result.rowCount > 0) res.json({ success: true });
        else res.status(404).json({ error: 'Manutenção não encontrada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/routers', authenticateToken, async (req, res) => {
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

app.delete('/api/routers/:id', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM routers WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
        if (result.rowCount > 0) res.json({ success: true });
        else res.status(404).json({ error: 'Router não encontrada' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

function authenticateAdmin(req, res, next) {
    const masterEmails = ['tomasdifebbo.tdf@gmail.com', 'admin@mach3.com', 'casadotrem@gmail.com', 'demo@mach3tracker.com'];
    if (req.user && (req.user.role === 'admin' || (req.user.email && (masterEmails.includes(req.user.email.toLowerCase()) || req.user.email.toLowerCase().includes('demo'))))) {
        return next();
    }
    return res.status(403).json({ error: "Access denied: Admins only" });
}

// API Routes
app.get('/health', (req, res) => res.status(200).send('OK'));

app.post('/api/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !email.includes('@')) return res.status(400).json({ error: "Email inválido" });
    if (!password || password.length < 6) return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres" });

    const existingUser = (await pool.query('SELECT id FROM users WHERE email = $1', [email])).rows[0];
    if (existingUser) return res.status(400).json({ error: "Email já cadastrado" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + 31);

    try {
        const defaultRole = email === 'tomasdifebbo.tdf@gmail.com' ? 'admin' : 'user';
        await pool.query('INSERT INTO users (email, password, plan, trial_expiry, payment_status, "costPerHour", "plannedHours", role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)', 
            [email, hashedPassword, 'starter', trialExpiry.toISOString(), 'trialing', 50, 8, defaultRole]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao registrar usuário" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: "E-mail e senha são obrigatórios" });

        const cleanEmail = String(email).trim().toLowerCase();
        const user = (await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail])).rows[0];
        if (!user) return res.status(400).json({ error: "Usuário não encontrado" });

        let validPassword = false;
        if (user.password) {
            validPassword = await bcrypt.compare(password, user.password);
        }

        // Master account fallback for casadotrem@gmail.com
        if (!validPassword && cleanEmail === 'casadotrem@gmail.com' && (password === '123456' || password === 'admin')) {
            const newHash = await bcrypt.hash(password, 10);
            await pool.query("UPDATE users SET password = $1, role = 'admin', company_role = 'gerente' WHERE id = $2", [newHash, user.id]);
            validPassword = true;
            user.role = 'admin';
            user.company_role = 'gerente';
        }

        if (!validPassword) return res.status(400).json({ error: "Senha incorreta" });

        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user.id, email: user.email, plan: user.plan, role: user.role, company_role: user.company_role || 'gerente' } });
    } catch (err) {
        console.error('[LOGIN ERROR]', err);
        res.status(500).json({ error: "Erro no servidor: " + err.message });
    }
});

// Password Recovery Config
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'contato@mach3tracker.com',
        pass: process.env.EMAIL_PASS || 'sua_senha_de_app_aqui'
    }
});

app.post('/api/auth/recover', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email obrigatório" });

    const user = (await pool.query('SELECT id, email FROM users WHERE email = $1', [email])).rows[0];
    if (!user) {
        // Obscure for security, always return success even if email not found
        return res.json({ success: true }); 
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 hour

    await pool.query('UPDATE users SET reset_token = $1, reset_expiry = $2 WHERE id = $3', [resetToken, expiry, user.id]);

    const resetLink = `${DOMAIN}?reset=${resetToken}`;
    
    const mailOptions = {
        from: '"MACH3 Tracker" <contato@mach3tracker.com>',
        to: email,
        subject: 'Recuperação de Senha - MACH3 Tracker',
        html: `
            <h2>Recuperação de Senha</h2>
            <p>Você solicitou a recuperação de senha da sua conta MACH3 Tracker.</p>
            <p>Clique no link abaixo para redefinir sua senha:</p>
            <a href="${resetLink}" style="display:inline-block;padding:10px 20px;background:#06b6d4;color:#000;text-decoration:none;border-radius:5px;font-weight:bold;">Redefinir Senha</a>
            <p>Este link expira em 1 hora.</p>
            <p>Se você não solicitou, ignore este e-mail.</p>
        `
    };

    try {
        if (process.env.EMAIL_PASS) {
            await transporter.sendMail(mailOptions);
        } else {
            console.log(`[AUTH] Mocking email send to ${email}. Reset token: ${resetToken}`);
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Email send error:", err);
        res.status(500).json({ error: "Erro ao enviar email de recuperação" });
    }
});

app.post('/api/auth/reset', async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: "Dados inválidos" });
    }

    const user = (await pool.query('SELECT id FROM users WHERE reset_token = $1 AND reset_expiry > NOW()', [token])).rows[0];
    if (!user) return res.status(400).json({ error: "Token inválido ou expirado" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1, reset_token = NULL, reset_expiry = NULL WHERE id = $2', [hashedPassword, user.id]);

    res.json({ success: true });
});

const DEFAULT_PLAN_FEATURES = {
    starter: {
        dashboard: true,
        operador: true,
        jobs: true,
        charts: false,
        materials: true,
        maintenance: false,
        encarregado: false,
        m2_calculation: false,
        export_pdf_csv: false,
        notifications: true
    },
    pro: {
        dashboard: true,
        operador: true,
        jobs: true,
        charts: true,
        materials: true,
        maintenance: true,
        encarregado: true,
        m2_calculation: true,
        export_pdf_csv: true,
        notifications: true
    },
    business: {
        dashboard: true,
        operador: true,
        jobs: true,
        charts: true,
        materials: true,
        maintenance: true,
        encarregado: true,
        m2_calculation: true,
        export_pdf_csv: true,
        notifications: true
    }
};

function getEffectiveFeatures(userPlan, overrideJsonStr) {
    const base = DEFAULT_PLAN_FEATURES[userPlan] || DEFAULT_PLAN_FEATURES.starter;
    if (!overrideJsonStr) return { ...base };
    try {
        const parsed = typeof overrideJsonStr === 'object' ? overrideJsonStr : JSON.parse(overrideJsonStr);
        return { ...base, ...parsed };
    } catch {
        return { ...base };
    }
}

app.get('/api/user/me', authenticateToken, async (req, res) => {
    await closeStaleJobs(req.user.id);
    let user = (await pool.query('SELECT id, email, plan, trial_expiry, payment_status, "costPerHour", "plannedHours", role, company_role, gerente_pin, supervisor_pin, webhook_url, features_override FROM users WHERE id = $1', [req.user.id])).rows[0];
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const masterEmails = ['tomasdifebbo.tdf@gmail.com', 'admin@mach3.com', 'casadotrem@gmail.com', 'demo@mach3tracker.com'];
    if (user.email.toLowerCase().includes('demo')) {
        user.plan = 'business';
        user.role = 'admin';
    }
    if (masterEmails.includes(user.email) && user.role !== 'admin') {
        await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
        user.role = 'admin';
    }

    if (!user.company_role) user.company_role = 'gerente';

    const settings = { costPerHour: user.costPerHour, plannedHours: user.plannedHours, webhookUrl: user.webhook_url };
    const features = getEffectiveFeatures(user.plan, user.features_override);
    const has_gerente_pin = !!(user.gerente_pin && user.gerente_pin.trim());
    const has_supervisor_pin = !!(user.supervisor_pin && user.supervisor_pin.trim());

    // Do not leak raw PINs to client
    const safeUser = { ...user };
    delete safeUser.gerente_pin;
    delete safeUser.supervisor_pin;

    res.json({ ...safeUser, has_gerente_pin, has_supervisor_pin, settings, features });
});

app.patch('/api/user/settings', authenticateToken, async (req, res) => {
    const { costPerHour, plannedHours, webhookUrl } = req.body;
    let cost = Number(costPerHour);
    let planned = Number(plannedHours);
    if (isNaN(cost) || isNaN(planned)) return res.status(400).json({ error: "Valores inválidos" });

    await pool.query('UPDATE users SET "costPerHour" = $1, "plannedHours" = $2, webhook_url = $3 WHERE id = $4', [cost, planned, webhookUrl || null, req.user.id]);
    res.json({ success: true });
});

const handleRoleUpdate = async (req, res) => {
    try {
        const { company_role, pin } = req.body;
        if (!['gerente', 'encarregado', 'operador'].includes(company_role)) {
            return res.status(400).json({ error: "Nível de acesso inválido" });
        }

        const user = (await pool.query('SELECT gerente_pin, supervisor_pin FROM users WHERE id = $1', [req.user.id])).rows[0];

        // Check PIN requirement if switching to gerente
        if (company_role === 'gerente' && user && user.gerente_pin && user.gerente_pin.trim()) {
            if (!pin || String(pin).trim() !== String(user.gerente_pin).trim()) {
                return res.status(401).json({ error: "Senha do Perfil Gerente incorreta!" });
            }
        }

        // Check PIN requirement if switching to encarregado (supervisor)
        if (company_role === 'encarregado' && user && user.supervisor_pin && user.supervisor_pin.trim()) {
            if (!pin || String(pin).trim() !== String(user.supervisor_pin).trim()) {
                return res.status(401).json({ error: "Senha do Perfil Supervisor incorreta!" });
            }
        }

        await pool.query('UPDATE users SET company_role = $1 WHERE id = $2', [company_role, req.user.id]);
        res.json({ success: true, company_role });
    } catch (err) {
        console.error('[ROLE UPDATE ERROR]', err);
        res.status(500).json({ error: "Erro ao atualizar perfil no banco de dados" });
    }
};

app.patch('/api/user/company-role', authenticateToken, handleRoleUpdate);
app.post('/api/user/company-role', authenticateToken, handleRoleUpdate);

app.post('/api/user/verify-pin', authenticateToken, async (req, res) => {
    try {
        const { role, pin } = req.body;
        const user = (await pool.query('SELECT role, gerente_pin, supervisor_pin FROM users WHERE id = $1', [req.user.id])).rows[0];
        if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

        // Master Admins bypass PIN check
        if (user.role === 'admin') {
            return res.json({ success: true });
        }

        if (role === 'gerente' && user.gerente_pin && user.gerente_pin.trim()) {
            if (!pin || String(pin).trim() !== String(user.gerente_pin).trim()) {
                return res.status(401).json({ error: "Senha do Perfil Gerente incorreta!" });
            }
        }

        if (role === 'encarregado' && user.supervisor_pin && user.supervisor_pin.trim()) {
            if (!pin || String(pin).trim() !== String(user.supervisor_pin).trim()) {
                return res.status(401).json({ error: "Senha do Perfil Supervisor incorreta!" });
            }
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/user/profile-pins', authenticateToken, async (req, res) => {
    const { gerente_pin, supervisor_pin } = req.body;
    await pool.query(
        'UPDATE users SET gerente_pin = $1, supervisor_pin = $2 WHERE id = $3',
        [
            gerente_pin !== undefined ? (gerente_pin ? String(gerente_pin).trim() : null) : null,
            supervisor_pin !== undefined ? (supervisor_pin ? String(supervisor_pin).trim() : null) : null,
            req.user.id
        ]
    );
    res.json({ success: true });
});

app.get('/api/admin/users', authenticateToken, authenticateAdmin, async (req, res) => {
    const users = (await pool.query('SELECT id, email, plan, payment_status, trial_expiry, role, company_role, features_override FROM users ORDER BY id DESC')).rows;
    const formatted = users.map(u => ({
        ...u,
        company_role: u.company_role || 'gerente',
        features: getEffectiveFeatures(u.plan, u.features_override)
    }));
    res.json(formatted);
});

app.patch('/api/admin/users/:id/plan', authenticateToken, authenticateAdmin, async (req, res) => {
    const { plan, addDays } = req.body;
    if (plan) await pool.query('UPDATE users SET plan = $1 WHERE id = $2', [plan, req.params.id]);
    if (addDays) {
        const user = (await pool.query('SELECT trial_expiry FROM users WHERE id = $1', [req.params.id])).rows[0];
        const currentExp = user.trial_expiry ? new Date(user.trial_expiry) : new Date();
        currentExp.setDate(currentExp.getDate() + Number(addDays));
        await pool.query('UPDATE users SET trial_expiry = $1 WHERE id = $2', [currentExp.toISOString(), req.params.id]);
    }
    res.json({ success: true });
});

app.patch('/api/admin/users/:id/company-role', authenticateToken, authenticateAdmin, async (req, res) => {
    const { company_role } = req.body;
    if (!['gerente', 'encarregado', 'operador'].includes(company_role)) {
        return res.status(400).json({ error: "Nível de acesso inválido" });
    }
    await pool.query('UPDATE users SET company_role = $1 WHERE id = $2', [company_role, req.params.id]);
    res.json({ success: true });
});

app.patch('/api/admin/users/:id/features', authenticateToken, authenticateAdmin, async (req, res) => {
    const { features } = req.body;
    const jsonStr = JSON.stringify(features || {});
    await pool.query('UPDATE users SET features_override = $1 WHERE id = $2', [jsonStr, req.params.id]);
    res.json({ success: true });
});

// Helper for matching G-code filenames/folders with Kanban card titles
function normalizeStr(str) {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\.(txt|tap|nc|gcode|cnc|dxf)$/i, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchKanbanTitle(jobFileName, jobFolder, cardTitle) {
    const normTitle = normalizeStr(cardTitle);
    if (!normTitle) return false;

    const normFile    = normalizeStr(jobFileName);
    const normFolder  = normalizeStr(jobFolder);
    const fullJobText = `${normFile} ${normFolder}`.trim();

    // 1. Exact match — always valid
    if (normFile && normFile === normTitle) return true;
    if (normFolder && normFolder === normTitle) return true;

    // 2. The job filename fully contains the entire card title string
    if (normFile && normFile.includes(normTitle) && normTitle.length >= 6) return true;
    if (normFolder && normFolder.includes(normTitle) && normTitle.length >= 6) return true;

    // 3. STRICT: ALL meaningful words of the card title must be present in the job text.
    // A generic filename like "mdf 9mm" will NEVER match a specific card title like
    // "chapa 2 MDF 9MM VETOR LOGO TARTARUGA e4mm" because unique words like
    // "vetor", "tartaruga", "reposicao" etc. would be absent from the job filename.
    const titleWords = normTitle.split(' ').filter(w => w.length >= 3);
    if (titleWords.length >= 2) {
        const allTitleWordsInJob = titleWords.every(w => fullJobText.includes(w));
        if (allTitleWordsInJob) {
            // Extra guard: at least 50% of the job's own words must appear in the title
            const jobWords = fullJobText.split(' ').filter(w => w.length >= 3);
            const jobHits  = jobWords.filter(w => normTitle.includes(w)).length;
            if (jobWords.length === 0 || jobHits / jobWords.length >= 0.5) {
                return true;
            }
        }
    }

    return false;
}

async function autoSyncKanban(userId, jobFileName, jobFolder, routerName, targetStatus, operatorName) {
    try {
        const tasks = (await pool.query('SELECT * FROM kanban_tasks WHERE "userId" = $1', [userId])).rows;
        let matched = false;

        for (const task of tasks) {
            if (matchKanbanTitle(jobFileName, jobFolder, task.title)) {
                matched = true;
                if (targetStatus === 'doing') {
                    await pool.query(
                        'UPDATE kanban_tasks SET column_id = $1, machine = COALESCE($2, machine), operator = COALESCE($3, operator) WHERE id = $4 AND "userId" = $5',
                        ['doing', routerName || null, operatorName || null, task.id, userId]
                    );
                    console.log(`[KANBAN AUTO-SYNC] Card "${task.title}" (ID ${task.id}) moved -> DOING (${routerName})`);
                } else if (targetStatus === 'done' && task.column_id === 'doing') {
                    await pool.query(
                        'UPDATE kanban_tasks SET column_id = $1 WHERE id = $2 AND "userId" = $3',
                        ['done', task.id, userId]
                    );
                    console.log(`[KANBAN AUTO-SYNC] Card "${task.title}" (ID ${task.id}) moved DOING -> DONE`);
                }
            }
        }

        if (targetStatus === 'doing') {
            // Mover cartões antigos da mesma máquina de DOING -> DONE ao iniciar um novo serviço
            if (routerName) {
                const previousActiveCards = tasks.filter(t => t.column_id === 'doing' && t.machine && (t.machine.toLowerCase().includes(routerName.toLowerCase()) || routerName.toLowerCase().includes(t.machine.toLowerCase())));
                for (const oldCard of previousActiveCards) {
                    if (!jobFileName || !oldCard.title.toLowerCase().includes(jobFileName.toLowerCase())) {
                        await pool.query('UPDATE kanban_tasks SET column_id = $1 WHERE id = $2 AND "userId" = $3', ['done', oldCard.id, userId]);
                        console.log(`[KANBAN AUTO-SYNC] Cartão antigo "${oldCard.title}" (ID ${oldCard.id}) movido DOING -> DONE em ${routerName}`);
                    }
                }
            }

            // Criar novo cartão Kanban com o nome exato do arquivo se não houver correspondência
            if (!matched && jobFileName && jobFileName !== 'Desconhecido') {
                const todayStr = new Date().toISOString().split('T')[0];
                await pool.query(
                    `INSERT INTO kanban_tasks (title, machine, operator, date, priority, column_id, "userId") 
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [jobFileName, routerName || 'Router CNC', operatorName || 'Operador', todayStr, 'alta', 'doing', userId]
                );
                console.log(`[KANBAN AUTO-CREATE] Cartão O.S. criado: "${jobFileName}" em ${routerName}`);
            }
        } else if (targetStatus === 'done' && routerName) {
            // Ao finalizar o serviço, mover qualquer cartão em DOING desta máquina para DONE
            const activeOnMachine = tasks.filter(t => t.column_id === 'doing' && t.machine && (t.machine.toLowerCase().includes(routerName.toLowerCase()) || routerName.toLowerCase().includes(t.machine.toLowerCase())));
            for (const card of activeOnMachine) {
                await pool.query('UPDATE kanban_tasks SET column_id = $1 WHERE id = $2 AND "userId" = $3', ['done', card.id, userId]);
                console.log(`[KANBAN AUTO-SYNC] Cartão finalizado "${card.title}" (ID ${card.id}) DOING -> DONE em ${routerName}`);
            }
        }
    } catch (err) {
        console.error('[KANBAN AUTO-SYNC ERROR]', err.message);
    }
}

app.post('/api/jobs', authenticateToken, async (req, res) => {
    const { file_name, folder, file_path, start_time, router_name, estimated_minutes } = req.body;
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

    const openJobs = (await pool.query('SELECT id, start_time FROM jobs WHERE "userId" = $1 AND end_time IS NULL AND (router_name = $2 OR router_name ILIKE $3 OR router_name LIKE \'%\\\\%\')', [userId, cleanRouterName || null, `%${cleanRouterName || ''}%`])).rows;
    for (const j of openJobs) {
        const prevStart = new Date(j.start_time);
        if (dt > prevStart) {
            const duration = Math.max(0, (dt - prevStart) / (1000 * 60));
            if (duration < 0.05) await pool.query('DELETE FROM jobs WHERE id = $1', [j.id]);
            else await pool.query('UPDATE jobs SET end_time = $1, duration_minutes = $2 WHERE id = $3', [dt.toISOString(), duration, j.id]);
        } else {
            await pool.query('UPDATE jobs SET end_time = $1, duration_minutes = 0.01 WHERE id = $2', [new Date(prevStart.getTime() + 1000).toISOString(), j.id]);
        }
    }

    // Auto-fetch operator assigned to this router if not specified
    let operatorName = req.body.operator_name || null;
    if (!operatorName && router_name) {
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
    const initialQty = req.body.quantity ? parseInt(req.body.quantity) : 1;

    const result = await pool.query('INSERT INTO jobs (file_name, folder, file_path, start_time, day, month, year, "userId", router_name, estimated_minutes, material_id, material_name, material_price, operator_name, max_x, max_y, bounding_area_m2, quantity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING id', 
        [cleanFileName, cleanFolder, file_path || 'Desconhecido', dt.toISOString(), dt.getDate(), dt.getMonth() + 1, dt.getFullYear(), userId, router_name || null, estMin, req.body.material_id || null, req.body.material_name || null, req.body.material_price || null, operatorName, maxX, maxY, boundArea, initialQty]);
    
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
                // 1. Close open logs for this operator
                const openLogs = (await pool.query(
                    'SELECT * FROM operator_time_logs WHERE operator_id = $1 AND "userId" = $2 AND end_time IS NULL ORDER BY start_time DESC',
                    [opRes.id, userId]
                )).rows;

                for (const log of openLogs) {
                    const startLogDt = new Date(log.start_time);
                    const durMin = Math.max(0.1, (dt - startLogDt) / 60000);
                    await pool.query(
                        'UPDATE operator_time_logs SET end_time = $1, duration_minutes = $2 WHERE id = $3',
                        [dt.toISOString(), parseFloat(durMin.toFixed(2)), log.id]
                    );
                }

                // 2. Open a NEW card for this cutting activity
                const machineLoc = router_name ? `⚙️ ${router_name}` : 'Na Máquina';
                await pool.query(
                    `INSERT INTO operator_time_logs (
                        "userId", operator_id, operator_name, status, location, kanban_title, start_time
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        userId,
                        opRes.id,
                        opRes.name,
                        'disponivel',
                        machineLoc,
                        cleanFileName,
                        dt.toISOString()
                    ]
                );

                await pool.query(
                    `UPDATE operators SET location = $1 WHERE id = $2 AND "userId" = $3`,
                    [machineLoc, opRes.id, userId]
                );
            }
        } catch (opErr) {
            console.error('Erro ao criar novo card no timeline do operador:', opErr);
        }
    }

    res.json({ id: result.rows[0].id, success: true });
});

app.patch('/api/jobs/latest', authenticateToken, async (req, res) => {
    const { end_time, router_name } = req.body;
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
         AND start_time <= $5 
         ORDER BY start_time DESC LIMIT 1`,
        [userId, router_name || null, `%${cleanName}%`, isLaser, dt.toISOString()]
    )).rows[0];
    if (!row) return res.status(404).json({ error: "No open jobs found" });

    const startDt = new Date(row.start_time);
    const durationMinutes = (dt - startDt) / (1000 * 60);

    if (durationMinutes < 0.05) {
        await pool.query('DELETE FROM jobs WHERE id = $1', [row.id]);
        return res.json({ id: row.id, deleted: true });
    }

    await pool.query('UPDATE jobs SET end_time = $1, duration_minutes = $2 WHERE id = $3', [dt.toISOString(), durationMinutes, row.id]);
    
    // Auto-sync Kanban card: doing/todo -> done
    autoSyncKanban(userId, row.file_name, row.folder, router_name, 'done');

    // Close operator's machine cutting time log and open new 'Na Fábrica' card
    if (row.operator_name) {
        try {
            const opRes = (await pool.query(
                'SELECT id, name FROM operators WHERE LOWER(name) = LOWER($1) AND "userId" = $2 LIMIT 1',
                [row.operator_name.trim(), userId]
            )).rows[0];

            if (opRes) {
                const openLogs = (await pool.query(
                    'SELECT * FROM operator_time_logs WHERE operator_id = $1 AND "userId" = $2 AND end_time IS NULL ORDER BY start_time DESC',
                    [opRes.id, userId]
                )).rows;

                for (const log of openLogs) {
                    const startLogDt = new Date(log.start_time);
                    const durMin = Math.max(0.1, (dt - startLogDt) / 60000);
                    await pool.query(
                        'UPDATE operator_time_logs SET end_time = $1, duration_minutes = $2 WHERE id = $3',
                        [dt.toISOString(), parseFloat(durMin.toFixed(2)), log.id]
                    );
                }

                // Create a new 'Na Fábrica' card starting at completion time
                await pool.query(
                    `INSERT INTO operator_time_logs (
                        "userId", operator_id, operator_name, status, location, start_time
                    ) VALUES ($1, $2, $3, $4, $5, $6)`,
                    [userId, opRes.id, opRes.name, 'disponivel', 'Na Fábrica', dt.toISOString()]
                );

                await pool.query(
                    `UPDATE operators SET location = $1 WHERE id = $2 AND "userId" = $3 AND status = 'disponivel'`,
                    ['Na Fábrica', opRes.id, userId]
                );
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

    res.json({ id: row.id, duration_minutes: durationMinutes, success: true });
});

app.get('/api/jobs', authenticateToken, async (req, res) => {
    await closeStaleJobs(req.user.id);
    const jobs = (await pool.query('SELECT * FROM jobs WHERE "userId" = $1 ORDER BY id DESC', [req.user.id])).rows;
    res.json(jobs);
});

app.patch('/api/jobs/:id', authenticateToken, async (req, res) => {
    const { material_id, material_name, material_price, folder, file_name, start_time, end_time, estimated_minutes, max_x, max_y, bounding_area_m2, operator_name } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;

    if (material_id !== undefined) { fields.push(`material_id = $${idx++}`); values.push(material_id); }
    if (material_name !== undefined) { fields.push(`material_name = $${idx++}`); values.push(material_name); }
    if (material_price !== undefined) { fields.push(`material_price = $${idx++}`); values.push(material_price); }
    if (folder !== undefined) { fields.push(`folder = $${idx++}`); values.push(folder); }
    if (file_name !== undefined) { fields.push(`file_name = $${idx++}`); values.push(file_name); }
    if (start_time !== undefined) { fields.push(`start_time = $${idx++}`); values.push(start_time); }
    if (end_time !== undefined) { fields.push(`end_time = $${idx++}`); values.push(end_time); }
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
        if (operator_name !== undefined && updatedJob) {
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

app.delete('/api/jobs/:id', authenticateToken, async (req, res) => {
    const result = await pool.query('DELETE FROM jobs WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
    if (result.rowCount > 0) res.json({ success: true });
    else res.status(404).json({ error: "Job not found" });
});

app.get('/api/materials', authenticateToken, async (req, res) => {
    const mats = (await pool.query('SELECT * FROM materials WHERE "userId" = $1 ORDER BY id DESC', [req.user.id])).rows;
    res.json(mats);
});

app.post('/api/materials', authenticateToken, async (req, res) => {
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

app.patch('/api/materials/:id', authenticateToken, async (req, res) => {
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

app.delete('/api/materials/:id', authenticateToken, async (req, res) => {
    const result = await pool.query('DELETE FROM materials WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
    if (result.rowCount > 0) res.json({ success: true });
    else res.status(404).json({ error: "Material não encontrado" });
});

app.get('/api/stats', authenticateToken, async (req, res) => {
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

// ─────────────────────────────────────────────
// 💳 PAYMENT ROUTES - MERCADO PAGO
// ─────────────────────────────────────────────

const PLANS = {
    starter:  { name: 'MACH3 Tracker STARTER',   price: 59.90, maxRouters: 1 },
    pro:      { name: 'MACH3 Tracker PRO',      price: 149.90, maxRouters: 3 },
    business: { name: 'MACH3 Tracker BUSINESS',  price: 349.90, maxRouters: 999 }
};

// POST /api/payments/create-preference
// Creates a Mercado Pago checkout preference and returns the init_point URL
app.post('/api/payments/create-preference', authenticateToken, async (req, res) => {
    try {
        const { planType } = req.body;
        const plan = PLANS[planType];
        if (!plan) return res.status(400).json({ error: 'Plano inválido. Use: starter, pro ou business' });

        const preference = new Preference(mpClient);
        const backUrl = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;

        const result = await preference.create({
            body: {
                items: [{
                    title: plan.name,
                    unit_price: plan.price,
                    quantity: 1,
                    currency_id: 'BRL'
                }],
                back_urls: {
                    success: `${backUrl}/payment/success`,
                    failure: `${backUrl}/payment/failure`,
                    pending: `${backUrl}/payment/pending`
                },
                auto_return: 'approved',
                notification_url: `${backUrl}/api/payments/webhook`,
                metadata: {
                    userId: req.user.id,
                    planType
                },
                statement_descriptor: 'MACH3 TRACKER'
            }
        });

        // Save pending payment record
        await pool.query(
            'INSERT INTO payments ("userId", mp_preference_id, plan, status, amount) VALUES ($1, $2, $3, $4, $5)',
            [req.user.id, result.id, planType, 'pending', plan.price]
        );

        res.json({ 
            init_point: result.init_point,
            preference_id: result.id
        });
    } catch (err) {
        console.error('[PAYMENT] create-preference error:', err);
        res.status(500).json({ error: 'Erro ao criar preferência de pagamento: ' + err.message });
    }
});

// POST /api/payments/webhook
// Receives Mercado Pago IPN notifications and updates plan on approval
app.post('/api/payments/webhook', async (req, res) => {
    try {
        const { type, data } = req.body;
        if (type !== 'payment') return res.sendStatus(200);

        const paymentId = data?.id;
        if (!paymentId) return res.sendStatus(200);

        const mpPayment = new Payment(mpClient);
        const paymentData = await mpPayment.get({ id: paymentId });

        const status = paymentData.status;
        const metadata = paymentData.metadata || {};
        const userId = metadata.user_id || metadata.userId;
        const planType = metadata.plan_type || metadata.planType;

        if (!userId || !planType) {
            console.warn('[WEBHOOK] Missing metadata: userId or planType', metadata);
            return res.sendStatus(200);
        }

        console.log(`[WEBHOOK] Payment ${paymentId} status=${status} userId=${userId} plan=${planType}`);

        // Update payment record
        await pool.query(
            'UPDATE payments SET mp_payment_id=$1, status=$2, updated_at=NOW() WHERE mp_preference_id IS NOT NULL AND "userId"=$3 AND plan=$4 AND status=\'pending\'',
            [String(paymentId), status, userId, planType]
        );

        if (status === 'approved') {
            // Calculate trial_expiry: 30 days from now
            const expiry = new Date();
            expiry.setDate(expiry.getDate() + 30);

            await pool.query(
                'UPDATE users SET plan=$1, payment_status=$2, trial_expiry=$3 WHERE id=$4',
                [planType, 'active', expiry.toISOString(), userId]
            );

            console.log(`[WEBHOOK] ✅ User ${userId} upgraded to ${planType} plan!`);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error('[WEBHOOK] Error processing payment:', err);
        res.sendStatus(500);
    }
});

// GET /api/payments/status
// Returns the current plan and last payment info for the authenticated user
app.get('/api/payments/status', authenticateToken, async (req, res) => {
    try {
        const user = (await pool.query(
            'SELECT id, email, plan, payment_status, trial_expiry FROM users WHERE id=$1',
            [req.user.id]
        )).rows[0];

        const lastPayment = (await pool.query(
            'SELECT * FROM payments WHERE "userId"=$1 ORDER BY created_at DESC LIMIT 1',
            [req.user.id]
        )).rows[0];

        res.json({ 
            plan: user.plan || 'starter', 
            payment_status: user.payment_status || 'none',
            trial_expiry: user.trial_expiry,
            last_payment: lastPayment || null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Kanban API
app.get('/api/kanban', authenticateToken, async (req, res) => {
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

app.post('/api/kanban', authenticateToken, async (req, res) => {
    const { title, machine, operator, date, priority, column_id, estimated_minutes } = req.body;
    const estMin = estimated_minutes ? parseFloat(estimated_minutes) : null;
    try {
        const r = await pool.query(
            'INSERT INTO kanban_tasks (title, machine, operator, date, priority, column_id, "userId", estimated_minutes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [title, machine || null, operator || null, date || null, priority || 'media', column_id || 'todo', req.user.id, estMin]
        );
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/kanban/:id', authenticateToken, async (req, res) => {
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
                 estimated_minutes = COALESCE($10, estimated_minutes)
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

app.post('/api/kanban/:id/reschedule', authenticateToken, async (req, res) => {
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
                 column_id = 'todo' 
             WHERE id = $4 AND "userId" = $5 RETURNING *`,
            [dateVal, reason.trim(), newCount, req.params.id, req.user.id]
        );

        res.json(updated.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/kanban/:id', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query('DELETE FROM kanban_tasks WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
        if (r.rowCount === 0) return res.status(404).json({ error: "Tarefa não encontrada." });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/kanban/batch', authenticateToken, async (req, res) => {
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

// Checklists API
app.get('/api/checklists', authenticateToken, async (req, res) => {
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

app.post('/api/checklists/toggle', authenticateToken, async (req, res) => {
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

app.post('/api/checklists/clear', authenticateToken, async (req, res) => {
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

const SEED_CHECKLIST_ITEMS = {
    router: [
        '[Operador] Verificar fixação e nivelamento do material na mesa (vácuo ou garras)',
        '[Operador] Inspecionar desgaste da fresa — fresas cegas causam rebarba e vibração',
        '[Operador] Efetuar referenciamento nos três eixos (Zero XY e Z-Probe)',
        '[Operador] Ligar exaustor/coletor de pó antes do início da usinagem',
        '[Operador] Limpar e lubrificar cremalheiras e fusos de esferas com óleo recomendado',
        '[Encarregado] 👔 AUDITORIA: Conferir espessura real do lote de chapas com paquímetro antes de liberar a usinagem',
        '[Encarregado] 👔 SEGURANÇA: Auditar uso obrigatório de óculos de proteção, protetor auricular e calçado fechado do operador',
        '[Encarregado] 👔 VALIDAÇÃO: Conferir se o diâmetro e tipo da fresa instalada confere exatamente com a O.S.',
        '[Encarregado] 👔 VÁCUO: Verificar manômetro da bomba de vácuo (Mínimo -0.7 a -0.8 bar) para retenção total da chapa',
        '[Encarregado] 👔 LIBERAÇÃO: Inspecionar dimensões X/Y e esquadro da 1ª peça cortada antes de autorizar lote'
    ],
    router1: [
        '[Operador] Nível de óleo do Spindle e lubrificação das guias lineares',
        '[Operador] Limpeza das calhas, mesa de alumínio e duto de sucção de cavacos',
        '[Operador] Pressão do ar comprimido da linha (Mínimo 6 bar / 87 PSI)',
        '[Operador] Verificação e aperto do porta-ferramentas / pinça ER32',
        '[Operador] Teste do botão de parada de emergência do painel',
        '[Operador] Conferência do ponto de zero peça (X0, Y0, Z0)',
        '[Encarregado] 👔 AUDITORIA: Conferir espessura real do lote de chapas com paquímetro antes de liberar a usinagem',
        '[Encarregado] 👔 SEGURANÇA: Auditar uso de EPIs e organização da bancada de trabalho',
        '[Encarregado] 👔 LIBERAÇÃO: Inspecionar dimensões X/Y e acabamento da 1ª peça cortada'
    ],
    router2: [
        '[Operador] Inspeção do nível de água do reservatório / Chiller do Spindle',
        '[Operador] Verificação visual de folga e sujeira nos eixos X, Y e Z',
        '[Operador] Limpeza geral da caixa de resíduos e exaustor',
        '[Operador] Verificação de funcionamento dos sensores de fim de curso (homing)',
        '[Operador] Checagem do estado físico da fresa instalada',
        '[Encarregado] 👔 AUDITORIA: Conferir alinhamento da mesa e fixação da chapa',
        '[Encarregado] 👔 LIBERAÇÃO: Validar parâmetros de corte da O.S. (Feed rate & Spindle RPM)'
    ],
    laser: [
        '[Operador] Limpar a lente focal e espelhos defletores (álcool isopropílico + lenço óptico)',
        '[Operador] Verificar temperatura do Chiller — ideal entre 18°C e 22°C',
        '[Operador] Ligar exaustor e testar sucção da colmeia/mesa de corte',
        '[Operador] Testar fluxo do gás de assistência (Air Assist) antes de iniciar',
        '[Operador] Inspecionar trilhos lineares quanto a acúmulo de fuligem e resíduos',
        '[Encarregado] 👔 ANTI-INCÊNDIO: Checar extintor de incêndio CO2/Pó Químico carregado e desobstruído ao lado do laser',
        '[Encarregado] 👔 ALINHAMENTO: Realizar teste de pulso (Beam Alignment) nos 4 cantos da mesa para focar potência do tubo',
        '[Encarregado] 👔 TRIAGEM: Auditar lote de material liberado garantindo que NENHUM plástico tóxico (ex: PVC) vá para o laser',
        '[Encarregado] 👔 REFRIGERAÇÃO: Testar sensor de travamento automático do Chiller e conferir nível de água desmineralizada',
        '[Encarregado] 👔 QUALIDADE: Validar transparência do canto da 1ª peça cortada (sem ranhuras ou queima)'
    ],
    vacuo: [
        '[Operador] Inspecionar borrachas de vedação da moldura de aperto (evita perda de sucção)',
        '[Operador] Ligar resistências e verificar aquecimento uniforme da chapa plástica',
        '[Operador] Confirmar nível de óleo da bomba de vácuo (visor de nível)',
        '[Operador] Limpar moldes de resina/MDF, retirando rebarbas e poeiras do ciclo anterior',
        '[Encarregado] 👔 GABARITO & MOLDE: Verificar se o molde possui ângulos de saída suficientes (draft angle) e alívio de ar',
        '[Encarregado] 👔 PULMÃO DE VÁCUO: Checar pressão negativa acumulada no reservatório para sucção de impacto perfeita',
        '[Encarregado] 👔 TEMPERATURA & TEMPO: Auditar pirômetro infravermelho e tempo de forno para o polímero (PSAI/PETG/ABS)',
        '[Encarregado] 👔 PROTEÇÃO PNEUMÁTICA: Validar funcionamento do acionamento bimanual e travas de segurança da mesa pneumática',
        '[Encarregado] 👔 INSPEÇÃO DE ESTICAMENTO: Inspecionar 1ª peça moldada garantindo que não haja afinamento crítico nem bolhas'
    ],
    impressao3d: [
        '[Operador] Verificar nivelamento da mesa de impressão (Bed Leveling manual ou automático)',
        '[Operador] Limpar a mesa com álcool isopropílico para adesão correta da primeira camada',
        '[Operador] Inspecionar bico (nozzle) por resíduos e entupimentos de filamento queimado',
        '[Operador] Confirmar que os filamentos estão armazenados em ambiente seco (caixa selada ou estufa)',
        '[Encarregado] 👔 FATIAMENTO & INFILL: Validar no arquivo fatiado a densidade de preenchimento (Infill %) e suportes da O.S.',
        '[Encarregado] 👔 DESUMIDIFICAÇÃO: Auditar se os carretéis de filamento (PLA/PETG/ABS) estão no desumidificador com sílica',
        '[Encarregado] 👔 PRIMEIRA CAMADA: Inspecionar a adesão e o Z-Offset da 1ª camada antes de liberar para execução longa',
        '[Encarregado] 👔 LAVAGEM E CURA (SLA): Auditar tempos de banho de IPA e câmara de cura UV para peças em resina'
    ],
    encarregado_geral: [
        '[Encarregado] 👔 PRESENÇA DA EQUIPE: Auditar no sistema se todos os operadores estão com status correto (Na Fábrica, Almoço, Externo, Limpeza)',
        '[Encarregado] 👔 COMPRESSOR DE AR: Drenar purgadores de água condensada dos compressores e conferir pressão da linha (6 a 8 bar)',
        '[Encarregado] 👔 SEGURANÇA 5S: Realizar ronda nas bancadas garantindo corredores limpos, saídas livres e ferramentas organizadas',
        '[Encarregado] 👔 QUADRO KANBAN: Auditar Ordens de Serviço prioritárias do dia e resolver gargalos/bloqueios com a produção',
        '[Encarregado] 👔 QUADRO ELÉTRICO: Checar temperatura e ausência de aquecimento nos disjuntores e nobreaks das CNCs',
        '[Encarregado] 👔 REUSO DE MATÉRIA-PRIMA: Inspecionar área de descarte e garantir reaproveitamento inteligente de sobras de chapas'
    ],
    geral: [
        '[Operador] Uso obrigatório de EPIs (Óculos de proteção, protetor auricular e calçado)',
        '[Operador] Conferência da lista de Ordens de Serviço (O.S.) prioritárias do dia',
        '[Operador] Organização da área de estoque de materiais (chapas MDF, ACM e Isopor)',
        '[Operador] Descarte correto de retalhos e limpeza da bancada ao final do turno',
        '[Encarregado] 👔 AUDITORIA DE SEGURANÇA: Passagem geral de segurança e liberação do turno'
    ],
    qualidade: [
        '[Operador] Medição dimensional da primeira peça cortada com paquímetro',
        '[Operador] Verificação de rebarbas nos cantos inferiores do material',
        '[Operador] Inspeção visual da superfície de acabamento e riscos',
        '[Encarregado] 👔 LAUDO DE QUALIDADE: Assinatura de conformidade do lote de produção'
    ]
};

// Custom Checklist Items API
app.get('/api/checklists/items', authenticateToken, async (req, res) => {
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

app.post('/api/checklists/items', authenticateToken, async (req, res) => {
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

app.delete('/api/checklists/items/:id', authenticateToken, async (req, res) => {
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

app.patch('/api/checklists/items/:id', authenticateToken, async (req, res) => {
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
app.get('/api/operators', authenticateToken, async (req, res) => {
    try {
        const ops = (await pool.query('SELECT * FROM operators WHERE "userId" = $1 ORDER BY name ASC', [req.user.id])).rows;
        res.json(ops);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/operators', authenticateToken, async (req, res) => {
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

app.delete('/api/operators/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM operators WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/operators/:id/status', authenticateToken, async (req, res) => {
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

app.get('/api/operators/time-logs', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { date } = req.query;

        // Auto-reconcile: If an operator has an active cutting job, but their open log is 'Na Fábrica' or started before the job, split into a new card!
        const openLogs = (await pool.query(
            'SELECT * FROM operator_time_logs WHERE "userId" = $1 AND end_time IS NULL AND status = \'disponivel\'',
            [userId]
        )).rows;

        for (const log of openLogs) {
            const opName = log.operator_name;
            if (!opName) continue;

            const activeJob = (await pool.query(
                `SELECT * FROM jobs 
                 WHERE "userId" = $1 
                 AND LOWER(operator_name) = LOWER($2) 
                 AND end_time IS NULL 
                 ORDER BY id DESC LIMIT 1`,
                [userId, opName]
            )).rows[0];

            if (activeJob) {
                const jobStart = new Date(activeJob.start_time);
                const logStart = new Date(log.start_time);

                // If the open log started BEFORE the job started (or has different file name):
                if (log.kanban_title !== activeJob.file_name && jobStart > logStart) {
                    // Close open log at jobStart time
                    const durMin = Math.max(0.1, (jobStart - logStart) / 60000);
                    await pool.query(
                        'UPDATE operator_time_logs SET end_time = $1, duration_minutes = $2 WHERE id = $3',
                        [jobStart.toISOString(), parseFloat(durMin.toFixed(2)), log.id]
                    );

                    // Insert NEW log card starting at jobStart time
                    const machineLoc = activeJob.router_name ? `⚙️ ${activeJob.router_name}` : 'Na Máquina';
                    await pool.query(
                        `INSERT INTO operator_time_logs (
                            "userId", operator_id, operator_name, status, location, kanban_title, start_time
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [userId, log.operator_id, opName, 'disponivel', machineLoc, activeJob.file_name, jobStart.toISOString()]
                    );

                    await pool.query(
                        `UPDATE operators SET location = $1 WHERE id = $2 AND "userId" = $3`,
                        [machineLoc, log.operator_id, userId]
                    );
                } else if (!log.kanban_title || log.location === 'Na Fábrica') {
                    // Just update location and title if timestamps match
                    const machineLoc = activeJob.router_name ? `⚙️ ${activeJob.router_name}` : 'Na Máquina';
                    await pool.query(
                        `UPDATE operator_time_logs SET location = $1, kanban_title = $2 WHERE id = $3`,
                        [machineLoc, activeJob.file_name, log.id]
                    );
                }
            }
        }

        let query = 'SELECT * FROM operator_time_logs WHERE "userId" = $1';
        const params = [userId];

        if (date) {
            query += ' AND DATE(start_time) = DATE($2)';
            params.push(date);
        }
        query += ' ORDER BY start_time DESC';

        const logs = (await pool.query(query, params)).rows;
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/operators/time-logs/:logId', authenticateToken, async (req, res) => {
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

app.patch('/api/routers/:id/operator', authenticateToken, async (req, res) => {
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

// Kanban Archive API
app.post('/api/kanban/archive', authenticateToken, async (req, res) => {
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

app.get('/api/kanban/archive', authenticateToken, async (req, res) => {
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

// Stock Items API
app.get('/api/stock', authenticateToken, async (req, res) => {
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

app.post('/api/stock', authenticateToken, async (req, res) => {
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

app.patch('/api/stock/:id', authenticateToken, async (req, res) => {
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

app.delete('/api/stock/:id', authenticateToken, async (req, res) => {
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
app.get('/api/kaizens', authenticateToken, async (req, res) => {
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

app.post('/api/kaizens', authenticateToken, async (req, res) => {
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

app.patch('/api/kaizens/:id', authenticateToken, async (req, res) => {
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

app.delete('/api/kaizens/:id', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query('DELETE FROM kaizens WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
        if (r.rowCount === 0) return res.status(404).json({ error: "Kaizen não encontrado." });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Occurrences API
app.get('/api/occurrences', authenticateToken, async (req, res) => {
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

app.post('/api/occurrences', authenticateToken, async (req, res) => {
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

app.patch('/api/occurrences/:id', authenticateToken, async (req, res) => {
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

app.delete('/api/occurrences/:id', authenticateToken, async (req, res) => {
    try {
        const r = await pool.query('DELETE FROM occurrences WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
        if (r.rowCount === 0) return res.status(404).json({ error: "Ocorrência não encontrada." });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Catch-all: Route all other non-API requests to the React SPA
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Premium Server (PostgreSQL) running on port ${port}`);
});
