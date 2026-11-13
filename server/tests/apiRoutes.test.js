const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const pool = require('../db/pool');
const { createApp } = require('../app');
const authRoutes = require('../routes/authRoutes');
const { JWT_SECRET, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = require('../config/constants');

function countExpressRoutes(app) {
    const stack = (app._router && app._router.stack) || (app.router && app.router.stack) || [];
    let count = 0;
    function walk(layers) {
        for (const layer of layers) {
            if (layer.route) count++;
            else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
                walk(layer.handle.stack);
            }
        }
    }
    walk(stack);
    return count;
}

test('Express API server route integration suite', async (t) => {
    const app = createApp();
    let server;
    let baseUrl;
    const origQuery = pool.query.bind(pool);

    await new Promise((resolve) => {
        server = app.listen(0, '127.0.0.1', () => {
            const addr = server.address();
            baseUrl = `http://127.0.0.1:${addr.port}`;
            resolve();
        });
    });

    t.after(async () => {
        authRoutes.rateLimiters.authLimiter.reset();
        authRoutes.rateLimiters.pinLimiter.reset();
        pool.query = origQuery;
        await new Promise((resolve) => server.close(resolve));
    });

    await t.test('registers all 98 modular Express routes', () => {
        assert.equal(countExpressRoutes(app), 98);
    });

    await t.test('GET /health responds 200 OK with security headers and strict CORS', async () => {
        const res = await fetch(`${baseUrl}/health`, {
            headers: { Origin: 'https://evil-attacker.onrender.com' }
        });
        assert.equal(res.status, 200);
        assert.equal(await res.text(), 'OK');
        assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
        assert.equal(res.headers.get('x-frame-options'), 'SAMEORIGIN');
        assert.equal(res.headers.get('x-powered-by'), null);
        assert.equal(res.headers.get('access-control-allow-origin'), null);

        const validCors = await fetch(`${baseUrl}/health`, {
            headers: { Origin: 'https://mach3-tracker.onrender.com' }
        });
        assert.equal(validCors.headers.get('access-control-allow-origin'), 'https://mach3-tracker.onrender.com');
    });

    await t.test('GET /api/push/vapid-public-key returns key status without hardcoded secret', async () => {
        const res = await fetch(`${baseUrl}/api/push/vapid-public-key`);
        assert.equal(res.status, 200);
        const body = await res.json();
        assert.equal(body.publicKey, VAPID_PUBLIC_KEY);
        assert.equal(body.configured, Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY));
    });

    await t.test('protected endpoints reject missing or invalid tokens', async () => {
        const protectedGets = [
            '/api/user/me',
            '/api/user/report-preview',
            '/api/routers',
            '/api/kanban',
            '/api/kanban/todo-updates',
            '/api/jobs',
            '/api/oficina-sync',
            '/api/arquivos-producao',
            '/api/pipeline/completed-files'
        ];
        for (const ep of protectedGets) {
            const noAuth = await fetch(`${baseUrl}${ep}`);
            assert.equal(noAuth.status, 401, `${ep} should require bearer token`);

            const badAuth = await fetch(`${baseUrl}${ep}`, {
                headers: { Authorization: 'Bearer invalid.jwt.token' }
            });
            assert.equal(badAuth.status, 403, `${ep} should reject tampered token`);
        }

        const patchGcodeNoAuth = await fetch(`${baseUrl}/api/oficina-sync/patch-gcode`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: 'G0 X10' })
        });
        assert.equal(patchGcodeNoAuth.status, 401);
    });

    await t.test('blocks demo substring privilege escalation on admin & /api/user/me', async () => {
        const attackerToken = jwt.sign(
            { id: 999, email: 'attacker_demo@evil.com', role: 'user' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        pool.query = async (sql) => {
            if (sql.includes('FROM users WHERE id = $1')) {
                return {
                    rows: [{
                        id: 999,
                        email: 'attacker_demo@evil.com',
                        plan: 'starter',
                        role: 'user',
                        company_role: 'operador',
                        costPerHour: 50,
                        plannedHours: 8,
                        gerente_pin: '1234',
                        supervisor_pin: null
                    }]
                };
            }
            return { rows: [], rowCount: 0 };
        };

        const adminRes = await fetch(`${baseUrl}/api/admin/users`, {
            headers: { Authorization: `Bearer ${attackerToken}` }
        });
        assert.equal(adminRes.status, 403);

        const meRes = await fetch(`${baseUrl}/api/user/me`, {
            headers: { Authorization: `Bearer ${attackerToken}` }
        });
        assert.equal(meRes.status, 200);
        const me = await meRes.json();
        assert.equal(me.role, 'user');
        assert.equal(me.plan, 'starter');
        assert.equal(me.has_gerente_pin, true);
        assert.equal(me.gerente_pin, undefined);
    });

    await t.test('POST /api/auth/register validates email and password rules', async () => {
        const badEmail = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'invalido', password: 'password123' })
        });
        assert.equal(badEmail.status, 400);

        const shortPass = await fetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'user@teste.com', password: '123' })
        });
        assert.equal(shortPass.status, 400);
    });

    await t.test('POST /api/auth/login rejects hardcoded master fallback backdoor', async () => {
        const strongHash = await bcrypt.hash('StrongActualOwnerPassword!99', 10);
        let passwordWasReset = false;

        pool.query = async (sql) => {
            if (sql.includes('UPDATE users SET password')) {
                passwordWasReset = true;
            }
            if (sql.includes('FROM users WHERE LOWER(email)')) {
                return {
                    rows: [{
                        id: 1,
                        email: 'casadotrem@gmail.com',
                        password: strongHash,
                        role: 'admin',
                        plan: 'business'
                    }]
                };
            }
            return { rows: [], rowCount: 0 };
        };

        for (const legacyPass of ['123456', 'admin']) {
            const res = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'casadotrem@gmail.com', password: legacyPass })
            });
            assert.equal(res.status, 400);
        }
        assert.equal(passwordWasReset, false);
    });

    await t.test('POST /api/auth/login validates required fields and user lookup via mocked DB', async () => {
        pool.query = async () => ({ rows: [], rowCount: 0 });

        const missing = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        assert.equal(missing.status, 400);

        const unknownUser = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'naoexiste@teste.com', password: 'secret' })
        });
        assert.equal(unknownUser.status, 400);
        const data = await unknownUser.json();
        assert.match(data.error, /não encontrado/i);
    });

    await t.test('PATCH /api/user/profile-pins hashes PINs with bcrypt and verify-pin validates cleanly', async () => {
        const token = jwt.sign({ id: 42, email: 'op@teste.com', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
        let savedGerenteHash = null;

        pool.query = async (sql, params = []) => {
            if (sql.includes('UPDATE users SET gerente_pin')) {
                savedGerenteHash = params[0];
                return { rows: [], rowCount: 1 };
            }
            if (sql.includes('FROM users WHERE id = $1')) {
                return {
                    rows: [{
                        id: 42,
                        role: 'user',
                        gerente_pin: savedGerenteHash,
                        supervisor_pin: null
                    }]
                };
            }
            return { rows: [], rowCount: 0 };
        };

        const saveRes = await fetch(`${baseUrl}/api/user/profile-pins`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ gerente_pin: '4321', supervisor_pin: '' })
        });
        assert.equal(saveRes.status, 200);
        assert.ok(savedGerenteHash && savedGerenteHash.startsWith('$2'));
        assert.notEqual(savedGerenteHash, '4321');

        const badPinRes = await fetch(`${baseUrl}/api/user/verify-pin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ role: 'gerente', pin: '0000' })
        });
        assert.equal(badPinRes.status, 401);

        const okPinRes = await fetch(`${baseUrl}/api/user/verify-pin`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ role: 'gerente', pin: '4321' })
        });
        assert.equal(okPinRes.status, 200);
    });

    await t.test('authenticated GET /api/routers & POST /api/kanban work cleanly against mocked DB', async () => {
        const token = jwt.sign({ id: 42, email: 'op@teste.com', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });

        pool.query = async (sql, params = []) => {
            if (sql.includes('FROM routers WHERE "userId"')) {
                return {
                    rows: [
                        { id: 1, name: 'Router Central', status: 'active', userId: 42 },
                        { id: 2, name: 'Mesa de Vácuo', status: 'active', userId: 42 }
                    ]
                };
            }
            if (sql.includes('INSERT INTO kanban_tasks')) {
                return {
                    rows: [{
                        id: 99,
                        title: params[0],
                        machine: params[1],
                        operator: params[2],
                        date: params[3],
                        priority: params[4],
                        column_id: params[5],
                        userId: params[6],
                        estimated_minutes: params[7]
                    }]
                };
            }
            return { rows: [], rowCount: 0 };
        };

        const routersRes = await fetch(`${baseUrl}/api/routers`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        assert.equal(routersRes.status, 200);
        const routers = await routersRes.json();
        assert.equal(routers.length, 2);
        assert.equal(routers[0].name, 'Router Central');

        const kanbanRes = await fetch(`${baseUrl}/api/kanban`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                title: 'Fachada Acrílico 5mm',
                machine: 'Laser',
                priority: 'urgente',
                column_id: 'todo',
                estimated_minutes: 45
            })
        });
        assert.equal(kanbanRes.status, 200);
        const createdTask = await kanbanRes.json();
        assert.equal(createdTask.id, 99);
        assert.equal(createdTask.title, 'Fachada Acrílico 5mm');
        assert.equal(createdTask.userId, 42);
        assert.equal(createdTask.estimated_minutes, 45);
    });

    await t.test('authenticated POST /api/oficina-sync/patch-gcode injects M101/M102 macros and replaces S12000', async () => {
        const token = jwt.sign({ id: 42, email: 'op@teste.com', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });

        const badRes = await fetch(`${baseUrl}/api/oficina-sync/patch-gcode`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ content: '' })
        });
        assert.equal(badRes.status, 400);

        const okRes = await fetch(`${baseUrl}/api/oficina-sync/patch-gcode`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                content: 'G0 Z15\nM03 S12000\nG1 X10 Y10\nM30',
                targetSpeed: '18000'
            })
        });
        assert.equal(okRes.status, 200);
        const patched = await okRes.json();
        assert.equal(patched.ok, true);
        assert.equal(
            patched.patchedContent,
            'G0 Z15\nM03 S18000\nM101\nG1 X10 Y10\nM102\nM30'
        );
        assert.equal(patched.m101Line, 3);
        assert.equal(patched.m102Line, 5);
    });

    await t.test('PATCH /api/user/workshop-config validates JSONB batches and persists tenant settings', async () => {
        const token = jwt.sign({ id: 7, email: 'oficina@teste.com', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
        let capturedUpdateParams = null;

        pool.query = async (sql, params) => {
            if (sql.includes('UPDATE users') && sql.includes('default_day_operator')) {
                capturedUpdateParams = params;
                return {
                    rows: [{
                        default_day_operator: params[0],
                        default_night_operator: params[1],
                        pipeline_local_root: params[2],
                        pipeline_cloud_root: params[3],
                        pipeline_batches: JSON.parse(params[4])
                    }],
                    rowCount: 1
                };
            }
            return { rows: [], rowCount: 0 };
        };

        const badRes = await fetch(`${baseUrl}/api/user/workshop-config`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ pipeline_batches: 'not-an-array' })
        });
        assert.equal(badRes.status, 400);

        const okRes = await fetch(`${baseUrl}/api/user/workshop-config`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                default_day_operator: 'Marcos Dia',
                default_night_operator: 'Lucas Noite',
                pipeline_local_root: 'D:\\CNC\\Projetos',
                pipeline_cloud_root: 'C:\\Nuvem\\Projetos',
                pipeline_batches: [{ id: 'lote_mdf', name: 'Lote MDF', material: 'MDF 9mm', targetSheets: 10 }]
            })
        });
        assert.equal(okRes.status, 200);
        const body = await okRes.json();
        assert.equal(body.success, true);
        assert.equal(capturedUpdateParams[0], 'Marcos Dia');
        assert.equal(capturedUpdateParams[1], 'Lucas Noite');
        assert.equal(capturedUpdateParams[2], 'D:\\CNC\\Projetos');
        assert.equal(capturedUpdateParams[3], 'C:\\Nuvem\\Projetos');
        assert.equal(JSON.parse(capturedUpdateParams[4]).length, 1);
        assert.equal(capturedUpdateParams[5], 7);
    });

    await t.test('pipeline completed-files isolates tenant keys with u<userId>:: prefix', async () => {
        const tenantToken = jwt.sign({ id: 2, email: 'tenant2@teste.com', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
        const insertedKeys = [];

        pool.query = async (sql, params) => {
            if (sql.includes('FROM pipeline_completed_files')) {
                return {
                    rows: [
                        { file_key: 'u2::Projeto X/chapa1.txt', file_name: 'chapa1.txt', stage: 'CNC', subfolder: 'Projeto X', job_name: 'Stand', done: true, operator_name: 'Joao', completed_at: '2026-06-15T12:00:00Z', updated_at: '2026-06-15T12:00:00Z' }
                    ]
                };
            }
            if (sql.includes('FROM users')) {
                return { rows: [{ op_name: 'Joao' }] };
            }
            if (sql.includes('FROM operators')) {
                return { rows: [] };
            }
            if (sql.includes('INSERT INTO pipeline_completed_files')) {
                insertedKeys.push(params[0]);
                return { rows: [{ file_key: params[0], done: true }], rowCount: 1 };
            }
            return { rows: [], rowCount: 0 };
        };

        const getRes = await fetch(`${baseUrl}/api/pipeline/completed-files`, {
            headers: { Authorization: `Bearer ${tenantToken}` }
        });
        assert.equal(getRes.status, 200);
        const getData = await getRes.json();
        assert.equal(getData.success, true);
        assert.equal(getData.files[0].file_key, 'Projeto X/chapa1.txt');
        assert.ok(getData.map['Projeto X/chapa1.txt']);
        assert.equal(getData.map['u2::Projeto X/chapa1.txt'], undefined);

        const toggleRes = await fetch(`${baseUrl}/api/pipeline/toggle-completed`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tenantToken}`
            },
            body: JSON.stringify({ file_key: 'Projeto Y/chapa2.txt', file_name: 'chapa2.txt', done: true })
        });
        assert.equal(toggleRes.status, 200);
        assert.equal(insertedKeys[0], 'u2::Projeto Y/chapa2.txt');
    });

    await t.test('POST /api/auth/login triggers 429 rate limiting after excessive requests', async () => {
        authRoutes.rateLimiters.authLimiter.reset();
        pool.query = async () => ({ rows: [], rowCount: 0 });

        let lastStatus = 0;
        for (let i = 0; i < 21; i++) {
            const res = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: 'nobody@teste.com', password: 'wrong' })
            });
            lastStatus = res.status;
        }
        assert.equal(lastStatus, 429);
    });
});
