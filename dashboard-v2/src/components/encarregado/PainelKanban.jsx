import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { CheckCircle2, Plus, CalendarClock, Archive } from 'lucide-react';
import { api } from '../../services/api';
import { LinkProjectModal } from '../LinkProjectModal';
import { SectionHeader } from './EncarregadoShared';
import { PRIORITY_CONFIG, INITIAL_CARDS, KANBAN_COLS, STAR_LABELS, matchKanbanTitle } from './kanbanUtils';
import { KanbanCard } from './KanbanCard';
import { QualityModal, KanbanCardModal } from './KanbanModals';

export function PainelKanban({ jobs = [] }) {
  const [columns, setColumns] = useState({ todo: [], doing: [], done: [] });
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [queuedForDone, setQueuedForDone] = useState(null); // card waiting for quality check
  const [showArchive, setShowArchive] = useState(false);
  const [archive, setArchive] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archivingAll, setArchivingAll] = useState(false);
  const [selectedLinkJob, setSelectedLinkJob] = useState(null);
  const [selectedLinkRouter, setSelectedLinkRouter] = useState('');

  const [operatorsList, setOperatorsList] = useState([]);

  useEffect(() => {
    const fetchOperators = async () => {
      try {
        const ops = await api.getOperators();
        if (Array.isArray(ops)) setOperatorsList(ops);
      } catch (err) {
        console.error('Failed to load operators:', err);
      }
    };
    fetchOperators();
  }, []);

  const handleUpdateTaskOperator = async (cardId, newOperator) => {
    try {
      await api.patch(`/kanban/${cardId}`, { operator: newOperator });
      setColumns(prev => {
        const next = { ...prev };
        for (const colId in next) {
          next[colId] = next[colId].map(c => 
            String(c.id) === String(cardId) ? { ...c, operator: newOperator } : c
          );
        }
        return next;
      });
    } catch (err) {
      console.error('Failed to update card operator:', err);
      loadKanban();
    }
  };

  // Reschedule Modal State
  const [rescheduleCard, setRescheduleCard] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const handleOpenReschedule = (card) => {
    setRescheduleCard(card);
    setRescheduleDate(new Date().toISOString().split('T')[0]);
    setRescheduleReason('');
  };

  const handleConfirmReschedule = async (e) => {
    e.preventDefault();
    if (!rescheduleCard || !rescheduleReason.trim()) return;
    setSubmittingReschedule(true);
    try {
      await api.rescheduleKanban(rescheduleCard.id, rescheduleDate, rescheduleReason.trim());
      setRescheduleCard(null);
      loadKanban();
    } catch (err) {
      alert('Erro ao reagendar O.S.: ' + err.message);
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const dragCard = React.useRef(null);
  const dragFrom = React.useRef(null);

  const unmatchedActiveJobs = useMemo(() => {
    const activeJobs = jobs.filter(j => !j.end_time);
    const allCards = [...(columns.todo || []), ...(columns.doing || []), ...(columns.done || [])];
    return activeJobs.filter(job => {
      // Find if there is any card that matches this job
      const hasMatch = allCards.some(card => matchKanbanTitle(job.file_name, job.folder, card.title));
      return !hasMatch;
    });
  }, [jobs, columns]);

  const buildInitial = useCallback(() => {
    const realActive = jobs.filter(j => !j.end_time).slice(0, 4).map(j => ({
      title: j.job_name, machine: j.router_name, operator: 'Operador', priority: 'alta', column_id: 'doing'
    }));
    const realDone = jobs.filter(j => j.end_time).slice(0, 3).map(j => ({
      title: j.job_name, machine: j.router_name, date: 'Entregue', priority: 'baixa', column_id: 'done'
    }));
    const todoCards = INITIAL_CARDS.todo.map(c => ({ ...c, column_id: 'todo' }));
    const doingCards = realActive.length > 0 ? realActive : INITIAL_CARDS.doing.map(c => ({ ...c, column_id: 'doing' }));
    const doneCards = realDone.length > 0 ? realDone : INITIAL_CARDS.done.map(c => ({ ...c, column_id: 'done' }));

    return [...todoCards, ...doingCards, ...doneCards];
  }, [jobs]);

  const loadKanban = useCallback(async () => {
    setLoading(true);
    try {
      let cards = await api.get('/kanban');
      if (Array.isArray(cards) && cards.length > 0) {
        localStorage.setItem('mach3_kanban_initialized', '1');
      } else if ((!Array.isArray(cards) || cards.length === 0) && !localStorage.getItem('mach3_kanban_initialized')) {
        const existingArchive = await api.get('/kanban/archive').catch(() => []);
        if (!Array.isArray(existingArchive) || existingArchive.length === 0) {
          const initial = buildInitial();
          cards = await api.post('/kanban/batch', initial);
        }
        localStorage.setItem('mach3_kanban_initialized', '1');
      }
      if (!Array.isArray(cards)) cards = [];
      const cols = { todo: [], doing: [], done: [] };
      cards.forEach(c => {
        if (cols[c.column_id]) {
          cols[c.column_id].push(c);
        }
      });
      setColumns(cols);
    } catch (err) {
      console.error('Failed to load kanban:', err);
    } finally {
      setLoading(false);
    }
  }, [buildInitial]);

  useEffect(() => {
    loadKanban();
  }, [loadKanban]);

  // Automatic verification and sync between Router jobs and Kanban cards
  useEffect(() => {
    if (!jobs || jobs.length === 0) return;

    const activeJobs = jobs.filter(j => !j.end_time);
    const todayStr = new Date().toISOString().split('T')[0];
    const completedJobs = jobs.filter(j => j.end_time && j.end_time >= todayStr);

    setColumns(prev => {
      let hasChanges = false;
      const newCols = {
        todo: [...(prev.todo || [])],
        doing: [...(prev.doing || [])],
        done: [...(prev.done || [])]
      };

      // 1. Check running jobs vs TODO cards -> Move to DOING
      for (const card of prev.todo || []) {
        const match = activeJobs.find(j => matchKanbanTitle(j.file_name, j.folder, card.title));
        if (match) {
          hasChanges = true;
          const routerName = match.router_name || card.machine;
          newCols.todo = newCols.todo.filter(c => String(c.id) !== String(card.id));
          newCols.doing.push({ ...card, column_id: 'doing', machine: routerName });
          api.patch(`/kanban/${card.id}`, { column_id: 'doing', machine: routerName }).catch(console.error);
        }
      }

      // 2. Check completed jobs vs DOING cards -> Move to DONE (ONLY if NOT currently running)
      for (const card of prev.doing || []) {
        const stillRunning = activeJobs.some(j => matchKanbanTitle(j.file_name, j.folder, card.title));
        if (!stillRunning) {
          const match = completedJobs.find(j => matchKanbanTitle(j.file_name, j.folder, card.title));
          if (match) {
            hasChanges = true;
            newCols.doing = newCols.doing.filter(c => String(c.id) !== String(card.id));
            newCols.done.push({ ...card, column_id: 'done' });
            api.patch(`/kanban/${card.id}`, { column_id: 'done' }).catch(console.error);
          }
        }
      }

      return hasChanges ? newCols : prev;
    });
  }, [jobs]);

  const handleDragStart = (e, cardId, colId) => {
    dragCard.current = cardId;
    dragFrom.current = colId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = async (e, targetCol) => {
    e.preventDefault();
    const cardId = dragCard.current;
    const fromCol = dragFrom.current;
    if (!cardId || !fromCol || fromCol === targetCol) return;

    // If dropping into 'done', intercept and show quality modal
    if (targetCol === 'done') {
      const card = columns[fromCol].find(c => String(c.id) === String(cardId));
      if (card) {
        setQueuedForDone({ card, fromCol });
        dragCard.current = null;
        dragFrom.current = null;
        return;
      }
    }

    // Optimistic UI update for other columns
    setColumns(prev => {
      const card = prev[fromCol].find(c => String(c.id) === String(cardId));
      if (!card) return prev;
      return {
        ...prev,
        [fromCol]: prev[fromCol].filter(c => String(c.id) !== String(cardId)),
        [targetCol]: [...prev[targetCol], { ...card, column_id: targetCol }],
      };
    });

    try {
      await api.patch(`/kanban/${cardId}`, { column_id: targetCol });
    } catch (err) {
      console.error('Failed to update card column:', err);
      loadKanban();
    }

    dragCard.current = null;
    dragFrom.current = null;
  };

  const handleArchiveConfirm = async ({ rating, qtyApproved, qtyRejected, observations }) => {
    if (!queuedForDone) return;
    const { card, fromCol } = queuedForDone;
    // Optimistically remove from active column
    setColumns(prev => ({
      ...prev,
      [fromCol]: prev[fromCol].filter(c => String(c.id) !== String(card.id)),
    }));
    setQueuedForDone(null);
    try {
      await api.post('/kanban/archive', {
        kanban_id: card.id,
        title: card.title,
        machine: card.machine,
        operator: card.operator,
        priority: card.priority,
        quality_rating: rating,
        qty_approved: qtyApproved,
        qty_rejected: qtyRejected,
        observations,
      });
    } catch (err) {
      console.error(err);
      loadKanban();
    }
  };

  const handleArchiveAllDone = async () => {
    const doneCards = columns.done || [];
    if (doneCards.length === 0 || archivingAll) return;
    if (!confirm(`Deseja arquivar todas as ${doneCards.length} O.S. concluídas?`)) return;

    setArchivingAll(true);
    localStorage.setItem('mach3_kanban_initialized', '1');
    setColumns(prev => ({ ...prev, done: [] }));

    try {
      const res = await api.post('/kanban/archive-all', { cards: doneCards });
      if (!res || res.error) {
        await Promise.all(
          doneCards.map(card =>
            api.post('/kanban/archive', {
              kanban_id: typeof card.id === 'number' || /^\d+$/.test(String(card.id)) ? card.id : null,
              title: card.title,
              machine: card.machine,
              operator: card.operator,
              priority: card.priority || 'media',
              quality_rating: 5,
              qty_approved: 1,
              qty_rejected: 0,
              observations: 'Arquivado em lote',
            })
          )
        );
      }
      if (showArchive) {
        loadArchive();
      }
    } catch (err) {
      console.error('Erro ao arquivar todas as O.S.:', err);
      loadKanban();
    } finally {
      setArchivingAll(false);
    }
  };

  const loadArchive = async () => {
    setArchiveLoading(true);
    try {
      const data = await api.get('/kanban/archive');
      if (Array.isArray(data)) setArchive(data);
    } catch (err) { console.error(err); }
    finally { setArchiveLoading(false); }
  };

  const toggleArchive = () => {
    setShowArchive(v => {
      if (!v) loadArchive();
      return !v;
    });
  };

  const handleSaveCard = async (updatedCard) => {
    if (updatedCard.id) {
      const saved = await api.patch(`/kanban/${updatedCard.id}`, updatedCard);
      setColumns(prev => {
        const col = updatedCard.column_id;
        return {
          ...prev,
          [col]: prev[col].map(c => String(c.id) === String(updatedCard.id) ? saved : c)
        };
      });
    } else {
      const saved = await api.post('/kanban', updatedCard);
      setColumns(prev => {
        const col = updatedCard.column_id || 'todo';
        return {
          ...prev,
          [col]: [...prev[col], saved]
        };
      });
    }
  };

  const handleDeleteCard = async (cardId) => {
    try {
      await api.deleteCustom(`/kanban/${cardId}`);
      setColumns(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => {
          next[k] = next[k].filter(c => String(c.id) !== String(cardId));
        });
        return next;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleReset = async () => {
    if (confirm('Deseja resetar o painel Kanban para o estado padrão? Isso removerá as posições manuais.')) {
      setLoading(true);
      try {
        const initial = buildInitial();
        const cards = await api.post('/kanban/batch', initial);
        const cols = { todo: [], doing: [], done: [] };
        cards.forEach(c => {
          if (cols[c.column_id]) {
            cols[c.column_id].push(c);
          }
        });
        setColumns(cols);
      } catch (err) {
        console.error('Failed to reset kanban:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading && columns.todo.length === 0 && columns.doing.length === 0 && columns.done.length === 0) {
    return (
      <div className="flex items-center justify-center p-20 text-orange-400 font-bold">
        Carregando Kanban...
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader label="Gestão de Produção" title="Painel Kanban">
        <button
          type="button"
          onClick={() => setSelectedCard({ column_id: 'todo' })}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-orange-500 hover:bg-orange-400 text-black font-black uppercase tracking-wider rounded-xl text-xs transition-all shadow-lg shadow-orange-500/20 cursor-pointer"
        >
          <Plus size={15} strokeWidth={3} />
          <span>Adicionar O.S.</span>
        </button>
      </SectionHeader>

      {/* Alerta de cortes não identificados */}
      {unmatchedActiveJobs.length > 0 && (
        <div className="flex flex-col gap-3">
          {unmatchedActiveJobs.map(job => (
            <div key={job.id} className="glass rounded-2xl p-5 border border-orange-500/20 border-l-4 border-l-orange-500 bg-orange-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                  ⚠️
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-white">Máquina em corte sem O.S. vinculada!</h4>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    A máquina <strong className="text-orange-400">{job.router_name}</strong> está rodando o arquivo "<strong className="text-white">{job.file_name}</strong>".
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedLinkJob(job);
                  setSelectedLinkRouter(job.router_name);
                }}
                className="self-start sm:self-center px-4 py-2 bg-orange-500 hover:bg-orange-600 text-black font-black uppercase tracking-widest rounded-xl text-[10px] transition-colors whitespace-nowrap"
              >
                ✏️ Vincular O.S.
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Legenda */}
      <div className="glass rounded-2xl p-4 border border-white/5 flex items-center gap-6 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Prioridades:</span>
        {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
          <span key={k} className="flex items-center gap-2 text-xs text-text-muted">
            <span className={`w-2 h-2 rounded-full ${v.color}`}></span>{v.label}
          </span>
        ))}
        <div className="ml-auto flex items-center gap-4">
          <span className="text-[10px] text-text-muted italic">↔ Arraste para "Concluído" abre inspeção de qualidade</span>
          <button
            onClick={toggleArchive}
            className={`text-[10px] font-bold transition-colors uppercase border px-2.5 py-1 rounded-lg ${
              showArchive ? 'text-accent-success border-accent-success/50 bg-accent-success/10' : 'text-accent-success border-accent-success/30 hover:border-accent-success/50'
            }`}
          >
            {showArchive ? '← Fechar Histórico' : 'Histórico de OS'}
          </button>
          <button
            onClick={handleReset}
            className="text-[10px] font-bold text-orange-400 hover:text-orange-300 transition-colors uppercase border border-orange-500/30 px-2.5 py-1 rounded-lg"
          >
            Resetar Painel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {KANBAN_COLS.map(col => (
          <div
            key={col.id}
            className={`${col.bg} rounded-2xl p-4 border ${col.border} transition-all flex flex-col gap-4`}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-1', 'ring-white/20'); }}
            onDragLeave={(e) => e.currentTarget.classList.remove('ring-1', 'ring-white/20')}
            onDrop={(e) => { e.currentTarget.classList.remove('ring-1', 'ring-white/20'); handleDrop(e, col.id); }}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <h4 className={`text-xs font-black uppercase tracking-widest ${col.color} whitespace-nowrap`}>{col.label}</h4>
                <button
                  type="button"
                  onClick={() => setSelectedCard({ column_id: col.id })}
                  title={`Adicionar O.S. em ${col.label}`}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/5 hover:bg-white/15 text-white/80 hover:text-white border border-white/10 transition-all cursor-pointer whitespace-nowrap"
                >
                  <Plus size={11} strokeWidth={3} />
                  <span>Adicionar O.S.</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                {col.id === 'done' && columns.done.length > 0 && (
                  <button
                    type="button"
                    onClick={handleArchiveAllDone}
                    disabled={archivingAll}
                    title="Arquivar todas as O.S. concluídas"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-accent-success/15 hover:bg-accent-success/30 text-accent-success border border-accent-success/30 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    <Archive size={11} />
                    {archivingAll ? 'Arquivando...' : 'Arquivar Tudo'}
                  </button>
                )}
                <span className={`w-6 h-6 rounded-full ${col.countBg} text-xs font-bold flex items-center justify-center`}>
                  {columns[col.id].length}
                </span>
              </div>
            </div>
            <div className={`space-y-3 ${col.id === 'done' ? 'opacity-75' : ''} min-h-[150px] flex-1`}>
              {columns[col.id].map(card => (
                <KanbanCard
                  key={card.id}
                  card={card}
                  onDragStart={(e, id) => handleDragStart(e, id, col.id)}
                  onClick={(c) => setSelectedCard(c)}
                  onArchive={col.id === 'done' ? (c) => setQueuedForDone({ card: c, fromCol: col.id }) : null}
                  onReschedule={(c) => handleOpenReschedule(c)}
                  operatorsList={operatorsList}
                  onUpdateOperator={handleUpdateTaskOperator}
                />
              ))}
              {columns[col.id].length === 0 && (
                <div className="border-2 border-dashed border-white/5 rounded-xl p-6 text-center text-xs text-text-muted">
                  Solte aqui
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedCard({ column_id: col.id })}
              className="w-full py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all uppercase tracking-widest border border-white/5"
            >
              + Adicionar O.S.
            </button>
          </div>
        ))}
      </div>

      {selectedCard && (
        <KanbanCardModal 
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
        />
      )}

      {queuedForDone && (
        <QualityModal
          card={queuedForDone.card}
          onConfirm={handleArchiveConfirm}
          onCancel={() => setQueuedForDone(null)}
        />
      )}

      {/* Modal: Reagendar Ordem de Serviço */}
      {rescheduleCard && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setRescheduleCard(null)} />
          
          <form onSubmit={handleConfirmReschedule} className="relative z-10 w-full max-w-md bg-zinc-950 border border-yellow-500/30 p-6 md:p-8 rounded-3xl shadow-2xl space-y-5 text-white">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <div className="p-3 bg-yellow-500/20 text-yellow-400 rounded-2xl">
                <CalendarClock size={24} />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Reagendar O.S.</h3>
                <p className="text-xs text-text-muted truncate max-w-[260px]">{rescheduleCard.title}</p>
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
                onClick={() => setRescheduleCard(null)}
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

      {/* Archive History Panel */}
      {showArchive && (
        <div className="glass rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
            <CheckCircle2 size={16} className="text-accent-success" />
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Histórico de O.S. Arquivadas</h3>
            <span className="text-[10px] text-text-muted font-bold">({archive.length} registros)</span>
          </div>
          {archiveLoading ? (
            <div className="p-8 text-center text-xs text-text-muted animate-pulse">Carregando histórico...</div>
          ) : archive.length === 0 ? (
            <div className="p-8 text-center text-xs text-text-muted">Nenhuma O.S. arquivada ainda.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {archive.map(a => {
                const stars = '★'.repeat(a.quality_rating) + '☆'.repeat(5 - a.quality_rating);
                const starColor = a.quality_rating >= 4 ? 'text-accent-success' : a.quality_rating >= 3 ? 'text-accent-warning' : 'text-accent-danger';
                const date = new Date(a.archived_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={a.id} className="grid grid-cols-[1fr_120px_120px_auto] gap-4 px-6 py-4 hover:bg-white/[0.02] transition-colors items-center">
                    <div>
                      <p className="text-sm font-bold text-white">{a.title}</p>
                      <p className="text-xs text-text-muted">{a.machine}{a.operator ? ` · ${a.operator}` : ''} · {date}</p>
                      {a.observations && <p className="text-[11px] text-text-muted/70 mt-1 italic">{a.observations}</p>}
                    </div>
                    <div className="text-center">
                      <p className={`text-sm font-black ${starColor}`}>{stars}</p>
                      <p className="text-[10px] text-text-muted">{STAR_LABELS[a.quality_rating]}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold">
                        <span className="text-accent-success">{a.qty_approved} aprov.</span>
                        {a.qty_rejected > 0 && <span className="text-accent-danger ml-1">{a.qty_rejected} rej.</span>}
                      </p>
                    </div>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                      a.priority === 'urgente' ? 'bg-red-500/15 text-red-400' :
                      a.priority === 'alta'    ? 'bg-orange-500/15 text-orange-400' :
                      a.priority === 'media'   ? 'bg-yellow-500/15 text-yellow-400' :
                      'bg-white/10 text-text-muted'
                    }`}>{a.priority || '—'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="p-4 bg-orange-500/10 border border-orange-500/20 border-l-4 border-l-orange-500 rounded-r-xl">
        <p className="text-sm text-orange-200/80 leading-relaxed">
          <strong className="text-orange-400">Regra de Ouro:</strong> Ao arrastar uma O.S. para "Concluído", o sistema abre uma inspeção de qualidade obrigatória. O card é arquivado com nota, quantidade aprovada/rejeitada e observações.
        </p>
      </div>

      {selectedLinkJob && (
        <LinkProjectModal
          job={selectedLinkJob}
          routerName={selectedLinkRouter}
          onClose={() => {
            setSelectedLinkJob(null);
            setSelectedLinkRouter('');
          }}
          onSuccess={() => {
            loadKanban();
          }}
        />
      )}
    </div>
  );
}
