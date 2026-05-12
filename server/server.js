const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { Pool } = require('pg');

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
app.use(express.static(path.join(__dirname, 'public')));

// Database setup using PostgreSQL (Supabase)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Helper to close stale jobs (> 12 hours)
async function closeStaleJobs(userId) {
    try {
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const staleJobs = (await pool.query('SELECT id, start_time FROM jobs WHERE "userId" = $1 AND end_time IS NULL AND start_time < $2', [userId, twelveHoursAgo])).rows;

        for (const job of staleJobs) {
            const start = new Date(job.start_time);
            const end = new Date(start.getTime() + 10 * 60 * 1000).toISOString();
            await pool.query('UPDATE jobs SET end_time = $1, duration_minutes = 10 WHERE id = $2', [end, job.id]);
            console.log(`[CLEANUP] Locked stale job #${job.id} (stuck for > 12h)`);
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
                estimated_minutes REAL
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
        
        console.log("Banco de dados PostgreSQL inicializado com sucesso.");
        runMaintenance();
        setInterval(runMaintenance, 24 * 60 * 60 * 1000);
    } catch (e) {
        console.error("Erro ao inicializar banco de dados:", e);
    }
}

initDb();

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

function authenticateAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: "Access denied: Admins only" });
    }
    next();
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
    const { email, password } = req.body;
    const user = (await pool.query('SELECT * FROM users WHERE email = $1', [email])).rows[0];
    if (!user) return res.status(400).json({ error: "Usuário não encontrado" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Senha inválida" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, email: user.email, plan: user.plan, role: user.role } });
});

app.get('/api/user/me', authenticateToken, async (req, res) => {
    await closeStaleJobs(req.user.id);
    let user = (await pool.query('SELECT id, email, plan, trial_expiry, payment_status, "costPerHour", "plannedHours", role FROM users WHERE id = $1', [req.user.id])).rows[0];
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const masterEmails = ['tomasdifebbo.tdf@gmail.com', 'admin@mach3.com', 'casadotrem@gmail.com'];
    if (masterEmails.includes(user.email) && user.role !== 'admin') {
        await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
        user.role = 'admin';
    }

    const settings = { costPerHour: user.costPerHour, plannedHours: user.plannedHours };
    res.json({ ...user, settings });
});

app.patch('/api/user/settings', authenticateToken, async (req, res) => {
    const { costPerHour, plannedHours } = req.body;
    let cost = Number(costPerHour);
    let planned = Number(plannedHours);
    if (isNaN(cost) || isNaN(planned)) return res.status(400).json({ error: "Valores inválidos" });

    await pool.query('UPDATE users SET "costPerHour" = $1, "plannedHours" = $2 WHERE id = $3', [cost, planned, req.user.id]);
    const user = (await pool.query('SELECT id, email, plan, "costPerHour", "plannedHours", role FROM users WHERE id = $1', [req.user.id])).rows[0];
    res.json({ success: true, user: { ...user, settings: { costPerHour: user.costPerHour, plannedHours: user.plannedHours } } });
});

