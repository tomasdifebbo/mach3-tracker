const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });
async function run() {
  try {
    const jobs = await pool.query(`SELECT file_name, router_name, start_time FROM jobs WHERE start_time >= '2026-09-30T10:00:00Z' ORDER BY start_time ASC`);
    console.log('Jobs today details:', jobs.rows);
  } finally { pool.end(); }
}
run();
