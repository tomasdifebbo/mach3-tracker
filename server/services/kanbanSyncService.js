const pool = require('../db/pool');

// Helper for matching G-code filenames/folders with Kanban card titles
function normalizeStr(str) {
    if (!str) return '';
    return String(str)
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\.(txt|tap|nc|gcode|cnc|dxf)$/i, '')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchKanbanTitle(jobFileName, jobFolder, cardTitle) {
    const normTitle = normalizeStr(cardTitle);
    if (!normTitle) return false;

    const normFile    = normalizeStr(jobFileName);
    const normFolder  = normalizeStr(jobFolder);
    const fullJobText = `${normFile} ${normFolder}`.trim();

    // 1. Exact match — always valid
    if (normFile && normFile === normTitle) return true;
    if (normFolder && normFolder === normTitle) return true;

    // 2. The job filename fully contains the entire card title string
    if (normFile && normFile.includes(normTitle) && normTitle.length >= 6) return true;
    if (normFolder && normFolder.includes(normTitle) && normTitle.length >= 6) return true;

    // 3. STRICT: ALL meaningful words of the card title must be present in the job text.
    // A generic filename like "mdf 9mm" will NEVER match a specific card title like
    // "chapa 2 MDF 9MM VETOR LOGO TARTARUGA e4mm" because unique words like
    // "vetor", "tartaruga", "reposicao" etc. would be absent from the job filename.
    const titleWords = normTitle.split(' ').filter(w => w.length >= 3);
    if (titleWords.length >= 2) {
        const allTitleWordsInJob = titleWords.every(w => fullJobText.includes(w));
        if (allTitleWordsInJob) {
            // Extra guard: at least 50% of the job's own words must appear in the title
            const jobWords = fullJobText.split(' ').filter(w => w.length >= 3);
            const jobHits  = jobWords.filter(w => normTitle.includes(w)).length;
            if (jobWords.length === 0 || jobHits / jobWords.length >= 0.5) {
                return true;
            }
        }
    }

    return false;
}