app.get('/api/admin/users', authenticateToken, authenticateAdmin, async (req, res) => {
    const users = (await pool.query('SELECT id, email, plan, payment_status, trial_expiry, role FROM users ORDER BY id DESC')).rows;
    res.json(users);
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

app.post('/api/jobs', authenticateToken, async (req, res) => {
    const { file_name, folder, file_path, start_time, router_name, estimated_minutes } = req.body;
    const userId = req.user.id;
    let dt = start_time ? new Date(start_time) : new Date();
    let cleanFolder = folder || 'Desconhecido';
    let cleanFileName = file_name || 'Desconhecido';
    const DEBOUNCE_SECONDS = 2;

    if (cleanFileName.includes('\\') || cleanFileName.includes('/')) {
        const pathParts = cleanFileName.replace(/\\/g, '/').split('/').filter(p => p.length > 0);
        if (pathParts.length > 0) cleanFileName = pathParts[pathParts.length - 1];
    }
    if (cleanFolder && cleanFolder.includes(' | ')) cleanFolder = cleanFolder.split(' | ').pop();

    const lastJob = (await pool.query('SELECT start_time, end_time FROM jobs WHERE "userId" = $1 AND router_name = $2 ORDER BY id DESC LIMIT 1', [userId, router_name || null])).rows[0];
    if (lastJob) {
        const lastEventTime = new Date(lastJob.end_time || lastJob.start_time);
        const diffSeconds = (dt - lastEventTime) / 1000;
        if (diffSeconds >= 0 && diffSeconds < DEBOUNCE_SECONDS) {
            return res.json({ id: null, success: true, debounced: true });
        }
    }

    const openJobs = (await pool.query('SELECT id, start_time FROM jobs WHERE "userId" = $1 AND end_time IS NULL AND router_name = $2', [userId, router_name || null])).rows;
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

    const estMin = estimated_minutes ? parseFloat(estimated_minutes) : null;
    const result = await pool.query('INSERT INTO jobs (file_name, folder, file_path, start_time, day, month, year, "userId", router_name, estimated_minutes, material_id, material_name, material_price) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id', 
        [cleanFileName, cleanFolder, file_path || 'Desconhecido', dt.toISOString(), dt.getDate(), dt.getMonth() + 1, dt.getFullYear(), userId, router_name || null, estMin, req.body.material_id || null, req.body.material_name || null, req.body.material_price || null]);
    
    res.json({ id: result.rows[0].id, success: true });
});

app.patch('/api/jobs/latest', authenticateToken, async (req, res) => {
    const { end_time, router_name } = req.body;
    const userId = req.user.id;
    const dt = end_time ? new Date(end_time) : new Date();

    const row = (await pool.query('SELECT * FROM jobs WHERE "userId" = $1 AND end_time IS NULL AND router_name = $2 AND start_time <= $3 ORDER BY start_time DESC LIMIT 1', [userId, router_name || null, dt.toISOString()])).rows[0];
    if (!row) return res.status(404).json({ error: "No open jobs found" });

    const startDt = new Date(row.start_time);
    const durationMinutes = (dt - startDt) / (1000 * 60);

    if (durationMinutes < 0.05) {
        await pool.query('DELETE FROM jobs WHERE id = $1', [row.id]);
        return res.json({ id: row.id, deleted: true });
    }

    await pool.query('UPDATE jobs SET end_time = $1, duration_minutes = $2 WHERE id = $3', [dt.toISOString(), durationMinutes, row.id]);
    res.json({ id: row.id, duration_minutes: durationMinutes, success: true });
});

app.get('/api/jobs', authenticateToken, async (req, res) => {
    await closeStaleJobs(req.user.id);
    const jobs = (await pool.query('SELECT * FROM jobs WHERE "userId" = $1 ORDER BY id DESC', [req.user.id])).rows;
    res.json(jobs);
});

app.patch('/api/jobs/:id', authenticateToken, async (req, res) => {
    const { material_id, material_name, material_price, folder, file_name, start_time, end_time } = req.body;
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

    if (fields.length === 0) return res.status(400).json({ error: "No fields to update" });
    values.push(req.params.id, req.user.id);
    const result = await pool.query(`UPDATE jobs SET ${fields.join(', ')} WHERE id = $${idx++} AND "userId" = $${idx++}`, values);
    if (result.rowCount > 0) res.json({ success: true });
    else res.status(404).json({ error: "Job not found" });
});

app.delete('/api/jobs/:id', authenticateToken, async (req, res) => {
    const result = await pool.query('DELETE FROM jobs WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
    if (result.rowCount > 0) res.json({ success: true });
    else res.status(404).json({ error: "Job not found" });
});

app.get('/api/materials', authenticateToken, async (req, res) => {
    const mats = (await pool.query('SELECT * FROM materials WHERE "userId" = $1', [req.user.id])).rows;
    res.json(mats);
});

app.post('/api/materials', authenticateToken, async (req, res) => {
    const { name, price } = req.body;
    const result = await pool.query('INSERT INTO materials (name, price, "userId") VALUES ($1, $2, $3) RETURNING id', [name, parseFloat(price), req.user.id]);
    res.json({ success: true, material: { id: result.rows[0].id, name, price, userId: req.user.id } });
});

app.delete('/api/materials/:id', authenticateToken, async (req, res) => {
    const result = await pool.query('DELETE FROM materials WHERE id = $1 AND "userId" = $2', [req.params.id, req.user.id]);
    if (result.rowCount > 0) res.json({ success: true });
    else res.status(404).json({ error: "Material not found" });
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

app.listen(port, '0.0.0.0', () => {
    console.log(`Premium Server (PostgreSQL) running on port ${port}`);
});
