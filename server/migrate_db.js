const fs = require('fs');
const Database = require('better-sqlite3');
const path = require('path');

const jsonPath = path.join(__dirname, 'tracker.json');
const dbPath = path.join(__dirname, 'mach3.db');

let rawData = { users: [], jobs: [], materials: [] };
if (fs.existsSync(jsonPath)) {
    rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
const db = new Database(dbPath);

console.log('Criando tabelas...');

db.exec(`
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    plan TEXT,
    trial_expiry TEXT,
    payment_status TEXT,
    costPerHour REAL,
    plannedHours REAL
);

CREATE TABLE materials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    userId INTEGER
);

CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_name TEXT,
    folder TEXT,
    file_path TEXT,
    start_time TEXT,
    end_time TEXT,
    duration_minutes REAL,
    day INTEGER,
    month INTEGER,
    year INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    userId INTEGER,
    material_id INTEGER,
    material_name TEXT,
    material_price REAL
);
`);

console.log('Inserindo Usuários...');
const insertUser = db.prepare('INSERT INTO users (id, email, password, plan, trial_expiry, payment_status, costPerHour, plannedHours) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
for (const u of rawData.users) {
    const cost = u.settings?.costPerHour || 50;
    const hours = u.settings?.plannedHours || 8;
    insertUser.run(u.id, u.email, u.password, u.plan, u.trial_expiry, u.payment_status, cost, hours);
}

console.log('Inserindo Materiais...');
const insertMaterial = db.prepare('INSERT INTO materials (id, name, price, userId) VALUES (?, ?, ?, ?)');
for (const m of rawData.materials) {
    insertMaterial.run(m.id, m.name, m.price, m.userId);
}

console.log('Inserindo Jobs...');
const insertJob = db.prepare(`
    INSERT INTO jobs (id, file_name, folder, file_path, start_time, end_time, duration_minutes, day, month, year, userId, material_id, material_name, material_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const j of rawData.jobs) {
    insertJob.run(
        j.id, j.file_name, j.folder, j.file_path, j.start_time, j.end_time || null, j.duration_minutes || null,
        j.day, j.month, j.year, j.userId, j.material_id || null, j.material_name || null, j.material_price || null
    );
}

console.log('Migração finalizada em mach3.db!');
db.close();
