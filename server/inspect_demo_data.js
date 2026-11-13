const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function inspect() {
  const demoId = 3;
  const routers = await pool.query('SELECT * FROM routers WHERE "userId" = $1', [demoId]);
  const operators = await pool.query('SELECT * FROM operators WHERE "userId" = $1', [demoId]);
  const materials = await pool.query('SELECT * FROM materials WHERE "userId" = $1', [demoId]);
  const kanban = await pool.query('SELECT * FROM kanban_tasks WHERE "userId" = $1', [demoId]);
  const jobs = await pool.query('SELECT * FROM jobs WHERE "userId" = $1 LIMIT 5', [demoId]);
  
  console.log('--- ROUTERS ---', routers.rows);
  console.log('--- OPERATORS ---', operators.rows);
  console.log('--- MATERIALS ---', materials.rows);
  console.log('--- KANBAN ---', kanban.rows);
  console.log('--- JOBS SAMPLE ---', jobs.rows);

  await pool.end();
}

inspect().catch(console.error);
