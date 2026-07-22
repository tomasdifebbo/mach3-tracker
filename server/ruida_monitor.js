const dgram = require('dgram');
const { exec } = require('child_process');

class RuidaMonitor {
    constructor(pool, autoSyncKanban) {
        this.pool = pool;
        this.autoSyncKanban = autoSyncKanban;
        this.targetIp = '192.168.0.174';
        this.targetMacPrefix = '00-e2-69';
        this.port = 5005;
        this.status = 'offline'; // 'offline' | 'idle' | 'working'
        this.currentJobId = null;
        this.currentFileName = null;
        this.socket = null;
        this.pollInterval = null;
        this.laserRouterId = null;
    }

    start() {
        console.log('[RUIDA MONITOR] Inicializando monitorador Ruida Laser...');
        this.initSocket();
        this.ensureRouterRecord();
        
        // Scan ARP table to dynamically update IP if DHCP changes it
        this.scanArpForRuidaIp();

        // Polling loop every 5 seconds
        this.pollInterval = setInterval(() => {
            this.checkLaserStatus();
        }, 5000);
    }

    initSocket() {
        try {
            this.socket = dgram.createSocket('udp4');
            
            this.socket.on('error', (err) => {
                console.error('[RUIDA UDP ERROR]', err.message);
            });

            this.socket.on('message', (msg, rinfo) => {
                this.handleUdpResponse(msg, rinfo);
            });

            this.socket.bind(() => {
                try {
                    this.socket.setBroadcast(true);
                } catch (e) {}
            });
        } catch (err) {
            console.error('[RUIDA INIT ERROR]', err.message);
        }
    }

    async ensureRouterRecord() {
        try {
            const res = await this.pool.query("SELECT id FROM routers WHERE name ILIKE '%laser%' LIMIT 1");
            if (res.rows.length > 0) {
                this.laserRouterId = res.rows[0].id;
            } else {
                const newRec = await this.pool.query(
                    "INSERT INTO routers (name, status, status_note) VALUES ($1, $2, $3) RETURNING id",
                    ['Laser Ruida 192.168.0.174', 'active', 'Conectada na rede local via UDP 5005']
                );
                this.laserRouterId = newRec.rows[0].id;
                console.log(`[RUIDA MONITOR] Máquina 'Laser Ruida' registrada no DB com ID ${this.laserRouterId}`);
            }
        } catch (err) {
            console.error('[RUIDA DB INIT ERROR]', err.message);
        }
    }

    scanArpForRuidaIp() {
        exec('arp -a', (err, stdout) => {
            if (err || !stdout) return;
            const lines = stdout.split('\n');
            for (const line of lines) {
                const lower = line.toLowerCase();
                if (lower.includes(this.targetMacPrefix)) {
                    const match = lower.trim().match(/(\d+\.\d+\.\d+\.\d+)/);
                    if (match && match[1]) {
                        if (this.targetIp !== match[1]) {
                            console.log(`[RUIDA MONITOR] IP atualizado via ARP: ${this.targetIp} -> ${match[1]}`);
                            this.targetIp = match[1];
                        }
                        break;
                    }
                }
            }
        });
    }

    checkLaserStatus() {
        if (!this.socket) return;
        this.scanArpForRuidaIp();

        // Send status poll UDP packet (Ruida status inquiry command)
        const pollCmd = Buffer.from([0xd8, 0x00, 0x02, 0x00, 0x01, 0x00]);
        this.socket.send(pollCmd, this.port, this.targetIp, (err) => {
            if (err) {
                this.updateStatus('offline');
            }
        });

        // Ping check as fallback for connection state
        const isWin = process.platform === 'win32';
        const pingCmd = isWin ? `ping -n 1 -w 1000 ${this.targetIp}` : `ping -c 1 -W 1 ${this.targetIp}`;
        
        exec(pingCmd, (err, stdout) => {
            if (err || (stdout && stdout.includes('100% loss'))) {
                if (this.status !== 'offline') {
                    console.log(`[RUIDA MONITOR] Laser ${this.targetIp} desconectada / desligada.`);
                    this.updateStatus('offline');
                }
            } else {
                if (this.status === 'offline') {
                    console.log(`[RUIDA MONITOR] Laser ${this.targetIp} conectada e ONLINE!`);
                    this.updateStatus('idle');
                }
            }
        });
    }

    handleUdpResponse(msg, rinfo) {
        if (rinfo.address !== this.targetIp) return;
        
        // If we received UDP data from Ruida, it is ONLINE
        if (this.status === 'offline') {
            this.updateStatus('idle');
        }

        // Parse Ruida response bytes if payload exists
        if (msg.length >= 6) {
            const stateByte = msg[4]; // 0: Idle, 1: Working, 2: Paused
            if (stateByte === 1 && this.status !== 'working') {
                this.updateStatus('working');
            } else if (stateByte === 0 && this.status === 'working') {
                this.updateStatus('idle');
            }
        }
    }

    async updateStatus(newStatus, fileName = null) {
        if (this.status === newStatus && !fileName) return;
        const oldStatus = this.status;
        this.status = newStatus;
        console.log(`[RUIDA MONITOR] Status alterado: ${oldStatus} -> ${newStatus}`);

        try {
            // Update database routers table
            if (this.laserRouterId) {
                const dbStatus = newStatus === 'offline' ? 'offline' : 'active';
                const note = newStatus === 'working' ? `Em Corte: ${fileName || 'Arquivo Laser'}` : `Online (IP ${this.targetIp})`;
                await this.pool.query(
                    'UPDATE routers SET status = $1, status_note = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
                    [dbStatus, note, this.laserRouterId]
                );
            }

            // Handle Job Lifecycle
            if (newStatus === 'working' && oldStatus !== 'working') {
                const jobName = fileName || `Corte Laser ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
                const users = (await this.pool.query('SELECT id FROM users LIMIT 1')).rows;
                const userId = users[0] ? users[0].id : 1;

                const dt = new Date();
                const res = await this.pool.query(
                    'INSERT INTO jobs (file_name, folder, file_path, start_time, day, month, year, "userId", router_name) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
                    [jobName, 'Laser', 'IP:' + this.targetIp, dt.toISOString(), dt.getDate(), dt.getMonth() + 1, dt.getFullYear(), userId, 'Laser Ruida']
                );
                this.currentJobId = res.rows[0].id;
                this.currentFileName = jobName;

                if (this.autoSyncKanban) {
                    this.autoSyncKanban(userId, jobName, 'Laser', 'Laser Ruida', 'doing');
                }
            } else if (oldStatus === 'working' && newStatus !== 'working') {
                if (this.currentJobId) {
                    const dt = new Date();
                    const job = (await this.pool.query('SELECT start_time, "userId" FROM jobs WHERE id = $1', [this.currentJobId])).rows[0];
                    if (job) {
                        const durationMinutes = Math.max(0.1, (dt - new Date(job.start_time)) / 60000);
                        await this.pool.query(
                            'UPDATE jobs SET end_time = $1, duration_minutes = $2 WHERE id = $3',
                            [dt.toISOString(), durationMinutes, this.currentJobId]
                        );

                        if (this.autoSyncKanban) {
                            this.autoSyncKanban(job.userId, this.currentFileName, 'Laser', 'Laser Ruida', 'done');
                        }
                    }
                }
                this.currentJobId = null;
                this.currentFileName = null;
            }
        } catch (err) {
            console.error('[RUIDA STATUS UPDATE ERROR]', err.message);
        }
    }

    stop() {
        if (this.pollInterval) clearInterval(this.pollInterval);
        if (this.socket) this.socket.close();
    }
}

module.exports = RuidaMonitor;
