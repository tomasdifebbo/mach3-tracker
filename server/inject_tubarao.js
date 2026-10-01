const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });

const dir = 'E:\\arquivos 2024\\ARQUIVOS 2026\\router\\TUBARÃO\\';

async function run() {
  // Start time in UTC for 09:00 AM local time (UTC-3)
  let currentTime = new Date('2026-09-30T12:00:00.000Z').getTime();

  for (let i = 1; i <= 5; i++) {
    const fileName = `${i}PVC 100mm b10mm.txt`;
    const filePath = path.join(dir, fileName);
    
    let maxX = 1900;
    let maxY = 900;
    let estimatedMinutes = 60; // default 1 hour
    
    try {
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        let lx = 0, ly = 0;
        let totalDistance = 0;
        for (const line of lines) {
          const matchX = line.match(/X([0-9\.]+)/);
          const matchY = line.match(/Y([0-9\.]+)/);
          if (matchX && matchY) {
            const x = parseFloat(matchX[1]);
            const y = parseFloat(matchY[1]);
            if (x > maxX || maxX === 1900) maxX = x;
            if (y > maxY || maxY === 900) maxY = y;
            const dist = Math.sqrt(Math.pow(x - lx, 2) + Math.pow(y - ly, 2));
            totalDistance += dist;
            lx = x; ly = y;
          }
        }
        // Approximate time: 1500 mm/min feedrate average for 100mm PVC
        estimatedMinutes = (totalDistance / 1500);
        if (estimatedMinutes < 10) estimatedMinutes = 60;
      } else {
        console.warn('File not found:', filePath);
      }
    } catch (e) {
      console.error('Error reading file:', fileName, e.message);
    }

    const boundingArea = (maxX / 1000) * (maxY / 1000);
    const durationMinutes = estimatedMinutes;
    const durationMs = durationMinutes * 60 * 1000;

    let routerName = 'Router 2';
    
    let startTime = currentTime;
    let endTime = startTime + durationMs;
    // Next file starts 5 mins after this one ends
    currentTime = endTime + (5 * 60 * 1000);

    const dtStart = new Date(startTime);
    const dtEnd = new Date(endTime);

    console.log(`Injecting ${fileName} for brenno on ${routerName} at ${dtStart.toISOString()} (Est: ${estimatedMinutes.toFixed(1)}m, Area: ${boundingArea.toFixed(2)}m2)`);

    await pool.query(`
      INSERT INTO jobs (
        file_name, folder, file_path, start_time, end_time, duration_minutes,
        day, month, year, "userId", router_name, estimated_minutes, operator_name,
        max_x, max_y, bounding_area_m2, quantity
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      )
    `, [
      fileName, 'TUBARÃO', filePath, dtStart.toISOString(), dtEnd.toISOString(), durationMinutes,
      dtStart.getDate(), dtStart.getMonth() + 1, dtStart.getFullYear(), 1, routerName, estimatedMinutes, 'brenno',
      maxX, maxY, boundingArea, 1
    ]);
  }
  
  console.log("Done inserting jobs!");
  pool.end();
}

run();