async function autoSyncKanban(userId, jobFileName, jobFolder, routerName, targetStatus, operatorName) {
    try {
        const tasks = (await pool.query('SELECT * FROM kanban_tasks WHERE "userId" = $1', [userId])).rows;
        let matched = false;

        for (const task of tasks) {
            if (matchKanbanTitle(jobFileName, jobFolder, task.title)) {
                matched = true;
                if (targetStatus === 'doing') {
                    await pool.query(
                        'UPDATE kanban_tasks SET column_id = $1, machine = COALESCE($2, machine), operator = COALESCE($3, operator) WHERE id = $4 AND "userId" = $5',
                        ['doing', routerName || null, operatorName || null, task.id, userId]
                    );
                    console.log(`[KANBAN AUTO-SYNC] Card "${task.title}" (ID ${task.id}) moved -> DOING (${routerName})`);
                } else if (targetStatus === 'done' && task.column_id === 'doing') {
                    await pool.query(
                        'UPDATE kanban_tasks SET column_id = $1 WHERE id = $2 AND "userId" = $3',
                        ['done', task.id, userId]
                    );
                    console.log(`[KANBAN AUTO-SYNC] Card "${task.title}" (ID ${task.id}) moved DOING -> DONE`);
                }
            }
        }

        if (targetStatus === 'doing') {
            // Mover cartões antigos da mesma máquina de DOING -> DONE ao iniciar um novo serviço
            if (routerName) {
                const previousActiveCards = tasks.filter(t => t.column_id === 'doing' && t.machine && (t.machine.toLowerCase().includes(routerName.toLowerCase()) || routerName.toLowerCase().includes(t.machine.toLowerCase())));
                for (const oldCard of previousActiveCards) {
                    if (!jobFileName || !oldCard.title.toLowerCase().includes(jobFileName.toLowerCase())) {
                        await pool.query('UPDATE kanban_tasks SET column_id = $1 WHERE id = $2 AND "userId" = $3', ['done', oldCard.id, userId]);
                        console.log(`[KANBAN AUTO-SYNC] Cartão antigo "${oldCard.title}" (ID ${oldCard.id}) movido DOING -> DONE em ${routerName}`);
                    }
                }
            }

            // Criar novo cartão Kanban com o nome exato do arquivo se não houver correspondência
            if (!matched && jobFileName && jobFileName !== 'Desconhecido') {
                const todayStr = new Date().toISOString().split('T')[0];
                await pool.query(
                    `INSERT INTO kanban_tasks (title, machine, operator, date, priority, column_id, "userId") 
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [jobFileName, routerName || 'Router CNC', operatorName || 'Operador', todayStr, 'alta', 'doing', userId]
                );
                console.log(`[KANBAN AUTO-CREATE] Cartão O.S. criado: "${jobFileName}" em ${routerName}`);
            }
        } else if (targetStatus === 'done' && routerName) {
            // Ao finalizar o serviço, mover qualquer cartão em DOING desta máquina para DONE
            const activeOnMachine = tasks.filter(t => t.column_id === 'doing' && t.machine && (t.machine.toLowerCase().includes(routerName.toLowerCase()) || routerName.toLowerCase().includes(t.machine.toLowerCase())));
            for (const card of activeOnMachine) {
                await pool.query('UPDATE kanban_tasks SET column_id = $1 WHERE id = $2 AND "userId" = $3', ['done', card.id, userId]);
                console.log(`[KANBAN AUTO-SYNC] Cartão finalizado "${card.title}" (ID ${card.id}) DOING -> DONE em ${routerName}`);
            }
        }
    } catch (err) {
        console.error('[KANBAN AUTO-SYNC ERROR]', err.message);
    }
}

// Sincroniza automaticamente qualquer alteração do Histórico (jobs) com a Linha do Tempo (operator_time_logs)
async function syncJobToTimeline(userId, updatedJob, oldJob = null) {
    if (!updatedJob) return;
    try {
        let opRes = null;
        const opNameTrimmed = (updatedJob.operator_name || '').trim();
        if (opNameTrimmed && opNameTrimmed.toLowerCase() !== 'desconhecido') {
            opRes = (await pool.query(
                'SELECT id, name, status FROM operators WHERE LOWER(name) = LOWER($1) AND "userId" = $2 LIMIT 1',
                [opNameTrimmed, userId]
            )).rows[0];

            // Se o operador foi digitado manualmente no Histórico e ainda não existir na tabela operators, cadastra-o
            if (!opRes) {
                opRes = (await pool.query(
                    'INSERT INTO operators (name, shift, "userId", status, location) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, status',
                    [opNameTrimmed, 'Geral', userId, 'disponivel', 'Na Fábrica']
                )).rows[0];
            }
        }

        const startDt = new Date(updatedJob.start_time);
        const endDt = updatedJob.end_time ? new Date(updatedJob.end_time) : null;
        const durMin = endDt ? parseFloat(Math.max(0.1, (endDt - startDt) / 60000).toFixed(2)) : null;
        const machineLoc = updatedJob.router_name ? `⚙️ ${updatedJob.router_name}` : 'Na Máquina';
        const qtyVal = parseInt(updatedJob.quantity, 10) || 1;
        const qtyNote = qtyVal > 1 ? `Qtd: ${qtyVal} UN` : null;

        // 1. Procura card vinculado por job_id
        let matchedLogs = (await pool.query(
            'SELECT * FROM operator_time_logs WHERE "userId" = $1 AND job_id = $2 ORDER BY id ASC',
            [userId, updatedJob.id]
        )).rows;

        // 2. Fallback para registros antigos sem job_id preenchido
        if (matchedLogs.length === 0) {
            const refTitle = (oldJob && oldJob.file_name) || updatedJob.file_name;
            const refStart = (oldJob && oldJob.start_time) || updatedJob.start_time;
            if (refTitle && refStart) {
                matchedLogs = (await pool.query(
                    `SELECT * FROM operator_time_logs
                     WHERE "userId" = $1
                       AND job_id IS NULL
                       AND kanban_title = $2
                       AND ABS(EXTRACT(EPOCH FROM (start_time - $3::timestamp))) < 120
                     ORDER BY ABS(EXTRACT(EPOCH FROM (start_time - $3::timestamp))) ASC
                     LIMIT 1`,
                    [userId, refTitle, new Date(refStart).toISOString()]
                )).rows;
            }
        }

        if (matchedLogs.length > 0) {
            const primary = matchedLogs[0];
            let mergedNotes = primary.notes || null;
            if (mergedNotes) {
                mergedNotes = mergedNotes.replace(/(?:^|\s*\|\s*)Qtd:\s*\d+\s*UN/gi, '').trim() || null;
            }
            if (qtyNote) {
                mergedNotes = mergedNotes ? `${qtyNote} | ${mergedNotes}` : qtyNote;
            }

            if (opRes) {
                await pool.query(
                    `UPDATE operator_time_logs
                     SET job_id = $1,
                         operator_id = $2,
                         operator_name = $3,
                         location = $4,
                         kanban_title = $5,
                         start_time = $6,
                         end_time = $7,
                         duration_minutes = $8,
                         notes = $9
                     WHERE id = $10 AND "userId" = $11`,
                    [
                        updatedJob.id,
                        opRes.id,
                        opRes.name,
                        machineLoc,
                        updatedJob.file_name,
                        startDt.toISOString(),
                        endDt ? endDt.toISOString() : null,
                        durMin,
                        mergedNotes,
                        primary.id,
                        userId
                    ]
                );
            } else {
                await pool.query(
                    `UPDATE operator_time_logs
                     SET job_id = $1,
                         location = $2,
                         kanban_title = $3,
                         start_time = $4,
                         end_time = $5,
                         duration_minutes = $6,
                         notes = $7
                     WHERE id = $8 AND "userId" = $9`,
                    [
                        updatedJob.id,
                        machineLoc,
                        updatedJob.file_name,
                        startDt.toISOString(),
                        endDt ? endDt.toISOString() : null,
                        durMin,
                        mergedNotes,
                        primary.id,
                        userId
                    ]
                );
            }

            // Remove eventuais fragmentos duplicados do mesmo job_id
            if (matchedLogs.length > 1) {
                const extraIds = matchedLogs.slice(1).map(l => l.id);
                await pool.query('DELETE FROM operator_time_logs WHERE id = ANY($1::int[]) AND "userId" = $2', [extraIds, userId]);
            }
        } else if (opRes) {
            // Se não existia card na Linha do Tempo para este job, cria automaticamente
            await pool.query(
                `INSERT INTO operator_time_logs (
                    "userId", operator_id, operator_name, status, location, kanban_title,
                    start_time, end_time, duration_minutes, notes, job_id
                ) VALUES ($1, $2, $3, 'disponivel', $4, $5, $6, $7, $8, $9, $10)`,
                [
                    userId,
                    opRes.id,
                    opRes.name,
                    machineLoc,
                    updatedJob.file_name,
                    startDt.toISOString(),
                    endDt ? endDt.toISOString() : null,
                    durMin,
                    qtyNote,
                    updatedJob.id
                ]
            );
        }

        // Se o operador foi alterado, transfere ou limpa eventual bloco ocioso 'Na Fábrica' imediatamente adjacente ao término deste corte
        if (opRes && oldJob && oldJob.operator_name && oldJob.operator_name.trim().toLowerCase() !== opRes.name.toLowerCase() && (oldJob.end_time || updatedJob.end_time)) {
            const refEnd = new Date(oldJob.end_time || updatedJob.end_time).toISOString();
            const adjIdle = (await pool.query(
                `SELECT id, start_time, end_time FROM operator_time_logs
                 WHERE "userId" = $1
                   AND job_id IS NULL
                   AND kanban_title IS NULL
                   AND location = 'Na Fábrica'
                   AND LOWER(operator_name) = LOWER($2)
                   AND ABS(EXTRACT(EPOCH FROM (start_time - $3::timestamp))) < 15`,
                [userId, oldJob.operator_name.trim(), refEnd]
            )).rows;

            for (const idle of adjIdle) {
                // Verifica se o novo operador já tem atividade nesse intervalo
                const overlap = idle.end_time ? (await pool.query(
                    `SELECT id FROM operator_time_logs
                     WHERE "userId" = $1 AND operator_id = $2
                       AND start_time < $4::timestamp AND COALESCE(end_time, NOW()) > $3::timestamp
                     LIMIT 1`,
                    [userId, opRes.id, new Date(idle.start_time).toISOString(), new Date(idle.end_time).toISOString()]
                )).rows[0] : true;

                if (overlap) {
                    await pool.query('DELETE FROM operator_time_logs WHERE id = $1 AND "userId" = $2', [idle.id, userId]);
                } else {
                    await pool.query(
                        'UPDATE operator_time_logs SET operator_id = $1, operator_name = $2 WHERE id = $3 AND "userId" = $4',
                        [opRes.id, opRes.name, idle.id, userId]
                    );
                }
            }
        }
    } catch (syncErr) {
        console.error('[TIMELINE SYNC ERROR]:', syncErr);
    }
}

module.exports = {
    normalizeStr,
    matchKanbanTitle,
    autoSyncKanban,
    syncJobToTimeline
};
