const { Pool, types } = require('pg');
// Garante que colunas TIMESTAMP WITHOUT TIME ZONE (armazenadas em UTC) sejam interpretadas como UTC em qualquer SO (Windows/Linux)
types.setTypeParser(1114, (str) => (str ? new Date(str.replace(' ', 'T') + 'Z') : null));

// Database setup using PostgreSQL (Supabase / Neon)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 4,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000
});

pool.on('error', (err) => {
    console.error('[DATABASE POOL ERROR - IDLE CLIENT RECONNECTING]:', err.message);
});

module.exports = pool;
