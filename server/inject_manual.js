require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("Conectando ao banco de dados...");
        const user = (await pool.query('SELECT id FROM users WHERE email = $1', ['casadotrem@gmail.com'])).rows[0];
        if (!user) {
            console.error("Usuário não encontrado.");
            process.exit(1);
        }
        const userId = user.id;

        const mat = (await pool.query('SELECT id, name, price FROM materials WHERE "userId" = $1 AND name ILIKE $2 LIMIT 1', [userId, '%pvc%'])).rows[0];
        const material_id = mat ? mat.id : null;
        const material_name = mat ? mat.name : 'pvc';
        const material_price = mat ? mat.price : 60;

        const folder = '2627A - KETHLEBELL ADIDAS\\ISOPOR';
        
        const start1 = new Date('2026-07-06T16:00:00-03:00');
        const end1 = new Date('2026-07-06T17:05:00-03:00');
        await insertJob(userId, '1 pvc100mm b10mm.txt', folder, start1, end1, 65, material_id, material_name, material_price);

        const start2 = new Date('2026-07-06T17:05:00-03:00');
        const end2 = new Date('2026-07-06T18:00:00-03:00');
        await insertJob(userId, '2 pvc100mm b10mm.txt', folder, start2, end2, 55, material_id, material_name, material_price);

        const start3 = new Date('2026-07-07T08:00:00-03:00');
        const end3 = new Date('2026-07-07T09:00:00-03:00');
        await insertJob(userId, '3 pvc100mm b10mm.txt', folder, start3, end3, 60, material_id, material_name, material_price);

        console.log("Injeção concluída com sucesso.");
        process.exit(0);
    } catch (e) {
        console.error("Erro:", e);
        process.exit(1);
    }
}

async function insertJob(userId, fileName, folder, startDt, endDt, duration, matId, matName, matPrice) {
    console.log(`Inserindo job: ${fileName} (${duration} mins)`);
    await pool.query(`
        INSERT INTO jobs (
            "userId", file_name, folder, start_time, end_time, duration_minutes,
            day, month, year, created_at, router_name, material_id, material_name, material_price
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        )
    `, [
        userId,
        fileName,
        folder,
        startDt.toISOString(),
        endDt.toISOString(),
        duration,
        startDt.getDate(),
        startDt.getMonth() + 1,
        startDt.getFullYear(),
        endDt.toISOString(),
        'Router 2',
        matId,
        matName,
        matPrice
    ]);
}

run();
