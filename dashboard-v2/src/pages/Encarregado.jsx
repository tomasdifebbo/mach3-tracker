import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutGrid, Calendar, Columns3, CheckSquare2, Package, TrendingUp,
  AlertCircle, CheckCircle2, Clock, Star, ChevronRight, Zap, Target,
  AlertTriangle, PlusCircle, X, ShieldAlert
} from 'lucide-react';
import { api } from '../services/api';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DAYS_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

function KpiCard({ icon, value, label, color = 'text-accent-cyan', meta }) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/5 flex flex-col items-center text-center group hover:border-white/10 transition-all">
      <div className="text-3xl mb-2">{icon}</div>
      <div className={`text-4xl font-black ${color} mb-1`}>{value}</div>
      <div className="text-xs font-bold uppercase tracking-widest text-text-muted">{label}</div>
      {meta && <div className="mt-2 text-[10px] text-text-muted border border-white/5 rounded-full px-2 py-0.5">{meta}</div>}
    </div>
  );
}

function SectionHeader({ label, title }) {
  return (
    <div className="mb-8">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-400 mb-2">{label}</p>
      <h2 className="text-3xl font-black text-white tracking-tight">{title}</h2>
    </div>
  );
}

// ─── Sub-seções ──────────────────────────────────────────────────────────────

