import React, { useState, useEffect } from 'react';
import { 
  UserCheck, Play, CheckCircle2, AlertTriangle, Clock, 
  Wrench, CheckSquare, Layers, Cpu, ShieldAlert, Sparkles, RefreshCw, Edit2, Trash2
} from 'lucide-react';
import { api } from '../services/api';

export function Operador({ jobs = [], routers = [], onRefresh }) {
  const [operatorName, setOperatorName] = useState(localStorage.getItem('mach3_operator_name') || 'Operador Principal');
  const [activeTab, setActiveTab] = useState('os'); // 'os' | 'checklists' | 'ocorrencia'
  const [kanbanTasks, setKanbanTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Quick occurrence form
  const [showOccurrenceModal, setShowOccurrenceModal] = useState(false);
  const [occMachine, setOccMachine] = useState('Router CNC');
  const [occType, setOccType] = useState('Fresa cega / quebrada');
  const [occSeverity, setOccSeverity] = useState('media');
  const [occDesc, setOccDesc] = useState('');
  const [submittingOcc, setSubmittingOcc] = useState(false);

  const [operatorsList, setOperatorsList] = useState([]);
  const [showOperatorsModal, setShowOperatorsModal] = useState(false);
  const [newOpName, setNewOpName] = useState('');
  const [newOpShift, setNewOpShift] = useState('Geral');
  const [savingOp, setSavingOp] = useState(false);

  const fetchKanban = async () => {
    setLoadingTasks(true);
    try {
      const data = await api.get('/kanban');
      if (Array.isArray(data)) {
        setKanbanTasks(data);
      }
    } catch (err) {
      console.error('Failed to load kanban in Operador:', err);
    } finally {
      setLoadingTasks(false);
    }
  };

  const fetchOperators = async () => {
    try {
      const data = await api.getOperators();
      if (Array.isArray(data)) setOperatorsList(data);
    } catch (err) {
      console.error('Failed to load operators:', err);
    }
  };

  useEffect(() => {
    fetchKanban();
    fetchOperators();
  }, []);

  const handleAddOperator = async (e) => {
    e.preventDefault();
    if (!newOpName.trim()) return;
    setSavingOp(true);
    try {
      await api.addOperator(newOpName.trim(), newOpShift);
      setNewOpName('');
      fetchOperators();
    } catch (err) {
      alert('Erro ao cadastrar operador');
    } finally {
      setSavingOp(false);
    }
  };

  const handleDeleteOperator = async (id) => {
    if (!confirm('Deseja remover este operador?')) return;
    try {
      await api.deleteOperator(id);
      fetchOperators();
    } catch (err) {
      alert('Erro ao remover operador');
    }
  };

  const handleAssignOperatorToMachine = async (routerId, opName) => {
    try {
      await api.updateRouterOperator(routerId, opName);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Erro ao alocar operador na máquina');
    }
  };

  const handleNameChange = (e) => {
    const val = e.target.value;
    setOperatorName(val);
    localStorage.setItem('mach3_operator_name', val);
  };

  const handleMoveKanban = async (taskId, newColumn) => {
    try {
      await api.patch(`/kanban/${taskId}`, { column_id: newColumn });
      fetchKanban();
    } catch (err) {
      alert('Erro ao atualizar status da O.S.');
    }
  };

  const handleSubmitOccurrence = async (e) => {
    e.preventDefault();
    if (!occDesc.trim()) return;
    setSubmittingOcc(true);
    try {
      await api.post('/occurrences', {
        machine: occMachine,
        type: occType,
        severity: occSeverity,
        description: occDesc,
        operator: operatorName
      });
      alert('Ocorrência registrada com sucesso! Notificação enviada ao Encarregado.');
      setShowOccurrenceModal(false);
      setOccDesc('');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Erro ao registrar ocorrência.');
    } finally {
      setSubmittingOcc(false);
    }
  };

  const activeJobs = kanbanTasks.filter(t => t.column_id === 'doing' || t.column_id === 'todo');

  const [now, setNow] = useState(Date.now());
  const [selectedTaskToStart, setSelectedTaskToStart] = useState({});

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleStartManualJob = async (routerName, opName, taskTitle) => {
    if (!taskTitle) return alert('Selecione uma O.S. para iniciar');
    try {
      await api.post('/jobs', {
        file_name: taskTitle,
        folder: 'Operação Fábrica',
        router_name: routerName,
        operator_name: opName || operatorName
      });
      if (onRefresh) await onRefresh();
      fetchKanban();
    } catch (err) {
      alert('Erro ao iniciar O.S. na máquina');
    }
  };

  const handleFinishManualJob = async (routerName) => {
    try {
      await api.patch('/jobs/latest', { router_name: routerName });
      if (onRefresh) await onRefresh();
      fetchKanban();
    } catch (err) {
      alert('Erro ao finalizar job na máquina');
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 md:space-y-8 animate-in fade-in duration-500">
      
      {/* Header do Operador */}
      <div className="glass p-6 md:p-8 rounded-3xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-accent-cyan/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-4 bg-gradient-to-br from-accent-cyan to-accent-blue text-black rounded-2xl shadow-xl shadow-accent-cyan/20 shrink-0">
            <UserCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 px-2.5 py-0.5 rounded-full">
                Painel do Operador
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-1">
              Terminal de Operação
            </h1>
            <p className="text-xs text-text-muted mt-1 font-medium">
              Acompanhamento de corte, execuções de O.S. e apontamentos de fábrica
            </p>
          </div>
        </div>

        {/* Identificação do Operador & Gestão da Equipe */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10 bg-white/5 p-3 rounded-2xl border border-white/10">
          <button
            onClick={() => setShowOperatorsModal(true)}
            className="px-3.5 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <UserCheck size={16} />
            Cadastrar Operadores ({operatorsList.length})
          </button>
          <div className="h-4 w-px bg-white/10 hidden sm:block" />
          <div className="text-xs font-bold text-text-muted flex items-center gap-2 px-1">
            <Wrench size={16} className="text-accent-cyan" />
            <span>Operador Atual:</span>
          </div>
          <input
            type="text"
            value={operatorName}
            onChange={handleNameChange}
            placeholder="Nome do Operador"
            className="bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-accent-cyan transition-colors"
          />
          <button
            onClick={() => setShowOccurrenceModal(true)}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldAlert size={16} />
            Reportar Falha
          </button>
        </div>
      </div>

      {/* Cards de Maquinário em Tempo Real com Seleção de Operador por Máquina */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {routers.map((m) => {
          const isCutting = m.status === 'cortando' || !!m.current_job;
          let runtimeFormatted = '00:00:00';
          let startTimeFormatted = null;
          let remainingFormatted = null;
          let etaFormatted = null;
          let progressPct = null;

          if (m.start_time) {
            const startDt = new Date(m.start_time);
            startTimeFormatted = startDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const diffSec = Math.max(0, Math.floor((now - startDt.getTime()) / 1000));
            const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
            const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
            const secs = String(diffSec % 60).padStart(2, '0');
            runtimeFormatted = `${hrs}:${mins}:${secs}`;

            // Check if there is an estimated time (either on router object or from jobs array)
            const matchingJob = jobs.find(j => !j.end_time && j.router_name && (j.router_name.toLowerCase().includes(m.name.toLowerCase()) || m.name.toLowerCase().includes(j.router_name.toLowerCase())));
            const estMin = m.estimated_minutes || (matchingJob ? matchingJob.estimated_minutes : null);

            if (estMin && estMin > 0) {
              const totalEstSec = Math.floor(estMin * 60);
              const remSec = Math.max(0, totalEstSec - diffSec);
              const rHrs = String(Math.floor(remSec / 3600)).padStart(2, '0');
              const rMins = String(Math.floor((remSec % 3600) / 60)).padStart(2, '0');
              const rSecs = String(remSec % 60).padStart(2, '0');
              remainingFormatted = `${rHrs}:${rMins}:${rSecs}`;

              const etaDt = new Date(startDt.getTime() + totalEstSec * 1000);
              etaFormatted = etaDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
              progressPct = Math.min(100, Math.round((diffSec / totalEstSec) * 100));
            }
          }

          return (
            <div key={m.id} className={`glass p-5 rounded-2xl border transition-all ${isCutting ? 'border-accent-cyan/40 bg-accent-cyan/5 shadow-xl shadow-accent-cyan/5' : 'border-white/5'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-black text-sm text-white">{m.name}</span>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${isCutting ? 'bg-accent-cyan text-black animate-pulse' : 'bg-white/10 text-text-muted'}`}>
                  {isCutting ? 'EM EXECUÇÃO' : (m.status?.toUpperCase() || 'PARADA')}
                </span>
              </div>

              {/* Seletor de Operador Alocado na Máquina */}
              <div className="bg-black/40 p-2.5 rounded-xl border border-white/10 mb-3 space-y-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted flex items-center gap-1">
                  <UserCheck size={12} className="text-accent-cyan" />
                  <span>Operador Alocado:</span>
                </div>
                <select
                  value={m.operator_name || ''}
                  onChange={(e) => handleAssignOperatorToMachine(m.id, e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-accent-cyan cursor-pointer"
                >
                  <option value="" className="bg-zinc-900 text-text-muted">-- Selecionar Operador --</option>
                  {operatorsList.map(op => (
                    <option key={op.id} value={op.name} className="bg-zinc-900 text-white">
                      👷 {op.name} ({op.shift})
                    </option>
                  ))}
                  {operatorName && !operatorsList.some(o => o.name === operatorName) && (
                    <option value={operatorName} className="bg-zinc-900 text-white">👷 {operatorName}</option>
                  )}
                </select>
              </div>

              <div className="space-y-2 text-xs text-text-muted mb-3">
                <div className="flex justify-between items-center">
                  <span>Job Atual:</span>
                  <span className="text-white font-bold truncate max-w-[140px]">{m.current_job || 'Nenhum'}</span>
                </div>

                {isCutting && startTimeFormatted && (
                  <div className="flex justify-between items-center text-[11px]">
                    <span>Iniciado às:</span>
                    <span className="text-white font-medium">{startTimeFormatted}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span>Tempo Corrido:</span>
                  <span className="text-accent-cyan font-mono font-bold text-sm">{runtimeFormatted}</span>
                </div>

                {isCutting && remainingFormatted && (
                  <>
                    <div className="flex justify-between items-center text-[11px]">
                      <span>Tempo Restante:</span>
                      <span className="text-orange-400 font-mono font-bold">{remainingFormatted}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span>Previsão (ETA):</span>
                      <span className="text-accent-success font-mono font-bold">{etaFormatted}</span>
                    </div>

                    {/* Barra de progresso viva */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between text-[10px] font-bold">
                        <span className="text-text-muted">Progresso do Corte</span>
                        <span className="text-accent-cyan">{progressPct}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent-cyan rounded-full transition-all duration-500"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Controles de Início/Conclusão Manual pelo Operador */}
              <div className="border-t border-white/10 pt-2.5 mt-2 space-y-2">
                {isCutting ? (
                  <button
                    onClick={() => handleFinishManualJob(m.name)}
                    className="w-full py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 size={13} />
                    Concluir O.S. nesta Máquina
                  </button>
                ) : (
                  <div className="space-y-1.5">
                    <select
                      value={selectedTaskToStart[m.id] || ''}
                      onChange={(e) => setSelectedTaskToStart(prev => ({ ...prev, [m.id]: e.target.value }))}
                      className="w-full bg-black/60 border border-white/10 text-[11px] font-medium text-white rounded-lg px-2 py-1 outline-none"
                    >
                      <option value="">-- Selecionar O.S. para Iniciar --</option>
                      {kanbanTasks.filter(t => t.column_id === 'todo').map(t => (
                        <option key={t.id} value={t.title}>📋 {t.title}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        handleStartManualJob(m.name, m.operator_name, selectedTaskToStart[m.id]);
                        setSelectedTaskToStart(prev => ({ ...prev, [m.id]: '' }));
                      }}
                      className="w-full py-1.5 bg-accent-cyan/20 hover:bg-accent-cyan/30 text-accent-cyan border border-accent-cyan/30 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Play size={13} fill="currentColor" />
                      Iniciar O.S. com {m.operator_name || 'Operador'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Navegação de Abas do Operador */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('os')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'os' ? 'bg-accent-cyan text-black border-accent-cyan' : 'glass border-white/5 text-text-muted hover:text-white'
          }`}
        >
          <Layers size={16} /> Minhas Ordens de Serviço ({activeJobs.length})
        </button>
        <button
          onClick={() => setActiveTab('checklists')}
          className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'checklists' ? 'bg-accent-cyan text-black border-accent-cyan' : 'glass border-white/5 text-text-muted hover:text-white'
          }`}
        >
          <CheckSquare size={16} /> Checklist Diário da Fábrica
        </button>
      </div>

      {/* Conteúdo: Checklist Diário */}
      {activeTab === 'checklists' && (
        <OperadorChecklist operatorName={operatorName} routers={routers} />
      )}

      {/* Conteúdo: Lista de Ordens de Serviço */}
      {activeTab === 'os' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock size={18} className="text-accent-cyan" /> Fila de Execução da Fábrica
            </h3>
            <button 
              onClick={fetchKanban} 
              className="p-2 text-text-muted hover:text-white bg-white/5 rounded-xl transition-all"
              title="Atualizar lista"
            >
              <RefreshCw size={16} className={loadingTasks ? 'animate-spin' : ''} />
            </button>
          </div>

          {loadingTasks ? (
            <div className="p-12 text-center text-text-muted font-bold">Carregando ordens de serviço...</div>
          ) : activeJobs.length === 0 ? (
            <div className="glass p-12 rounded-3xl border border-white/5 text-center text-text-muted space-y-2">
              <CheckCircle2 size={40} className="mx-auto text-accent-success/60" />
              <h4 className="text-base font-bold text-white">Nenhuma O.S. pendente no momento!</h4>
              <p className="text-xs">Todas as ordens de serviço ativas já foram concluídas ou o Kanban está limpo.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeJobs.map(task => {
                const isDoing = task.column_id === 'doing';
                return (
                  <div key={task.id} className={`glass p-6 rounded-3xl border transition-all flex flex-col justify-between space-y-4 ${
                    isDoing ? 'border-orange-500/50 bg-orange-500/5 shadow-xl shadow-orange-500/5' : 'border-white/10'
                  }`}>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md ${
                          isDoing ? 'bg-orange-500 text-black font-extrabold' : 'bg-white/10 text-text-muted'
                        }`}>
                          {isDoing ? 'EM PRODUÇÃO' : 'A FAZER'}
                        </span>
                        {task.priority && (
                          <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                            task.priority === 'Alta' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-text-muted'
                          }`}>
                            Prioridade: {task.priority}
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-white mb-2">{task.title}</h4>
                      <div className="text-xs text-text-muted space-y-1">
                        <p><strong>Máquina:</strong> {task.machine || 'Geral'}</p>
                        <p><strong>Operador Designado:</strong> {task.operator || 'Livre'}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                      {!isDoing ? (
                        <button
                          onClick={() => handleMoveKanban(task.id, 'doing')}
                          className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-black font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Play size={14} /> Iniciar Produção
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMoveKanban(task.id, 'done')}
                          className="w-full py-2.5 bg-accent-success hover:bg-emerald-400 text-black font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <CheckCircle2 size={14} /> Marcar Concluído
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal para Reportar Ocorrência de Máquina */}
      {showOccurrenceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowOccurrenceModal(false)} />
          
          <form onSubmit={handleSubmitOccurrence} className="relative z-10 w-full max-w-lg bg-zinc-950 border border-red-500/30 p-6 md:p-8 rounded-3xl shadow-2xl space-y-6 text-white">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <div className="p-3 bg-red-500/20 text-red-400 rounded-2xl">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Reportar Falha / Ocorrência</h3>
                <p className="text-xs text-text-muted">Apontamento imediato para a equipe de manutenção e encarregado</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-text-muted uppercase block mb-1.5">Máquina com Problema</label>
                <select
                  value={occMachine}
                  onChange={(e) => setOccMachine(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-red-500"
                >
                  <option value="Router CNC" className="bg-zinc-900">Router CNC</option>
                  <option value="Laser CO₂" className="bg-zinc-900">Laser CO₂</option>
                  <option value="Impressão 3D" className="bg-zinc-900">Impressão 3D</option>
                  <option value="Mesa de Vácuo" className="bg-zinc-900">Mesa de Vácuo</option>
                  <option value="Geral" className="bg-zinc-900">Geral / Fábrica</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-text-muted uppercase block mb-1.5">Tipo de Problema</label>
                  <select
                    value={occType}
                    onChange={(e) => setOccType(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-red-500"
                  >
                    <option value="Fresa cega / quebrada" className="bg-zinc-900">Fresa cega / quebrada</option>
                    <option value="Falta de insumo / material" className="bg-zinc-900">Falta de insumo</option>
                    <option value="Chiller / refrigeração" className="bg-zinc-900">Chiller / Refrigeração</option>
                    <option value="Erro de origem / zero" className="bg-zinc-900">Erro de Origem / Zero</option>
                    <option value="Barulho ou vibração anormal" className="bg-zinc-900">Barulho Anormal</option>
                    <option value="Problema elétrico" className="bg-zinc-900">Problema Elétrico</option>
                    <option value="Outro" className="bg-zinc-900">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-text-muted uppercase block mb-1.5">Gravidade</label>
                  <select
                    value={occSeverity}
                    onChange={(e) => setOccSeverity(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-red-500"
                  >
                    <option value="baixa" className="bg-zinc-900">Baixa (Aviso)</option>
                    <option value="media" className="bg-zinc-900">Média (Atenção)</option>
                    <option value="alta" className="bg-zinc-900">Alta (Máquina Parada)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-muted uppercase block mb-1.5">Descrição Resumida</label>
                <textarea
                  value={occDesc}
                  onChange={(e) => setOccDesc(e.target.value)}
                  placeholder="Descreva o que aconteceu (ex: fresa de 6mm quebrou ao iniciar o corte)..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-red-500 resize-none"
                  required
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowOccurrenceModal(false)}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-xs font-bold uppercase tracking-wider text-text-muted hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submittingOcc || !occDesc.trim()}
                className="px-6 py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-black uppercase text-xs rounded-xl shadow-lg shadow-red-500/20 transition-all flex items-center gap-2"
              >
                {submittingOcc ? 'Enviando...' : 'Enviar Ocorrência'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Equipe de Operadores da Fábrica */}
      {showOperatorsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[200]">
          <div className="glass p-6 md:p-8 rounded-3xl border border-white/10 max-w-lg w-full space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl">
                  <UserCheck size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Equipe de Operadores da Fábrica</h3>
                  <p className="text-xs text-text-muted">Cadastre a lista de operadores para alocação direta em máquinas</p>
                </div>
              </div>
              <button 
                onClick={() => setShowOperatorsModal(false)}
                className="text-text-muted hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form de Adição */}
            <form onSubmit={handleAddOperator} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[10px] font-black uppercase text-text-muted block mb-1">Nome do Operador</label>
                <input
                  type="text"
                  placeholder="Ex: João Silva"
                  value={newOpName}
                  onChange={(e) => setNewOpName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div className="w-28">
                <label className="text-[10px] font-black uppercase text-text-muted block mb-1">Turno</label>
                <select
                  value={newOpShift}
                  onChange={(e) => setNewOpShift(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="Geral">Geral</option>
                  <option value="Manhã">Manhã</option>
                  <option value="Tarde">Tarde</option>
                  <option value="Noite">Noite</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={savingOp || !newOpName.trim()}
                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-black font-black uppercase text-xs rounded-xl transition-all shadow-md shadow-purple-500/20 cursor-pointer h-[34px]"
              >
                {savingOp ? '...' : '+ Add'}
              </button>
            </form>

            {/* Lista de Operadores Cadastrados */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block">
                Operadores Cadastrados ({operatorsList.length})
              </label>

              <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {operatorsList.length === 0 ? (
                  <div className="text-center py-6 text-xs text-text-muted border border-dashed border-white/10 rounded-2xl">
                    Nenhum operador cadastrado. Adicione acima!
                  </div>
                ) : (
                  operatorsList.map(op => (
                    <div key={op.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-300 font-bold text-xs flex items-center justify-center">
                          {op.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">{op.name}</p>
                          <p className="text-[10px] text-text-muted font-medium">Turno: {op.shift}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteOperator(op.id)}
                        className="text-text-muted hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                        title="Remover operador"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowOperatorsModal(false)}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-xs font-bold uppercase tracking-wider text-text-muted hover:text-white cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function OperadorChecklist({ operatorName, routers = [] }) {
  const deviceRole = localStorage.getItem('mach3_device_role') || 'gerente';
  const canManageChecklist = deviceRole === 'gerente' || deviceRole === 'encarregado';

  const today = new Date().toISOString().split('T')[0];
  const [selectedMachine, setSelectedMachine] = useState('router1');
  const [checked, setChecked] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [newItemText, setNewItemText] = useState('');
  const [loading, setLoading] = useState(true);
  const [addingItem, setAddingItem] = useState(false);

  const DEFAULT_CHECKLISTS = {
    router1: {
      name: 'Mesa Router 1',
      items: [
        'Nível de óleo do Spindle e lubrificação dos guias lineares',
        'Limpeza das calhas, mesa de alumínio e duto de sucção de cavacos',
        'Pressão do ar comprimido da linha (Mínimo 6 bar / 87 PSI)',
        'Verificação e aperto do porta-ferramentas / pinça ER32',
        'Teste do botão de parada de emergência do painel',
        'Conferência do ponto de zero peça (X0, Y0, Z0)'
      ]
    },
    router2: {
      name: 'Mesa Router 2',
      items: [
        'Inspeção do nível de água do reservatório / Chiller do Spindle',
        'Verificação visual de folga e sujeira nos eixos X, Y e Z',
        'Limpeza geral da caixa de resíduos e exaustor',
        'Verificação de funcionamento dos sensores de fim de curso (homing)',
        'Checagem do estado físico da fresa instalada'
      ]
    },
    laser: {
      name: 'Laser CO₂ / Ruida',
      items: [
        'Temperatura do Chiller de refrigeração do tubo Laser (20°C - 24°C)',
        'Inspeção e limpeza da lente de foco de 2 polegadas e espelhos',
        'Verificação da exaustão de fumaça e soprador de ar na ponta',
        'Teste do feixe guia (Red Dot) e alinhamento básico',
        'Limpeza e remoção de aparas/retalhos inflamáveis sob o favo de mel'
      ]
    },
    geral: {
      name: 'Rotina Geral do Turno',
      items: [
        'Uso obrigatório de EPIs (Óculos de proteção, protetor auricular e calçado)',
        'Conferência da lista de Ordens de Serviço (O.S.) prioritárias do dia',
        'Organização da área de estoque de materiais (chapas MDF, ACM e Isopor)',
        'Descarte correto de retalhos e limpeza da bancada ao final do turno'
      ]
    }
  };

  const currentMachineData = DEFAULT_CHECKLISTS[selectedMachine] || DEFAULT_CHECKLISTS.router1;

  const fetchCustomItems = async () => {
    try {
      const items = await api.get(`/checklists/items?machine_key=${selectedMachine}`);
      if (Array.isArray(items)) setCustomItems(items);
    } catch (err) {
      console.error('Erro ao buscar itens customizados do checklist:', err);
    }
  };

  const fetchChecklist = async () => {
    setLoading(true);
    try {
      await fetchCustomItems();
      const rows = await api.get(`/checklists?machine_key=${selectedMachine}&date=${today}`);
      if (Array.isArray(rows)) {
        const checkedIndices = rows.filter(r => r.done).map(r => r.item_index);
        setChecked(checkedIndices);
      }
    } catch (err) {
      console.error('Erro ao buscar checklist:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, [selectedMachine]);

  const allItems = customItems.length > 0
    ? customItems.map((item, idx) => ({ id: item.id, index: idx, text: item.item_text }))
    : currentMachineData.items.map((text, idx) => ({ index: idx, text }));

  const toggleItem = async (i) => {
    const isDone = !checked.includes(i);
    setChecked(prev => isDone ? [...prev, i] : prev.filter(x => x !== i));
    try {
      await api.post('/checklists/toggle', {
        machine_key: selectedMachine,
        item_index: i,
        done: isDone,
        date: today
      });
    } catch (err) {
      setChecked(prev => isDone ? prev.filter(x => x !== i) : [...prev, i]);
    }
  };

  const handleEditCustom = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    const newText = prompt('Editar texto do item do checklist:', item.text);
    if (!newText || !newText.trim() || newText.trim() === item.text) return;
    try {
      if (item.id) {
        await api.patch(`/checklists/items/${item.id}`, { item_text: newText.trim() });
        fetchCustomItems();
      }
    } catch (err) {
      alert('Erro ao editar item do checklist.');
    }
  };

  const handleDeleteCustom = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Deseja excluir este item do checklist?')) return;
    try {
      if (item.id) {
        await api.deleteCustom(`/checklists/items/${item.id}`);
        fetchCustomItems();
      }
    } catch (err) {
      alert('Erro ao excluir item.');
    }
  };

  const handleAddCustom = async (e) => {
    e.preventDefault();
    if (!newItemText.trim() || addingItem) return;
    setAddingItem(true);
    try {
      const created = await api.post('/checklists/items', {
        machine_key: selectedMachine,
        item_text: newItemText.trim()
      });
      if (created && created.id) {
        setCustomItems(prev => [...prev, created]);
        setNewItemText('');
      }
    } catch (err) {
      alert('Erro ao adicionar item ao checklist.');
    } finally {
      setAddingItem(false);
    }
  };

  const completedCount = allItems.filter(item => checked.includes(item.index)).length;
  const totalCount = allItems.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="glass p-6 md:p-8 rounded-3xl border border-white/10 space-y-6">
      {/* Header do Checklist */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 px-2.5 py-0.5 rounded-full">
              Checklist de Operação Diária
            </span>
            <span className="text-xs text-text-muted font-bold">Hoje: {new Date().toLocaleDateString('pt-BR')}</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white mt-1">
            Rotina & Inspeção do Turno ({operatorName})
          </h2>
          <p className="text-xs text-text-muted font-medium mt-0.5">
            Cumpra os itens de verificação antes e durante o funcionamento das máquinas
          </p>
        </div>

        {/* Barra de Progresso do Checklist */}
        <div className="bg-black/40 p-4 rounded-2xl border border-white/10 w-full md:w-64 space-y-2">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-text-muted">Progresso do Turno:</span>
            <span className={progressPct === 100 ? 'text-accent-success font-black' : 'text-accent-cyan'}>
              {completedCount}/{totalCount} ({progressPct}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${progressPct === 100 ? 'bg-accent-success' : 'bg-accent-cyan'}`} 
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Botões de Seleção da Máquina / Posto de Trabalho */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'router1', label: ' Router 1 (CNC)' },
          { id: 'router2', label: ' Router 2 (CNC)' },
          { id: 'laser', label: ' Laser CO₂ Ruida' },
          { id: 'geral', label: ' Inspeção Geral do Turno' }
        ].map(m => (
          <button
            key={m.id}
            onClick={() => setSelectedMachine(m.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedMachine === m.id
                ? 'bg-accent-cyan text-black font-black shadow-lg shadow-accent-cyan/20'
                : 'bg-white/5 text-text-muted hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Lista de Itens do Checklist */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-xs font-bold">Carregando itens do checklist...</div>
        ) : (
          allItems.map(item => {
            const isDone = checked.includes(item.index);
            return (
              <div
                key={item.index}
                onClick={() => toggleItem(item.index)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  isDone 
                    ? 'bg-accent-success/10 border-accent-success/30 text-white' 
                    : 'bg-white/5 border-white/5 hover:border-white/10 text-white/90'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                    isDone ? 'bg-accent-success border-accent-success text-black' : 'border-white/20 bg-black/40'
                  }`}>
                    {isDone && <CheckCircle2 size={16} strokeWidth={3} />}
                  </div>
                  <span className={`text-xs font-medium ${isDone ? 'line-through opacity-70' : ''}`}>
                    {item.text}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isDone && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent-success bg-accent-success/20 px-2.5 py-1 rounded-full">
                      Concluído por {operatorName}
                    </span>
                  )}
                  {canManageChecklist && item.id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleEditCustom(e, item)}
                        className="text-text-muted hover:text-accent-cyan p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                        title="Editar item do checklist"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteCustom(e, item)}
                        className="text-text-muted hover:text-red-400 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                        title="Excluir item do checklist"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Adicionar Item Personalizado ao Checklist (Apenas Gerente e Coordenador/Encarregado) */}
      {canManageChecklist && (
        <form onSubmit={handleAddCustom} className="flex gap-2 pt-2 border-t border-white/10">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder={`+ Adicionar novo item ao checklist de ${currentMachineData.name}...`}
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-accent-cyan"
          />
          <button
            type="submit"
            disabled={addingItem || !newItemText.trim()}
            className="px-5 py-2 bg-accent-cyan hover:bg-accent-cyan/80 disabled:opacity-50 text-black font-black uppercase text-xs rounded-xl transition-all shadow-md shadow-accent-cyan/20 cursor-pointer"
          >
            {addingItem ? '...' : '+ Adicionar'}
          </button>
        </form>
      )}
    </div>
  );
}
