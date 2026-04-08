const Database = require('better-sqlite3');
const fetch = require('node-fetch') || globalThis.fetch;
const db = new Database('mach3.db');

const BASE_URL = 'https://mach3-tracker-production.up.railway.app';
const EMAIL = 'casadotrem@gmail.com';
const PASSWORD = '123456';

async function upload() {
    console.log(`Baixando do SQLite local...`);
    const jobs = db.prepare('SELECT * FROM jobs').all();
    const materials = db.prepare('SELECT * FROM materials').all();
    
    console.log(`Encontrados ${jobs.length} jobs, ${materials.length} materiais.`);
    
    let resp = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    let loginData = await resp.json();
    let token = loginData.token;

    if (!token) {
        console.log(`Login falhou. Criando conta no Railway...`);
        await fetch(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EMAIL, password: PASSWORD })
        });
        resp = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: EMAIL, password: PASSWORD })
        });
        loginData = await resp.json();
        token = loginData.token;
    }
    
    if (!token) {
        console.log(`Erro crítico de login no servidor e nâo foi possível continuar.`);
        return;
    }
    
    console.log(`Logado com sucesso. Iniciando upload para Railway...`);
    
    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
    
    const matMap = {};
    for (const m of materials) {
        let r = await (await fetch(`${BASE_URL}/api/materials`, {
            method: 'POST', headers, body: JSON.stringify({ name: m.name, price: m.price })
        })).json();
        if (r.success && r.material) {
            matMap[m.id] = r.material.id;
        }
    }
    
    const sortedJobs = jobs.sort((a,b) => new Date(a.start_time) - new Date(b.start_time));
    let cont = 0;
    for (const j of sortedJobs) {
        // start job
        let startRes = await (await fetch(`${BASE_URL}/api/jobs`, {
            method: 'POST', headers, body: JSON.stringify({
                file_name: j.file_name,
                folder: j.folder,
                file_path: j.file_path,
                start_time: j.start_time
            })
        })).json();
        
        if (startRes.id && !startRes.debounced) {
            if (j.end_time) {
                await fetch(`${BASE_URL}/api/jobs/latest`, {
                    method: 'PATCH', headers, body: JSON.stringify({ end_time: j.end_time })
                });
            }
            if (j.material_id && j.material_name) {
                let mId = matMap[j.material_id] || j.material_id;
                await fetch(`${BASE_URL}/api/jobs/${startRes.id}`, {
                    method: 'PATCH', headers, body: JSON.stringify({
                        material_id: mId,
                        material_name: j.material_name,
                        material_price: j.material_price || 0
                    })
                });
            }
            cont++;
            if (cont % 5 === 0) console.log(`${cont} jobs enviados...`);
            
            // Pequeno delay para debounce/limite de API
            await new Promise(r => setTimeout(r, 200));
        }
    }
    console.log(`Migração Completa! Enviados: ${cont} jobs para a Railway.`);
}

upload();
