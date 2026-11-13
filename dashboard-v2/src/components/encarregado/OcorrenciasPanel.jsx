import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, PlusCircle, X, ShieldAlert } from 'lucide-react';
import { api } from '../../services/api';

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

const OCCURRENCE_MACHINES = ['Router Central', 'Router 2', 'Laser', 'Mesa de Vácuo', 'Geral / Oficina'];

const SEV_STYLE = {
  alta:  { bg: 'bg-accent-danger/15',  text: 'text-accent-danger',  label: 'Alta' },
  media: { bg: 'bg-accent-warning/15', text: 'text-accent-warning', label: 'Média' },
  baixa: { bg: 'bg-accent-success/15', text: 'text-accent-success', label: 'Baixa' },
};

export function OcorrenciasPanel() {
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ machine: 'Router Central', type: OCCURRENCE_TYPES[0], description: '', severity: 'media' });
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
