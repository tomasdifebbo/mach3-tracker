const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const { MercadoPagoConfig, Preference } = require('mercadopago');
const Database = require('better-sqlite3');

const app = express();
app.set('trust proxy', 1); // Crucial for rate limiting and IP detection behind Railway proxy
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mach3_secret_2026';
const DOMAIN = process.env.DOMAIN || 'https://mach3-tracker-production.up.railway.app';

// Config Mercado Pago
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'test_token' });
const preference = new Preference(client);

// P2: Security headers (CSP permissive for SPA served from same origin)
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "https://mach3-tracker-production.up.railway.app", "https://api.mercadopago.com"],
        }
    }
}));

// P0: Restricted CORS (production + localhost dev)
const allowedOrigins = [
    DOMAIN,
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:4173'
];
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, curl, monitor script)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('CORS não permitido'));
    },
    credentials: true
}));

// P1: Rate limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' }
});
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' }
});
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);

app.use(express.json());
// Serve the NEW dashboard-v2 from internal public folder
app.use(express.static(path.join(__dirname, 'public')));

// Database setup using SQLite (Support for Railway Persistent Volumes)
const dbFolder = process.env.DATA_PATH || __dirname;
const dbPath = path.join(dbFolder, 'mach3.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// AUTO-SEED: Ensure Casadotrem exists as admin on startup
// Helper to close stale jobs (> 12 hours)
function closeStaleJobs(userId) {
    try {
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
        const staleJobs = db.prepare('SELECT id, start_time FROM jobs WHERE userId = ? AND end_time IS NULL AND start_time < ?').all(userId, twelveHoursAgo);

        for (const job of staleJobs) {
            const start = new Date(job.start_time);
            // Set end_time to start_time + 10 mins (fallback duration for stale jobs)
            const end = new Date(start.getTime() + 10 * 60 * 1000).toISOString();
            db.prepare('UPDATE jobs SET end_time = ?, duration_minutes = 10 WHERE id = ?').run(end, job.id);
            console.log(`[CLEANUP] Locked stale job #${job.id} (stuck for > 12h)`);
        }
    } catch (e) {
        console.error("Cleanup stale jobs error:", e);
    }
}

// Tentar criar tabelas se o arquivo estiver vazio
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        password TEXT,
        plan TEXT,
        trial_expiry TEXT,
        payment_status TEXT,
        costPerHour REAL DEFAULT 50,
        plannedHours REAL DEFAULT 8,
        role TEXT DEFAULT 'user'
    );
    CREATE TABLE IF NOT EXISTS materials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        price REAL,
        userId INTEGER
    );
    CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_name TEXT,
        folder TEXT,
        file_path TEXT,
        start_time TEXT,
        end_time TEXT,
        duration_minutes REAL,
        day INTEGER,
        month INTEGER,
        year INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        userId INTEGER,
        material_id INTEGER,
        material_name TEXT,
        material_price REAL,
        router_name TEXT
    );
