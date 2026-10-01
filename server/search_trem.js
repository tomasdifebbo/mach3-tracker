const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });
async function run() {
  try {
    const tasks = await pool.query(`SELECT * FROM kanban_tasks WHERE title ILIKE '%trem%' OR title ILIKE '%casa%'`);
    console.log(tasks.rows);
  } finally { pool.end(); }
}
run();
