const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
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
        start_time
      FROM jobs 
      WHERE 
        file_path ILIKE '%2652a%' OR folder ILIKE '%2652a%' OR file_name ILIKE '%2652a%'
        OR file_path ILIKE '%2652b%' OR folder ILIKE '%2652b%' OR file_name ILIKE '%2652b%'
        OR file_path ILIKE '%2652c%' OR folder ILIKE '%2652c%' OR file_name ILIKE '%2652c%'
        OR file_path ILIKE '%pedras palco%' OR folder ILIKE '%pedras palco%' OR file_name ILIKE '%pedras palco%'
        OR file_path ILIKE '%pedras menores%' OR folder ILIKE '%pedras menores%' OR file_name ILIKE '%pedras menores%'
    `);
    
    const report = {
      '2652A (Luminoso Aqualume)': { operators: {}, materials: new Set(), total_minutes: 0, days: new Set() },
      '2652B (Submarino)': { operators: {}, materials: new Set(), total_minutes: 0, days: new Set() },
      '2652C (Pedras)': { operators: {}, materials: new Set(), total_minutes: 0, days: new Set() }
    };

    jobs.rows.forEach(job => {
      const pathStr = (job.file_path + job.folder + job.file_name).toUpperCase();
      let proj = '';
      
      if (pathStr.includes('SUBMARINO') || pathStr.includes('2652B')) {
         proj = '2652B (Submarino)';
      } else if (pathStr.includes('PEDRA') || pathStr.includes('2652C - PAREDE')) {
         proj = '2652C (Pedras)';
      } else if (pathStr.includes('AQUALUME') || pathStr.includes('CORAL') || pathStr.includes('TUBARÃO') || pathStr.includes('TARTARUGA') || pathStr.includes('2652A')) {
         proj = '2652A (Luminoso Aqualume)';
      }

      if (proj) {
        let op = job.operator_name ? job.operator_name.toLowerCase() : 'desconhecido';
        op = op.charAt(0).toUpperCase() + op.slice(1);
        const dur = parseFloat(job.duration_minutes) || parseFloat(job.estimated_minutes) || 0;
        
        if (!report[proj].operators[op]) {
          report[proj].operators[op] = 0;
        }
        report[proj].operators[op] += dur;
        report[proj].total_minutes += dur;

        if (job.material_name) {
          report[proj].materials.add(job.material_name.trim().toUpperCase());
        } else {
            if (pathStr.includes('PVC')) report[proj].materials.add('PVC');
            if (pathStr.includes('ACRILICO') || pathStr.includes('ACRÍLICO')) report[proj].materials.add('ACRÍLICO');
            if (pathStr.includes('POLICARBONATO')) report[proj].materials.add('POLICARBONATO');
            if (pathStr.includes('MDF')) report[proj].materials.add('MDF');
        }

        if (job.start_time) {
          const dt = new Date(job.start_time);
          const dateStr = dt.toLocaleDateString('pt-BR');
          report[proj].days.add(dateStr);
        }
      }
    });

    const desktopPath = path.join(require('os').homedir(), 'Desktop', 'Relatorio_Projetos_2652_Final.pdf');
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(desktopPath));

    doc.fontSize(20).text('Relatório de Produção (OS 2652 - Corrigido)', { align: 'center' });
    doc.moveDown(1);
    doc.fontSize(12).text(`Data de Geração: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`);
    doc.moveDown(2);

    for (const p in report) {
      if (report[p].total_minutes === 0) continue; // Skip empty sections

      doc.fontSize(16).fillColor('#004488').text(`Projeto: ${p}`, { underline: true });
      doc.fillColor('black');
      doc.moveDown(0.5);

      const totalHoras = (report[p].total_minutes / 60).toFixed(2);
      doc.fontSize(12).font('Helvetica-Bold').text('Tempo Total de Máquina: ', { continued: true }).font('Helvetica').text(`${totalHoras} horas`);
      
      const diasArr = Array.from(report[p].days).sort((a, b) => {
         const [d1, m1, y1] = a.split('/');
         const [d2, m2, y2] = b.split('/');
         return new Date(y1, m1-1, d1) - new Date(y2, m2-1, d2);
      });
      doc.font('Helvetica-Bold').text('Dias Trabalhados: ', { continued: true }).font('Helvetica').text(diasArr.length > 0 ? diasArr.join(', ') : 'Nenhum registro');
      
      doc.font('Helvetica-Bold').text('Materiais Utilizados: ', { continued: true }).font('Helvetica').text(Array.from(report[p].materials).join(', ') || 'Nenhum registro');
      doc.moveDown(0.5);

      doc.font('Helvetica-Bold').text('Operadores Envolvidos:');
      doc.font('Helvetica');
      for (const op in report[p].operators) {
        const opHoras = (report[p].operators[op] / 60).toFixed(2);
        if(opHoras > 0) {
           doc.text(`   • ${op}: ${opHoras} horas`);
        }
      }
      doc.moveDown(2);
    }
    
    doc.end();
    console.log('PDF atualizado em:', desktopPath);

  } finally { pool.end(); }
}
run();
