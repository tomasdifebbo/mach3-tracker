const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'tracker.db'));

const jobs = [
    { name: 'mesa_de_centro.tap', folder: '..\\arquivos 2024\\moveis', start: '2026-03-29T08:30:00-03:00', end: '2026-03-29T10:15:00-03:00', dur: 105 },
    { name: 'porta_cozinha_v2.tap', folder: '..\\arquivos 2024\\cozinha', start: '2026-03-29T10:30:00-03:00', end: '2026-03-29T11:45:00-03:00', dur: 75 },
    { name: 'medalha_personalizada.tap', folder: '..\\arquivos 2024\\medalhas', start: '2026-03-28T09:00:00-03:00', end: '2026-03-28T09:45:00-03:00', dur: 45 },
    { name: 'placa_decorativa.tap', folder: '..\\arquivos 2024\\placas', start: '2026-03-28T13:00:00-03:00', end: '2026-03-28T15:30:00-03:00', dur: 150 },
    { name: 'mesa_de_centro.tap', folder: '..\\arquivos 2024\\moveis', start: '2026-03-27T08:00:00-03:00', end: '2026-03-27T10:00:00-03:00', dur: 120 },
    { name: 'logo_empresa.tap', folder: '..\\arquivos 2024\\logos', start: '2026-03-27T14:00:00-03:00', end: '2026-03-27T14:30:00-03:00', dur: 30 },
    { name: 'caixa_presente.tap', folder: '..\\arquivos 2024\\caixas', start: '2026-03-26T09:00:00-03:00', end: '2026-03-26T12:00:00-03:00', dur: 180 },
    { name: 'porta_cozinha_v2.tap', folder: '..\\arquivos 2024\\cozinha', start: '2026-03-26T13:30:00-03:00', end: '2026-03-26T16:00:00-03:00', dur: 150 },
    { name: 'relogio_parede.tap', folder: '..\\arquivos 2024\\relogios', start: '2026-03-25T10:00:00-03:00', end: '2026-03-25T11:30:00-03:00', dur: 90 },
    { name: 'tabuleiro_xadrez.tap', folder: '..\\arquivos 2024\\jogos', start: '2026-03-25T14:00:00-03:00', end: '2026-03-25T17:00:00-03:00', dur: 180 }
];

// reverse to insert older first, to match ID increments
jobs.reverse();

const stmt = db.prepare(`
    INSERT INTO jobs (file_name, file_path, folder, start_time, end_time, duration_minutes, day, month, year)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

db.exec('DELETE FROM jobs');

// Reset auto increment
try { db.exec("UPDATE sqlite_sequence SET seq = 0 WHERE name = 'jobs'"); } catch(e){}

for (const j of jobs) {
    const dt = new Date(j.start);
    stmt.run(
        j.name,
        j.folder + '\\\\' + j.name,
        j.folder,
        dt.toISOString(),
        new Date(j.end).toISOString(),
        j.dur,
        dt.getDate(),
        dt.getMonth() + 1,
        dt.getFullYear()
    );
}

console.log('Seed completed!');
