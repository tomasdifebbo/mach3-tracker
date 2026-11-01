import React, { useState, useMemo } from 'react';
import {
  ClipboardList, Printer, Upload, FolderOpen, Sparkles, CheckSquare,
  Clock, Layers, Cpu, Wrench, RefreshCw, CheckCircle2, Play, Search
} from 'lucide-react';

// Simulador rápido de G-Code direto no navegador para extrair dimensões, metragem, F/S e tempo estimado
function parseGCodeContent(text, fileName = '', groupName = 'GERAL') {
  const lines = text.split(/\r?\n/);
  let curX = 0, curY = 0, curZ = 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  let hasCoords = false;
  let curFeed = 3000;
  const rapidFeed = 8000;
  let mode = 0; // 0 = G0, 1 = G1/G2/G3
  let totalTimeMin = 0;
  let cutDistMm = 0;
  const feedsSet = new Set();
  const spindlesSet = new Set();

  const numRe = /([XYZFS])([-+]?\d*\.?\d+)/gi;
  const gRe = /\bG0?([0123])\b/i;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw.startsWith('(') || raw.startsWith(';') || raw.startsWith('%')) continue;

    const gMatch = raw.match(gRe);
    if (gMatch) {
      mode = parseInt(gMatch[1], 10) === 0 ? 0 : 1;
    }

    let nx = curX, ny = curY, nz = curZ;
    let moved = false;
    numRe.lastIndex = 0;
    let m;
    while ((m = numRe.exec(raw)) !== null) {
      const axis = m[1].toUpperCase();
      const val = parseFloat(m[2]);
      if (isNaN(val)) continue;
      if (axis === 'X') { nx = val; moved = true; }
      else if (axis === 'Y') { ny = val; moved = true; }
      else if (axis === 'Z') { nz = val; moved = true; }
      else if (axis === 'F' && val > 0) { curFeed = val; feedsSet.add(Math.round(val)); }
      else if (axis === 'S' && val > 0) { spindlesSet.add(Math.round(val)); }
    }

    if (moved) {
      const dx = nx - curX;
      const dy = ny - curY;
      const dz = nz - curZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 0) {
        if (mode === 0) {
          totalTimeMin += dist / rapidFeed;
        } else {
          const effFeed = curFeed > 0 ? curFeed : 2500;
          // Fator de desaceleração real de rampa/curva Mach3 (~1.12x)
          totalTimeMin += (dist / effFeed) * 1.12;
          cutDistMm += dist;
          if (nx !== curX || ny !== curY) {
            hasCoords = true;
            if (nx < minX) minX = nx;
            if (nx > maxX) maxX = nx;
            if (ny < minY) minY = ny;
            if (ny > maxY) maxY = ny;
          }
          if (nz < minZ) minZ = nz;
          if (nz > maxZ) maxZ = nz;
        }
      }
      curX = nx; curY = ny; curZ = nz;
    }
  }

  const widthMm = hasCoords ? Math.round(maxX - minX) : 0;
  const heightMm = hasCoords ? Math.round(maxY - minY) : 0;
  const depthMm = minZ !== Infinity && maxZ !== -Infinity ? Math.round(Math.abs(maxZ - minZ)) : 0;
  const cutMeters = Math.round(cutDistMm / 1000);

  return {
    fileName,
    groupName,
    widthMm,
    heightMm,
    depthMm,
    cutMeters,
    estimatedMinutes: Math.max(0.5, parseFloat(totalTimeMin.toFixed(1))),
    feeds: Array.from(feedsSet).sort((a, b) => b - a).slice(0, 2),
    spindles: Array.from(spindlesSet).sort((a, b) => b - a).slice(0, 1)
  };
}

