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
        material_name
      FROM jobs 
      WHERE 
        file_path ILIKE '%2652a%' OR folder ILIKE '%2652a%' OR file_name ILIKE '%2652a%'
        OR file_path ILIKE '%2652b%' OR folder ILIKE '%2652b%' OR file_name ILIKE '%2652b%'
        OR file_path ILIKE '%2652c%' OR folder ILIKE '%2652c%' OR file_name ILIKE '%2652c%'
    `);
    
    const report = {
      '2652A': { operators: {}, materials: new Set(), total_minutes: 0 },
      '2652B': { operators: {}, materials: new Set(), total_minutes: 0 },
      '2652C': { operators: {}, materials: new Set(), total_minutes: 0 }
    };

    jobs.rows.forEach(job => {
      const path = (job.file_path + job.folder + job.file_name).toUpperCase();
      let proj = '';
      if (path.includes('2652A')) proj = '2652A';
      else if (path.includes('2652B')) proj = '2652B';
      else if (path.includes('2652C')) proj = '2652C';

      if (proj) {
        const op = job.operator_name || 'Desconhecido';
        const dur = parseFloat(job.duration_minutes) || parseFloat(job.estimated_minutes) || 0;
        
        if (!report[proj].operators[op]) {
          report[proj].operators[op] = 0;
        }
        report[proj].operators[op] += dur;
        report[proj].total_minutes += dur;

        if (job.material_name) {
          report[proj].materials.add(job.material_name.trim().toLowerCase());
        } else {
            // infer from file name
            if (path.includes('PVC')) report[proj].materials.add('pvc');
            if (path.includes('ACRILICO')) report[proj].materials.add('acrílico');
            if (path.includes('POLICARBONATO')) report[proj].materials.add('policarbonato');
            if (path.includes('MDF')) report[proj].materials.add('mdf');
        }
      }
    });

    const finalReport = {};
    for (const p in report) {
      finalReport[p] = {
        total_horas: (report[p].total_minutes / 60).toFixed(2) + 'h',
        operadores: {},
        materiais: Array.from(report[p].materials)
      };
      for (const op in report[p].operators) {
        finalReport[p].operadores[op] = (report[p].operators[op] / 60).toFixed(2) + 'h';
      }
    }

    console.log(JSON.stringify(finalReport, null, 2));

  } finally { pool.end(); }
}
run();
