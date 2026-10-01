const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres' });
async function run() {
  try {
    const jobs = await pool.query(`
      SELECT 
        operator_name,
        file_path,
        folder,
        file_name,
        duration_minutes,
        estimated_minutes,
        material_name,
        start_time,
        end_time
      FROM jobs 
      WHERE 
        file_path ILIKE '%2652a%' OR folder ILIKE '%2652a%' OR file_name ILIKE '%2652a%'
        OR file_path ILIKE '%2652b%' OR folder ILIKE '%2652b%' OR file_name ILIKE '%2652b%'
        OR file_path ILIKE '%2652c%' OR folder ILIKE '%2652c%' OR file_name ILIKE '%2652c%'
    `);
    
    const projects = {
      '2652A': [],
      '2652B': [],
      '2652C': []
    };

    jobs.rows.forEach(job => {
      const path = (job.file_path + job.folder + job.file_name).toUpperCase();
      let proj = '';
      if (path.includes('2652A')) proj = '2652A';
      else if (path.includes('2652B')) proj = '2652B';
      else if (path.includes('2652C')) proj = '2652C';

      if (proj) projects[proj].push(job);
    });

    console.log(JSON.stringify(projects, null, 2));

  } finally { pool.end(); }
}
run();
