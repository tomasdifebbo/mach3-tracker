const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

// Dados do Supabase recuperados do seu histórico
const SUPABASE_URL = "https://ifoiivttteufbtydnbyk.supabase.co";
const SUPABASE_KEY = "sb_publishable_pu4zjObjq1NQ0vcG3yciTQ_HU1K0AJl";
const URL_JOBS = `${SUPABASE_URL}/rest/v1/jobs?select=*`;

const dbPath = path.join(__dirname, 'mach3.db');

async function migrateFromSupabase() {
    console.log("Iniciando migração do Supabase para SQLite...");
    
    if (!fs.existsSync(dbPath)) {
        console.error("Erro: Banco mach3.db não encontrado. Rode a migração JSON primeiro.");
        return;
    }

    const db = new Database(dbPath);
    
    try {
        console.log("Baixando dados do Supabase...");
        const response = await fetch(URL_JOBS, {
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Erro ao acessar Supabase: ${response.statusText}`);
        }

        const supabaseJobs = await response.json();
        console.log(`Encontrados ${supabaseJobs.length} registros no Supabase.`);

        const insertJob = db.prepare(`
            INSERT INTO jobs (file_name, folder, file_path, start_time, end_time, duration_minutes, day, month, year, userId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        // Vamos assumir o userId 1 para os dados legados (primeiro usuário criado)
        const userId = 1;

        let imported = 0;
        const transaction = db.transaction((jobs) => {
            for (const j of jobs) {
                // Evita duplicatas simples checando se o start_time já existe
                const existing = db.prepare('SELECT id FROM jobs WHERE start_time = ? AND userId = ?').get(j.start_time, userId);
                if (!existing) {
                    insertJob.run(
                        j.file_name || 'Desconhecido',
                        j.folder || 'Importado Supabase',
                        j.file_path || '',
                        j.start_time,
                        j.end_time || null,
                        j.duration_minutes || null,
                        j.day || new Date(j.start_time).getDate(),
                        j.month || (new Date(j.start_time).getMonth() + 1),
                        j.year || new Date(j.start_time).getFullYear(),
                        userId
                    );
                    imported++;
                }
            }
        });

        transaction(supabaseJobs);
        console.log(`Sucesso! ${imported} novos registros migrados para o SQLite.`);

    } catch (error) {
        console.error("Falha na migração:", error.message);
    } finally {
        db.close();
    }
}

migrateFromSupabase();
