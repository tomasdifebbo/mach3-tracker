import React from 'react';
import { Clock, RefreshCw, ChevronDown, Users } from 'lucide-react';
import { formatDuration, matchesOperatorLog, OPERATOR_STATUS_CONFIG } from './operadorUtils';

export function OperatorTeamPanel({
  operatorsList, timeLogs, availableOperators, unavailableCount,
  isManagerOrEncarregado, operatorName, routers,
  activeCuttingJobs, now, handleStatusSelect
}) {
  return (
    <>
      {/* Painel Equipe Hoje */}
      {operatorsList.length > 0 && (
        <div className="glass p-5 md:p-6 rounded-3xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
              <Users size={16} /> Equipe Hoje
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                ✅ {availableOperators.length} disponíveis
              </span>
              {unavailableCount > 0 && (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                  ⚠️ {unavailableCount} fora
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {operatorsList.map(op => {
              const st = OPERATOR_STATUS_CONFIG[op.status || 'disponivel'];
              const StatusIcon = st.icon;
              const isAvailable = (op.status || 'disponivel') === 'disponivel';
              
              // Check if operator is currently assigned to a machine
              const assignedRouter = routers.find(r => r.operator_name && r.operator_name.toLowerCase() === op.name.toLowerCase());
              const assignedJob = activeCuttingJobs.find(j => j.operator_name && j.operator_name.toLowerCase() === op.name.toLowerCase());
              const machineInfo = assignedRouter ? assignedRouter.name : (assignedJob ? assignedJob.router_name : null);

              return (
                <div key={op.id} className={`relative p-3.5 rounded-2xl border ${st.border} ${st.bg} transition-all hover:scale-[1.02]`}>
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className={`w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-sm font-black ${isAvailable ? 'bg-emerald-500/20 text-emerald-300' : st.bg + ' ' + st.color}`}>
                      {op.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{op.name}</p>
                      <p className="text-[10px] text-text-muted font-medium mt-0.5">Turno: {op.shift || 'Geral'}</p>
                      
                      {/* Status Badge */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className={`w-2 h-2 rounded-full ${st.dot} ${isAvailable && machineInfo ? 'animate-pulse' : ''}`} />
                        <span className={`text-[10px] font-bold ${st.color}`}>
                          {isAvailable && machineInfo ? `Na Máquina (${machineInfo})` : st.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Status Selector */}
                  <div className="mt-3 relative flex items-center gap-1.5">
                    <div className="flex-1">
                      <select
                        value={op.status || 'disponivel'}
                        onChange={(e) => {
                          handleStatusSelect(op, e.target.value);
                        }}
                        className={`w-full bg-black/40 border ${st.border} rounded-xl px-3 py-1.5 text-[11px] font-bold ${st.color} outline-none cursor-pointer appearance-none pr-7 transition-all hover:bg-black/60`}
                      >
                        <option value="disponivel" className="bg-zinc-900 text-white">🟢 Na Fábrica (Disponível)</option>
                        <option value="almoco" className="bg-zinc-900 text-white">🍱 Horário de Almoço</option>
                        <option value="limpeza" className="bg-zinc-900 text-white">🧹 Limpeza e Manutenção do Setor</option>
                        <option value="externo" className="bg-zinc-900 text-white">🟡 Serviço Externo</option>
                        <option value="outro_setor" className="bg-zinc-900 text-white">🔵 Outro Setor da Fábrica</option>
                        <option value="fim_expediente" className="bg-zinc-900 text-white">🏁 Fim de Expediente (Foi Embora)</option>
                        <option value="ausente" className="bg-zinc-900 text-white">⚫ Folga / Ausente</option>
                      </select>
                    </div>
                    {(!op.status || op.status === 'disponivel') && (
                      <button
                        onClick={() => handleStatusSelect(op, 'disponivel')}
                        title="Trocar Projeto / Nova O.S."
                        className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl px-2.5 py-1.5 hover:bg-emerald-500/30 hover:scale-105 transition-all flex items-center justify-center shrink-0"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <ChevronDown size={12} className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${st.color}`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Linha do Tempo da Equipe Hoje (Timesheet) */}
      {(operatorsList.length > 0 || timeLogs.length > 0) && (
        <div className="glass p-5 md:p-6 rounded-3xl border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-accent-cyan flex items-center gap-2">
              <Clock size={16} /> {isManagerOrEncarregado ? 'Linha do Tempo da Equipe Hoje (Rastreamento do Dia)' : 'Minha Linha do Tempo Hoje (Rastreamento do Dia)'}
            </h3>
            <span className="text-[10px] font-bold text-text-muted">Apontamento automático por período</span>
          </div>

          <div className="space-y-4 divide-y divide-white/5">
            {(isManagerOrEncarregado
              ? operatorsList
              : (operatorsList.filter(o => o.name.toLowerCase() === operatorName.toLowerCase()).length > 0
                  ? operatorsList.filter(o => o.name.toLowerCase() === operatorName.toLowerCase())
                  : operatorsList)
            ).map(op => {
              const opLogs = [...timeLogs.filter(l => matchesOperatorLog(l, op))];
              let activeLog = opLogs.find(l => !l.end_time);

              // Fallback imediato: se o operador estiver cortando na máquina, exibe o card ativo mesmo antes do recarregamento da API
              if (!activeLog) {
                const cuttingJob = activeCuttingJobs.find(j => 
                  (j.operator_name && j.operator_name.toLowerCase() === op.name.toLowerCase()) ||
                  (routers.some(r => r.name && j.router_name && r.name.toLowerCase() === j.router_name.toLowerCase() && r.operator_name && r.operator_name.toLowerCase() === op.name.toLowerCase()))
                );
                if (cuttingJob) {
                  const synthLog = {
                    id: `active-cut-${cuttingJob.id || op.id}`,
                    operator_id: op.id,
                    operator_name: op.name,
                    status: 'disponivel',
                    location: `⚙️ ${cuttingJob.router_name || 'Na Máquina'}`,
                    kanban_title: cuttingJob.file_name,
                    start_time: cuttingJob.start_time || new Date().toISOString(),
                    end_time: null
                  };
                  activeLog = synthLog;
                  opLogs.unshift(synthLog);
                }
              }

              const currentActivityLabel = activeLog
                ? (activeLog.kanban_title
                    ? `${activeLog.location || 'Na Máquina'} (${activeLog.kanban_title})`
                    : (activeLog.location || activeLog.status))
                : 'Sem registro';

              return (
                <div key={op.id} className="pt-3 first:pt-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">👷 {op.name}</span>
                      <span className="text-[10px] text-text-muted">Turno: {op.shift || 'Geral'}</span>
                    </div>
                    {activeLog && (
                      <span className="text-[10px] font-bold text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 px-2.5 py-0.5 rounded-full animate-pulse">
                        Em atividade: {currentActivityLabel}
                      </span>
                    )}
                  </div>

                  {opLogs.length === 0 ? (
                    <p className="text-[11px] text-text-muted italic pl-4">Nenhum registro de alocação hoje.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pl-2 border-l-2 border-accent-cyan/30">
                      {opLogs.map(log => {
                        const st = OPERATOR_STATUS_CONFIG[log.status || 'disponivel'] || OPERATOR_STATUS_CONFIG.disponivel;
                        const startStr = new Date(log.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        const endStr = log.end_time ? new Date(log.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Agora';
                        const durMin = log.duration_minutes || (log.end_time ? (new Date(log.end_time) - new Date(log.start_time)) / 60000 : (now - new Date(log.start_time).getTime()) / 60000);

                        return (
                          <div key={log.id} className={`p-2.5 rounded-xl border ${st.border} ${st.bg} space-y-1 text-xs shadow-sm`}>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className={`font-bold ${st.color}`}>{startStr} → {endStr} ({formatDuration(durMin)})</span>
                              <span className={`px-1.5 py-0.5 rounded font-black text-[9px] ${st.bg} ${st.color}`}>{st.label}</span>
                            </div>
                            <p className="font-bold text-white text-[11px] truncate flex items-center gap-1">
                              {log.location || st.label}
                            </p>
                            {log.kanban_title && (
                              <p className="text-[10px] text-purple-300 font-medium truncate flex items-center gap-1">
                                📋 O.S. / Arquivo: {log.kanban_title}
                              </p>
                            )}
                            {log.notes && (
                              <p className="text-[9px] text-text-muted italic truncate">Obs: {log.notes}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
