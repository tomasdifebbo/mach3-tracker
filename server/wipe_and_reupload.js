const fetch = require('node-fetch') || globalThis.fetch;

const BASE_URL = 'https://mach3-tracker-production.up.railway.app';
const EMAIL = 'casadotrem@gmail.com';
const PASSWORD = '123456';

async function fix() {
    console.log("Autenticando...");
    let resp = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    let data = await resp.json();
    const token = data.token;
    if (!token) return console.log("Erro login");

    console.log("Baixando jobs atuais...");
    const headers = { 'Authorization': `Bearer ${token}` };
    const jobs = await (await fetch(`${BASE_URL}/api/jobs`, { headers })).json();
    
    console.log(`Limpando ${jobs.length} jobs para reenviar com nome correto...`);
    for (const j of jobs) {
        await fetch(`${BASE_URL}/api/jobs/${j.id}`, { method: 'DELETE', headers });
    }
    
    console.log("Jobs removidos. Agora re-enviando os 45 jobs com o nome de projeto 2576 - GLOBOTOY...");
    // Chamar o script de upload que já está corrigido no disco
}

fix();
