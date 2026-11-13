import React from 'react';
import { CheckCircle2, CalendarClock, User } from 'lucide-react';
import { PRIORITY_CONFIG } from './kanbanUtils';

export function KanbanCard({ card, onDragStart, onClick, onArchive, onReschedule, operatorsList = [], onUpdateOperator }) {
  const p = PRIORITY_CONFIG[card.priority] || PRIORITY_CONFIG.media;
  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStart(e, card.id);
        e.currentTarget.classList.add('opacity-50');
      }}
      onDragEnd={(e) => e.currentTarget.classList.remove('opacity-50')}
      className="bg-bg-main/80 rounded-xl p-4 border border-white/5 hover:border-white/10 hover:-translate-y-0.5 transition-all select-none group"
    >
      <div
        className="cursor-pointer"
        onClick={() => onClick(card)}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-sm font-semibold text-white leading-snug">{card.title}</p>
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${p.color}`}></span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold bg-white/10 px-2.5 py-1 rounded-full text-text-muted">{card.machine}</span>
          {card.date && <span className="text-[10px] text-text-muted">📅 {card.date}</span>}
          {card.operator && <span className="text-[10px] text-accent-cyan font-bold bg-accent-cyan/10 px-2 py-0.5 rounded border border-accent-cyan/20">👤 {card.operator}</span>}
        </div>
        {card.reschedule_reason && (
          <div className="mt-2.5 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-[10px] text-yellow-300 space-y-0.5">
            <div className="flex items-center gap-1 font-bold">
              <CalendarClock size={11} className="text-yellow-400 shrink-0" />
              <span>Reagendado ({card.rescheduled_date || card.date}):</span>
            </div>
            <p className="text-[9px] text-yellow-200/90 font-medium pl-3 truncate">Motivo: "{card.reschedule_reason}"</p>
          </div>
        )}
      </div>

      {/* Selector para vincular operador em tempo real */}
      <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between gap-1.5" onClick={(e) => e.stopPropagation()}>
        <span className="text-[10px] text-text-muted font-bold flex items-center gap-1 shrink-0">
          <User size={11} className="text-accent-cyan" /> Operador:
        </span>
        <select
          value={card.operator || ''}
          onChange={(e) => onUpdateOperator && onUpdateOperator(card.id, e.target.value)}
          className="bg-black/60 border border-white/10 text-[10px] font-bold text-accent-cyan rounded-lg px-2 py-0.5 outline-none cursor-pointer hover:border-accent-cyan/40 transition-colors w-full max-w-[140px] truncate"
        >
          <option value="" className="bg-zinc-900 text-white">-- Vincular --</option>
          {operatorsList.map(op => (
            <option key={op.id || op.name} value={op.name} className="bg-zinc-900 text-white">👷 {op.name}</option>
          ))}
          {card.operator && !operatorsList.some(o => o.name === card.operator) && (
            <option value={card.operator} className="bg-zinc-900 text-white">👷 {card.operator}</option>
          )}
        </select>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {onReschedule && (
          <button
            onClick={(e) => { e.stopPropagation(); onReschedule(card); }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all bg-yellow-500/10 text-yellow-300 border border-yellow-500/20 hover:bg-yellow-500/20 opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Reagendar esta O.S."
          >
            <CalendarClock size={12} /> Reagendar
          </button>
        )}
        {onArchive && (
          <button
            onClick={(e) => { e.stopPropagation(); onArchive(card); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all bg-accent-success/10 text-accent-success border border-accent-success/20 hover:bg-accent-success/25 opacity-0 group-hover:opacity-100 cursor-pointer"
          >
            <CheckCircle2 size={11} /> Arquivar
          </button>
        )}
      </div>
    </div>
  );
}
