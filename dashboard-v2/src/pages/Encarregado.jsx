import React, { useState, useMemo } from 'react';
import {
  LayoutGrid, Calendar, Columns3, CheckSquare2, Package, TrendingUp,
  AlertCircle, CheckCircle2, Clock, Star, ChevronRight, Zap, Target
} from 'lucide-react';

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
        <div className="glass rounded-2xl p-6 border border-white/5">
          <h3 className="text-sm font-black uppercase tracking-widest text-white mb-4">Jobs desta semana ({totalJobs})</h3>
          <div className="space-y-2">
            {weekJobs.slice(0, 8).map(j => (
              <div key={j.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-white">{j.job_name}</p>
                  <p className="text-xs text-text-muted">{j.router_name} • {j.material_name}</p>
                </div>
                <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${j.end_time ? 'bg-accent-success/10 text-accent-success' : 'bg-accent-cyan/10 text-accent-cyan'}`}>
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

function KanbanCard({ card, onDragStart }) {
  const p = PRIORITY_CONFIG[card.priority] || PRIORITY_CONFIG.media;
  return (
    <div
      draggable
      onDragStart={(e) => {
        onDragStart(e, card.id);
        e.currentTarget.classList.add('opacity-50');
      }}
      onDragEnd={(e) => e.currentTarget.classList.remove('opacity-50')}
      className="bg-bg-main/80 rounded-xl p-4 border border-white/5 hover:border-white/10 hover:-translate-y-0.5 transition-all cursor-grab active:cursor-grabbing group select-none"
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

function PainelKanban({ jobs = [] }) {
  // Merge real active jobs into the doing column on first render
  const buildInitial = () => {
    const realActive = jobs.filter(j => !j.end_time).slice(0, 4).map(j => ({
      id: `job-${j.id}`, title: j.job_name, machine: j.router_name, operator: 'Operador', priority: 'alta'
    }));
    const realDone = jobs.filter(j => j.end_time).slice(0, 3).map(j => ({
      id: `job-done-${j.id}`, title: j.job_name, machine: j.router_name, date: 'Entregue', priority: 'baixa'
    }));
    return {
      todo: [...INITIAL_CARDS.todo],
      doing: realActive.length > 0 ? realActive : [...INITIAL_CARDS.doing],
      done: realDone.length > 0 ? realDone : [...INITIAL_CARDS.done],
    };
  };

  const [columns, setColumns] = useState(buildInitial);
  const dragCard = React.useRef(null);
  const dragFrom = React.useRef(null);

  const handleDragStart = (e, cardId, colId) => {
    dragCard.current = cardId;
    dragFrom.current = colId;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e, targetCol) => {
    e.preventDefault();
    const cardId = dragCard.current;
    const fromCol = dragFrom.current;
    if (!cardId || !fromCol || fromCol === targetCol) return;

    setColumns(prev => {
      const card = prev[fromCol].find(c => c.id === cardId);
      if (!card) return prev;
      return {
        ...prev,
        [fromCol]: prev[fromCol].filter(c => c.id !== cardId),
        [targetCol]: [...prev[targetCol], card],
      };
    });
    dragCard.current = null;
    dragFrom.current = null;
  };

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
        <span className="ml-auto text-[10px] text-text-muted italic">↔ Arraste os cards entre colunas</span>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {KANBAN_COLS.map(col => (
          <div
            key={col.id}
            className={`${col.bg} rounded-2xl p-4 border ${col.border} transition-all`}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-1', 'ring-white/20'); }}
            onDragLeave={(e) => e.currentTarget.classList.remove('ring-1', 'ring-white/20')}
            onDrop={(e) => { e.currentTarget.classList.remove('ring-1', 'ring-white/20'); handleDrop(e, col.id); }}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className={`text-xs font-black uppercase tracking-widest ${col.color}`}>{col.label}</h4>
              <span className={`w-6 h-6 rounded-full ${col.countBg} text-xs font-bold flex items-center justify-center`}>
                {columns[col.id].length}
              </span>
            </div>
            <div className={`space-y-3 ${col.id === 'done' ? 'opacity-75' : ''} min-h-[60px]`}>
              {columns[col.id].map(card => (
                <KanbanCard
                  key={card.id}
                  card={card}
                  onDragStart={(e, id) => handleDragStart(e, id, col.id)}
                />
              ))}
              {columns[col.id].length === 0 && (
                <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center text-xs text-text-muted">
                  Solte aqui
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-orange-500/10 border border-orange-500/20 border-l-4 border-l-orange-500 rounded-r-xl">
        <p className="text-sm text-orange-200/80 leading-relaxed">
          <strong className="text-orange-400">Regra de Ouro:</strong> Operadores não movem cartões para "Concluído" sem aprovação visual do Encarregado. Isso garante que erros dimensionais não cheguem ao cliente final.
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
  const storageKey = `mach3_checklist_${machineKey}_${today}`;

  const [checked, setChecked] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const toggle = (i) => {
    setChecked(prev => {
      const next = prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i];
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const clearAll = () => {
    setChecked([]);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  const progress = Math.round((checked.length / data.items.length) * 100);
  const allDone = checked.length === data.items.length;

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
    </div>
  );
}

const STOCK_DATA = [
  { name: 'Fresas de Desbaste', machine: 'Router CNC', pct: 80, status: 'ok' },
  { name: 'Fresas de Acabamento', machine: 'Router CNC', pct: 42, status: 'warning' },
  { name: 'Lentes Laser ZnSe', machine: 'Laser CO₂', pct: 20, status: 'critical' },
  { name: 'Filamento PLA', machine: 'Impressão 3D', pct: 75, status: 'ok' },
  { name: 'Filamento PETG', machine: 'Impressão 3D', pct: 35, status: 'warning' },
  { name: 'Chapas PSA', machine: 'Vácuo', pct: 60, status: 'ok' },
  { name: 'Óleo para Bomba', machine: 'Vácuo', pct: 15, status: 'critical' },
];

const STATUS_STYLE = {
  ok:       { bar: 'bg-accent-success', text: 'text-accent-success', label: 'OK' },
  warning:  { bar: 'bg-accent-warning', text: 'text-accent-warning', label: 'Alerta' },
  critical: { bar: 'bg-accent-danger', text: 'text-accent-danger', label: 'Crítico' },
};

function ControleEstoque() {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader label="Suprimentos" title="Controle de Estoque" />

      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-white">Ferramentas & Insumos</h3>
          <div className="flex items-center gap-4 text-[10px] font-bold">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-success"></span>OK</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-warning"></span>Alerta</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-accent-danger"></span>Crítico</span>
          </div>
        </div>
        <div className="divide-y divide-white/5">
          {STOCK_DATA.map(item => {
            const s = STATUS_STYLE[item.status];
            return (
              <div key={item.name} className="flex items-center gap-6 px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white">{item.name}</p>
                  <p className="text-xs text-text-muted">{item.machine}</p>
                </div>
                <div className="w-40">
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden relative">
                    <div className={`h-full rounded-full transition-all ${s.bar}`} style={{ width: `${item.pct}%` }}></div>
                    <div className="absolute top-0 bottom-0 w-0.5 bg-white/30" style={{ left: '40%' }}></div>
                  </div>
                </div>
                <span className={`text-xs font-black min-w-[50px] text-right ${s.text}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {STOCK_DATA.filter(s => s.status === 'critical').length > 0 && (
        <div className="p-5 bg-red-500/10 border border-red-500/20 border-l-4 border-l-red-500 rounded-r-xl flex items-start gap-3">
          <AlertCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-black text-red-400 mb-1">Reposição Urgente Necessária</p>
            <p className="text-xs text-red-200/70 leading-relaxed">
              {STOCK_DATA.filter(s => s.status === 'critical').map(s => s.name).join(', ')} estão abaixo do nível mínimo de segurança.
              Solicite compras imediatamente para evitar parada de linha.
            </p>
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
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader label="Melhoria Contínua" title="Ciclo POP / Kaizen" />

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

      <div className="glass rounded-2xl p-6 border border-white/5">
        <h3 className="text-sm font-black uppercase tracking-widest text-white mb-4 flex items-center gap-2">
          <Star size={16} className="text-orange-400" /> Registro de Kaizens da Semana
        </h3>
        <div className="space-y-3">
          {[
            { title: 'Redução de Setup Router', desc: 'Posição de zero salva em programa — ganho de 15min por setup.', status: 'Implementado' },
            { title: 'Organização de Fresas', desc: 'Quadro de sombras na bancada para cada tipo de fresa.', status: 'Em avaliação' },
          ].map((k, i) => (
            <div key={i} className="flex items-start justify-between gap-4 p-4 bg-white/[0.02] rounded-xl border border-white/5">
              <div>
                <p className="text-sm font-bold text-white mb-1">{k.title}</p>
                <p className="text-xs text-text-muted">{k.desc}</p>
              </div>
              <span className={`text-[10px] font-black px-3 py-1 rounded-full whitespace-nowrap ${k.status === 'Implementado' ? 'bg-accent-success/10 text-accent-success' : 'bg-accent-warning/10 text-accent-warning'}`}>{k.status}</span>
            </div>
          ))}
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
