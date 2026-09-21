const fs = require('fs');
const { Pool } = require('c:/DASHBOARD/server/node_modules/pg');

const pool = new Pool({
    connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

const queuePath = 'c:/DASHBOARD/monitor/fila_sincronizacao.json';
const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
const userId = 1;

async function syncAll() {
    console.log('Processing ' + queue.length + ' queued items...');
    for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        const p = item.payload;
        if (item.method === 'POST') {
            const dt = new Date(p.start_time);
            let cleanRouterName = p.router_name;
            let cleanFileName = p.file_name || 'Desconhecido';
            let cleanFolder = p.folder || 'Desconhecido';
            if (cleanFolder && cleanFolder.includes(' | ')) cleanFolder = cleanFolder.split(' | ').pop();

            // Close any previous open jobs for this router
            const openJobs = (await pool.query('SELECT id, start_time FROM jobs WHERE "userId" = $1 AND end_time IS NULL AND router_name = $2', [userId, cleanRouterName])).rows;
            for (const j of openJobs) {
                const prevStart = new Date(j.start_time);
                const duration = Math.max(0.1, (dt - prevStart) / (1000 * 60));
                await pool.query('UPDATE jobs SET end_time = $1, duration_minutes = $2 WHERE id = $3', [dt.toISOString(), duration, j.id]);
            }

            const res = await pool.query(
                'INSERT INTO jobs (file_name, folder, file_path, start_time, day, month, year, "userId", router_name, estimated_minutes, material_id, material_name, material_price, max_x, max_y, bounding_area_m2, quantity) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING id',
                [cleanFileName, cleanFolder, p.file_path || 'Desconhecido', dt.toISOString(), dt.getDate(), dt.getMonth() + 1, dt.getFullYear(), userId, cleanRouterName, p.estimated_minutes, p.material_id, p.material_name, p.material_price, p.max_x, p.max_y, p.bounding_area_m2, 1]
            );
            console.log(`[#${i}] POST ${cleanRouterName} -> Job ID ${res.rows[0].id} (${cleanFileName})`);
        } else if (item.method === 'PATCH') {
            const dt = new Date(p.end_time);
            const cleanRouterName = p.router_name;
            const openJob = (await pool.query('SELECT id, start_time FROM jobs WHERE "userId" = $1 AND end_time IS NULL AND router_name = $2 ORDER BY start_time DESC LIMIT 1', [userId, cleanRouterName])).rows[0];
            if (openJob) {
                const prevStart = new Date(openJob.start_time);
                const duration = Math.max(0.01, (dt - prevStart) / (1000 * 60));
                await pool.query('UPDATE jobs SET end_time = $1, duration_minutes = $2 WHERE id = $3', [dt.toISOString(), duration, openJob.id]);
                console.log(`[#${i}] PATCH ${cleanRouterName} -> Closed Job ID ${openJob.id} (${duration.toFixed(2)} min)`);
            } else {
                console.log(`[#${i}] PATCH ${cleanRouterName} -> No open job found`);
            }
        }
    }

    // Clear queue
    fs.writeFileSync(queuePath, '[]');
    console.log('Queue completely synced and cleared!');
    pool.end();
}

syncAll().catch(e => { console.error('Error:', e); pool.end(); });
