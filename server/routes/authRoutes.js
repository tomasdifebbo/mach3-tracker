const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db/pool');
const {
    JWT_SECRET, DOMAIN, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
    MASTER_EMAILS, PLANS, transporter, getEffectiveFeatures
} = require('../config/constants');
const { authenticateToken, authenticateAdmin } = require('../middleware/auth');
const { createRateLimiter, isSafeHttpUrl } = require('../middleware/security');
const { closeStaleJobs } = require('../db/initDb');
const { sendPushToUser } = require('../services/pushService');
const { executeReportCycle } = require('../services/reportService');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_PREFIX_RE = /^\$2[aby]\$/;

const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: 'Muitas tentativas de autenticação. Aguarde alguns minutos e tente novamente.'
});

const pinLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    keyGenerator: (req) => `${req.ip || 'ip'}:${req.user?.id || 'anon'}`,
    message: 'Muitas tentativas de PIN incorretas. Aguarde alguns minutos.'
});

function timingSafeTextEqual(a, b) {
    const bufA = Buffer.from(String(a), 'utf8');
    const bufB = Buffer.from(String(b), 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a stored profile PIN (supports bcrypt hashes and seamlessly upgrades legacy plaintext PINs).
 */
async function verifyStoredPin(userRow, role, candidatePin) {
    const col = role === 'gerente' ? 'gerente_pin' : (role === 'encarregado' ? 'supervisor_pin' : null);
    if (!col || !userRow) return true;

    const stored = userRow[col] ? String(userRow[col]).trim() : '';
    if (!stored) return true; // PIN not configured for this profile

    const candidate = candidatePin !== undefined && candidatePin !== null ? String(candidatePin).trim() : '';
    if (!candidate) return false;

    if (BCRYPT_PREFIX_RE.test(stored)) {
        return bcrypt.compare(candidate, stored);
    }

    const ok = timingSafeTextEqual(candidate, stored);
    if (ok && userRow.id) {
        try {
            const upgradedHash = await bcrypt.hash(candidate, 10);
            await pool.query(`UPDATE users SET ${col} = $1 WHERE id = $2`, [upgradedHash, userRow.id]);
        } catch { /* non-fatal transparent migration */ }
    }
    return ok;
}

router.post('/api/auth/register', authLimiter, async (req, res) => {
    const body = req.body || {};
    const cleanEmail = body.email ? String(body.email).trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
        return res.status(400).json({ error: "Email inválido" });
    }
    if (!password || password.length < 6 || password.length > 128) {
        return res.status(400).json({ error: "A senha deve ter entre 6 e 128 caracteres" });
    }

    const existingUser = (await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail])).rows[0];
    if (existingUser) return res.status(400).json({ error: "Email já cadastrado" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const trialExpiry = new Date();
    trialExpiry.setDate(trialExpiry.getDate() + 31);

    try {
        const defaultRole = MASTER_EMAILS.includes(cleanEmail) ? 'admin' : 'user';
        await pool.query(
            'INSERT INTO users (email, password, plan, trial_expiry, payment_status, "costPerHour", "plannedHours", role) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
            [cleanEmail, hashedPassword, 'starter', trialExpiry.toISOString(), 'trialing', 50, 8, defaultRole]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[REGISTER ERROR]', err.message);
        res.status(500).json({ error: "Erro ao registrar usuário" });
    }
});

router.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const body = req.body || {};
        const { email, password } = body;
        if (!email || !password || typeof password !== 'string') {
            return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
        }

        const cleanEmail = String(email).trim().toLowerCase();
        const user = (await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [cleanEmail])).rows[0];
        if (!user) return res.status(400).json({ error: "Usuário não encontrado" });

        const validPassword = user.password ? await bcrypt.compare(password, user.password) : false;
        if (!validPassword) return res.status(400).json({ error: "Senha incorreta" });

        const effectiveRole = MASTER_EMAILS.includes(cleanEmail) ? 'admin' : (user.role || 'user');
        const token = jwt.sign({ id: user.id, email: user.email, role: effectiveRole }, JWT_SECRET, { expiresIn: '7d' });
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                plan: user.plan,
                role: effectiveRole,
                company_role: user.company_role || 'gerente'
            }
        });
    } catch (err) {
        console.error('[LOGIN ERROR]', err.message);
        res.status(500).json({ error: "Erro interno no servidor" });
    }
});

