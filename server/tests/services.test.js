const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../db/pool');
const { DEFAULT_PLAN_FEATURES, getEffectiveFeatures } = require('../config/constants');
const { normalizeStr, matchKanbanTitle, autoSyncKanban } = require('../services/kanbanSyncService');
const { isNightShift, getNightOperator, getDayOperator, applyShiftAllocationRule } = require('../services/shiftService');

test('getEffectiveFeatures merges overrides safely and handles invalid JSON', () => {
    assert.deepEqual(getEffectiveFeatures('starter', null), DEFAULT_PLAN_FEATURES.starter);
    assert.deepEqual(getEffectiveFeatures('unknown_plan', null), DEFAULT_PLAN_FEATURES.starter);

    const withOverride = getEffectiveFeatures('starter', JSON.stringify({ encarregado: true, m2_calculation: true }));
    assert.equal(withOverride.encarregado, true);
    assert.equal(withOverride.m2_calculation, true);
    assert.equal(withOverride.dashboard, true);

    const corruptOverride = getEffectiveFeatures('pro', '{invalid-json');
    assert.deepEqual(corruptOverride, DEFAULT_PLAN_FEATURES.pro);
});

test('kanbanSyncService matches G-code files cleanly without generic false positives', () => {
    assert.equal(normalizeStr('Peça Ação #10.txt'), 'peca acao 10');

    assert.equal(matchKanbanTitle('Fachada Hogwarts.txt', '2640', 'Fachada Hogwarts'), true);
    assert.equal(matchKanbanTitle('chapa 2 MDF 9MM VETOR LOGO TARTARUGA e4mm.txt', 'GERAL', 'chapa 2 MDF 9MM VETOR LOGO TARTARUGA e4mm'), true);

    // Generic G-Code must NOT steal a specific card containing extra distinguishing keywords
    assert.equal(matchKanbanTitle('mdf 9mm.txt', '', 'chapa 2 MDF 9MM VETOR LOGO TARTARUGA e4mm'), false);
    assert.equal(matchKanbanTitle('corte.txt', '', ''), false);
});

test('autoSyncKanban promotes matching todo card and completes prior active card on same machine', async (t) => {
    const origQuery = pool.query.bind(pool);
    const executed = [];

    pool.query = async (sql, params = []) => {
        executed.push({ sql, params });
        if (sql.startsWith('SELECT * FROM kanban_tasks')) {
            return {
                rows: [
                    { id: 10, title: 'Frente Loja XPTO', machine: 'Router Central', column_id: 'todo' },
                    { id: 11, title: 'Servico Anterior Antigo', machine: 'Router Central', column_id: 'doing' }
                ]
            };
        }
        return { rows: [], rowCount: 1 };
    };
    t.after(() => { pool.query = origQuery; });

    await autoSyncKanban(1, 'Frente Loja XPTO.txt', 'Clientes', 'Router Central', 'doing', 'Tomas');

    const updatesToDoing = executed.filter(q => q.sql.includes('UPDATE kanban_tasks SET column_id = $1, machine'));
    const updatesToDone = executed.filter(q => q.sql.includes('UPDATE kanban_tasks SET column_id = $1 WHERE id = $2'));
    assert.equal(updatesToDoing.length, 1);
    assert.equal(updatesToDoing[0].params[3], 10);
    assert.equal(updatesToDone.length, 1);
    assert.equal(updatesToDone[0].params[1], 11);
});

test('autoSyncKanban creates a new doing card when unmatched', async (t) => {
    const origQuery = pool.query.bind(pool);
    const inserts = [];

    pool.query = async (sql, params = []) => {
        if (sql.startsWith('SELECT * FROM kanban_tasks')) {
            return { rows: [] };
        }
        if (sql.includes('INSERT INTO kanban_tasks')) {
            inserts.push(params);
        }
        return { rows: [], rowCount: 1 };
    };
    t.after(() => { pool.query = origQuery; });

    await autoSyncKanban(7, 'PECA_NOVA_123.txt', 'Stand', 'Router 2', 'doing', 'Brenno');

    assert.equal(inserts.length, 1);
    assert.equal(inserts[0][0], 'PECA_NOVA_123.txt');
    assert.equal(inserts[0][1], 'Router 2');
    assert.equal(inserts[0][2], 'Brenno');
    assert.equal(inserts[0][5], 'doing');
    assert.equal(inserts[0][6], 7);
});

test('shiftService.isNightShift applies America/Sao_Paulo 22:00-05:59 night rule', () => {
    assert.equal(isNightShift(new Date('2026-06-15T21:59:00-03:00')), false);
    assert.equal(isNightShift(new Date('2026-06-15T22:00:00-03:00')), true);
    assert.equal(isNightShift(new Date('2026-06-16T03:30:00-03:00')), true);
    assert.equal(isNightShift(new Date('2026-06-16T05:59:00-03:00')), true);
    assert.equal(isNightShift(new Date('2026-06-16T06:00:00-03:00')), false);
});

test('shiftService resolves configured tenant operators and falls back safely without personal defaults', async () => {
    const origQuery = pool.query.bind(pool);
    const queriesExecuted = [];

    try {
        pool.query = async (sql) => {
            if (sql.includes('FROM operators')) return { rows: [] };
            if (sql.includes('FROM users')) {
                if (sql.includes('default_night_operator')) return { rows: [{ op_name: 'Carlos Noite' }] };
                if (sql.includes('default_day_operator')) return { rows: [{ op_name: 'Ana Dia' }] };
            }
            throw new Error(`Unexpected SQL: ${sql}`);
        };

        const nightConfigured = await getNightOperator(7);
        assert.deepEqual(nightConfigured, { id: null, name: 'Carlos Noite' });

        const dayConfigured = await getDayOperator(7);
        assert.deepEqual(dayConfigured, { id: null, name: 'Ana Dia' });

        pool.query = async (sql) => {
            queriesExecuted.push(sql);
            return { rows: [] };
        };

        const nightFallback = await getNightOperator(99);
        assert.deepEqual(nightFallback, { id: null, name: 'Operador Noite' });

        const dayFallback = await getDayOperator(99);
        assert.deepEqual(dayFallback, { id: null, name: 'Operador' });

        // Regardless of day/night shift, missing operator row (id === null) must NOT run UPDATE operators WHERE id = $1
        queriesExecuted.length = 0;
        await applyShiftAllocationRule(99);
        assert.equal(queriesExecuted.some(sql => /UPDATE\s+operators\b[\s\S]*WHERE\s+id\s*=/i.test(sql)), false);
    } finally {
        pool.query = origQuery;
    }
});
