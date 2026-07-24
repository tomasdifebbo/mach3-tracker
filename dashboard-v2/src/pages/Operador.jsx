import React, { useState, useEffect } from 'react';
import { 
  UserCheck, Play, CheckCircle2, AlertTriangle, Clock, 
  Wrench, CheckSquare, Layers, Cpu, ShieldAlert, Sparkles, RefreshCw
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

  useEffect(() => {
    fetchKanban();
  }, []);

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

        {/* Identificação do Operador */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 relative z-10 bg-white/5 p-3 rounded-2xl border border-white/10">
          <div className="text-xs font-bold text-text-muted flex items-center gap-2 px-2">
            <Wrench size={16} className="text-accent-cyan" />
            <span>Operador Atual:</span>
          </div>
          <input
            type="text"
            value={operatorName}
            onChange={handleNameChange}
            placeholder="Nome do Operador"
            className="bg-black/50 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-accent-cyan transition-colors"
          />
          <button
            onClick={() => setShowOccurrenceModal(true)}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          >
            <ShieldAlert size={16} />
            Reportar Falha
          </button>
        </div>
      </div>

      {/* Cards de Maquinário em Tempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {routers.map((m) => {
          const isCutting = m.status === 'cortando';
          return (
            <div key={m.id} className={`glass p-5 rounded-2xl border transition-all ${isCutting ? 'border-accent-cyan/40 bg-accent-cyan/5 shadow-xl shadow-accent-cyan/5' : 'border-white/5'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-black text-sm text-white">{m.name}</span>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${isCutting ? 'bg-accent-cyan text-black animate-pulse' : 'bg-white/10 text-text-muted'}`}>
                  {m.status?.toUpperCase() || 'PARADA'}
                </span>
              </div>
              <div className="space-y-2 text-xs text-text-muted">
                <div className="flex justify-between">
                  <span>Job Atual:</span>
                  <span className="text-white font-bold truncate max-w-[120px]">{m.current_job || 'Nenhum'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tempo Corrido:</span>
                  <span className="text-accent-cyan font-mono font-bold">{m.runtime || '00:00:00'}</span>
                </div>
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
      </div>

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

    </div>
  );
}
