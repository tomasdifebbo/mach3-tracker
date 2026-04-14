const fetch = require('node-fetch') || globalThis.fetch;
const BASE_URL = 'https://mach3-tracker-production.up.railway.app';
const EMAIL = 'casadotrem@gmail.com';
const PASSWORD = '123456';

async function check() {
    const loginResp = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
    });
    const { token } = await loginResp.json();
    if (!token) return console.log("Login falhou na nuvem");

    const jobsResp = await fetch(`${BASE_URL}/api/jobs`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    const jobs = await jobsResp.json();
    console.log(`Cloud Jobs: ${jobs.length}`);
}
check();
