const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'server', 'mach3.db');
const db = new Database(dbPath);

try {
    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get('casadotrem@gmail.com');
    if (!user) {
        console.log("Usuário casadotrem@gmail.com não encontrado.");
        process.exit(1);
    }

    const jobs = db.prepare('SELECT * FROM jobs WHERE userId = ? ORDER BY start_time DESC').all(user.id);
    
    console.log(JSON.stringify({
        user: user,
        total_jobs: jobs.length,
        jobs: jobs
    }, null, 2));
} catch (err) {
    console.error("Erro ao acessar banco de dados:", err.message);
}
