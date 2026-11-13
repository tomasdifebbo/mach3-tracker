import React from 'react';
import { UserCheck, Play, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import { formatDuration } from './operadorUtils';

export function OperatorActiveMachines({
  jobs, routers, operatorName, kanbanTasks, isManagerOrEncarregado,
  operatorsList, availableOperators, activeCuttingJobs, now,
  selectedTaskToStart, setSelectedTaskToStart,
  handleStartManualJob, handleFinishManualJob,
  handleAssignOperatorToMachine, handleSetJobEstimate,
  fetchKanban, onRefresh
}) {
  return (
    <>
      {/* Painel de Previsão de Cortes em Andamento em Tempo Real */}
      {activeCuttingJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-accent-cyan flex items-center gap-2">
              <Play size={16} className="animate-pulse" fill="currentColor" />
              <span>Cortes em Andamento em Tempo Real ({activeCuttingJobs.length})</span>
            </h3>
            <span className="text-[10px] font-bold text-text-muted">Acompanhamento e Previsão ao Vivo</span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {activeCuttingJobs.map(job => {
              const startDt = new Date(job.start_time);
              const elapsedMin = Math.max(0, (now - startDt.getTime()) / 60000);
              const estMin = job.estimated_minutes;
              const hasEstimate = estMin && estMin > 0;
              const isOverdue = hasEstimate && elapsedMin > estMin;
              const overtimeMin = isOverdue ? (elapsedMin - estMin) : 0;
              const progress = hasEstimate ? Math.min(100, (elapsedMin / estMin) * 100) : null;
              const remaining = hasEstimate ? Math.max(0, estMin - elapsedMin) : null;
              const eta = hasEstimate ? new Date(startDt.getTime() + estMin * 60000) : null;
              const isNearEnd = progress !== null && progress >= 85 && !isOverdue;

              return (
                <div 
                  key={job.id}
                  className={`border rounded-2xl p-4 md:p-6 transition-all ${
                    isOverdue
                      ? 'bg-amber-500/10 border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.15)]'
                      : 'bg-accent-cyan/10 border border-accent-cyan/30 shadow-[0_0_30px_rgba(6,182,212,0.1)]'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 gap-4 md:gap-0">
                    <div className="flex items-center gap-4 md:gap-6">
                      <div className={`w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl flex items-center justify-center text-black ${
                        isOverdue
                          ? 'bg-amber-400 animate-pulse shadow-lg shadow-amber-500/20'
                          : isNearEnd 
                            ? 'bg-accent-success animate-pulse' 
                            : 'bg-accent-cyan animate-pulse'
                      }`}>
                        <Play size={20} className="md:w-6 md:h-6" fill="currentColor" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                            isOverdue 
                              ? 'text-amber-400 bg-amber-400/20 border border-amber-400/30' 
                              : 'text-accent-cyan bg-accent-cyan/20'
                          }`}>
                            {job.router_name || 'MÁQUINA'} - {isOverdue ? 'CORTANDO (TEMPO EXTRA)' : 'EM ANDAMENTO'}
                          </span>
                          <h3 className="text-lg font-bold text-white uppercase truncate max-w-xs md:max-w-md">{job.file_name}</h3>
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <p className="text-xs text-text-muted font-medium opacity-70 truncate max-w-[180px] sm:max-w-xs">{job.folder || 'Sem pasta / O.S. vinculada'}</p>
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="text-[11px] font-bold text-white flex items-center gap-1 shrink-0">
                              <UserCheck size={13} className="text-accent-cyan" /> Operador:
                            </span>
                            <select
                              value={job.operator_name || ''}
                              onChange={async (e) => {
                                const newOp = e.target.value;
                                try {
                                  await api.patch(`/jobs/${job.id}`, { operator_name: newOp });
                                  const targetRouter = routers.find(r => r.name && job.router_name && (
                                    r.name.toLowerCase().includes(job.router_name.toLowerCase()) || 
                                    job.router_name.toLowerCase().includes(r.name.toLowerCase()) ||
                                    (job.router_name.toLowerCase().includes('central') && r.name.toLowerCase().includes('router 1'))
                                  ));
                                  if (targetRouter) {
                                    await handleAssignOperatorToMachine(targetRouter.id, newOp);
                                  }
                                  if (onRefresh) await onRefresh();
                                  fetchKanban();
                                } catch (err) {
                                  console.error('Failed to link operator to active job:', err);
                                }
                              }}
                              className="bg-black/80 border border-accent-cyan/40 text-[11px] font-bold text-accent-cyan rounded-lg px-2 py-0.5 outline-none cursor-pointer hover:border-accent-cyan transition-colors"
                            >
                              <option value="" className="bg-zinc-900 text-white">-- Vincular Operador ao Corte --</option>
                              {availableOperators.map(op => (
                                <option key={op.id || op.name} value={op.name} className="bg-zinc-900 text-white">👷 {op.name}</option>
                              ))}
                              {operatorName && !operatorsList.some(o => o.name === operatorName) && (
                                <option value={operatorName} className="bg-zinc-900 text-white">👷 {operatorName}</option>
                              )}
                              {job.operator_name && !availableOperators.some(o => o.name === job.operator_name) && job.operator_name !== operatorName && (
                                <option value={job.operator_name} className="bg-zinc-900 text-white">👷 {job.operator_name} (alocado fora)</option>
                              )}
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <div className="text-2xl md:text-3xl font-mono font-bold text-accent-cyan tracking-tighter tabular-nums">
                         {formatDuration(elapsedMin)}
                      </div>
                      <button
                        onClick={() => {
                          const val = prompt('Digite o tempo estimado para este corte em minutos (ex: 45):', estMin || '30');
                          if (val && !isNaN(parseFloat(val))) {
                            handleSetJobEstimate(job, parseFloat(val));
                          }
                        }}
                        className="text-[10px] font-bold text-accent-cyan hover:text-white mt-1 underline cursor-pointer transition-colors block"
                        title="Clique para definir ou ajustar o tempo estimado em minutos"
                      >
                        {hasEstimate ? `Estimado: ${formatDuration(estMin)} ✏️` : `⏱️ Definir Tempo Estimado`}
                      </button>
                    </div>
                  </div>

                  {/* Barra de Progresso e Previsão ETA */}
                  {hasEstimate && (
                    <div className="mt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1.5 gap-1 sm:gap-0">
                        <span className={`text-xs font-bold ${
                          isOverdue 
                            ? 'text-amber-400' 
                            : isNearEnd 
                              ? 'text-accent-success' 
                              : 'text-accent-cyan'
                        }`}>
                          {isOverdue 
                            ? `+${Math.floor(overtimeMin)}min além do previsto` 
                            : `${Math.round(progress)}% do tempo previsto`
                          }
                        </span>
                        <span className="text-[10px] sm:text-xs font-bold text-text-muted">
                          {isOverdue 
                            ? '⏳ Máquina cortando · Aguardando término (M102)' 
                            : remaining > 0 
                              ? `Faltam ~${Math.ceil(remaining)}min · Previsão: ${eta.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}` 
                              : '⏳ Finalizando passes...'
                          }
                        </span>
                      </div>
                      <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden relative">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOverdue
                              ? 'bg-gradient-to-r from-amber-500 to-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                              : isNearEnd 
                                ? 'bg-gradient-to-r from-accent-cyan to-accent-success shadow-[0_0_12px_rgba(16,185,129,0.5)]' 
                                : 'bg-accent-cyan shadow-[0_0_12px_rgba(6,182,212,0.5)]'
                          }`}
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                        {isOverdue && (
                          <div className="absolute inset-0 bg-amber-400/20 animate-pulse rounded-full" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cards de Maquinário em Tempo Real com Seleção de Operador por Máquina */}
      {isManagerOrEncarregado && (
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
                  {availableOperators.map(op => (
                    <option key={op.id} value={op.name} className="bg-zinc-900 text-white">
                      👷 {op.name} ({op.shift})
                    </option>
                  ))}
                  {operatorName && !operatorsList.some(o => o.name === operatorName) && (
                    <option value={operatorName} className="bg-zinc-900 text-white">👷 {operatorName}</option>
                  )}
                  {m.operator_name && !availableOperators.some(o => o.name === m.operator_name) && m.operator_name !== operatorName && (
                    <option value={m.operator_name} className="bg-zinc-900 text-white">👷 {m.operator_name} (alocado fora)</option>
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
                      {kanbanTasks.filter(t => t.column_id === 'todo' || t.column_id === 'doing').map(t => (
                        <option key={t.id} value={t.title}>
                          {t.column_id === 'doing' ? '⚡ [Em Andamento] ' : '📋 [A Fazer] '}{t.title}
                        </option>
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
      )}
    </>
  );
}
