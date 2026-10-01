const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });
async function run() {
  try {
    const jobsYesterday = await pool.query(`SELECT * FROM jobs WHERE start_time >= '2026-09-25T00:00:00Z' AND start_time < '2026-09-26T00:00:00Z' ORDER BY start_time DESC LIMIT 10`);
    console.log('Last jobs yesterday:', jobsYesterday.rows);
  } finally { pool.end(); }
}
run();
