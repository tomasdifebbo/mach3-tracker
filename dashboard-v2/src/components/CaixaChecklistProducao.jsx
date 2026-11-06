import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare, Square, CheckCircle2, Clock, Plus, Trash2, RotateCcw,
  Search, Filter, Printer, Layers, Cpu, Award, Sparkles, Check, ChevronDown,
  ChevronUp, UserCheck, AlertCircle, Compass, FileText
} from 'lucide-react';

const STORAGE_KEY = 'mach3_production_checklist_v2';

const DEFAULT_ITEMS = [
  // Lote Tijolos MDF 9mm (Chapas 81 a 100 - Meta de 100)
  { id: 'tijolo-81', title: 'CHAPA 81 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router 2', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-82', title: 'CHAPA 82 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router 2', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-83', title: 'CHAPA 83 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router 2', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-84', title: 'CHAPA 84 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router 2', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-85', title: 'CHAPA 85 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router 2', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-86', title: 'CHAPA 86 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router 2', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-87', title: 'CHAPA 87 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router 2', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-88', title: 'CHAPA 88 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router 2', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-89', title: 'CHAPA 89 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router 2', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-90', title: 'CHAPA 90 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router 2', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-91', title: 'CHAPA 91 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router Central', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-92', title: 'CHAPA 92 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router Central', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-93', title: 'CHAPA 93 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router Central', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-94', title: 'CHAPA 94 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router Central', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-95', title: 'CHAPA 95 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router Central', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-96', title: 'CHAPA 96 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router Central', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-97', title: 'CHAPA 97 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router Central', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-98', title: 'CHAPA 98 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router Central', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-99', title: 'CHAPA 99 · MDF 9mm Tijolos (2731×1843 mm)', group: 'Lote Tijolos (81-100)', machine: 'Router Central', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },
  { id: 'tijolo-100', title: 'CHAPA 100 · MDF 9mm Tijolos (2731×1843 mm) 🏆 META FINAL', group: 'Lote Tijolos (81-100)', machine: 'Router Central', tool: 'Topo Ø6mm Z=3mm', done: false, doneAt: null, doneBy: null },

  // G-Codes Prontos Aguardando Máquina
  { id: 'gcode-1', title: 'TEXTURA TIJOLOS especiais E4MM_1-2-Corte 3.txt', group: 'G-Codes Prontos', machine: 'Router Central', tool: 'Fresa Ø4mm', done: false, doneAt: null, doneBy: null },
  { id: 'gcode-2', title: 'compensadO 10MM e6mm_1-°CHAPA .txt', group: 'G-Codes Prontos', machine: 'Router 2', tool: 'Topo Ø6mm', done: false, doneAt: null, doneBy: null },
  { id: 'gcode-3', title: 'compensado 6mm e6mm_4-°chapa.txt', group: 'G-Codes Prontos', machine: 'Router 2 / Cent.', tool: 'Topo Ø6mm', done: false, doneAt: null, doneBy: null },
  { id: 'gcode-4', title: 'MDF 9MM E4MM_1-Corte 29.txt', group: 'G-Codes Prontos', machine: 'Router Central', tool: 'Fresa Ø4mm', done: false, doneAt: null, doneBy: null },
  { id: 'gcode-5', title: 'MDF 9 MM E6 ARCOS CORTE 2_2-Corte 2.txt', group: 'G-Codes Prontos', machine: 'Router Central', tool: 'Topo Ø6mm', done: false, doneAt: null, doneBy: null },

  // Fila Aspire (CAM & Nesting)
  { id: 'aspire-1', title: 'ROUTER.eps CASAS.crv3d PORTA E ARCO.crv3d', group: 'Preparação Aspire', machine: 'Aspire / CAM', tool: 'Nesting MDF 15/9', done: false, doneAt: null, doneBy: null },
  { id: 'aspire-2', title: 'JANELAS.eps novo.eps', group: 'Preparação Aspire', machine: 'Aspire / CAM', tool: 'MDF 9mm', done: false, doneAt: null, doneBy: null },
  { id: 'aspire-3', title: 'COMPENSADO bandeira.crv3d (2667A - EXPO CULTURA)', group: 'Preparação Aspire', machine: 'Aspire / CAM', tool: 'Compensado', done: false, doneAt: null, doneBy: null },
  { id: 'aspire-4', title: 'compensado 15mm escada.crv3d (2667A - EXPO CULTURA)', group: 'Preparação Aspire', machine: 'Aspire / CAM', tool: 'Compensado 15mm', done: false, doneAt: null, doneBy: null },

  // Lotes 100% Concluídos Hoje (Baixas Oficiais)
  { id: 'done-comp6', title: 'Compensado 6mm Entrada (Chapas 1 a 9) · 100% Usinado', group: 'Concluídos Hoje', machine: 'Router Central', tool: 'Fresa Ø6mm', done: true, doneAt: '2026-11-05T17:20:00Z', doneBy: 'Ítalo' },
  { id: 'done-pinguins', title: 'Pinguins Hella 100mm (Chapas 1 a 8) · 100% Usinado', group: 'Concluídos Hoje', machine: 'Router 2', tool: 'Ball Nose Ø10/12', done: true, doneAt: '2026-11-05T15:00:00Z', doneBy: 'Tomas' },
  { id: 'done-arcos', title: 'Arcos & Pilares Entrada (8 Chapas) · 100% Usinado', group: 'Concluídos Hoje', machine: 'Central & R2', tool: 'Topo Ø6mm', done: true, doneAt: '2026-11-04T18:00:00Z', doneBy: 'Tomas' },
  { id: 'done-moldura', title: 'Moldura Menor Porta Castelo MDF 9mm · 100% Usinado', group: 'Concluídos Hoje', machine: 'Router Central', tool: 'Fresa Ø6mm', done: true, doneAt: '2026-11-03T16:00:00Z', doneBy: 'Tomas' }
];