function DashboardSemanal({ jobs = [] }) {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1); // Segunda-feira
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekJobs = useMemo(() => jobs.filter(j => {
    const d = new Date(j.start_time);
    return d >= weekStart && d <= weekEnd;
  }), [jobs]);

  const totalJobs = weekJobs.length;
  const completedJobs = weekJobs.filter(j => j.end_time).length;
  const onTimeRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader label="Resumo Executivo" title="Dashboard Semanal" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon="📦" value={`${onTimeRate}%`} label="OS Entregues" color="text-orange-400" meta={`Meta: > 95%`} />
        <KpiCard icon="✅" value="96%" label="Qualidade" color="text-accent-success" meta="Meta: > 98%" />
        <KpiCard icon="⏱️" value="92%" label="No Prazo" color="text-accent-cyan" meta="Meta: > 97%" />
        <KpiCard icon="⭐" value="2" label="Kaizens" color="text-accent-warning" meta="Meta: ≥ 1/sem" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fórmulas */}
        <div className="glass rounded-2xl p-6 border border-orange-500/20 border-l-4 border-l-orange-500">
          <h3 className="text-sm font-black uppercase tracking-widest text-white mb-5 flex items-center gap-2">
            <Zap size={16} className="text-orange-400" /> Fórmulas de Performance
          </h3>
          <div className="space-y-4">
            {[
              { lbl: 'Entregas', formula: 'OS entregues no prazo ÷ Total entregues × 100' },
              { lbl: 'Qualidade', formula: 'Peças aprovadas de 1ª ÷ Total produzidas × 100' },
              { lbl: 'Ordens', formula: 'OS concluídas ÷ OS programadas × 100' },
            ].map(f => (
              <div key={f.lbl}>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">{f.lbl}</p>
                <code className="block bg-black/30 text-accent-cyan text-xs p-2.5 rounded-xl border border-white/5">{f.formula}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Metas */}
        <div className="glass rounded-2xl p-6 border border-white/5">
          <h3 className="text-sm font-black uppercase tracking-widest text-white mb-5 flex items-center gap-2">
            <Target size={16} className="text-orange-400" /> Metas Semanais
          </h3>
          <div className="space-y-3">
            {[
              { name: 'OS Entregues', meta: '> 95%', ok: onTimeRate >= 95 },
              { name: 'Qualidade de Peças', meta: '> 98%', ok: true },
              { name: 'Prazo de Entrega', meta: '> 97%', ok: false },
              { name: 'Kaizens Implementados', meta: '≥ 1/semana', ok: true },
            ].map(m => (
              <div key={m.name} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                <span className="text-text-muted font-medium">{m.name}</span>
                <span className={`font-black text-xs ${m.ok ? 'text-accent-success' : 'text-accent-warning'}`}>{m.meta}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
            <p className="text-xs text-orange-200/80 leading-relaxed">
              <strong className="text-orange-400">Segurança:</strong> Óculos específicos e retirada diária de cavacos da Router CNC são obrigatórios antes do início do turno.
            </p>
          </div>
        </div>
      </div>

      {/* Jobs da semana */}
      {totalJobs > 0 && (
        <div className="glass rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Jobs desta semana ({totalJobs})</h3>
            <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-text-muted">
              <span>Máquina</span>
              <span>Pasta / Arquivo</span>
              <span>Status</span>
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {weekJobs.slice(0, 10).map(j => (
              <div key={j.id} className="grid grid-cols-[1fr_auto] gap-4 px-6 py-3.5 hover:bg-white/[0.02] transition-colors items-center">
                <div>
                  {/* Nome do job */}
                  <p className="text-sm font-semibold text-white mb-0.5 leading-tight">
                    {j.job_name || j.file_name || '—'}
                  </p>
                  {/* Linha inferior: máquina + pasta / arquivo */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md">
                      {j.router_name || '—'}
                    </span>
                    {j.folder && (
                      <span className="flex items-center gap-1 text-[10px] text-text-muted">
                        <span className="text-text-muted/50">📁</span>
                        <span className="font-medium">{j.folder}</span>
                      </span>
                    )}
                    {j.file_name && (
                      <span className="flex items-center gap-1 text-[10px] text-text-muted">
                        <span className="text-text-muted/50">📄</span>
                        <span className="font-medium text-accent-cyan/80">{j.file_name}</span>
                      </span>
                    )}
                    {j.material_name && !j.folder && !j.file_name && (
                      <span className="text-[10px] text-text-muted">{j.material_name}</span>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full whitespace-nowrap ${
                  j.end_time
                    ? 'bg-accent-success/10 text-accent-success'
                    : 'bg-accent-cyan/10 text-accent-cyan'
                }`}>
                  {j.end_time ? 'Concluído' : 'Em curso'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RotinaSemanal() {
  const today = new Date().getDay(); // 0=Dom,1=Seg...

  const weekDays = [
    { short: 'SEG', idx: 1, focus: 'Planejamento', desc: 'Alinhamento com vendas, atualização do Kanban e definição de metas semanais.' },
    { short: 'TER', idx: 2, focus: 'Qualidade', desc: 'Auditoria dimensional e verificação técnica das peças finais de cada máquina.' },
    { short: 'QUA', idx: 3, focus: 'Manutenção', desc: 'Limpeza profunda, lubrificação das guias e calibração de sistemas críticos.' },
    { short: 'QUI', idx: 4, focus: 'Estoque', desc: 'Verificação de insumos, fresas, filamentos e encaminhamento de compras urgentes.' },
    { short: 'SEX', idx: 5, focus: 'Fechamento', desc: 'Cálculo de KPIs, entrega de OS finais e 5S geral da fábrica.' },
  ];

  const turno = [
    { moment: 'Início do Turno (10 min)', activity: 'Reunião rápida (Daily) com operadores no painel Kanban.', goal: 'Alinhar prioridades e designar cada operador ao seu maquinário.' },
    { moment: 'Meio do Turno (Gemba Walk)', activity: 'Ronda pelas máquinas: ouvir sons, detectar desvios e dar suporte técnico.', goal: 'Prevenir falhas e eliminar gargalos antes que causem paradas.' },
    { moment: 'Fim do Turno (15 min)', activity: 'Fechamento de KPIs do dia e auditoria de 5S nas bancadas.', goal: 'Garantir que OS estejam atualizadas e fábrica em ordem.' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader label="Planejamento" title="Rotina Semanal" />

      <div className="grid grid-cols-5 gap-3">
        {weekDays.map(d => {
          const isToday = d.idx === today;
          return (
            <div key={d.short} className={`rounded-2xl p-5 border transition-all ${isToday ? 'border-orange-500 bg-gradient-to-b from-orange-500/10 to-transparent shadow-lg shadow-orange-500/10' : 'glass border-white/5'}`}>
              <span className={`text-[10px] font-black px-2 py-1 rounded-md inline-block mb-3 ${isToday ? 'bg-orange-500 text-white' : 'bg-white/10 text-text-muted'}`}>{d.short}</span>
              <p className="font-black text-white text-sm mb-2">{d.focus}</p>
              <p className="text-xs text-text-muted leading-relaxed">{d.desc}</p>
              {isToday && <div className="mt-3 flex items-center gap-1 text-[10px] text-orange-400 font-black"><span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>HOJE</div>}
            </div>
          );
        })}
      </div>

      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5">
          <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Clock size={16} className="text-orange-400" /> Responsabilidades por Momento do Turno
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {turno.map(t => (
            <div key={t.moment} className="grid grid-cols-3 gap-4 p-5 hover:bg-white/[0.02] transition-colors">
              <p className="text-sm font-bold text-white">{t.moment}</p>
              <p className="text-sm text-text-muted">{t.activity}</p>
              <p className="text-sm text-accent-cyan font-medium">{t.goal}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PRIORITY_CONFIG = {
  urgente: { color: 'bg-red-500', label: 'Urgente', text: 'text-red-400' },
  alta:    { color: 'bg-orange-400', label: 'Alta', text: 'text-orange-400' },
  media:   { color: 'bg-yellow-400', label: 'Média', text: 'text-yellow-400' },
  baixa:   { color: 'bg-blue-400', label: 'Baixa', text: 'text-blue-400' },
};

function KanbanCard({ card, onDragStart, onClick, onArchive }) {
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
          {card.operator && <span className="text-[10px] text-text-muted">👤 {card.operator}</span>}
        </div>
      </div>
      {onArchive && (
        <button
          onClick={(e) => { e.stopPropagation(); onArchive(card); }}
          className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all
            bg-accent-success/10 text-accent-success border border-accent-success/20
            hover:bg-accent-success/25 hover:border-accent-success/50 hover:shadow-sm hover:shadow-accent-success/20
            opacity-0 group-hover:opacity-100"
        >
          <CheckCircle2 size={11} /> Arquivar
        </button>
      )}
    </div>
  );
}

const INITIAL_CARDS = {
  todo: [
    { id: 'k1', title: 'Peças de MDF — Cliente Marcenaria X', machine: 'Router CNC', date: 'Hoje 18:00', priority: 'alta' },
    { id: 'k2', title: 'Gravação Acrílico — Loja Y', machine: 'Laser', date: 'Amanhã', priority: 'media' },
    { id: 'k3', title: 'Protótipo de Case — Interno', machine: 'Impressão 3D', date: 'Semana', priority: 'baixa' },
  ],
  doing: [
    { id: 'k4', title: 'Moldes de PETG — Embalagens Z', machine: 'Vácuo', operator: 'Op. João', priority: 'urgente' },
    { id: 'k5', title: 'Corte Chapas — Sinalização ABC', machine: 'Laser', operator: 'Op. Maria', priority: 'alta' },
  ],
  done: [
    { id: 'k6', title: 'Usinagem Painel — Cliente W', machine: 'Router CNC', date: 'Entregue ontem', priority: 'media' },
  ],
};

const KANBAN_COLS = [
  { id: 'todo',  label: 'A Fazer',      color: 'text-text-muted',   bg: 'bg-white/[0.02]',      border: 'border-white/5',        countBg: 'bg-bg-main text-white' },
  { id: 'doing', label: 'Em Andamento', color: 'text-orange-400',   bg: 'bg-orange-500/5',     border: 'border-orange-500/20', countBg: 'bg-orange-500 text-white' },
  { id: 'done',  label: 'Concluído',    color: 'text-accent-success', bg: 'bg-accent-success/5', border: 'border-accent-success/20', countBg: 'bg-accent-success text-black' },
];

const STAR_LABELS = ['', 'Péssima', 'Ruim', 'Regular', 'Boa', 'Excelente'];

function QualityModal({ card, onConfirm, onCancel }) {
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

function KanbanCardModal({ card, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(card.title || '');
  const [machine, setMachine] = useState(card.machine || 'Router CNC');
  const [operator, setOperator] = useState(card.operator || '');
  const [date, setDate] = useState(card.date || '');
  const [priority, setPriority] = useState(card.priority || 'media');
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
        priority
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
              <option value="Router CNC">Router CNC</option>
              <option value="Laser">Laser</option>
              <option value="Vácuo">Vácuo</option>
              <option value="Impressão 3D">Impressão 3D</option>
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
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Prazo</label>
            <input 
              type="text" 
              placeholder="ex: Hoje 18:00"
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>
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

function normalizeStr(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\.(txt|tap|nc|gcode|cnc|dxf)$/i, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchKanbanTitle(jobFileName, jobFolder, cardTitle) {
  const normTitle = normalizeStr(cardTitle);
  if (!normTitle) return false;

  const normFile   = normalizeStr(jobFileName);
  const normFolder = normalizeStr(jobFolder);
  const fullJobText = `${normFile} ${normFolder}`.trim();

  // 1. Exact match — always valid
  if (normFile && normFile === normTitle) return true;
  if (normFolder && normFolder === normTitle) return true;

  // 2. The job filename fully contains the entire card title string
  if (normFile && normFile.includes(normTitle) && normTitle.length >= 6) return true;
  if (normFolder && normFolder.includes(normTitle) && normTitle.length >= 6) return true;

  // 3. STRICT: ALL meaningful words of the card title must be present in the job text.
  // This ensures a generic filename like "mdf 9mm" NEVER matches a specific card like
  // "chapa 2 MDF 9MM VETOR LOGO TARTARUGA e4mm" — because "vetor", "tartaruga", etc.
  // would be missing from the job filename.
  const titleWords = normTitle.split(' ').filter(w => w.length >= 3);
  if (titleWords.length >= 2) {
    const allTitleWordsInJob = titleWords.every(w => fullJobText.includes(w));
    if (allTitleWordsInJob) {
      // Extra guard: the job must also cover at least 50% of those words
      // (avoids matching when folder path accidentally contains many unrelated words)
      const jobWords = fullJobText.split(' ').filter(w => w.length >= 3);
      const jobHits  = jobWords.filter(w => normTitle.includes(w)).length;
      if (jobWords.length === 0 || jobHits / jobWords.length >= 0.5) {
        return true;
      }
    }
  }

  return false;
}

function PainelKanban({ jobs = [] }) {
  const [columns, setColumns] = useState({ todo: [], doing: [], done: [] });
  const [loading, setLoading] = useState(true);
  const [selectedCard, setSelectedCard] = useState(null);
  const [queuedForDone, setQueuedForDone] = useState(null); // card waiting for quality check
  const [showArchive, setShowArchive] = useState(false);
  const [archive, setArchive] = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);

  const dragCard = React.useRef(null);
  const dragFrom = React.useRef(null);

  const buildInitial = () => {
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
  };

  const loadKanban = async () => {
    setLoading(true);
    try {
      let cards = await api.get('/kanban');
      if (!Array.isArray(cards) || cards.length === 0) {
        const initial = buildInitial();
        cards = await api.post('/kanban/batch', initial);
      }
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
  };

  useEffect(() => {
    loadKanban();
  }, [jobs]);

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
      <SectionHeader label="Gestão de Produção" title="Painel Kanban" />

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

      <div className="grid grid-cols-3 gap-5">
        {KANBAN_COLS.map(col => (
          <div
            key={col.id}
            className={`${col.bg} rounded-2xl p-4 border ${col.border} transition-all flex flex-col gap-4`}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-1', 'ring-white/20'); }}
            onDragLeave={(e) => e.currentTarget.classList.remove('ring-1', 'ring-white/20')}
            onDrop={(e) => { e.currentTarget.classList.remove('ring-1', 'ring-white/20'); handleDrop(e, col.id); }}
          >
            <div className="flex items-center justify-between">
              <h4 className={`text-xs font-black uppercase tracking-widest ${col.color}`}>{col.label}</h4>
              <span className={`w-6 h-6 rounded-full ${col.countBg} text-xs font-bold flex items-center justify-center`}>
                {columns[col.id].length}
              </span>
            </div>
            <div className={`space-y-3 ${col.id === 'done' ? 'opacity-75' : ''} min-h-[150px] flex-1`}>
              {columns[col.id].map(card => (
                <KanbanCard
                  key={card.id}
                  card={card}
                  onDragStart={(e, id) => handleDragStart(e, id, col.id)}
                  onClick={(c) => setSelectedCard(c)}
                  onArchive={col.id === 'done' ? (c) => setQueuedForDone({ card: c, fromCol: col.id }) : null}
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
    </div>
  );
}

const MACHINE_CHECKLISTS = {
  router: {
    label: '🔩 Router CNC',
    title: 'Router CNC — Setup Diário',
    supply: 'Fresas retas, fresas de acabamento, pontas de gravação, pinças ER sobressalentes.',
    items: [
      'Verificar fixação e nivelamento do material na mesa (vácuo ou garras).',
      'Inspecionar desgaste da fresa — fresas cegas causam rebarba e vibração.',
      'Efetuar referenciamento nos três eixos (Zero XY e Z-Probe).',
      'Ligar exaustor/coletor de pó antes do início da usinagem.',
      'Limpar e lubrificar cremalheiras e fusos de esferas com óleo recomendado.',
    ]
  },
  laser: {
    label: '🔴 Laser',
    title: 'Corte a Laser — Setup Diário',
    supply: 'Lentes de foco ZnSe, espelhos refletores, filtros de carvão ativado.',
    items: [
      'Limpar a lente focal e espelhos defletores (álcool isopropílico + lenço óptico).',
      'Verificar temperatura do Chiller — ideal entre 18°C e 22°C.',
      'Ligar exaustor e testar sucção da colmeia/mesa de corte.',
      'Testar fluxo do gás de assistência (Air Assist) antes de iniciar.',
      'Inspecionar trilhos lineares quanto a acúmulo de fuligem e resíduos.',
    ]
  },
  vacuo: {
    label: '💨 Vácuo',
    title: 'Moldadora a Vácuo — Setup Diário',
    supply: 'Chapas PSA, ABS, PETG; resistências sobressalentes; óleo para bomba de vácuo.',
    items: [
      'Inspecionar borrachas de vedação da moldura de aperto (evita perda de sucção).',
      'Ligar resistências e verificar aquecimento uniforme da chapa plástica.',
      'Confirmar nível de óleo da bomba de vácuo (visor de nível).',
      'Limpar moldes de resina/MDF, retirando rebarbas e poeiras do ciclo anterior.',
    ]
  },
  impressao3d: {
    label: '🧱 Impressão 3D',
    title: 'Impressoras 3D — Setup Diário',
    supply: 'Filamentos PLA, ABS, PETG; bicos (nozzles 0.4mm e 0.6mm); fitas de aderência.',
    items: [
      'Verificar nivelamento da mesa de impressão (Bed Leveling manual ou automático).',
      'Limpar a mesa com álcool isopropílico para adesão correta da primeira camada.',
      'Inspecionar bico (nozzle) por resíduos e entupimentos de filamento queimado.',
      'Confirmar que os filamentos estão armazenados em ambiente seco (caixa selada ou estufa).',
    ]
  }
};

function ChecklistMaquina({ data, machineKey }) {
  const today = new Date().toISOString().slice(0, 10);
  const [checked, setChecked] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchChecklist = async () => {
      setLoading(true);
      try {
        const rows = await api.get(`/checklists?machine_key=${machineKey}&date=${today}`);
        if (active && Array.isArray(rows)) {
          const checkedIndices = rows.filter(r => r.done).map(r => r.item_index);
          setChecked(checkedIndices);
        }
      } catch (err) {
        console.error('Failed to load checklist:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchChecklist();
    return () => { active = false; };
  }, [machineKey, today]);

  const toggle = async (i) => {
    const isDone = !checked.includes(i);
    // Optimistic update
    setChecked(prev => isDone ? [...prev, i] : prev.filter(x => x !== i));
    try {
      await api.post('/checklists/toggle', {
        machine_key: machineKey,
        item_index: i,
        done: isDone,
        date: today
      });
    } catch (err) {
      console.error('Failed to toggle checklist item:', err);
      // Revert on error
      setChecked(prev => isDone ? prev.filter(x => x !== i) : [...prev, i]);
    }
  };

  const clearAll = async () => {
    if (!confirm('Deseja limpar todos os itens deste checklist?')) return;
    setChecked([]);
    try {
      await api.post('/checklists/clear', {
        machine_key: machineKey,
        date: today
      });
    } catch (err) {
      console.error('Failed to clear checklist:', err);
    }
  };

  const progress = Math.round((checked.length / data.items.length) * 100);
  const allDone = checked.length === data.items.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 text-orange-400 font-bold">
        Carregando checklist...
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl border border-white/5 overflow-hidden">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">{data.title}</h3>
          <div className="flex items-center gap-3">
            {allDone && (
              <span className="text-[10px] font-black bg-accent-success/10 text-accent-success border border-accent-success/20 px-3 py-1 rounded-full">✓ COMPLETO</span>
            )}
            <button
              onClick={clearAll}
              className="text-[10px] font-bold text-text-muted hover:text-accent-danger transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-accent-success' : 'bg-orange-500'}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="text-xs font-black text-text-muted min-w-[50px] text-right">{checked.length}/{data.items.length}</span>
        </div>
        <p className="text-[10px] text-text-muted mt-2 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-success inline-block"></span>
          Progresso salvo automaticamente para hoje ({today})
        </p>
      </div>
      <div className="divide-y divide-white/5">
        {data.items.map((item, i) => {
          const done = checked.includes(i);
          return (
            <label key={i} className={`flex items-start gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors ${done ? 'opacity-60' : ''}`}>
              <input type="checkbox" className="mt-0.5 accent-orange-500 w-4 h-4 flex-shrink-0" checked={done} onChange={() => toggle(i)} />
              <span className={`text-sm ${done ? 'line-through text-text-muted' : 'text-white/80'}`}>{item}</span>
            </label>
          );
        })}
      </div>
      <div className="p-4 bg-white/[0.02] border-t border-white/5">
        <p className="text-xs text-text-muted"><strong className="text-white">Insumos:</strong> {data.supply}</p>
      </div>
    </div>
  );
}

const OCCURRENCE_TYPES = [
  'Fresa cega / quebrada',
  'Falta de insumo / material',
  'Chiller / refrigeração',
  'Erro de origem / zero',
  'Barulho ou vibração anormal',
  'Problema elétrico',
  'Falha de software / CNC',
  'Outro',
];

const OCCURRENCE_MACHINES = ['Router CNC', 'Laser CO₂', 'Impressão 3D', 'Mesa de Vácuo', 'Geral'];

const SEV_STYLE = {
  alta:  { bg: 'bg-accent-danger/15',  text: 'text-accent-danger',  label: 'Alta' },
  media: { bg: 'bg-accent-warning/15', text: 'text-accent-warning', label: 'Média' },
  baixa: { bg: 'bg-accent-success/15', text: 'text-accent-success', label: 'Baixa' },
};

function OcorrenciasPanel() {
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ machine: 'Router CNC', type: OCCURRENCE_TYPES[0], description: '', severity: 'media' });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/occurrences');
      if (Array.isArray(data)) setOccurrences(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const added = await api.post('/occurrences', form);
      setOccurrences(prev => [added, ...prev]);
      setForm({ machine: 'Router CNC', type: OCCURRENCE_TYPES[0], description: '', severity: 'media' });
      setShowForm(false);
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleResolve = async (id) => {
    setOccurrences(prev => prev.map(o => o.id === id ? { ...o, status: 'resolved' } : o));
    try { await api.patch(`/occurrences/${id}`, { status: 'resolved' }); }
    catch (err) { console.error(err); load(); }
  };

  const handleDelete = async (id) => {
    setOccurrences(prev => prev.filter(o => o.id !== id));
    try { await api.deleteCustom(`/occurrences/${id}`); }
    catch (err) { console.error(err); load(); }
  };

  const pending = occurrences.filter(o => o.status === 'pending');
  const resolved = occurrences.filter(o => o.status === 'resolved');

  return (
    <div className="glass rounded-2xl border border-white/5 overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert size={18} className="text-accent-danger" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Ocorrências Ativas</h3>
          {pending.length > 0 && (
            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-accent-danger/20 text-accent-danger border border-accent-danger/10">
              {pending.length} abertas
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
            showForm ? 'bg-white/10 text-white border-white/10' : 'bg-accent-danger/10 text-accent-danger border-accent-danger/20 hover:bg-accent-danger/20'
          }`}
        >
          {showForm ? <X size={12} /> : <PlusCircle size={12} />}
          {showForm ? 'Cancelar' : 'Relatar Problema'}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 border-b border-white/5 bg-white/[0.02] grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Máquina</label>
            <select
              value={form.machine}
              onChange={e => setForm(f => ({ ...f, machine: e.target.value }))}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none transition-colors"
            >
              {OCCURRENCE_MACHINES.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Tipo</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none transition-colors"
            >
              {OCCURRENCE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Severidade</label>
            <select
              value={form.severity}
              onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none transition-colors"
            >
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Observações</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Descreva o problema brevemente"
              className="bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>
          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 rounded-xl bg-accent-danger hover:opacity-90 disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest transition-all"
            >
              {submitting ? 'Registrando...' : 'Registrar Ocorrência'}
            </button>
          </div>
        </form>
      )}

      {/* Pending list */}
      <div className="divide-y divide-white/5">
        {loading && (
          <div className="p-8 text-center text-xs text-text-muted animate-pulse">Carregando ocorrências...</div>
        )}
        {!loading && pending.length === 0 && !showForm && (
          <div className="p-8 text-center text-xs text-text-muted">
            <CheckCircle2 size={28} className="mx-auto mb-2 text-accent-success/50" />
            Nenhuma ocorrência ativa no momento.
          </div>
        )}
        {pending.map(o => {
          const s = SEV_STYLE[o.severity] || SEV_STYLE.media;
          return (
            <div key={o.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors group">
              <AlertTriangle size={14} className={s.text} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-bold text-white">{o.machine}</span>
                  <span className="text-[10px] text-text-muted">—</span>
                  <span className="text-xs text-text-muted">{o.type}</span>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${s.bg} ${s.text}`}>{s.label}</span>
                </div>
                {o.description && <p className="text-[11px] text-text-muted">{o.description}</p>}
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                <button
                  onClick={() => handleResolve(o.id)}
                  className="text-[10px] font-bold text-accent-success hover:opacity-80 px-2 py-1 border border-accent-success/20 rounded-lg"
                >
                  Resolver
                </button>
                <button
                  onClick={() => handleDelete(o.id)}
                  className="text-[10px] font-bold text-text-muted hover:text-red-500 px-2 py-1 border border-white/5 rounded-lg"
                >
                  Excluir
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div className="border-t border-white/5 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-3">
            Resolvidas Recentemente ({resolved.length})
          </p>
          <div className="space-y-2">
            {resolved.slice(0, 3).map(o => (
              <div key={o.id} className="flex items-center gap-3 px-3 py-2 bg-white/[0.02] rounded-xl opacity-60 group">
                <CheckCircle2 size={12} className="text-accent-success flex-shrink-0" />
                <span className="text-[11px] text-text-muted flex-1">{o.machine} — {o.type}</span>
                <button
                  onClick={() => handleDelete(o.id)}
                  className="text-[10px] text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  Excluir
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistsDiarios() {
  const [activeTab, setActiveTab] = useState('router');
  const tabs = Object.entries(MACHINE_CHECKLISTS);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader label="Operação Diária" title="Checklists de Maquinário" />

      <div className="flex gap-2 flex-wrap">
        {tabs.map(([key, data]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${activeTab === key ? 'bg-orange-500 text-white border-orange-500' : 'glass border-white/5 text-text-muted hover:text-white hover:border-orange-500/50'}`}
          >
            {data.label}
          </button>
        ))}
      </div>

      <ChecklistMaquina key={activeTab} data={MACHINE_CHECKLISTS[activeTab]} machineKey={activeTab} />

      <OcorrenciasPanel />
    </div>
  );
}

const STOCK_MACHINES = ['Router CNC', 'Laser CO₂', 'Impressão 3D', 'Mesa de Vácuo', 'Geral'];

function getStockStatus(item) {
  const { qty_current, qty_min, qty_max } = item;
  const cur = Number(qty_current);
  const min = Number(qty_min);
  const max = Number(qty_max) || 1;
  const pct = Math.min(100, Math.round((cur / max) * 100));
  if (cur <= min) return { pct, status: 'critical', label: 'Crítico', bar: 'bg-accent-danger', text: 'text-accent-danger' };
  if (cur <= min * 1.5) return { pct, status: 'warning', label: 'Alerta', bar: 'bg-accent-warning', text: 'text-accent-warning' };
  return { pct, status: 'ok', label: 'OK', bar: 'bg-accent-success', text: 'text-accent-success' };
}

const EMPTY_FORM = { name: '', machine: 'Router CNC', unit: 'un', qty_current: '', qty_min: '', qty_max: '' };

function ControleEstoque() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null); // full item being edited in modal
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  // Inline quick-qty editing
  const [qtyDraft, setQtyDraft] = useState({}); // { [id]: string }

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get('/stock');
      if (Array.isArray(data)) setItems(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const openAdd = () => { setForm(EMPTY_FORM); setEditingItem(null); setShowAddModal(true); };
  const openEdit = (item) => {
    setForm({
      name: item.name, machine: item.machine, unit: item.unit,
      qty_current: item.qty_current, qty_min: item.qty_min, qty_max: item.qty_max,
    });
    setEditingItem(item);
    setShowAddModal(true);
  };
  const closeModal = () => { setShowAddModal(false); setEditingItem(null); };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...form,
      qty_current: Number(form.qty_current),
      qty_min: Number(form.qty_min),
      qty_max: Number(form.qty_max),
    };
    try {
      if (editingItem) {
        const updated = await api.patch(`/stock/${editingItem.id}`, payload);
        setItems(prev => prev.map(i => i.id === editingItem.id ? updated : i));
      } else {
        const added = await api.post('/stock', payload);
        setItems(prev => [...prev, added]);
      }
      closeModal();
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este item do estoque?')) return;
    setItems(prev => prev.filter(i => i.id !== id));
    try { await api.deleteCustom(`/stock/${id}`); }
    catch (err) { console.error(err); load(); }
  };

  // Save qty_current inline on blur / Enter
  const saveQty = async (item) => {
    const raw = qtyDraft[item.id];
    if (raw === undefined || raw === String(item.qty_current)) return;
    const val = Number(raw);
    if (isNaN(val)) return;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, qty_current: val } : i));
    setQtyDraft(prev => { const n = { ...prev }; delete n[item.id]; return n; });
    try { await api.patch(`/stock/${item.id}`, { qty_current: val }); }
    catch (err) { console.error(err); load(); }
  };

  // Group by machine for display
  const grouped = STOCK_MACHINES.reduce((acc, m) => {
    const grp = items.filter(i => i.machine === m);
    if (grp.length) acc[m] = grp;
    return acc;
  }, {});

  const criticalItems = items.filter(i => getStockStatus(i).status === 'critical');

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader label="Suprimentos" title="Controle de Estoque" />
        <button
          onClick={openAdd}
          className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-black text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-orange-500/20"
        >
          <PlusCircle size={13} /> Novo Item
        </button>
      </div>

      {/* Critical Alert */}
      {criticalItems.length > 0 && (
        <div className="p-5 bg-red-500/10 border border-red-500/20 border-l-4 border-l-red-500 rounded-r-xl flex items-start gap-3">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-red-400 mb-1">Reposição Urgente Necessária</p>
            <p className="text-xs text-red-200/70 leading-relaxed">
              <strong>{criticalItems.map(i => i.name).join(', ')}</strong> {criticalItems.length === 1 ? 'está' : 'estão'} abaixo do nível mínimo de segurança.
              Solicite compras imediatamente para evitar parada de linha.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center p-12 text-xs text-text-muted animate-pulse">Carregando estoque...</div>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl border border-white/5 p-12 text-center">
          <Package size={36} className="mx-auto mb-3 text-text-muted/40" />
          <p className="text-sm font-bold text-text-muted mb-1">Nenhum item cadastrado</p>
          <p className="text-xs text-text-muted/60">Clique em "Novo Item" para cadastrar seu primeiro material.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([machine, grpItems]) => (
            <div key={machine} className="glass rounded-2xl border border-white/5 overflow-hidden">
              {/* Group header */}
              <div className="px-6 py-3 bg-white/[0.02] border-b border-white/5 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">{machine}</span>
                <span className="text-[10px] text-text-muted font-bold">— {grpItems.length} {grpItems.length === 1 ? 'item' : 'itens'}</span>
              </div>

              {/* Column headers */}
              <div className="grid grid-cols-[1fr_80px_200px_80px_80px_80px_72px] gap-3 px-6 py-2 border-b border-white/5">
                {['Material', 'Un.', 'Qtd. Atual / Barra', 'Mín.', 'Máx.', 'Status', ''].map((h, i) => (
                  <span key={i} className="text-[9px] font-black uppercase tracking-widest text-text-muted">{h}</span>
                ))}
              </div>

              <div className="divide-y divide-white/5">
                {grpItems.map(item => {
                  const s = getStockStatus(item);
                  const draftVal = qtyDraft[item.id];
                  return (
                    <div key={item.id} className="grid grid-cols-[1fr_80px_200px_80px_80px_80px_72px] gap-3 px-6 py-3.5 hover:bg-white/[0.02] transition-colors group items-center">
                      {/* Name */}
                      <p className="text-sm font-semibold text-white truncate">{item.name}</p>
                      {/* Unit */}
                      <p className="text-xs text-text-muted">{item.unit}</p>
                      {/* Qty + bar */}
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={draftVal !== undefined ? draftVal : item.qty_current}
                          onChange={e => setQtyDraft(prev => ({ ...prev, [item.id]: e.target.value }))}
                          onBlur={() => saveQty(item)}
                          onKeyDown={e => e.key === 'Enter' && saveQty(item)}
                          className="w-16 bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-xs text-white text-center focus:border-orange-500 focus:outline-none transition-colors"
                        />
                        <div className="flex-1 relative h-2 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${s.bar}`}
                            style={{ width: `${s.pct}%` }}
                          />
                          {/* Min marker */}
                          {Number(item.qty_max) > 0 && (
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-white/40"
                              style={{ left: `${Math.min(100, (Number(item.qty_min) / Number(item.qty_max)) * 100)}%` }}
                            />
                          )}
                        </div>
                        <span className="text-[10px] text-text-muted w-8 text-right">{s.pct}%</span>
                      </div>
                      {/* Min */}
                      <p className="text-xs text-text-muted text-center">{item.qty_min}</p>
                      {/* Max */}
                      <p className="text-xs text-text-muted text-center">{item.qty_max}</p>
                      {/* Status */}
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide text-center ${
                        s.status === 'ok'       ? 'bg-accent-success/15 text-accent-success' :
                        s.status === 'warning'  ? 'bg-accent-warning/15 text-accent-warning' :
                        'bg-accent-danger/15 text-accent-danger'
                      }`}>{s.label}</span>
                      {/* Actions */}
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all justify-end">
                        <button
                          onClick={() => openEdit(item)}
                          className="text-[10px] font-bold text-text-muted hover:text-white px-2 py-1 border border-white/5 rounded-lg transition-colors"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-[10px] font-bold text-text-muted hover:text-red-500 px-2 py-1 border border-white/5 rounded-lg transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-[10px] font-bold text-text-muted">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-success" />OK — acima de 1.5× mínimo</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-warning" />Alerta — entre 1× e 1.5× mínimo</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-danger" />Crítico — no ou abaixo do mínimo</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-0.5 h-3 bg-white/40" />Marcador de mínimo na barra</span>
      </div>

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="glass rounded-2xl border border-white/10 p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-black text-white">
                {editingItem ? 'Editar Item' : 'Novo Item de Estoque'}
              </h3>
              <button onClick={closeModal} className="text-text-muted hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleModalSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Nome do Material *</label>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="ex: Fresas de Desbaste"
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Máquina *</label>
                  <select
                    value={form.machine}
                    onChange={e => setForm(f => ({ ...f, machine: e.target.value }))}
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
                  >
                    {STOCK_MACHINES.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Unidade</label>
                  <input
                    value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    placeholder="un, m, kg, L..."
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Qtd. Atual *</label>
                  <input
                    type="number" required min="0" step="any"
                    value={form.qty_current}
                    onChange={e => setForm(f => ({ ...f, qty_current: e.target.value }))}
                    placeholder="0"
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Qtd. Mínima *</label>
                  <input
                    type="number" required min="0" step="any"
                    value={form.qty_min}
                    onChange={e => setForm(f => ({ ...f, qty_min: e.target.value }))}
                    placeholder="0"
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Qtd. Máxima *</label>
                  <input
                    type="number" required min="1" step="any"
                    value={form.qty_max}
                    onChange={e => setForm(f => ({ ...f, qty_max: e.target.value }))}
                    placeholder="100"
                    className="bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-text-muted hover:text-white transition-colors">
                  Cancelar
                </button>
                <button
                  type="submit" disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-black text-xs font-black uppercase tracking-widest transition-all"
                >
                  {submitting ? 'Salvando...' : editingItem ? 'Salvar Alterações' : 'Cadastrar Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const POP_STEPS = [
  { title: 'Identificação', desc: 'Mapear o processo atual, listar cada etapa e identificar pontos de desperdício ou risco de erro.' },
  { title: 'Análise da Causa', desc: 'Aplicar 5 Porquês ou Diagrama de Ishikawa para encontrar a causa raiz do problema.' },
  { title: 'Solução Proposta', desc: 'Definir a melhoria, designar responsável e estabelecer prazo para implementação.' },
  { title: 'Implementação', desc: 'Executar a mudança no processo, atualizar o POP e treinar os operadores.' },
  { title: 'Verificação', desc: 'Medir resultado após 1 semana. Comparar indicadores antes e depois da melhoria.' },
  { title: 'Padronização', desc: 'Registrar no caderno de kaizens, atualizar documento e replicar em outras máquinas se aplicável.' },
];

function CicloPOP() {
  const [kaizens, setKaizens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadKaizens = async () => {
    setLoading(true);
    try {
      const data = await api.get('/kaizens');
      if (Array.isArray(data)) {
        setKaizens(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKaizens();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !description) return;
    setSubmitting(true);
    try {
      const added = await api.post('/kaizens', { title, description });
      setKaizens(prev => [added, ...prev]);
      setTitle('');
      setDescription('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'Implementado' ? 'Em avaliação' : 'Implementado';
    setKaizens(prev => prev.map(k => k.id === id ? { ...k, status: nextStatus } : k));
    try {
      await api.patch(`/kaizens/${id}`, { status: nextStatus });
    } catch (err) {
      console.error(err);
      loadKaizens();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deseja excluir este Kaizen?')) return;
    setKaizens(prev => prev.filter(k => k.id !== id));
    try {
      await api.deleteCustom(`/kaizens/${id}`);
    } catch (err) {
      console.error(err);
      loadKaizens();
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader label="Melhoria Contínua" title="Ciclo POP / Kaizen" />

      {/* POP Steps */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {POP_STEPS.map((step, i) => (
          <div key={i} className="glass rounded-2xl p-6 border border-white/5 relative overflow-hidden group hover:border-orange-500/30 transition-all">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-orange-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-black text-sm mb-4">{i + 1}</div>
            <h4 className="font-black text-white text-sm mb-2">{step.title}</h4>
            <p className="text-xs text-text-muted leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Registro / Form */}
        <div className="glass rounded-2xl p-6 border border-white/5 md:col-span-1 flex flex-col gap-4 self-start">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Registrar Novo Kaizen</h3>
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Título da Melhoria</label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="ex: Redução de Setup Router"
                className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-orange-500 focus:outline-none transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Descrição da Mudança</label>
              <textarea
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Qual o desvio e qual a solução proposta?"
                className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white h-24 focus:border-orange-500 focus:outline-none transition-colors resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-black text-xs font-black transition-all uppercase tracking-widest shadow-lg shadow-orange-500/10"
            >
              {submitting ? 'Registrando...' : 'Registrar'}
            </button>
          </form>
        </div>

        {/* Registro de Kaizens da Semana */}
        <div className="glass rounded-2xl p-6 border border-white/5 md:col-span-2 flex flex-col gap-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Star size={16} className="text-orange-400" /> Registro de Kaizens ({kaizens.length})
          </h3>
          {loading ? (
            <div className="text-center p-8 text-xs text-text-muted font-bold animate-pulse">Carregando Kaizens...</div>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {kaizens.map((k) => (
                <div key={k.id} className="flex items-start justify-between gap-4 p-4 bg-white/[0.02] rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-white leading-none">{k.title}</p>
                      <button
                        onClick={() => toggleStatus(k.id, k.status)}
                        className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${k.status === 'Implementado' ? 'bg-accent-success/15 text-accent-success border border-accent-success/10' : 'bg-accent-warning/15 text-accent-warning border border-accent-warning/10'}`}
                      >
                        {k.status}
                      </button>
                    </div>
                    <p className="text-xs text-text-muted leading-relaxed mt-1.5">{k.description}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(k.id)}
                    className="text-[10px] font-bold text-text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    Excluir
                  </button>
                </div>
              ))}
              {kaizens.length === 0 && (
                <div className="text-center p-8 border-2 border-dashed border-white/5 rounded-2xl text-xs text-text-muted">
                  Nenhum Kaizen registrado nesta semana.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
const NAV_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard Semanal', icon: LayoutGrid, group: 'Visão Geral' },
  { id: 'rotina', label: 'Rotina Semanal', icon: Calendar, group: 'Visão Geral' },
  { id: 'kanban', label: 'Painel Kanban', icon: Columns3, group: 'Produção' },
  { id: 'checklists', label: 'Checklists Diários', icon: CheckSquare2, group: 'Operação' },
  { id: 'estoque', label: 'Controle de Estoque', icon: Package, group: 'Operação' },
  { id: 'kaizen', label: 'Ciclo POP / Kaizen', icon: TrendingUp, group: 'Melhoria' },
];

export function Encarregado({ jobs = [] }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const today = new Date();
  const dayName = DAYS[today.getDay()];

  const groups = [...new Set(NAV_SECTIONS.map(s => s.group))];

  const renderSection = () => {
    switch (activeTab) {
      case 'dashboard':  return <DashboardSemanal jobs={jobs} />;
      case 'rotina':     return <RotinaSemanal />;
      case 'kanban':     return <PainelKanban jobs={jobs} />;
      case 'checklists': return <ChecklistsDiarios />;
      case 'estoque':    return <ControleEstoque />;
      case 'kaizen':     return <CicloPOP />;
      default:           return <DashboardSemanal jobs={jobs} />;
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Mini sidebar interna */}
      <aside className="w-60 flex-shrink-0 bg-black/30 border-r border-white/5 flex flex-col overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-white/5">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-orange-400 mb-1">Planner Operacional</p>
          <h2 className="font-black text-white text-lg leading-tight">Painel do <span className="text-orange-400">Encarregado</span></h2>
        </div>

        {/* Dia atual */}
        <div className="mx-4 my-3 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
          <span className="text-xs font-bold text-orange-400">{dayName}-feira</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 pb-4">
          {groups.map(group => (
            <div key={group} className="mb-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/20 px-3 py-2">{group}</p>
              {NAV_SECTIONS.filter(s => s.group === group).map(s => {
                const Icon = s.icon;
                const active = activeTab === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveTab(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold mb-0.5 transition-all ${active ? 'bg-orange-500/15 text-orange-400 border-l-2 border-orange-500' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <span className="text-xs leading-tight">{s.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* KPIs Sidebar */}
        <div className="m-4 p-4 bg-white/[0.03] rounded-xl border border-white/5">
          <p className="text-[9px] font-black uppercase tracking-widest text-text-muted mb-3">Progresso da Semana</p>
          {[
            { label: 'OS Entregues', val: 87 },
            { label: 'Qualidade', val: 96 },
            { label: 'Prazo', val: 92 },
          ].map(k => (
            <div key={k.label} className="mb-3 last:mb-0">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-text-muted">{k.label}</span>
                <span className="font-black text-white">{k.val}%</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${k.val}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-y-auto p-8">
        {renderSection()}
      </main>
    </div>
  );
}
