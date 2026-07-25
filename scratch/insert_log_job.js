const { Pool } = require('pg');
require('dotenv').config({ path: '../server/.env' });

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/mach3_db';
const pool = new Pool({ connectionString });

async function insertJob() {
  try {
    const userRes = await pool.query('SELECT id FROM users ORDER BY id ASC LIMIT 1');
    if (userRes.rows.length === 0) {
      console.log('No user found in database');
      return;
    }
    const userId = userRes.rows[0].id;
    console.log('Inserting for User ID:', userId);

    const startTime = new Date('2026-07-25T10:25:00-03:00').toISOString();

    // Check if PVC material exists
    const matRes = await pool.query('SELECT id, name, price FROM materials WHERE "userId" = $1 AND name ILIKE $2 LIMIT 1', [userId, '%pvc%']);
    const mat = matRes.rows[0];
    const matId = mat ? mat.id : null;
    const matName = mat ? mat.name : 'PVC';
    const matPrice = mat ? mat.price : 0;

    // Insert active job into jobs table
    const jobRes = await pool.query(
      `INSERT INTO jobs (file_name, folder, file_path, start_time, day, month, year, "userId", router_name, material_id, material_name, material_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      ['1 pvc 100mm b10mm', 'PARAQUEDAS - ISOPOR', 'C:\\CNC\\1 pvc 100mm b10mm.tap', startTime, 25, 7, 2026, userId, 'Router 2', matId, matName, matPrice]
    );
    const newJobId = jobRes.rows[0].id;
    console.log('Successfully inserted active job ID:', newJobId);

    // Insert into kanban_tasks table
    const kanbanRes = await pool.query(
      `INSERT INTO kanban_tasks (title, machine, operator, date, priority, column_id, "userId")
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      ['1 pvc 100mm b10mm', 'Router 2', 'Operador', '2026-07-25', 'alta', 'doing', userId]
    );
    console.log('Successfully inserted Kanban O.S. card ID:', kanbanRes.rows[0].id);

  } catch (err) {
    console.error('Error inserting log job:', err);
  } finally {
    await pool.end();
  }
}

insertJob();
