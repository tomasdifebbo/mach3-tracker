import React, { useState } from 'react';
import { CheckCircle2, Star } from 'lucide-react';
import { STAR_LABELS, KANBAN_MACHINES } from './kanbanUtils';

export function QualityModal({ card, onConfirm, onCancel }) {
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState(0);
  const [qtyApproved, setQtyApproved] = useState('');
  const [qtyRejected, setQtyRejected] = useState('');
  const [observations, setObservations] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await onConfirm({ rating, qtyApproved: Number(qtyApproved) || 0, qtyRejected: Number(qtyRejected) || 0, observations });
    } finally {
      setSaving(false);
    }
  };

  const starColor = rating >= 4 ? 'text-accent-success' : rating >= 3 ? 'text-accent-warning' : 'text-accent-danger';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl shadow-2xl flex flex-col gap-0 overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-accent-success/10 border-b border-accent-success/20 px-6 py-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-accent-success/20 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={20} className="text-accent-success" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-accent-success mb-0.5">Inspeção de Qualidade</p>
            <h3 className="text-base font-black text-white leading-tight">{card.title}</h3>
            <p className="text-xs text-text-muted mt-0.5">{card.machine}{card.operator ? ` · ${card.operator}` : ''}</p>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Star Rating */}
          <div className="flex flex-col gap-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Qualidade Geral das Peças</label>
            <div className="flex items-center gap-2">
              {[1,2,3,4,5].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setRating(s)}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  className={`text-3xl transition-all duration-100 ${
                    (hovered || rating) >= s ? 'text-yellow-400 scale-110' : 'text-white/20'
                  }`}
                >
                  ★
                </button>
              ))}
              <span className={`ml-2 text-sm font-black ${starColor}`}>
                {STAR_LABELS[hovered || rating]}
              </span>
            </div>
          </div>

          {/* Quantities */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Qtd. Aprovada ✓</label>
              <input
                type="number" min="0"
                value={qtyApproved}
                onChange={e => setQtyApproved(e.target.value)}
                placeholder="0"
                className="bg-black/40 border border-accent-success/20 focus:border-accent-success rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Qtd. Rejeitada ✗</label>
              <input
                type="number" min="0"
                value={qtyRejected}
                onChange={e => setQtyRejected(e.target.value)}
                placeholder="0"
                className="bg-black/40 border border-accent-danger/20 focus:border-accent-danger rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Observations */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Observações (opcional)</label>
            <textarea
              value={observations}
              onChange={e => setObservations(e.target.value)}
              placeholder="Ex: Pequena variação dimensional na peça 3, retrabalho necessário..."
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white h-20 focus:border-orange-500 focus:outline-none transition-colors resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-text-muted hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className="flex-2 px-6 py-2.5 rounded-xl bg-accent-success hover:opacity-90 disabled:opacity-50 text-black text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-accent-success/20"
            >
              {saving ? 'Arquivando...' : 'Concluir e Arquivar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function KanbanCardModal({ card, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(card.title || '');
  const [machine, setMachine] = useState(card.machine || 'Router Central');
  const [operator, setOperator] = useState(card.operator || '');
  const [date, setDate] = useState(card.date || '');
  const [priority, setPriority] = useState(card.priority || 'media');
  const [estimatedMinutes, setEstimatedMinutes] = useState(card.estimated_minutes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...card,
        title,
        machine,
        operator,
        date,
        priority,
        estimated_minutes: estimatedMinutes ? parseFloat(estimatedMinutes) : null
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar as alterações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal */}
      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-md bg-zinc-950 border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col gap-4 text-white animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-black uppercase tracking-widest text-orange-400">
            {card.id ? 'Editar O.S.' : 'Nova O.S.'}
          </h3>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-white transition-colors font-bold text-xs uppercase tracking-wider">Fechar</button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Título da O.S.</label>
          <input 
            type="text" 
            required 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Máquina</label>
            <select 
              value={machine} 
              onChange={(e) => setMachine(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors cursor-pointer"
            >
              {KANBAN_MACHINES.map((m) => (
                <option key={m} value={m} className="bg-zinc-900 text-white">
                  {m}
                </option>
              ))}
              {machine && !KANBAN_MACHINES.includes(machine) && (
                <option value={machine} className="bg-zinc-900 text-white">
                  {machine}
                </option>
              )}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Prioridade</label>
            <select 
              value={priority} 
              onChange={(e) => setPriority(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="urgente">Urgente</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Operador</label>
            <input 
              type="text" 
              value={operator} 
              onChange={(e) => setOperator(e.target.value)} 
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">⏱️ Tempo Estimado (Minutos)</label>
            <input 
              type="number" 
              placeholder="ex: 45"
              value={estimatedMinutes} 
              onChange={(e) => setEstimatedMinutes(e.target.value)} 
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Prazo</label>
            <input 
              type="text" 
              placeholder="ex: Hoje 18:00"
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>

        <div className="flex items-center gap-3 mt-4">
          {card.id && (
            <button 
              type="button" 
              onClick={() => {
                if (confirm('Deseja excluir esta O.S.?')) {
                  onDelete(card.id);
                  onClose();
                }
              }}
              className="px-4 py-2.5 rounded-xl border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-500 text-xs font-bold transition-all uppercase tracking-widest"
            >
              Excluir
            </button>
          )}
          <button 
            type="submit" 
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-black text-xs font-bold transition-all uppercase tracking-widest shadow-lg shadow-orange-500/20"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
