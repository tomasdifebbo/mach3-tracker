const fetch = require('node-fetch') || globalThis.fetch;
const Database = require('better-sqlite3');
const path = require('path');

const BASE_URL = 'https://mach3-tracker-production.up.railway.app';
const EMAIL = 'casadotrem@gmail.com';
const PASSWORD = '123456';

async function migrate() {
    console.log("Baixando do SQLite local...");
    const dbPath = path.join(__dirname, 'mach3.db');
    const db = new Database(dbPath);
    const localJobs = db.prepare('SELECT * FROM jobs').all();
    console.log(`Encontrados ${localJobs.length} jobs.`);

    let token = '';
    console.log("Tentando login na Railway (com retries)...");
    for (let i = 0; i < 10; i++) {
        try {
            const resp = await fetch(`${BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: EMAIL, password: PASSWORD })
            });
            const data = await resp.json();
            if (data.token) {
                token = data.token;
                console.log("Logado com sucesso!");
                break;
            } else {
                console.log(`Erro login: ${data.error || 'Desconhecido'}. Tentativa ${i+1}/10...`);
            }
        } catch (e) {
            console.log(`Erro conexão: ${e.message}. Tentativa ${i+1}/10...`);
        }
        await new Promise(r => setTimeout(r, 10000)); // Espera 10s
    }

    if (!token) return console.log("Can't login after retries.");

    console.log("Iniciando upload para Railway...");
    let count = 0;
    for (const job of localJobs) {
        try {
            const resp = await fetch(`${BASE_URL}/api/jobs`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file_name: job.file_name,
                    folder: job.folder,
                    file_path: job.file_path,
                    start_time: job.start_time,
                    router_name: job.router_name
                })
            });
            if (resp.status < 300) {
                // Update to set end_time if exists
                if (job.end_time) {
                    await fetch(`${BASE_URL}/api/jobs/latest`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            end_time: job.end_time
                        })
                    });
                }
                count++;
                if (count % 5 === 0) console.log(`${count} jobs enviados...`);
            }
        } catch (e) {
            console.error("Erro no job:", job.id, e.message);
        }
    }
    console.log(`Migração Completa! Enviados: ${count} jobs.`);
}

migrate();
