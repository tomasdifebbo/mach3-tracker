import React from 'react';
import { UserCheck, Play, CheckCircle2, Clock, RefreshCw, CalendarClock } from 'lucide-react';

export function OperatorTasksTab({
  activeTab, activeJobs, loadingTasks, operatorName,
  operatorsList, availableOperators, fetchKanban,
  handleMoveKanban, handleOpenReschedule, handleUpdateTaskOperator
}) {
  return (
    <>
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
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5" onClick={(e) => e.stopPropagation()}>
                          <span className="font-bold text-white flex items-center gap-1">
                            <UserCheck size={13} className="text-accent-cyan" /> Operador:
                          </span>
                          <select
                            value={task.operator || ''}
                            onChange={(e) => handleUpdateTaskOperator(task.id, e.target.value)}
                            className="bg-black/70 border border-accent-cyan/30 text-[11px] font-bold text-accent-cyan rounded-lg px-2.5 py-1 outline-none cursor-pointer hover:border-accent-cyan transition-colors"
                          >
                            <option value="" className="bg-zinc-900 text-white">-- Vincular Operador --</option>
                            {availableOperators.map(op => (
                              <option key={op.id || op.name} value={op.name} className="bg-zinc-900 text-white">👷 {op.name}</option>
                            ))}
                            {operatorName && !operatorsList.some(o => o.name === operatorName) && (
                              <option value={operatorName} className="bg-zinc-900 text-white">👷 {operatorName}</option>
                            )}
                            {task.operator && !availableOperators.some(o => o.name === task.operator) && task.operator !== operatorName && (
                              <option value={task.operator} className="bg-zinc-900 text-white">👷 {task.operator} (alocado fora)</option>
                            )}
                          </select>
                        </div>
                        {task.date && <p className="pt-1"><strong>Data Programada:</strong> {task.date}</p>}
                      </div>

                      {task.reschedule_reason && (
                        <div className="mt-3 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-[11px] text-yellow-300 space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold">
                            <CalendarClock size={13} className="text-yellow-400 shrink-0" />
                            <span>Reagendado {task.reschedule_count > 1 ? `(${task.reschedule_count}x)` : ''}:</span>
                          </div>
                          <p className="text-[10px] text-yellow-200/90 font-medium pl-4">Motivo: "{task.reschedule_reason}"</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-2">
                      {!isDoing ? (
                        <button
                          onClick={() => handleMoveKanban(task.id, 'doing')}
                          className="flex-1 py-2.5 bg-orange-500 hover:bg-orange-600 text-black font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Play size={14} /> Iniciar Produção
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMoveKanban(task.id, 'done')}
                          className="flex-1 py-2.5 bg-accent-success hover:bg-emerald-400 text-black font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <CheckCircle2 size={14} /> Marcar Concluído
                        </button>
                      )}

                      <button
                        onClick={() => handleOpenReschedule(task)}
                        className="px-3 py-2.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                        title="Reagendar esta Ordem de Serviço"
                      >
                        <CalendarClock size={15} />
                        <span>Reagendar</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