`);

// AUTO-SEED: Ensure Casadotrem exists as admin on startup
try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get('casadotrem@gmail.com');
    if (!user) {
        console.log("[SEED] Criando conta administradora casadotrem@gmail.com...");
        const hash = bcrypt.hashSync('123456', 10);
        db.prepare('INSERT INTO users (email, password, role) VALUES (?, ?, ?)')
            .run('casadotrem@gmail.com', hash, 'admin');
    }
} catch (e) {
    console.error("[SEED] Erro ao verificar/criar usuário master:", e);
}

// Add role column to existing databases
try { db.prepare("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'").run(); } catch (e) { /* already exists */ }
// Add router_name column to existing databases
try { db.prepare("ALTER TABLE jobs ADD COLUMN router_name TEXT").run(); } catch (e) { /* already exists */ }

// DEBOUNCE: Prevent ghost jobs when Mach3 re-triggers M101 after stop/reset
const DEBOUNCE_SECONDS = 10;

// STARTUP CLEANUP: Remove ghost jobs (duration 0 or < 10 seconds) from previous runs
try {
    const ghosts = db.prepare(`SELECT id, file_name FROM jobs WHERE (end_time IS NOT NULL AND duration_minutes < 0.16)`).all();
    if (ghosts.length > 0) {
        console.log(`Cleanup: removing ${ghosts.length} ghost jobs:`, ghosts.map(g => `#${g.id} ${g.file_name}`).join(', '));
        db.prepare(`DELETE FROM jobs WHERE (end_time IS NOT NULL AND duration_minutes < 0.16)`).run();
    }
} catch (e) { console.error('Cleanup error:', e); }

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

    // Validations
    if (!email || !email.includes('@')) return res.status(400).json({ error: "Email inválido" });
    if (!password || password.length < 6) return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres" });

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) return res.status(400).json({ error: "Email já cadastrado" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + 31);

    try {
        const stmt = db.prepare('INSERT INTO users (email, password, plan, trial_expiry, payment_status, costPerHour, plannedHours, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const defaultRole = email === 'tomasdifebbo.tdf@gmail.com' ? 'admin' : 'user';
        stmt.run(email, hashedPassword, 'starter', trialExpiry.toISOString(), 'trialing', 50, 8, defaultRole);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao registrar usuário" });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(400).json({ error: "Usuário não encontrado" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Senha inválida" });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, email: user.email, plan: user.plan, role: user.role } });
});

app.get('/api/user/me', authenticateToken, (req, res) => {
    closeStaleJobs(req.user.id);
    let user = db.prepare('SELECT id, email, plan, trial_expiry, payment_status, costPerHour, plannedHours, role FROM users WHERE id = ?').get(req.user.id);
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    // Auto-promote master account directly on profile fetch
    const masterEmails = ['tomasdifebbo.tdf@gmail.com', 'admin@mach3.com', 'casadotrem@gmail.com'];
    if (masterEmails.includes(user.email) && user.role !== 'admin') {
        db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(user.id);
        user.role = 'admin';
    }

    const settings = { costPerHour: user.costPerHour, plannedHours: user.plannedHours };
    res.json({ ...user, settings });
});

app.patch('/api/user/settings', authenticateToken, (req, res) => {
    const { costPerHour, plannedHours } = req.body;
    let cost = Number(costPerHour);
    let planned = Number(plannedHours);

    if (isNaN(cost) || isNaN(planned)) return res.status(400).json({ error: "Valores inválidos" });

    db.prepare('UPDATE users SET costPerHour = ?, plannedHours = ? WHERE id = ?').run(cost, planned, req.user.id);

    const user = db.prepare('SELECT id, email, plan, costPerHour, plannedHours, role FROM users WHERE id = ?').get(req.user.id);
    res.json({ success: true, user: { ...user, settings: { costPerHour: user.costPerHour, plannedHours: user.plannedHours } } });
});

// ================= ADMIN ROUTES =================
app.post('/api/admin/make-master', async (req, res) => {
    // Bootstrap endpoint: localhost only (blocked in production behind proxy)
    const ip = req.ip || '';
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
    if (!isLocal) return res.status(403).json({ error: "Only available from localhost" });
    if (req.body.secret !== JWT_SECRET) return res.status(403).json({ error: "Invalid secret" });
    const email = req.body.email || 'tomasdifebbo.tdf@gmail.com';
    db.prepare("UPDATE users SET role = 'admin' WHERE email = ?").run(email);
    res.json({ success: true, message: `User ${email} is now admin` });
});

app.get('/api/admin/users', authenticateToken, authenticateAdmin, (req, res) => {
    const users = db.prepare('SELECT id, email, plan, payment_status, trial_expiry, role FROM users ORDER BY id DESC').all();
    res.json(users);
});

