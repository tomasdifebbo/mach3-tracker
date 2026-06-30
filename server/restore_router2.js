const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

const LOG_PATH = '\\\\ACT10\\Mach3\\log_oficial.csv';

async function restore() {
    try {
        const rawContent = fs.readFileSync(LOG_PATH, 'latin1');
        const lines = rawContent.split('\n').map(l => l.trim()).filter(l => l);
        
        const userRes = await pool.query("SELECT id FROM users WHERE email = 'casadotrem@gmail.com'");
        if (userRes.rows.length === 0) { console.log("Usuario nao encontrado."); process.exit(1); }
        const userId = userRes.rows[0].id;
        
        const materialsRes = await pool.query("SELECT * FROM materials");
        const cached_materials = materialsRes.rows;
        
        function find_material_match(filename) {
            if (!cached_materials || cached_materials.length === 0) return null;
            const clean_name = filename.toLowerCase();
            const name_no_ext = clean_name.substring(0, clean_name.lastIndexOf('.')) || clean_name;
            const words = name_no_ext.split(/[ _\-\+]/).map(w => w.trim()).filter(w => w);
            if (words.length === 0) return null;
            const w1 = words[0], w2 = words.length > 1 ? words[1] : '', w3 = words.length > 2 ? words[2] : '';
            const phrase_2 = `${w1} ${w2}`.trim();
            const phrase_3 = `${w1} ${w2} ${w3}`.trim();
            const sorted_mats = [...cached_materials].sort((a, b) => b.name.length - a.name.length);
            for (let mat of sorted_mats) { const mn = mat.name.toLowerCase(); if (mn === phrase_3 || mn === phrase_2) return mat; }
            for (let mat of sorted_mats) { const mn = mat.name.toLowerCase(); if (mn.includes(w1) && w2 && mn.includes(w2) && w3 && mn.includes(w3)) return mat; if (mn.includes(w1) && w2 && mn.includes(w2)) return mat; }
            for (let mat of sorted_mats) { const mn = mat.name.toLowerCase(); if (mn === w3 || mn === w2 || mn === w1 || mn.startsWith(w1 + ' ')) return mat; }
            return null;
        }

        function parseMach3Time(dateStr, timeStr) {
            const [day, month, year] = dateStr.split('/');
            return new Date(`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}T${timeStr}-03:00`);
        }

        let jobs = [];
        let currentJob = null;

        console.log(`Parsing ${lines.length} lines from Router 2 (ACT10) log...`);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(',');
            if (parts.length < 4) continue;
            
            const evento = parts[parts.length - 1].trim();
            const dataStr = parts[0].trim();
            const horaStr = parts[1].trim();
            // ACT10 log format: date,time,filepath,ACT10,INICIO/FIM
            // or: date,time,Desconhecido,ACT10,FIM
            let caminho = '';
            if (parts.length >= 5) {
                caminho = parts.slice(2, -2).join(',').trim();
            } else {
                caminho = parts.slice(2, -1).join(',').trim();
            }
            
            const eventTime = parseMach3Time(dataStr, horaStr);
            
            if (evento === 'INICIO') {
                let file_name = caminho;
                let folder = '';
                if (caminho.includes('\\')) {
                    const pathParts = caminho.replace(/\\\\/g, '\\').split('\\').filter(p => p);
                    file_name = pathParts.pop();
                    if (pathParts.length > 2) {
                        folder = `${pathParts[pathParts.length-2]} / ${pathParts[pathParts.length-1]}`;
                    } else if (pathParts.length > 0) {
                        folder = pathParts[pathParts.length-1];
                    }
                }
                
                currentJob = {
                    file_name, folder, file_path: caminho,
                    start_time: eventTime, end_time: null,
                    duration_minutes: 0, router_name: 'Router 2'
                };
            } else if (evento === 'FIM' && currentJob && currentJob.end_time === null) {
                currentJob.end_time = eventTime;
                currentJob.duration_minutes = Math.max(0, (currentJob.end_time - currentJob.start_time) / 60000);
                jobs.push({...currentJob});
                currentJob = null;
            }
        }
        
        console.log(`Encontrados ${jobs.length} jobs da Router 2. Inserindo no banco...`);
        let count = 0;
        
        for (const item of jobs) {
            const mat = find_material_match(item.file_name);
            let mat_id = null, mat_name = null, mat_price = null;
            if (mat) { mat_id = mat.id; mat_name = mat.name; mat_price = mat.price; }
            
            await pool.query(
                `INSERT INTO jobs (file_name, folder, file_path, start_time, end_time, duration_minutes, day, month, year, "userId", router_name, material_id, material_name, material_price)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [item.file_name, item.folder, item.file_path, 
                 item.start_time.toISOString(), item.end_time.toISOString(), item.duration_minutes, 
                 item.start_time.getDate(), item.start_time.getMonth() + 1, item.start_time.getFullYear(), 
                 userId, item.router_name, mat_id, mat_name, mat_price]
            );
            count++;
        }
        
        console.log(`Sucesso: ${count} registros da Router 2 inseridos!`);
        process.exit(0);
        
    } catch (err) {
        console.error("Erro:", err);
        process.exit(1);
    }
}

restore();
