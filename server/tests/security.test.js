const crypto = require('node:crypto');
const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveJwtSecret, MASTER_EMAILS } = require('../config/constants');
const { authenticateAdmin } = require('../middleware/auth');
const {
    createRateLimiter,
    isOriginAllowed,
    verifyMercadoPagoSignature,
    isSafeHttpUrl
} = require('../middleware/security');

test('resolveJwtSecret fails closed in production and avoids hardcoded dev defaults', () => {
    assert.throws(
        () => resolveJwtSecret({ NODE_ENV: 'production' }),
        /JWT_SECRET obrigatorio/
    );
    assert.throws(
        () => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'mach3_secret_2026' }),
        /JWT_SECRET obrigatorio/
    );
    assert.throws(
        () => resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'short' }),
        /JWT_SECRET obrigatorio/
    );
    assert.equal(
        resolveJwtSecret({ NODE_ENV: 'production', JWT_SECRET: 'super_secure_prod_secret_2026!' }),
        'super_secure_prod_secret_2026!'
    );

    const devEphemeral = resolveJwtSecret({ NODE_ENV: 'development' });
    assert.ok(devEphemeral && devEphemeral.length >= 64);
    assert.notEqual(devEphemeral, 'mach3_secret_2026');
});

test('MASTER_EMAILS excludes demo accounts and authenticateAdmin blocks demo substring spoof', () => {
    assert.equal(MASTER_EMAILS.includes('demo@mach3tracker.com'), false);

    const runAdminGuard = (user) => {
        let statusCode = 200;
        let calledNext = false;
        const req = { user };
        const res = {
            status(code) {
                statusCode = code;
                return this;
            },
            json() { return this; }
        };
        authenticateAdmin(req, res, () => { calledNext = true; });
        return { statusCode, calledNext };
    };

    assert.deepEqual(runAdminGuard({ id: 9, email: 'attacker_demo@evil.com', role: 'user' }), {
        statusCode: 403,
        calledNext: false
    });
    assert.deepEqual(runAdminGuard({ id: 10, email: 'normal@client.com', role: 'user' }), {
        statusCode: 403,
        calledNext: false
    });
    assert.deepEqual(runAdminGuard({ id: 1, email: MASTER_EMAILS[0], role: 'user' }), {
        statusCode: 200,
        calledNext: true
    });
    assert.deepEqual(runAdminGuard({ id: 2, email: 'owner@company.com', role: 'admin' }), {
        statusCode: 200,
        calledNext: true
    });
});

test('isOriginAllowed enforces exact origin allowlist without subdomain wildcard bypass', () => {
    const allowed = ['https://mach3-tracker.onrender.com', 'http://localhost:5173'];

    assert.equal(isOriginAllowed('https://mach3-tracker.onrender.com', allowed), true);
    assert.equal(isOriginAllowed('https://mach3-tracker.onrender.com/', allowed), true);
    assert.equal(isOriginAllowed('http://localhost:5173', allowed), true);
    assert.equal(isOriginAllowed(undefined, allowed), true);

    assert.equal(isOriginAllowed('https://evil.onrender.com', allowed), false);
    assert.equal(isOriginAllowed('https://evil-mach3-tracker.onrender.com', allowed), false);
    assert.equal(isOriginAllowed('https://attacker.railway.app', allowed), false);
});

test('verifyMercadoPagoSignature checks HMAC-SHA256 signature timing-safely', () => {
    const secret = 'mp_webhook_test_secret_123';
    const dataId = '987654321';
    const requestId = 'req-abc-001';
    const ts = '1731500000';
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const validSig = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

    assert.equal(verifyMercadoPagoSignature({
        xSignature: `ts=${ts},v1=${validSig}`,
        xRequestId: requestId,
        dataId,
        secret
    }), true);

    assert.equal(verifyMercadoPagoSignature({
        xSignature: `ts=${ts},v1=${validSig}`,
        xRequestId: requestId,
        dataId: '111111111',
        secret
    }), false);

    assert.equal(verifyMercadoPagoSignature({
        xSignature: `ts=${ts},v1=${'0'.repeat(64)}`,
        xRequestId: requestId,
        dataId,
        secret
    }), false);
});

test('isSafeHttpUrl rejects SSRF metadata and private-LAN targets while allowing public HTTPS', () => {
    assert.equal(isSafeHttpUrl('https://fcm.googleapis.com/fcm/send/abc123'), true);
    assert.equal(isSafeHttpUrl('http://169.254.169.254/latest/meta-data/'), false);
    assert.equal(isSafeHttpUrl('https://169.254.169.254/latest/meta-data/'), false);
    assert.equal(isSafeHttpUrl('https://192.168.1.50/hook'), false);
    assert.equal(isSafeHttpUrl('https://10.0.0.5/hook'), false);
    assert.equal(isSafeHttpUrl('ftp://example.com/file'), false);
});

test('createRateLimiter enforces limits, adds headers, and resets cleanly', () => {
    const limiter = createRateLimiter({ windowMs: 60000, max: 2, message: 'Rate limited' });

    const hit = () => {
        const headers = {};
        let status = 200;
        let body = null;
        let nextCalled = false;
        const req = { ip: '1.2.3.4' };
        const res = {
            setHeader(k, v) { headers[k] = v; },
            status(c) { status = c; return this; },
            json(b) { body = b; return this; }
        };
        limiter(req, res, () => { nextCalled = true; });
        return { status, body, headers, nextCalled };
    };

    assert.equal(hit().nextCalled, true);
    assert.equal(hit().nextCalled, true);
    const blocked = hit();
    assert.equal(blocked.nextCalled, false);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error, 'Rate limited');
    assert.ok(blocked.headers['Retry-After']);

    limiter.reset();
    assert.equal(hit().nextCalled, true);
});
