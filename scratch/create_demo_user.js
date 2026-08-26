const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function createDemoUser() {
    try {
        console.log("=== CREATING DEMO USER & POPULATING MOCK DATA ===");

        const email = 'demo@mach3tracker.com';
        const passwordHash = await bcrypt.hash('demo123', 10);
        
        // 1. Create or update demo user
        const userRes = await pool.query(
            `INSERT INTO users (email, password_hash, plan, company_role, trial_expiry, company_name)
             VALUES ($1, $2, 'business', 'gerente', NOW() + INTERVAL '365 days', 'Fábrica Modelo CNC & Laser')
             ON CONFLICT (email) DO UPDATE 
             SET plan = 'business', trial_expiry = NOW() + INTERVAL '365 days', company_name = 'Fábrica Modelo CNC & Laser'
             RETURNING id, email`,
            [email, passwordHash]
        );

        const userId = userRes.rows[0].id;
        console.log(`[+] Demo User Ready: ID #${userId} | Email: ${email} | Password: demo123`);

        // 2. Clear old data for demo user
        await pool.query('DELETE FROM jobs WHERE "userId" = $1', [userId]);
        await pool.query('DELETE FROM materials WHERE "userId" = $1', [userId]);
        await pool.query('DELETE FROM routers WHERE "userId" = $1', [userId]);
        await pool.query('DELETE FROM operators WHERE "userId" = $1', [userId]);
        await pool.query('DELETE FROM kanban_tasks WHERE "userId" = $1', [userId]);
        await pool.query('DELETE FROM maintenance_schedule WHERE "userId" = $1', [userId]);

        // 3. Create Routers
        const r1 = await pool.query(`INSERT INTO routers (name, status, operator_name, status_note, "userId") VALUES ('CNC Router Central 1325', 'working', 'Tomás', 'Usinando painel MDF 15mm', $1) RETURNING id`, [userId]);
        const r2 = await pool.query(`INSERT INTO routers (name, status, operator_name, status_note, "userId") VALUES ('Router 2 (Precisão)', 'idle', 'Lucas', 'Aguardando próximo material', $1) RETURNING id`, [userId]);
        const r3 = await pool.query(`INSERT INTO routers (name, status, operator_name, status_note, "userId") VALUES ('Laser Ruida CO2 1390', 'working', 'Carlos', 'Corte de letras em acrílico 4mm', $1) RETURNING id`, [userId]);

        // 4. Create Operators
        await pool.query(`INSERT INTO operators (name, shift, "userId") VALUES ('Tomás', 'Manhã', $1)`, [userId]);
        await pool.query(`INSERT INTO operators (name, shift, "userId") VALUES ('Lucas', 'Tarde', $1)`, [userId]);
        await pool.query(`INSERT INTO operators (name, shift, "userId") VALUES ('Carlos', 'Geral', $1)`, [userId]);

        // 5. Create Materials
        const m1 = await pool.query(`INSERT INTO materials (name, price, feed_rate, pass_width, sheet_width_mm, sheet_height_mm, "userId") VALUES ('Acrílico Cristal 4mm', 180.00, 2500, 100, 2000, 1000, $1) RETURNING id`, [userId]);
        const m2 = await pool.query(`INSERT INTO materials (name, price, feed_rate, pass_width, sheet_width_mm, sheet_height_mm, "userId") VALUES ('MDF Cru 15mm', 120.00, 3500, 100, 2750, 1850, $1) RETURNING id`, [userId]);
        const m3 = await pool.query(`INSERT INTO materials (name, price, feed_rate, pass_width, sheet_width_mm, sheet_height_mm, "userId") VALUES ('ACM Prata 3mm', 210.00, 4000, 100, 1220, 2440, $1) RETURNING id`, [userId]);
        const m4 = await pool.query(`INSERT INTO materials (name, price, feed_rate, pass_width, sheet_width_mm, sheet_height_mm, "userId") VALUES ('PVC Expandido 10mm', 150.00, 3000, 100, 2000, 1000, $1) RETURNING id`, [userId]);

        // 6. Create Jobs (History & Active)
        const now = new Date();
        const pastDate = (minsAgo) => new Date(now.getTime() - minsAgo * 60000).toISOString();

        // Active Job 1 (Router Central)
        await pool.query(
            `INSERT INTO jobs (file_name, folder, file_path, start_time, end_time, duration_minutes, day, month, year, "userId", router_name, estimated_minutes, material_id, material_name, material_price, operator_name, max_x, max_y, bounding_area_m2)
             VALUES ('2629A - Painel Ripada Royal Enfield.tap', '2629A - Royal Enfield', 'E:\\arquivos 2026\\2629A - Royal Enfield\\2629A - Painel Ripada Royal Enfield.tap', $1, NULL, NULL, $2, $3, $4, $5, 'CNC Router Central 1325', 42.5, $6, 'MDF Cru 15mm', 120.00, 'Tomás', 2400.0, 1200.0, 2.880)`,
            [pastDate(25), now.getDate(), now.getMonth() + 1, now.getFullYear(), userId, m2.rows[0].id]
        );

        // Active Job 2 (Laser Ruida)
        await pool.query(
            `INSERT INTO jobs (file_name, folder, file_path, start_time, end_time, duration_minutes, day, month, year, "userId", router_name, estimated_minutes, material_id, material_name, material_price, operator_name, max_x, max_y, bounding_area_m2)
             VALUES ('LETRAS ROYAL ENFIELD.cdr', '2629A - Royal Enfield', 'C:\\Projetos\\2629A - Royal Enfield\\LETRAS ROYAL ENFIELD.cdr', $1, NULL, NULL, $2, $3, $4, $5, 'Laser Ruida CO2 1390', 18.0, $6, 'Acrílico Cristal 4mm', 180.00, 'Carlos', 850.0, 420.0, 0.357)`,
            [pastDate(10), now.getDate(), now.getMonth() + 1, now.getFullYear(), userId, m1.rows[0].id]
        );

        // Completed Jobs Today
        await pool.query(
            `INSERT INTO jobs (file_name, folder, file_path, start_time, end_time, duration_minutes, day, month, year, "userId", router_name, estimated_minutes, material_id, material_name, material_price, operator_name, max_x, max_y, bounding_area_m2)
             VALUES ('2578B - Predios Tartarugas Ninjas.tap', '2578B - Tartarugas Ninjas', 'E:\\arquivos 2026\\2578B - Tartarugas Ninjas\\2578B - Predios.tap', $1, $2, 38.5, $3, $4, $5, $6, 'CNC Router Central 1325', 40.0, $7, 'PVC Expandido 10mm', 150.00, 'Tomás', 2000.0, 1000.0, 2.000)`,
            [pastDate(120), pastDate(81.5), now.getDate(), now.getMonth() + 1, now.getFullYear(), userId, m4.rows[0].id]
        );

        await pool.query(
            `INSERT INTO jobs (file_name, folder, file_path, start_time, end_time, duration_minutes, day, month, year, "userId", router_name, estimated_minutes, material_id, material_name, material_price, operator_name, max_x, max_y, bounding_area_m2)
             VALUES ('2650C - Logo Fachada ACM.tap', '2650C - Fachada Loja', 'E:\\arquivos 2026\\2650C - Fachada\\2650C - Logo Fachada ACM.tap', $1, $2, 22.0, $3, $4, $5, $6, 'Router 2 (Precisão)', 24.0, $7, 'ACM Prata 3mm', 210.00, 'Lucas', 1220.0, 2440.0, 2.9768)`,
            [pastDate(180), pastDate(158), now.getDate(), now.getMonth() + 1, now.getFullYear(), userId, m3.rows[0].id]
        );

        // 7. Create Kanban Tasks
        const todayStr = now.toISOString().split('T')[0];
        await pool.query(
            `INSERT INTO kanban_tasks (title, machine, operator, date, priority, column_id, "userId") VALUES
             ('2629A - Royal Enfield - Painel & Letreiros', 'CNC Router Central 1325', 'Tomás', $1, 'alta', 'doing', $2),
             ('2650C - Fachada Loja ACM Prata', 'Router 2 (Precisão)', 'Lucas', $1, 'media', 'todo', $2),
             ('2578B - Tartarugas Ninjas - Cenografia', 'Laser Ruida CO2 1390', 'Carlos', $1, 'alta', 'done', $2),
             ('2680D - Totem Acrílico Iluminado', 'Laser Ruida CO2 1390', 'Carlos', $1, 'urgente', 'todo', $2)`,
            [todayStr, userId]
        );

        // 8. Create Maintenance Tasks
        await pool.query(
            `INSERT INTO maintenance_schedule (machine, task, type, due_date, status, notes, "userId") VALUES
             ('CNC Router Central 1325', 'Lubrificação dos Guias Lineares e Fuso de Esferas', 'Preventiva', $1, 'pendente', 'Utilizar graxa especial de lítio NLGI 2', $2),
             ('Laser Ruida CO2 1390', 'Troca de Água Destilada & Limpeza dos Espelhos/Lente', 'Preventiva', $1, 'concluido', 'Troca do fluido do chiller CW-5200 realizada', $2)`,
            [todayStr, userId]
        );

        console.log("=== MOCK DATA CREATED SUCCESSFULLY FOR DEMO USER ===");
        pool.end();
    } catch (err) {
        console.error("Error creating demo user:", err);
        pool.end();
    }
}

createDemoUser();
