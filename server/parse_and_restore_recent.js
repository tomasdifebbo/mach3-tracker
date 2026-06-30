const fs = require('fs');
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

const LOG_PATH = '\\\\DESKTOP-1CSKMNT\\Mach3\\log_oficial.csv';

async function restore() {
    try {
        const rawContent = fs.readFileSync(LOG_PATH, 'latin1');
        const lines = rawContent.split('\n').map(l => l.trim()).filter(l => l);
        
        const userRes = await pool.query("SELECT id FROM users WHERE email = 'casadotrem@gmail.com'");
        if (userRes.rows.length === 0) {
            console.log("Usuário master não encontrado.");
            process.exit(1);
        }
        const userId = userRes.rows[0].id;
        
        const materialsRes = await pool.query("SELECT * FROM materials");
        const cached_materials = materialsRes.rows;
        
        function find_material_match(filename) {
            if (!cached_materials || cached_materials.length === 0) return null;
            const clean_name = filename.toLowerCase();
            const name_no_ext = clean_name.substring(0, clean_name.lastIndexOf('.')) || clean_name;
            const words = name_no_ext.split(/[ _\-]/).map(w => w.trim()).filter(w => w);
            if (words.length === 0) return null;
            
            const w1 = words[0];
            const w2 = words.length > 1 ? words[1] : '';
            const w3 = words.length > 2 ? words[2] : '';
            const phrase_2 = `${w1} ${w2}`.trim();
            const phrase_3 = `${w1} ${w2} ${w3}`.trim();
            
            const sorted_mats = [...cached_materials].sort((a, b) => b.name.length - a.name.length);
            
            for (let mat of sorted_mats) {
                const mat_name = mat.name.toLowerCase();
                if (mat_name === phrase_3 || mat_name === phrase_2) return mat;
            }
            for (let mat of sorted_mats) {
                const mat_name = mat.name.toLowerCase();
                if (mat_name.includes(w1) && w2 && mat_name.includes(w2) && w3 && mat_name.includes(w3)) return mat;
                if (mat_name.includes(w1) && w2 && mat_name.includes(w2)) return mat;
            }
            for (let mat of sorted_mats) {
                const mat_name = mat.name.toLowerCase();
                if (mat_name === w3 || mat_name === w2 || mat_name === w1 || mat_name.startsWith(w1 + ' ')) return mat;
            }
            return null;
        }

        function extract_router_name(folder) {
            const match = folder.match(/ROUTER\s*([A-Za-z0-9]+)/i);
            if (match) return `Router ${match[1].toUpperCase()}`;
            return "Router 1";
        }
        
        function parseMach3Time(dateStr, timeStr) {
            const [day, month, year] = dateStr.split('/');
            return new Date(`${year}-${month}-${day}T${timeStr}-03:00`); // Assuming UTC-3 for Brazil
        }

        let jobs = [];
        let currentJob = null;
        const MIN_DATE = new Date('2026-05-11T23:59:59Z');

        console.log(`Parsing ${lines.length} lines of log...`);
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const parts = line.split(',');
            if (parts.length < 4) continue;
            
            const evento = parts[parts.length - 1].trim();
            const dataStr = parts[0].trim();
            const horaStr = parts[1].trim();
            const caminho = parts.slice(2, -1).join(',').trim();
            
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
                    file_name,
                    folder,
                    file_path: caminho,
                    start_time: eventTime,
                    end_time: null,
                    duration_minutes: 0,
                    router_name: extract_router_name(folder)
                };
            } else if (evento === 'FIM' && currentJob && currentJob.end_time === null) {
                currentJob.end_time = eventTime;
                currentJob.duration_minutes = Math.max(0, (currentJob.end_time - currentJob.start_time) / 60000);
                
                // Only keep jobs strictly after May 11
                if (currentJob.start_time > MIN_DATE) {
                    jobs.push({...currentJob});
                }
                currentJob = null;
            }
        }
        
        console.log(`Encontrados ${jobs.length} jobs a partir de 12/05/2026. Inserindo no banco...`);
        let count = 0;
        
        for (const item of jobs) {
            const mat = find_material_match(item.file_name);
            let mat_id = null, mat_name = null, mat_price = null;
            if (mat) {
                mat_id = mat.id;
                mat_name = mat.name;
                mat_price = mat.price;
            }
            
            await pool.query(
                `INSERT INTO jobs (file_name, folder, file_path, start_time, end_time, duration_minutes, day, month, year, "userId", router_name, material_id, material_name, material_price)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [
                    item.file_name, item.folder, item.file_path, 
                    item.start_time.toISOString(), item.end_time.toISOString(), item.duration_minutes, 
                    item.start_time.getDate(), item.start_time.getMonth() + 1, item.start_time.getFullYear(), 
                    userId, item.router_name, mat_id, mat_name, mat_price
                ]
            );
            count++;
        }
        
        console.log(`Sucesso: ${count} registros recentes inseridos!`);
        process.exit(0);
        
    } catch (err) {
        console.error("Erro na extração de log:", err);
        process.exit(1);
    }
}

restore();
