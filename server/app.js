const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { DOMAIN, EXTRA_CORS_ORIGINS } = require('./config/constants');
const { securityHeaders, isOriginAllowed } = require('./middleware/security');

const routersRoutes = require('./routes/routersRoutes');
const authRoutes = require('./routes/authRoutes');
const jobsRoutes = require('./routes/jobsRoutes');
const paymentsRoutes = require('./routes/paymentsRoutes');
const kanbanRoutes = require('./routes/kanbanRoutes');
const operationsRoutes = require('./routes/operationsRoutes');
const pipelineRoutes = require('./routes/pipelineRoutes');

function createApp() {
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    app.use(securityHeaders);

    // Strict allowlist CORS (production domain + explicitly configured origins + local dev)
    const allowedOrigins = Array.from(new Set([
        DOMAIN,
        'https://mach3-tracker.onrender.com',
        'https://mach3tracker.up.railway.app',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:4173',
        ...EXTRA_CORS_ORIGINS
    ].filter(Boolean)));

    app.use(cors({
        origin: function (origin, callback) {
            if (isOriginAllowed(origin, allowedOrigins)) {
                return callback(null, true);
            }
            return callback(null, false);
        },
        credentials: true
    }));

    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Fast healthcheck endpoint
    app.get('/health', (req, res) => res.status(200).send('OK'));

    const publicDir = fs.existsSync(path.join(__dirname, 'public', 'index.html'))
        ? path.join(__dirname, 'public')
        : (fs.existsSync(path.join(__dirname, '../dashboard-v2/dist', 'index.html'))
            ? path.join(__dirname, '../dashboard-v2/dist')
            : path.join(__dirname, 'public'));

    // Specific Service Worker route to ensure proper MIME type, scope and caching
    app.get('/sw.js', (req, res) => {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Service-Worker-Allowed', '/');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        const swPath = path.join(publicDir, 'sw.js');
        if (fs.existsSync(swPath)) {
            res.sendFile(swPath);
        } else {
            res.status(404).send('Service Worker not found');
        }
    });

    app.use(express.static(publicDir, {
        etag: false,
        maxAge: 0,
        setHeaders: (res) => {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }));

    // Modular API Routers
    app.use(routersRoutes);
    app.use(authRoutes);
    app.use(jobsRoutes);
    app.use(paymentsRoutes);
    app.use(kanbanRoutes);
    app.use(operationsRoutes);
    app.use(pipelineRoutes);

    // Catch-all: Route all other non-API requests to the React SPA
    app.get('*', (req, res) => {
        const indexPath = fs.existsSync(path.join(__dirname, 'public', 'index.html'))
            ? path.join(__dirname, 'public', 'index.html')
            : path.join(__dirname, '../dashboard-v2/dist', 'index.html');
        res.sendFile(indexPath);
    });

    return app;
}

module.exports = { createApp };
