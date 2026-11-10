import React, { useState, useMemo } from 'react';
import {
  X, Printer, ClipboardList, CheckSquare, Square, Share2, Check,
  Clock, Layers, Cpu, Wrench, AlertCircle, Sparkles, Filter, ChevronDown
} from 'lucide-react';
import { isFileMarkedOk } from './CaixaChecklistProducao';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatHm(mins) {
  const m = Math.round(Number(mins) || 0);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${String(rem).padStart(2, '0')}min` : `${h}h 00min`;
}

export function FichaTecnicaPipelineModal({
  isOpen,
  onClose,
  pipelineData,
  fileChecklist = {},
  initialJob = 'todos',
  uniqueJobNames = []
}) {
  const [selectedJob, setSelectedJob] = useState(initialJob);
  const [includeRouter, setIncludeRouter] = useState(true);
  const [includeAspire, setIncludeAspire] = useState(true);
  const [includeCorel, setIncludeCorel] = useState(true);
  const [includeConcluded, setIncludeConcluded] = useState(false);
  const [operatorName, setOperatorName] = useState('Tomas');
  const [assignedMachines, setAssignedMachines] = useState('Router 1 e Router 2');
  const [notes, setNotes] = useState('Verificar fixação na mesa a vácuo/parafusos, conferir zeramento em Z na base e sentido do veio do material.');
  const [copied, setCopied] = useState(false);

  // Sincroniza initialJob se abrir para um job específico
  React.useEffect(() => {
    if (initialJob) setSelectedJob(initialJob);
  }, [initialJob, isOpen]);

  // Extração e enriquecimento de todas as tarefas da produção com a duração real de cada corte
  const taskGroups = useMemo(() => {
    if (!pipelineData) return [];

    const activeExecs = pipelineData.activeExecutions || [];

    const isFileRunning = (fileName, jobName) => {
      return activeExecs.some(ex => {
        const exFile = (ex.file_name || '').toLowerCase();
        const fName = (fileName || '').toLowerCase();
        return (exFile === fName || fName.includes(exFile)) && (!jobName || (ex.job_name || '').toLowerCase().includes(jobName.toLowerCase()));
      });
    };

    const isFileChecked = (f) => {
      if (!f) return false;
      if (f.isCurrentlyRunning || isFileRunning(f.name, f.jobName)) return false;
      if (f.isManuallyDone) return true;
      const k1 = f.fullPath;
      const k2 = `${f.jobName || ''}_${f.name}`;
      const k3 = `${f.jobName || ''}|${f.subfolderName || ''}|${f.name}`;
      const k4 = `${f.name || ''}`;
      return Boolean(
        (k1 && fileChecklist[k1]?.done !== false && fileChecklist[k1]) ||
        (fileChecklist[k2]?.done !== false && fileChecklist[k2]) ||
        (fileChecklist[k3]?.done !== false && fileChecklist[k3]) ||
        (fileChecklist[k4]?.done !== false && fileChecklist[k4])
      );
    };

    const isDone = (f, stage) => {
      if (f.isCurrentlyRunning || isFileRunning(f.name, f.jobName)) return false;
      if (isFileChecked(f)) return true;
      if (f.isExecuted) return true;
      if (isFileMarkedOk(f.name)) return true;

      if (stage === 'corel') {
        return Boolean(
          f.hasGcode || 
          f.hasAspire || 
          (f.chapasCount > 0) || 
          f.stageStatus === 'lote_liberado' || 
          f.stageStatus === 'materiais_gerados'
        );
      }

      if (stage === 'aspire') {
        return Boolean(
          f.hasGcode || 
          (f.chapasCount > 0) || 
          f.hasCrv || 
          f.stageStatus === 'lote_liberado'
        );
      }

      if (stage === 'router') {
        return Boolean(f.isOk);
      }

      return false;
    };

    const resolveTaskDuration = (f) => {
      if (f.estimatedMinutes && Number(f.estimatedMinutes) > 0) {
        return Number(f.estimatedMinutes);
      }
      if (f.cutMeters && Number(f.cutMeters) > 0) {
        const isMdf = (f.matInfo?.material || '').toUpperCase().includes('MDF') || (f.name || '').toUpperCase().includes('MDF');
        const speed = isMdf ? 1800 : 2500;
        return Math.max(1, parseFloat(((Number(f.cutMeters) * 1000 / speed) * 1.15).toFixed(1)));
      }
      if (f.totalDurationMinutes && Number(f.totalDurationMinutes) > 2) return Number(f.totalDurationMinutes);
      if (f.lastExec?.duration_minutes && Number(f.lastExec.duration_minutes) > 2) return Number(f.lastExec.duration_minutes);
      if ((f.name || '').toLowerCase().includes('isopor')) return 90;
      return null;
    };

    const items = [];

    // 1. Corel (.CDR)
    if (includeCorel) {
      (pipelineData.cadPreparar || []).forEach(f => {
        if (selectedJob !== 'todos' && f.jobName !== selectedJob && f.jobName?.replace(/\s+/g, ' ') !== selectedJob?.replace(/\s+/g, ' ')) return;
        const done = isDone(f, 'corel');
        if (!includeConcluded && done) return;
        items.push({
          id: `corel-${f.jobName}-${f.name}`,
          stage: 'corel',
          stageLabel: '1. COREL (.CDR)',
          stageColor: 'amber',
          name: f.name,
          jobName: f.jobName || 'Geral',
          subfolder: f.subfolderName || 'Raiz',
          ext: f.ext || '.cdr',
          material: f.matInfo?.tag || 'Desenho Vetorial / Corte',
          status: done ? 'done' : 'pending',
          statusLabel: done ? 'Concluído' : 'Pendente Vetorização',
          durationMinutes: null,
          cutMeters: null,
          dimensions: null,
          operator: operatorName,
          mtime: f.mtimeDate
        });
      });
    }

    // 2. Aspire (.EPS, .DXF, .CRV3D)
    if (includeAspire) {
      (pipelineData.aspirePreparar || []).forEach(f => {
        if (f.ext === '.crv3d' || f.ext === '.crv' || (f.name || '').toLowerCase().endsWith('.crv3d') || (f.name || '').toLowerCase().endsWith('.crv')) return;
        if (selectedJob !== 'todos' && f.jobName !== selectedJob && f.jobName?.replace(/\s+/g, ' ') !== selectedJob?.replace(/\s+/g, ' ')) return;
        const done = isDone(f, 'aspire');
        if (!includeConcluded && done) return;
        items.push({
          id: `aspire-${f.jobName}-${f.name}`,
          stage: 'aspire',
          stageLabel: '2. ASPIRE (.CRV/.DXF)',
          stageColor: 'cyan',
          name: f.name,
          jobName: f.jobName || 'Geral',
          subfolder: f.subfolderName || 'Raiz',
          ext: f.ext || '.dxf',
          material: f.matInfo?.tag || (f.ext === '.crv3d' ? 'Arquivo 3D Aspire' : 'Usinagem / Percurso'),
          status: done ? 'done' : 'pending',
          statusLabel: done ? 'Concluído' : 'Aguardando G-Code',
          durationMinutes: null,
          cutMeters: null,
          dimensions: null,
          operator: operatorName,
          mtime: f.mtimeDate
        });
      });
    }

    // 3. Fila Router (.TXT) - tempo real individual de cada G-Code!
    if (includeRouter) {
      (pipelineData.gcodeProntos || []).forEach(f => {
        if (selectedJob !== 'todos' && f.jobName !== selectedJob && f.jobName?.replace(/\s+/g, ' ') !== selectedJob?.replace(/\s+/g, ' ')) return;
        const running = isFileRunning(f.name, f.jobName) || f.isCurrentlyRunning;
        const done = isDone(f, 'router');
        if (!includeConcluded && done && !running) return;

        // Duração exata do corte calculada via percurso G-Code ou histórico Mach3
        const durationMin = resolveTaskDuration(f);

        const dim = f.dimensions || (f.widthMm && f.heightMm ? `${f.widthMm}×${f.heightMm}mm` : null);

        items.push({
          id: `router-${f.jobName}-${f.name}`,
          stage: 'router',
          stageLabel: '3. FILA ROUTER (.TXT)',
          stageColor: 'orange',
          name: f.name,
          jobName: f.jobName || 'Geral',
          subfolder: f.subfolderName || 'Raiz',
          ext: f.ext || '.txt',
          material: f.matInfo?.tag || (f.name.toLowerCase().includes('isopor') ? 'ISOPOR' : 'MDF / ACM'),
          status: running ? 'running' : done ? 'done' : 'pending',
          statusLabel: running ? 'EM MÁQUINA AGORA' : done ? 'Concluído' : 'Pronto para Corte',
          durationMinutes: durationMin,
          cutMeters: f.cutMeters || null,
          dimensions: dim,
          operator: operatorName,
          mtime: f.mtimeDate
        });
      });
    }

    // 4. Já Concluídos (se marcado explicitamente para puxar histórico)
    if (includeConcluded && pipelineData.gcodeFeitos) {
      pipelineData.gcodeFeitos.forEach(f => {
        if (selectedJob !== 'todos' && f.jobName !== selectedJob && f.jobName?.replace(/\s+/g, ' ') !== selectedJob?.replace(/\s+/g, ' ')) return;
        if (items.some(it => it.name === f.name && it.stage === 'router')) return;
        const durationMin = resolveTaskDuration(f);
        const dim = f.dimensions || (f.widthMm && f.heightMm ? `${f.widthMm}×${f.heightMm}mm` : null);
        items.push({
          id: `done-${f.jobName}-${f.name}`,
          stage: 'done',
          stageLabel: 'HISTÓRICO CONCLUÍDO',
          stageColor: 'emerald',
          name: f.name,
          jobName: f.jobName || 'Geral',
          subfolder: f.subfolderName || 'Raiz',
          ext: f.ext || '.txt',
          material: f.matInfo?.tag || 'Usinado',
          status: 'done',
          statusLabel: 'Concluído',
          durationMinutes: durationMin,
          cutMeters: f.cutMeters || null,
          dimensions: dim,
          operator: f.lastExec?.operator_name || operatorName,
          mtime: f.lastExec?.start_time || f.mtimeDate
        });
      });
    }

    // Agrupa por Subpasta / Conjunto
    const groupsMap = {};
    items.forEach(it => {
      const groupKey = `${it.jobName} ➔ ${it.subfolder}`;
      if (!groupsMap[groupKey]) {
        groupsMap[groupKey] = {
          jobName: it.jobName,
          subfolder: it.subfolder,
          groupTitle: groupKey,
          tasks: []
        };
      }
      groupsMap[groupKey].tasks.push(it);
    });

    return Object.values(groupsMap);
  }, [pipelineData, fileChecklist, selectedJob, includeRouter, includeAspire, includeCorel, includeConcluded, operatorName]);

  // Estatísticas da Ficha Técnica somando a duração real de corte de cada arquivo
  const stats = useMemo(() => {
    let total = 0;
    let routerTasks = 0;
    let aspireTasks = 0;
    let corelTasks = 0;
    let runningTasks = 0;
    let doneTasks = 0;
    let pendingTasks = 0;
    let totalCuttingMinutes = 0;
    const materialsSet = new Set();

    taskGroups.forEach(g => {
      g.tasks.forEach(t => {
        total++;
        if (t.stage === 'router') {
          routerTasks++;
          totalCuttingMinutes += (t.durationMinutes || 0);
        }
        if (t.stage === 'aspire') aspireTasks++;
        if (t.stage === 'corel') corelTasks++;
        if (t.status === 'running') runningTasks++;
        else if (t.status === 'done') doneTasks++;
        else pendingTasks++;

        if (t.material && t.material !== 'Raiz') {
          materialsSet.add(t.material);
        }
      });
    });

    totalCuttingMinutes = Math.round(totalCuttingMinutes);
    const avgPerSheet = routerTasks > 0 ? Math.round(totalCuttingMinutes / routerTasks) : 0;
    const nMachines = assignedMachines.toLowerCase().includes('2') || assignedMachines.toLowerCase().includes('e') ? 2 : 1;
    const projectedMinutes = Math.round(totalCuttingMinutes / nMachines);

    return {
      total,
      routerTasks,
      aspireTasks,
      corelTasks,
      runningTasks,
      doneTasks,
      pendingTasks,
      totalCuttingMinutes,
      avgPerSheet,
      nMachines,
      projectedMinutes,
      materials: Array.from(materialsSet)
    };
  }, [taskGroups, assignedMachines]);

  if (!isOpen) return null;

  // Gerador de Impressão A4 (Print / PDF) com a duração exata de cada chapa
  const handlePrint = () => {
    const nowStr = new Date().toLocaleString('pt-BR');
    const jobTitle = selectedJob === 'todos' ? 'TODOS OS PROJETOS ATIVOS' : selectedJob.toUpperCase();

    const groupsHtml = taskGroups.map((g, gIdx) => {
      const subRouterMin = Math.round(g.tasks.filter(t => t.stage === 'router').reduce((sum, t) => sum + (t.durationMinutes || 0), 0));
      const rowsHtml = g.tasks.map((t, tIdx) => {
        const isDone = t.status === 'done';
        const isRunning = t.status === 'running';

        const checkHtml = isDone
          ? '<span class="checkbox checked">✓</span>'
          : isRunning
            ? '<span class="checkbox running">▶</span>'
            : '<span class="checkbox"></span>';

        const badgeHtml = isDone
          ? '<span class="badge badge-done">Concluído</span>'
          : isRunning
            ? '<span class="badge badge-run">Em Máquina</span>'
            : '<span class="badge badge-pend">Pendente</span>';

        const stageBadge = t.stage === 'router'
          ? '<span class="stage-tag tag-router">ROUTER .TXT</span>'
          : t.stage === 'aspire'
            ? '<span class="stage-tag tag-aspire">ASPIRE</span>'
            : '<span class="stage-tag tag-corel">COREL CDR</span>';

        const timeText = t.durationMinutes
          ? `<strong class="time-highlight">${formatHm(t.durationMinutes)}</strong>${t.cutMeters ? `<span class="time-sub">(${t.cutMeters}m corte)</span>` : ''}`
          : '-';

        return `
          <tr class="${isDone ? 'row-done' : isRunning ? 'row-running' : ''}">
            <td class="col-check">${checkHtml}</td>
            <td class="col-num">${tIdx + 1}</td>
            <td class="col-file">
              <strong>${escapeHtml(t.name)}</strong>
              ${t.dimensions ? `<div class="file-dim">${escapeHtml(t.dimensions)}</div>` : ''}
            </td>
            <td class="col-stage">${stageBadge}</td>
            <td class="col-mat">${escapeHtml(t.material)}</td>
            <td class="col-time">${timeText}</td>
            <td class="col-status">${badgeHtml}</td>
            <td class="col-exec write-field">Máq: ______ · ___:___ às ___:___</td>
            <td class="col-op">${escapeHtml(t.operator || operatorName)}</td>
          </tr>
        `;
      }).join('');

      return `
        <div class="group-box">
          <div class="group-header">
            <span>${gIdx + 1}. ${escapeHtml(g.groupTitle)}</span>
            <span class="group-count">${g.tasks.length} tarefa(s)${subRouterMin > 0 ? ` · Duração Total: ~${formatHm(subRouterMin)}` : ''}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width:28px; text-align:center;">OK</th>
                <th style="width:22px;">#</th>
                <th style="width:31%;">Arquivo / Chapa</th>
                <th style="width:12%;">Etapa</th>
                <th style="width:12%;">Material</th>
                <th style="width:13%;">Duração do Corte</th>
                <th style="width:10%;">Status</th>
                <th style="width:17%;">Apontamento Máquina</th>
                <th style="width:8%;">Operador</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

    const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Ficha Técnica - ${escapeHtml(jobTitle)}</title>
<style>
  @page { size: A4 portrait; margin: 8mm 9mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif; color: #0f172a; background: #fff; font-size: 8.8px; line-height: 1.25; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #ea580c; padding-bottom: 6px; margin-bottom: 8px; }
  .brand-badge { display: inline-block; background: #ea580c; color: #fff; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px; padding: 2px 7px; border-radius: 4px; margin-bottom: 3px; }
  .title { font-size: 15px; font-weight: 900; color: #0f172a; letter-spacing: -0.3px; }
  .subtitle { font-size: 9px; color: #475569; margin-top: 2px; font-weight: 600; }
  .meta-box { text-align: right; font-size: 8.4px; color: #334155; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 9px; line-height: 1.35; }
  
  .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 8px; }
  .kpi-card { border: 1px solid #cbd5e1; border-radius: 5px; padding: 5px 8px; background: #f8fafc; }
  .kpi-card.router { background: #fff7ed; border-color: #fdba74; }
  .kpi-card.time { background: #fefce8; border-color: #fde047; }
  .kpi-card.done { background: #ecfdf5; border-color: #6ee7b7; }
  .kpi-lbl { font-size: 7.2px; font-weight: 800; text-transform: uppercase; color: #64748b; }
  .kpi-card.router .kpi-lbl { color: #c2410c; }
  .kpi-card.time .kpi-lbl { color: #a16207; }
  .kpi-card.done .kpi-lbl { color: #047857; }
  .kpi-val { font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 1px; }
  .kpi-sub { font-size: 7.5px; color: #475569; }

  .group-box { margin-bottom: 9px; page-break-inside: avoid; }
  .group-header { display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; padding: 4.5px 8px; border-radius: 4px 4px 0 0; font-weight: 800; font-size: 8.8px; text-transform: uppercase; }
  .group-count { font-size: 7.5px; color: #cbd5e1; font-weight: 600; }

  table { width: 100%; border-collapse: collapse; }
  th { background: #f1f5f9; color: #334155; font-size: 7.5px; font-weight: 800; text-transform: uppercase; padding: 3.5px 5px; border: 1px solid #cbd5e1; text-align: left; }
  td { padding: 3.2px 5px; border: 1px solid #cbd5e1; vertical-align: middle; font-size: 8.4px; }
  tr.row-done { background: #f0fdf4; }
  tr.row-running { background: #fffbeb; }

  .col-check { text-align: center; }
  .checkbox { display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; border: 1.6px solid #334155; border-radius: 3px; background: #fff; font-size: 9px; font-weight: 900; }
  .checkbox.checked { background: #16a34a; border-color: #15803d; color: #fff; }
  .checkbox.running { background: #ffedd5; border-color: #ea580c; color: #ea580c; font-size: 7.5px; }
  .col-num { font-weight: 700; color: #64748b; font-size: 8px; text-align: center; }
  .col-file { word-break: break-all; }
  .file-dim { font-size: 7.4px; color: #64748b; font-family: monospace; }
  .col-time { white-space: nowrap; }
  .time-highlight { font-size: 9px; color: #c2410c; }
  .time-sub { font-size: 7.3px; color: #64748b; display: block; }
  
  .stage-tag { display: inline-block; padding: 1px 4.5px; border-radius: 3px; font-size: 7px; font-weight: 800; text-transform: uppercase; }
  .tag-router { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
  .tag-aspire { background: #cffafe; color: #155e75; border: 1px solid #a5f3fc; }
  .tag-corel { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }

  .badge { display: inline-block; padding: 1px 4.5px; border-radius: 99px; font-size: 7px; font-weight: 800; text-transform: uppercase; }
  .badge-done { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .badge-run { background: #ffedd5; color: #9a3412; border: 1px solid #fdba74; }
  .badge-pend { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
  
  .write-field { color: #94a3b8; font-size: 7.8px; white-space: nowrap; }

  .notes-box { margin-top: 8px; border: 1px solid #cbd5e1; border-radius: 5px; padding: 6px 9px; background: #f8fafc; font-size: 8.2px; }
  .notes-title { font-weight: 800; text-transform: uppercase; color: #334155; font-size: 7.8px; margin-bottom: 2px; }

  .footer-sigs { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; page-break-inside: avoid; }
  .sig-block { text-align: center; padding-top: 14px; border-top: 1px solid #64748b; font-size: 7.8px; font-weight: 700; color: #475569; text-transform: uppercase; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand-badge">Ordem de Produção & Ficha Técnica CNC</div>
      <div class="title">${escapeHtml(jobTitle)}</div>
      <div class="subtitle">Relação Operacional de Tarefas e Chapas para Usinagem em Máquinas CNC</div>
    </div>
    <div class="meta-box">
      <div><strong>Emissão:</strong> ${nowStr}</div>
      <div><strong>Operador:</strong> ${escapeHtml(operatorName)}</div>
      <div><strong>Máquinas:</strong> ${escapeHtml(assignedMachines)}</div>
      <div><strong>Duração Total do Corte:</strong> ${formatHm(stats.totalCuttingMinutes)}</div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi-card">
      <div class="kpi-lbl">Total de Tarefas</div>
      <div class="kpi-val">${stats.total}</div>
      <div class="kpi-sub">${taskGroups.length} conjuntos / subpastas</div>
    </div>
    <div class="kpi-card router">
      <div class="kpi-lbl">Fila Router (.TXT)</div>
      <div class="kpi-val">${stats.routerTasks} chapas</div>
      <div class="kpi-sub">${stats.runningTasks > 0 ? `${stats.runningTasks} em máquina agora` : 'Prontos para usinar'}</div>
    </div>
    <div class="kpi-card time">
      <div class="kpi-lbl">Duração Total do Corte</div>
      <div class="kpi-val">${formatHm(stats.totalCuttingMinutes)}</div>
      <div class="kpi-sub">~${formatHm(stats.projectedMinutes)} em ${stats.nMachines} Routers</div>
    </div>
    <div class="kpi-card done">
      <div class="kpi-lbl">Status Geral</div>
      <div class="kpi-val">${stats.doneTasks} OK / ${stats.pendingTasks} Pend</div>
      <div class="kpi-sub">${stats.runningTasks > 0 ? `▶ ${stats.runningTasks} rodando` : 'Aguardando liberação'}</div>
    </div>
  </div>

  ${groupsHtml || '<p style="padding:15px;text-align:center;color:#64748b;">Nenhuma tarefa encontrada com os filtros selecionados.</p>'}

  ${notes ? `
    <div class="notes-box">
      <div class="notes-title">Recomendações e Instruções da Produção:</div>
      <div>${escapeHtml(notes)}</div>
    </div>
  ` : ''}

  <div class="footer-sigs">
    <div class="sig-block">Operador Responsável (${escapeHtml(operatorName)})</div>
    <div class="sig-block">Operador Turno / Auxiliar</div>
    <div class="sig-block">Conferência & Liberação / Encarregado</div>
  </div>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=980,height=860');
    if (!printWin) {
      alert('Por favor, autorize pop-ups no navegador para emitir a Ficha Técnica para impressão ou PDF.');
      return;
    }
    printWin.document.open();
    printWin.document.write(fullHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 400);
  };

  // Copiar Relação Resumida para WhatsApp com duração de corte de cada arquivo
  const handleCopySummary = () => {
    const jobTitle = selectedJob === 'todos' ? 'TODOS OS PROJETOS' : selectedJob;
    const dateStr = new Date().toLocaleDateString('pt-BR');

    let text = `📋 *FICHA TÉCNICA DE PRODUÇÃO - RELAÇÃO DE TAREFAS*\n`;
    text += `🏭 *Projeto:* ${jobTitle}\n`;
    text += `📅 *Data:* ${dateStr} · *Operador:* ${operatorName}\n`;
    text += `⚙️ *Máquinas:* ${assignedMachines}\n`;
    text += `⏱️ *Duração Total do Corte:* ${formatHm(stats.totalCuttingMinutes)} (em ${stats.nMachines} Routers: ~${formatHm(stats.projectedMinutes)})\n`;
    text += `📊 *Resumo:* ${stats.total} tarefas (${stats.routerTasks} Chapas Router | ${stats.aspireTasks} Aspire | ${stats.corelTasks} Corel)\n\n`;

    taskGroups.forEach(g => {
      const subMin = Math.round(g.tasks.filter(t => t.stage === 'router').reduce((sum, t) => sum + (t.durationMinutes || 0), 0));
      text += `📁 *${g.groupTitle}* (${g.tasks.length} itens${subMin > 0 ? ` · Duração: ${formatHm(subMin)}` : ''}):\n`;
      g.tasks.forEach((t, idx) => {
        const icon = t.status === 'done' ? '✅' : t.status === 'running' ? '▶️' : '⏳';
        const timeBadge = t.durationMinutes ? ` [⏱️ ${formatHm(t.durationMinutes)}${t.cutMeters ? ` · ${t.cutMeters}m` : ''}]` : '';
        text += `  ${icon} ${idx + 1}. [${t.stageLabel.split(' ')[1]}] ${t.name} (${t.material})${timeBadge}\n`;
      });
      text += `\n`;
    });

    if (notes) {
      text += `⚠️ *Instruções:* ${notes}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#12141a] text-slate-900 dark:text-slate-100 w-full max-w-5xl max-h-[92vh] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between bg-slate-50 dark:bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-md">
              <ClipboardList size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  Ficha Técnica & Relação de Tarefas
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                  Duração Real de Corte por Chapa
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ordem de produção com tempo exato de usinagem de cada arquivo e somatório total da fila
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Controls & Filters Bar */}
        <div className="p-4 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#12141a] grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Seletor de Job / Projeto */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
              Projeto / Ordem de Serviço
            </label>
            <select
              value={selectedJob}
              onChange={e => setSelectedJob(e.target.value)}
              className="w-full text-xs font-bold px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500"
            >
              <option value="todos">Todos os Projetos Ativos ({uniqueJobNames.length})</option>
              {uniqueJobNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          {/* Operador & Máquinas */}
          <div className="md:col-span-4 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Operador
              </label>
              <input
                type="text"
                value={operatorName}
                onChange={e => setOperatorName(e.target.value)}
                placeholder="Ex: Tomas"
                className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
                Máquinas
              </label>
              <input
                type="text"
                value={assignedMachines}
                onChange={e => setAssignedMachines(e.target.value)}
                placeholder="Ex: Router 1 e 2"
                className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Filtro de Etapas */}
          <div className="md:col-span-4">
            <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
              Etapas na Ficha
            </label>
            <div className="flex items-center gap-2 flex-wrap py-1">
              <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeRouter}
                  onChange={e => setIncludeRouter(e.target.checked)}
                  className="rounded text-orange-500 focus:ring-0"
                />
                <span className="font-bold text-orange-600 dark:text-orange-400">Router (.TXT)</span>
              </label>
              <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeAspire}
                  onChange={e => setIncludeAspire(e.target.checked)}
                  className="rounded text-cyan-500 focus:ring-0"
                />
                <span className="font-bold text-cyan-600 dark:text-cyan-400">Aspire</span>
              </label>
              <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeCorel}
                  onChange={e => setIncludeCorel(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-0"
                />
                <span className="font-bold text-amber-600 dark:text-amber-400">Corel</span>
              </label>
              <label className="flex items-center gap-1 text-[11px] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeConcluded}
                  onChange={e => setIncludeConcluded(e.target.checked)}
                  className="rounded text-emerald-500 focus:ring-0"
                />
                <span className="font-medium text-slate-600 dark:text-slate-300">Incluir Concluídos</span>
              </label>
            </div>
          </div>
        </div>

        {/* KPI Mini Bar com duração real somada automaticamente */}
        <div className="px-5 py-2.5 bg-slate-100 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-3.5 flex-wrap">
            <span className="font-bold text-slate-700 dark:text-slate-300">
              Tarefas: <strong className="text-orange-500 font-black">{stats.total}</strong>
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 dark:text-slate-400">
              Fila Router: <strong className="text-slate-900 dark:text-white font-bold">{stats.routerTasks}</strong> chapas
            </span>
            <span className="text-slate-400">•</span>
            <span className="px-2.5 py-1 rounded-lg bg-orange-500 text-white font-black shadow-sm flex items-center gap-1.5 text-xs">
              <Clock size={13} />
              Duração Total do Corte: {formatHm(stats.totalCuttingMinutes)}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 dark:text-slate-300">
              Projeção: <strong className="text-slate-900 dark:text-white font-bold">~{formatHm(stats.projectedMinutes)}</strong> ({stats.nMachines} Routers)
              {stats.avgPerSheet > 0 && <span className="text-[10px] text-slate-400 ml-1.5">(média ~{stats.avgPerSheet}m/chapa)</span>}
            </span>
            {stats.runningTasks > 0 && (
              <>
                <span className="text-slate-400">•</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black animate-pulse">
                  ▶ {stats.runningTasks} em máquina
                </span>
              </>
            )}
          </div>

          <div className="text-[11px] text-slate-500">
            {stats.materials.length > 0 && `Materiais: ${stats.materials.slice(0, 3).join(', ')}${stats.materials.length > 3 ? ` +${stats.materials.length - 3}` : ''}`}
          </div>
        </div>

        {/* Scrollable Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {taskGroups.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <ClipboardList size={40} className="mx-auto mb-2 opacity-30 text-slate-400" />
              <p className="font-bold">Nenhuma tarefa correspondente aos filtros atuais.</p>
              <p className="text-xs mt-1">Experimente marcar mais etapas acima ou selecionar outro projeto.</p>
            </div>
          ) : (
            taskGroups.map((g, gIdx) => {
              const subRouterMin = Math.round(g.tasks.filter(t => t.stage === 'router').reduce((sum, t) => sum + (t.durationMinutes || 0), 0));
              return (
                <div
                  key={g.groupTitle}
                  className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm"
                >
                  {/* Cabeçalho do Grupo com Duração Total do Conjunto */}
                  <div className="px-3.5 py-2 bg-slate-900 text-white flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="w-5 h-5 rounded bg-orange-500 text-white text-[11px] font-black flex items-center justify-center">
                        {gIdx + 1}
                      </span>
                      <span>{g.groupTitle}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px]">
                      {subRouterMin > 0 && (
                        <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
                          ⏱️ Duração do Conjunto: ~{formatHm(subRouterMin)}
                        </span>
                      )}
                      <span className="text-slate-400 font-medium">
                        {g.tasks.length} {g.tasks.length === 1 ? 'tarefa' : 'tarefas'}
                      </span>
                    </div>
                  </div>

                  {/* Tabela de Tarefas com Duração de Corte de Cada Arquivo */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.01] text-[10px] font-black uppercase text-slate-500">
                          <th className="py-2 px-3 w-10 text-center">Status</th>
                          <th className="py-2 px-3">Arquivo / Chapa</th>
                          <th className="py-2 px-3">Etapa</th>
                          <th className="py-2 px-3">Material</th>
                          <th className="py-2 px-3">Duração do Corte</th>
                          <th className="py-2 px-3">Apontamento Máquina</th>
                          <th className="py-2 px-3 text-right">Operador</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {g.tasks.map((t) => {
                          const isDone = t.status === 'done';
                          const isRunning = t.status === 'running';

                          return (
                            <tr
                              key={t.id}
                              className={`hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors ${
                                isRunning ? 'bg-amber-500/10' : isDone ? 'bg-emerald-500/5 opacity-80' : ''
                              }`}
                            >
                              <td className="py-2 px-3 text-center">
                                {isDone ? (
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500 text-white text-xs font-bold">✓</span>
                                ) : isRunning ? (
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-orange-500 text-white text-[10px] font-bold animate-pulse">▶</span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-5 h-5 rounded border-2 border-slate-300 dark:border-white/20 text-transparent">○</span>
                                )}
                              </td>
                              <td className="py-2 px-3">
                                <span className="font-bold text-slate-900 dark:text-white block">
                                  {t.name}
                                </span>
                                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                  <span>{t.subfolder}</span>
                                  {t.dimensions && (
                                    <span className="text-amber-500/90 font-bold">({t.dimensions})</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 px-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  t.stage === 'router'
                                    ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30'
                                    : t.stage === 'aspire'
                                      ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30'
                                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                }`}>
                                  {t.stageLabel}
                                </span>
                              </td>
                              <td className="py-2 px-3 font-medium text-slate-600 dark:text-slate-300">
                                {t.material}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                                {t.durationMinutes ? (
                                  <div className="flex flex-col">
                                    <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400 font-black text-xs">
                                      <Clock size={12} />
                                      {formatHm(t.durationMinutes)}
                                    </span>
                                    {t.cutMeters > 0 && (
                                      <span className="text-[10px] text-slate-400 font-medium">
                                        {t.cutMeters}m de corte
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                                {isRunning ? (
                                  <span className="text-orange-500 font-bold">RODANDO EM MÁQUINA</span>
                                ) : isDone ? (
                                  <span className="text-emerald-500 font-bold">EXECUTADO</span>
                                ) : (
                                  <span>Máq: ______ · Início: ___:___ Fim: ___:___</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
                                {t.operator || operatorName}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}

          {/* Campo de Instruções / Observações */}
          <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl p-3">
            <label className="block text-[11px] font-black uppercase text-slate-500 dark:text-slate-400 mb-1">
              Instruções e Observações Técnicas (Impresso na Ficha)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Digite orientações aos operadores (ex: tipo de fresa, avanço, cuidados com espessura)..."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-slate-500">
            Pronto para emissão em papel <strong className="text-slate-800 dark:text-slate-200">A4</strong> ou envio no <strong className="text-slate-800 dark:text-slate-200">WhatsApp</strong> com tempo individual de cada arquivo
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopySummary}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-slate-400 dark:hover:border-white/20 transition-all bg-white dark:bg-white/5 active:scale-95"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
              <span>{copied ? 'Copiado p/ WhatsApp!' : 'Copiar Resumo'}</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={taskGroups.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Printer size={15} />
              <span>Imprimir / Salvar PDF (A4)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
