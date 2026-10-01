const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres'
});
async function run() {
  try {
    const res = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
    console.log('Tables:', res.rows.map(r => r.table_name));
    const jobs = await pool.query(`SELECT * FROM jobs ORDER BY start_time DESC LIMIT 10`);
    console.log('Recent jobs:', jobs.rows);
  } finally { pool.end(); }
}
run();
