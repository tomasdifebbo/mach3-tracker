import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, FileCode2, Clock, CheckCircle2, AlertCircle, RefreshCw,
  Search, Filter, Copy, Check, ExternalLink, ArrowRight, HardDrive,
  Cpu, Wrench, Sparkles, ChevronDown, ChevronRight, FolderCheck,
  FileSpreadsheet, Zap, Flame, ShieldAlert, Award, PlayCircle, Compass,
  FolderTree, Box, CheckSquare, Square
} from 'lucide-react';
import { api } from '../services/api';
import { CaixaChecklistProducao, isFileMarkedOk } from './CaixaChecklistProducao';

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(1)} ${units[idx]}`;
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return isoStr;
  }
}

function renderMaterialBadge(tag) {
  if (!tag) return null;
  const lower = tag.toLowerCase();
  let color = 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  if (lower.includes('compensado')) color = 'bg-yellow-500/15 text-yellow-500 border-yellow-500/30';
  else if (lower.includes('pvc')) color = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
  else if (lower.includes('isopor') || lower.includes('eps')) color = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  else if (lower.includes('acrilico')) color = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  else if (lower.includes('acm') || lower.includes('aluminio')) color = 'bg-purple-500/15 text-purple-400 border-purple-500/30';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border uppercase tracking-wider ${color}`}>
      {tag}
    </span>
  );
}

