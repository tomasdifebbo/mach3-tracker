const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, MASTER_EMAILS, OFICINA_SYNC_KEY, OFICINA_SYNC_USER_ID } = require('../config/constants');

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

// Accepts either standard Bearer JWT or a configured timing-safe X-Sync-Key for local workshop agents
function authenticateSyncOrToken(req, res, next) {
    const syncKeyHeader = req.headers['x-sync-key'];
    if (syncKeyHeader && OFICINA_SYNC_KEY) {
        const provided = Buffer.from(String(syncKeyHeader), 'utf8');
        const expected = Buffer.from(OFICINA_SYNC_KEY, 'utf8');
        if (provided.length === expected.length && crypto.timingSafeEqual(provided, expected)) {
            req.user = { id: OFICINA_SYNC_USER_ID, role: 'sync', email: 'sync@local' };
            return next();
        }
        return res.sendStatus(403);
    }

    return authenticateToken(req, res, next);
}

// Strict admin authorization: explicit DB role='admin' or exact MASTER_EMAILS allowlist
function authenticateAdmin(req, res, next) {
    const email = req.user && req.user.email ? String(req.user.email).trim().toLowerCase() : '';
    if (req.user && (req.user.role === 'admin' || (email && MASTER_EMAILS.includes(email)))) {
        return next();
    }
    return res.status(403).json({ error: "Access denied: Admins only" });
}

module.exports = { authenticateToken, authenticateSyncOrToken, authenticateAdmin };
