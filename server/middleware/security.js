const crypto = require('crypto');

/**
 * Adds baseline HTTP hardening headers without relying on external dependencies.
 */
function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('X-DNS-Prefetch-Control', 'off');

    const forwardedProto = (req.headers['x-forwarded-proto'] || '').toString().split(',')[0].trim();
    if (req.secure || forwardedProto === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
    }
    next();
}

/**
 * Fixed-window in-memory rate limiter with unref'd periodic cleanup so tests exit cleanly.
 */
function createRateLimiter({
    windowMs = 15 * 60 * 1000,
    max = 30,
    keyGenerator = (req) => req.ip || req.socket?.remoteAddress || 'unknown',
    message = 'Muitas requisições. Tente novamente em alguns instantes.'
} = {}) {
    const store = new Map();

    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [k, entry] of store.entries()) {
            if (entry.resetAt <= now) store.delete(k);
        }
    }, Math.max(windowMs, 60000));
    if (typeof cleanup.unref === 'function') cleanup.unref();

    const middleware = (req, res, next) => {
        const now = Date.now();
        const key = String(keyGenerator(req) || 'unknown');
        let entry = store.get(key);

        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            store.set(key, entry);
        }

        entry.count += 1;
        const remaining = Math.max(0, max - entry.count);
        const retryAfterSec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));

        res.setHeader('X-RateLimit-Limit', String(max));
        res.setHeader('X-RateLimit-Remaining', String(remaining));
        res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

        if (entry.count > max) {
            res.setHeader('Retry-After', String(retryAfterSec));
            return res.status(429).json({ error: message });
        }
        next();
    };

    middleware.reset = () => store.clear();
    return middleware;
}

/**
 * Strict exact-match CORS origin validator (prevents wildcard host spoofing).
 */
function isOriginAllowed(origin, allowedOrigins = []) {
    if (!origin) return true; // Non-browser clients / same-origin curl / health checks
    const normalized = String(origin).trim().replace(/\/+$/, '').toLowerCase();
    return allowedOrigins.some(allowed =>
        String(allowed).trim().replace(/\/+$/, '').toLowerCase() === normalized
    );
}

/**
 * Timing-safe verification of Mercado Pago webhook HMAC-SHA256 `x-signature` header.
 * Manifest specification: `id:[data.id];request-id:[x-request-id];ts:[ts];`
 */
function verifyMercadoPagoSignature({ xSignature, xRequestId, dataId, secret }) {
    if (!secret || !xSignature || !dataId) return false;

    const parts = {};
    for (const piece of String(xSignature).split(',')) {
        const idx = piece.indexOf('=');
        if (idx === -1) continue;
        const k = piece.slice(0, idx).trim().toLowerCase();
        const v = piece.slice(idx + 1).trim();
        if (k && v) parts[k] = v;
    }

    if (!parts.ts || !parts.v1 || !/^[0-9a-f]{64}$/i.test(parts.v1)) return false;

    const manifestParts = [`id:${String(dataId).trim()}`];
    if (xRequestId) manifestParts.push(`request-id:${String(xRequestId).trim()}`);
    manifestParts.push(`ts:${parts.ts}`);
    const manifest = manifestParts.join(';') + ';';

    const expectedHex = crypto
        .createHmac('sha256', secret)
        .update(manifest)
        .digest('hex');

    const a = Buffer.from(parts.v1.toLowerCase(), 'utf8');
    const b = Buffer.from(expectedHex.toLowerCase(), 'utf8');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/**
 * Validates push subscription endpoints so internal network SSRF targets are rejected.
 */
function isSafeHttpUrl(urlStr, { allowLocalhostHttp = false } = {}) {
    if (!urlStr || typeof urlStr !== 'string') return false;
    try {
        const parsed = new URL(urlStr.trim());
        if (parsed.protocol === 'https:') {
            const host = parsed.hostname.toLowerCase();
            if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return allowLocalhostHttp;
            return !host.startsWith('10.') && !host.startsWith('192.168.') && !/^172\.(1[6-9]|2\d|3[0-1])\./.test(host) && !host.startsWith('169.254.');
        }
        if (allowLocalhostHttp && parsed.protocol === 'http:') {
            const host = parsed.hostname.toLowerCase();
            return host === 'localhost' || host === '127.0.0.1';
        }
        return false;
    } catch {
        return false;
    }
}

module.exports = {
    securityHeaders,
    createRateLimiter,
    isOriginAllowed,
    verifyMercadoPagoSignature,
    isSafeHttpUrl
};