router.post('/api/auth/recover', authLimiter, async (req, res) => {
    const body = req.body || {};
    const email = body.email ? String(body.email).trim().toLowerCase() : '';
    if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: "Email obrigatório" });

    const user = (await pool.query('SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)', [email])).rows[0];
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
        to: user.email,
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
        if (transporter && process.env.EMAIL_PASS) {
            await transporter.sendMail(mailOptions);
        } else {
            console.log('[AUTH] Recuperação registrada (envio SMTP desativado: EMAIL_PASS ausente no ambiente).');
        }
        res.json({ success: true });
    } catch (err) {
        console.error("Email send error:", err.message);
        res.status(500).json({ error: "Erro ao enviar email de recuperação" });
    }
});

router.post('/api/auth/reset', authLimiter, async (req, res) => {
    const body = req.body || {};
    const { token, newPassword } = body;
    if (!token || typeof token !== 'string' || typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 128) {
        return res.status(400).json({ error: "Dados inválidos" });
    }

    const user = (await pool.query('SELECT id FROM users WHERE reset_token = $1 AND reset_expiry > NOW()', [token])).rows[0];
    if (!user) return res.status(400).json({ error: "Token inválido ou expirado" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1, reset_token = NULL, reset_expiry = NULL WHERE id = $2', [hashedPassword, user.id]);

    res.json({ success: true });
});

router.get('/api/user/me', authenticateToken, async (req, res) => {
    await closeStaleJobs(req.user.id);
    const user = (await pool.query(
        'SELECT id, email, plan, trial_expiry, payment_status, "costPerHour", "plannedHours", role, company_role, gerente_pin, supervisor_pin, webhook_url, features_override, company_logo, theme, report_email, daily_report, idle_alert, weekly_report, plan_renewal, company_legal_name, cnpj_cpf, billing_email, default_day_operator, default_night_operator, pipeline_local_root, pipeline_cloud_root, pipeline_batches FROM users WHERE id = $1',
        [req.user.id]
    )).rows[0];
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const normalizedEmail = String(user.email || '').trim().toLowerCase();
    if (MASTER_EMAILS.includes(normalizedEmail)) {
        if (user.role !== 'admin' || user.plan !== 'business') {
            await pool.query("UPDATE users SET role = 'admin', plan = 'business' WHERE id = $1", [user.id]);
            user.role = 'admin';
            user.plan = 'business';
        }
    }

    if (!user.company_role) user.company_role = 'gerente';

    const settings = { costPerHour: user.costPerHour, plannedHours: user.plannedHours, webhookUrl: user.webhook_url };
    const features = getEffectiveFeatures(user.plan, user.features_override);
    const has_gerente_pin = !!(user.gerente_pin && user.gerente_pin.trim());
    const has_supervisor_pin = !!(user.supervisor_pin && user.supervisor_pin.trim());

    // Never expose stored PIN hashes/values to the client
    const safeUser = { ...user };
    delete safeUser.gerente_pin;
    delete safeUser.supervisor_pin;

    res.json({ ...safeUser, has_gerente_pin, has_supervisor_pin, settings, features });
});

router.patch('/api/user/settings', authenticateToken, async (req, res) => {
    const body = req.body || {};
    const { costPerHour, plannedHours, webhookUrl } = body;
    const cost = Number(costPerHour);
    const planned = Number(plannedHours);
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(planned) || planned <= 0 || planned > 24) {
        return res.status(400).json({ error: "Valores inválidos" });
    }
    if (webhookUrl && !isSafeHttpUrl(webhookUrl, { allowLocalhostHttp: process.env.NODE_ENV !== 'production' })) {
        return res.status(400).json({ error: "URL de webhook inválida" });
    }

    await pool.query(
        'UPDATE users SET "costPerHour" = $1, "plannedHours" = $2, webhook_url = $3 WHERE id = $4',
        [cost, planned, webhookUrl ? String(webhookUrl).trim() : null, req.user.id]
    );
    res.json({ success: true });
});

router.get('/api/push/vapid-public-key', (req, res) => {
    res.json({
        publicKey: VAPID_PUBLIC_KEY,
        configured: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)
    });
});

