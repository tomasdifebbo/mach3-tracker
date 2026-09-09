const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
  ssl: { rejectUnauthorized: false }
});

const folderPath = 'E:\\arquivos 2024\\ARQUIVOS 2026\\router\\2652c - parede A';

// Simulated G-code data captured from simulation:
const chapasData = [
  { num: 21, fname: '21 pvc 100mm b12mm.txt', est_min: 49.22, max_x: 1876.47, max_y: 844.98, area_m2: 1.586 },
  { num: 22, fname: '22 pvc 100mm b12mm.txt', est_min: 56.57, max_x: 1860.00, max_y: 875.01, area_m2: 1.628 },
  { num: 23, fname: '23 pvc 100mm b12mm.txt', est_min: 43.47, max_x: 1854.00, max_y: 894.65, area_m2: 1.659 },
  { num: 24, fname: '24 pvc 100mm b12mm.txt', est_min: 40.34, max_x: 1596.00, max_y: 862.15, area_m2: 1.376 },
  { num: 25, fname: '25 pvc 100mm b12mm.txt', est_min: 49.75, max_x: 1920.00, max_y: 928.22, area_m2: 1.782 },
  { num: 26, fname: '26 pvc 100mm b12mm.txt', est_min: 37.54, max_x: 1608.00, max_y: 831.41, area_m2: 1.337 },
  { num: 27, fname: '27 pvc 100mm b12mm.txt', est_min: 35.89, max_x: 1824.00, max_y: 854.21, area_m2: 1.558 },
  { num: 28, fname: '28 pvc 100mm b12mm.txt', est_min: 41.66, max_x: 1860.00, max_y: 611.58, area_m2: 1.138 },
  { num: 29, fname: '29 pvc 100mm b12mm.txt', est_min: 51.02, max_x: 1866.00, max_y: 848.11, area_m2: 1.583 },
  { num: 30, fname: '30 pvc 100mm b12mm.txt', est_min: 50.30, max_x: 1854.00, max_y: 749.66, area_m2: 1.390 },
  { num: 31, fname: '31 pvc 100mm b12mm.txt', est_min: 50.00, max_x: 1866.00, max_y: 818.24, area_m2: 1.527 },
  { num: 32, fname: '32 pvc 100mm b12mm.txt', est_min: 47.10, max_x: 1854.00, max_y: 820.84, area_m2: 1.522 },
  { num: 33, fname: '33 pvc 100mm b12mm.txt', est_min: 50.20, max_x: 1860.00, max_y: 931.79, area_m2: 1.733 }
];

async function insertChapas() {
  console.log('=== INSERINDO CHAPAS 21 A 33 (04/09/2026 - 11:00 às 16:00) ===');
  
  // Total window: 300 minutes (18,000 seconds) from 11:00:00 to 16:00:00 BRT on 2026-09-04
  const totalSimMin = chapasData.reduce((acc, c) => acc + c.est_min, 0); // 603.06 min
  const windowSec = 300 * 60; // 18000 sec
  const scale = windowSec / (totalSimMin * 60);

  let currentMs = new Date('2026-09-04T11:00:00-03:00').getTime();

  let insertedCount = 0;

  for (const c of chapasData) {
    const durSec = c.est_min * 60 * scale;
    const startDt = new Date(currentMs);
    const endDt = new Date(currentMs + durSec * 1000);
    const durMin = Math.round((durSec / 60) * 100) / 100;
    const filePath = path.join(folderPath, c.fname);

    // Check if job already exists
    const checkRes = await pool.query(
      `SELECT id FROM jobs WHERE "userId" = 1 AND file_name = $1 AND folder = $2 AND day = 4 AND month = 9 AND year = 2026`,
      [c.fname, '2652c - parede A']
    );

    if (checkRes.rows.length > 0) {
      console.log(`[EXISTE] Chapa ${c.num} (${c.fname}) já está registrada no banco (ID ${checkRes.rows[0].id}).`);
    } else {
      const query = `
        INSERT INTO jobs (
          file_name, folder, file_path, start_time, end_time, duration_minutes,
          day, month, year, "userId", router_name, estimated_minutes,
          material_id, material_name, material_price, operator_name,
          max_x, max_y, bounding_area_m2, quantity
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19, $20
        ) RETURNING id
      `;

      const values = [
        c.fname,                             // $1
        '2652c - parede A',                 // $2
        filePath,                            // $3
        startDt.toISOString(),               // $4
        endDt.toISOString(),                 // $5
        durMin,                              // $6
        4,                                   // $7 (day)
        9,                                   // $8 (month)
        2026,                                // $9 (year)
        1,                                   // $10 (userId casadotrem)
        'Router Central',                    // $11 (router_name)
        c.est_min,                           // $12
        26,                                  // $13 (material_id pvc)
        'pvc',                               // $14 (material_name)
        30,                                  // $15 (material_price)
        'italo',                             // $16 (operator_name)
        c.max_x,                             // $17
        c.max_y,                             // $18
        c.area_m2,                           // $19
        1                                    // $20 (quantity)
      ];

      const res = await pool.query(query, values);
      const newJobId = res.rows[0].id;

      // Also log operator timeline entry
      await pool.query(`
        INSERT INTO operator_time_logs (
          operator_id, operator_name, machine_name, job_id, file_name,
          start_time, end_time, duration_minutes, "userId"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9
        )
      `, [
        1,                                   // operator_id (Italo)
        'italo',                             // operator_name
        'Router Central',                    // machine_name
        newJobId,                            // job_id
        c.fname,                             // file_name
        startDt.toISOString(),               // start_time
        endDt.toISOString(),                 // end_time
        durMin,                              // duration_minutes
        1                                    // userId
      ]);

      insertedCount++;
      const fmtStart = startDt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const fmtEnd = endDt.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      console.log(`[INSERIDO] ID ${newJobId} | Chapa ${c.num} (${c.fname}) | ${fmtStart} -> ${fmtEnd} (${durMin} min)`);
    }

    currentMs = endDt.getTime();
  }

  console.log(`\n==========================================`);
  console.log(`Inserção concluída: ${insertedCount} novas chapas adicionadas.`);
  console.log(`==========================================`);

  await pool.end();
}

insertChapas().catch(err => {
  console.error('Erro na inserção:', err);
  pool.end();
});
