const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });
async function run() {
  try {
    const jobs = await pool.query(`SELECT id, file_name, operator_name, start_time FROM jobs WHERE folder = 'PEDRAS PALCO' ORDER BY start_time ASC`);
    console.log('All Pedras Palco:', jobs.rows);
  } finally { pool.end(); }
}
run();