export function PipelineArquivosProducao({ jobs = [], routers = [] }) {
  const [pipelineData, setPipelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('lotes'); // start on active priorities / lotes
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJob, setSelectedJob] = useState('todos');
  const [selectedExt, setSelectedExt] = useState('todas');
  const [copiedPath, setCopiedPath] = useState(null);
  const [expandedJobs, setExpandedJobs] = useState({});

  // Checklist interativo para o operador dar OK nos arquivos concluídos
  const [fileChecklist, setFileChecklist] = useState(() => {
    try {
      const s = localStorage.getItem('mach3_pipeline_file_checklist_v1');
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  });

  const [cadCheckFilter, setCadCheckFilter] = useState('pendentes'); // 'pendentes' | 'concluidos' | 'todos'
  const [aspireCheckFilter, setAspireCheckFilter] = useState('pendentes'); // 'pendentes' | 'concluidos' | 'todos'
  const [routerCheckFilter, setRouterCheckFilter] = useState('pendentes'); // 'pendentes' | 'concluidos' | 'todos'
  const [stageToast, setStageToast] = useState(null);

  const getFileKey = (f) => f.fullPath || `${f.jobName || ''}_${f.name}`;

  const isFileChecked = (f) => {
    if (!f) return false;
    const k = getFileKey(f);
    return Boolean(fileChecklist[k] || fileChecklist[f.name] || f.isManuallyDone);
  };

  // Carrega e sincroniza arquivos concluídos do PostgreSQL de forma definitiva
  const syncCompletedFiles = async () => {
    try {
      const res = await api.getPipelineCompletedFiles();
      if (res && res.success && res.map) {
        setFileChecklist(prev => {
          const merged = { ...prev };
          Object.entries(res.map).forEach(([k, item]) => {
            if (item.done) {
              const entry = {
                checkedAt: item.completed_at || new Date().toISOString(),
                stage: item.stage || '',
                name: item.file_name || k,
                operator: item.operator_name || 'Tomas'
              };
              merged[k] = entry;
              if (item.file_name) merged[item.file_name] = entry;
            } else {
              delete merged[k];
              if (item.file_name) delete merged[item.file_name];
            }
          });
          try {
            localStorage.setItem('mach3_pipeline_file_checklist_v1', JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });

        // Migração automática de itens locais para o PostgreSQL caso ainda não estejam lá
        const localItems = [];
        try {
          const raw = localStorage.getItem('mach3_pipeline_file_checklist_v1');
          const parsed = raw ? JSON.parse(raw) : {};
          Object.entries(parsed).forEach(([key, val]) => {
            if (val && !res.map[key]) {
              localItems.push({
                file_key: key,
                file_name: val.name || key,
                stage: val.stage || '',
                done: true,
                operator_name: val.operator || 'Tomas'
              });
            }
          });
        } catch (e) {}

        if (localItems.length > 0) {
          api.bulkSyncPipelineCompleted(localItems).catch(() => {});
        }
      }
    } catch (err) {
      console.warn('Erro ao sincronizar arquivos concluídos com o banco:', err);
    }
  };

  const toggleFileCheck = async (f, stage = '') => {
    const key = getFileKey(f);
    const currentlyChecked = isFileChecked(f);
    const willBeChecked = !currentlyChecked;

    setFileChecklist(prev => {
      const next = { ...prev };
      if (willBeChecked) {
        const entry = {
          checkedAt: new Date().toISOString(),
          stage: stage,
          name: f.name,
          operator: 'Tomas'
        };
        next[key] = entry;
        next[f.name] = entry;
      } else {
        delete next[key];
        delete next[f.name];
      }
      try {
        localStorage.setItem('mach3_pipeline_file_checklist_v1', JSON.stringify(next));
      } catch (err) {}
      return next;
    });

    // Salva permanentemente no PostgreSQL para que nunca mais volte para a fila
    try {
      await api.togglePipelineCompleted({
        file_key: key,
        file_name: f.name,
        stage: stage,
        subfolder: f.subfolderName || null,
        job_name: f.jobName || null,
        done: willBeChecked,
        operator_name: 'Tomas'
      });
      // Invalida cache e recarrega na hora
      fetchPipeline(true);
    } catch (err) {
      console.warn('Erro ao persistir conclusão no PostgreSQL:', err);
    }

    if (willBeChecked) {
      let nextStageName = 'Próxima Etapa';
      if (stage === 'corel') nextStageName = '2. Materiais Aspire (.EPS / .DXF)';
      else if (stage === 'aspire') nextStageName = '3. Fila Router (.TXT)';
      else if (stage === 'router') nextStageName = '4. Já Feito (Histórico)';

      setStageToast({
        title: f.name,
        stageAtual: stage,
        nextStage: nextStageName
      });
      setTimeout(() => setStageToast(null), 3500);
    }
  };

  const fetchPipeline = async (force = false) => {
    setLoading(true);
    try {
      const data = await api.getArquivosProducao(force);
      if (data && !data.error) {
        setPipelineData(data);
      }
    } catch (err) {
      console.error('Erro ao carregar pipeline de arquivos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncCompletedFiles();
    fetchPipeline(false);
    const interval = setInterval(() => fetchPipeline(false), 4000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (pathStr) => {
    if (!pathStr) return;
    navigator.clipboard.writeText(pathStr);
    setCopiedPath(pathStr);
    setTimeout(() => setCopiedPath(null), 2000);
  };

  const toggleExpand = (name) => {
    setExpandedJobs(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const summary = pipelineData?.summary || { totalJobs: 0, totalCadPreparar: 0, totalAspirePreparar: 0, totalGcodePronto: 0, totalConcluidos: 0 };
  const allJobs = useMemo(() => pipelineData?.jobs || [], [pipelineData]);
  const specialBatches = useMemo(() => pipelineData?.specialBatches || [], [pipelineData]);

  const uniqueJobNames = useMemo(() => {
    return allJobs.map(j => j.name);
  }, [allJobs]);

  // Filtered CAD files (Corel .CDR)
  const filteredCad = useMemo(() => {
    const list = pipelineData?.cadPreparar || [];
    return list.filter(f => {
      if (selectedJob !== 'todos' && f.jobName !== selectedJob) return false;
      if (selectedExt !== 'todas' && f.ext !== selectedExt) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return f.name.toLowerCase().includes(s) || 
               (f.jobName && f.jobName.toLowerCase().includes(s)) ||
               (f.subfolderName && f.subfolderName.toLowerCase().includes(s)) ||
               (f.matInfo?.tag && f.matInfo.tag.toLowerCase().includes(s));
      }
      return true;
    });
  }, [pipelineData, selectedJob, selectedExt, searchTerm]);

  // Filtered Aspire Preparation Files (.EPS, .DXF)
  const filteredAspire = useMemo(() => {
    const rawList = [...(pipelineData?.aspirePreparar || [])];
    const list = rawList.filter(f => f.ext !== '.crv3d' && f.ext !== '.crv' && !(f.name || '').toLowerCase().endsWith('.crv3d') && !(f.name || '').toLowerCase().endsWith('.crv'));

    // Arquivos Corel que foram dados OK avançam para a etapa de Aspire!
    (pipelineData?.cadPreparar || []).forEach(cf => {
      const k = getFileKey(cf);
      if (fileChecklist[k]?.stage === 'corel') {
        if (!list.some(a => a.name === cf.name || a.name.includes(cf.name.replace('.cdr', '')))) {
          list.push({
            ...cf,
            ext: '.eps',
            type: 'aspire',
            promotedFromCorel: true,
            statusLabel: 'Avançado do Corel (Pronto p/ Aspire)'
          });
        }
      }
    });

    return list.filter(f => {
      if (selectedJob !== 'todos' && f.jobName !== selectedJob) return false;
      if (selectedExt !== 'todas' && f.ext !== selectedExt) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return f.name.toLowerCase().includes(s) || 
               (f.jobName && f.jobName.toLowerCase().includes(s)) ||
               (f.subfolderName && f.subfolderName.toLowerCase().includes(s)) ||
               (f.matInfo?.tag && f.matInfo.tag.toLowerCase().includes(s));
      }
      return true;
    });
  }, [pipelineData, fileChecklist, selectedJob, selectedExt, searchTerm]);

  // Filtered G-Codes (Fila Router)
  const filteredGcodes = useMemo(() => {
    const list = [...(pipelineData?.gcodeProntos || [])];

    // Arquivos de Aspire que foram dados OK avançam para a Fila Router!
    (pipelineData?.aspirePreparar || []).forEach(af => {
      const k = getFileKey(af);
      if (fileChecklist[k]?.stage === 'aspire') {
        if (!list.some(g => g.name === af.name || g.name.includes(af.name.replace(/\.[^.]+$/, '')))) {
          list.push({
            ...af,
            ext: '.txt',
            type: 'gcode',
            promotedFromAspire: true,
            statusLabel: 'Avançado do Aspire (Pronto p/ Router)'
          });
        }
      }
    });

    return list.filter(f => {
      if (selectedJob !== 'todos' && f.jobName !== selectedJob) return false;
      if (selectedExt !== 'todas' && f.ext !== selectedExt) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return f.name.toLowerCase().includes(s) || 
               (f.jobName && f.jobName.toLowerCase().includes(s)) ||
               (f.subfolderName && f.subfolderName.toLowerCase().includes(s)) ||
               (f.matInfo?.tag && f.matInfo.tag.toLowerCase().includes(s));
      }
      return true;
    });
  }, [pipelineData, fileChecklist, selectedJob, selectedExt, searchTerm]);

  // Filtered Concluded Executions (4. Já Feito / Histórico)
  const filteredDone = useMemo(() => {
    const list = [...(pipelineData?.gcodeFeitos || [])];

    // G-Codes que foram dados OK avançam para Concluídos / Histórico!
    (pipelineData?.gcodeProntos || []).forEach(gf => {
      const k = getFileKey(gf);
      const isOk = isFileChecked(gf) || gf.isExecuted || isFileMarkedOk(gf.name);
      if (isOk && !list.some(d => d.name === gf.name)) {
        list.push({
          ...gf,
          execCount: 1,
          lastExec: {
            operator_name: fileChecklist[k]?.operator || 'Tomas',
            machine_name: 'Router 2',
            start_time: fileChecklist[k]?.checkedAt || gf.mtimeDate || new Date().toISOString()
          },
          totalDurationMinutes: 15
        });
      }
    });

    return list.filter(f => {
      if (selectedJob !== 'todos' && f.jobName !== selectedJob) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return f.name.toLowerCase().includes(s) || 
               (f.jobName && f.jobName.toLowerCase().includes(s)) ||
               (f.lastExec?.operator_name && f.lastExec.operator_name.toLowerCase().includes(s));
      }
      return true;
    });
  }, [pipelineData, fileChecklist, selectedJob, searchTerm]);

  // Contadores e Listas para Checklist Interativo
  const cadCounts = useMemo(() => {
    let concluidos = 0;
    filteredCad.forEach(f => {
      if (isFileChecked(f)) concluidos++;
    });
    return {
      total: filteredCad.length,
      concluidos,
      pendentes: Math.max(0, filteredCad.length - concluidos)
    };
  }, [filteredCad, fileChecklist]);

  const displayedCad = useMemo(() => {
    return filteredCad.filter(f => {
      const isChecked = isFileChecked(f);
      if (cadCheckFilter === 'pendentes') return !isChecked;
      if (cadCheckFilter === 'concluidos') return isChecked;
      return true;
    });
  }, [filteredCad, fileChecklist, cadCheckFilter]);

  const aspireCounts = useMemo(() => {
    let concluidos = 0;
    filteredAspire.forEach(f => {
      if (isFileChecked(f) || (f.chapasCount > 0)) concluidos++;
    });
    return {
      total: filteredAspire.length,
      concluidos,
      pendentes: Math.max(0, filteredAspire.length - concluidos)
    };
  }, [filteredAspire, fileChecklist]);

  const displayedAspire = useMemo(() => {
    return filteredAspire.filter(f => {
      const isChecked = isFileChecked(f) || (f.chapasCount > 0);
      if (aspireCheckFilter === 'pendentes') return !isChecked;
      if (aspireCheckFilter === 'concluidos') return isChecked;
      return true;
    });
  }, [filteredAspire, fileChecklist, aspireCheckFilter]);

  const routerCounts = useMemo(() => {
    let concluidos = 0;
    filteredGcodes.forEach(f => {
      if (isFileChecked(f) || f.isExecuted || isFileMarkedOk(f.name)) concluidos++;
    });
    return {
      total: filteredGcodes.length,
      concluidos,
      pendentes: Math.max(0, filteredGcodes.length - concluidos)
    };
  }, [filteredGcodes, fileChecklist]);

  const displayedGcodes = useMemo(() => {
    return filteredGcodes.filter(f => {
      const isChecked = isFileChecked(f) || f.isExecuted || isFileMarkedOk(f.name);
      if (routerCheckFilter === 'pendentes') return !isChecked;
      if (routerCheckFilter === 'concluidos') return isChecked;
      return true;
    });
  }, [filteredGcodes, fileChecklist, routerCheckFilter]);

  // Filtered Jobs
  const filteredJobs = useMemo(() => {
    return allJobs.filter(j => {
      if (selectedJob !== 'todos' && j.name !== selectedJob) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return j.name.toLowerCase().includes(s);
      }
      return true;
    });
  }, [allJobs, selectedJob, searchTerm]);

  const getExtBadgeClass = (ext) => {
    switch (ext) {
      case '.cdr': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case '.eps': return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
      case '.dxf': return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30';
      case '.dwg': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case '.ai': return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case '.txt':
      case '.nc':
      case '.gcode':
      case '.tap': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case '.3mf':
      case '.stl': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case '.crv':
      case '.crv3d':
      case '.v3d': return 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30';
      default: return 'bg-white/10 text-white/70 border-white/20';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0c0d10] text-slate-900 dark:text-slate-100 p-2.5 md:p-3.5 gap-2.5">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-white/[0.03] py-2 px-3.5 rounded-xl border border-slate-200 dark:border-white/5 shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 text-orange-500 flex items-center justify-center shrink-0">
            <Layers size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm md:text-base font-black text-slate-900 dark:text-white leading-none">
                Pipeline de Arquivos & Produção
              </h1>
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                Corel (.CDR) ➔ Materiais (.EPS / .DXF) ➔ Lote Chapas Aspire ➔ Router (.TXT)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-text-muted hidden sm:block">
              {pipelineData?.updatedAt ? `Sincronizado ${formatDate(pipelineData.updatedAt)} · ` : ''}
              Lógica por pasta: CDR mestre gera arquivos por material, abertos no Aspire em lotes de chapas liberados para corte
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchPipeline(true)}
          disabled={loading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-orange-500 hover:text-orange-500 transition-all shrink-0 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin text-orange-500' : ''} />
          <span className="hidden sm:inline">{loading ? 'Escaneando...' : 'Atualizar'}</span>
        </button>
      </div>

      {/* KPI Cards Row - 5 cards covering all stages */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 shrink-0">
        {/* KPI 1 - Corel .CDR Mestre */}
        <div 
          onClick={() => setActiveTab('preparar')}
          className={`py-2 px-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'preparar'
              ? 'bg-amber-500/15 border-amber-500/60 shadow-sm'
              : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-amber-500/40'
          }`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">1. Corel (.CDR)</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-white">{summary.totalCadPreparar}</span>
              <span className="text-[11px] text-slate-500">desenhos</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
        </div>

        {/* KPI 2 - Preparação Aspire (.EPS / .DXF) */}
        <div 
          onClick={() => setActiveTab('aspire')}
          className={`py-2 px-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'aspire'
              ? 'bg-sky-500/15 border-sky-500/60 shadow-sm'
              : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-sky-500/40'
          }`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">2. Materiais Aspire</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-white">{summary.totalAspirePreparar || filteredAspire.length}</span>
              <span className="text-[11px] text-slate-500">vetores CAM</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <Compass size={16} />
          </div>
        </div>

        {/* KPI 3 - Pronto Router (Chapas Liberadas) */}
        <div 
          onClick={() => setActiveTab('fila_router')}
          className={`py-2 px-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'fila_router'
              ? 'bg-orange-500/15 border-orange-500/60 shadow-sm'
              : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-orange-500/40'
          }`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500">3. Chapas na Fila</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-white">{summary.totalGcodePronto}</span>
              <span className="text-[11px] text-slate-500">G-Codes (.txt)</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
            <Cpu size={16} />
          </div>
        </div>

        {/* KPI 4 - Já Feito */}
        <div 
          onClick={() => setActiveTab('concluidos')}
          className={`py-2 px-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'concluidos'
              ? 'bg-emerald-500/15 border-emerald-500/60 shadow-sm'
              : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-emerald-500/40'
          }`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">4. Já Usinado</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-white">{summary.totalConcluidos}</span>
              <span className="text-[11px] text-slate-500">execuções</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
        </div>

        {/* KPI 5 - Lotes Seriados */}
        <div 
          onClick={() => setActiveTab('lotes')}
          className={`py-2 px-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'lotes'
              ? 'bg-violet-500/15 border-violet-500/60 shadow-sm'
              : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-violet-500/40'
          }`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-400">Lotes Seriados</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-white">{specialBatches.length}</span>
              <span className="text-[11px] text-slate-500">metas ativas</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0">
            <Award size={16} />
          </div>
        </div>
      </div>

      {/* Tabs & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-white/[0.02] p-2 rounded-xl border border-slate-200 dark:border-white/5 shrink-0">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'preparar', label: '1. Corel (.CDR)', icon: Sparkles, count: cadCounts.pendentes, total: cadCounts.total },
            { id: 'aspire', label: '2. Materiais Aspire (.EPS / .DXF)', icon: Compass, count: aspireCounts.pendentes, total: aspireCounts.total },
            { id: 'fila_router', label: '3. Fila Router (.TXT)', icon: Cpu, count: routerCounts.pendentes, total: routerCounts.total },
            { id: 'lotes', label: 'Lotes Seriados', icon: Award, count: specialBatches.length },
            { id: 'concluidos', label: '4. Já Feito (Histórico)', icon: CheckCircle2, count: pipelineData?.gcodeFeitos?.length || summary.totalConcluidos },
            { id: 'checklist', label: 'Painel Geral', icon: CheckSquare, count: cadCounts.concluidos + aspireCounts.concluidos + routerCounts.concluidos },
            { id: 'visao_geral', label: 'Jobs', icon: FolderCheck, count: allJobs.length }
          ].map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  active
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-text-muted hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon size={12} />
                <span>{t.label}</span>
                <span className={`text-[10px] px-1.5 py-0.1 rounded font-black ${
                  active ? 'bg-black/20 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                }`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-1 max-w-md justify-end">
          <div className="relative flex-1 min-w-[130px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar arquivo, material, O.S..."
              className="w-full pl-7 pr-2.5 py-1 text-xs rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all placeholder:text-slate-400"
            />
          </div>

          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500 transition-all cursor-pointer max-w-[150px] truncate"
          >
            <option value="todos">Todos Serviços</option>
            {uniqueJobNames.map(j => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2.5" style={{ scrollbarWidth: 'thin' }}>
        {/* TAB: CAIXA DE CHECKLIST OFICIAL */}
        {activeTab === 'checklist' && (
          <div className="space-y-3">
            <CaixaChecklistProducao pipelineData={pipelineData} jobs={jobs} routers={routers} operatorName="Tomas" />
          </div>
        )}

        {/* TAB: LOTES SERIADOS & PRIORIDADES ATIVAS */}
        {activeTab === 'lotes' && (
          <div className="space-y-3">
            <CaixaChecklistProducao pipelineData={pipelineData} jobs={jobs} routers={routers} operatorName="Tomas" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {specialBatches.map(b => {
              const percent = b.targetSheets > 0 ? Math.round((b.doneSheets / b.targetSheets) * 100) : 0;
              return (
                <div
                  key={b.id}
                  className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 p-3.5 shadow-sm space-y-2.5 hover:border-orange-500/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-wider text-orange-500">
                        {b.job}
                      </span>
                      <h3 className="font-black text-sm text-slate-900 dark:text-white leading-tight truncate">
                        {b.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 font-mono truncate">
                        {b.file}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
                      b.status === "concluido"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : b.status === "em_andamento"
                        ? "bg-sky-500/20 text-sky-400 border border-sky-500/30 animate-pulse"
                        : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                    }`}>
                      {b.status === "concluido"
                        ? "100% CONCLUÍDO"
                        : b.status === "em_andamento"
                        ? `RODANDO (${b.pendingSheets} RESTANTE)`
                        : `${b.pendingSheets} FALTANTES`}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span className="text-slate-400">Progresso do Lote</span>
                      <span className="text-orange-400">{b.doneSheets} / {b.targetSheets} ({percent}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          percent >= 100 ? "bg-emerald-500" : percent > 40 ? "bg-orange-500" : "bg-sky-500"
                        }`}
                        style={{ width: `${Math.min(100, percent)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-100 dark:border-white/5">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Material</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">{b.material}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Ferramenta</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200 truncate block">{b.tool}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* TAB 1: ARQUIVOS COREL A PREPARAR (.CDR MESTRE) */}
        {activeTab === 'preparar' && (
          <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
            <div className="p-3 bg-amber-500/5 border-b border-slate-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/30">
                  Etapa CAD: Corel (.CDR)
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Dê <strong>OK</strong> nos arquivos conforme você for abrindo no Corel e salvando os materiais para o Aspire.
                </p>
              </div>

              {/* Filtros rápidos do checklist */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setCadCheckFilter('pendentes')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    cadCheckFilter === 'pendentes' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  ⏳ Pendentes na Etapa ({cadCounts.pendentes})
                </button>
                <button
                  type="button"
                  onClick={() => setCadCheckFilter('todos')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    cadCheckFilter === 'todos' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Todos ({cadCounts.total})
                </button>
                <button
                  type="button"
                  onClick={() => setCadCheckFilter('concluidos')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    cadCheckFilter === 'concluidos' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  ✓ Concluídos (Avançados: {cadCounts.concluidos})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-text-muted uppercase text-[9px] font-black tracking-wider border-b border-slate-200 dark:border-white/5">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">OK</th>
                    <th className="py-2.5 px-3">Ext</th>
                    <th className="py-2.5 px-3">Arquivo Corel</th>
                    <th className="py-2.5 px-3">Subpasta / O.S.</th>
                    <th className="py-2.5 px-3">Material Identificado</th>
                    <th className="py-2.5 px-3">Status do Fluxo</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {displayedCad.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        {cadCheckFilter === 'pendentes' ? (
                          <div className="flex flex-col items-center gap-1.5 py-4">
                            <CheckCircle2 size={32} className="text-emerald-500 opacity-80" />
                            <p className="font-bold text-slate-800 dark:text-slate-200">🎉 Nenhum arquivo pendente nesta etapa!</p>
                            <p className="text-[11px] text-slate-500">Todos os arquivos que você deu OK já avançaram para a etapa de Aspire.</p>
                          </div>
                        ) : 'Nenhum arquivo Corel (.cdr) encontrado para este filtro.'}
                      </td>
                    </tr>
                  ) : (
                    displayedCad.map((f, idx) => {
                      const key = getFileKey(f);
                      const isChecked = isFileChecked(f);
                      return (
                        <tr 
                          key={key || idx} 
                          className={`transition-colors ${
                            isChecked 
                              ? 'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.07]' 
                              : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleFileCheck(f, 'corel')}
                              className={`w-6 h-6 mx-auto rounded flex items-center justify-center transition-all ${
                                isChecked
                                  ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/20'
                                  : 'border-2 border-slate-300 dark:border-white/20 text-transparent hover:border-emerald-500 hover:text-emerald-500/40'
                              }`}
                              title={isChecked ? `Marcado como OK em ${formatDate(fileChecklist[key]?.checkedAt)} por Tomas - Clique para desmarcar` : 'Clique para marcar como OK (Concluído)'}
                            >
                              <Check size={13} className="stroke-[3]" />
                            </button>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-black border ${getExtBadgeClass(f.ext)}`}>
                              {f.ext}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <p className={`font-bold truncate max-w-sm transition-all ${
                              isChecked ? 'line-through text-emerald-700 dark:text-emerald-300 opacity-80' : 'text-slate-900 dark:text-white'
                            }`}>
                              {f.name}
                            </p>
                            <p className="text-[9px] text-slate-500 truncate max-w-md font-mono">{f.fullPath}</p>
                          </td>
                          <td className="py-2 px-3">
                            <p className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{f.subfolderName || 'Geral'}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{f.jobName}</p>
                          </td>
                          <td className="py-2 px-3">
                            {f.matInfo?.tag ? renderMaterialBadge(f.matInfo.tag) : (
                              f.detectedMaterials && f.detectedMaterials.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {f.detectedMaterials.map((m, i) => (
                                    <span key={i}>{renderMaterialBadge(m)}</span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">Mestre (Vários)</span>
                              )
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {isChecked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                <Check size={11} className="stroke-[3]" />
                                OK (Separado / Feito)
                              </span>
                            ) : f.stageStatus === 'lote_liberado' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                                {f.statusLabel || `Lote Liberado (${f.chapasCount} chapas)`}
                              </span>
                            ) : f.stageStatus === 'materiais_gerados' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                <span className="w-1 h-1 rounded-full bg-sky-400"></span>
                                {f.statusLabel || 'Separado em Materiais'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                                Aguardando Separar Materiais
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => handleCopy(f.fullPath)}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 dark:bg-white/5 hover:bg-orange-500 hover:text-white transition-all inline-flex items-center gap-1"
                              title="Copiar caminho"
                            >
                              {copiedPath === f.fullPath ? (
                                <>
                                  <Check size={11} className="text-emerald-400" />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: ARQUIVOS DE MATERIAIS PARA O ASPIRE (.EPS / .DXF) */}
        {activeTab === 'aspire' && (
          <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
            <div className="p-3 bg-sky-500/5 border-b border-slate-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  Etapa CAM: Aspire
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Dê <strong>OK</strong> quando você já tiver gerado o lote de chapas e salvo o arquivo no Aspire.
                </p>
              </div>

              {/* Filtros rápidos do checklist */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAspireCheckFilter('pendentes')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    aspireCheckFilter === 'pendentes' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  ⏳ Aguardando Aspire ({aspireCounts.pendentes})
                </button>
                <button
                  type="button"
                  onClick={() => setAspireCheckFilter('todos')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    aspireCheckFilter === 'todos' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Todos ({aspireCounts.total})
                </button>
                <button
                  type="button"
                  onClick={() => setAspireCheckFilter('concluidos')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    aspireCheckFilter === 'concluidos' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  ✓ Lotes Prontos (Avançados: {aspireCounts.concluidos})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-text-muted uppercase text-[9px] font-black tracking-wider border-b border-slate-200 dark:border-white/5">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">OK</th>
                    <th className="py-2.5 px-3">Ext</th>
                    <th className="py-2.5 px-3">Arquivo do Material</th>
                    <th className="py-2.5 px-3">Subpasta / O.S.</th>
                    <th className="py-2.5 px-3">Material & Espessura</th>
                    <th className="py-2.5 px-3">Chapas / Lote Gerado</th>
                    <th className="py-2.5 px-3">Status no Aspire</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {displayedAspire.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {aspireCheckFilter === 'pendentes' ? (
                          <div className="flex flex-col items-center gap-1.5 py-4">
                            <CheckCircle2 size={32} className="text-emerald-500 opacity-80" />
                            <p className="font-bold text-slate-800 dark:text-slate-200">🎉 Nenhum lote pendente no Aspire!</p>
                            <p className="text-[11px] text-slate-500">Todos os arquivos que você deu OK já avançaram para a 3. Fila Router (.TXT).</p>
                          </div>
                        ) : 'Nenhum arquivo vetorial (.eps / .dxf) encontrado para este filtro.'}
                      </td>
                    </tr>
                  ) : (
                    displayedAspire.map((f, idx) => {
                      const key = getFileKey(f);
                      const isChecked = isFileChecked(f) || (f.chapasCount > 0);
                      return (
                        <tr 
                          key={key || idx} 
                          className={`transition-colors ${
                            isChecked 
                              ? 'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.07]' 
                              : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleFileCheck(f, 'aspire')}
                              className={`w-6 h-6 mx-auto rounded flex items-center justify-center transition-all ${
                                isChecked
                                  ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/20'
                                  : 'border-2 border-slate-300 dark:border-white/20 text-transparent hover:border-emerald-500 hover:text-emerald-500/40'
                              }`}
                              title={isChecked ? `Marcado como OK em ${formatDate(fileChecklist[key]?.checkedAt)} - Clique para desmarcar` : 'Clique para marcar como Lote Salvo no Aspire (OK)'}
                            >
                              <Check size={13} className="stroke-[3]" />
                            </button>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-black border ${getExtBadgeClass(f.ext)}`}>
                              {f.ext}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <p className={`font-bold truncate max-w-sm transition-all ${
                              isChecked ? 'line-through text-emerald-700 dark:text-emerald-300 opacity-80' : 'text-slate-900 dark:text-white'
                            }`}>
                              {f.name}
                            </p>
                            <p className="text-[9px] text-slate-500 truncate max-w-md font-mono">{f.fullPath}</p>
                          </td>
                          <td className="py-2 px-3">
                            <p className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{f.subfolderName || 'Geral'}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{f.jobName}</p>
                          </td>
                          <td className="py-2 px-3">
                            {renderMaterialBadge(f.matInfo?.tag) || (
                              <span className="text-[10px] text-slate-400 italic">Identificando</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {f.chapasCount > 0 ? (
                              <span className="font-black text-emerald-400 text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                {f.chapasCount} chapas liberadas
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Nenhuma chapa ainda</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {isChecked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                <Check size={11} className="stroke-[3]" />
                                OK (Lote Aspire Salvo)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                <span className="w-1 h-1 rounded-full bg-sky-400 animate-pulse"></span>
                                Abrir no Aspire (Gerar Lote)
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => handleCopy(f.fullPath)}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 dark:bg-white/5 hover:bg-sky-500 hover:text-white transition-all inline-flex items-center gap-1"
                              title="Copiar caminho"
                            >
                              {copiedPath === f.fullPath ? (
                                <>
                                  <Check size={11} className="text-emerald-400" />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PRONTO PARA ROUTER (CHAPAS G-CODE LIBERADAS) */}
        {activeTab === 'fila_router' && (
          <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
            <div className="p-3 bg-orange-500/5 border-b border-slate-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-400 border border-orange-500/30">
                  Fila Router: G-Codes (.TXT)
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  ⚡ <strong>Baixa Automática:</strong> Conforme os arquivos rodam nas Routers (Mach3), o sistema detecta a conclusão automaticamente sem precisar de OK manual.
                </p>
              </div>

              {/* Filtros rápidos do checklist */}
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRouterCheckFilter('pendentes')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    routerCheckFilter === 'pendentes' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  ⏳ Fila da Máquina ({routerCounts.pendentes})
                </button>
                <button
                  type="button"
                  onClick={() => setRouterCheckFilter('todos')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    routerCheckFilter === 'todos' ? 'bg-orange-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  Todos ({routerCounts.total})
                </button>
                <button
                  type="button"
                  onClick={() => setRouterCheckFilter('concluidos')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                    routerCheckFilter === 'concluidos' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  ✓ Usinados (Avançados: {routerCounts.concluidos})
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-text-muted uppercase text-[9px] font-black tracking-wider border-b border-slate-200 dark:border-white/5">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12">OK</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Arquivo de Chapa (G-Code)</th>
                    <th className="py-2.5 px-3">Subpasta / O.S.</th>
                    <th className="py-2.5 px-3">Material Identificado</th>
                    <th className="py-2.5 px-3">Tamanho</th>
                    <th className="py-2.5 px-3">Status na Oficina</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {displayedGcodes.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        {routerCheckFilter === 'pendentes' ? (
                          <div className="flex flex-col items-center gap-1.5 py-4">
                            <CheckCircle2 size={32} className="text-emerald-500 opacity-80" />
                            <p className="font-bold text-slate-800 dark:text-slate-200">🎉 Fila de corte 100% em dia!</p>
                            <p className="text-[11px] text-slate-500">Todas as chapas usinadas e dadas baixa avançaram para 4. Já Feito (Histórico).</p>
                          </div>
                        ) : 'Nenhum arquivo G-Code recente encontrado para este filtro.'}
                      </td>
                    </tr>
                  ) : (
                    displayedGcodes.map((f, idx) => {
                      const key = getFileKey(f);
                      const isChecked = isFileChecked(f) || f.isExecuted || isFileMarkedOk(f.name);
                      return (
                        <tr 
                          key={key || idx} 
                          className={`transition-colors ${
                            isChecked 
                              ? 'bg-emerald-500/[0.04] dark:bg-emerald-500/[0.07]' 
                              : 'hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                          }`}
                        >
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleFileCheck(f, 'router')}
                              className={`w-6 h-6 mx-auto rounded flex items-center justify-center transition-all ${
                                isChecked
                                  ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-500/20'
                                  : 'border-2 border-slate-300 dark:border-white/20 text-transparent hover:border-emerald-500 hover:text-emerald-500/40'
                              }`}
                              title={isChecked ? `Marcado como Usinado - Clique para desmarcar` : 'Clique para marcar como Usinado (OK)'}
                            >
                              <Check size={13} className="stroke-[3]" />
                            </button>
                          </td>
                          <td className="py-2 px-3">
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">
                              {f.ext}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <p className={`font-bold truncate max-w-sm transition-all ${
                              isChecked ? 'line-through text-emerald-700 dark:text-emerald-300 opacity-80' : 'text-slate-900 dark:text-white'
                            }`}>
                              {f.name}
                            </p>
                            <p className="text-[9px] text-slate-500 truncate max-w-md font-mono">{f.fullPath}</p>
                          </td>
                          <td className="py-2 px-3">
                            <p className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{f.subfolderName || 'Geral'}</p>
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{f.jobName}</p>
                          </td>
                          <td className="py-2 px-3">
                            {renderMaterialBadge(f.matInfo?.tag) || (
                              <span className="text-[10px] text-slate-400 italic">-</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                            {formatBytes(f.size)}
                          </td>
                          <td className="py-2 px-3">
                            {isChecked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                <Check size={11} className="stroke-[3]" />
                                OK (Chapa Usinada)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                                <span className="w-1 h-1 rounded-full bg-orange-500 animate-pulse"></span>
                                Pronto p/ Usinar na Router
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              onClick={() => handleCopy(f.fullPath)}
                              className="px-2 py-1 rounded text-[10px] font-bold bg-slate-100 dark:bg-white/5 hover:bg-orange-500 hover:text-white transition-all inline-flex items-center gap-1"
                              title="Copiar caminho"
                            >
                              {copiedPath === f.fullPath ? (
                                <>
                                  <Check size={11} className="text-emerald-400" />
                                  <span>Copiado</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: JÁ FEITO (HISTÓRICO DE USINAGEM) */}
        {activeTab === 'concluidos' && (
          <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-text-muted uppercase text-[9px] font-black tracking-wider border-b border-slate-200 dark:border-white/5">
                  <tr>
                    <th className="py-2.5 px-3">Arquivo Usinado</th>
                    <th className="py-2.5 px-3">Subpasta / O.S.</th>
                    <th className="py-2.5 px-3">Material</th>
                    <th className="py-2.5 px-3">Máquina</th>
                    <th className="py-2.5 px-3">Operador</th>
                    <th className="py-2.5 px-3">Vezes</th>
                    <th className="py-2.5 px-3">Duração</th>
                    <th className="py-2.5 px-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredDone.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        Nenhum arquivo executado encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredDone.map((d, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 px-3">
                          <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1 truncate max-w-sm">
                            <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                            <span className="truncate">{d.name}</span>
                          </p>
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[140px]">
                          {d.subfolderName || d.jobName}
                        </td>
                        <td className="py-2 px-3">
                          {renderMaterialBadge(d.matInfo?.tag) || '-'}
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-white/10 text-slate-200 border border-white/10">
                            {d.lastExec?.router_name || 'Router'}
                          </span>
                        </td>
                        <td className="py-2 px-3 capitalize font-semibold text-orange-500 text-[11px]">
                          {d.lastExec?.operator_name || 'Tomas'}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-black text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            {d.execCount}x
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-300 text-[11px]">
                          {Math.round(d.totalDurationMinutes || 0)} min
                        </td>
                        <td className="py-2 px-3 text-slate-400 text-[10px]">
                          {formatDate(d.lastExec?.start_time)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: VISÃO GERAL DOS JOBS */}
        {activeTab === 'visao_geral' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredJobs.map(j => {
              return (
                <div
                  key={j.name}
                  className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 p-3 hover:border-orange-500/30 transition-all shadow-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-wider text-orange-500 truncate block">
                        {j.source || '3 - OFICINA'}
                      </span>
                      <h3 className="font-black text-xs text-slate-900 dark:text-white truncate" title={j.name}>
                        {j.name}
                      </h3>
                    </div>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 shrink-0">
                      {j.progressPercent}%
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-white/10 h-1.5 rounded-full overflow-hidden flex">
                    <div className="bg-emerald-500 h-full" style={{ width: `${j.progressPercent}%` }} />
                    <div className="bg-orange-500 h-full" style={{ width: `${(j.gcodeProntoCount / Math.max(1, j.cadCount + (j.aspireCount || 0) + j.gcodeCount)) * 100}%` }} />
                    <div className="bg-sky-500 h-full" style={{ width: `${((j.aspirePrepararCount || 0) / Math.max(1, j.cadCount + (j.aspireCount || 0) + j.gcodeCount)) * 100}%` }} />
                    <div className="bg-amber-500 h-full" style={{ width: `${(j.cadPrepararCount / Math.max(1, j.cadCount + (j.aspireCount || 0) + j.gcodeCount)) * 100}%` }} />
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                    <div className="p-1 rounded bg-amber-500/10">
                      <span className="text-amber-500 font-bold block">1. Corel</span>
                      <span className="font-black text-amber-400">{j.cadPrepararCount}</span>
                    </div>
                    <div className="p-1 rounded bg-sky-500/10">
                      <span className="text-sky-400 font-bold block">2. Aspire</span>
                      <span className="font-black text-sky-400">{j.aspirePrepararCount || 0}</span>
                    </div>
                    <div className="p-1 rounded bg-orange-500/10">
                      <span className="text-orange-500 font-bold block">3. Router</span>
                      <span className="font-black text-orange-400">{j.gcodeProntoCount}</span>
                    </div>
                    <div className="p-1 rounded bg-emerald-500/10">
                      <span className="text-emerald-500 font-bold block">4. Feito</span>
                      <span className="font-black text-emerald-400">{j.gcodeFeitoCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast flutuante de avanço de etapa: Some da lista e vai pra próxima! */}
      {stageToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 dark:bg-black/95 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-500/50 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/30">
            <Check size={18} className="stroke-[3]" />
          </div>
          <div>
            <p className="text-xs font-black text-emerald-400">✓ Concluído e Avançado!</p>
            <p className="text-[11px] text-slate-300">
              <strong className="text-white truncate max-w-[200px] inline-block align-bottom">{stageToast.title}</strong> saiu da lista e avançou para <span className="text-orange-400 font-bold underline">{stageToast.nextStage}</span>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
