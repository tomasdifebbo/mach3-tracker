const crypto = require('crypto');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();
const nodemailer = require('nodemailer');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

const INSECURE_JWT_PLACEHOLDERS = new Set(['mach3_secret_2026', 'secret', 'changeme']);

function resolveJwtSecret(env = process.env) {
    const raw = (env.JWT_SECRET || '').trim();
    const isProduction = env.NODE_ENV === 'production';

    if (isProduction) {
        if (!raw || raw.length < 16 || INSECURE_JWT_PLACEHOLDERS.has(raw)) {
            throw new Error('[SECURITY] JWT_SECRET obrigatorio (>= 16 caracteres) e sem valor padrao em producao.');
        }
        return raw;
    }

    if (!raw || INSECURE_JWT_PLACEHOLDERS.has(raw)) {
        console.warn('[SECURITY] JWT_SECRET ausente ou inseguro em desenvolvimento: usando segredo efemero em memoria.');
        return crypto.randomBytes(32).toString('hex');
    }

    return raw;
}

function parseListEnv(raw, fallbackList = []) {
    if (!raw || typeof raw !== 'string') return [...fallbackList];
    const items = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return items.length > 0 ? items : [...fallbackList];
}

const PORT = process.env.PORT || 3000;
const JWT_SECRET = resolveJwtSecret(process.env);
const DOMAIN = process.env.RENDER_EXTERNAL_URL || process.env.DOMAIN || `http://localhost:${PORT}`;

// Web Push (PWA Mobile Notifications) - strict env lookup (no hardcoded private key)
const VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || '').trim() || null;
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || '').trim() || null;
const VAPID_EMAIL = (process.env.VAPID_EMAIL || 'mailto:contato@mach3tracker.com').trim();

// Mercado Pago config
const MP_ACCESS_TOKEN = (process.env.MP_ACCESS_TOKEN || '').trim() || null;
const MP_WEBHOOK_SECRET = (process.env.MP_WEBHOOK_SECRET || '').trim() || null;
const mpClient = new MercadoPagoConfig({
    accessToken: MP_ACCESS_TOKEN || ''
});

// Password Recovery / Report Mailer Config (null when SMTP credentials are absent)
const EMAIL_USER = (process.env.EMAIL_USER || '').trim() || null;
const EMAIL_PASS = (process.env.EMAIL_PASS || '').trim() || null;
const transporter = EMAIL_USER && EMAIL_PASS
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: { user: EMAIL_USER, pass: EMAIL_PASS }
    })
    : null;

// Admin allowlist (exact normalized match only, configurable via MASTER_EMAILS env)
const MASTER_EMAILS = parseListEnv(
    process.env.MASTER_EMAILS,
    ['tomasdifebbo.tdf@gmail.com', 'admin@mach3.com', 'casadotrem@gmail.com']
);

// Workshop desktop bot sync key (optional env secret for X-Sync-Key machine auth)
const OFICINA_SYNC_KEY = (process.env.OFICINA_SYNC_KEY || '').trim() || null;
const OFICINA_SYNC_USER_ID = Math.max(1, parseInt(process.env.OFICINA_SYNC_USER_ID || '1', 10) || 1);

const EXTRA_CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

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

const PLANS = {
    starter:  { name: 'MACH3 Tracker STARTER',   price: 97.00, maxRouters: 1 },
    pro:      { name: 'MACH3 Tracker PRO',      price: 197.00, maxRouters: 3 },
    business: { name: 'MACH3 Tracker BUSINESS',  price: 497.00, maxRouters: 999 }
};

module.exports = {
    PORT,
    JWT_SECRET,
    resolveJwtSecret,
    DOMAIN,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_EMAIL,
    MP_ACCESS_TOKEN,
    MP_WEBHOOK_SECRET,
    mpClient,
    Preference,
    Payment,
    EMAIL_USER,
    EMAIL_PASS,
    transporter,
    MASTER_EMAILS,
    OFICINA_SYNC_KEY,
    OFICINA_SYNC_USER_ID,
    EXTRA_CORS_ORIGINS,
    DEFAULT_PLAN_FEATURES,
    getEffectiveFeatures,
    PLANS
};
