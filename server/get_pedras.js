const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres'
});
async function run() {
  try {
    const jobs = await pool.query(`SELECT * FROM jobs WHERE folder ILIKE '%pedras palco%' OR file_name ILIKE '%pedras palco%' OR file_path ILIKE '%pedras palco%' ORDER BY start_time DESC LIMIT 10`);
    console.log('Jobs Pedras Palco:', jobs.rows);
  } finally { pool.end(); }
}
run();
