const { Pool } = require('c:/DASHBOARD/server/node_modules/pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const res = await pool.query('SELECT id, file_name, router_name, start_time, end_time, duration_minutes FROM jobs WHERE "userId" = 1 AND day = 10 AND month = 9 ORDER BY id ASC');
    console.table(res.rows);
    pool.end();
}
run();