export function CaixaChecklistProducao({ operatorName = 'Tomas' }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Erro ao carregar checklist do localStorage:', e);
    }
    return DEFAULT_ITEMS;
  });

  const [filterStatus, setFilterStatus] = useState('pendentes'); // 'todos' | 'pendentes' | 'concluidos'
  const [selectedGroup, setSelectedGroup] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [newItemMachine, setNewItemMachine] = useState('Router 2');
  const [newItemTool, setNewItemTool] = useState('Topo Ø6mm');
  const [newItemGroup, setNewItemGroup] = useState('Lote Tijolos (81-100)');

  // Save to localStorage whenever items change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('Erro ao salvar checklist:', e);
    }
  }, [items]);

  // Toggle OK on an item
  const handleToggle = (id) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextDone = !item.done;
        return {
          ...item,
          done: nextDone,
          doneAt: nextDone ? new Date().toISOString() : null,
          doneBy: nextDone ? operatorName : null
        };
      }
      return item;
    }));
  };

  // Add new custom item
  const handleAddItem = (e) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    const newItem = {
      id: `custom-${Date.now()}`,
      title: newItemText.trim(),
      group: newItemGroup,
      machine: newItemMachine,
      tool: newItemTool,
      done: false,
      doneAt: null,
      doneBy: null
    };
    setItems(prev => [newItem, ...prev]);
    setNewItemText('');
    setIsAddingOpen(false);
  };

  // Delete an item
  const handleDelete = (id) => {
    if (!window.confirm('Deseja remover este item do checklist?')) return;
    setItems(prev => prev.filter(i => i.id !== id));
  };

  // Reset to default Ficha Técnica items
  const handleReset = () => {
    if (!window.confirm('Deseja recarregar a lista padrão da Ficha Técnica de hoje (Tijolos 81 a 100, G-Codes e Aspire)?')) return;
    setItems(DEFAULT_ITEMS);
  };

  // Mark all currently filtered as done
  const handleMarkAllFiltered = (markDone = true) => {
    const idsToUpdate = new Set(filteredItems.map(i => i.id));
    setItems(prev => prev.map(item => {
      if (idsToUpdate.has(item.id)) {
        return {
          ...item,
          done: markDone,
          doneAt: markDone ? (item.doneAt || new Date().toISOString()) : null,
          doneBy: markDone ? (item.doneBy || operatorName) : null
        };
      }
      return item;
    }));
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = items.length;
    const done = items.filter(i => i.done).length;
    const pending = total - done;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pending, percent };
  }, [items]);

  // Groups list
  const groups = useMemo(() => {
    const set = new Set(items.map(i => i.group || 'Geral'));
    return Array.from(set);
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(i => {
      if (filterStatus === 'pendentes' && i.done) return false;
      if (filterStatus === 'concluidos' && !i.done) return false;
      if (selectedGroup !== 'todos' && (i.group || 'Geral') !== selectedGroup) return false;
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        return (i.title || '').toLowerCase().includes(s) ||
               (i.machine || '').toLowerCase().includes(s) ||
               (i.tool || '').toLowerCase().includes(s) ||
               (i.group || '').toLowerCase().includes(s);
      }
      return true;
    });
  }, [items, filterStatus, selectedGroup, searchTerm]);

  return (
    <div className="bg-white dark:bg-[#12141a] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col">
      {/* Header com Banner & Métricas */}
      <div className="p-3.5 md:p-4.5 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border-b border-slate-200 dark:border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/30 shrink-0">
              <CheckSquare size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm md:text-base font-black text-slate-900 dark:text-white leading-tight">
                  Caixa de Checklist Operacional • Dar Baixa nas Tarefas
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                  {operatorName} (Programador & CNC)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Clique na chapa para dar <strong>OK</strong> conforme for usinando na máquina. Salvo automaticamente no seu navegador.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddingOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white shadow-sm transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>Adicionar Tarefa</span>
            </button>
            <button
              onClick={handleReset}
              title="Restaurar itens originais da Ficha Técnica"
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 transition-all cursor-pointer"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {/* Progress Bar & Badges */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-300">Progresso Geral:</span>
              <span className="text-orange-500 dark:text-orange-400 font-black">{metrics.done} de {metrics.total} concluídos</span>
              <span className="text-[10px] text-slate-400">({metrics.percent}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                {metrics.pending} Pendentes
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                {metrics.done} OK
              </span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                metrics.percent >= 100
                  ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                  : metrics.percent >= 50
                  ? 'bg-orange-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, metrics.percent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Form Adicionar Nova Tarefa (Colapsável) */}
      {isAddingOpen && (
        <form onSubmit={handleAddItem} className="p-3 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <span>+ Nova Tarefa ou Chapa Manual</span>
            <button type="button" onClick={() => setIsAddingOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Ex: CHAPA 101 - Teste Tijolo / Recorte Acrílico 3mm..."
              className="sm:col-span-6 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-black/30 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-orange-500"
              autoFocus
            />
            <select
              value={newItemMachine}
              onChange={(e) => setNewItemMachine(e.target.value)}
              className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-black/30 border border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="Router 2">Router 2</option>
              <option value="Router Central">Router Central</option>
              <option value="Router 1">Router 1</option>
              <option value="Laser">Laser</option>
              <option value="Aspire / CAM">Aspire / CAM</option>
            </select>
            <select
              value={newItemGroup}
              onChange={(e) => setNewItemGroup(e.target.value)}
              className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-black/30 border border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer"
            >
              <option value="Lote Tijolos (81-100)">Lote Tijolos</option>
              <option value="G-Codes Prontos">G-Codes</option>
              <option value="Preparação Aspire">Aspire</option>
              <option value="Geral">Geral</option>
            </select>
            <button
              type="submit"
              className="sm:col-span-2 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm"
            >
              Gravar
            </button>
          </div>
        </form>
      )}

      {/* Barra de Filtros Rápidos & Busca */}
      <div className="p-2.5 md:p-3 bg-slate-50/50 dark:bg-white/[0.01] border-b border-slate-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterStatus('pendentes')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'pendentes'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
            }`}
          >
            Pendentes ({metrics.pending})
          </button>
          <button
            onClick={() => setFilterStatus('todos')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'todos'
                ? 'bg-slate-800 dark:bg-white/20 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
            }`}
          >
            Todos ({metrics.total})
          </button>
          <button
            onClick={() => setFilterStatus('concluidos')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'concluidos'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
            }`}
          >
            Concluídos ({metrics.done})
          </button>
        </div>

        {/* Grupo e Busca */}
        <div className="flex items-center gap-1.5 flex-1 max-w-md justify-end">
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-2 py-1 text-xs rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-500 cursor-pointer truncate max-w-[140px]"
          >
            <option value="todos">Todos Grupos</option>
            {groups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[120px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-7 pr-2.5 py-1 text-xs rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 placeholder:text-slate-400"
            />
          </div>

          {filteredItems.length > 0 && (
            <button
              onClick={() => handleMarkAllFiltered(filterStatus !== 'concluidos')}
              title={filterStatus === 'concluidos' ? 'Desmarcar todos' : 'Marcar todos como OK'}
              className="px-2 py-1 rounded-xl text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 whitespace-nowrap transition-all cursor-pointer"
            >
              {filterStatus === 'concluidos' ? 'Desmarcar' : 'Dar OK Todos'}
            </button>
          )}
        </div>
      </div>

      {/* Lista de Itens do Checklist */}
      <div className="p-2.5 md:p-3 divide-y divide-slate-100 dark:divide-white/5 max-h-[500px] overflow-y-auto custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500 opacity-60" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {filterStatus === 'pendentes' ? '🎉 Nenhuma pendência neste filtro! Tudo em dia!' : 'Nenhum item encontrado.'}
            </p>
            <p className="text-xs text-slate-400">
              {filterStatus === 'pendentes' ? 'Você pode alternar para a aba "Todos" ou adicionar novos itens no botão acima.' : 'Ajuste os filtros de busca ou grupo.'}
            </p>
          </div>
        ) : (
          filteredItems.map(item => {
            const isDone = item.done;
            return (
              <div
                key={item.id}
                onClick={() => handleToggle(item.id)}
                className={`py-2 px-3 rounded-xl flex items-center justify-between gap-3 transition-all cursor-pointer group ${
                  isDone
                    ? 'bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08] text-slate-400 dark:text-slate-500'
                    : 'hover:bg-slate-100 dark:hover:bg-white/[0.03] text-slate-800 dark:text-slate-200'
                }`}
              >
                {/* Lado Esquerdo: Checkbox + Título + Metadados */}
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleToggle(item.id); }}
                    className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                      isDone
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/40'
                        : 'border-slate-300 dark:border-white/30 hover:border-orange-500 text-transparent hover:text-orange-500'
                    }`}
                  >
                    <Check size={14} className={isDone ? 'stroke-[3]' : 'opacity-0'} />
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold leading-tight ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                      <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-bold text-slate-600 dark:text-slate-300">
                        {item.machine}
                      </span>
                      {item.tool && (
                        <span>• {item.tool}</span>
                      )}
                      <span>• {item.group}</span>
                      {isDone && item.doneAt && (
                        <span className="text-emerald-500 font-semibold flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(item.doneAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} ({item.doneBy || 'Tomas'})
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Badge Status & Excluir */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border transition-all ${
                    isDone
                      ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                      : 'bg-orange-500/10 text-orange-500 border-orange-500/20 group-hover:bg-orange-500 group-hover:text-white'
                  }`}>
                    {isDone ? '✓ OK' : 'DAR OK'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                    title="Excluir item"
                    className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer com Dica Rápida */}
      <div className="p-2.5 bg-slate-50 dark:bg-black/20 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Sincronização instantânea no navegador</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-bold text-slate-700 dark:text-slate-300">{metrics.done} OK / {metrics.pending} Restantes</span>
        </div>
      </div>
    </div>
  );
}
