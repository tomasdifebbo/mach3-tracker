import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, Printer, Copy, ClipboardList, CheckSquare, Square, Share2, Check,
  Clock, Layers, Cpu, Wrench, AlertCircle, Sparkles, Filter, ChevronDown,
  RefreshCw, Flame, ListOrdered, Play, Maximize2, FileText, Search, Disc
} from 'lucide-react';
import { api } from '../../services/api';
import { isFileMarkedOk } from '../../utils/fileChecklistUtils';

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

export function FilaRouterOperador({
  operatorName = 'Operador',
  routers = [],
  isModal = false,
  onClose = null,
  onOpenModal = null
}) {
  const [pipelineData, setPipelineData] = useState(null);
  const [fileChecklist, setFileChecklist] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState('todos');
  const [selectedMaterial, setSelectedMaterial] = useState('todos');
  const [includeRouter, setIncludeRouter] = useState(true);
  const [includeAspire, setIncludeAspire] = useState(false);
  const [includeCorel] = useState(false);
  const [includeConcluded, setIncludeConcluded] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [assignedMachines, setAssignedMachines] = useState('Router 1 e Router 2');
  const [copied, setCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  const resolveDisplayPath = (task) => {
    let p = task.fullPath || task.fullFile?.fullPath || task.fullFile?.path || '';
    if (!p) {
      const sub = task.subfolder && task.subfolder !== 'Raiz' ? `\\${task.subfolder}` : '';
      p = `E:\\arquivos 2024\\ARQUIVOS 2026\\router\\${task.jobName}${sub}\\${task.baseName || task.name}`;
    }
    return p.replace(/\//g, '\\');
  };

  const handleCopyPath = (task) => {
    const winPath = resolveDisplayPath(task);
    navigator.clipboard.writeText(winPath);
    setCopiedKey(task.id);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2500);
  };
  const [togglingKey, setTogglingKey] = useState(null);

  // Carrega e sincroniza arquivos concluídos do banco
  const syncCompletedFiles = useCallback(async () => {
    try {
      const res = await api.getPipelineCompletedFiles();
      if (res && res.success && res.map) {
        setFileChecklist(prev => {
          const merged = { ...prev };
          Object.entries(res.map).forEach(([k, item]) => {
            if (item.done) {
              const entry = {
                checkedAt: item.completed_at || new Date().toISOString(),
                stage: item.stage || 'router',
                name: item.file_name || k,
                operator: item.operator_name || operatorName
              };
              merged[k] = entry;
              if (item.subfolder && item.file_name) {
                const fn = item.file_name.toLowerCase().trim();
                const sub = item.subfolder.toLowerCase().trim();
                merged[`${fn}___${sub}`] = entry;
                merged[`${sub}/${fn}`] = entry;
                if (item.job_name) {
                  const job = item.job_name.toLowerCase().trim();
                  merged[`${job}|${sub}|${fn}`] = entry;
                }
              }
            } else {
              delete merged[k];
              if (item.subfolder && item.file_name) {
                const fn = item.file_name.toLowerCase().trim();
                const sub = item.subfolder.toLowerCase().trim();
                delete merged[`${fn}___${sub}`];
                delete merged[`${sub}/${fn}`];
                if (item.job_name) {
                  const job = item.job_name.toLowerCase().trim();
                  delete merged[`${job}|${sub}|${fn}`];
                }
              }
            }
          });
          return merged;
        });
      }
    } catch (err) {
      console.warn('Erro ao sincronizar arquivos concluídos no operador:', err);
    }
  }, [operatorName]);

  const fetchPipeline = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const data = await api.getArquivosProducao(force);
      if (data && !data.error) {
        setPipelineData(data);
      }
    } catch (err) {
      console.error('Erro ao carregar pipeline da fila router:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    syncCompletedFiles();
    fetchPipeline(false);
    const interval = setInterval(() => {
      fetchPipeline(false);
      syncCompletedFiles();
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchPipeline, syncCompletedFiles]);

  const isFileRunning = useCallback((fileName, jobName) => {
    // 1. Verifica execuções ativas do pipelineData
    const activeExecs = pipelineData?.activeExecutions || [];
    const inPipeline = activeExecs.some(ex => {
      const exFile = (ex.file_name || '').toLowerCase();
      const fName = (fileName || '').toLowerCase();
      return (exFile === fName || fName.includes(exFile)) && (!jobName || (ex.job_name || '').toLowerCase().includes(jobName.toLowerCase()));
    });
    if (inPipeline) return true;

    // 2. Verifica nas routers do dashboard em tempo real
    if (routers && routers.length > 0) {
      const inRouters = routers.some(r => {
        if (r.status !== 'cortando' && !r.current_job) return false;
        const cur = (r.current_job || '').toLowerCase();
        const fName = (fileName || '').toLowerCase();
        return cur && (fName === cur || fName.includes(cur) || cur.includes(fName));
      });
      if (inRouters) return true;
    }

    return false;
  }, [pipelineData?.activeExecutions, routers]);

  const isFileChecked = useCallback((f) => {
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
  }, [fileChecklist, isFileRunning]);

  const isDone = useCallback((f, stage) => {
    if (f.isCurrentlyRunning || isFileRunning(f.name, f.jobName)) return false;
    if (isFileChecked(f)) return true;
    if (f.isExecuted) return true;
    if (isFileMarkedOk(f.name)) return true;

    if (stage === 'router') {
      return Boolean(f.isOk);
    }
    if (stage === 'aspire') {
      return Boolean(f.hasGcode || (f.chapasCount > 0) || f.hasCrv);
    }
    if (stage === 'corel') {
      return Boolean(f.hasGcode || f.hasAspire || (f.chapasCount > 0));
    }
    return false;
  }, [isFileRunning, isFileChecked]);

  const resolveTaskDuration = useCallback((f) => {
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
  }, []);

  // Alterna o apontamento de conclusão da chapa pelo operador
  const handleToggleSheet = async (task) => {
    const key = task.id || `${task.jobName}|${task.subfolder}|${task.name}`;
    const currentlyDone = task.status === 'done';
    const willBeDone = !currentlyDone;

    setTogglingKey(key);

    // Atualização otimista local
    setFileChecklist(prev => {
      const next = { ...prev };
      if (willBeDone) {
        const entry = {
          checkedAt: new Date().toISOString(),
          stage: task.stage || 'router',
          name: task.baseName || task.name,
          operator: operatorName
        };
        next[key] = entry;
        next[task.baseName || task.name] = entry;
      } else {
        delete next[key];
        delete next[task.baseName || task.name];
      }
      return next;
    });

    try {
      await api.togglePipelineCompleted({
        file_key: key,
        file_name: task.baseName || task.name,
        stage: task.stage || 'router',
        subfolder: task.subfolder || null,
        job_name: task.jobName || null,
        done: willBeDone,
        operator_name: operatorName
      });
      await fetchPipeline(true);
    } catch (err) {
      console.warn('Erro ao salvar apontamento no banco:', err);
    } finally {
      setTogglingKey(null);
    }
  };

  // Extração e agrupamento de tarefas voltadas ao corte
  const { taskGroups, allMaterials, uniqueJobs } = useMemo(() => {
    if (!pipelineData) {
      return { taskGroups: [], allMaterials: [], uniqueJobs: [] };
    }

    const items = [];
    const matSet = new Set();
    const jobsSet = new Set();

    // 1. Fila Router (.TXT) - Núcleo da Orientação de Corte
    if (includeRouter) {
      (pipelineData.gcodeProntos || []).forEach(f => {
        const job = f.jobName || 'Geral';
        jobsSet.add(job);

        const running = isFileRunning(f.name, f.jobName) || f.isCurrentlyRunning;
        const done = isDone(f, 'router');
        if (!includeConcluded && done && !running) return;

        const durationMin = resolveTaskDuration(f);
        const dim = f.dimensions || (f.widthMm && f.heightMm ? `${f.widthMm}×${f.heightMm}mm` : null);
        const mat = f.matInfo?.tag || (f.name.toLowerCase().includes('isopor') ? 'ISOPOR 100mm' : 'MDF 9mm');
        matSet.add(mat);

        const isTopoColunas = (f.subfolderName || '').toLowerCase().includes('topo isopor colunas') || (f.name || '').toLowerCase().includes('topo isopor colunas');
        const targetQty = f.targetQuantity || f.matInfo?.targetQuantity || (isTopoColunas ? 14 : 1);
        const completedCount = f.completedExecsCount || f.execCount || 0;

        if (targetQty > 1) {
          for (let q = 1; q <= targetQty; q++) {
            const pieceDone = q <= completedCount || done;
            const pieceRunning = running && q === (completedCount + 1);
            const pieceStatus = pieceDone ? 'done' : pieceRunning ? 'running' : 'pending';
            const pieceStatusLabel = pieceDone ? 'Concluído' : pieceRunning ? 'EM MÁQUINA AGORA' : `Pendente (${q}/${targetQty})`;

            items.push({
              id: `router-${f.jobName}-${f.name}-p${q}`,
              stage: 'router',
              stageLabel: '3. FILA ROUTER (.TXT)',
              stageColor: 'orange',
              name: `${f.name} [Peça ${q} de ${targetQty}]`,
              baseName: f.name,
              itemIndex: q,
              targetQuantity: targetQty,
              jobName: job,
              subfolder: f.subfolderName || 'Raiz',
              ext: f.ext || '.txt',
              material: mat,
              status: pieceStatus,
              statusLabel: pieceStatusLabel,
              durationMinutes: durationMin,
              cutMeters: f.cutMeters || null,
              dimensions: dim,
              operator: operatorName,
              mtime: f.mtimeDate,
              errorExecsCount: f.errorExecsCount || 0,
              avgValidMinutes: f.avgValidMinutes || f.estimatedMinutes || 0,
              fullFile: f,
              fullPath: f.fullPath
            });
          }
        } else {
          items.push({
            id: `router-${f.jobName}-${f.name}`,
            stage: 'router',
            stageLabel: '3. FILA ROUTER (.TXT)',
            stageColor: 'orange',
            name: f.name,
            baseName: f.name,
            itemIndex: 1,
            targetQuantity: 1,
            jobName: job,
            subfolder: f.subfolderName || 'Raiz',
            ext: f.ext || '.txt',
            material: mat,
            status: running ? 'running' : done ? 'done' : 'pending',
            statusLabel: running ? 'EM MÁQUINA AGORA' : done ? 'Concluído' : 'Pronto para Corte',
            durationMinutes: durationMin,
            cutMeters: f.cutMeters || null,
            dimensions: dim,
            operator: operatorName,
            mtime: f.mtimeDate,
            errorExecsCount: f.errorExecsCount || 0,
            avgValidMinutes: f.avgValidMinutes || f.estimatedMinutes || 0,
            fullFile: f,
            fullPath: f.fullPath
          });
        }
      });
    }

    // 2. Aspire (.DXF, .CRV3D) - opcional para o operador ver arquivos em preparação
    if (includeAspire) {
      (pipelineData.aspirePreparar || []).forEach(f => {
        if (f.ext === '.crv3d' || f.ext === '.crv' || (f.name || '').toLowerCase().endsWith('.crv3d') || (f.name || '').toLowerCase().endsWith('.crv')) return;
        const job = f.jobName || 'Geral';
        jobsSet.add(job);
        const done = isDone(f, 'aspire');
        if (!includeConcluded && done) return;

        const mat = f.matInfo?.tag || 'Usinagem / Percurso';
        matSet.add(mat);

        items.push({
          id: `aspire-${f.jobName}-${f.name}`,
          stage: 'aspire',
          stageLabel: '2. ASPIRE (.CRV/.DXF)',
          stageColor: 'cyan',
          name: f.name,
          baseName: f.name,
          itemIndex: 1,
          targetQuantity: 1,
          jobName: job,
          subfolder: f.subfolderName || 'Raiz',
          ext: f.ext || '.dxf',
          material: mat,
          status: done ? 'done' : 'pending',
          statusLabel: done ? 'Concluído' : 'Aguardando G-Code',
          durationMinutes: null,
          cutMeters: null,
          dimensions: null,
          operator: operatorName,
          mtime: f.mtimeDate,
          fullFile: f
        });
      });
    }

    // 3. Corel (.CDR) - opcional
    if (includeCorel) {
      (pipelineData.cadPreparar || []).forEach(f => {
        const job = f.jobName || 'Geral';
        jobsSet.add(job);
        const done = isDone(f, 'corel');
        if (!includeConcluded && done) return;

        const mat = f.matInfo?.tag || 'Desenho Vetorial';
        matSet.add(mat);

        items.push({
          id: `corel-${f.jobName}-${f.name}`,
          stage: 'corel',
          stageLabel: '1. COREL (.CDR)',
          stageColor: 'amber',
          name: f.name,
          baseName: f.name,
          itemIndex: 1,
          targetQuantity: 1,
          jobName: job,
          subfolder: f.subfolderName || 'Raiz',
          ext: f.ext || '.cdr',
          material: mat,
          status: done ? 'done' : 'pending',
          statusLabel: done ? 'Concluído' : 'Pendente Vetorização',
          durationMinutes: null,
          cutMeters: null,
          dimensions: null,
          operator: operatorName,
          mtime: f.mtimeDate,
          fullFile: f
        });
      });
    }

    // 4. Histórico Concluído (se marcado)
    if (includeConcluded && pipelineData.gcodeFeitos) {
      pipelineData.gcodeFeitos.forEach(f => {
        const job = f.jobName || 'Geral';
        jobsSet.add(job);
        if (items.some(it => (it.baseName || it.name) === f.name && it.stage === 'router')) return;

        const durationMin = resolveTaskDuration(f);
        const dim = f.dimensions || (f.widthMm && f.heightMm ? `${f.widthMm}×${f.heightMm}mm` : null);
        const mat = f.matInfo?.tag || 'Usinado';
        matSet.add(mat);

        items.push({
          id: `done-${f.jobName}-${f.name}`,
          stage: 'done',
          stageLabel: 'HISTÓRICO CONCLUÍDO',
          stageColor: 'emerald',
          name: f.name,
          baseName: f.name,
          itemIndex: 1,
          targetQuantity: 1,
          jobName: job,
          subfolder: f.subfolderName || 'Raiz',
          ext: f.ext || '.txt',
          material: mat,
          status: 'done',
          statusLabel: 'Concluído',
          durationMinutes: durationMin,
          cutMeters: f.cutMeters || null,
          dimensions: dim,
          operator: f.lastExec?.operator_name || operatorName,
          mtime: f.lastExec?.start_time || f.mtimeDate,
          fullFile: f
        });
      });
    }

    // Aplica filtros de Projeto, Material e Busca
    const filteredItems = items.filter(it => {
      if (selectedJob !== 'todos' && it.jobName !== selectedJob && it.jobName?.replace(/\s+/g, ' ') !== selectedJob?.replace(/\s+/g, ' ')) {
        return false;
      }
      if (selectedMaterial !== 'todos' && it.material !== selectedMaterial) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const nMatch = (it.name || '').toLowerCase().includes(q);
        const jMatch = (it.jobName || '').toLowerCase().includes(q);
        const sMatch = (it.subfolder || '').toLowerCase().includes(q);
        const mMatch = (it.material || '').toLowerCase().includes(q);
        if (!nMatch && !jMatch && !sMatch && !mMatch) return false;
      }
      return true;
    });

    // Agrupa por Projeto ➔ Subpasta/Conjunto
    const groupsMap = {};
    filteredItems.forEach(it => {
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

    return {
      taskGroups: Object.values(groupsMap),
      allMaterials: Array.from(matSet).sort(),
      uniqueJobs: Array.from(jobsSet).sort()
    };
  }, [
    pipelineData, isFileRunning, isDone, resolveTaskDuration,
    includeRouter, includeAspire, includeCorel, includeConcluded,
    selectedJob, selectedMaterial, searchTerm, operatorName
  ]);

  // Estatísticas somadas da fila
  const stats = useMemo(() => {
    let total = 0;
    let routerTasks = 0;
    let aspireTasks = 0;
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
    const nMachines = 2; // Router 1 e Router 2
    const projectedMinutes = Math.round(totalCuttingMinutes / nMachines);

    return {
      total,
      routerTasks,
      aspireTasks,
      runningTasks,
      doneTasks,
      pendingTasks,
      totalCuttingMinutes,
      avgPerSheet,
      nMachines,
      projectedMinutes,
      materials: Array.from(materialsSet)
    };
  }, [taskGroups]);

  // Copia resumo para o WhatsApp
  const handleCopySummary = () => {
    const jobTitle = selectedJob === 'todos' ? 'TODOS OS PROJETOS ATIVOS' : selectedJob;
    const lines = [
      `🔥 *FILA DE CORTE CNC ROUTER - ORIENTAÇÃO DE PRODUÇÃO*`,
      `📋 *Projeto:* ${jobTitle}`,
      `👤 *Operador:* ${operatorName} · *Máquinas:* ${assignedMachines}`,
      `📊 *Total de Chapas na Fila:* ${stats.routerTasks} chapas`,
      `⏱️ *Duração Total Estimada:* ~${formatHm(stats.totalCuttingMinutes)}`,
      `⚡ *Projeção (2 Routers):* ~${formatHm(stats.projectedMinutes)} (média ~${stats.avgPerSheet}m/chapa)`,
      stats.runningTasks > 0 ? `▶️ *Em corte na máquina agora:* ${stats.runningTasks} chapa(s)` : '',
      `───────────────────────────────`,
      `📦 *CONJUNTOS & CHAPAS NA FILA:*`
    ].filter(Boolean);

    taskGroups.slice(0, 15).forEach((g, gIdx) => {
      const gMin = Math.round(g.tasks.filter(t => t.stage === 'router').reduce((sum, t) => sum + (t.durationMinutes || 0), 0));
      lines.push(`\n*${gIdx + 1}. ${g.groupTitle}* (${g.tasks.length} chapas · ~${formatHm(gMin)})`);
      g.tasks.forEach(t => {
        const icon = t.status === 'running' ? '▶️' : t.status === 'done' ? '✅' : '⏳';
        const tStr = t.durationMinutes ? `[~${formatHm(t.durationMinutes)}]` : '';
        const dimStr = t.dimensions ? `(${t.dimensions})` : '';
        lines.push(`  ${icon} ${t.name} ${dimStr} · *${t.material}* ${tStr}\n     📂 ${resolveDisplayPath(t)}`);
      });
    });

    if (taskGroups.length > 15) {
      lines.push(`\n... (+${taskGroups.length - 15} outros conjuntos na fila)`);
    }

    lines.push(`\n📅 Gerado em: ${new Date().toLocaleString('pt-BR')}`);
    lines.push(`🏭 *Mach3 Tracker - Terminal da Oficina*`);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // Impressão A4 Oficial idêntica à modal
  const handlePrint = () => {
    const nowStr = new Date().toLocaleString('pt-BR');
    const jobTitle = selectedJob === 'todos' ? 'TODOS OS PROJETOS ATIVOS' : selectedJob.toUpperCase();

    const groupsHtml = taskGroups.map((g, gIdx) => {
      const subRouterMin = Math.round(g.tasks.filter(t => t.stage === 'router').reduce((sum, t) => sum + (t.durationMinutes || 0), 0));
      const rowsHtml = g.tasks.map((t, tIdx) => {
        const isDoneState = t.status === 'done';
        const isRunningState = t.status === 'running';

        const checkHtml = isDoneState
          ? '<span class="checkbox checked">✓</span>'
          : isRunningState
            ? '<span class="checkbox running">▶</span>'
            : '<span class="checkbox"></span>';

        const badgeHtml = isDoneState
          ? '<span class="badge badge-done">Concluído</span>'
          : isRunningState
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
          <tr class="${isDoneState ? 'row-done' : isRunningState ? 'row-running' : ''}">
            <td class="col-check">${checkHtml}</td>
            <td class="col-num">${tIdx + 1}</td>
            <td class="col-file">
              <strong>${escapeHtml(t.name)}</strong>
              ${t.dimensions ? `<div class="file-dim">${escapeHtml(t.dimensions)}</div>` : ''}
              <div class="file-path">📂 ${escapeHtml(resolveDisplayPath(t))}</div>
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
            <span class="group-count">${g.tasks.length} chapa(s)${subRouterMin > 0 ? ` · Duração Total: ~${formatHm(subRouterMin)}` : ''}</span>
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
<title>Fila de Corte CNC Router - ${escapeHtml(jobTitle)}</title>
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
  .file-path { font-size: 7.2px; color: #334155; font-family: Consolas, monospace; margin-top: 2px; word-break: break-all; background: #f8fafc; padding: 1.5px 4px; border-radius: 3px; border-left: 2px solid #ea580c; }
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
</style>
</head>
<body>
  <div class="header">
    <div>
      <span class="brand-badge">TERMINAL DO OPERADOR CNC · ORDEM DE CORTE</span>
      <h1 class="title">FILA DE CORTE CNC ROUTER</h1>
      <p class="subtitle">Orientação técnica para troca de chapas, materiais e duração real de usinagem</p>
    </div>
    <div class="meta-box">
      <div><strong>Projeto:</strong> ${escapeHtml(jobTitle)}</div>
      <div><strong>Operador Responsável:</strong> ${escapeHtml(operatorName)}</div>
      <div><strong>Máquinas:</strong> ${escapeHtml(assignedMachines)} · <strong>Emissão:</strong> ${nowStr}</div>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi-card router">
      <div class="kpi-lbl">Chapas na Fila</div>
      <div class="kpi-val">${stats.routerTasks}</div>
      <div class="kpi-sub">Total de percursos G-Code</div>
    </div>
    <div class="kpi-card time">
      <div class="kpi-lbl">Duração Total de Corte</div>
      <div class="kpi-val">${formatHm(stats.totalCuttingMinutes)}</div>
      <div class="kpi-sub">Soma de tempo individual</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-lbl">Projeção (2 Routers)</div>
      <div class="kpi-val">~${formatHm(stats.projectedMinutes)}</div>
      <div class="kpi-sub">Média ~${stats.avgPerSheet}min/chapa</div>
    </div>
    <div class="kpi-card done">
      <div class="kpi-lbl">Status em Máquina</div>
      <div class="kpi-val">${stats.runningTasks} rodando</div>
      <div class="kpi-sub">${stats.pendingTasks} pendentes · ${stats.doneTasks} cortadas</div>
    </div>
  </div>

  ${groupsHtml}
</body>
</html>`;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Bloqueador de pop-ups impediu a impressão. Por favor, permita pop-ups nesta página.');
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

  // Conteúdo principal
  const content = (
    <div className={`flex flex-col ${isModal ? 'h-[92vh] max-h-[92vh]' : 'space-y-4'}`}>
      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-4 bg-slate-900 text-white rounded-t-2xl shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0 border border-orange-500/30">
            <Flame size={20} className="animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-orange-500 text-black">
                ORIENTAÇÃO DO CORTE & DURAÇÃO REAL
              </span>
              <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                • Terminal do Operador
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight truncate text-white mt-0.5">
              Fila de Corte da Router CNC
            </h2>
            <p className="text-xs text-slate-400 truncate hidden sm:block">
              Ordem de usinagem, materiais, espessuras e somatório exato da fila
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchPipeline(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer disabled:opacity-50"
            title="Atualizar lista da fila"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-orange-400' : ''} />
            <span className="hidden sm:inline">{loading ? 'Atualizando...' : 'Atualizar'}</span>
          </button>

          {!isModal && onOpenModal && (
            <button
              onClick={onOpenModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-sm transition-all cursor-pointer"
              title="Expandir em Janela Modal"
            >
              <Maximize2 size={14} />
              <span className="hidden sm:inline">Expandir</span>
            </button>
          )}

          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Fechar janela"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros Operacionais */}
      <div className="p-4 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/10 space-y-3 shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* 1. Seleção de Projeto */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Projeto / Ordem de Serviço
            </label>
            <select
              value={selectedJob}
              onChange={e => setSelectedJob(e.target.value)}
              className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500"
            >
              <option value="todos">Todos os Projetos Ativos ({uniqueJobs.length})</option>
              {uniqueJobs.map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>

          {/* 2. Operador Atual */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Operador na Máquina
            </label>
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-xs font-bold text-slate-800 dark:text-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="truncate">{operatorName}</span>
              <span className="text-[10px] text-slate-400 font-normal ml-auto">Turno Atual</span>
            </div>
          </div>

          {/* 3. Máquinas Designadas */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Máquinas
            </label>
            <input
              type="text"
              value={assignedMachines}
              onChange={e => setAssignedMachines(e.target.value)}
              placeholder="Ex: Router 1 e Router 2"
              className="w-full text-xs font-bold px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* 4. Campo de Busca de Peça / Chapa */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
              Buscar Arquivo / Chapa
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Ex: MDF 9mm, escada..."
                className="w-full text-xs font-bold pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-zinc-900 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Linha 2: Chips Rápidos por Material (Orientação Chave de Corte) e Etapas */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1 border-t border-slate-200 dark:border-white/5">
          {/* Filtro por Material */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mr-1 flex items-center gap-1">
              <Filter size={11} /> Material:
            </span>
            <button
              onClick={() => setSelectedMaterial('todos')}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer ${
                selectedMaterial === 'todos'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-orange-500'
              }`}
            >
              Todos ({stats.routerTasks})
            </button>
            {allMaterials.map(m => (
              <button
                key={m}
                onClick={() => setSelectedMaterial(m)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  selectedMaterial === m
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-orange-500'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Filtros de Etapas & Concluídos */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeRouter}
                onChange={e => setIncludeRouter(e.target.checked)}
                className="rounded text-orange-500 focus:ring-0"
              />
              <span className="font-bold text-orange-600 dark:text-orange-400 text-[11px]">Router (.TXT)</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeAspire}
                onChange={e => setIncludeAspire(e.target.checked)}
                className="rounded text-cyan-500 focus:ring-0"
              />
              <span className="font-bold text-cyan-600 dark:text-cyan-400 text-[11px]">Aspire (.DXF)</span>
            </label>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeConcluded}
                onChange={e => setIncludeConcluded(e.target.checked)}
                className="rounded text-emerald-500 focus:ring-0"
              />
              <span className="font-medium text-slate-600 dark:text-slate-300 text-[11px]">Incluir Concluídos</span>
            </label>
          </div>
        </div>
      </div>

      {/* KPI Mini Bar com duração real somada (Igual ao screenshot) */}
      <div className="px-4 py-2.5 bg-slate-100 dark:bg-white/[0.03] border-b border-slate-200 dark:border-white/5 flex items-center justify-between flex-wrap gap-2 text-xs shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
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
              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-black animate-pulse flex items-center gap-1">
                <Play size={10} fill="currentColor" /> {stats.runningTasks} em máquina
              </span>
            </>
          )}
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 hidden md:block">
          {stats.materials.length > 0 && `Materiais: ${stats.materials.slice(0, 3).join(', ')}${stats.materials.length > 3 ? ` +${stats.materials.length - 3}` : ''}`}
        </div>
      </div>

      {/* Área da Fila com Grupos por Conjunto */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {taskGroups.length === 0 ? (
          <div className="p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-2xl">
            <ClipboardList size={40} className="mx-auto mb-2 opacity-30 text-slate-400" />
            <p className="font-bold text-sm text-slate-800 dark:text-slate-200">Nenhuma chapa correspondente aos filtros atuais.</p>
            <p className="text-xs mt-1 text-slate-500">Altere o filtro de material, projeto ou marque "Incluir Concluídos".</p>
          </div>
        ) : (
          taskGroups.map((g, gIdx) => {
            const subRouterMin = Math.round(g.tasks.filter(t => t.stage === 'router').reduce((sum, t) => sum + (t.durationMinutes || 0), 0));

            return (
              <div
                key={g.groupTitle}
                className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shadow-sm"
              >
                {/* Cabeçalho do Grupo com Duração Total do Conjunto (Idêntico à foto) */}
                <div className="px-3.5 py-2.5 bg-slate-900 text-white flex items-center justify-between text-xs flex-wrap gap-2">
                  <div className="flex items-center gap-2 font-bold min-w-0">
                    <span className="w-5 h-5 rounded bg-orange-500 text-white text-[11px] font-black flex items-center justify-center shrink-0">
                      {gIdx + 1}
                    </span>
                    <span className="truncate">{g.groupTitle}</span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px]">
                    {subRouterMin > 0 && (
                      <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 flex items-center gap-1">
                        <Clock size={11} /> Duração do Conjunto: ~{formatHm(subRouterMin)}
                      </span>
                    )}
                    <span className="text-slate-400 font-medium">
                      {g.tasks.length} {g.tasks.length === 1 ? 'tarefa' : 'tarefas'}
                    </span>
                  </div>
                </div>

                {/* Tabela de Chapas */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.01] text-[10px] font-black uppercase text-slate-500">
                        <th className="py-2.5 px-3 w-12 text-center">Status</th>
                        <th className="py-2.5 px-3">Arquivo / Chapa</th>
                        <th className="py-2.5 px-3">Etapa</th>
                        <th className="py-2.5 px-3">Material</th>
                        <th className="py-2.5 px-3">Duração do Corte</th>
                        <th className="py-2.5 px-3">COPIAR CAMINHO</th>
                        <th className="py-2.5 px-3 text-right">Operador</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {g.tasks.map((t) => {
                        const isDoneState = t.status === 'done';
                        const isRunningState = t.status === 'running';
                        const isToggling = togglingKey === (t.id || t.name);

                        return (
                          <tr
                            key={t.id}
                            className={`hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors ${
                              isRunningState
                                ? 'bg-amber-500/10'
                                : isDoneState
                                  ? 'bg-emerald-500/5 opacity-75'
                                  : ''
                            }`}
                          >
                            {/* Coluna 1: Checkbox Interativo de Apontamento */}
                            <td className="py-2.5 px-3 text-center">
                              <button
                                onClick={() => handleToggleSheet(t)}
                                disabled={isToggling}
                                className="inline-flex items-center justify-center cursor-pointer transition-transform active:scale-90"
                                title={isDoneState ? 'Clique para desmarcar conclusão' : 'Clique para marcar chapa cortada'}
                              >
                                {isDoneState ? (
                                  <span className="w-5 h-5 rounded bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                                    ✓
                                  </span>
                                ) : isRunningState ? (
                                  <span className="w-5 h-5 rounded bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-sm">
                                    ▶
                                  </span>
                                ) : (
                                  <span className="w-5 h-5 rounded border-2 border-slate-300 dark:border-white/20 hover:border-orange-500 text-transparent flex items-center justify-center">
                                    ○
                                  </span>
                                )}
                              </button>
                            </td>

                            {/* Coluna 2: Arquivo & Medidas da Chapa Destacadas */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-white">
                                  {t.name}
                                </span>
                                {t.errorExecsCount > 0 && (
                                  <span
                                    className="px-1.5 py-0.2 rounded text-[9px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 inline-flex items-center gap-1"
                                    title={`⚠️ ${t.errorExecsCount} corte(s) interrompido(s) (stop/reload) abaixo do tempo médio (~${Math.round(t.avgValidMinutes || 0)} min) — erro na operação (não contabilizado)`}
                                  >
                                    <AlertCircle size={10} className="text-amber-400 shrink-0" />
                                    <span>{t.errorExecsCount}x Erro Op.</span>
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                                <span>{t.subfolder}</span>
                                {t.dimensions && (
                                  <span className="text-amber-500 dark:text-amber-400 font-black px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/20">
                                    ({t.dimensions})
                                  </span>
                                )}
                              </div>
                              <div
                                onClick={() => handleCopyPath(t)}
                                title="Clique para copiar o caminho completo do arquivo"
                                className="mt-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-black/30 border border-slate-200 dark:border-white/10 text-[10px] font-mono text-slate-600 dark:text-slate-300 break-all cursor-pointer hover:border-orange-500/50 transition-colors flex items-center gap-1"
                              >
                                <span className="text-orange-500 shrink-0">📂</span>
                                <span>{resolveDisplayPath(t)}</span>
                              </div>
                            </td>

                            {/* Coluna 3: Etapa */}
                            <td className="py-2.5 px-3">
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

                            {/* Coluna 4: Material */}
                            <td className="py-2.5 px-3 font-bold text-slate-700 dark:text-slate-300">
                              {t.material}
                            </td>

                            {/* Coluna 5: Duração Real do Corte */}
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700 dark:text-slate-300">
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

                            {/* Coluna 6: Copiar Caminho */}
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isRunningState && (
                                  <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-500 font-black text-[10px] animate-pulse flex items-center gap-1">
                                    <Play size={9} fill="currentColor" /> RODANDO
                                  </span>
                                )}
                                <button
                                  onClick={() => handleCopyPath(t)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95 ${
                                    copiedKey === t.id
                                      ? 'bg-emerald-500 text-white border border-emerald-600'
                                      : 'bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-orange-500 hover:text-orange-500 hover:bg-orange-500/10'
                                  }`}
                                  title="Clique para copiar o caminho do arquivo para o Mach3 ou Windows Explorer"
                                >
                                  {copiedKey === t.id ? (
                                    <>
                                      <Check size={13} className="text-white" />
                                      <span>Caminho Copiado!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy size={13} />
                                      <span>Copiar Caminho</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>

                            {/* Coluna 7: Operador */}
                            <td className="py-2.5 px-3 text-right font-medium text-slate-700 dark:text-slate-300">
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
      </div>

      {/* Footer com Botões de Ação (Impressão A4 / WhatsApp / Atualização) */}
      <div className="p-4 bg-slate-50 dark:bg-zinc-900 border-t border-slate-200 dark:border-white/10 rounded-b-2xl flex items-center justify-between flex-wrap gap-3 shrink-0">
        <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block font-medium">
          Pronto para emissão em papel <strong>A4</strong> ou envio no <strong>WhatsApp</strong> com tempo individual de cada chapa.
        </p>

        <div className="flex items-center gap-2.5 ml-auto">
          <button
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-white dark:bg-white/10 border border-slate-300 dark:border-white/15 text-slate-800 dark:text-white hover:border-orange-500 transition-all cursor-pointer shadow-sm active:scale-95"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
            <span>{copied ? 'Copiado para WhatsApp!' : 'Copiar Resumo'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md shadow-orange-500/20 transition-all cursor-pointer active:scale-95"
          >
            <Printer size={15} />
            <span>Imprimir / Salvar PDF (A4)</span>
          </button>
        </div>
      </div>
    </div>
  );

  // Se estiver em modo Modal, envolve com o Backdrop de Modal
  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-in fade-in">
        <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl max-w-6xl w-full flex flex-col overflow-hidden animate-in zoom-in-95">
          {content}
        </div>
      </div>
    );
  }

  // Modo Embutido (Aba do Operador)
  return (
    <div className="glass rounded-2xl border border-white/10 overflow-hidden">
      {content}
    </div>
  );
}