function formatHm(mins) {
  const m = Math.round(Number(mins) || 0);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${String(rem).padStart(2, '0')}min` : `${h}h 00min`;
}

function formatBrtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
  } catch {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }
}

function formatBrtTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  } catch {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function GeradorFichaTecnica({ jobs = [], routers = [] }) {
  // 'lote' = Lote Seriado (Chapa 01 até N, ex: Parede Tijolo 50 chapas)
  // 'arquivos' = Checklist por Arquivos G-Code (ex: Setor Isopor Arco A / Arco B)
  const [mode, setMode] = useState('lote');

  // Projetos detectados automaticamente do Histórico
  const projectOptions = useMemo(() => {
    const map = new Map();
    for (const j of jobs) {
      const folder = (j.folder || '').trim();
      if (!folder || folder.toLowerCase() === 'desconhecido') continue;
      if (!map.has(folder)) {
        map.set(folder, { folder, count: 0, lastStart: j.start_time, sampleFile: j.file_name || '' });
      }
      map.get(folder).count += 1;
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.lastStart) - new Date(a.lastStart));
  }, [jobs]);

  // Estados de filtro e configuração
  const [selectedFolder, setSelectedFolder] = useState('');
  const [keywordFilter, setKeywordFilter] = useState('tijolo');
  const [targetSheets, setTargetSheets] = useState(50);
  const [minValidMinutes, setMinValidMinutes] = useState(24);
  const [numRoutersProj, setNumRoutersProj] = useState(2);
  const [setupMinutes, setSetupMinutes] = useState(7);
  const [shiftStartTime, setShiftStartTime] = useState('18:00');
  const [dateFromFilter, setDateFromFilter] = useState('2026-10-29');

  // Cabeçalho Técnico Editável
  const [docTitle, setDocTitle] = useState('2640A - EXPRESSO HOGWARTS · PAREDE TIJOLO (MDF 9MM)');
  const [docSubtitle, setDocSubtitle] = useState('Projeto: 2640a PAREDE TIJOLO · Controle Sequencial de Chapas');
  const [toolSpec, setToolSpec] = useState('Fresa Topo Ø6mm (e6mm) · Passe Z 3mm');
  const [cncParams, setCncParams] = useState('MDF 9mm (2731×1843mm) · F3200 · S15000');
  const [sheetDimLabel, setSheetDimLabel] = useState('2731×1843mm · MDF 9mm');
  const [footerNotes, setFooterNotes] = useState('');

  // Arquivos G-Code carregados manualmente no Modo B
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [parsingFiles, setParsingFiles] = useState(false);

  // Marcações manuais extras (caso o encarregado queira dar baixa manual na tela antes de imprimir)
  const [manualChecks, setManualChecks] = useState({});

  // Ao selecionar um projeto existente do dropdown, preenche sugestão inteligente
  const handleSelectProject = (folderVal) => {
    setSelectedFolder(folderVal);
    if (!folderVal) return;
    setKeywordFilter('');
    setDateFromFilter('');
    setDocTitle(folderVal.toUpperCase());
    setDocSubtitle(`Pasta / Projeto: ${folderVal}`);

    const projJobs = jobs.filter(j => (j.folder || '').trim() === folderVal);
    const sample = projJobs[0];
    if (sample && sample.file_name) {
      const fn = sample.file_name.toLowerCase();
      if (fn.includes('b12mm')) setToolSpec('Ball Nose Ø12mm (b12mm)');
      else if (fn.includes('e6mm')) setToolSpec('Fresa Topo Ø6mm (e6mm)');
      else if (fn.includes('e4mm')) setToolSpec('Fresa Topo Ø4mm (e4mm)');

      if (fn.includes('mdf9mm') || fn.includes('mdf 9mm')) {
        setSheetDimLabel('2750×1850mm · MDF 9mm');
        setCncParams('MDF 9mm · F3200 · S15000');
      } else if (fn.includes('pvc100mm') || fn.includes('isopor')) {
        setSheetDimLabel('Bloco Isopor Esp. 100mm');
        setCncParams('Esp. 100mm · F6000 · S12000');
      } else if (fn.includes('compensado 10mm')) {
        setSheetDimLabel('2750×1850mm · Comp. 10mm');
        setCncParams('Compensado 10mm · F3000 · S15000');
      }
    }
  };

  // Upload de arquivos G-Code (.txt / .nc / .tap / .gcode) para o Modo B
  const handleFileUpload = async (e) => {
    const fileList = Array.from(e.target.files || []).filter(f =>
      /\.(txt|nc|tap|gcode|cnc)$/i.test(f.name) && !f.name.toLowerCase().startsWith('checklist')
    );
    if (fileList.length === 0) return;
    setParsingFiles(true);
    try {
      const parsed = [];
      for (const file of fileList) {
        const text = await file.text();
        // Extrai grupo da subpasta (webkitRelativePath) se disponível
        let group = 'ARQUIVOS SELECIONADOS';
        if (file.webkitRelativePath) {
          const parts = file.webkitRelativePath.split('/').filter(Boolean);
          if (parts.length >= 2) {
            group = parts.slice(0, -1).join(' \\ ').toUpperCase();
          }
        }
        parsed.push(parseGCodeContent(text, file.name, group));
      }
      parsed.sort((a, b) => a.groupName.localeCompare(b.groupName) || a.fileName.localeCompare(b.fileName, undefined, { numeric: true }));
      setUploadedFiles(parsed);
      setMode('arquivos');

      // Auto-preenche parâmetros de F e S se detectados no G-Code
      const allFeeds = parsed.flatMap(p => p.feeds);
      const allSpindles = parsed.flatMap(p => p.spindles);
      if (allFeeds.length > 0 || allSpindles.length > 0) {
        const maxF = allFeeds.length > 0 ? `F${Math.max(...allFeeds)}` : '';
        const maxS = allSpindles.length > 0 ? `S${Math.max(...allSpindles)}` : '';
        setCncParams([maxF, maxS].filter(Boolean).join(' · '));
      }
    } finally {
      setParsingFiles(false);
    }
  };

  // Jobs filtrados e ordenados cronologicamente para o lote/projeto
  const matchingJobs = useMemo(() => {
    return jobs
      .filter(j => {
        if (selectedFolder && (j.folder || '').trim() !== selectedFolder) return false;
        if (keywordFilter.trim()) {
          const kw = keywordFilter.trim().toLowerCase();
          const inFile = (j.file_name || '').toLowerCase().includes(kw);
          const inFolder = (j.folder || '').toLowerCase().includes(kw);
          if (!inFile && !inFolder) return false;
        }
        if (dateFromFilter) {
          const dStr = new Date(j.start_time).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
          if (dStr < dateFromFilter) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }, [jobs, selectedFolder, keywordFilter, dateFromFilter]);

  // Dados calculados para MODO A: Lote Seriado (Chapa 01 até Meta)
  const batchData = useMemo(() => {
    const minDur = Number(minValidMinutes) || 0;
    const validJobs = [];
    const partialJobs = [];

    for (const j of matchingJobs) {
      const isRunning = !j.end_time;
      const dur = Number(j.duration_minutes) || 0;
      if (isRunning || dur >= minDur) {
        const qty = Math.max(1, parseInt(j.quantity, 10) || 1);
        for (let q = 0; q < qty; q++) {
          validJobs.push({ ...j, unitDuration: qty > 1 ? dur / qty : dur });
        }
      } else if (dur >= 1) {
        partialJobs.push(j);
      }
    }

    const totalGoal = Math.max(1, parseInt(targetSheets, 10) || 50);
    const completedCount = validJobs.filter(j => !!j.end_time).length;
    const runningCount = validJobs.filter(j => !j.end_time).length;

    // Média real de corte por máquina (ou geral)
    const finishedDurs = validJobs.filter(j => j.end_time && j.unitDuration > 0).map(j => j.unitDuration);
    const avgCutMin = finishedDurs.length > 0
      ? finishedDurs.reduce((s, d) => s + d, 0) / finishedDurs.length
      : 35;

    // Média por Router específica se houver histórico
    const byRouter = {};
    validJobs.filter(j => j.end_time && j.router_name).forEach(j => {
      if (!byRouter[j.router_name]) byRouter[j.router_name] = [];
      byRouter[j.router_name].push(j.unitDuration);
    });
    const routerStats = Object.entries(byRouter).map(([rName, durs]) => ({
      name: rName,
      avgCut: durs.reduce((s, v) => s + v, 0) / durs.length,
      count: durs.length
    }));

    const setupMin = Math.max(0, Number(setupMinutes) || 0);
    const cycleMinSingle = avgCutMin + setupMin;
    const nMachines = Math.max(1, parseInt(numRoutersProj, 10) || 2);

    // Conta também marcações manuais na tela
    let manualExtraDone = 0;
    for (let idx = validJobs.length + 1; idx <= totalGoal; idx++) {
      if (manualChecks[`lote-${idx}`]) manualExtraDone++;
    }

    const effectiveDone = Math.min(totalGoal, completedCount + manualExtraDone);
    const pendingSheets = Math.max(0, totalGoal - effectiveDone - runningCount);

    // Ritmo combinado (chapas/hora)
    let sheetsPerHour = (60 / cycleMinSingle) * nMachines;
    if (nMachines === 2 && routerStats.length >= 2) {
      sheetsPerHour = (60 / (routerStats[0].avgCut + setupMin)) + (60 / (routerStats[1].avgCut + setupMin));
    }
    const estRemainingHoursMulti = pendingSheets > 0 ? pendingSheets / sheetsPerHour : 0;
    const estRemainingMinMulti = Math.round(estRemainingHoursMulti * 60);
    const estRemainingMinSingle = Math.round(pendingSheets * cycleMinSingle);

    // Horário previsto de término a partir de shiftStartTime
    let projectedEndTimeStr = 'Concluído';
    if (pendingSheets > 0 && shiftStartTime) {
      const [hh, mm] = shiftStartTime.split(':').map(Number);
      if (!isNaN(hh) && !isNaN(mm)) {
        const base = new Date();
        base.setHours(hh, mm, 0, 0);
        const endDt = new Date(base.getTime() + estRemainingMinMulti * 60000);
        const endTime = endDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const nextDay = endDt.getDate() !== base.getDate();
        projectedEndTimeStr = `${endTime}${nextDay ? ' (+1 dia)' : ''}`;
      }
    }

    const rows = [];
    const totalRows = Math.max(totalGoal, validJobs.length);
    for (let n = 1; n <= totalRows; n++) {
      const job = validJobs[n - 1];
      const key = `lote-${n}`;
      if (job) {
        const isRun = !job.end_time;
        rows.push({
          key,
          num: n,
          label: `CHAPA ${String(n).padStart(2, '0')} / ${String(totalGoal).padStart(2, '0')}`,
          fileName: job.file_name || ' corte.txt',
          dimText: sheetDimLabel,
          durText: isRun ? 'Em corte...' : `${job.unitDuration.toFixed(1).replace('.', ',')} min`,
          status: isRun ? 'running' : 'done',
          execText: isRun
            ? `${job.router_name || 'Router'} · Início ${formatBrtTime(job.start_time)} · Fim: ___:___`
            : `${job.router_name || 'Router'} · ${formatBrtDate(job.start_time)} · ${formatBrtTime(job.start_time)} às ${formatBrtTime(job.end_time)}`,
          routerName: job.router_name || 'Router',
          timeRange: isRun
            ? `Início ${formatBrtTime(job.start_time)} · Fim: ___:___`
            : `${formatBrtDate(job.start_time)} · ${formatBrtTime(job.start_time)} às ${formatBrtTime(job.end_time)}`,
          operator: job.operator_name || '—'
        });
      } else {
        const isCheckedManual = !!manualChecks[key];
        const sugRouter = routerStats.length >= 2
          ? routerStats[(n - validJobs.length - 1) % routerStats.length]
          : null;
        rows.push({
          key,
          num: n,
          label: `CHAPA ${String(n).padStart(2, '0')} / ${String(totalGoal).padStart(2, '0')}`,
          fileName: validJobs[validJobs.length - 1]?.file_name || 'chapa_producao.txt',
          dimText: sheetDimLabel,
          durText: sugRouter
            ? `${sugRouter.name.replace('Router ', 'R. ')} (~${Math.round(sugRouter.avgCut)}m)`
            : `~${Math.round(avgCutMin)} min`,
          status: isCheckedManual ? 'done' : 'pending',
          routerName: '',
          timeRange: '',
          operator: ''
        });
      }
    }

    return {
      totalGoal,
      completedCount: effectiveDone,
      runningCount,
      pendingSheets,
      avgCutMin,
      routerStats,
      sheetsPerHour,
      estRemainingMinMulti,
      estRemainingMinSingle,
      projectedEndTimeStr,
      partialJobs,
      rows
    };
  }, [matchingJobs, minValidMinutes, targetSheets, setupMinutes, numRoutersProj, shiftStartTime, sheetDimLabel, manualChecks]);

  // Dados calculados para MODO B: Checklist por Arquivos G-Code (upload ou arquivos únicos do projeto)
  const filesChecklistData = useMemo(() => {
    let sourceFiles = uploadedFiles;
    if (sourceFiles.length === 0) {
      // Monta lista de arquivos únicos a partir do histórico filtrado
      const map = new Map();
      for (const j of matchingJobs) {
        if (!j.file_name) continue;
        const k = j.file_name.toLowerCase();
        if (!map.has(k)) {
          map.set(k, {
            fileName: j.file_name,
            groupName: (j.folder || 'ARQUIVOS DO PROJETO').toUpperCase(),
            widthMm: j.max_x ? Math.round(j.max_x) : 0,
            heightMm: j.max_y ? Math.round(j.max_y) : 0,
            cutMeters: 0,
            estimatedMinutes: Number(j.estimated_minutes) || Number(j.duration_minutes) || 30
          });
        }
      }
      sourceFiles = Array.from(map.values());
    }

    const enriched = sourceFiles.map((f, idx) => {
      const key = `file-${idx}-${f.fileName}`;
      // Busca no histórico se este arquivo já foi rodado
      const runs = matchingJobs.filter(j => (j.file_name || '').toLowerCase() === f.fileName.toLowerCase());
      const activeRun = runs.find(r => !r.end_time);
      const finishedRuns = runs.filter(r => !!r.end_time);
      const latestDone = finishedRuns[finishedRuns.length - 1];
      const manualDone = !!manualChecks[key];

      let status = 'pending';
      if (activeRun) status = 'running';
      else if (latestDone || manualDone) status = 'done';

      const dimParts = [];
      if (f.widthMm > 0 && f.heightMm > 0) dimParts.push(`${f.widthMm}×${f.heightMm}mm`);
      if (f.cutMeters > 0) dimParts.push(`${f.cutMeters}m`);
      const dimText = dimParts.length > 0 ? dimParts.join(' · ') : sheetDimLabel;

      const refJob = activeRun || latestDone;
      return {
        ...f,
        key,
        status,
        dimText,
        estText: formatHm(f.estimatedMinutes),
        routerName: refJob?.router_name || '',
        timeRange: activeRun
          ? `Início ${formatBrtTime(activeRun.start_time)} · Fim: ___:___`
          : latestDone
            ? `${formatBrtDate(latestDone.start_time)} · ${formatBrtTime(latestDone.start_time)} às ${formatBrtTime(latestDone.end_time)} (${Math.round(latestDone.duration_minutes || 0)}m)`
            : '',
        operator: refJob?.operator_name || ''
      };
    });

    const totalEstMin = enriched.reduce((s, f) => s + (f.estimatedMinutes || 0), 0);
    const doneItems = enriched.filter(f => f.status === 'done');
    const runItems = enriched.filter(f => f.status === 'running');
    const pendItems = enriched.filter(f => f.status === 'pending');
    const pendMinSingle = pendItems.reduce((s, f) => s + (f.estimatedMinutes || 0) + (Number(setupMinutes) || 0), 0);
    const nMachines = Math.max(1, parseInt(numRoutersProj, 10) || 2);
    const pendMinMulti = Math.round(pendMinSingle / nMachines);

    let projectedEndTimeStr = 'Concluído';
    if (pendItems.length > 0 && shiftStartTime) {
      const [hh, mm] = shiftStartTime.split(':').map(Number);
      if (!isNaN(hh) && !isNaN(mm)) {
        const base = new Date();
        base.setHours(hh, mm, 0, 0);
        const endDt = new Date(base.getTime() + pendMinMulti * 60000);
        const endTime = endDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const nextDay = endDt.getDate() !== base.getDate();
        projectedEndTimeStr = `${endTime}${nextDay ? ' (+1 dia)' : ''}`;
      }
    }

    const groups = {};
    enriched.forEach(item => {
      if (!groups[item.groupName]) groups[item.groupName] = [];
      groups[item.groupName].push(item);
    });

    return {
      items: enriched,
      groups,
      totalEstMin,
      doneCount: doneItems.length,
      runCount: runItems.length,
      pendCount: pendItems.length,
      pendMinSingle,
      pendMinMulti,
      projectedEndTimeStr
    };
  }, [uploadedFiles, matchingJobs, sheetDimLabel, manualChecks, setupMinutes, numRoutersProj, shiftStartTime]);

  const toggleManualCheck = (key) => {
    setManualChecks(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Gera e imprime / salva em PDF A4 vetorial idêntico ao padrão industrial da fábrica
  const handlePrintPdf = () => {
    const nowStr = new Date().toLocaleDateString('pt-BR') + ' · ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const nMachines = Math.max(1, parseInt(numRoutersProj, 10) || 2);

    let pagesHtml = '';

    if (mode === 'lote') {
      const rowsPerPage = 25;
      const totalPages = Math.max(1, Math.ceil(batchData.rows.length / rowsPerPage));
      const pctDone = Math.min(100, Math.round((batchData.completedCount / batchData.totalGoal) * 100));

      for (let p = 0; p < totalPages; p++) {
        const slice = batchData.rows.slice(p * rowsPerPage, (p + 1) * rowsPerPage);
        const startNum = slice[0]?.num || 1;
        const endNum = slice[slice.length - 1]?.num || 1;
        const isFirst = p === 0;
        const isLast = p === totalPages - 1;

        const rowsHtml = slice.map(r => {
          const checkHtml = r.status === 'done'
            ? '<span class="checkbox checked">✓</span>'
            : r.status === 'running'
              ? '<span class="checkbox in-prog">▶</span>'
              : '<span class="checkbox"></span>';
          const badgeHtml = r.status === 'done'
            ? '<span class="badge badge-done">Concluída</span>'
            : r.status === 'running'
              ? '<span class="badge badge-run">Rodando</span>'
              : '<span class="badge badge-pend">Pendente</span>';
          const execHtml = r.routerName
            ? `<td class="log-detail"><strong>${escapeHtml(r.routerName)}</strong> · ${escapeHtml(r.timeRange)}</td>`
            : `<td class="write-line">Máq: ________ · ___:___ às ___:___</td>`;
          const opHtml = r.operator
            ? `<td class="log-detail"><strong>${escapeHtml(r.operator)}</strong></td>`
            : `<td class="write-line">_________</td>`;

          return `
            <tr class="${r.status === 'done' ? 'row-done' : r.status === 'running' ? 'row-running' : ''}">
              <td class="col-check">${checkHtml}</td>
              <td class="chapa-num">${escapeHtml(r.label)}</td>
              <td class="file-name">${escapeHtml(r.fileName)}</td>
              <td class="dim-text">${escapeHtml(r.dimText)}</td>
              <td class="time-est">${escapeHtml(r.durText)}</td>
              <td>${badgeHtml}</td>
              ${execHtml}
              ${opHtml}
            </tr>`;
        }).join('');

        const routerBreakdownText = batchData.routerStats.length > 0
          ? batchData.routerStats.map(rs => `<strong>${escapeHtml(rs.name)}</strong>: ~${Math.round(rs.avgCut)}m corte (+${setupMinutes}m troca)`).join(' · ')
          : `Corte médio: ~${Math.round(batchData.avgCutMin)}m (+${setupMinutes}m troca)`;

        pagesHtml += `
          <div class="page">
            <div class="header">
              <div>
                <div class="brand-tag">${isFirst ? 'Ficha Técnica de Produção CNC · Checklist de Lote Seriado' : `Continuação · Ficha Técnica & Checklist (Chapas ${startNum} a ${endNum})`}</div>
                <div class="title">${escapeHtml(docTitle)}</div>
                ${isFirst ? `<div class="subtitle">${escapeHtml(docSubtitle)}</div>` : ''}
              </div>
              <div class="meta-box">
                <div><strong>Emissão:</strong> ${nowStr} · <strong>Pág.:</strong> ${p + 1}/${totalPages}</div>
                <div><strong>Ferramenta:</strong> ${escapeHtml(toolSpec)}</div>
                <div><strong>Parâmetros:</strong> ${escapeHtml(cncParams)}</div>
              </div>
            </div>

            ${isFirst ? `
              <div class="kpi-grid">
                <div class="kpi-card">
                  <div class="kpi-label">Meta Total do Lote</div>
                  <div class="kpi-val">${batchData.totalGoal} Chapas</div>
                  <div class="kpi-sub">${escapeHtml(sheetDimLabel)}</div>
                </div>
                <div class="kpi-card done">
                  <div class="kpi-label">Concluídas</div>
                  <div class="kpi-val">${batchData.completedCount} / ${batchData.totalGoal} (${pctDone}%)</div>
                  <div class="kpi-sub">${batchData.runningCount > 0 ? `${batchData.runningCount} rodando agora` : 'Sincronizado c/ Histórico'}</div>
                </div>
                <div class="kpi-card pending">
                  <div class="kpi-label">Saldo Restante</div>
                  <div class="kpi-val">${batchData.pendingSheets} Chapas</div>
                  <div class="kpi-sub">1 Máq: ~${formatHm(batchData.estRemainingMinSingle)}</div>
                </div>
                <div class="kpi-card proj">
                  <div class="kpi-label">Projeção (${nMachines} Routers)</div>
                  <div class="kpi-val">~${formatHm(batchData.estRemainingMinMulti)}</div>
                  <div class="kpi-sub">Término est.: ${escapeHtml(batchData.projectedEndTimeStr)}</div>
                </div>
              </div>

              <div class="progress-wrap">
                <div class="progress-fill" style="width: ${pctDone}%;"></div>
              </div>

              <div class="proj-banner">
                <div>
                  <div class="proj-title">▶ Projeção Técnica de Conclusão (Meta ${batchData.totalGoal} Chapas)</div>
                  <div class="proj-text">${routerBreakdownText} · Ritmo conjunto: <strong>${batchData.sheetsPerHour.toFixed(2).replace('.', ',')} chapas/hora</strong>.</div>
                </div>
                <div class="proj-pill">
                  <div class="proj-pill-lbl">Em ${nMachines} Routers Simultâneas</div>
                  <div class="proj-pill-val">~${formatHm(batchData.estRemainingMinMulti)} (${batchData.pendingSheets} ch.)</div>
                  <div style="font-size:7.8px;color:#475569;">Início ${escapeHtml(shiftStartTime)} ➔ <strong>Fim ~${escapeHtml(batchData.projectedEndTimeStr)}</strong></div>
                </div>
                <div class="proj-pill">
                  <div class="proj-pill-lbl">Em 1 Máquina Individual</div>
                  <div class="proj-pill-val">~${formatHm(batchData.estRemainingMinSingle)} corridas</div>
                  <div style="font-size:7.8px;color:#475569;">Ciclo médio ~${Math.round(batchData.avgCutMin + Number(setupMinutes || 0))} min/chapa</div>
                </div>
              </div>
            ` : ''}

            <div class="group-header">
              <span>CONTROLE SEQUENCIAL DE USINAGEM — CHAPAS ${String(startNum).padStart(2, '0')} A ${String(endNum).padStart(2, '0')}</span>
              <span class="sub">Marque com ✓ cada chapa inspecionada e liberada na máquina</span>
            </div>
            <table>
              <thead>
                <tr>
                  <th class="col-check">OK</th>
                  <th style="width:14%;">Nº Chapa</th>
                  <th style="width:22%;">Arquivo G-Code</th>
                  <th style="width:15%;">Formato / Material</th>
                  <th style="width:10%;">Duração / Est.</th>
                  <th style="width:8%;">Status</th>
                  <th style="width:19%;">Máquina / Data / Horário</th>
                  <th style="width:8%;">Operador</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>

            ${isLast ? `
              ${(footerNotes.trim() || batchData.partialJobs.length > 0) ? `
                <div class="extra-box">
                  <div>
                    <div class="extra-title">Observações Técnicas / Registros Complementares:</div>
                    <div class="extra-items">
                      ${footerNotes.trim() ? `<div>${escapeHtml(footerNotes)}</div>` : ''}
                      ${batchData.partialJobs.length > 0 ? `<div style="color:#64748b;">Cortes parciais/testes curtos (< ${minValidMinutes}m) não somados como chapa completa: ${batchData.partialJobs.length} registro(s).</div>` : ''}
                    </div>
                  </div>
                  <div style="text-align:right;font-size:8px;color:#475569;white-space:nowrap;">
                    <strong>Legenda:</strong> ☑ Concluída · ▶ Em Máquina · ☐ A Usinar
                  </div>
                </div>
              ` : ''}
              <div class="footer-sigs">
                <div class="sig-block">Assinatura Operador (Turno Dia)</div>
                <div class="sig-block">Assinatura Operador (Turno Noite)</div>
                <div class="sig-block">Conferência Final / Encarregado</div>
              </div>
            ` : ''}
          </div>`;
      }
    } else {
      // Modo B: Checklist por Arquivos G-Code agrupados
      const groupsEntries = Object.entries(filesChecklistData.groups);
      const groupsHtml = groupsEntries.map(([gName, items], gIdx) => {
        const subMin = items.reduce((s, it) => s + (it.estimatedMinutes || 0), 0);
        const rowsHtml = items.map(r => {
          const checkHtml = r.status === 'done'
            ? '<span class="checkbox checked">✓</span>'
            : r.status === 'running'
              ? '<span class="checkbox in-prog">▶</span>'
              : '<span class="checkbox"></span>';
          const badgeHtml = r.status === 'done'
            ? '<span class="badge badge-done">Concluído</span>'
            : r.status === 'running'
              ? '<span class="badge badge-run">Rodando</span>'
              : '<span class="badge badge-pend">Pendente</span>';
          const execHtml = r.routerName
            ? `<td class="log-detail"><strong>${escapeHtml(r.routerName)}</strong> · ${escapeHtml(r.timeRange)}</td>`
            : `<td class="write-line">Máq: ________ · ___:___ às ___:___</td>`;
          const opHtml = r.operator
            ? `<td class="log-detail"><strong>${escapeHtml(r.operator)}</strong></td>`
            : `<td class="write-line">_________</td>`;

          return `
            <tr class="${r.status === 'done' ? 'row-done' : r.status === 'running' ? 'row-running' : ''}">
              <td class="col-check">${checkHtml}</td>
              <td class="file-name">${escapeHtml(r.fileName)}</td>
              <td class="dim-text">${escapeHtml(r.dimText)}</td>
              <td class="time-est">${escapeHtml(r.estText)}</td>
              <td>${badgeHtml}</td>
              ${execHtml}
              ${opHtml}
            </tr>`;
        }).join('');

        return `
          <div class="group-header" style="margin-top:8px;">
            <span>${gIdx + 1}. CONJUNTO ${escapeHtml(gName)}</span>
            <span class="sub">${items.length} arquivo(s) · Subtotal Estimado: ${formatHm(subMin)}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th class="col-check">OK</th>
                <th style="width:26%;">Arquivo G-Code</th>
                <th style="width:17%;">Dimensões / Corte</th>
                <th style="width:11%;">Tempo Est.</th>
                <th style="width:11%;">Status</th>
                <th style="width:22%;">Execução / Máquina / Horário</th>
                <th style="width:9%;">Operador</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>`;
      }).join('');

      pagesHtml = `
        <div class="page">
          <div class="header">
            <div>
              <div class="brand-tag">Controle de Produção CNC · Ficha Técnica & Checklist de Usinagem</div>
              <div class="title">${escapeHtml(docTitle)}</div>
              <div class="subtitle">${escapeHtml(docSubtitle)}</div>
            </div>
            <div class="meta-box">
              <div><strong>Emissão:</strong> ${nowStr}</div>
              <div><strong>Ferramenta:</strong> ${escapeHtml(toolSpec)}</div>
              <div><strong>Parâmetros:</strong> ${escapeHtml(cncParams)}</div>
            </div>
          </div>

          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">Tempo Total (${filesChecklistData.items.length} Arq.)</div>
              <div class="kpi-val">${formatHm(filesChecklistData.totalEstMin)}</div>
              <div class="kpi-sub">~${formatHm(filesChecklistData.totalEstMin / nMachines)} em ${nMachines} Routers</div>
            </div>
            <div class="kpi-card done">
              <div class="kpi-label">Concluídos</div>
              <div class="kpi-val">${filesChecklistData.doneCount} / ${filesChecklistData.items.length}</div>
              <div class="kpi-sub">${filesChecklistData.runCount > 0 ? `${filesChecklistData.runCount} em máquina agora` : 'Verificado no Histórico'}</div>
            </div>
            <div class="kpi-card pending">
              <div class="kpi-label">Fila Pendente</div>
              <div class="kpi-val">${filesChecklistData.pendCount} arquivos</div>
              <div class="kpi-sub">1 Máq: ~${formatHm(filesChecklistData.pendMinSingle)}</div>
            </div>
            <div class="kpi-card proj">
              <div class="kpi-label">Projeção (${nMachines} Routers)</div>
              <div class="kpi-val">~${formatHm(filesChecklistData.pendMinMulti)}</div>
              <div class="kpi-sub">Início ${escapeHtml(shiftStartTime)} ➔ Fim ~${escapeHtml(filesChecklistData.projectedEndTimeStr)}</div>
            </div>
          </div>

          ${groupsHtml}

          ${footerNotes.trim() ? `
            <div class="extra-box">
              <div>
                <div class="extra-title">Observações do Encarregado:</div>
                <div class="extra-items">${escapeHtml(footerNotes)}</div>
              </div>
              <div style="text-align:right;font-size:8px;color:#475569;white-space:nowrap;">
                <strong>Legenda:</strong> ☑ Concluído · ▶ Em Máquina · ☐ A Usinar
              </div>
            </div>
          ` : ''}

          <div class="footer-sigs">
            <div class="sig-block">Assinatura Operador (Turno Dia)</div>
            <div class="sig-block">Assinatura Operador (Turno Noite)</div>
            <div class="sig-block">Conferência / Encarregado</div>
          </div>
        </div>`;
    }

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Ficha Técnica - ${escapeHtml(docTitle)}</title>
<style>
  @page { size: A4 portrait; margin: 8.5mm 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #0f172a; background: #fff; font-size: 9.6px; line-height: 1.28; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px; }
  .brand-tag { display: inline-block; background: #ea580c; color: #fff; font-weight: 800; font-size: 8px; letter-spacing: 1.1px; text-transform: uppercase; padding: 2px 7px; border-radius: 4px; margin-bottom: 3px; }
  .title { font-size: 15.5px; font-weight: 900; color: #0f172a; }
  .subtitle { font-size: 9px; color: #475569; margin-top: 2px; font-weight: 600; }
  .meta-box { text-align: right; font-size: 8.6px; color: #334155; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 9px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-bottom: 7px; }
  .kpi-card { border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 8px; background: #f8fafc; }
  .kpi-card.done { background: #ecfdf5; border-color: #6ee7b7; }
  .kpi-card.pending { background: #fff7ed; border-color: #fdba74; }
  .kpi-card.proj { background: #eff6ff; border-color: #93c5fd; }
  .kpi-label { font-size: 7.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; }
  .kpi-card.done .kpi-label { color: #047857; }
  .kpi-card.pending .kpi-label { color: #c2410c; }
  .kpi-card.proj .kpi-label { color: #1d4ed8; }
  .kpi-val { font-size: 13.5px; font-weight: 900; color: #0f172a; margin-top: 1px; }
  .kpi-sub { font-size: 8px; color: #475569; margin-top: 1px; }
  .progress-wrap { margin: 4px 0 7px 0; background: #e2e8f0; height: 7px; border-radius: 99px; overflow: hidden; }
  .progress-fill { background: linear-gradient(90deg, #16a34a, #22c55e); height: 100%; }
  .proj-banner { background: #f0f9ff; border: 1.5px solid #7dd3fc; border-left: 5px solid #0284c7; border-radius: 6px; padding: 6px 10px; margin-bottom: 8px; display: grid; grid-template-columns: 1.25fr 1fr 1fr; gap: 10px; align-items: center; }
  .proj-title { font-size: 8.3px; font-weight: 900; text-transform: uppercase; color: #0369a1; margin-bottom: 2px; }
  .proj-text { font-size: 8.5px; color: #0f172a; line-height: 1.32; }
  .proj-pill { background: #fff; border: 1px solid #bae6fd; border-radius: 5px; padding: 4px 7px; }
  .proj-pill-lbl { font-size: 7.4px; font-weight: 800; text-transform: uppercase; color: #0284c7; }
  .proj-pill-val { font-size: 10.2px; font-weight: 900; color: #0f172a; }
  .group-header { display: flex; justify-content: space-between; align-items: center; background: #1e293b; color: #fff; padding: 4.5px 9px; border-radius: 5px 5px 0 0; font-weight: 800; font-size: 9px; }
  .group-header span.sub { font-weight: 600; font-size: 8px; color: #cbd5e1; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; color: #334155; font-size: 7.7px; font-weight: 800; text-transform: uppercase; padding: 4px 5px; border: 1px solid #cbd5e1; text-align: left; }
  td { padding: 3.6px 5px; border: 1px solid #cbd5e1; vertical-align: middle; font-size: 8.7px; }
  tr.row-done { background: #f0fdf4; }
  tr.row-running { background: #fffbeb; }
  .col-check { width: 28px; text-align: center; }
  .checkbox { display: inline-flex; align-items: center; justify-content: center; width: 14px; height: 14px; border: 1.8px solid #334155; border-radius: 3px; background: #fff; font-size: 10px; font-weight: 900; line-height: 1; }
  .checkbox.checked { background: #16a34a; border-color: #15803d; color: #fff; }
  .checkbox.in-prog { background: #ffedd5; border-color: #ea580c; color: #ea580c; font-size: 8px; }
  .chapa-num { font-weight: 900; color: #0f172a; white-space: nowrap; }
  .file-name { font-weight: 700; color: #0f172a; white-space: nowrap; }
  .dim-text { font-size: 8.1px; color: #475569; white-space: nowrap; }
  .time-est { font-weight: 800; color: #0f172a; white-space: nowrap; }
  .badge { display: inline-block; padding: 1px 5px; border-radius: 99px; font-size: 7.4px; font-weight: 800; text-transform: uppercase; white-space: nowrap; }
  .badge-done { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .badge-run { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
  .badge-pend { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
  .log-detail { font-size: 8.2px; color: #1e293b; white-space: nowrap; }
  .write-line { color: #94a3b8; font-size: 8.2px; white-space: nowrap; }
  .extra-box { margin-top: 8px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 6px 10px; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
  .extra-title { font-size: 8px; font-weight: 800; text-transform: uppercase; color: #334155; margin-bottom: 2px; }
  .extra-items { font-size: 8.2px; color: #475569; }
  .footer-sigs { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; }
  .sig-block { text-align: center; padding-top: 16px; border-top: 1px solid #64748b; font-size: 8px; font-weight: 700; color: #475569; text-transform: uppercase; }
</style>
</head>
<body>${pagesHtml}</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=980,height=860');
    if (!printWin) {
      alert('Permita pop-ups no navegador para abrir a janela de impressão/PDF da Ficha Técnica.');
      return;
    }
    printWin.document.open();
    printWin.document.write(fullHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 350);
  };

  // Atalhos rápidos pré-configurados
  const applyPresetTijolo = () => {
    setMode('lote');
    setSelectedFolder('');
    setKeywordFilter('tijolo');
    setDateFromFilter('2026-10-29');
    setTargetSheets(50);
    setMinValidMinutes(24);
    setNumRoutersProj(2);
    setSetupMinutes(7);
    setShiftStartTime('18:00');
    setDocTitle('2640A - EXPRESSO HOGWARTS · PAREDE TIJOLO (MDF 9MM)');
    setDocSubtitle('Projeto: 2640a PAREDE TIJOLO · Controle Sequencial até Chapa 50');
    setToolSpec('Fresa Topo Ø6mm (e6mm) · Passe Z 3mm');
    setCncParams('MDF 9mm (2731×1843mm) · F3200 · S15000');
    setSheetDimLabel('2731×1843mm · MDF 9mm');
    setFooterNotes('Obs.: Em 29/10 manhã/tarde foram feitas +3 chapas de teste/regulagem (28,3m, 28,2m e 30,9m com Tomas), totalizando 40 chapas acumuladas caso aproveitadas na montagem.');
  };

  const applyPresetIsopor = () => {
    setMode('arquivos');
    setSelectedFolder('');
    setKeywordFilter('pvc100mm');
    setDateFromFilter('2026-10-31');
    setNumRoutersProj(2);
    setSetupMinutes(8);
    setShiftStartTime('15:30');
    setDocTitle('2667A - EXPO ENTRADA · SETOR ISOPOR');
    setDocSubtitle('Pasta: 2667A - EXPO ENTRADA \\ ENTRADA \\ ISOPOR (Arco A · Arco B · Colunas)');
    setToolSpec('Ball Nose Ø12mm (b12mm)');
    setCncParams('Esp. 100mm · F6000 · S12000');
    setSheetDimLabel('Isopor 100mm');
    setFooterNotes('');
  };

  const applyPresetPendencias = () => {
    setMode('lote');
    setSelectedFolder('');
    setKeywordFilter('tijolo');
    setDateFromFilter('2026-10-29');
    setTargetSheets(50);
    setMinValidMinutes(24);
    setNumRoutersProj(2);
    setSetupMinutes(7);
    setShiftStartTime('15:15');
    setDocTitle('ORDEM DE CORTE · PENDÊNCIAS E MDFS 9MM FALTANTES (OFICINA ACT)');
    setDocSubtitle('Lote MDF 9mm Tijolos (Chapas 38 a 50) + Molduras/Colunas 9mm + Compensado 6mm + Pinguins Isopor');
    setToolSpec('Fresa Ø6mm (e6mm) Passe Z 3mm + Ball Nose Ø10mm');
    setCncParams('MDF 9mm, MDF 6/15mm, Compensado 6mm, Isopor 100mm · S18000 / F3200');
    setSheetDimLabel('MDF 9mm (2731×1843) / Diversos');
    setFooterNotes('MDF 9mm Faltantes: 13 chapas lote Tijolos (38 a 50) + Moldura menor porta castelo + Colunas 9mm. Compensado 6mm Entrada: Chapas 6 a 9 de 9 pendentes (~19m). Isopor Pinguins: 2 blocos (~1h40m). Torres MDF 9mm: 100% Concluído (6x cada).');
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-400 mb-1">Engenharia & Chão de Fábrica</p>
          <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ClipboardList className="text-orange-400" size={28} />
            Gerador de Ficha Técnica & Checklist PDF
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Cruza automaticamente o Histórico CNC em tempo real, simula tempos G-Code e projeta o horário de conclusão do lote para prancheta A4.
          </p>
        </div>

        <button
          onClick={handlePrintPdf}
          className="px-5 py-3 bg-orange-500 hover:bg-orange-400 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-lg shadow-orange-500/25 flex items-center gap-2.5 cursor-pointer shrink-0 transition-all"
        >
          <Printer size={16} />
          Gerar PDF / Imprimir Ficha A4
        </button>
      </div>

      {/* Seletor de Modo + Presets Rápidos */}
      <div className="glass rounded-2xl p-4 border border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setMode('lote')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all ${
              mode === 'lote'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'bg-white/5 text-text-muted hover:text-white border border-white/10'
            }`}
          >
            <Layers size={14} />
            Modo Lote Seriado (Chapa 01 até N)
          </button>
          <button
            onClick={() => setMode('arquivos')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer transition-all ${
              mode === 'arquivos'
                ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                : 'bg-white/5 text-text-muted hover:text-white border border-white/10'
            }`}
          >
            <CheckSquare size={14} />
            Modo Lista de Arquivos G-Code (Pasta)
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Modelos Rápidos:</span>
          <button
            onClick={applyPresetTijolo}
            className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 cursor-pointer transition-all"
          >
            🧱 MDF 9mm Tijolos (50 Chapas)
          </button>
          <button
            onClick={applyPresetIsopor}
            className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/25 cursor-pointer transition-all"
          >
            🧊 Expo Entrada · Isopor
          </button>
          <button
            onClick={applyPresetPendencias}
            className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 cursor-pointer transition-all"
          >
            ⚠️ Arquivos com Pendência
          </button>
        </div>
      </div>

      {/* Painel de Configuração da Ficha Técnica */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Coluna 1: Fonte de Dados & Projeção */}
        <div className="glass rounded-2xl p-5 border border-white/10 space-y-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-orange-400 flex items-center gap-2">
            <Search size={14} /> 1. Fonte de Produção & Cálculo de Projeção
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                Selecionar Projeto do Histórico
              </label>
              <select
                value={selectedFolder}
                onChange={(e) => handleSelectProject(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500"
              >
                <option value="">-- Filtrar por Palavra-Chave --</option>
                {projectOptions.map(p => (
                  <option key={p.folder} value={p.folder}>
                    {p.folder} ({p.count} cortes)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                Palavra-Chave (Arquivo ou Pasta)
              </label>
              <input
                type="text"
                value={keywordFilter}
                onChange={e => setKeywordFilter(e.target.value)}
                placeholder="Ex: tijolo, pvc100mm, porta..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {mode === 'lote' && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                  Meta de Chapas
                </label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={targetSheets}
                  onChange={e => setTargetSheets(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-black text-accent-cyan outline-none focus:border-orange-500"
                />
              </div>
            )}

            {mode === 'lote' && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                  Corte Mín. (min)
                </label>
                <input
                  type="number"
                  min={0}
                  value={minValidMinutes}
                  onChange={e => setMinValidMinutes(e.target.value)}
                  title="Ignora testes curtos ou abortados abaixo desta duração"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                Nº Routers Simult.
              </label>
              <select
                value={numRoutersProj}
                onChange={e => setNumRoutersProj(Number(e.target.value))}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500"
              >
                <option value={1}>1 Router</option>
                <option value={2}>2 Routers</option>
                <option value={3}>3 Routers</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                Troca Chapa (min)
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={setupMinutes}
                onChange={e => setSetupMinutes(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                Considerar Cortes a partir de
              </label>
              <input
                type="date"
                value={dateFromFilter}
                onChange={e => setDateFromFilter(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                Horário Base p/ Projeção de Término
              </label>
              <input
                type="time"
                value={shiftStartTime}
                onChange={e => setShiftStartTime(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Upload de G-Code para simulação automática */}
          <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-text-muted">
              {uploadedFiles.length > 0 ? (
                <span className="text-emerald-400 font-bold">
                  ✓ {uploadedFiles.length} arquivo(s) G-Code simulado(s) da pasta!
                </span>
              ) : (
                <span>Opcional: carregue arquivos G-Code (`.txt`/`.nc`) para simular tempos e medidas exatas.</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/15 rounded-xl text-[11px] font-bold text-white flex items-center gap-1.5 cursor-pointer transition-all">
                <Upload size={13} className="text-orange-400" />
                {parsingFiles ? 'Simulando...' : 'Importar G-Codes'}
                <input
                  type="file"
                  multiple
                  accept=".txt,.nc,.tap,.gcode,.cnc"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {uploadedFiles.length > 0 && (
                <button
                  onClick={() => setUploadedFiles([])}
                  className="px-2.5 py-1.5 bg-red-500/15 text-red-300 rounded-xl text-[10px] font-bold cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Coluna 2: Dados Técnicos do Cabeçalho */}
        <div className="glass rounded-2xl p-5 border border-white/10 space-y-3">
          <h3 className="text-xs font-black uppercase tracking-widest text-orange-400 flex items-center gap-2">
            <Wrench size={14} /> 2. Especificações da Ficha Técnica (Cabeçalho do PDF)
          </h3>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
              Título Principal da O.S. / Projeto
            </label>
            <input
              type="text"
              value={docTitle}
              onChange={e => setDocTitle(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
              Subtítulo / Caminho de Rede na Fábrica
            </label>
            <input
              type="text"
              value={docSubtitle}
              onChange={e => setDocSubtitle(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-medium text-white outline-none focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                Ferramenta / Fresa
              </label>
              <input
                type="text"
                value={toolSpec}
                onChange={e => setToolSpec(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                Parâmetros (F / S)
              </label>
              <input
                type="text"
                value={cncParams}
                onChange={e => setCncParams(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                Formato / Material
              </label>
              <input
                type="text"
                value={sheetDimLabel}
                onChange={e => setSheetDimLabel(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
              Notas de Rodapé / Aproveitamento de Testes (Opcional)
            </label>
            <input
              type="text"
              value={footerNotes}
              onChange={e => setFooterNotes(e.target.value)}
              placeholder="Ex: 3 chapas de teste do dia 29/10 disponíveis para montagem..."
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Pré-visualização Executiva de KPIs + Projeção + Tabela de Checklist */}
      {mode === 'lote' ? (
        <div className="glass rounded-3xl p-5 md:p-6 border border-white/10 space-y-5">
          {/* KPIs do Lote */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">Meta Total do Lote</p>
              <p className="text-2xl font-black text-white mt-1">{batchData.totalGoal} Chapas</p>
              <p className="text-[11px] text-text-muted mt-0.5">{sheetDimLabel}</p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Concluídas</p>
              <p className="text-2xl font-black text-emerald-300 mt-1">
                {batchData.completedCount} / {batchData.totalGoal} ({Math.min(100, Math.round((batchData.completedCount / batchData.totalGoal) * 100))}%)
              </p>
              <p className="text-[11px] text-emerald-200/70 mt-0.5">
                {batchData.runningCount > 0 ? `${batchData.runningCount} em máquina agora` : 'Sincronizado com Histórico'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30">
              <p className="text-[10px] font-black uppercase tracking-wider text-orange-400">Saldo Restante</p>
              <p className="text-2xl font-black text-orange-300 mt-1">{batchData.pendingSheets} Chapas</p>
              <p className="text-[11px] text-orange-200/70 mt-0.5">
                Em 1 Router: ~{formatHm(batchData.estRemainingMinSingle)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30">
              <p className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                Projeção ({numRoutersProj} {numRoutersProj > 1 ? 'Routers' : 'Router'})
              </p>
              <p className="text-2xl font-black text-sky-300 mt-1">~{formatHm(batchData.estRemainingMinMulti)}</p>
              <p className="text-[11px] text-sky-200/80 mt-0.5">
                Início {shiftStartTime} ➔ Fim <strong>~{batchData.projectedEndTimeStr}</strong>
              </p>
            </div>
          </div>

          {/* Barra de Progresso */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-emerald-400">
                Progresso do Lote: {batchData.completedCount} de {batchData.totalGoal} chapas prontas
              </span>
              <span className="text-sky-300">
                Ritmo medido: {batchData.sheetsPerHour.toFixed(2).replace('.', ',')} chapas/hora ({numRoutersProj} máq.)
              </span>
            </div>
            <div className="h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500"
                style={{ width: `${Math.min(100, Math.round((batchData.completedCount / batchData.totalGoal) * 100))}%` }}
              />
            </div>
          </div>

          {/* Tabela Sequencial Chapa 01 até Meta */}
          <div className="overflow-x-auto rounded-2xl border border-white/10 max-h-[540px] custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-900/95 sticky top-0 z-10 text-[10px] font-black uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="p-3 text-center w-12">OK</th>
                  <th className="p-3">Nº Chapa</th>
                  <th className="p-3">Arquivo G-Code</th>
                  <th className="p-3">Formato / Material</th>
                  <th className="p-3">Duração / Est.</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Máquina / Data / Horário</th>
                  <th className="p-3">Operador</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {batchData.rows.map(r => (
                  <tr
                    key={r.key}
                    className={
                      r.status === 'done'
                        ? 'bg-emerald-500/[0.06] hover:bg-emerald-500/[0.10]'
                        : r.status === 'running'
                          ? 'bg-orange-500/[0.08]'
                          : 'hover:bg-white/[0.02]'
                    }
                  >
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => !r.routerName && toggleManualCheck(r.key)}
                        title={r.routerName ? 'Concluída via log automático do Mach3' : 'Clique para marcar/desmarcar manualmente'}
                        className={`w-5 h-5 rounded flex items-center justify-center font-black text-xs mx-auto transition-all ${
                          r.status === 'done'
                            ? 'bg-emerald-500 text-white'
                            : r.status === 'running'
                              ? 'bg-orange-500/20 border border-orange-400 text-orange-300'
                              : 'border border-white/25 bg-black/40 hover:border-orange-400 cursor-pointer'
                        }`}
                      >
                        {r.status === 'done' ? '✓' : r.status === 'running' ? '▶' : ''}
                      </button>
                    </td>
                    <td className="p-2.5 font-black text-white whitespace-nowrap">{r.label}</td>
                    <td className="p-2.5 font-semibold text-slate-200 whitespace-nowrap">{r.fileName}</td>
                    <td className="p-2.5 text-text-muted whitespace-nowrap">{r.dimText}</td>
                    <td className="p-2.5 font-bold text-accent-cyan whitespace-nowrap">{r.durText}</td>
                    <td className="p-2.5 whitespace-nowrap">
                      {r.status === 'done' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Concluída
                        </span>
                      ) : r.status === 'running' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-500/20 text-orange-300 border border-orange-500/30 animate-pulse">
                          Rodando
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-white/5 text-text-muted border border-white/10">
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-slate-300 whitespace-nowrap">
                      {r.routerName ? (
                        <span><strong className="text-white">{r.routerName}</strong> · {r.timeRange}</span>
                      ) : (
                        <span className="text-text-muted/60 font-mono text-[11px]">Máq: _______ · __:__ às __:__</span>
                      )}
                    </td>
                    <td className="p-2.5 font-bold text-orange-300 whitespace-nowrap">
                      {r.operator || <span className="text-text-muted/50">_______</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Pré-visualização Modo B: Lista de Arquivos G-Code */
        <div className="glass rounded-3xl p-5 md:p-6 border border-white/10 space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Tempo Total ({filesChecklistData.items.length} Arq.)
              </p>
              <p className="text-2xl font-black text-white mt-1">{formatHm(filesChecklistData.totalEstMin)}</p>
              <p className="text-[11px] text-text-muted mt-0.5">
                ~{formatHm(filesChecklistData.totalEstMin / Math.max(1, numRoutersProj))} em {numRoutersProj} Routers
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Concluídos</p>
              <p className="text-2xl font-black text-emerald-300 mt-1">
                {filesChecklistData.doneCount} / {filesChecklistData.items.length}
              </p>
              <p className="text-[11px] text-emerald-200/70 mt-0.5">
                {filesChecklistData.runCount > 0 ? `${filesChecklistData.runCount} rodando agora` : 'Sincronizado com Histórico'}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30">
              <p className="text-[10px] font-black uppercase tracking-wider text-orange-400">Fila Pendente</p>
              <p className="text-2xl font-black text-orange-300 mt-1">{filesChecklistData.pendCount} arquivos</p>
              <p className="text-[11px] text-orange-200/70 mt-0.5">
                1 Máq: ~{formatHm(filesChecklistData.pendMinSingle)}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-sky-500/10 border border-sky-500/30">
              <p className="text-[10px] font-black uppercase tracking-wider text-sky-400">
                Projeção ({numRoutersProj} Routers)
              </p>
              <p className="text-2xl font-black text-sky-300 mt-1">~{formatHm(filesChecklistData.pendMinMulti)}</p>
              <p className="text-[11px] text-sky-200/80 mt-0.5">
                Início {shiftStartTime} ➔ Fim <strong>~{filesChecklistData.projectedEndTimeStr}</strong>
              </p>
            </div>
          </div>

          {Object.entries(filesChecklistData.groups).map(([gName, items], idx) => (
            <div key={gName} className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="bg-slate-800/90 px-4 py-2.5 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  {idx + 1}. Conjunto {gName}
                </span>
                <span className="text-[11px] text-text-muted font-bold">
                  {items.length} arq. · Subtotal: {formatHm(items.reduce((s, i) => s + (i.estimatedMinutes || 0), 0))}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900/80 text-[10px] font-black uppercase tracking-wider text-text-muted">
                    <tr>
                      <th className="p-2.5 text-center w-12">OK</th>
                      <th className="p-2.5">Arquivo G-Code</th>
                      <th className="p-2.5">Dimensões / Corte</th>
                      <th className="p-2.5">Tempo Est.</th>
                      <th className="p-2.5">Status</th>
                      <th className="p-2.5">Execução / Máquina</th>
                      <th className="p-2.5">Operador</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs">
                    {items.map(r => (
                      <tr key={r.key} className={r.status === 'done' ? 'bg-emerald-500/[0.06]' : r.status === 'running' ? 'bg-orange-500/[0.08]' : ''}>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleManualCheck(r.key)}
                            className={`w-5 h-5 rounded flex items-center justify-center font-black text-xs mx-auto cursor-pointer ${
                              r.status === 'done'
                                ? 'bg-emerald-500 text-white'
                                : r.status === 'running'
                                  ? 'bg-orange-500/20 border border-orange-400 text-orange-300'
                                  : 'border border-white/25 bg-black/40'
                            }`}
                          >
                            {r.status === 'done' ? '✓' : r.status === 'running' ? '▶' : ''}
                          </button>
                        </td>
                        <td className="p-2.5 font-bold text-white">{r.fileName}</td>
                        <td className="p-2.5 text-text-muted">{r.dimText}</td>
                        <td className="p-2.5 font-bold text-accent-cyan">{r.estText}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                            r.status === 'done'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : r.status === 'running'
                                ? 'bg-orange-500/20 text-orange-300'
                                : 'bg-white/5 text-text-muted'
                          }`}>
                            {r.status === 'done' ? 'Concluído' : r.status === 'running' ? 'Rodando' : 'Pendente'}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-300">
                          {r.routerName ? `${r.routerName} · ${r.timeRange}` : 'Máq: _______ · __:__ às __:__'}
                        </td>
                        <td className="p-2.5 font-bold text-orange-300">{r.operator || '_______'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
