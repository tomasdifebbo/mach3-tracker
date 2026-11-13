const pool = require('../db/pool');
const { transporter } = require('../config/constants');

// ==========================================
// AUTOMATION & REPORT CYCLE ENGINE
// ==========================================
async function executeReportCycle(userId, options = {}) {
    const userRes = await pool.query(
        'SELECT id, email, "costPerHour", "plannedHours", report_email, daily_report, idle_alert, weekly_report, theme, company_logo, company_legal_name FROM users WHERE id = $1',
        [userId]
    );
    const user = userRes.rows[0];
    if (!user) throw new Error('Usuário não encontrado');

    // Sync company logo if provided in options and not yet stored
    if (options.company_logo && !user.company_logo) {
        await pool.query('UPDATE users SET company_logo = $1 WHERE id = $2', [options.company_logo, userId]).catch(() => {});
        user.company_logo = options.company_logo;
    }

    const isWeekly = options.period === 'week' || options.days === 7 || options.days === '7' || Boolean(options.weekly);
    const periodLabel = isWeekly ? 'Últimos 7 Dias (Semanal)' : 'de Hoje';
    const reportType = isWeekly ? 'weekly_report' : 'daily_report';

    const recipient = options.report_email || user.report_email || user.email || '';
    const companyLogo = options.company_logo || user.company_logo || null;
    const companyName = user.company_legal_name || user.company_name || 'Mach3 Tracker';
    const now = new Date();
    
    // Sao Paulo time
    const spOptions = { timeZone: 'America/Sao_Paulo' };
    const dateFormatted = new Intl.DateTimeFormat('pt-BR', {
        ...spOptions,
        dateStyle: 'full',
        timeStyle: 'short'
    }).format(now);

    const spParts = new Intl.DateTimeFormat('en-US', {
        ...spOptions,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric'
    }).formatToParts(now);

    const todayYear = Number(spParts.find(p => p.type === 'year').value);
    const todayMonth = Number(spParts.find(p => p.type === 'month').value);
    const todayDay = Number(spParts.find(p => p.type === 'day').value);

    // 1. Query Jobs: last 7 days or today
    let jobsList = [];
    if (isWeekly) {
        const jobsRes = await pool.query(
            `SELECT * FROM jobs 
             WHERE ("userId" = $1) 
               AND (start_time >= NOW() - INTERVAL '7 days')
             ORDER BY start_time ASC`,
            [userId]
        );
        jobsList = jobsRes.rows;
    } else {
        const jobsRes = await pool.query(
            `SELECT * FROM jobs 
             WHERE ("userId" = $1) 
               AND (year = $2 AND month = $3 AND day = $4)
             ORDER BY id ASC`,
            [userId, todayYear, todayMonth, todayDay]
        );
        jobsList = jobsRes.rows;
        if (jobsList.length === 0) {
            const fallbackRes = await pool.query(
                'SELECT * FROM jobs WHERE ("userId" = $1) ORDER BY id DESC LIMIT 10',
                [userId]
            );
            jobsList = fallbackRes.rows.reverse();
        }
    }

    // 2. Query Operator Time Logs (External services, other sectors, etc.)
    let logsList = [];
    if (isWeekly) {
        const logsRes = await pool.query(
            `SELECT * FROM operator_time_logs 
             WHERE ("userId" = $1) 
               AND ((start_time AT TIME ZONE 'America/Sao_Paulo') >= (NOW() AT TIME ZONE 'America/Sao_Paulo' - INTERVAL '7 days'))
             ORDER BY start_time ASC`,
            [userId]
        );
        logsList = logsRes.rows;
    } else {
        const logsRes = await pool.query(
            `SELECT * FROM operator_time_logs 
             WHERE ("userId" = $1) 
               AND ((start_time AT TIME ZONE 'America/Sao_Paulo')::date = MAKE_DATE($2, $3, $4))
             ORDER BY start_time ASC`,
            [userId, todayYear, todayMonth, todayDay]
        );
        logsList = logsRes.rows;
    }

    // Categorize logs into external, other sector, and maintenance
    const externalServices = [];
    const otherSectorServices = [];
    const maintenanceServices = [];

    logsList.forEach(l => {
        const st = (l.status || '').toLowerCase();
        const loc = (l.location || '').toLowerCase();
        const notes = (l.notes || '').toLowerCase();
        const text = `${st} ${loc} ${notes}`;
        const rawDur = Number(l.duration_minutes) || 0;
        // Cap unclosed shifts to 480 min (8h)
        const dur = Math.min(rawDur, 480);
        if (dur <= 0) return;

        const dateStr = l.start_time ? new Date(l.start_time).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—';
        const timeStr = l.start_time ? new Date(l.start_time).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—';
        const item = {
            id: l.id,
            operator: (l.operator_name || 'Não informado').trim(),
            status: l.status,
            location: l.location,
            notes: l.notes || '',
            duration: dur,
            hours: (dur / 60).toFixed(1),
            date: dateStr,
            time: timeStr
        };

        if (st === 'externo' || text.includes('externo') || text.includes('compra') || text.includes('montagem')) {
            externalServices.push(item);
        } else if (st === 'outro_setor' || text.includes('setor') || text.includes('embalag') || text.includes('acabamento') || text.includes('coral') || text.includes('pintura')) {
            otherSectorServices.push(item);
        } else if (st === 'limpeza' || text.includes('limpez') || text.includes('manuten')) {
            maintenanceServices.push(item);
        }
    });

    // 3. Operator Unified Quantification
    const operatorSummary = {};

    function getOp(name) {
        const clean = (name || 'Não informado').trim();
        const key = clean.toUpperCase();
        if (!operatorSummary[key]) {
            operatorSummary[key] = {
                name: clean,
                machineMins: 0,
                machineJobs: 0,
                externalMins: 0,
                externalCount: 0,
                otherSectorMins: 0,
                otherSectorCount: 0,
                maintenanceMins: 0,
                routers: new Set()
            };
        }
        return operatorSummary[key];
    }

    // Machine cuts
    let totalMachineMins = 0;
    const materialStats = {};
    jobsList.forEach(j => {
        const mins = Number(j.duration_minutes) || 0;
        totalMachineMins += mins;
        const op = getOp(j.operator_name);
        op.machineMins += mins;
        op.machineJobs += 1;
        if (j.router_name) op.routers.add(j.router_name);

        const mat = j.material_name ? j.material_name.trim() : 'Diversos';
        materialStats[mat] = (materialStats[mat] || 0) + 1;
    });

    // External services
    let totalExternalMins = 0;
    externalServices.forEach(s => {
        totalExternalMins += s.duration;
        const op = getOp(s.operator);
        op.externalMins += s.duration;
        op.externalCount += 1;
    });

    // Other sector services
    let totalOtherSectorMins = 0;
    otherSectorServices.forEach(s => {
        totalOtherSectorMins += s.duration;
        const op = getOp(s.operator);
        op.otherSectorMins += s.duration;
        op.otherSectorCount += 1;
    });

    // Maintenance
    let totalMaintenanceMins = 0;
    maintenanceServices.forEach(s => {
        totalMaintenanceMins += s.duration;
        const op = getOp(s.operator);
        op.maintenanceMins += s.duration;
    });

    const totalProductiveMinutes = totalMachineMins + totalExternalMins + totalOtherSectorMins + totalMaintenanceMins;
    const totalProductiveHours = (totalProductiveMinutes / 60).toFixed(1);
    const totalMachineHours = (totalMachineMins / 60).toFixed(1);
    const totalExternalHours = (totalExternalMins / 60).toFixed(1);
    const totalOtherSectorHours = (totalOtherSectorMins / 60).toFixed(1);
    const totalJobs = jobsList.length;

    const costPerHour = Number(user.costPerHour) || 50;
    const totalCost = ((totalMachineMins / 60) * costPerHour).toFixed(2).replace('.', ',');

    // Ranked Operators
    const operatorRank = Object.values(operatorSummary)
        .map(o => {
            const totalWorked = o.machineMins + o.externalMins + o.otherSectorMins + o.maintenanceMins;
            const pct = totalProductiveMinutes > 0 ? ((totalWorked / totalProductiveMinutes) * 100).toFixed(1) : '0';
            return {
                name: o.name,
                totalWorkedMins: totalWorked.toFixed(1),
                totalWorkedHours: (totalWorked / 60).toFixed(1),
                machineHours: (o.machineMins / 60).toFixed(1),
                machineMins: o.machineMins.toFixed(1),
                machineJobs: o.machineJobs,
                externalHours: (o.externalMins / 60).toFixed(1),
                externalCount: o.externalCount,
                otherSectorHours: (o.otherSectorMins / 60).toFixed(1),
                otherSectorCount: o.otherSectorCount,
                machines: Array.from(o.routers).join(', ') || '—',
                pct
            };
        })
        .sort((a, b) => Number(b.totalWorkedMins) - Number(a.totalWorkedMins));

    // Daily Evolution (for weekly reports)
    const dailyEvolution = {};
    if (isWeekly) {
        for (let i = 6; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const dayKey = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
            const weekday = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short' });
            dailyEvolution[dayKey] = {
                dayKey,
                weekday: weekday.toUpperCase().replace('.', ''),
                machineMins: 0,
                jobsCount: 0,
                externalMins: 0,
                otherSectorMins: 0
            };
        }

        jobsList.forEach(j => {
            if (!j.start_time) return;
            const key = new Date(j.start_time).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
            if (dailyEvolution[key]) {
                dailyEvolution[key].machineMins += (Number(j.duration_minutes) || 0);
                dailyEvolution[key].jobsCount += 1;
            }
        });

        externalServices.forEach(s => {
            if (dailyEvolution[s.date]) {
                dailyEvolution[s.date].externalMins += s.duration;
            }
        });

        otherSectorServices.forEach(s => {
            if (dailyEvolution[s.date]) {
                dailyEvolution[s.date].otherSectorMins += s.duration;
            }
        });
    }

    // Chronological Timeline items (most recent first if many, or up to 20)
    const chronologicalJobs = [...jobsList].sort((a, b) => {
        const timeA = a.start_time ? new Date(a.start_time).getTime() : a.id;
        const timeB = b.start_time ? new Date(b.start_time).getTime() : b.id;
        return isWeekly ? timeB - timeA : timeA - timeB;
    });

    const timelineItems = chronologicalJobs.slice(0, 25).map((j, index) => {
        const sTime = j.start_time ? new Date(j.start_time).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—';
        const eTime = j.end_time ? new Date(j.end_time).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—';
        const dateStr = j.start_time ? new Date(j.start_time).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : '';
        const dur = (Number(j.duration_minutes) || 0).toFixed(1);
        const op = j.operator_name || 'Não informado';
        const mat = j.material_name || 'Diversos';
        const router = j.router_name || 'Router';
        return {
            index: index + 1,
            timeRange: isWeekly ? `${dateStr} ${sTime} → ${eTime}` : `${sTime} às ${eTime}`,
            dur: `${dur} min`,
            router,
            fileName: j.file_name,
            operator: op,
            material: mat
        };
    });

    // Idle machines check (for this user's routers)
    const routersRes = await pool.query(
        'SELECT * FROM routers WHERE "userId" = $1 ORDER BY id ASC',
        [userId]
    );

    const idleMachines = [];
    const activeMachines = [];

    for (const r of routersRes.rows) {
        const lastJobRes = await pool.query(
            'SELECT * FROM jobs WHERE ("userId" = $1) AND (router_name ILIKE $2) ORDER BY id DESC LIMIT 1',
            [userId, `%${r.name}%`]
        );
        const lastJob = lastJobRes.rows[0];
        let idleMinutes = null;
        let lastEndTime = null;

        if (lastJob) {
            const timeVal = new Date(lastJob.end_time || lastJob.start_time);
            if (!isNaN(timeVal.getTime())) {
                lastEndTime = timeVal;
                idleMinutes = Math.floor((now.getTime() - timeVal.getTime()) / (1000 * 60));
            }
        }

        const isIdle = idleMinutes === null || idleMinutes >= 60;
        const machineData = {
            id: r.id,
            name: r.name,
            status: r.status,
            idleMinutes: idleMinutes || 999,
            idleFormatted: idleMinutes !== null ? (idleMinutes >= 60 ? `${Math.floor(idleMinutes / 60)}h ${idleMinutes % 60}m` : `${idleMinutes}m`) : 'Sem registro recente',
            lastJob: lastJob ? lastJob.file_name : 'Nenhum',
            lastEndTime: lastEndTime ? lastEndTime.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—',
            operator: r.operator_name || (lastJob ? lastJob.operator_name : '—')
        };

        if (isIdle) {
            idleMachines.push(machineData);
        } else {
            activeMachines.push(machineData);
        }
    }

    // Process Logo and CID Attachment for Email Clients
    const mailAttachments = [];
    let logoImgSrc = companyLogo;

    if (companyLogo && companyLogo.startsWith('data:image/')) {
        const matches = companyLogo.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
        if (matches) {
            const contentType = matches[1];
            const base64Data = matches[2];
            const ext = contentType.split('/')[1] || 'png';
            mailAttachments.push({
                filename: `company_logo.${ext}`,
                content: Buffer.from(base64Data, 'base64'),
                cid: 'company_logo_img'
            });
            logoImgSrc = 'cid:company_logo_img';
        }
    }

    // Build Email HTML
    const emailHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MACH3 Tracker - ${isWeekly ? 'Relatório Semanal Consolidado' : 'Resumo Diário de Produção'}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #080c16; color: #f1f5f9; margin: 0; padding: 24px 12px; }
        .wrapper { max-width: 720px; margin: 0 auto; background-color: #0b1120; border: 1px solid #1e293b; border-radius: 20px; padding: 28px 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
        .card { background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 20px; margin-bottom: 20px; }
        .grid { display: flex; gap: 10px; flex-wrap: wrap; }
        .kpi { flex: 1; min-width: 120px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 14px 10px; text-align: center; }
        .kpi-val { font-size: 20px; font-weight: 800; color: #06b6d4; margin-top: 4px; }
        .kpi-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; font-weight: bold; }
        .alert-box { background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 14px; padding: 16px; margin-bottom: 20px; }
        .alert-title { color: #f87171; font-weight: bold; font-size: 15px; display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th { text-align: left; font-size: 11px; text-transform: uppercase; color: #94a3b8; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); }
        td { font-size: 13px; padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .btn { display: inline-block; background-color: #06b6d4; color: #000000 !important; font-weight: 800; padding: 12px 28px; border-radius: 12px; text-decoration: none; margin-top: 16px; font-size: 13px; letter-spacing: 0.5px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        
        <!-- Header with Company Logo -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-bottom: 1px solid #1e293b; padding-bottom: 20px; margin-bottom: 24px;">
          <tr>
            <td valign="middle" align="left">
              <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                  ${companyLogo ? `
                    <td valign="middle" style="padding-right: 14px;">
                      <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 6px 12px; display: inline-block;">
                        <img src="${logoImgSrc}" alt="Logo da Empresa" style="max-height: 48px; max-width: 140px; object-fit: contain; vertical-align: middle; display: block;" />
                      </div>
                    </td>
                  ` : `
                    <td valign="middle" style="padding-right: 12px; font-size: 32px;">🔩</td>
                  `}
                  <td valign="middle">
                    <div style="font-size: 19px; font-weight: 900; letter-spacing: 0.5px; color: #ffffff;">${companyName.toUpperCase()}</div>
                    <div style="font-size: 11px; color: #06b6d4; font-weight: 800; letter-spacing: 1.5px; margin-top: 3px;">
                      ${isWeekly ? 'RELATÓRIO SEMANAL CONSOLIDADO (7 DIAS)' : 'RESUMO DIÁRIO DE PRODUÇÃO & APONTAMENTOS'}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
            <td valign="middle" align="right">
              <div style="font-size: 12px; color: #94a3b8; margin-bottom: 4px;">${dateFormatted}</div>
              <span style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.3); font-size: 10px; font-weight: bold; padding: 3px 10px; border-radius: 12px; text-transform: uppercase; display: inline-block;">
                ${isWeekly ? 'Fechamento Semanal' : 'Fechamento de Turno'}
              </span>
            </td>
          </tr>
        </table>

        <!-- Idle Alert Banner (if applicable) -->
        ${idleMachines.length > 0 && !isWeekly ? `
        <div class="alert-box">
          <div class="alert-title">
            ⚠️ ALERTA DE OCIOSIDADE: ${idleMachines.length} MÁQUINA(S) PARADA(S) HÁ MAIS DE 1 HORA
          </div>
          <p style="font-size: 12px; color: #fca5a5; margin: 0 0 12px 0;">
            As seguintes máquinas CNC/Laser estão inativas há mais tempo que o limite de tolerância estabelecido.
          </p>
          <table>
            <thead>
              <tr>
                <th>Máquina</th>
                <th>Tempo Parada</th>
                <th>Último Arquivo</th>
                <th>Operador</th>
              </tr>
            </thead>
            <tbody>
              ${idleMachines.map(m => `
                <tr>
                  <td style="font-weight: bold; color: #fff;">${m.name}</td>
                  <td style="color: #f87171; font-weight: bold;">${m.idleFormatted}</td>
                  <td style="color: #cbd5e1; font-family: monospace; font-size: 12px;">${m.lastJob}</td>
                  <td style="color: #94a3b8;">${m.operator}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- KPI Grid -->
        <div class="card">
          <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #fff; margin-bottom: 14px; letter-spacing: 1px;">
            📊 Indicadores Consolidados ${periodLabel}
          </div>
          <div class="grid">
            <div class="kpi">
              <div class="kpi-lbl">Peças Usinadas</div>
              <div class="kpi-val">${totalJobs}</div>
            </div>
            <div class="kpi">
              <div class="kpi-lbl">Horas Máquina</div>
              <div class="kpi-val">${totalMachineHours}h</div>
            </div>
            <div class="kpi">
              <div class="kpi-lbl">Serviços Externos</div>
              <div class="kpi-val" style="color: #fbbf24;">${totalExternalHours}h</div>
            </div>
            <div class="kpi">
              <div class="kpi-lbl">Outros Setores</div>
              <div class="kpi-val" style="color: #60a5fa;">${totalOtherSectorHours}h</div>
            </div>
            <div class="kpi">
              <div class="kpi-lbl">Custo Máquina</div>
              <div class="kpi-val" style="color: #34d399;">R$ ${totalCost}</div>
            </div>
          </div>
          <div style="margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 12px; color: #94a3b8; text-align: center;">
            ⏱️ <strong>Total de Horas Produtivas Computadas na Equipe:</strong> <span style="color: #38bdf8; font-weight: bold;">${totalProductiveHours} horas</span> (Usinagem + Externos + Setores)
          </div>
        </div>

        <!-- Operator Quantification Section (UNIFIED) -->
        <div class="card">
          <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #fff; margin-bottom: 14px; letter-spacing: 1px;">
            👥 Tempo & Produtividade dos Operadores (Total Geral)
          </div>
          <table>
            <thead>
              <tr>
                <th>Operador</th>
                <th style="text-align: right;">Usinagem CNC</th>
                <th style="text-align: right;">Serviço Externo</th>
                <th style="text-align: right;">Outros Setores</th>
                <th style="text-align: right;">Total Horas</th>
                <th style="text-align: left; width: 110px; padding-left: 12px;">Participação</th>
              </tr>
            </thead>
            <tbody>
              ${operatorRank.map(op => `
                <tr>
                  <td style="font-weight: bold; color: #ffffff;">
                    🧑‍🔧 ${op.name}
                    <div style="font-size: 10px; color: #94a3b8; font-weight: normal;">${op.machines}</div>
                  </td>
                  <td style="text-align: right; color: #06b6d4; font-weight: bold;">
                    ${op.machineHours}h <span style="font-size: 10px; color: #94a3b8; font-weight: normal;">(${op.machineJobs} peças)</span>
                  </td>
                  <td style="text-align: right; color: #fbbf24; font-weight: bold;">
                    ${op.externalHours > 0 ? `${op.externalHours}h` : '—'}
                  </td>
                  <td style="text-align: right; color: #60a5fa; font-weight: bold;">
                    ${op.otherSectorHours > 0 ? `${op.otherSectorHours}h` : '—'}
                  </td>
                  <td style="text-align: right; color: #34d399; font-weight: 900; font-size: 14px;">
                    ${op.totalWorkedHours}h
                  </td>
                  <td style="padding-left: 12px;">
                    <div style="font-size: 11px; color: #34d399; font-weight: bold; margin-bottom: 3px;">
                      ${op.pct}%
                    </div>
                    <div style="background: rgba(255,255,255,0.08); height: 6px; border-radius: 3px; overflow: hidden; width: 100%;">
                      <div style="background: #06b6d4; height: 6px; width: ${op.pct}%; border-radius: 3px;"></div>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- External Services Card -->
        ${externalServices.length > 0 ? `
        <div class="card" style="border-left: 4px solid #fbbf24;">
          <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #fbbf24; margin-bottom: 12px; letter-spacing: 1px;">
            🟡 Serviços Externos Registrados (${externalServices.length} Apontamentos • ${totalExternalHours}h)
          </div>
          <table>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Operador</th>
                <th>Atividade / Destino</th>
                <th style="text-align: right;">Duração</th>
              </tr>
            </thead>
            <tbody>
              ${externalServices.map(s => `
                <tr>
                  <td style="font-size: 12px; color: #cbd5e1; font-family: monospace;">${s.date} ${s.time}</td>
                  <td style="font-weight: bold; color: #ffffff;">${s.operator}</td>
                  <td style="color: #fde68a;">
                    <strong>${s.location}</strong>
                    ${s.notes && s.notes !== s.location ? `<div style="font-size: 11px; color: #94a3b8;">${s.notes}</div>` : ''}
                  </td>
                  <td style="text-align: right; color: #fbbf24; font-weight: bold;">
                    ${s.hours}h <span style="font-size: 10px; color: #94a3b8; font-weight: normal;">(${s.duration.toFixed(0)} min)</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- Other Sectors Card -->
        ${otherSectorServices.length > 0 ? `
        <div class="card" style="border-left: 4px solid #60a5fa;">
          <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #60a5fa; margin-bottom: 12px; letter-spacing: 1px;">
            🔵 Serviços em Outros Setores da Fábrica (${otherSectorServices.length} Apontamentos • ${totalOtherSectorHours}h)
          </div>
          <table>
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Operador</th>
                <th>Setor / Atividade</th>
                <th style="text-align: right;">Duração</th>
              </tr>
            </thead>
            <tbody>
              ${otherSectorServices.map(s => `
                <tr>
                  <td style="font-size: 12px; color: #cbd5e1; font-family: monospace;">${s.date} ${s.time}</td>
                  <td style="font-weight: bold; color: #ffffff;">${s.operator}</td>
                  <td style="color: #bfdbfe;">
                    <strong>${s.location}</strong>
                    ${s.notes && s.notes !== s.location ? `<div style="font-size: 11px; color: #94a3b8;">${s.notes}</div>` : ''}
                  </td>
                  <td style="text-align: right; color: #60a5fa; font-weight: bold;">
                    ${s.hours}h <span style="font-size: 10px; color: #94a3b8; font-weight: normal;">(${s.duration.toFixed(0)} min)</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- Daily Evolution (For Weekly Report) -->
        ${isWeekly ? `
        <div class="card">
          <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #fff; margin-bottom: 14px; letter-spacing: 1px;">
            📈 Evolução Diária da Produção (Últimos 7 Dias)
          </div>
          <table style="text-align: center;">
            <thead>
              <tr>
                <th>Data</th>
                <th>Dia</th>
                <th>Peças Cortadas</th>
                <th>Usinagem (h)</th>
                <th>Externo (h)</th>
                <th>Outros Setores (h)</th>
              </tr>
            </thead>
            <tbody>
              ${Object.values(dailyEvolution).map(d => `
                <tr>
                  <td style="font-weight: bold; color: #ffffff; font-family: monospace;">${d.dayKey}</td>
                  <td style="color: #94a3b8; font-size: 11px; font-weight: bold;">${d.weekday}</td>
                  <td style="color: #06b6d4; font-weight: bold;">${d.jobsCount} peças</td>
                  <td style="color: #cbd5e1;">${(d.machineMins / 60).toFixed(1)}h</td>
                  <td style="color: #fbbf24;">${d.externalMins > 0 ? `${(d.externalMins / 60).toFixed(1)}h` : '—'}</td>
                  <td style="color: #60a5fa;">${d.otherSectorMins > 0 ? `${(d.otherSectorMins / 60).toFixed(1)}h` : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}

        <!-- Production Timeline -->
        <div class="card">
          <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #fff; margin-bottom: 16px; letter-spacing: 1px;">
            ⏱️ Linha do Tempo da Produção (Timeline ${isWeekly ? 'Recente' : 'do Dia'})
          </div>
          <div style="padding-left: 10px; border-left: 2px solid #06b6d4; margin-left: 8px;">
            ${timelineItems.map((item) => `
              <div style="position: relative; margin-bottom: 18px; padding-left: 18px;">
                <div style="position: absolute; left: -19px; top: 4px; width: 10px; height: 10px; border-radius: 50%; background: #06b6d4; border: 2px solid #0f172a;"></div>
                <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 8px;">
                  <div>
                    <span style="font-size: 11px; font-weight: 800; color: #38bdf8; background: rgba(56,189,248,0.1); padding: 2px 7px; border-radius: 4px; font-family: monospace;">
                      ${item.timeRange}
                    </span>
                    <span style="font-size: 12px; font-weight: bold; color: #c084fc; margin-left: 8px;">
                      [${item.router}]
                    </span>
                  </div>
                  <span style="font-size: 12px; font-weight: 800; color: #34d399; background: rgba(52,211,153,0.1); padding: 2px 8px; border-radius: 12px;">
                    ⏱️ ${item.dur}
                  </span>
                </div>
                <div style="font-size: 13px; font-weight: bold; color: #ffffff; margin-top: 5px; font-family: monospace;">
                  📄 ${item.fileName}
                </div>
                <div style="font-size: 11px; color: #94a3b8; margin-top: 4px; display: flex; gap: 14px; flex-wrap: wrap;">
                  <span>👤 Operador: <strong style="color: #cbd5e1;">${item.operator}</strong></span>
                  <span>📦 Material: <strong style="color: #cbd5e1;">${item.material}</strong></span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Materials Distribution -->
        <div class="card">
          <div style="font-size: 13px; font-weight: 800; text-transform: uppercase; color: #fff; margin-bottom: 12px; letter-spacing: 1px;">
            📦 Insumos & Materiais Usinados (${Object.keys(materialStats).length} Tipos)
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            ${Object.entries(materialStats).map(([mat, count]) => `
              <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 8px 12px; border-radius: 10px; display: flex; align-items: center; gap: 8px;">
                <span style="color: #06b6d4; font-size: 12px;">●</span>
                <span style="font-size: 12px; color: #e2e8f0; font-weight: 600;">${mat}</span>
                <span style="background: rgba(6,182,212,0.15); color: #06b6d4; font-size: 11px; font-weight: 800; padding: 2px 6px; border-radius: 6px;">${count} peças</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 20px 0 10px 0; color: #64748b; font-size: 12px;">
          <a href="https://mach3tracker.up.railway.app" class="btn">Acessar Painel em Tempo Real</a>
          <p style="margin-top: 20px; line-height: 1.6;">
            Este e-mail executivo foi gerado automaticamente pelo <strong>MACH3 Tracker</strong> para <strong>${recipient}</strong>.<br/>
            Para alterar configurações de notificação, acesse o menu de Configurações no dashboard.
          </p>
        </div>

      </div>
    </body>
    </html>
    `;

    // Subject
    const subjectPrefix = isWeekly ? '📈 [SEMANAL]' : (idleMachines.length > 0 ? `🚨 [ALERTA ${idleMachines.length} PARADA(S)]` : '📊');
    const subject = `${subjectPrefix} ${isWeekly ? 'Relatório Semanal Consolidado (7 Dias)' : 'Resumo Diário de Produção & Apontamentos'} - ${companyName}`;

    // If only requesting preview HTML, return immediately without dispatching
    if (options.previewOnly) {
        return {
            success: true,
            isWeekly,
            recipient,
            subject,
            totalJobs,
            totalMachineHours,
            totalExternalHours,
            totalOtherSectorHours,
            totalProductiveHours,
            totalCost: `R$ ${totalCost}`,
            operatorRank,
            externalServices,
            otherSectorServices,
            timelineItems,
            idleMachines,
            activeMachines,
            html: emailHtml
        };
    }

    let emailSent = false;
    let sendError = null;

    try {
        if (transporter && process.env.EMAIL_PASS) {
            await transporter.sendMail({
                from: `"${companyName} - MACH3 Tracker" <${process.env.EMAIL_USER || 'contato@mach3tracker.com'}>`,
                to: recipient,
                subject,
                html: emailHtml,
                attachments: mailAttachments
            });
            emailSent = true;
            console.log(`[AUTOMATION] Successfully sent ${reportType} to ${recipient}`);
        } else {
            console.log(`[AUTOMATION] Mock email dispatch (${reportType}) to ${recipient} (EMAIL_PASS not configured)`);
            emailSent = true;
        }
    } catch (err) {
        console.error('[AUTOMATION EMAIL ERROR]', err);
        sendError = err.message;
    }

    // Record into report_history
    const summary = `${isWeekly ? 'Relatório Semanal' : 'Ciclo Diário'}: ${totalJobs} cortes (${totalMachineHours}h), ${totalExternalHours}h externos, ${totalOtherSectorHours}h outros setores. Destinatário: ${recipient}.`;
    await pool.query(
        'INSERT INTO report_history ("userId", report_type, recipient_email, status, subject, summary, details) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
            userId,
            reportType,
            recipient,
            emailSent ? 'sent' : 'failed',
            subject,
            summary,
            JSON.stringify({ 
                totalJobs, 
                totalMachineHours, 
                totalExternalHours, 
                totalOtherSectorHours, 
                totalProductiveHours, 
                totalCost, 
                operatorRank, 
                externalServicesCount: externalServices.length,
                otherSectorServicesCount: otherSectorServices.length,
                idleMachines, 
                activeMachines, 
                sendError 
            })
        ]
    );

    // Update user timestamp
    if (isWeekly) {
        // can track last weekly report
    } else {
        await pool.query('UPDATE users SET last_daily_report_at = NOW(), last_idle_alert_at = NOW() WHERE id = $1', [userId]);
    }

    return {
        success: true,
        isWeekly,
        recipient,
        subject,
        summary,
        totalJobs,
        totalMachineHours,
        totalExternalHours,
        totalOtherSectorHours,
        totalProductiveHours,
        totalCost: `R$ ${totalCost}`,
        operatorRank,
        externalServicesCount: externalServices.length,
        otherSectorServicesCount: otherSectorServices.length,
        timelineCount: timelineItems.length,
        idleMachines,
        activeMachines,
        emailSent,
        sendError
    };
}


module.exports = { executeReportCycle };
