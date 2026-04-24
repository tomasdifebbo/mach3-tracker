const fetch = require('node-fetch') || globalThis.fetch;
const BASE_URL = 'https://mach3-tracker-production.up.railway.app';
const EMAIL = 'casadotrem@gmail.com';
const PASSWORD = '123456';

async function pureWipe() {
    console.log("Autenticando para limpeza total...");
    let resp = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    let data = await resp.json();
    const token = data.token;
    if (!token) return console.log("Erro login");

    const headers = { 'Authorization': `Bearer ${token}` };
    const jobs = await (await fetch(`${BASE_URL}/api/jobs`, { headers })).json();
    
    console.log(`Limpando ${jobs.length} jobs permanentemente...`);
    for (const j of jobs) {
        await fetch(`${BASE_URL}/api/jobs/${j.id}`, { method: 'DELETE', headers });
    }
    console.log("✅ Dashboard ZERADO com sucesso!");
}

pureWipe();
