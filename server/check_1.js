const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });
async function run() {
  try {
    const jobs = await pool.query(`SELECT file_name FROM jobs WHERE folder = 'PEDRAS PALCO'`);
    console.log('Registered files:', jobs.rows.map(r => r.file_name));
  } finally { pool.end(); }
}
run();
