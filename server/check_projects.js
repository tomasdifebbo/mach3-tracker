const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });
async function run() {
  try {
    const res = await pool.query(`SELECT * FROM projects`);
    console.log(res.rows);
  } catch (e) {
    console.log("Projects table error:", e.message);
  } finally { pool.end(); }
}
run();
