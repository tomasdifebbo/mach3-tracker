const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres'
});

async function run() {
  try {
    const operators = await pool.query("SELECT * FROM operators WHERE name ILIKE '%italo%'");
    console.log("Operators:", operators.rows);

    const machines = await pool.query("SELECT * FROM machines");
    console.log("Machines:", machines.rows);

    const projects = await pool.query("SELECT * FROM projects WHERE name ILIKE '%pedras palco%'");
    console.log("Projects:", projects.rows);

    // Get the last job from yesterday
    const lastJobs = await pool.query(`
      SELECT * FROM jobs 
      WHERE start_time >= '2026-09-25T00:00:00Z' AND start_time < '2026-09-26T00:00:00Z'
      ORDER BY start_time DESC LIMIT 5
    `);
    console.log("Last jobs from yesterday:", lastJobs.rows);

  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
