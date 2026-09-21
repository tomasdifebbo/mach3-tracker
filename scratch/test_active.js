const { Pool } = require('c:/DASHBOARD/server/node_modules/pg');
const pool = new Pool({
    connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function run() {
    const res = await pool.query('SELECT id, file_name, router_name, start_time, end_time, "userId" FROM jobs WHERE "userId" = 1 AND end_time IS NULL');
    console.log('User 1 active jobs:', res.rows);
    pool.end();
}
run();
