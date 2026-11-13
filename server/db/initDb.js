const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const pool = require('./pool');

// Helper to close stale jobs (> 3 hours or corrupted router_name)
async function closeStaleJobs(userId) {
    try {
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
        const staleJobs = (await pool.query(
            'SELECT id, start_time, estimated_minutes, router_name FROM jobs WHERE "userId" = $1 AND end_time IS NULL AND (start_time < $2 OR router_name LIKE \'%\\\\%\' OR router_name LIKE \'%.TXT%\' OR router_name LIKE \'%.txt%\')',
            [userId, threeHoursAgo]
        )).rows;

        for (const job of staleJobs) {
            const start = new Date(job.start_time);
            const estMin = job.estimated_minutes ? parseFloat(job.estimated_minutes) : 15;
            const end = new Date(start.getTime() + estMin * 60 * 1000).toISOString();
            await pool.query('UPDATE jobs SET end_time = $1, duration_minutes = $2 WHERE id = $3', [end, estMin, job.id]);
            console.log(`[CLEANUP] Locked stale job #${job.id}`);
        }

        // Also cleanup duplicate active jobs for the same router (keep only the newest)
        const activeRouters = (await pool.query(
            `SELECT router_name, COUNT(*) as cnt 
             FROM jobs 
             WHERE "userId" = $1 AND end_time IS NULL 
             GROUP BY router_name HAVING COUNT(*) > 1`,
            [userId]
        )).rows;

        for (const r of activeRouters) {
            const dupeJobs = (await pool.query(
                `SELECT id, start_time FROM jobs 
                 WHERE "userId" = $1 AND end_time IS NULL AND router_name = $2 
                 ORDER BY id DESC`,
                [userId, r.router_name]
            )).rows;
            // Keep the first (newest), close the rest
            for (let i = 1; i < dupeJobs.length; i++) {
                await pool.query('UPDATE jobs SET end_time = start_time, duration_minutes = 0.01 WHERE id = $1', [dupeJobs[i].id]);
                console.log(`[CLEANUP] Closed duplicate active job #${dupeJobs[i].id} for router ${r.router_name}`);
            }
        }
    } catch (e) {
        console.error("Cleanup stale jobs error:", e);
    }
}

// Maintenance: Keep only X days of history
async function runMaintenance() {
    try {
        // Retenção: desativado (0) para manter o histórico de produção e relatórios de 6 meses e anuais intactos
        const RETENTION_DAYS = 0; 
        if (RETENTION_DAYS > 0) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
            const cutoffStr = cutoffDate.toISOString();
            
            const result = await pool.query('DELETE FROM jobs WHERE start_time < $1 AND end_time IS NOT NULL', [cutoffStr]);
            if (result.rowCount > 0) {
                console.log(`[MAINTENANCE] Removed ${result.rowCount} old jobs (beyond ${RETENTION_DAYS} days)`);
            }
        }
    } catch (e) {
        console.error("Maintenance error:", e);
    }
}

