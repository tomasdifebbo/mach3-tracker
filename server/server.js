const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dashboard')));

// Database setup using JSON
const dbPath = path.join(__dirname, 'tracker.json');

function readDB() {
    if (!fs.existsSync(dbPath)) return [];
    try {
        return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    } catch {
        return [];
    }
}

function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
}

// Ensure file exists
if (!fs.existsSync(dbPath)) {
    writeDB([]);
}

// DEBOUNCE: Prevent ghost jobs when Mach3 re-triggers M101 after stop/reset
const DEBOUNCE_SECONDS = 10;

// STARTUP CLEANUP: Remove ghost jobs (duration 0 or < 10 seconds) from previous runs
(function cleanupGhostJobs() {
    let db = readDB();
    const before = db.length;
    db = db.filter(j => {
        // Keep jobs that are still active (no end_time)
        if (!j.end_time) return true;
        // Keep jobs with meaningful duration (> 10 seconds = 0.16 min)
        if (j.duration_minutes > 0.16) return true;
        // Remove ghost jobs
        return false;
    });
    // Re-assign sequential IDs after cleanup
    db.forEach((j, i) => { j.id = i + 1; });
    if (db.length < before) {
        writeDB(db);
        console.log(`Cleanup: removed ${before - db.length} ghost jobs (duration < 10s)`);
    }
})();

// API Routes
app.get('/health', (req, res) => res.status(200).send('OK'));

app.post('/api/jobs', (req, res) => {
    const { file_name, folder, file_path, start_time } = req.body;
    
    let dt = start_time ? new Date(start_time) : new Date();
    
    let cleanFolder = folder || 'Desconhecido';
    let cleanFileName = file_name || 'Desconhecido';
    
    // Check if the file_name contains slashes (meaning it's a full path dumped by M101)
    if (cleanFileName.includes('\\') || cleanFileName.includes('/')) {
        const pathParts = cleanFileName.replace(/\\/g, '/').split('/').filter(p => p.length > 0);
        if (pathParts.length > 0) {
            cleanFileName = pathParts[pathParts.length - 1]; // e.g. "arquivo.tap"
        }
        if (pathParts.length > 1) {
            // New logic: Get last 2 non-empty parts to show "Client / Subfolder"
            // Example: .../2569 lacoste/provador/fundo.txt -> "2569 lacoste / provador"
            const relevantParts = pathParts.slice(-3, -1);
            const genericRoots = ['router', 'arquivos 2024', 'ARQUIVOS 2026', 'TOMAS', 'GCODE'];
            if (relevantParts.length > 1 && genericRoots.some(r => relevantParts[0].toLowerCase() === r.toLowerCase())) {
                relevantParts.shift();
            }
            cleanFolder = relevantParts.join(' / ');
        } else {
            cleanFolder = 'Raiz';
        }
    } else {
        // Original generic logic
        if (cleanFolder && cleanFolder !== 'Desconhecido') {
            const parts = cleanFolder.replace(/\\/g, '/').split('/').filter(p => p.length > 0);
            if (parts.length > 0) {
                cleanFolder = parts[parts.length - 1];
            }
        }
    }
    
    let db = readDB();
    
    // DEBOUNCE: Check if this START is too close to the last event (ghost trigger)
    if (db.length > 0) {
        const lastJob = db[db.length - 1];
        const lastEventTime = new Date(lastJob.end_time || lastJob.start_time);
        const diffSeconds = (dt - lastEventTime) / 1000;
        
        if (diffSeconds >= 0 && diffSeconds < DEBOUNCE_SECONDS) {
            console.log(`DEBOUNCE: Ignoring START (${diffSeconds.toFixed(1)}s after last event, < ${DEBOUNCE_SECONDS}s threshold)`);
            return res.json({ id: null, success: true, debounced: true });
        }
    }
    
    // AUTO-CLOSE PREVIOUS JOBS: If a NEW job starts, the previous one MUST end.
    // This prevents "zombie" active jobs if Mach3 stops without M102.
    let indexesToRemove = [];
    db.forEach((j, i) => {
        if (!j.end_time) {
            j.end_time = dt.toISOString();
            const prevStart = new Date(j.start_time);
            j.duration_minutes = Math.max(0, (dt - prevStart) / (1000 * 60));
            // If the auto-closed job lasted less than 10 seconds, mark it for removal
            if (j.duration_minutes < 0.16) {
                indexesToRemove.push(i);
            }
        }
    });

    // Remove auto-closed ghost jobs
    if (indexesToRemove.length > 0) {
        for (let i = indexesToRemove.length - 1; i >= 0; i--) {
            db.splice(indexesToRemove[i], 1);
        }
    }

    const newId = db.length > 0 ? Math.max(...db.map(j => j.id || 0)) + 1 : 1;
    
    const newJob = {
        id: newId,
        file_name: cleanFileName,
        file_path: file_path || 'Desconhecido',
        folder: cleanFolder,
        start_time: dt.toISOString(),
        end_time: null,
        duration_minutes: null,
        day: dt.getDate(),
        month: dt.getMonth() + 1,
        year: dt.getFullYear()
    };
    
    db.push(newJob);
    writeDB(db);
    
    console.log(`NEW JOB #${newId}: ${cleanFileName} (${cleanFolder})`);
    res.json({ id: newId, success: true });
});

