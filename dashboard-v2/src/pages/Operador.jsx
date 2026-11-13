import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  UserCheck, Wrench, CheckSquare, Layers, ShieldAlert, Utensils, LogOut
} from 'lucide-react';
import { api } from '../services/api';
import {
  getLocalTodayStr, getDateRange, OPERATOR_STATUS_CONFIG
} from '../components/operador/operadorUtils';
import { OperatorTeamPanel } from '../components/operador/OperatorTeamPanel';
import { OperatorTimelineArchive } from '../components/operador/OperatorTimelineArchive';
import { OperatorActiveMachines } from '../components/operador/OperatorActiveMachines';
import { OperatorTasksTab } from '../components/operador/OperatorTasksTab';
import { OperadorModals } from '../components/operador/OperadorModals';
import { OperadorChecklist } from '../components/operador/OperadorChecklist';

export function Operador({ jobs = [], routers = [], onRefresh }) {
  const [operatorName, setOperatorName] = useState(localStorage.getItem('mach3_operator_name') || 'Operador Principal');
  const [activeTab, setActiveTab] = useState('os'); // 'os' | 'checklists' | 'ocorrencia'
  const [kanbanTasks, setKanbanTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  const deviceRole = localStorage.getItem('mach3_device_role') || 'gerente';
  const isManagerOrEncarregado = deviceRole === 'gerente' || deviceRole === 'encarregado';

  // Quick occurrence form
  const [showOccurrenceModal, setShowOccurrenceModal] = useState(false);
  const [occMachine, setOccMachine] = useState('Router Central');
  const [occType, setOccType] = useState('Fresa cega / quebrada');
  const [occSeverity, setOccSeverity] = useState('media');
  const [occDesc, setOccDesc] = useState('');
  const [submittingOcc, setSubmittingOcc] = useState(false);

  const [operatorsList, setOperatorsList] = useState([]);
  const [showOperatorsModal, setShowOperatorsModal] = useState(false);
  const [newOpName, setNewOpName] = useState('');
  const [newOpShift, setNewOpShift] = useState('Geral');
  const [savingOp, setSavingOp] = useState(false);

  // Reschedule Modal State
  const [rescheduleTask, setRescheduleTask] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const handleOpenReschedule = (task) => {
    setRescheduleTask(task);
    setRescheduleDate(new Date().toISOString().split('T')[0]);
    setRescheduleReason('');
  };

  const handleConfirmReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleTask || !rescheduleReason.trim()) return;
    setSubmittingReschedule(true);
    try {
      await api.rescheduleKanban(rescheduleTask.id, rescheduleDate, rescheduleReason.trim());
      alert('Ordem de serviço reagendada com sucesso!');
      setRescheduleTask(null);
      fetchKanban();
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Erro ao reagendar O.S.: ' + err.message);
    } finally {
      setSubmittingReschedule(false);
    }
  };

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
      if (Array.isArray(data) && data.length > 0) setOperatorsList(data);
    } catch (err) {
      console.error('Failed to load operators:', err);
    }
  };

  // Time logs and Kanban linking states
  const [timeLogs, setTimeLogs] = useState([]);
  const [pendingKanbanLink, setPendingKanbanLink] = useState(null);
  const [selectedKanbanTask, setSelectedKanbanTask] = useState('');
  const [allocationNotes, setAllocationNotes] = useState('');

  // Timeline archive states
  const [timelinePeriod, setTimelinePeriod] = useState('semana'); // 'hoje' | 'semana' | 'mes' | 'custom'
  const [archiveLogs, setArchiveLogs] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [filterOperator, setFilterOperator] = useState('all');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');


  const fetchTimeLogs = useCallback(async () => {
    try {
      const todayStr = getLocalTodayStr();
      const data = await api.getOperatorTimeLogs(todayStr);
      if (Array.isArray(data)) {
        setTimeLogs(data);
      }
    } catch (err) {
      console.error('Failed to load time logs:', err);
    }
  }, []);

  const fetchArchiveLogs = useCallback(async () => {
    setArchiveLoading(true);
    try {
      const { from, to } = getDateRange(timelinePeriod, customDateFrom, customDateTo);
      const data = await api.getOperatorTimeLogsRange(from, to);
      if (Array.isArray(data)) setArchiveLogs(data);
    } catch (err) {
      console.error('Failed to load archive logs:', err);
    } finally {
      setArchiveLoading(false);
    }
  }, [timelinePeriod, customDateFrom, customDateTo]);

  useEffect(() => {
    fetchKanban();
    fetchOperators();
    fetchTimeLogs();
    fetchArchiveLogs();

    const interval = setInterval(() => {
      fetchTimeLogs();
    }, 8000);

    return () => clearInterval(interval);
  }, [fetchTimeLogs, fetchArchiveLogs]);

  // Recarrega automaticamente quando o período da timeline muda
  useEffect(() => {
    if (timelinePeriod !== 'custom' || (customDateFrom && customDateTo)) {
      fetchArchiveLogs();
    }
  }, [timelinePeriod, customDateFrom, customDateTo, fetchArchiveLogs]);

  // Sincroniza em tempo real quando qualquer informação do Histórico (jobs) é alterada!
  useEffect(() => {
    fetchOperators();
    fetchTimeLogs();
    if (timelinePeriod !== 'custom' || (customDateFrom && customDateTo)) {
      fetchArchiveLogs();
    }
  }, [jobs, timelinePeriod, customDateFrom, customDateTo, fetchTimeLogs, fetchArchiveLogs]);

  const handleAddOperator = async (e) => {
    e.preventDefault();
    if (!newOpName.trim()) return;
    setSavingOp(true);
    try {
      await api.addOperator(newOpName.trim(), newOpShift);
      setNewOpName('');
      await fetchOperators();
      await fetchTimeLogs();
      if (onRefresh) onRefresh();
    } catch {
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
    } catch {
      alert('Erro ao remover operador');
    }
  };

  const handleAssignOperatorToMachine = async (routerId, opName) => {
    try {
      await api.updateRouterOperator(routerId, opName);
      if (onRefresh) onRefresh();
    } catch {
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
    } catch {
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
    } catch {
      alert('Erro ao registrar ocorrência.');
    } finally {
      setSubmittingOcc(false);
    }
  };

  const activeJobs = kanbanTasks.filter(t => t.column_id === 'doing' || t.column_id === 'todo');

  // Operator status management
  const handleStatusSelect = (op, newStatus) => {
    const loc = OPERATOR_STATUS_CONFIG[newStatus]?.label || '';
    if (newStatus === 'externo' || newStatus === 'outro_setor' || newStatus === 'limpeza' || newStatus === 'disponivel') {
      setPendingKanbanLink({ op, newStatus, newLocation: loc });
      setSelectedKanbanTask('');
      setAllocationNotes('');
    } else {
      executeStatusUpdate(op.id, newStatus, loc, null, null, null);
    }
  };

  const executeStatusUpdate = async (opId, newStatus, newLocation, kanbanId, kanbanTitle, notes) => {
    try {
      await api.updateOperatorStatus(opId, newStatus, newLocation, kanbanId, kanbanTitle, notes);
      setPendingKanbanLink(null);
      fetchOperators();
      fetchTimeLogs();
      fetchKanban();
    } catch {
      alert('Erro ao atualizar status do operador');
    }
  };

  const availableOperators = useMemo(() => operatorsList.filter(op => (op.status || 'disponivel') === 'disponivel'), [operatorsList]);
  const unavailableCount = operatorsList.length - availableOperators.length;

  const activeCuttingJobs = React.useMemo(() => {
    const openFromJobs = jobs.filter(j => !j.end_time);
    const list = [...openFromJobs];

    routers.forEach(r => {
      if ((r.status === 'cortando' || r.current_job) && r.start_time) {
        const existing = list.find(j => 
          (j.router_name && r.name && j.router_name.toLowerCase() === r.name.toLowerCase()) ||
          (j.file_name && r.current_job && j.file_name.toLowerCase() === r.current_job.toLowerCase())
        );
        if (!existing) {
          list.push({
            id: r.current_job_id || `router-${r.id}`,
            file_name: r.current_job || 'Corte em Andamento',
            folder: r.operator_name ? `Operador: ${r.operator_name}` : 'Produção ativa na máquina',
            router_name: r.name,
            operator_name: r.operator_name || null,
            start_time: r.start_time,
            estimated_minutes: r.estimated_minutes
          });
        }
      }
    });

    return list;
  }, [jobs, routers]);

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
    } catch {
      alert('Erro ao iniciar O.S. na máquina');
    }
  };

  const handleFinishManualJob = async (routerName) => {
    try {
      await api.patch('/jobs/latest', { router_name: routerName });
      if (onRefresh) await onRefresh();
      fetchKanban();
    } catch {
      alert('Erro ao finalizar job na máquina');
    }
  };

  const handleUpdateTaskOperator = async (taskId, newOperator) => {
    try {
      await api.patch(`/kanban/${taskId}`, { operator: newOperator });
      fetchKanban();
    } catch (err) {
      console.error('Failed to update task operator:', err);
    }
  };

  const handleSetJobEstimate = async (job, minutes) => {
    try {
      if (job.id && typeof job.id === 'number') {
        await api.patch(`/jobs/${job.id}`, { estimated_minutes: minutes });
      }
      const kTasks = await api.getKanban();
      if (Array.isArray(kTasks)) {
        const matchK = kTasks.find(t => job.file_name && t.title && (t.title.toLowerCase().includes(job.file_name.toLowerCase()) || job.file_name.toLowerCase().includes(t.title.toLowerCase())));
        if (matchK) {
          await api.patch(`/kanban/${matchK.id}`, { estimated_minutes: minutes });
        }
      }
      if (onRefresh) await onRefresh();
      fetchKanban();
    } catch (err) {
      console.error('Erro ao definir tempo estimado:', err);
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
          {/* Botão de Almoço do Operador */}
          {(() => {
            const currentOp = operatorsList.find(o => o.name.toLowerCase() === operatorName.toLowerCase()) || operatorsList[0];
            const inLunch = currentOp && currentOp.status === 'almoco';

            return (
              <button
                onClick={() => {
                  if (!currentOp) {
                    alert('Nenhum operador selecionado.');
                    return;
                  }
                  if (inLunch) {
                    executeStatusUpdate(currentOp.id, 'disponivel', 'Na Fábrica', null, null, null);
                  } else {
                    executeStatusUpdate(currentOp.id, 'almoco', 'Horário de Almoço', null, null, null);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                  inLunch
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20 animate-pulse'
                    : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black shadow-orange-500/20'
                }`}
              >
                <Utensils size={16} />
                {inLunch ? '🟢 Voltar do Almoço' : '🍱 Ir para o Almoço'}
              </button>
            );
          })()}

          {/* Botão de Fim de Expediente do Operador */}
          {(() => {
            const currentOp = operatorsList.find(o => o.name.toLowerCase() === operatorName.toLowerCase()) || operatorsList[0];
            const isFimExpediente = currentOp && currentOp.status === 'fim_expediente';

            return (
              <button
                onClick={() => {
                  if (!currentOp) {
                    alert('Nenhum operador selecionado.');
                    return;
                  }
                  if (isFimExpediente) {
                    executeStatusUpdate(currentOp.id, 'disponivel', 'Na Fábrica', null, null, null);
                  } else {
                    executeStatusUpdate(currentOp.id, 'fim_expediente', 'Fim de Expediente', null, null, null);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg ${
                  isFimExpediente
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20 animate-pulse'
                    : 'bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 shadow-purple-500/10'
                }`}
                title={isFimExpediente ? 'Clique para retornar ao trabalho e iniciar novo expediente' : 'Clique para encerrar expediente do operador (saída)'}
              >
                <LogOut size={16} />
                {isFimExpediente ? '🟢 Iniciar Expediente' : '🏁 Encerrar Expediente'}
              </button>
            );
          })()}

          <button
            onClick={() => setShowOccurrenceModal(true)}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <ShieldAlert size={16} />
            Reportar Falha
          </button>
        </div>
      </div>


      <OperatorTeamPanel
        operatorsList={operatorsList}
        timeLogs={timeLogs}
        availableOperators={availableOperators}
        unavailableCount={unavailableCount}
        isManagerOrEncarregado={isManagerOrEncarregado}
        operatorName={operatorName}
        routers={routers}
        activeCuttingJobs={activeCuttingJobs}
        now={now}
        handleStatusSelect={handleStatusSelect}
      />

      <OperatorTimelineArchive
        operatorsList={operatorsList}
        timeLogs={timeLogs}
        archiveLogs={archiveLogs}
        archiveLoading={archiveLoading}
        timelinePeriod={timelinePeriod}
        setTimelinePeriod={setTimelinePeriod}
        filterOperator={filterOperator}
        setFilterOperator={setFilterOperator}
        customDateFrom={customDateFrom}
        setCustomDateFrom={setCustomDateFrom}
        customDateTo={customDateTo}
        setCustomDateTo={setCustomDateTo}
        fetchArchiveLogs={fetchArchiveLogs}
      />

      <OperatorActiveMachines
        jobs={jobs}
        routers={routers}
        operatorName={operatorName}
        kanbanTasks={kanbanTasks}
        isManagerOrEncarregado={isManagerOrEncarregado}
        operatorsList={operatorsList}
        availableOperators={availableOperators}
        activeCuttingJobs={activeCuttingJobs}
        now={now}
        selectedTaskToStart={selectedTaskToStart}
        setSelectedTaskToStart={setSelectedTaskToStart}
        handleStartManualJob={handleStartManualJob}
        handleFinishManualJob={handleFinishManualJob}
        handleAssignOperatorToMachine={handleAssignOperatorToMachine}
        handleSetJobEstimate={handleSetJobEstimate}
        fetchKanban={fetchKanban}
        onRefresh={onRefresh}
      />

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
        <OperadorChecklist operatorName={operatorName} />
      )}


      <OperatorTasksTab
        activeTab={activeTab}
        activeJobs={activeJobs}
        loadingTasks={loadingTasks}
        operatorName={operatorName}
        operatorsList={operatorsList}
        availableOperators={availableOperators}
        fetchKanban={fetchKanban}
        handleMoveKanban={handleMoveKanban}
        handleOpenReschedule={handleOpenReschedule}
        handleUpdateTaskOperator={handleUpdateTaskOperator}
      />

      <OperadorModals
        kanbanTasks={kanbanTasks}
        showOccurrenceModal={showOccurrenceModal}
        setShowOccurrenceModal={setShowOccurrenceModal}
        occMachine={occMachine}
        setOccMachine={setOccMachine}
        occType={occType}
        setOccType={setOccType}
        occSeverity={occSeverity}
        setOccSeverity={setOccSeverity}
        occDesc={occDesc}
        setOccDesc={setOccDesc}
        submittingOcc={submittingOcc}
        handleSubmitOccurrence={handleSubmitOccurrence}
        operatorsList={operatorsList}
        showOperatorsModal={showOperatorsModal}
        setShowOperatorsModal={setShowOperatorsModal}
        newOpName={newOpName}
        setNewOpName={setNewOpName}
        newOpShift={newOpShift}
        setNewOpShift={setNewOpShift}
        savingOp={savingOp}
        handleAddOperator={handleAddOperator}
        handleDeleteOperator={handleDeleteOperator}
        rescheduleTask={rescheduleTask}
        setRescheduleTask={setRescheduleTask}
        rescheduleDate={rescheduleDate}
        setRescheduleDate={setRescheduleDate}
        rescheduleReason={rescheduleReason}
        setRescheduleReason={setRescheduleReason}
        submittingReschedule={submittingReschedule}
        handleConfirmReschedule={handleConfirmReschedule}
        pendingKanbanLink={pendingKanbanLink}
        setPendingKanbanLink={setPendingKanbanLink}
        selectedKanbanTask={selectedKanbanTask}
        setSelectedKanbanTask={setSelectedKanbanTask}
        allocationNotes={allocationNotes}
        setAllocationNotes={setAllocationNotes}
        executeStatusUpdate={executeStatusUpdate}
      />

    </div>
  );
}
