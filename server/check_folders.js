const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });
async function run() {
  try {
    const jobs = await pool.query(`SELECT DISTINCT folder FROM jobs`);
    console.log(jobs.rows.map(r => r.folder));
  } finally { pool.end(); }
}
run();
