const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });
async function run() {
  try {
    const jobs = await pool.query(`
      SELECT file_path, folder, file_name, duration_minutes, estimated_minutes 
      FROM jobs 
      WHERE 
        file_path ILIKE '%2652%' OR folder ILIKE '%2652%' OR file_name ILIKE '%2652%'
        OR file_path ILIKE '%tubarão%' OR folder ILIKE '%tubarão%' OR file_name ILIKE '%tubarão%'
        OR file_path ILIKE '%coral%' OR folder ILIKE '%coral%' OR file_name ILIKE '%coral%'
        OR file_path ILIKE '%tartaruga%' OR folder ILIKE '%tartaruga%' OR file_name ILIKE '%tartaruga%'
    `);
    
    let a=0, b=0, c=0, u=0;
    jobs.rows.forEach(job => {
      const pathStr = (job.file_path + job.folder + job.file_name).toUpperCase();
      const dur = parseFloat(job.duration_minutes) || parseFloat(job.estimated_minutes) || 0;
      
      if (pathStr.includes('SUBMARINO') || pathStr.includes('2652B')) {
         b += dur;
      } else if (pathStr.includes('PEDRA') || pathStr.includes('2652C - PAREDE')) {
         c += dur;
      } else if (pathStr.includes('AQUALUME') || pathStr.includes('CORAL') || pathStr.includes('TUBARÃO') || pathStr.includes('TARTARUGA') || pathStr.includes('2652A')) {
         a += dur;
      } else {
         u += dur;
         console.log("Unclassified:", pathStr);
      }
    });

    console.log(`2652A: ${(a/60).toFixed(2)}h`);
    console.log(`2652B: ${(b/60).toFixed(2)}h`);
    console.log(`2652C: ${(c/60).toFixed(2)}h`);
    console.log(`Unclassified: ${(u/60).toFixed(2)}h`);
  } finally { pool.end(); }
}
run();
