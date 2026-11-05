import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FolderSync, FolderOpen, FolderCheck, AlertCircle, CheckCircle2, Clock,
  UploadCloud, Download, Copy, Check, RefreshCw, FileText, Settings, ShieldCheck,
  ChevronDown, ChevronRight, Zap, Play, Search, Filter, Layers, HardDrive, Terminal
} from 'lucide-react';
import { api } from '../services/api';
import { patchGcodeContent } from '../utils/gcodePatcher';

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

export function ControlePastasOficina() {
  const [activeTab, setActiveTab] = useState('projetos'); // 'projetos' | 'injetor' | 'assistente'
  const [loading, setLoading] = useState(false);
  const [syncData, setSyncData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [expandedJobs, setExpandedJobs] = useState({});

  // Injetor G-Code state
  const [patchFile, setPatchFile] = useState(null);
  const [targetSpeed, setTargetSpeed] = useState('18000');
  const [patchResult, setPatchResult] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const fetchSyncData = async (force = false) => {
    setLoading(true);
    try {
      const data = await api.get(`/oficina-sync${force ? '?refresh=true' : ''}`);
      if (data && !data.error) {
        setSyncData(data);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados do assistente de pastas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSyncData();
    const interval = setInterval(fetchSyncData, 20000);
    return () => clearInterval(interval);
  }, []);

  const jobs = useMemo(() => syncData?.jobs || [], [syncData]);

  const kpis = useMemo(() => {
    let novos = 0;
    let atualizacoes = 0;
    let sincronizados = 0;
    let aguardando = 0;
    let totalArquivos = 0;

    jobs.forEach(j => {
      totalArquivos += (j.total_files || 0);
      if (j.status === 'novo') novos++;
      else if (j.status === 'atualizacao') atualizacoes++;
      else if (j.status === 'sincronizado') sincronizados++;
      else aguardando++;
    });

    return { novos, atualizacoes, sincronizados, aguardando, totalArquivos };
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    return jobs.filter(j => {
      const matchSearch = j.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchSearch) return false;
      if (statusFilter === 'todos') return true;
      if (statusFilter === 'novos_atualizacoes') return j.status === 'novo' || j.status === 'atualizacao';
      return j.status === statusFilter;
    });
  }, [jobs, searchTerm, statusFilter]);

  const toggleExpand = (jobName) => {
    setExpandedJobs(prev => ({ ...prev, [jobName]: !prev[jobName] }));
  };

  // G-code patch handler
  const handleProcessGcode = (file) => {
    if (!file) return;
    setPatchFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const res = patchGcodeContent(text, targetSpeed);
      setPatchResult(res);
    };
    reader.readAsText(file);
  };

  const handleDownloadPatched = () => {
    if (!patchResult || !patchFile) return;
    const blob = new Blob([patchResult.patchedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const originalName = patchFile.name;
    const dotIdx = originalName.lastIndexOf('.');
    const baseName = dotIdx !== -1 ? originalName.slice(0, dotIdx) : originalName;
    const ext = dotIdx !== -1 ? originalName.slice(dotIdx) : '.txt';
    a.download = `${baseName}_com_M101_M102${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyCode = () => {
    if (!patchResult) return;
    navigator.clipboard.writeText(patchResult.patchedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto custom-scrollbar space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Sincronização 3 - OFICINA
            </span>
            <span className="text-xs text-text-muted">|</span>
            <span className="text-xs font-semibold text-text-muted">OneDrive ➔ ARQUIVOS 2026 (Local)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
            <FolderSync className="text-orange-400" size={32} />
            Controle de Pastas & Liberação de Projetos
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Detecta novos arquivos liberados em <code className="text-orange-400 px-1 py-0.5 bg-black/40 rounded text-xs font-mono">3 - OFICINA</code>,
            copia com proteção contra sobrescrita e injeta macros <strong className="text-white">M101 / M102</strong> e <strong className="text-white">S18000</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => fetchSyncData(true)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-xl text-xs font-bold text-white transition-all cursor-pointer shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-orange-400' : 'text-text-muted'} />
            <span>{loading ? 'Atualizando...' : 'Atualizar Dados'}</span>
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab('projetos')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'projetos'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <FolderOpen size={16} />
          <span>Projetos Liberados ({jobs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('injetor')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'injetor'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Zap size={16} />
          <span>Injetor de Macros G-Code (M101/M102)</span>
        </button>

        <button
          onClick={() => setActiveTab('assistente')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'assistente'
              ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
              : 'text-text-muted hover:text-white hover:bg-white/5'
          }`}
        >
          <Settings size={16} />
          <span>Assistente Local (Windows)</span>
        </button>
      </div>

      {/* TAB 1: PROJETOS LIBERADOS */}
      {activeTab === 'projetos' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass rounded-2xl p-4 border border-emerald-500/20 bg-emerald-500/5 flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Novos Liberados</span>
              <span className="text-3xl font-black text-emerald-400 mt-1">{kpis.novos}</span>
              <span className="text-[11px] text-text-muted mt-1">Prontos p/ descer pra Router</span>
            </div>

            <div className="glass rounded-2xl p-4 border border-cyan-500/20 bg-cyan-500/5 flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-accent-cyan">Com Atualizações</span>
              <span className="text-3xl font-black text-accent-cyan mt-1">{kpis.atualizacoes}</span>
              <span className="text-[11px] text-text-muted mt-1">Arquivos novos na pasta</span>
            </div>

            <div className="glass rounded-2xl p-4 border border-blue-500/20 bg-blue-500/5 flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-400">Sincronizados</span>
              <span className="text-3xl font-black text-blue-400 mt-1">{kpis.sincronizados}</span>
              <span className="text-[11px] text-text-muted mt-1">{kpis.totalArquivos} arquivos monitorados</span>
            </div>

            <div className="glass rounded-2xl p-4 border border-white/5 bg-white/5 flex flex-col">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">Aguardando Liberação</span>
              <span className="text-3xl font-black text-white mt-1">{kpis.aguardando}</span>
              <span className="text-[11px] text-text-muted mt-1">Ainda sem arquivos em 3 - OFICINA</span>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-black/20 p-3 rounded-2xl border border-white/5">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Buscar projeto no OneDrive..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-text-muted focus:outline-none focus:border-orange-500/50"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setStatusFilter('todos')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === 'todos' ? 'bg-white/20 text-white' : 'text-text-muted hover:text-white'
                }`}
              >
                Todos ({jobs.length})
              </button>
              <button
                onClick={() => setStatusFilter('novos_atualizacoes')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === 'novos_atualizacoes' ? 'bg-emerald-500 text-white' : 'text-emerald-400 hover:bg-emerald-500/10'
                }`}
              >
                Novos / Pendentes ({kpis.novos + kpis.atualizacoes})
              </button>
              <button
                onClick={() => setStatusFilter('sincronizado')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === 'sincronizado' ? 'bg-blue-500 text-white' : 'text-blue-400 hover:bg-blue-500/10'
                }`}
              >
                Sincronizados ({kpis.sincronizados})
              </button>
              <button
                onClick={() => setStatusFilter('aguardando')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  statusFilter === 'aguardando' ? 'bg-white/10 text-white' : 'text-text-muted hover:text-white'
                }`}
              >
                Aguardando ({kpis.aguardando})
              </button>
            </div>
          </div>

          {/* Project Cards List */}
          <div className="space-y-3">
            {filteredJobs.length === 0 ? (
              <div className="glass rounded-2xl p-12 text-center border border-white/5">
                <FolderOpen size={40} className="mx-auto text-text-muted mb-3 opacity-40" />
                <p className="text-sm font-bold text-white">Nenhum projeto encontrado</p>
                <p className="text-xs text-text-muted mt-1">Tente ajustar o termo de busca ou os filtros de status.</p>
              </div>
            ) : (
              filteredJobs.map((job) => {
                const isExpanded = !!expandedJobs[job.name];
                const statusBadge = {
                  novo: { label: 'NOVO LIBERADO', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
                  atualizacao: { label: 'ARQUIVOS NOVOS', bg: 'bg-cyan-500/20 text-accent-cyan border-cyan-500/30' },
                  sincronizado: { label: 'SINCRONIZADO', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
                  aguardando: { label: 'AGUARDANDO LIBERAÇÃO', bg: 'bg-white/5 text-text-muted border-white/10' },
                }[job.status] || { label: job.status?.toUpperCase(), bg: 'bg-white/5 text-white border-white/10' };

                return (
                  <div
                    key={job.name}
                    className="glass rounded-2xl border border-white/5 overflow-hidden hover:border-white/15 transition-all"
                  >
                    <div
                      onClick={() => toggleExpand(job.name)}
                      className="p-4 md:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02]"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <button className="text-text-muted hover:text-white transition-colors">
                          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                        </button>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-white text-sm md:text-base truncate">{job.name}</h3>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusBadge.bg}`}>
                              {statusBadge.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-text-muted mt-1 flex-wrap">
                            <span>📁 3 - OFICINA: <strong className="text-white">{job.total_files || 0} arquivo(s)</strong></span>
                            {job.new_files_count > 0 && (
                              <span className="text-emerald-400 font-bold">+{job.new_files_count} novos</span>
                            )}
                            <span>·</span>
                            <span>💾 {formatBytes(job.total_bytes)}</span>
                            <span>·</span>
                            <span>Último: {job.latest_date_str || '—'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {job.categories && job.categories.length > 0 && (
                          <div className="hidden sm:flex items-center gap-1">
                            {job.categories.slice(0, 3).map(c => (
                              <span key={c} className="text-[10px] font-bold px-2 py-0.5 bg-white/5 border border-white/10 rounded-lg text-text-muted">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded File List */}
                    {isExpanded && (
                      <div className="border-t border-white/5 bg-black/40 p-4 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-text-muted pb-2 border-b border-white/5">
                          <span>Arquivos detectados na pasta <strong>3 - OFICINA</strong>:</span>
                          <span className="text-emerald-400 font-semibold">Proteção contra sobrescrita ativa</span>
                        </div>

                        {job.files && job.files.length > 0 ? (
                          <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                            {job.files.map((file, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between gap-3 px-3 py-2 bg-white/[0.03] hover:bg-white/[0.06] rounded-xl text-xs transition-colors"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <FileText size={14} className={file.is_new ? 'text-emerald-400' : 'text-text-muted'} />
                                  <span className="font-mono text-slate-200 truncate">{file.rel_path}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-text-muted text-[11px]">{formatBytes(file.size)}</span>
                                  {file.exists_local ? (
                                    <span className="text-[10px] font-bold text-blue-400 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded-md">
                                      Copiado na Router
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-emerald-400 px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md animate-pulse">
                                      Novo no OneDrive
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-text-muted py-2 italic text-center">
                            Nenhum arquivo encontrado dentro de 3 - OFICINA para este projeto.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INJETOR DE MACROS G-CODE */}
      {activeTab === 'injetor' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-6">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <Zap className="text-orange-400" size={20} />
                Injetor Instantâneo de Macros M101 e M102
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Converte arquivos G-code do Aspire, ArtCAM ou Vectric para o padrão do <strong>Mach3 Tracker</strong>:
                injeta <code className="text-emerald-400 font-mono">M101</code> após ligar o Spindle (<code className="font-mono">M03</code>) e <code className="text-emerald-400 font-mono">M102</code> antes do encerramento (<code className="font-mono">M30</code>), ajustando também a rotação para <code className="font-mono text-cyan-400">S18000</code>.
              </p>
            </div>

            {/* Target Spindle Speed */}
            <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
              <label className="text-xs font-bold text-slate-300">Rotação do Spindle Alvo (RPM):</label>
              <input
                type="text"
                value={targetSpeed}
                onChange={(e) => setTargetSpeed(e.target.value)}
                placeholder="18000"
                className="w-28 bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-orange-400 text-center focus:outline-none focus:border-orange-500"
              />
              <span className="text-[11px] text-text-muted">Substitui S12000 por S{targetSpeed} automaticamente</span>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleProcessGcode(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragOver ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 hover:border-white/20 bg-black/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.tap,.nc,.cnc,.gcode"
                onChange={(e) => e.target.files && handleProcessGcode(e.target.files[0])}
                className="hidden"
              />
              <UploadCloud size={40} className="mx-auto text-orange-400 mb-3 opacity-80" />
              <p className="text-sm font-bold text-white">
                {patchFile ? patchFile.name : 'Clique para selecionar ou arraste o arquivo G-code aqui'}
              </p>
              <p className="text-xs text-text-muted mt-1">Suporta arquivos .txt, .tap, .nc, .cnc e .gcode</p>
            </div>

            {/* Result Box */}
            {patchResult && (
              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                    <span className="text-[10px] font-bold text-text-muted uppercase">Linha M101 (Início)</span>
                    <p className="text-lg font-black text-emerald-400">Linha {patchResult.m101Line}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                    <span className="text-[10px] font-bold text-text-muted uppercase">Linha M102 (Fim)</span>
                    <p className="text-lg font-black text-emerald-400">Linha {patchResult.m102Line}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                    <span className="text-[10px] font-bold text-text-muted uppercase">Spindle Ajustado</span>
                    <p className="text-lg font-black text-accent-cyan">S{patchResult.targetSpeed}</p>
                  </div>
                  <div className="p-3 bg-white/5 rounded-xl border border-white/5 text-center">
                    <span className="text-[10px] font-bold text-text-muted uppercase">Total de Linhas</span>
                    <p className="text-lg font-black text-white">{patchResult.patchedLinesCount}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleDownloadPatched}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-orange-500/20 cursor-pointer"
                  >
                    <Download size={16} />
                    <span>Baixar Arquivo Ajustado (.txt)</span>
                  </button>

                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl text-xs transition-all border border-white/10 cursor-pointer"
                  >
                    {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    <span>{copied ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>

                {/* Code Preview */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-text-muted uppercase">Preview do Código G Gerado:</span>
                  <pre className="bg-black/60 p-4 rounded-xl text-xs font-mono text-slate-300 max-h-60 overflow-y-auto custom-scrollbar border border-white/5">
                    {patchResult.patchedContent.split('\n').slice(0, 30).join('\n')}
                    {'\n... [demais linhas de usinagem] ...\n'}
                    {patchResult.patchedContent.split('\n').slice(-15).join('\n')}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ASSISTENTE LOCAL */}
      {activeTab === 'assistente' && (
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 border border-white/5 space-y-6">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <HardDrive className="text-orange-400" size={20} />
                Assistente de Pastas Local (Windows CNC)
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Serviço de background residente na estação CNC da marcenaria/oficina que monitora as pastas da nuvem.
              </p>
            </div>

            {/* Current Config */}
            <div className="space-y-3">
              <span className="text-xs font-black uppercase tracking-wider text-orange-400">Configuração Ativa</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-text-muted uppercase">Origem (OneDrive Ativo):</span>
                  <p className="font-mono text-white mt-1 break-all">
                    {syncData?.active_config?.source_dir || 'C:\\Users\\Atelier Arte\\Atelier Casa do Trem LTDA\\dados2 - Jobs Ativos'}
                  </p>
                </div>

                <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-text-muted uppercase">Destino Local da Router:</span>
                  <p className="font-mono text-white mt-1 break-all">
                    {syncData?.active_config?.dest_dir || 'E:\\arquivos 2024\\ARQUIVOS 2026'}
                  </p>
                </div>

                <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-text-muted uppercase">Subpasta Filtrada:</span>
                  <p className="font-mono text-emerald-400 font-bold mt-1">3 - OFICINA (Apenas conteúdos desta subpasta)</p>
                </div>

                <div className="p-3.5 bg-white/5 rounded-xl border border-white/5">
                  <span className="text-[10px] font-bold text-text-muted uppercase">Injeção Automática:</span>
                  <p className="font-mono text-accent-cyan font-bold mt-1">Ativada (M101 + M102 + S18000 RPM)</p>
                </div>
              </div>
            </div>

            {/* Safety Rules */}
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <ShieldCheck size={18} />
                <span>Garantias de Segurança Implementadas no Assistente:</span>
              </div>
              <ul className="text-xs text-slate-300 space-y-1 list-disc pl-5">
                <li><strong>Proteção contra sobrescrita:</strong> Nunca substitui arquivos que já foram copiados ou editados pelo operador na máquina.</li>
                <li><strong>Streaming sem corromper atributos da nuvem:</strong> Baixa arquivos sob demanda sem quebrar os marcadores de reparse do OneDrive.</li>
                <li><strong>Notificador na Área de Trabalho:</strong> Emite aviso visual e sonoro sempre que o setor de projetos liberar um novo arquivo na pasta 3 - OFICINA.</li>
                <li><strong>Atalho na Área de Trabalho:</strong> Já criado em <code className="font-mono text-orange-400">Desktop\Assistente de Pastas Oficina.lnk</code>.</li>
              </ul>
            </div>

            {/* Quick Starter Command */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-text-muted">Como iniciar manualmente se necessário:</span>
              <div className="flex items-center gap-2 p-3 bg-black/40 rounded-xl border border-white/10 font-mono text-xs text-slate-300">
                <Terminal size={14} className="text-orange-400 shrink-0" />
                <span className="truncate">C:\DASHBOARD\assistente_pastas\Iniciar_Assistente_Oficina.bat</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
