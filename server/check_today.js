const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });
async function run() {
  try {
    const jobs = await pool.query(`SELECT id, file_name, operator_name, start_time FROM jobs WHERE start_time >= '2026-09-30T00:00:00Z' ORDER BY start_time DESC`);
    console.log('Jobs today:', jobs.rows);
  } finally { pool.end(); }
}
run();
