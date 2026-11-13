import React, { useState, useEffect, useCallback } from 'react';
import { X, Trash2, Edit2 } from 'lucide-react';
import { api } from '../../services/api';

export function ChecklistMaquina({ data, machineKey }) {
  const today = new Date().toISOString().slice(0, 10);
  const [checked, setChecked] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [newItemText, setNewItemText] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'encarregado' | 'operador'

  const fetchCustomItems = useCallback(async () => {
    try {
      const items = await api.get(`/checklists/items?machine_key=${machineKey}`);
      if (Array.isArray(items)) {
        setCustomItems(items);
      }
    } catch (err) {
      console.error('Failed to load custom checklist items:', err);
    }
  }, [machineKey]);

  useEffect(() => {
    let active = true;
    const fetchChecklist = async () => {
      setLoading(true);
      try {
        await fetchCustomItems();
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
  }, [machineKey, today, fetchCustomItems]);

  // Use DB items if present (includes auto-seeded default items), fallback to hardcoded
  const allItems = customItems.length > 0
    ? customItems.map((item, idx) => ({ id: item.id, index: idx, text: item.item_text }))
    : data.items.map((text, idx) => ({ index: idx, text }));

  const filteredDisplayItems = allItems.filter(item => {
    const isEncarregado = item.text.includes('[Encarregado]') || item.text.includes('👔');
    if (roleFilter === 'encarregado') return isEncarregado;
    if (roleFilter === 'operador') return !isEncarregado;
    return true;
  });

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

  const handleAddCustomItem = async (e) => {
    e.preventDefault();
    if (!newItemText.trim() || addingItem) return;
    setAddingItem(true);
    try {
      const created = await api.post('/checklists/items', {
        machine_key: machineKey,
        item_text: newItemText.trim()
      });
      if (created && created.id) {
        fetchCustomItems();
        setNewItemText('');
      }
    } catch {
      alert('Erro ao adicionar item ao checklist.');
    } finally {
      setAddingItem(false);
    }
  };

  const handleEditCustomItem = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    const newText = prompt('Editar item do checklist:', item.text);
    if (!newText || !newText.trim() || newText.trim() === item.text) return;
    try {
      if (item.id) {
        await api.patch(`/checklists/items/${item.id}`, { item_text: newText.trim() });
        fetchCustomItems();
      }
    } catch {
      alert('Erro ao editar item do checklist.');
    }
  };

  const handleDeleteCustomItem = async (e, customId) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Deseja excluir este item do checklist?')) return;
    try {
      if (customId) {
        await api.deleteCustom(`/checklists/items/${customId}`);
        fetchCustomItems();
      }
    } catch {
      alert('Erro ao excluir item.');
    }
  };

  const clearAll = async () => {
    if (!confirm('Deseja limpar todos os checados deste checklist?')) return;
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

  const progress = allItems.length > 0 ? Math.round((checked.length / allItems.length) * 100) : 0;
  const allDone = allItems.length > 0 && checked.length === allItems.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20 text-orange-400 font-bold">
        Carregando checklist...
      </div>
    );
  }

  const encarregadoCount = allItems.filter(i => i.text.includes('[Encarregado]') || i.text.includes('👔')).length;
  const operadorCount = allItems.filter(i => i.text.includes('[Operador]')).length;

  return (
    <div className="glass rounded-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
      <div className="p-6 border-b border-slate-200 dark:border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">{data.title}</h3>
            {data.supply && <p className="text-[11px] text-slate-600 dark:text-text-muted mt-0.5">Insumos/Ferramental: {data.supply}</p>}
          </div>
          <div className="flex items-center gap-3">
            {allDone && (
              <span className="text-[10px] font-black bg-accent-success/10 text-accent-success border border-accent-success/20 px-3 py-1 rounded-full">✓ COMPLETO</span>
            )}
            <button
              onClick={clearAll}
              className="text-[10px] font-bold text-slate-500 dark:text-text-muted hover:text-accent-danger transition-colors cursor-pointer"
            >
              Limpar Checados
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? 'bg-accent-success' : 'bg-orange-500'}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="text-xs font-black text-slate-600 dark:text-text-muted min-w-[50px] text-right">{checked.length}/{allItems.length}</span>
        </div>

        {/* Role Filter Selector */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-white/5">
          <span className="text-[10px] font-bold text-slate-600 dark:text-text-muted uppercase tracking-wider mr-1">Filtrar por Responsabilidade:</span>
          <button
            onClick={() => setRoleFilter('all')}
            className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
              roleFilter === 'all' 
                ? 'bg-slate-900 text-white dark:bg-white/10 dark:text-white border border-slate-700 dark:border-white/20' 
                : 'text-slate-600 dark:text-text-muted hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            📋 Todos os Itens ({allItems.length})
          </button>
          <button
            onClick={() => setRoleFilter('encarregado')}
            className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
              roleFilter === 'encarregado' 
                ? 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 shadow-sm font-black' 
                : 'text-slate-600 dark:text-text-muted hover:text-purple-600 dark:hover:text-purple-300'
            }`}
          >
            👔 Inspeções do Encarregado ({encarregadoCount})
          </button>
          <button
            onClick={() => setRoleFilter('operador')}
            className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
              roleFilter === 'operador' 
                ? 'bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-sm font-black' 
                : 'text-slate-600 dark:text-text-muted hover:text-cyan-600 dark:hover:text-cyan-300'
            }`}
          >
            👷 Setup do Operador ({operadorCount})
          </button>
        </div>
      </div>

      <div className="divide-y divide-slate-200 dark:divide-white/5">
        {filteredDisplayItems.map((item) => {
          const done = checked.includes(item.index);
          const isEncarregado = item.text.includes('[Encarregado]') || item.text.includes('👔');
          const isOperador = item.text.includes('[Operador]');
          const cleanText = item.text
            .replace(/^\[Encarregado\]\s*/i, '')
            .replace(/^\[Operador\]\s*/i, '');

          return (
            <div key={`${item.id || 'def'}-${item.index}`} className={`flex items-center justify-between gap-4 p-4 hover:bg-slate-100/60 dark:hover:bg-white/[0.02] transition-colors group ${done ? 'opacity-60' : ''}`}>
              <label className="flex items-start gap-3 flex-1 cursor-pointer">
                <input type="checkbox" className="mt-0.5 accent-orange-500 w-4 h-4 flex-shrink-0 cursor-pointer" checked={done} onChange={() => toggle(item.index)} />
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
                  {isEncarregado && (
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shrink-0 w-fit">
                      👔 VERIFICAÇÃO DO ENCARREGADO
                    </span>
                  )}
                  {isOperador && (
                    <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 shrink-0 w-fit">
                      👷 SETUP DO OPERADOR
                    </span>
                  )}
                  <span className={`text-sm font-medium ${done ? 'line-through text-slate-400 dark:text-text-muted' : 'text-slate-900 dark:text-white/90'}`}>{cleanText}</span>
                </div>
              </label>
              {item.id && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleEditCustomItem(e, item)}
                    className="text-slate-500 dark:text-text-muted hover:text-accent-cyan p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/5 transition-all cursor-pointer"
                    title="Editar item do checklist"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={(e) => handleDeleteCustomItem(e, item.id)}
                    className="text-slate-500 dark:text-text-muted hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/5 transition-all cursor-pointer"
                    title="Excluir item do checklist"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Form para Adicionar Novo Item Personalizado ao Checklist */}
      <form onSubmit={handleAddCustomItem} className="flex flex-col sm:flex-row gap-2 p-4 border-t border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
        <input 
          type="text" 
          placeholder="+ Adicionar novo item ao checklist desta máquina..." 
          value={newItemText} 
          onChange={(e) => setNewItemText(e.target.value)}
          className="flex-1 bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-orange-500 transition-colors shadow-sm"
        />
        <button 
          type="submit" 
          disabled={!newItemText.trim() || addingItem}
          className="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-black uppercase text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
        >
          {addingItem ? 'Adicionando...' : '+ Adicionar Item'}
        </button>
      </form>

      <div className="p-4 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/5">
        <p className="text-xs text-slate-600 dark:text-text-muted"><strong className="text-slate-900 dark:text-white">Insumos:</strong> {data.supply}</p>
      </div>
    </div>
  );
}
