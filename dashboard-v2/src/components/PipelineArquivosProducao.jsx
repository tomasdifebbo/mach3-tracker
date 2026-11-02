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
    const interval = setInterval(() => fetchPipeline(false), 30000);
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
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-[#0c0d10] text-slate-900 dark:text-slate-100 p-2.5 md:p-3.5 gap-2.5">
      {/* Top Header - Compact single-row layout */}
      <div className="flex items-center justify-between gap-3 bg-white dark:bg-white/[0.03] py-2 px-3.5 rounded-xl border border-slate-200 dark:border-white/5 shrink-0 shadow-sm">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 text-orange-500 flex items-center justify-center shrink-0">
            <Layers size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm md:text-base font-black text-slate-900 dark:text-white leading-none">
                Pipeline de Arquivos & Produção
              </h1>
              <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                CAD ➔ CAM ➔ CNC
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-text-muted hidden sm:block">
              {pipelineData?.updatedAt ? `Sincronizado ${formatDate(pipelineData.updatedAt)} · ` : ''}
              Separação de vetores (.cdr, .eps, .dxf, .ai), G-codes na fila e histórico usinado
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

      {/* KPI Cards Row - Compact, tight height */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
        {/* KPI 1 */}
        <div 
          onClick={() => setActiveTab('preparar')}
          className={`py-2 px-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'preparar'
              ? 'bg-amber-500/15 border-amber-500/60 shadow-sm'
              : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-amber-500/40'
          }`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">1. A Preparar (CAD/CAM)</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-white">{summary.totalCadPreparar}</span>
              <span className="text-[11px] text-slate-500">vetoriais</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
            <Sparkles size={16} />
          </div>
        </div>

        {/* KPI 2 */}
        <div 
          onClick={() => setActiveTab('fila_router')}
          className={`py-2 px-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'fila_router'
              ? 'bg-orange-500/15 border-orange-500/60 shadow-sm'
              : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-orange-500/40'
          }`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-500">2. Pronto para Router</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-white">{summary.totalGcodePronto}</span>
              <span className="text-[11px] text-slate-500">G-Codes na fila</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center shrink-0">
            <Cpu size={16} />
          </div>
        </div>

        {/* KPI 3 */}
        <div 
          onClick={() => setActiveTab('concluidos')}
          className={`py-2 px-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'concluidos'
              ? 'bg-emerald-500/15 border-emerald-500/60 shadow-sm'
              : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-emerald-500/40'
          }`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">3. Já Feito / Usinado</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-white">{summary.totalConcluidos}</span>
              <span className="text-[11px] text-slate-500">execuções</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} />
          </div>
        </div>

        {/* KPI 4 */}
        <div 
          onClick={() => setActiveTab('lotes')}
          className={`py-2 px-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'lotes'
              ? 'bg-sky-500/15 border-sky-500/60 shadow-sm'
              : 'bg-white dark:bg-white/[0.03] border-slate-200 dark:border-white/5 hover:border-sky-500/40'
          }`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-sky-400">Lotes & Prioridades</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-black text-slate-900 dark:text-white">{specialBatches.length}</span>
              <span className="text-[11px] text-slate-500">lotes ativos</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
            <Award size={16} />
          </div>
        </div>
      </div>

      {/* Tabs & Filter Bar - Single row without horizontal scrollbars */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-white/[0.02] p-2 rounded-xl border border-slate-200 dark:border-white/5 shrink-0">
        {/* Buttons */}
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'lotes', label: 'Lotes Seriados', icon: Award, count: specialBatches.length },
            { id: 'preparar', label: 'A Preparar (CAD/CAM)', icon: Sparkles, count: pipelineData?.cadPreparar?.length || summary.totalCadPreparar },
            { id: 'fila_router', label: 'Pronto p/ Router', icon: Cpu, count: pipelineData?.gcodeProntos?.length || summary.totalGcodePronto },
            { id: 'concluidos', label: 'Já Feito (Histórico)', icon: CheckCircle2, count: pipelineData?.gcodeFeitos?.length || summary.totalConcluidos },
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
              placeholder="Buscar arquivo, O.S..."
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

      {/* Main Content Area - Single smooth vertical scroll */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2.5" style={{ scrollbarWidth: 'thin' }}>
        {/* TAB: LOTES SERIADOS & PRIORIDADES ATIVAS */}
        {activeTab === 'lotes' && (
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
                      b.status === 'concluido'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    }`}>
                      {b.status === 'concluido' ? '100% CONCLUÍDO' : `${b.pendingSheets} FALTANTES`}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-[11px] mb-1 font-bold">
                      <span className="text-slate-500">Meta: {b.targetSheets} peças/chapas</span>
                      <span className="text-slate-900 dark:text-white">{b.doneSheets} de {b.targetSheets} ({percent}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${b.status === 'concluido' ? 'bg-emerald-500' : 'bg-orange-500'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  {/* Specs row */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                      <p className="text-[9px] uppercase font-bold text-slate-400">Material & Chapa</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{b.material}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{b.dimensions}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5">
                      <p className="text-[9px] uppercase font-bold text-slate-400">Ferramenta & Estimativa</p>
                      <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{b.tool}</p>
                      <p className="text-[10px] text-orange-500 font-bold truncate">
                        {b.totalEstMinutes > 0 ? `~${b.totalEstMinutes} min pendente` : 'Concluído'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: ARQUIVOS A PREPARAR (CAD/CAM) */}
        {activeTab === 'preparar' && (
          <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-text-muted uppercase text-[9px] font-black tracking-wider border-b border-slate-200 dark:border-white/5">
                  <tr>
                    <th className="py-2.5 px-3">Ext</th>
                    <th className="py-2.5 px-3">Nome do Arquivo</th>
                    <th className="py-2.5 px-3">Serviço / O.S.</th>
                    <th className="py-2.5 px-3">Tamanho</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredCad.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhum arquivo vetorial encontrado.
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
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[150px] inline-block">{f.jobName}</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                          {formatBytes(f.size)}
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                            Aguardando CAM
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

        {/* TAB: PRONTO PARA ROUTER (G-CODES NA FILA) */}
        {activeTab === 'fila_router' && (
          <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-text-muted uppercase text-[9px] font-black tracking-wider border-b border-slate-200 dark:border-white/5">
                  <tr>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3">Arquivo G-Code</th>
                    <th className="py-2.5 px-3">Serviço / O.S.</th>
                    <th className="py-2.5 px-3">Tamanho</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {filteredGcodes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Nenhum arquivo G-Code aguardando máquina encontrado.
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
                          <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[150px] inline-block">{f.jobName}</span>
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                          {formatBytes(f.size)}
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">
                            <span className="w-1 h-1 rounded-full bg-orange-500 animate-pulse"></span>
                            Pronto p/ Router
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

        {/* TAB: JÁ FEITO (HISTÓRICO DE USINAGEM) */}
        {activeTab === 'concluidos' && (
          <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-text-muted uppercase text-[9px] font-black tracking-wider border-b border-slate-200 dark:border-white/5">
                  <tr>
                    <th className="py-2.5 px-3">Arquivo Usinado</th>
                    <th className="py-2.5 px-3">Serviço / O.S.</th>
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
                      <td colSpan={7} className="py-8 text-center text-slate-400">
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
                          {d.jobName}
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

        {/* TAB: VISÃO GERAL DOS JOBS */}
        {activeTab === 'visao_geral' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filteredJobs.map(j => {
              const isExpanded = expandedJobs[j.name];
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
                    <div className="bg-orange-500 h-full" style={{ width: `${(j.gcodeProntoCount / Math.max(1, j.cadCount + j.gcodeCount)) * 100}%` }} />
                    <div className="bg-amber-500 h-full" style={{ width: `${(j.cadPrepararCount / Math.max(1, j.cadCount + j.gcodeCount)) * 100}%` }} />
                  </div>

                  <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
                    <div className="p-1 rounded bg-amber-500/10">
                      <span className="text-amber-500 font-bold block">A Preparar</span>
                      <span className="font-black text-amber-400">{j.cadPrepararCount}</span>
                    </div>
                    <div className="p-1 rounded bg-orange-500/10">
                      <span className="text-orange-500 font-bold block">Pronto CNC</span>
                      <span className="font-black text-orange-400">{j.gcodeProntoCount}</span>
                    </div>
                    <div className="p-1 rounded bg-emerald-500/10">
                      <span className="text-emerald-500 font-bold block">Concluído</span>
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
