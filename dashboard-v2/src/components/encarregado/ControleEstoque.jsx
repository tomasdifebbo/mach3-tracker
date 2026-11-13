import React, { useState, useEffect } from 'react';
import { Package, AlertCircle, PlusCircle, X } from 'lucide-react';
import { api } from '../../services/api';
import { SectionHeader } from './EncarregadoShared';

const STOCK_MACHINES = ['Router Central', 'Router 2', 'Laser', 'Mesa de Vácuo', 'Geral / Oficina'];

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

const EMPTY_FORM = { name: '', machine: 'Router Central', unit: 'un', qty_current: '', qty_min: '', qty_max: '' };

export function ControleEstoque() {
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