router.get('/api/push/status', authenticateToken, async (req, res) => {
    try {
        const countRes = await pool.query('SELECT count(*) as count FROM push_subscriptions WHERE "userId" = $1', [req.user.id]);
        const count = parseInt(countRes.rows[0].count, 10);
        res.json({ subscribed: count > 0, devicesCount: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/push/subscribe', authenticateToken, async (req, res) => {
    try {
        const { subscription } = req.body || {};
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ error: 'Assinatura push inválida' });
        }
        const { endpoint, keys } = subscription;
        if (
            !isSafeHttpUrl(endpoint, { allowLocalhostHttp: process.env.NODE_ENV !== 'production' }) ||
            typeof keys.p256dh !== 'string' || !keys.p256dh.trim() ||
            typeof keys.auth !== 'string' || !keys.auth.trim()
        ) {
            return res.status(400).json({ error: 'Endpoint ou chaves de assinatura push inválidas' });
        }
        const userAgent = String(req.headers['user-agent'] || '').slice(0, 255);

        await pool.query(`
            INSERT INTO push_subscriptions ("userId", endpoint, p256dh, auth, user_agent)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (endpoint) 
            DO UPDATE SET "userId" = $1, p256dh = $3, auth = $4, user_agent = $5, created_at = NOW()
        `, [req.user.id, endpoint.trim(), keys.p256dh.trim(), keys.auth.trim(), userAgent]);

        res.json({ success: true, message: 'Dispositivo cadastrado com sucesso!' });
    } catch (err) {
        console.error('[PUSH SUBSCRIBE ERROR]:', err);
        res.status(500).json({ error: 'Erro ao registrar assinatura push' });
    }
});

