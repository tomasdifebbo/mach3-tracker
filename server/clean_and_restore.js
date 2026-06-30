const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.iehynyqkkkgmcjojplfc:W611ztIrUqxJyM14@aws-1-us-east-1.pooler.supabase.com:5432/postgres',
    ssl: { rejectUnauthorized: false }
});

const DB_PATH = './tracker.json';

async function restore() {
    try {
        console.log("Deletando jobs 'Desconhecido' que foram inseridos erroneamente...");
        await pool.query("DELETE FROM jobs WHERE folder = 'Desconhecido'");
        
        console.log("Limpando a tabela de jobs atual para a restauração completa...");
        await pool.query("DELETE FROM jobs");

        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        
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
        
        console.log(`Processando ${data.length} jobs do historico...`);
        let count = 0;
        for (const item of data) {
            const file_name = item.file_name || 'Desconhecido';
            const folder = item.folder || 'Desconhecido';
            const file_path = item.file_path || 'Desconhecido';
            const start_time = item.start_time;
            const end_time = item.end_time;
            const duration_minutes = item.duration_minutes || 0;
            const day = item.day || new Date(start_time).getDate();
            const month = item.month || (new Date(start_time).getMonth() + 1);
            const year = item.year || new Date(start_time).getFullYear();
            
            const router_name = extract_router_name(folder);
            const mat = find_material_match(file_name);
            
            let mat_id = null, mat_name = null, mat_price = null;
            if (mat) {
                mat_id = mat.id;
                mat_name = mat.name;
                mat_price = mat.price;
            }
            
            await pool.query(
                `INSERT INTO jobs (file_name, folder, file_path, start_time, end_time, duration_minutes, day, month, year, "userId", router_name, material_id, material_name, material_price)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
                [file_name, folder, file_path, start_time, end_time, duration_minutes, day, month, year, userId, router_name, mat_id, mat_name, mat_price]
            );
            count++;
        }
        
        console.log(`Sucesso: ${count} registros inseridos com materiais mapeados diretamente via BD!`);
        process.exit(0);
        
    } catch (err) {
        console.error("Erro na migração:", err);
        process.exit(1);
    }
}

restore();
