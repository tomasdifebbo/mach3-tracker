const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

async function check() {
    const r = await pool.query('SELECT COUNT(*) as total FROM jobs');
    console.log('Total jobs in DB:', r.rows[0].total);

    const r2 = await pool.query("SELECT id,file_name,folder,start_time,end_time,duration_minutes,material_name FROM jobs WHERE file_name ILIKE '%leonardo%' OR folder ILIKE '%leonardo%' ORDER BY start_time DESC");
    console.log('\nLeonardo jobs:', r2.rows.length);
    r2.rows.forEach(j => console.log(j.id, j.file_name, j.start_time, j.duration_minutes?.toFixed(1), j.material_name));

    const r3 = await pool.query('SELECT id,file_name,start_time,end_time,router_name FROM jobs WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 10');
    console.log('\nOpen jobs (currently running):', r3.rows.length);
    r3.rows.forEach(j => console.log(j.id, j.file_name, j.router_name, j.start_time));

    const r4 = await pool.query('SELECT id,file_name,start_time,end_time,duration_minutes FROM jobs ORDER BY start_time DESC LIMIT 5');
    console.log('\nMost recent 5 jobs:');
    r4.rows.forEach(j => console.log(j.id, j.file_name, j.start_time, j.end_time ? 'DONE' : 'RUNNING', j.duration_minutes?.toFixed(1)));

    process.exit(0);
}
check();