// Initialize tables
async function initDb() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE,
                password TEXT,
                plan TEXT,
                trial_expiry TEXT,
                payment_status TEXT,
                "costPerHour" REAL DEFAULT 50,
                "plannedHours" REAL DEFAULT 8,
                role TEXT DEFAULT 'user'
            );
            CREATE TABLE IF NOT EXISTS materials (
                id SERIAL PRIMARY KEY,
                name TEXT,
                price REAL,
                feed_rate REAL DEFAULT 3000,
                pass_width REAL DEFAULT 100,
                "userId" INTEGER
            );
            CREATE TABLE IF NOT EXISTS jobs (
                id SERIAL PRIMARY KEY,
                file_name TEXT,
                folder TEXT,
                file_path TEXT,
                start_time TEXT,
                end_time TEXT,
                duration_minutes REAL,
                day INTEGER,
                month INTEGER,
                year INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "userId" INTEGER,
                material_id INTEGER,
                material_name TEXT,
                material_price REAL,
                router_name TEXT,
                estimated_minutes REAL,
                quantity INTEGER DEFAULT 1
            );
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
            CREATE TABLE IF NOT EXISTS routers (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT DEFAULT 'active',
                status_note TEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "userId" INTEGER
            );
            CREATE TABLE IF NOT EXISTS router_status_log (
                id SERIAL PRIMARY KEY,
                router_id INTEGER NOT NULL,
                router_name TEXT,
                status TEXT NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP,
                duration_minutes REAL,
                "userId" INTEGER
            );
            CREATE TABLE IF NOT EXISTS maintenance_schedule (
                id SERIAL PRIMARY KEY,
                router_id INTEGER NOT NULL,
                router_name TEXT,
                scheduled_date DATE NOT NULL,
                scheduled_time TIME,
                type TEXT DEFAULT 'preventive',
                description TEXT,
                parts_replaced TEXT,
                status TEXT DEFAULT 'pending',
                completed_at TIMESTAMP,
                technician TEXT,
                parts_cost REAL,
                "userId" INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            -- Alter table if missing parts_cost (for backward compatibility)
            ALTER TABLE maintenance_schedule ADD COLUMN IF NOT EXISTS parts_cost REAL;
            
            -- Alter jobs table if missing new columns (migration from old schema)
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS "userId" INTEGER;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS material_id INTEGER;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS material_name TEXT;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS material_price REAL;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS router_name TEXT;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS estimated_minutes REAL;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

            -- Alter materials table for m² calculation & sheet dimensions
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS feed_rate REAL DEFAULT 3000;
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS pass_width REAL DEFAULT 100;
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS sheet_width_mm REAL DEFAULT 2750;
            ALTER TABLE materials ADD COLUMN IF NOT EXISTS sheet_height_mm REAL DEFAULT 1850;

            -- Alter jobs table for bounding box coordinates from G-code
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_x REAL;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS max_y REAL;
            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS bounding_area_m2 REAL;

            -- Payments table
            CREATE TABLE IF NOT EXISTS payments (
                id SERIAL PRIMARY KEY,
                "userId" INTEGER NOT NULL,
                mp_preference_id TEXT,
                mp_payment_id TEXT,
                plan TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                amount REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Add plan and trial to users if missing
            ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_expiry TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'none';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS webhook_url TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expiry TIMESTAMP;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS features_override TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS company_role TEXT DEFAULT 'gerente';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS gerente_pin TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS supervisor_pin TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS company_logo TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'Escuro';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS report_email TEXT;
            ALTER TABLE users ALTER COLUMN report_email DROP DEFAULT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS default_day_operator TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS default_night_operator TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS pipeline_local_root TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS pipeline_cloud_root TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS pipeline_batches JSONB;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_report BOOLEAN DEFAULT true;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS idle_alert BOOLEAN DEFAULT true;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_report BOOLEAN DEFAULT false;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_idle_alert_at TIMESTAMP;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS last_daily_report_at TIMESTAMP;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_renewal TEXT DEFAULT '2026-11-01';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS company_legal_name TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS cnpj_cpf TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS billing_email TEXT;

            CREATE TABLE IF NOT EXISTS report_history (
                id SERIAL PRIMARY KEY,
                "userId" INTEGER NOT NULL,
                report_type TEXT NOT NULL,
                recipient_email TEXT NOT NULL,
                status TEXT NOT NULL,
                subject TEXT,
                summary TEXT,
                details JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE jobs ADD COLUMN IF NOT EXISTS operator_name TEXT;

            -- Kanban and Checklist tables
            CREATE TABLE IF NOT EXISTS kanban_tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                machine TEXT,
                operator TEXT,
                date TEXT,
                priority TEXT,
                column_id TEXT NOT NULL,
                "userId" INTEGER
            );
            ALTER TABLE kanban_tasks ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;
            ALTER TABLE kanban_tasks ADD COLUMN IF NOT EXISTS rescheduled_date TEXT;
            ALTER TABLE kanban_tasks ADD COLUMN IF NOT EXISTS reschedule_count INTEGER DEFAULT 0;
            ALTER TABLE kanban_tasks ADD COLUMN IF NOT EXISTS estimated_minutes REAL;

            CREATE TABLE IF NOT EXISTS checklists (
                id SERIAL PRIMARY KEY,
                machine_key TEXT NOT NULL,
                item_index INTEGER NOT NULL,
                done BOOLEAN NOT NULL DEFAULT FALSE,
                date TEXT NOT NULL,
                "userId" INTEGER,
                UNIQUE(machine_key, item_index, date, "userId")
            );

            CREATE TABLE IF NOT EXISTS checklist_items (
                id SERIAL PRIMARY KEY,
                machine_key TEXT NOT NULL,
                item_text TEXT NOT NULL,
                "userId" INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE routers ADD COLUMN IF NOT EXISTS operator_name TEXT;

            CREATE TABLE IF NOT EXISTS operators (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                shift TEXT DEFAULT 'Geral',
                "userId" INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            ALTER TABLE operators ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'disponivel';
            ALTER TABLE operators ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'Na Fábrica';

            CREATE TABLE IF NOT EXISTS operator_time_logs (
                id SERIAL PRIMARY KEY,
                "userId" INTEGER NOT NULL,
                operator_id INTEGER REFERENCES operators(id) ON DELETE CASCADE,
                operator_name TEXT NOT NULL,
                status TEXT NOT NULL,
                location TEXT,
                kanban_task_id INTEGER REFERENCES kanban_tasks(id) ON DELETE SET NULL,
                kanban_title TEXT,
                start_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP,
                duration_minutes REAL,
                notes TEXT,
                job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE
            );

            ALTER TABLE operator_time_logs ADD COLUMN IF NOT EXISTS job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE;
            CREATE INDEX IF NOT EXISTS idx_operator_time_logs_job_id ON operator_time_logs(job_id);

            CREATE TABLE IF NOT EXISTS kaizens (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Em avaliação',
                "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS occurrences (
                id SERIAL PRIMARY KEY,
                machine TEXT NOT NULL,
                type TEXT NOT NULL,
                description TEXT NOT NULL,
                severity TEXT NOT NULL DEFAULT 'media',
                status TEXT NOT NULL DEFAULT 'pending',
                "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS stock_items (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                machine TEXT NOT NULL,
                unit TEXT NOT NULL DEFAULT 'un',
                qty_current NUMERIC NOT NULL DEFAULT 0,
                qty_min NUMERIC NOT NULL DEFAULT 0,
                qty_max NUMERIC NOT NULL DEFAULT 100,
                "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS kanban_archive (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                machine TEXT,
                operator TEXT,
                priority TEXT,
                quality_rating INTEGER NOT NULL DEFAULT 5,
                qty_approved INTEGER NOT NULL DEFAULT 0,
                qty_rejected INTEGER NOT NULL DEFAULT 0,
                observations TEXT,
                archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS push_subscriptions (
                id SERIAL PRIMARY KEY,
                "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
                endpoint TEXT NOT NULL UNIQUE,
                p256dh TEXT NOT NULL,
                auth TEXT NOT NULL,
                user_agent TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS oficina_sync_state (
                id SERIAL PRIMARY KEY,
                payload JSONB,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS pipeline_completed_files (
                id SERIAL PRIMARY KEY,
                file_key TEXT UNIQUE NOT NULL,
                file_name TEXT,
                stage TEXT,
                subfolder TEXT,
                job_name TEXT,
                done BOOLEAN DEFAULT TRUE,
                operator_name TEXT,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "userId" INTEGER
            );
            ALTER TABLE pipeline_completed_files ADD COLUMN IF NOT EXISTS "userId" INTEGER;

            CREATE TABLE IF NOT EXISTS pipeline_reopen_files (
                id SERIAL PRIMARY KEY,
                file_key TEXT UNIQUE NOT NULL,
                reopened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reason TEXT,
                "userId" INTEGER
            );
            ALTER TABLE pipeline_reopen_files ADD COLUMN IF NOT EXISTS "userId" INTEGER;

            CREATE TABLE IF NOT EXISTS pipeline_file_batches (
                id SERIAL PRIMARY KEY,
                file_key TEXT UNIQUE NOT NULL,
                file_name TEXT,
                subfolder TEXT,
                job_name TEXT,
                target_quantity INTEGER DEFAULT 1,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "userId" INTEGER
            );
            ALTER TABLE pipeline_file_batches ADD COLUMN IF NOT EXISTS "userId" INTEGER;

            CREATE TABLE IF NOT EXISTS pipeline_live_snapshot (
                id INTEGER PRIMARY KEY,
                snapshot_data JSONB,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
        `);

        // SEED OFICINA SYNC STATE
        try {
            const syncRes = await pool.query('SELECT count(*) as count FROM oficina_sync_state');
            if (parseInt(syncRes.rows[0].count) === 0) {
                const snapFile = path.join(__dirname, '..', 'initial_snapshot.json');
                if (fs.existsSync(snapFile)) {
                    console.log('[SEED] Populando estado inicial de sincronização 3 - OFICINA...');
                    const snapData = JSON.parse(fs.readFileSync(snapFile, 'utf8'));
                    await pool.query('INSERT INTO oficina_sync_state (payload, updated_at) VALUES ($1, NOW())', [snapData]);
                }
            }
        } catch (seedErr) {
            console.error('[SEED ERROR] oficina_sync_state:', seedErr);
        }

        // SEED: Ensure Casadotrem exists (never uses hardcoded weak password)
        const userRes = await pool.query('SELECT * FROM users WHERE email = $1', ['casadotrem@gmail.com']);
        if (userRes.rowCount === 0) {
            const initialPass = (process.env.INITIAL_ADMIN_PASSWORD || '').trim() || crypto.randomBytes(12).toString('hex');
            console.log("[SEED] Criando conta administradora casadotrem@gmail.com...");
            if (!process.env.INITIAL_ADMIN_PASSWORD) {
                console.warn(`[SEED] Defina INITIAL_ADMIN_PASSWORD no .env; senha temporária gerada para primeiro login: ${initialPass}`);
            }
            const hash = bcrypt.hashSync(initialPass, 10);
            await pool.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3)', ['casadotrem@gmail.com', hash, 'admin']);
        }

        // SEED MATERIALS
        const matRes = await pool.query('SELECT count(*) as count FROM materials');
        if (parseInt(matRes.rows[0].count) === 0) {
            console.log("[SEED] Populando materiais padrão...");
            const masterUser = (await pool.query('SELECT id FROM users WHERE email = $1', ['casadotrem@gmail.com'])).rows[0];
            if (masterUser) {
                const defaultMaterials = [
                    ["mdf 15mm", 180, masterUser.id],
                    ["mdf 9mm", 100, masterUser.id],
                    ["mdf 9mm naval", 250, masterUser.id],
                    ["mdf 6mm", 90, masterUser.id],
                    ["mdf 3mm", 80, masterUser.id],
                    ["pvc", 60, masterUser.id],
                    ["pvc +", 120, masterUser.id],
                    ["isopor N", 60, masterUser.id],
                    ["isopor +", 120, masterUser.id]
                ];
                for (const m of defaultMaterials) {
                    await pool.query('INSERT INTO materials (name, price, "userId") VALUES ($1, $2, $3)', m);
                }
            }
        }

        // SEED ROUTERS
        const masterUser = (await pool.query('SELECT id FROM users WHERE email = $1', ['casadotrem@gmail.com'])).rows[0];
        if (masterUser) {
            const routerRes = await pool.query('SELECT count(*) as count FROM routers WHERE "userId" = $1', [masterUser.id]);
            if (parseInt(routerRes.rows[0].count) === 0) {
                console.log("[SEED] Criando routers padrão...");
                await pool.query('INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3)', ['Router Central', 'active', masterUser.id]);
                await pool.query('INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3)', ['Router 2', 'active', masterUser.id]);
                await pool.query('INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3)', ['Laser Ruida', 'active', masterUser.id]);
            } else {
                // Rename Router 1 to Router Central if present
                await pool.query("UPDATE routers SET name = 'Router Central' WHERE (name ILIKE '%router 1%' OR name ILIKE '%router1%') AND \"userId\" = $1", [masterUser.id]);
                // Guarantee Laser Ruida router exists
                const laserCheck = await pool.query("SELECT id FROM routers WHERE name ILIKE '%laser%' AND \"userId\" = $1", [masterUser.id]);
                if (laserCheck.rows.length === 0) {
                    console.log("[SEED] Adicionando máquina Laser Ruida...");
                    await pool.query('INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3)', ['Laser Ruida', 'active', masterUser.id]);
                }
                // Guarantee Máquina a Vácuo router exists
                const vacuoCheck = await pool.query("SELECT id FROM routers WHERE (name ILIKE '%vacuo%' OR name ILIKE '%vácuo%') AND \"userId\" = $1", [masterUser.id]);
                if (vacuoCheck.rows.length === 0) {
                    console.log("[SEED] Adicionando Máquina a Vácuo...");
                    await pool.query('INSERT INTO routers (name, status, "userId") VALUES ($1, $2, $3)', ['Máquina a Vácuo', 'active', masterUser.id]);
                }
            }
        }

        // SEED ROUTER STATUS LOG
        const logRes = await pool.query('SELECT count(*) as count FROM router_status_log');
        if (parseInt(logRes.rows[0].count) === 0) {
            console.log("[SEED] Populando histórico de status inicial...");
            const allRouters = (await pool.query('SELECT * FROM routers')).rows;
            for (const r of allRouters) {
                await pool.query(
                    'INSERT INTO router_status_log (router_id, router_name, status, status_note, started_at, "userId") VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5)',
                    [r.id, r.name, r.status, 'Status inicial', r.userId]
                );
            }
        }
        console.log("Banco de dados PostgreSQL inicializado com sucesso.");
        runMaintenance();
        setInterval(runMaintenance, 24 * 60 * 60 * 1000);
    } catch (err) {
        console.error("DB Seed Error:", err);
    }
}

module.exports = { closeStaleJobs, runMaintenance, initDb };
