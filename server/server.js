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
                estimated_minutes REAL
            );
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

            -- Alter materials table for m² linear feed rate and pass width calculation
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS feed_rate REAL DEFAULT 3000;
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS pass_width REAL DEFAULT 100;

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

            CREATE TABLE IF NOT EXISTS checklists (
                id SERIAL PRIMARY KEY,
                machine_key TEXT NOT NULL,
                item_index INTEGER NOT NULL,
                done BOOLEAN NOT NULL DEFAULT FALSE,
                date TEXT NOT NULL,
                "userId" INTEGER,
                UNIQUE(machine_key, item_index, date, "userId")
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
                await pool.query('INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3)', ['Router 1', 'active', masterUser.id]);
                await pool.query('INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3)', ['Router 2', 'maintenance', masterUser.id]);
            }
        }
        
        // SEED ROUTER STATUS LOG
        const logRes = await pool.query('SELECT count(*) as count FROM router_status_log');
        if (parseInt(logRes.rows[0].count) === 0) {
            console.log("[SEED] Populando histórico de status inicial...");
            const allRouters = (await pool.query('SELECT * FROM routers')).rows;
            for (const r of allRouters) {
                await pool.query('INSERT INTO router_status_log (router_id, router_name, status, "userId") VALUES ($1, $2, $3, $4)', [r.id, r.name, r.status, r.userId]);
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

// ===== ROUTERS STATUS =====
app.get('/api/routers', authenticateToken, async (req, res) => {
    try {
        const routers = (await pool.query('SELECT * FROM routers WHERE "userId" = $1 ORDER BY id ASC', [req.user.id])).rows;
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

app.get('/api/user/me', authenticateToken, async (req, res) => {
    await closeStaleJobs(req.user.id);
    let user = (await pool.query('SELECT id, email, plan, trial_expiry, payment_status, "costPerHour", "plannedHours", role, webhook_url FROM users WHERE id = $1', [req.user.id])).rows[0];
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const masterEmails = ['tomasdifebbo.tdf@gmail.com', 'admin@mach3.com', 'casadotrem@gmail.com'];
    if (masterEmails.includes(user.email) && user.role !== 'admin') {
        await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [user.id]);
        user.role = 'admin';
    }

    const settings = { costPerHour: user.costPerHour, plannedHours: user.plannedHours, webhookUrl: user.webhook_url };
    res.json({ ...user, settings });
});

app.patch('/api/user/settings', authenticateToken, async (req, res) => {
    const { costPerHour, plannedHours, webhookUrl } = req.body;
    let cost = Number(costPerHour);
    let planned = Number(plannedHours);
    if (isNaN(cost) || isNaN(planned)) return res.status(400).json({ error: "Valores inválidos" });

    await pool.query('UPDATE users SET "costPerHour" = $1, "plannedHours" = $2, webhook_url = $3 WHERE id = $4', [cost, planned, webhookUrl || null, req.user.id]);
    res.json({ success: true });
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

    const normFile   = normalizeStr(jobFileName);
    const normFolder = normalizeStr(jobFolder);

    // 1. Exact match — always valid
    if (normFile && normFile === normTitle) return true;
    if (normFolder && normFolder === normTitle) return true;

    // 2. The file/folder fully contains the card title
    if (normFile && normFile.includes(normTitle) && normTitle.length >= 6) return true;
    if (normFolder && normFolder.includes(normTitle) && normTitle.length >= 6) return true;

    // 3. Jaccard-style bidirectional word similarity
    // Both directions must have >= 60% coverage to avoid false positives
    // from generic filenames like "mdf 9mm" matching a longer, specific card title.
    const titleWords  = normTitle.split(' ').filter(w => w.length >= 3);
    const fileWords   = normFile   ? normFile.split(' ').filter(w => w.length >= 3)   : [];
    const folderWords = normFolder ? normFolder.split(' ').filter(w => w.length >= 3) : [];
    const jobWords    = [...new Set([...fileWords, ...folderWords])];
    const fullJobText = `${normFile} ${normFolder}`;

    if (titleWords.length >= 2 && jobWords.length >= 2) {
        const jobHits   = jobWords.filter(w => normTitle.includes(w)).length;
        const titleHits = titleWords.filter(w => fullJobText.includes(w)).length;

        const jobCoverage   = jobHits   / jobWords.length;
        const titleCoverage = titleHits / titleWords.length;

        if (jobCoverage >= 0.6 && titleCoverage >= 0.6) return true;
    }

    return false;
}

async function autoSyncKanban(userId, jobFileName, jobFolder, routerName, targetStatus) {
    try {
        const tasks = (await pool.query('SELECT * FROM kanban_tasks WHERE "userId" = $1', [userId])).rows;
        for (const task of tasks) {
            if (matchKanbanTitle(jobFileName, jobFolder, task.title)) {
                if (targetStatus === 'doing' && task.column_id === 'todo') {
                    await pool.query(
                        'UPDATE kanban_tasks SET column_id = $1, machine = COALESCE($2, machine) WHERE id = $3 AND "userId" = $4',
                        ['doing', routerName || null, task.id, userId]
                    );
                    console.log(`[KANBAN AUTO-SYNC] Card "${task.title}" (ID ${task.id}) moved from TODO -> DOING (${routerName})`);
                } else if (targetStatus === 'done' && (task.column_id === 'doing' || task.column_id === 'todo')) {
                    await pool.query(
                        'UPDATE kanban_tasks SET column_id = $1 WHERE id = $2 AND "userId" = $3',
                        ['done', task.id, userId]
                    );
                    console.log(`[KANBAN AUTO-SYNC] Card "${task.title}" (ID ${task.id}) moved from ${task.column_id.toUpperCase()} -> DONE`);
                }
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
    
    // Auto-sync Kanban card: todo -> doing
    autoSyncKanban(userId, cleanFileName, cleanFolder, router_name, 'doing');

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
    
    // Auto-sync Kanban card: doing/todo -> done
    autoSyncKanban(userId, row.file_name, row.folder, router_name, 'done');
    
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
    const mats = (await pool.query('SELECT * FROM materials WHERE "userId" = $1 ORDER BY id DESC', [req.user.id])).rows;
    res.json(mats);
});

app.post('/api/materials', authenticateToken, async (req, res) => {
    const { name, price, feed_rate, pass_width } = req.body;
    const fRate = parseFloat(feed_rate) || 3000;
    const pWidth = parseFloat(pass_width) || 100;
    const result = await pool.query(
        'INSERT INTO materials (name, price, feed_rate, pass_width, "userId") VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [name, parseFloat(price), fRate, pWidth, req.user.id]
    );
    res.json({ success: true, material: result.rows[0] });
});

app.patch('/api/materials/:id', authenticateToken, async (req, res) => {
    const { name, price, feed_rate, pass_width } = req.body;
    const result = await pool.query(
        `UPDATE materials SET 
            name = COALESCE($1, name),
            price = COALESCE($2, price),
            feed_rate = COALESCE($3, feed_rate),
            pass_width = COALESCE($4, pass_width)
         WHERE id = $5 AND "userId" = $6 RETURNING *`,
        [
            name || null,
            price !== undefined && price !== null ? parseFloat(price) : null,
            feed_rate !== undefined && feed_rate !== null ? parseFloat(feed_rate) : null,
            pass_width !== undefined && pass_width !== null ? parseFloat(pass_width) : null,
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
    pro:      { name: 'MACH3 Tracker PRO',      price: 149.00, maxRouters: 3 },
    business: { name: 'MACH3 Tracker BUSINESS',  price: 349.00, maxRouters: 999 }
};

// POST /api/payments/create-preference
// Creates a Mercado Pago checkout preference and returns the init_point URL
app.post('/api/payments/create-preference', authenticateToken, async (req, res) => {
    try {
        const { planType } = req.body;
        const plan = PLANS[planType];
        if (!plan) return res.status(400).json({ error: 'Plano inválido. Use: pro ou business' });

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
            await autoSyncKanban(req.user.id, j.file_name, j.folder, j.router_name, 'doing');
        }

        // Auto-sync recent completed jobs to 'done'
        const todayStr = new Date().toISOString().split('T')[0];
        const doneJobs = (await pool.query('SELECT * FROM jobs WHERE "userId" = $1 AND end_time >= $2', [req.user.id, todayStr])).rows;
        for (const j of doneJobs) {
            await autoSyncKanban(req.user.id, j.file_name, j.folder, j.router_name, 'done');
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
    const { title, machine, operator, date, priority, column_id } = req.body;
    try {
        const r = await pool.query(
            'INSERT INTO kanban_tasks (title, machine, operator, date, priority, column_id, "userId") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [title, machine || null, operator || null, date || null, priority || 'media', column_id || 'todo', req.user.id]
        );
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/api/kanban/:id', authenticateToken, async (req, res) => {
    const { title, machine, operator, date, priority, column_id } = req.body;
    try {
        const r = await pool.query(
            'UPDATE kanban_tasks SET title = COALESCE($1, title), machine = COALESCE($2, machine), operator = COALESCE($3, operator), date = COALESCE($4, date), priority = COALESCE($5, priority), column_id = COALESCE($6, column_id) WHERE id = $7 AND "userId" = $8 RETURNING *',
            [title, machine, operator, date, priority, column_id, req.params.id, req.user.id]
        );
        if (r.rowCount === 0) return res.status(404).json({ error: "Tarefa não encontrada." });
        res.json(r.rows[0]);
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
