import React from 'react';
import { UserCheck, AlertTriangle, CalendarClock, Users } from 'lucide-react';
import { OPERATOR_STATUS_CONFIG } from './operadorUtils';

export function OperadorModals({
  kanbanTasks,
  showOccurrenceModal, setShowOccurrenceModal,
  occMachine, setOccMachine, occType, setOccType, occSeverity, setOccSeverity,
  occDesc, setOccDesc, submittingOcc, handleSubmitOccurrence,
  operatorsList, showOperatorsModal, setShowOperatorsModal,
  newOpName, setNewOpName, newOpShift, setNewOpShift, savingOp,
  handleAddOperator, handleDeleteOperator,
  rescheduleTask, setRescheduleTask, rescheduleDate, setRescheduleDate,
  rescheduleReason, setRescheduleReason, submittingReschedule, handleConfirmReschedule,
  pendingKanbanLink, setPendingKanbanLink, selectedKanbanTask, setSelectedKanbanTask,
  allocationNotes, setAllocationNotes, executeStatusUpdate
}) {
  return (
    <>
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
                  <option value="Router Central" className="bg-zinc-900">Router Central</option>
                  <option value="Router 2" className="bg-zinc-900">Router 2</option>
                  <option value="Laser" className="bg-zinc-900">Laser</option>
                  <option value="Mesa de Vácuo" className="bg-zinc-900">Mesa de Vácuo</option>
                  <option value="Geral" className="bg-zinc-900">Geral / Oficina</option>
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

      {/* Modal: Vincular Kanban O.S. ao Status */}
      {pendingKanbanLink && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setPendingKanbanLink(null)} />
          
          <div className="relative z-10 w-full max-w-md bg-zinc-950 border border-purple-500/40 p-6 rounded-3xl shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Users size={18} className="text-purple-400" />
                <h3 className="font-bold text-sm">Alocação de {pendingKanbanLink.op.name}</h3>
              </div>
              <button onClick={() => setPendingKanbanLink(null)} className="text-text-muted hover:text-white">✕</button>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-text-muted">Novo Status: <strong className="text-white">{OPERATOR_STATUS_CONFIG[pendingKanbanLink.newStatus]?.label}</strong></p>
              <p className="text-xs text-text-muted">Deseja vincular este período a uma Ordem de Serviço (Kanban)?</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-purple-300 block mb-1">Ordem de Serviço (Kanban)</label>
                <select
                  value={selectedKanbanTask}
                  onChange={(e) => setSelectedKanbanTask(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="">-- Nenhuma O.S. (Atividade Geral) --</option>
                  {kanbanTasks.map(t => (
                    <option key={t.id} value={t.id}>
                      [{t.column_id === 'doing' ? 'EM ANDAMENTO' : 'A FAZER'}] {t.title} {t.operator ? `(${t.operator})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-purple-300 block mb-1">Observações / Detalhes do Local (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Instalação no Cliente ABC / Setor de Pintura"
                  value={allocationNotes}
                  onChange={(e) => setAllocationNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <button
                onClick={() => executeStatusUpdate(pendingKanbanLink.op.id, pendingKanbanLink.newStatus, pendingKanbanLink.newLocation, null, null, null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-text-muted hover:text-white transition-all cursor-pointer"
              >
                Pular (Sem O.S.)
              </button>
              <button
                onClick={() => {
                  const matchedTask = kanbanTasks.find(t => String(t.id) === String(selectedKanbanTask));
                  const kanbanTitle = matchedTask ? matchedTask.title : null;
                  const loc = allocationNotes.trim() || pendingKanbanLink.newLocation;
                  executeStatusUpdate(
                    pendingKanbanLink.op.id,
                    pendingKanbanLink.newStatus,
                    loc,
                    selectedKanbanTask || null,
                    kanbanTitle,
                    allocationNotes.trim() || null
                  );
                }}
                className="px-5 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
              >
                Confirmar Alocação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Reagendar Ordem de Serviço */}
      {rescheduleTask && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setRescheduleTask(null)} />
          
          <form onSubmit={handleConfirmReschedule} className="relative z-10 w-full max-w-md bg-zinc-950 border border-yellow-500/30 p-6 md:p-8 rounded-3xl shadow-2xl space-y-5 text-white">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <div className="p-3 bg-yellow-500/20 text-yellow-400 rounded-2xl">
                <CalendarClock size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Reagendar O.S.</h3>
                <p className="text-xs text-text-muted truncate max-w-[260px]">{rescheduleTask.title}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-text-muted block mb-1.5">Nova Data Prevista</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-yellow-500 cursor-pointer"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-text-muted block mb-1.5">Motivo do Reagendamento *</label>
                <textarea
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Ex: Falta de insumo MDF 15mm, Manutenção na Router 1, Troca de fresa..."
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-xs text-white outline-none focus:border-yellow-500 resize-none"
                  required
                />
              </div>

              {/* Chips de motivos frequentes */}
              <div className="space-y-1">
                <span className="text-[9px] font-bold uppercase text-text-muted">Motivos Frequentes:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    '📦 Falta de Insumo / Material',
                    '🛠️ Manutenção na Máquina',
                    '⚡ Troca de Fresa / Ferramenta',
                    '📋 Reorganização da Fila',
                    '👥 Aguardando Aprovação'
                  ].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setRescheduleReason(chip)}
                      className="px-2.5 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] text-text-muted hover:text-white transition-all cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                onClick={() => setRescheduleTask(null)}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-text-muted hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submittingReschedule || !rescheduleReason.trim()}
                className="px-5 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black font-black uppercase text-xs rounded-xl transition-all shadow-lg shadow-yellow-500/20 cursor-pointer"
              >
                {submittingReschedule ? 'Reagendando...' : 'Confirmar Reagendamento'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