router.post('/api/push/unsubscribe', authenticateToken, async (req, res) => {
    try {
        const { endpoint } = req.body || {};
        if (endpoint) {
            await pool.query('DELETE FROM push_subscriptions WHERE "userId" = $1 AND endpoint = $2', [req.user.id, endpoint]);
        } else {
            await pool.query('DELETE FROM push_subscriptions WHERE "userId" = $1', [req.user.id]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/push/test', authenticateToken, async (req, res) => {
    try {
        const countRes = await pool.query('SELECT count(*) as count FROM push_subscriptions WHERE "userId" = $1', [req.user.id]);
        const count = parseInt(countRes.rows[0].count, 10);
        if (count === 0) {
            return res.status(400).json({ error: 'Nenhum celular ou navegador cadastrado. Ative as notificações push neste aparelho primeiro!' });
        }

        await sendPushToUser(req.user.id, {
            title: '🔔 Mach3 Tracker - Teste Push',
            body: 'Seu celular está conectado! Você receberá um aviso sonoro assim que cada corte for concluído.',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            url: '/history'
        });

        res.json({ success: true, devicesCount: count, message: 'Notificação de teste enviada com sucesso!' });
    } catch (err) {
        console.error('[PUSH TEST ERROR]:', err);
        res.status(500).json({ error: err.message });
    }
});

const handleRoleUpdate = async (req, res) => {
    try {
        const { company_role, pin } = req.body || {};
        if (!['gerente', 'encarregado', 'operador'].includes(company_role)) {
            return res.status(400).json({ error: "Nível de acesso inválido" });
        }

        const user = (await pool.query('SELECT id, gerente_pin, supervisor_pin FROM users WHERE id = $1', [req.user.id])).rows[0];
        if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

        const ok = await verifyStoredPin(user, company_role, pin);
        if (!ok) {
            const label = company_role === 'gerente' ? 'Gerente' : 'Supervisor';
            return res.status(401).json({ error: `Senha do Perfil ${label} incorreta!` });
        }

        await pool.query('UPDATE users SET company_role = $1 WHERE id = $2', [company_role, req.user.id]);
        res.json({ success: true, company_role });
    } catch (err) {
        console.error('[ROLE UPDATE ERROR]', err);
        res.status(500).json({ error: "Erro ao atualizar perfil no banco de dados" });
    }
};

router.patch('/api/user/company-role', authenticateToken, pinLimiter, handleRoleUpdate);
router.post('/api/user/company-role', authenticateToken, pinLimiter, handleRoleUpdate);

router.post('/api/user/verify-pin', authenticateToken, pinLimiter, async (req, res) => {
    try {
        const { role, pin } = req.body || {};
        const user = (await pool.query('SELECT id, role, gerente_pin, supervisor_pin FROM users WHERE id = $1', [req.user.id])).rows[0];
        if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

        // Master Admins bypass PIN check
        if (user.role === 'admin') {
            return res.json({ success: true });
        }

        const ok = await verifyStoredPin(user, role, pin);
        if (!ok) {
            const label = role === 'gerente' ? 'Gerente' : 'Supervisor';
            return res.status(401).json({ error: `Senha do Perfil ${label} incorreta!` });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/api/user/profile-pins', authenticateToken, async (req, res) => {
    const { gerente_pin, supervisor_pin } = req.body || {};
    const hashOrNull = async (val) => {
        if (val === undefined || val === null) return null;
        const trimmed = String(val).trim();
        if (!trimmed) return null;
        if (trimmed.length > 32) throw new Error('PIN excede limite máximo de caracteres');
        return bcrypt.hash(trimmed, 10);
    };

    try {
        const hashedGerente = await hashOrNull(gerente_pin);
        const hashedSupervisor = await hashOrNull(supervisor_pin);
        await pool.query(
            'UPDATE users SET gerente_pin = $1, supervisor_pin = $2 WHERE id = $3',
            [hashedGerente, hashedSupervisor, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Report Automation Settings
router.post('/api/user/report-settings', authenticateToken, async (req, res) => {
    try {
        const { company_logo, theme, report_email, daily_report, idle_alert, weekly_report } = req.body || {};
        const updates = [];
        const values = [];
        let idx = 1;

        if (company_logo !== undefined) {
            updates.push(`company_logo = $${idx++}`);
            values.push(company_logo);
        }
        if (theme !== undefined) {
            updates.push(`theme = $${idx++}`);
            values.push(theme);
        }
        if (report_email !== undefined) {
            updates.push(`report_email = $${idx++}`);
            values.push(report_email);
        }
        if (daily_report !== undefined) {
            updates.push(`daily_report = $${idx++}`);
            values.push(Boolean(daily_report));
        }
        if (idle_alert !== undefined) {
            updates.push(`idle_alert = $${idx++}`);
            values.push(Boolean(idle_alert));
        }
        if (weekly_report !== undefined) {
            updates.push(`weekly_report = $${idx++}`);
            values.push(Boolean(weekly_report));
        }

        if (updates.length > 0) {
            values.push(req.user.id);
            await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
        }

        res.json({ success: true, message: "Configurações salvas com sucesso!" });
    } catch (err) {
        console.error('[REPORT SETTINGS ERROR]', err);
        res.status(500).json({ error: "Erro ao salvar configurações" });
    }
});

// Multi-Tenant Workshop Configuration (Plug-and-Play per tenant)
router.patch('/api/user/workshop-config', authenticateToken, async (req, res) => {
    try {
        const body = req.body || {};
        const updates = [];
        const values = [];
        let idx = 1;

        const textFields = [
            'company_legal_name',
            'cnpj_cpf',
            'billing_email',
            'default_day_operator',
            'default_night_operator',
            'pipeline_local_root',
            'pipeline_cloud_root'
        ];

        for (const field of textFields) {
            if (body[field] !== undefined) {
                const raw = body[field] === null ? '' : String(body[field]).trim();
                if (raw.length > 500) {
                    return res.status(400).json({ error: `Campo ${field} excede limite de caracteres` });
                }
                updates.push(`${field} = $${idx++}`);
                values.push(raw || null);
            }
        }

        if (body.pipeline_batches !== undefined) {
            if (body.pipeline_batches !== null && !Array.isArray(body.pipeline_batches)) {
                return res.status(400).json({ error: 'pipeline_batches deve ser uma lista JSON válida' });
            }
            const cleanBatches = body.pipeline_batches ? body.pipeline_batches.slice(0, 100) : null;
            updates.push(`pipeline_batches = $${idx++}`);
            values.push(cleanBatches ? JSON.stringify(cleanBatches) : null);
        }

        if (updates.length > 0) {
            values.push(req.user.id);
            await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${idx}`, values);
        }

        try {
            const { invalidatePipelineCache } = require('../production_pipeline');
            if (typeof invalidatePipelineCache === 'function') invalidatePipelineCache(req.user.id);
        } catch { /* ignore */ }

        res.json({ success: true, message: 'Parametrização da oficina atualizada com sucesso!' });
    } catch (err) {
        console.error('[WORKSHOP CONFIG ERROR]', err);
        res.status(500).json({ error: 'Erro ao salvar parametrização da oficina' });
    }
});

// Trigger Report Cycle ("Faça o Ciclo")
router.post('/api/user/trigger-report-cycle', authenticateToken, async (req, res) => {
    try {
        const result = await executeReportCycle(req.user.id, req.body);
        res.json(result);
    } catch (err) {
        console.error('[TRIGGER REPORT CYCLE ERROR]', err);
        res.status(500).json({ error: "Erro ao executar ciclo de relatórios" });
    }
});

// Report Preview (requires valid JWT via Authorization header or ?token= query parameter)
router.get('/api/user/report-preview', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = (authHeader && authHeader.split(' ')[1]) || (req.query.token ? String(req.query.token).trim() : '');
        if (!token) {
            return res.status(401).json({ error: "Token de autenticação obrigatório" });
        }

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch {
            return res.status(403).json({ error: "Token inválido ou expirado" });
        }

        const result = await executeReportCycle(decoded.id, { ...req.query, previewOnly: true });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(result.html);
    } catch (err) {
        res.status(500).send("Erro ao gerar preview do relatório: " + err.message);
    }
});

// Report History
router.get('/api/user/report-history', authenticateToken, async (req, res) => {
    try {
        const history = (await pool.query(
            'SELECT * FROM report_history WHERE "userId" = $1 ORDER BY id DESC LIMIT 20',
            [req.user.id]
        )).rows;
        res.json(history);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/api/admin/users', authenticateToken, authenticateAdmin, async (req, res) => {
    const users = (await pool.query('SELECT id, email, plan, payment_status, trial_expiry, role, company_role, features_override FROM users ORDER BY id DESC')).rows;
    const formatted = users.map(u => ({
        ...u,
        company_role: u.company_role || 'gerente',
        features: getEffectiveFeatures(u.plan, u.features_override)
    }));
    res.json(formatted);
});

router.patch('/api/admin/users/:id/plan', authenticateToken, authenticateAdmin, async (req, res) => {
    const { plan, addDays } = req.body || {};
    if (plan && !PLANS[plan]) {
        return res.status(400).json({ error: "Plano inválido" });
    }
    if (plan) await pool.query('UPDATE users SET plan = $1 WHERE id = $2', [plan, req.params.id]);
    if (addDays !== undefined) {
        const daysNum = Number(addDays);
        if (!Number.isFinite(daysNum) || Math.abs(daysNum) > 3650) {
            return res.status(400).json({ error: "Quantidade de dias inválida" });
        }
        const user = (await pool.query('SELECT trial_expiry FROM users WHERE id = $1', [req.params.id])).rows[0];
        if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
        const currentExp = user.trial_expiry ? new Date(user.trial_expiry) : new Date();
        currentExp.setDate(currentExp.getDate() + daysNum);
        await pool.query('UPDATE users SET trial_expiry = $1 WHERE id = $2', [currentExp.toISOString(), req.params.id]);
    }
    res.json({ success: true });
});

router.patch('/api/admin/users/:id/company-role', authenticateToken, authenticateAdmin, async (req, res) => {
    const { company_role } = req.body || {};
    if (!['gerente', 'encarregado', 'operador'].includes(company_role)) {
        return res.status(400).json({ error: "Nível de acesso inválido" });
    }
    await pool.query('UPDATE users SET company_role = $1 WHERE id = $2', [company_role, req.params.id]);
    res.json({ success: true });
});

router.patch('/api/admin/users/:id/features', authenticateToken, authenticateAdmin, async (req, res) => {
    const { features } = req.body || {};
    const jsonStr = JSON.stringify(features || {});
    await pool.query('UPDATE users SET features_override = $1 WHERE id = $2', [jsonStr, req.params.id]);
    res.json({ success: true });
});

router.rateLimiters = { authLimiter, pinLimiter };

module.exports = router;
