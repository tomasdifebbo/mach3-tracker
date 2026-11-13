const pool = require('../db/pool');

// ===== REGRAS DE TURNO E ALOCAÇÃO AUTOMÁTICA DE OPERADORES =====
// Regra: Todas as operações após as 22:00 (Período Noturno: 22:00 às 05:59:59)
// são vinculadas ao operador do período noturno do tenant e ele é automaticamente alocado nas máquinas
function isNightShift(date = new Date()) {
    try {
        const d = (date instanceof Date) ? date : new Date(date);
        const hourStr = new Intl.DateTimeFormat('pt-BR', {
            timeZone: 'America/Sao_Paulo',
            hour: 'numeric',
            hour12: false
        }).format(d);
        const hour = parseInt(hourStr, 10);
        return hour >= 22 || hour < 6;
    } catch {
        const h = (date instanceof Date ? date : new Date(date)).getHours();
        return h >= 22 || h < 6;
    }
}

async function resolveShiftOperator({ userId = 1, shiftValues, userColumn, envKey, defaultLabel }) {
    const envDefault = (process.env[envKey] || '').trim();
    try {
        const opRes = await pool.query(
            `SELECT id, name FROM operators
             WHERE LOWER(COALESCE(shift, '')) = ANY($1::text[]) AND "userId" = $2
             ORDER BY id ASC LIMIT 1`,
            [shiftValues, userId]
        );
        if (opRes.rows.length > 0 && opRes.rows[0].name) return opRes.rows[0];

        const userRes = await pool.query(
            `SELECT ${userColumn} AS op_name FROM users WHERE id = $1 LIMIT 1`,
            [userId]
        );
        const configured = (userRes.rows[0]?.op_name || '').trim();
        if (configured) return { id: null, name: configured };

        return { id: null, name: envDefault || defaultLabel };
    } catch {
        return { id: null, name: envDefault || defaultLabel };
    }
}

async function getNightOperator(userId = 1) {
    return resolveShiftOperator({
        userId,
        shiftValues: ['noite', 'night', 'noturno'],
        userColumn: 'default_night_operator',
        envKey: 'DEFAULT_NIGHT_OPERATOR',
        defaultLabel: 'Operador Noite'
    });
}

async function getDayOperator(userId = 1) {
    return resolveShiftOperator({
        userId,
        shiftValues: ['manha', 'manhã', 'dia', 'day', 'diurno', 'tarde'],
        userColumn: 'default_day_operator',
        envKey: 'DEFAULT_DAY_OPERATOR',
        defaultLabel: 'Operador'
    });
}

async function applyShiftAllocationRule(targetUserId = null) {
    try {
        const now = new Date();
        const night = isNightShift(now);

        const usersQuery = targetUserId
            ? { rows: [{ id: targetUserId }] }
            : await pool.query('SELECT DISTINCT "userId" AS id FROM operators WHERE "userId" IS NOT NULL');

        const userIds = usersQuery.rows.map(u => u.id);
        if (!userIds.includes(1)) userIds.push(1);

        for (const uId of userIds) {
            if (night) {
                const nightOp = await getNightOperator(uId);
                if (!nightOp || !nightOp.name) continue;

                // 1. Aloca automaticamente o operador do período noturno em todas as máquinas de corte ativas / routers
                await pool.query(
                    `UPDATE routers 
                     SET operator_name = $1 
                     WHERE "userId" = $2 
                       AND (operator_name IS NULL OR LOWER(operator_name) != LOWER($1))`,
                    [nightOp.name, uId]
                );

                // 2. Vincula qualquer job que iniciou ou está rodando no período noturno ao operador noturno
                await pool.query(
                    `UPDATE jobs 
                     SET operator_name = $1 
                     WHERE "userId" = $2 
                       AND (
                         EXTRACT(HOUR FROM (start_time AT TIME ZONE 'America/Sao_Paulo')) >= 22 
                         OR EXTRACT(HOUR FROM (start_time AT TIME ZONE 'America/Sao_Paulo')) < 6
                       )
                       AND (operator_name IS NULL OR LOWER(operator_name) != LOWER($1))`,
                    [nightOp.name, uId]
                );

                // 3. Atualiza o status do operador noturno para disponível e alocado nas máquinas (se cadastrado)
                if (nightOp.id) {
                    await pool.query(
                        `UPDATE operators 
                         SET status = 'disponivel', location = '⚙️ Routers CNC (Turno Noite)' 
                         WHERE id = $1`,
                        [nightOp.id]
                    );
                }

                // 4. Marca operadores diurnos como ausentes/fora do turno durante a madrugada
                await pool.query(
                    `UPDATE operators 
                     SET status = 'ausente', location = 'Fora do Turno' 
                     WHERE "userId" = $1 AND LOWER(shift) != 'noite' AND status = 'disponivel'`,
                    [uId]
                );
            } else {
                // Período Diurno (06:00 às 21:59)
                const dayOp = await getDayOperator(uId);
                const nightOp = await getNightOperator(uId);
                if (dayOp && dayOp.name && nightOp && nightOp.name) {
                    // Transfere as máquinas de volta para o operador diurno se ainda estiverem com o da noite
                    await pool.query(
                        `UPDATE routers 
                         SET operator_name = $1 
                         WHERE "userId" = $2 AND LOWER(operator_name) = LOWER($3)`,
                        [dayOp.name, uId, nightOp.name]
                    );

                    // Coloca o operador noturno como fora do turno (se cadastrado)
                    if (nightOp.id) {
                        await pool.query(
                            `UPDATE operators 
                             SET status = 'ausente', location = 'Fora do Turno (Turno Noturno)' 
                             WHERE id = $1 AND status = 'disponivel'`,
                            [nightOp.id]
                        );
                    }
                }
            }
        }
    } catch (err) {
        console.error('Erro em applyShiftAllocationRule:', err);
    }
}

module.exports = {
    isNightShift,
    getNightOperator,
    getDayOperator,
    applyShiftAllocationRule
};
