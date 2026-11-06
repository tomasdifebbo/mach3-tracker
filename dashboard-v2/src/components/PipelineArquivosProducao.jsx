import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, FileCode2, Clock, CheckCircle2, AlertCircle, RefreshCw,
  Search, Filter, Copy, Check, ExternalLink, ArrowRight, HardDrive,
  Cpu, Wrench, Sparkles, ChevronDown, ChevronRight, FolderCheck,
  FileSpreadsheet, Zap, Flame, ShieldAlert, Award, PlayCircle, Compass,
  FolderTree, Box, CheckSquare
} from 'lucide-react';
import { api } from '../services/api';
import { CaixaChecklistProducao } from './CaixaChecklistProducao';

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
    fetchPipeline(false);
    const interval = setInterval(() => fetchPipeline(false), 10000);
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

  // Filtered Aspire Preparation Files (.EPS, .DXF, .CRV, .CRV3D)
  const filteredAspire = useMemo(() => {
    const list = pipelineData?.aspirePreparar || [];
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

  // Filtered G-Codes
  const filteredGcodes = useMemo(() => {
    const list = pipelineData?.gcodeProntos || [];
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

  // Filtered Concluded Executions
  const filteredDone = useMemo(() => {
    const list = pipelineData?.gcodeFeitos || [];
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
  }, [pipelineData, selectedJob, searchTerm]);

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
            { id: 'lotes', label: 'Lotes Seriados', icon: Award, count: specialBatches.length },
            { id: 'checklist', label: 'Caixa de Checklist', icon: CheckSquare, count: 20 },
            { id: 'preparar', label: '1. Corel (.CDR)', icon: Sparkles, count: pipelineData?.cadPreparar?.length || summary.totalCadPreparar },
            { id: 'aspire', label: '2. Materiais Aspire (.EPS / .DXF)', icon: Compass, count: pipelineData?.aspirePreparar?.length || summary.totalAspirePreparar || filteredAspire.length },
            { id: 'fila_router', label: '3. Fila Router (.TXT)', icon: Cpu, count: pipelineData?.gcodeProntos?.length || summary.totalGcodePronto },
            { id: 'concluidos', label: '4. Já Feito (Histórico)', icon: CheckCircle2, count: pipelineData?.gcodeFeitos?.length || summary.totalConcluidos },
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
            <CaixaChecklistProducao operatorName="Tomas" />
          </div>
        )}

        {/* TAB: LOTES SERIADOS & PRIORIDADES ATIVAS */}
        {activeTab === 'lotes' && (
          <div className="space-y-3">
            <CaixaChecklistProducao operatorName="Tomas" />
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
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-text-muted uppercase text-[9px] font-black tracking-wider border-b border-slate-200 dark:border-white/5">
                  <tr>
                    <th className="py-2.5 px-3">Ext</th>
                    <th className="py-2.5 px-3">Arquivo Corel</th>
                    <th className="py-2.5 px-3">Subpasta / O.S.</th>
                    <th className="py-2.5 px-3">Material Identificado</th>
                    <th className="py-2.5 px-3">Status do Fluxo</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredCad.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhum arquivo Corel (.cdr) pendente encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredCad.map((f, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-black border ${getExtBadgeClass(f.ext)}`}>
                            {f.ext}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <p className="font-bold text-slate-900 dark:text-white truncate max-w-sm">{f.name}</p>
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
                          {f.stageStatus === 'lote_liberado' ? (
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: ARQUIVOS DE MATERIAIS PARA O ASPIRE (.EPS / .DXF / .CRV3D) */}
        {activeTab === 'aspire' && (
          <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
            <div className="p-3 bg-sky-500/5 border-b border-slate-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  Etapa CAM: Aspire
                </span>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Arquivos separados por material (<strong>MDF, Compensado, PVC, etc.</strong>) prontos para abrir no Aspire, montar o aproveitamento de chapas (Lote) e salvar o G-Code.
                </p>
              </div>
              <span className="text-xs font-bold text-sky-400 font-mono">
                {filteredAspire.length} arquivo(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-text-muted uppercase text-[9px] font-black tracking-wider border-b border-slate-200 dark:border-white/5">
                  <tr>
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
                  {filteredAspire.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Nenhum arquivo vetorial (.eps / .dxf) aguardando percurso no Aspire no momento.
                      </td>
                    </tr>
                  ) : (
                    filteredAspire.map((f, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.2 rounded text-[9px] font-black border ${getExtBadgeClass(f.ext)}`}>
                            {f.ext}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <p className="font-bold text-slate-900 dark:text-white truncate max-w-sm">{f.name}</p>
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
                          {f.chapasCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              <span className="w-1 h-1 rounded-full bg-emerald-400"></span>
                              Lote Liberado p/ Router
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
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: PRONTO PARA ROUTER (CHAPAS G-CODE LIBERADAS) */}
        {activeTab === 'fila_router' && (
          <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-text-muted uppercase text-[9px] font-black tracking-wider border-b border-slate-200 dark:border-white/5">
                  <tr>
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
                  {filteredGcodes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Nenhum arquivo G-Code recente aguardando máquina encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredGcodes.map((f, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-2 px-3">
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            {f.ext}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <p className="font-bold text-slate-900 dark:text-white truncate max-w-sm">{f.name}</p>
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                            <span className="w-1 h-1 rounded-full bg-orange-500 animate-pulse"></span>
                            Pronto p/ Usinar na Router
                          </span>
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
                    ))
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
    </div>
  );
}
