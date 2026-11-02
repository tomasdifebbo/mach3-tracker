import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers, FileCode2, Clock, CheckCircle2, AlertCircle, RefreshCw,
  Search, Filter, Copy, Check, ExternalLink, ArrowRight, HardDrive,
  Cpu, Wrench, Sparkles, ChevronDown, ChevronRight, FolderCheck,
  FileSpreadsheet, Zap, Flame, ShieldAlert, Award, PlayCircle
} from 'lucide-react';
import { api } from '../services/api';

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

export function PipelineArquivosProducao({ jobs = [], routers = [] }) {
  const [pipelineData, setPipelineData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('visao_geral'); // 'visao_geral' | 'preparar' | 'fila_router' | 'concluidos' | 'lotes'
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
    const interval = setInterval(() => fetchPipeline(false), 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCopy = (pathStr) => {
    if (!pathStr) return;
    navigator.clipboard.writeText(pathStr);
    setCopiedPath(pathStr);
    setTimeout(() => setCopiedPath(null), 2500);
  };

  const toggleExpand = (name) => {
    setExpandedJobs(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const summary = pipelineData?.summary || { totalJobs: 0, totalCadPreparar: 0, totalGcodePronto: 0, totalConcluidos: 0 };
  const allJobs = useMemo(() => pipelineData?.jobs || [], [pipelineData]);
  const specialBatches = useMemo(() => pipelineData?.specialBatches || [], [pipelineData]);

  const uniqueJobNames = useMemo(() => {
    return allJobs.map(j => j.name);
  }, [allJobs]);

  // Filtered CAD files
  const filteredCad = useMemo(() => {
    const list = pipelineData?.cadPreparar || [];
    return list.filter(f => {
      if (selectedJob !== 'todos' && f.jobName !== selectedJob) return false;
      if (selectedExt !== 'todas' && f.ext !== selectedExt) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return f.name.toLowerCase().includes(s) || (f.jobName && f.jobName.toLowerCase().includes(s));
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
        return f.name.toLowerCase().includes(s) || (f.jobName && f.jobName.toLowerCase().includes(s));
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
        return f.name.toLowerCase().includes(s) || (f.jobName && f.jobName.toLowerCase().includes(s)) ||
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
      case '.cdr': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case '.eps': return 'bg-sky-500/20 text-sky-400 border-sky-500/30';
      case '.dxf':
      case '.dwg': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case '.ai': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case '.txt':
      case '.nc':
      case '.gcode': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case '.3mf':
      case '.stl': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case '.crv3d':
      case '.v3d': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      default: return 'bg-white/10 text-white/70 border-white/20';
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0c0d10] text-slate-900 dark:text-slate-100 p-4 md:p-6 gap-5">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-white/[0.03] p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
              Fluxo Industrial CAD ➔ CAM ➔ CNC
            </span>
            <span className="text-xs text-slate-500 dark:text-text-muted">
              {pipelineData?.updatedAt ? `Sincronizado ${formatDate(pipelineData.updatedAt)}` : ''}
            </span>
          </div>
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <Layers className="text-orange-500" size={26} />
            Pipeline de Arquivos & Produção
          </h1>
          <p className="text-xs text-slate-600 dark:text-text-muted">
            Separação clara: arquivos vetoriais a preparar (.cdr, .eps, .dxf, .ai), G-codes para rodar na router e histórico de usinagens concluídas por serviço liberado.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchPipeline(true)}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:border-orange-500/50 hover:text-orange-500 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-orange-500' : ''} />
            <span>{loading ? 'Escaneando Pastas...' : 'Atualizar / Sincronizar'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div 
          onClick={() => setActiveTab('preparar')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
            activeTab === 'preparar'
              ? 'bg-amber-500/10 border-amber-500/50 shadow-lg shadow-amber-500/10'
              : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">1. A Preparar (CAD/CAM)</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{summary.totalCadPreparar}</span>
            <span className="text-xs text-slate-500">vetoriais</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-text-muted mt-1 truncate">
            .cdr · .eps · .dxf · .ai · .3mf
          </p>
        </div>

        <div 
          onClick={() => setActiveTab('fila_router')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
            activeTab === 'fila_router'
              ? 'bg-orange-500/10 border-orange-500/50 shadow-lg shadow-orange-500/10'
              : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-orange-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 dark:text-orange-400">2. Pronto para Router</span>
            <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-500 flex items-center justify-center">
              <Cpu size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{summary.totalGcodePronto}</span>
            <span className="text-xs text-slate-500">G-Codes na fila</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-text-muted mt-1 truncate">
            .txt · .nc prontos para corte
          </p>
        </div>

        <div 
          onClick={() => setActiveTab('concluidos')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
            activeTab === 'concluidos'
              ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
              : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-emerald-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">3. Já Feito / Concluído</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{summary.totalConcluidos}</span>
            <span className="text-xs text-slate-500">peças usinadas</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-text-muted mt-1 truncate">
            Histórico das Routers 1 e 2
          </p>
        </div>

        <div 
          onClick={() => setActiveTab('lotes')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
            activeTab === 'lotes'
              ? 'bg-sky-500/10 border-sky-500/50 shadow-lg shadow-sky-500/10'
              : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-sky-500/30'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-sky-400">Lotes & Prioridades</span>
            <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-500 flex items-center justify-center">
              <Award size={16} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{specialBatches.length}</span>
            <span className="text-xs text-slate-500">lotes monitorados</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-text-muted mt-1 truncate">
            Tijolos 50, Compensado 9, Pinguins
          </p>
        </div>
      </div>

      {/* Navigation Sub-Tabs & Filters Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-white/[0.02] p-3 rounded-2xl border border-slate-200 dark:border-white/5">
        {/* Sub-tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          {[
            { id: 'visao_geral', label: 'Visão Geral dos Jobs', icon: FolderCheck, count: allJobs.length },
            { id: 'preparar', label: 'A Preparar (CAD/CAM)', icon: Sparkles, count: pipelineData?.cadPreparar?.length || 0 },
            { id: 'fila_router', label: 'Pronto p/ Router (G-Code)', icon: Cpu, count: pipelineData?.gcodeProntos?.length || 0 },
            { id: 'concluidos', label: 'Já Feito (Histórico)', icon: CheckCircle2, count: pipelineData?.gcodeFeitos?.length || 0 },
            { id: 'lotes', label: 'Lotes Seriados', icon: Award, count: specialBatches.length }
          ].map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-text-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10'
                }`}
              >
                <Icon size={14} />
                <span>{t.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  active ? 'bg-black/20 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300'
                }`}>
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Job Filter Dropdowns */}
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
          <div className="relative flex-1 md:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar arquivo, O.S., peça..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-all placeholder:text-slate-400"
            />
          </div>

          <select
            value={selectedJob}
            onChange={(e) => setSelectedJob(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500 transition-all cursor-pointer max-w-[180px]"
          >
            <option value="todos">Todos os Serviços</option>
            {uniqueJobNames.map(j => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>

          {(activeTab === 'preparar' || activeTab === 'fila_router') && (
            <select
              value={selectedExt}
              onChange={(e) => setSelectedExt(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500 transition-all cursor-pointer"
            >
              <option value="todas">Todas Extensões</option>
              {activeTab === 'preparar' ? (
                <>
                  <option value=".cdr">.cdr (CorelDraw)</option>
                  <option value=".eps">.eps (Vetor EPS)</option>
                  <option value=".dxf">.dxf (AutoCAD)</option>
                  <option value=".ai">.ai (Illustrator)</option>
                  <option value=".crv3d">.crv3d (Aspire 3D)</option>
                  <option value=".v3d">.v3d (VCarve)</option>
                  <option value=".stl">.stl (Malha 3D)</option>
                  <option value=".3mf">.3mf (Objeto 3D)</option>
                </>
              ) : (
                <>
                  <option value=".txt">.txt (G-Code Mach3)</option>
                  <option value=".nc">.nc (G-Code NC)</option>
                  <option value=".gcode">.gcode</option>
                </>
              )}
            </select>
          )}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        {/* TAB 1: VISÃO GERAL DOS JOBS */}
        {activeTab === 'visao_geral' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredJobs.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-400">
                <Layers className="mx-auto mb-3 opacity-30" size={40} />
                <p className="text-sm font-bold">Nenhum serviço liberado encontrado com os filtros selecionados.</p>
              </div>
            ) : (
              filteredJobs.map(j => {
                const isExpanded = expandedJobs[j.name];
                return (
                  <div
                    key={j.name}
                    className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-200 dark:border-white/5 hover:border-orange-500/30 p-4 transition-all shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      {/* Job Header */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-orange-500 dark:text-orange-400">
                            {j.source || '3 - OFICINA'}
                          </span>
                          <h3 className="font-black text-sm text-slate-900 dark:text-white line-clamp-1" title={j.name}>
                            {j.name}
                          </h3>
                        </div>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-lg shrink-0 ${
                          j.progressPercent === 100 
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : j.progressPercent > 50
                            ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {j.progressPercent}% Feito
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-100 dark:bg-white/10 h-2 rounded-full overflow-hidden flex mb-3">
                        <div 
                          className="bg-emerald-500 h-full transition-all" 
                          style={{ width: `${j.progressPercent}%` }} 
                          title={`Concluído: ${j.gcodeFeitoCount}`}
                        />
                        <div 
                          className="bg-orange-500 h-full transition-all" 
                          style={{ width: `${(j.gcodeProntoCount / Math.max(1, j.cadCount + j.gcodeCount)) * 100}%` }}
                          title={`Pronto p/ Router: ${j.gcodeProntoCount}`}
                        />
                        <div 
                          className="bg-amber-500 h-full transition-all" 
                          style={{ width: `${(j.cadPrepararCount / Math.max(1, j.cadCount + j.gcodeCount)) * 100}%` }}
                          title={`A Preparar: ${j.cadPrepararCount}`}
                        />
                      </div>

                      {/* 3 Metric Pills */}
                      <div className="grid grid-cols-3 gap-1.5 text-center mb-3">
                        <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                          <p className="text-[9px] uppercase font-bold text-amber-600 dark:text-amber-400">A Preparar</p>
                          <p className="text-sm font-black text-amber-700 dark:text-amber-300">{j.cadPrepararCount}</p>
                        </div>
                        <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
                          <p className="text-[9px] uppercase font-bold text-orange-600 dark:text-orange-400">Pronto CNC</p>
                          <p className="text-sm font-black text-orange-700 dark:text-orange-300">{j.gcodeProntoCount}</p>
                        </div>
                        <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                          <p className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400">Concluído</p>
                          <p className="text-sm font-black text-emerald-700 dark:text-emerald-300">{j.gcodeFeitoCount}</p>
                        </div>
                      </div>
                    </div>

                    {/* Expand Footer */}
                    <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">{j.totalFiles} arquivos totais</span>
                      <button
                        onClick={() => toggleExpand(j.name)}
                        className="text-xs font-bold text-orange-500 hover:text-orange-400 flex items-center gap-1 transition-colors"
                      >
                        <span>{isExpanded ? 'Recolher' : 'Ver Arquivos'}</span>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/10 space-y-2">
                        {j.cadPrepararCount > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-amber-500 uppercase mb-1">Vetoriais a Preparar (Aspire/Corel):</p>
                            <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                              {j.cadPreparar?.slice(0, 5).map(cf => (
                                <li key={cf.name} className="flex items-center justify-between">
                                  <span className="truncate pr-2">· {cf.name}</span>
                                  <span className="text-[10px] font-mono shrink-0 px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400">{cf.ext}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {j.gcodeProntoCount > 0 && (
                          <div>
                            <p className="text-[10px] font-bold text-orange-500 uppercase mb-1">G-Codes Prontos pra Rodar:</p>
                            <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                              {j.gcodeProntos?.slice(0, 5).map(gf => (
                                <li key={gf.name} className="flex items-center justify-between">
                                  <span className="truncate pr-2">· {gf.name}</span>
                                  <span className="text-[10px] text-slate-500 shrink-0">{formatBytes(gf.size)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: ARQUIVOS A PREPARAR (CAD/CAM) */}
        {activeTab === 'preparar' && (
          <div className="space-y-3">
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Arquivos Vetoriais & CAD Aguardando Preparação CAM</h4>
                  <p className="text-xs text-slate-600 dark:text-text-muted">
                    Estes arquivos foram liberados pela engenharia/criação e precisam ser abertos no Aspire / VCarve / Corel para gerar os percursos de corte e salvar o G-Code.
                  </p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-amber-500 text-white shrink-0">
                {filteredCad.length} Arquivos
              </span>
            </div>

            <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-text-muted uppercase text-[10px] font-black tracking-wider border-b border-slate-200 dark:border-white/5">
                    <tr>
                      <th className="py-3 px-4">Ext</th>
                      <th className="py-3 px-4">Nome do Arquivo</th>
                      <th className="py-3 px-4">Serviço / O.S.</th>
                      <th className="py-3 px-4">Tamanho</th>
                      <th className="py-3 px-4">Status CAM</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredCad.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Nenhum arquivo vetorial a preparar encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredCad.map((f, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${getExtBadgeClass(f.ext)}`}>
                              {f.ext}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900 dark:text-white">{f.name}</p>
                            <p className="text-[10px] text-slate-500 truncate max-w-md font-mono">{f.fullPath}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{f.jobName}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {formatBytes(f.size)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Aguardando Aspire/CAM
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleCopy(f.fullPath)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-white/5 hover:bg-orange-500 hover:text-white transition-all flex items-center gap-1.5 ml-auto"
                              title="Copiar caminho do arquivo"
                            >
                              {copiedPath === f.fullPath ? (
                                <>
                                  <Check size={12} className="text-emerald-400" />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copiar Caminho</span>
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
          </div>
        )}

        {/* TAB 3: PRONTO PARA ROUTER (G-CODES NA FILA) */}
        {activeTab === 'fila_router' && (
          <div className="space-y-3">
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0">
                  <Cpu size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Fila de G-Codes Prontos para Usinagem nas Routers CNC</h4>
                  <p className="text-xs text-slate-600 dark:text-text-muted">
                    Arquivos .txt e .nc pós-processados que estão liberados na pasta e aguardando serem colocados nas máquinas CNC para corte.
                  </p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-orange-500 text-white shrink-0">
                {filteredGcodes.length} Na Fila
              </span>
            </div>

            <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-text-muted uppercase text-[10px] font-black tracking-wider border-b border-slate-200 dark:border-white/5">
                    <tr>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4">Nome do Arquivo G-Code</th>
                      <th className="py-3 px-4">Serviço / O.S.</th>
                      <th className="py-3 px-4">Tamanho</th>
                      <th className="py-3 px-4">Status Máquina</th>
                      <th className="py-3 px-4 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredGcodes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400">
                          Nenhum arquivo G-Code aguardando máquina encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredGcodes.map((f, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-orange-500/20 text-orange-400 border border-orange-500/30">
                              {f.ext}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900 dark:text-white">{f.name}</p>
                            <p className="text-[10px] text-slate-500 truncate max-w-md font-mono">{f.fullPath}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{f.jobName}</span>
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">
                            {formatBytes(f.size)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
                              Pronto para Colocar na Router
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleCopy(f.fullPath)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-white/5 hover:bg-orange-500 hover:text-white transition-all flex items-center gap-1.5 ml-auto"
                              title="Copiar caminho do arquivo"
                            >
                              {copiedPath === f.fullPath ? (
                                <>
                                  <Check size={12} className="text-emerald-400" />
                                  <span>Copiado!</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={12} />
                                  <span>Copiar Caminho</span>
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
          </div>
        )}

        {/* TAB 4: JÁ FEITO (HISTÓRICO DE USINAGEM) */}
        {activeTab === 'concluidos' && (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Arquivos Usinados e Concluídos nas Routers CNC</h4>
                  <p className="text-xs text-slate-600 dark:text-text-muted">
                    Histórico real consolidado do banco de dados com máquina onde rodou, operador, duração real e data de execução.
                  </p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-emerald-500 text-white shrink-0">
                {filteredDone.length} Usinagens Registradas
              </span>
            </div>

            <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-text-muted uppercase text-[10px] font-black tracking-wider border-b border-slate-200 dark:border-white/5">
                    <tr>
                      <th className="py-3 px-4">Arquivo G-Code</th>
                      <th className="py-3 px-4">Serviço / O.S.</th>
                      <th className="py-3 px-4">Máquina</th>
                      <th className="py-3 px-4">Operador</th>
                      <th className="py-3 px-4">Repetições</th>
                      <th className="py-3 px-4">Duração Real</th>
                      <th className="py-3 px-4">Última Execução</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {filteredDone.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          Nenhum arquivo executado encontrado com os filtros selecionados.
                        </td>
                      </tr>
                    ) : (
                      filteredDone.map((d, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <CheckCircle2 size={13} className="text-emerald-400" />
                              {d.name}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate max-w-sm font-mono">{d.fullPath}</p>
                          </td>
                          <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                            {d.jobName}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/10 text-slate-200 border border-white/10">
                              {d.lastExec?.router_name || 'Router CNC'}
                            </span>
                          </td>
                          <td className="py-3 px-4 capitalize font-semibold text-orange-500">
                            {d.lastExec?.operator_name || 'Tomas'}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-black text-xs px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              {d.execCount}x rodado
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-300">
                            {Math.round(d.totalDurationMinutes || 0)} min
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {formatDate(d.lastExec?.start_time)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: LOTES SERIADOS & PRIORIDADES ATIVAS */}
        {activeTab === 'lotes' && (
          <div className="space-y-4">
            <div className="bg-sky-500/10 border border-sky-500/20 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-500 flex items-center justify-center shrink-0">
                  <Award size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">Lotes Seriados, Peças Faltantes e Prioridades Ativas</h4>
                  <p className="text-xs text-slate-600 dark:text-text-muted">
                    Controle de metas de chapas seriadas, peças avulsas de MDF 9mm/15mm e blocos de isopor com acompanhamento de progresso em tempo real.
                  </p>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1.5 rounded-xl bg-sky-500 text-white shrink-0">
                {specialBatches.length} Lotes Monitorados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {specialBatches.map(b => {
                const percent = b.targetSheets > 0 ? Math.round((b.doneSheets / b.targetSheets) * 100) : 0;
                return (
                  <div
                    key={b.id}
                    className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-200 dark:border-white/5 p-5 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-orange-500">
                          {b.job}
                        </span>
                        <h3 className="font-black text-base text-slate-900 dark:text-white">
                          {b.name}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-text-muted font-mono mt-0.5">
                          {b.file}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-xl text-xs font-black shrink-0 ${
                        b.status === 'concluido'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                      }`}>
                        {b.status === 'concluido' ? '100% CONCLUÍDO' : `${b.pendingSheets} FALTANTES`}
                      </span>
                    </div>

                    {/* Progress */}
                    <div>
                      <div className="flex justify-between text-xs mb-1.5 font-bold">
                        <span className="text-slate-500">Meta: {b.targetSheets} chapas / blocos</span>
                        <span className="text-slate-900 dark:text-white">{b.doneSheets} de {b.targetSheets} ({percent}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-white/10 h-2.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${b.status === 'concluido' ? 'bg-emerald-500' : 'bg-orange-500'}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* Meta Specs Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                        <p className="text-[9px] uppercase font-bold text-slate-400">Material & Dimensões</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200">{b.material}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{b.dimensions}</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                        <p className="text-[9px] uppercase font-bold text-slate-400">Ferramenta & Tempo</p>
                        <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{b.tool}</p>
                        <p className="text-[10px] text-orange-500 font-bold">
                          {b.totalEstMinutes > 0 ? `~${b.totalEstMinutes} min pendente` : 'Concluído'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