app.patch('/api/jobs/latest', (req, res) => {
    const { end_time } = req.body;
    const dt = end_time ? new Date(end_time) : new Date();
    const endStr = dt.toISOString();

    const db = readDB();
    // Find latest open job
    let row = null;
    let rowIndex = -1;
    for (let i = db.length - 1; i >= 0; i--) {
        if (!db[i].end_time) {
            row = db[i];
            rowIndex = i;
            break;
        }
    }
    
    if (!row) {
        return res.status(404).json({ error: "No open jobs found" });
    }

    const startDt = new Date(row.start_time);
    const durationMinutes = (dt - startDt) / (1000 * 60);

    // If duration is too short (< 10 seconds), delete the job entirely!
    if (durationMinutes < 0.16) {
        db.splice(rowIndex, 1);
        writeDB(db);
        console.log(`GHOST JOB DELETED: ${row.file_name} (duration: ${(durationMinutes * 60).toFixed(1)}s < 10s)`);
        return res.json({ id: row.id, deleted: true, reason: "< 10s" });
    }

    db[rowIndex].end_time = endStr;
    db[rowIndex].duration_minutes = durationMinutes;
    writeDB(db);
    
    try {
        // Export to monthly CSV
        const monthsPT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const mName = monthsPT[dt.getMonth()];
        const year = dt.getFullYear();
        const csvFileName = `${mName}_${year}.csv`;
        const csvPath = path.join(__dirname, '..', csvFileName);
        
        const fileExists = fs.existsSync(csvPath);
        if (!fileExists) {
            fs.appendFileSync(csvPath, "Data,Hora,Arquivo,Pasta,Duracao (min)\n", 'utf8');
        }
        
        const pad = n => n.toString().padStart(2, '0');
        const dataStr = `${pad(dt.getDate())}/${pad(dt.getMonth()+1)}/${year}`;
        const horaStr = `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
        const durStr = durationMinutes.toFixed(2);
        
        fs.appendFileSync(csvPath, `${dataStr},${horaStr},"${row.file_name}","${row.folder}",${durStr}\n`, 'utf8');
    } catch(err) {
        console.error('CSV Write error:', err);
    }

    res.json({ id: row.id, duration_minutes: durationMinutes, success: true });
});

app.get('/api/jobs', (req, res) => {
    const db = readDB();
    // sort descending by id
    db.sort((a,b) => b.id - a.id);
    res.json(db);
});

app.delete('/api/jobs/:id', (req, res) => {
    let db = readDB();
    const initialLen = db.length;
    db = db.filter(j => j.id !== parseInt(req.params.id));
    
    if (db.length < initialLen) {
        writeDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: "Job not found" });
    }
});

app.get('/api/stats', (req, res) => {
    try {
        const jobs = readDB();
        
        const totalJobs = jobs.length;
        let totalHours = 0;
        let validCompletedJobs = 0;
        
        const today = new Date();
        let jobsToday = 0;

        const hoursPerDay = {};
        const fileCounts = {};

        jobs.forEach(j => {
            const isToday = j.day === today.getDate() && j.month === today.getMonth() + 1 && j.year === today.getFullYear();
            
            if (isToday) {
                jobsToday++;
            }
            
            // SOMENTE adiciona às estatísticas totais se o job já foi FINALIZADO (M102 recebido)
            if (j.end_time) {
                let dur = j.duration_minutes || 0;
                
                // Ignora cliques duplos menores que 10s
                if (dur > 0.16) {
                    validCompletedJobs++;
                    totalHours += (dur / 60);
                    
                    const dateKey = `${j.day.toString().padStart(2, '0')}/${j.month.toString().padStart(2, '0')}`;
                    if (!hoursPerDay[dateKey]) hoursPerDay[dateKey] = 0;
                    hoursPerDay[dateKey] += (dur / 60);
                    
                    if (!fileCounts[j.file_name]) fileCounts[j.file_name] = 0;
                    fileCounts[j.file_name]++;
                }
            }
        });

        const avgJobHours = validCompletedJobs > 0 ? totalHours / validCompletedJobs : 0;
        
        const sortedFiles = Object.keys(fileCounts)
            .map(k => ({ name: k, count: fileCounts[k] }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
            
        const sortedDays = Object.keys(hoursPerDay)
            .sort((a,b) => {
                const [d1,m1] = a.split('/');
                const [d2,m2] = b.split('/');
                return new Date(2026, m1-1, d1) - new Date(2026, m2-1, d2);
            })
            .slice(-30);
            
        const dailyHoursData = sortedDays.map(d => hoursPerDay[d]);

        res.json({
            totalJobs,
            totalHours,
            avgJobHours,
            jobsToday,
            dailyHoursLabels: sortedDays,
            dailyHoursData: dailyHoursData,
            topFiles: sortedFiles
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`Premium Server running at http://localhost:${port}`);
});