app.patch('/api/admin/users/:id/plan', authenticateToken, authenticateAdmin, (req, res) => {
    const { plan, addDays } = req.body;
    let updates = [];
    let values = [];

    if (plan) {
        updates.push("plan = ?");
        values.push(plan);
    }

    if (addDays) {
        // Extend trial
        const user = db.prepare('SELECT trial_expiry FROM users WHERE id = ?').get(req.params.id);
        const currentExp = user.trial_expiry ? new Date(user.trial_expiry) : new Date();
        currentExp.setDate(currentExp.getDate() + Number(addDays));
        updates.push("trial_expiry = ?");
        values.push(currentExp.toISOString());
    }

    if (updates.length > 0) {
        values.push(req.params.id);
        db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    res.json({ success: true });
});

app.post('/api/payments/create-preference', authenticateToken, async (req, res) => {
    const { planType } = req.body;
    const plans = {
        'starter': { title: 'Plano Starter (Mensal)', price: 49.00 },
        'pro': { title: 'Plano Profissional (Mensal)', price: 149.00 },
        'business': { title: 'Plano Business (Mensal)', price: 349.00 }
    };

    const selectedPlan = plans[planType];
    if (!selectedPlan) return res.status(400).json({ error: "Plano inválido" });

    try {
        const body = {
            items: [
                {
                    title: selectedPlan.title,
                    quantity: 1,
                    unit_price: selectedPlan.price,
                    currency_id: 'BRL'
                }
            ],
            external_reference: req.user.id.toString(),
            metadata: { user_id: req.user.id, plan_type: planType },
            notification_url: `${DOMAIN}/api/payments/webhook`,
            back_urls: {
                success: `${DOMAIN}/#dashboard`,
                failure: `${DOMAIN}/#settings`,
                pending: `${DOMAIN}/#settings`
            },
            auto_return: 'approved'
        };

        const response = await preference.create({ body });
        res.json({ id: response.id, init_point: response.init_point });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erro ao criar preferência" });
    }
});

app.post('/api/payments/webhook', async (req, res) => {
    const { type, data } = req.body;
    if (type === 'payment') {
        const paymentId = data.id;
        try {
            const paymentInfo = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
            }).then(r => r.json());

            const userId = parseInt(paymentInfo.external_reference);
            const planType = paymentInfo.metadata?.plan_type;

            if (paymentInfo.status === 'approved' && userId && planType) {
                const expiry = new Date();
                expiry.setMonth(expiry.getMonth() + 1);

                db.prepare('UPDATE users SET plan = ?, payment_status = ?, trial_expiry = ? WHERE id = ?')
                    .run(planType, 'paid', expiry.toISOString(), userId);
                console.log(`PAGAMENTO APROVADO: User ${userId} agora é ${planType}`);
            }
        } catch (err) {
            console.error('Webhook Error:', err);
        }
    }
    res.sendStatus(200);
});

