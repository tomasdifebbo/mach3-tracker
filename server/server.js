const { PORT } = require('./config/constants');
const pool = require('./db/pool');
const { initDb } = require('./db/initDb');
const { applyShiftAllocationRule } = require('./services/shiftService');
const { executeReportCycle } = require('./services/reportService');
const { autoSyncKanban } = require('./services/kanbanSyncService');
const { createApp } = require('./app');
const RuidaMonitor = require('./ruida_monitor');

const port = PORT;

process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION PREVENTED CRASH]:', err.message);
});

process.on('unhandledRejection', (reason) => {
    console.error('[UNHANDLED REJECTION PREVENTED CRASH]:', reason ? (reason.message || reason) : 'desconhecido');
});

const app = createApp();

initDb().then(() => {
    try {
        const ruida = new RuidaMonitor(pool, autoSyncKanban);
        ruida.start();
    } catch (err) {
        console.error('[RUIDA MONITOR START ERROR]', err);
    }
});

// Automated Report & Machine Alert Scheduler (runs every 60s)
setInterval(async () => {
    try {
        // Regra contínua de alocação de turno nas máquinas (Período Noturno após as 22h / Diurno às 06h)
        await applyShiftAllocationRule().catch(e => console.error('[SHIFT ALLOCATION RULE ERROR]', e));

        const now = new Date();
        const spParts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Sao_Paulo',
            hour: 'numeric',
            minute: 'numeric',
            hour12: false
        }).formatToParts(now);

        const hours = Number(spParts.find(p => p.type === 'hour')?.value || 0);
        const minutes = Number(spParts.find(p => p.type === 'minute')?.value || 0);

        // Daily 18:00 Report
        if (hours === 18 && minutes === 0) {
            const usersForDaily = (await pool.query(
                `SELECT id FROM users 
                 WHERE daily_report = true 
                   AND (last_daily_report_at IS NULL OR last_daily_report_at < NOW() - INTERVAL '12 HOURS')`
            )).rows;

            for (const u of usersForDaily) {
                console.log(`[SCHEDULED AUTOMATION] Triggering 18:00 daily report for user #${u.id}`);
                await executeReportCycle(u.id).catch(e => console.error(`[DAILY REPORT ERROR user #${u.id}]`, e));
            }
        }

        // Idle Machine Alert check (every 30 minutes, throttled to 2 hours between dispatches)
        if (minutes === 0 || minutes === 30) {
            const usersForIdle = (await pool.query(
                `SELECT id FROM users 
                 WHERE idle_alert = true 
                   AND (last_idle_alert_at IS NULL OR last_idle_alert_at < NOW() - INTERVAL '2 HOURS')`
            )).rows;

            for (const u of usersForIdle) {
                const routers = (await pool.query('SELECT * FROM routers WHERE "userId" = $1', [u.id])).rows;
                let hasIdleMachine = false;
                for (const r of routers) {
                    const lastJob = (await pool.query('SELECT * FROM jobs WHERE ("userId" = $1) AND (router_name ILIKE $2) ORDER BY id DESC LIMIT 1', [u.id, `%${r.name}%`])).rows[0];
                    if (lastJob) {
                        const t = new Date(lastJob.end_time || lastJob.start_time);
                        if (!isNaN(t.getTime()) && (now.getTime() - t.getTime()) >= 60 * 60 * 1000) {
                            hasIdleMachine = true;
                            break;
                        }
                    } else {
                        hasIdleMachine = true;
                        break;
                    }
                }

                if (hasIdleMachine) {
                    console.log(`[SCHEDULED AUTOMATION] Idle machine detected for user #${u.id}. Dispatching alert.`);
                    await executeReportCycle(u.id).catch(e => console.error(`[IDLE ALERT ERROR user #${u.id}]`, e));
                }
            }
        }
    } catch (schedErr) {
        console.error('[SCHEDULER ERROR]', schedErr);
    }
}, 60000);

app.listen(port, '0.0.0.0', () => {
    console.log(`Premium Server (PostgreSQL) running on port ${port}`);
});
