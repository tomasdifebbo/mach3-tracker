const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

// Dados do Supabase
const SUPABASE_URL = "https://ifoiivttteufbtydnbyk.supabase.co";
const SUPABASE_KEY = "sb_publishable_pu4zjObjq1NQ0vcG3yciTQ_HU1K0AJl";
const URL_MATERIALS = `${SUPABASE_URL}/rest/v1/materials?select=*`;
const URL_JOBS = `${SUPABASE_URL}/rest/v1/jobs?select=*`;

const dbPath = path.join(__dirname, 'mach3.db');

async function migrate() {
    console.log("Iniciando migração do Supabase para SQLite (User: CASADOTREM)...");
    
    if (!fs.existsSync(dbPath)) {
        console.error("Erro: Banco mach3.db não encontrado.");
        return;
    }

    const db = new Database(dbPath);
    const userId = 5; // ID da conta CASADOTREM@GMAIL.COM

    try {
        const headers = {
            "apikey": SUPABASE_KEY,
            "Authorization": `Bearer ${SUPABASE_KEY}`,
            "Content-Type": "application/json"
        };

        // 1. Migrar Materiais
        console.log("Baixando materiais...");
        const resMat = await fetch(URL_MATERIALS, { headers });
        const materialsData = await resMat.json();
        const materials = Array.isArray(materialsData) ? materialsData : [];
        console.log(`Encontrados ${materials.length} materiais.`);

        const insertMat = db.prepare('INSERT INTO materials (name, price, userId) VALUES (?, ?, ?)');
        let matCount = 0;
        
        db.transaction(() => {
            for (const m of materials) {
                const existing = db.prepare('SELECT id FROM materials WHERE name = ? AND userId = ?').get(m.name, userId);
                if (!existing) {
                    insertMat.run(m.name, m.price, userId);
                    matCount++;
                }
            }
        })();
        console.log(`Sucesso: ${matCount} materiais importados.`);

        // 2. Migrar Jobs
        console.log("Baixando jobs...");
        const resJobs = await fetch(URL_JOBS, { headers });
        const jobsData = await resJobs.json();
        const jobs = Array.isArray(jobsData) ? jobsData : [];
        console.log(`Encontrados ${jobs.length} jobs.`);

        const insertJob = db.prepare(`
            INSERT INTO jobs (file_name, folder, file_path, start_time, end_time, duration_minutes, day, month, year, userId)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let jobCount = 0;
        db.transaction(() => {
            for (const j of jobs) {
                const existing = db.prepare('SELECT id FROM jobs WHERE start_time = ? AND userId = ?').get(j.start_time, userId);
                if (!existing) {
                    insertJob.run(
                        j.file_name || 'Desconhecido',
                        j.folder || 'Importado',
                        j.file_path || '',
                        j.start_time,
                        j.end_time || null,
                        j.duration_minutes || null,
                        j.day || new Date(j.start_time).getDate(),
                        j.month || (new Date(j.start_time).getMonth() + 1),
                        j.year || new Date(j.start_time).getFullYear(),
                        userId
                    );
                    jobCount++;
                }
            }
        })();
        console.log(`Sucesso: ${jobCount} jobs importados.`);

    } catch (error) {
        console.error("Falha na migração:", error.message);
    } finally {
        db.close();
    }
}

migrate();