app.post('/api/jobs', authenticateToken, (req, res) => {
    const { file_name, folder, file_path, start_time, router_name } = req.body;
    const userId = req.user.id;

    let dt = start_time ? new Date(start_time) : new Date();
    let cleanFolder = folder || 'Desconhecido';
    let cleanFileName = file_name || 'Desconhecido';

    if (cleanFileName.includes('\\') || cleanFileName.includes('/')) {
        const pathParts = cleanFileName.replace(/\\/g, '/').split('/').filter(p => p.length > 0);
        if (pathParts.length > 0) cleanFileName = pathParts[pathParts.length - 1];
    }
    // Now keep cleanFolder as the provided path, but cleaned of the router prefix if it exists
    if (cleanFolder && cleanFolder.includes(' | ')) {
        cleanFolder = cleanFolder.split(' | ').pop();
    }

    // DEBOUNCE: Check if this START is too close to the last event
    const lastJob = db.prepare('SELECT start_time, end_time FROM jobs WHERE userId = ? ORDER BY id DESC LIMIT 1').get(userId);
    if (lastJob) {
        const lastEventTime = new Date(lastJob.end_time || lastJob.start_time);
        const diffSeconds = (dt - lastEventTime) / 1000;
        if (diffSeconds >= 0 && diffSeconds < DEBOUNCE_SECONDS) {
            console.log(`DEBOUNCE: Ignoring START (${diffSeconds.toFixed(1)}s < ${DEBOUNCE_SECONDS}s)`);
            return res.json({ id: null, success: true, debounced: true });
        }
    }

    // AUTO-CLOSE PREVIOUS JOBS
    const openJobs = db.prepare('SELECT id, start_time FROM jobs WHERE userId = ? AND end_time IS NULL').all(userId);
    const updateJob = db.prepare('UPDATE jobs SET end_time = ?, duration_minutes = ? WHERE id = ?');
    const deleteShortJob = db.prepare('DELETE FROM jobs WHERE id = ?');

    const tx = db.transaction(() => {
        for (const j of openJobs) {
            const prevStart = new Date(j.start_time);
            const duration = Math.max(0, (dt - prevStart) / (1000 * 60));
            if (duration < 0.16) {
                deleteShortJob.run(j.id);
            } else {
                updateJob.run(dt.toISOString(), duration, j.id);
            }
        }

        const routerName = router_name || null;
        const r = db.prepare('INSERT INTO jobs (file_name, folder, file_path, start_time, day, month, year, userId, router_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            .run(cleanFileName, cleanFolder, file_path || 'Desconhecido', dt.toISOString(), dt.getDate(), dt.getMonth() + 1, dt.getFullYear(), userId, routerName);
        return r.lastInsertRowid;
    });

    const newId = tx();
    console.log(`NEW JOB #${newId}: ${cleanFileName} (${cleanFolder})`);
    res.json({ id: newId, success: true });
});

app.patch('/api/jobs/latest', authenticateToken, (req, res) => {
    const { end_time, router_name } = req.body;
    const userId = req.user.id;
    const dt = end_time ? new Date(end_time) : new Date();

    // Match by router_name first (multi-router support), fallback to any open job
    let row;
    if (router_name) {
        row = db.prepare('SELECT * FROM jobs WHERE userId = ? AND end_time IS NULL AND router_name = ? ORDER BY start_time DESC LIMIT 1').get(userId, router_name);
    }
    if (!row) {
        row = db.prepare('SELECT * FROM jobs WHERE userId = ? AND end_time IS NULL ORDER BY start_time DESC LIMIT 1').get(userId);
    }
    if (!row) return res.status(404).json({ error: "No open jobs found" });

    const startDt = new Date(row.start_time);
    const durationMinutes = (dt - startDt) / (1000 * 60);

    if (durationMinutes < 0.16) {
        db.prepare('DELETE FROM jobs WHERE id = ?').run(row.id);
        console.log(`GHOST JOB DELETED: ${row.file_name}`);
        return res.json({ id: row.id, deleted: true, reason: "< 10s" });
    }

    db.prepare('UPDATE jobs SET end_time = ?, duration_minutes = ? WHERE id = ?').run(dt.toISOString(), durationMinutes, row.id);
    res.json({ id: row.id, duration_minutes: durationMinutes, success: true });
});

app.get('/api/jobs', authenticateToken, (req, res) => {
    closeStaleJobs(req.user.id);
    const jobs = db.prepare('SELECT * FROM jobs WHERE userId = ? ORDER BY id DESC').all(req.user.id);
    res.json(jobs);
});

app.patch('/api/jobs/:id', authenticateToken, (req, res) => {
    const { material_id, material_name, material_price } = req.body;
    const info = db.prepare('UPDATE jobs SET material_id = ?, material_name = ?, material_price = ? WHERE id = ? AND userId = ?')
        .run(material_id, material_name, material_price, req.params.id, req.user.id);

    if (info.changes > 0) res.json({ success: true });
    else res.status(404).json({ error: "Job not found" });
});

app.delete('/api/jobs/:id', authenticateToken, (req, res) => {
    const info = db.prepare('DELETE FROM jobs WHERE id = ? AND userId = ?').run(req.params.id, req.user.id);
    if (info.changes > 0) res.json({ success: true });
    else res.status(404).json({ error: "Job not found" });
});

app.get('/api/materials', authenticateToken, (req, res) => {
    const mats = db.prepare('SELECT * FROM materials WHERE userId = ?').all(req.user.id);
    res.json(mats);
});

app.post('/api/materials', authenticateToken, (req, res) => {
    try {
        const { name, price } = req.body;
        if (!name || price === undefined || price === null) return res.status(400).json({ error: "Name and price required" });

        let parsedPrice = parseFloat(price);
        if (isNaN(parsedPrice)) return res.status(400).json({ error: "Invalid price format" });

        const result = db.prepare('INSERT INTO materials (name, price, userId) VALUES (?, ?, ?)').run(name, parsedPrice, req.user.id);
        res.json({ success: true, material: { id: result.lastInsertRowid, name, price: parsedPrice, userId: req.user.id } });
    } catch (err) {
        console.error("Error saving material:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.delete('/api/materials/:id', authenticateToken, (req, res) => {
    const info = db.prepare('DELETE FROM materials WHERE id = ? AND userId = ?').run(req.params.id, req.user.id);
    if (info.changes > 0) res.json({ success: true });
    else res.status(404).json({ error: "Material not found" });
});

app.get('/api/stats', authenticateToken, (req, res) => {
    try {
        closeStaleJobs(req.user.id);
        const jobs = db.prepare('SELECT * FROM jobs WHERE userId = ?').all(req.user.id);
        const totalJobs = jobs.length;
        let totalHours = 0;
        let validCompletedJobs = 0;
        const today = new Date();
        let jobsToday = 0;

        const hoursPerDay = {};
        const fileCounts = {};

        jobs.forEach(j => {
            const startDt = new Date(j.start_time);
            const isToday = startDt.getDate() === today.getDate() && startDt.getMonth() === today.getMonth() && startDt.getFullYear() === today.getFullYear();
            if (isToday) jobsToday++;

            if (j.end_time) {
                let dur = j.duration_minutes || 0;
                if (dur > 0.16) {
                    validCompletedJobs++;
                    totalHours += (dur / 60);

                    const pad = n => n.toString().padStart(2, '0');
                    const dateKey = `${pad(startDt.getDate())}/${pad(startDt.getMonth() + 1)}`;

                    if (!hoursPerDay[dateKey]) hoursPerDay[dateKey] = 0;
                    hoursPerDay[dateKey] += (dur / 60);

                    if (!fileCounts[j.file_name]) fileCounts[j.file_name] = 0;
                    fileCounts[j.file_name]++;
                }
            }
        });

        const avgJobHours = validCompletedJobs > 0 ? totalHours / validCompletedJobs : 0;
        const sortedFiles = Object.keys(fileCounts).map(k => ({ name: k, count: fileCounts[k] })).sort((a, b) => b.count - a.count).slice(0, 10);

        const sortedDays = Object.keys(hoursPerDay)
            .sort((a, b) => {
                const [d1, m1] = a.split('/');
                const [d2, m2] = b.split('/');
                const yr = new Date().getFullYear();
                return new Date(yr, m1 - 1, d1) - new Date(yr, m2 - 1, d2);
            }).slice(-30);

        res.json({
            totalJobs,
            totalHours,
            avgJobHours,
            jobsToday,
            dailyHoursLabels: sortedDays,
            dailyHoursData: sortedDays.map(d => hoursPerDay[d]),
            topFiles: sortedFiles
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Premium Server (SQLite) running on port ${port}`);
});
