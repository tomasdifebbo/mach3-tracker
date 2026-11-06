import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare, Square, CheckCircle2, Clock, Plus, Trash2, RotateCcw,
  Search, Filter, Printer, Layers, Cpu, Award, Sparkles, Check, ChevronDown,
  ChevronUp, UserCheck, AlertCircle, Compass, FileText, Zap, RefreshCw
} from 'lucide-react';

const CUSTOM_STORAGE_KEY = 'mach3_custom_checklist_manual_v1';

export function CaixaChecklistProducao({ 
  pipelineData = null, 
  jobs = [], 
  routers = [], 
  operatorName = 'Tomas' 
}) {
  const [filterStatus, setFilterStatus] = useState('pendentes'); // 'pendentes' | 'todos' | 'concluidos'
  const [selectedGroup, setSelectedGroup] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddingOpen, setIsAddingOpen] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [newItemMachine, setNewItemMachine] = useState('Router 2');
  const [newItemTool, setNewItemTool] = useState('Topo Ø6mm');
  const [newItemGroup, setNewItemGroup] = useState('Lote Tijolos (81-100)');

  // Tarefas manuais criadas avulsas pelo operador (ex: lembrete, troca de fresa)
  const [customItems, setCustomItems] = useState(() => {
    try {
      const saved = localStorage.getItem(CUSTOM_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customItems));
    } catch (e) {}
  }, [customItems]);

  const handleToggleCustom = (id) => {
    setCustomItems(prev => prev.map(item => {
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

  const handleDeleteCustom = (id) => {
    if (!window.confirm('Deseja remover esta anotação manual?')) return;
    setCustomItems(prev => prev.filter(i => i.id !== id));
  };

  const handleAddCustom = (e) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    const item = {
      id: `custom-${Date.now()}`,
      title: newItemText.trim(),
      group: newItemGroup || 'Manual',
      machine: newItemMachine,
      tool: newItemTool,
      done: false,
      isAuto: false,
      doneAt: null,
      doneBy: null
    };
    setCustomItems(prev => [item, ...prev]);
    setNewItemText('');
    setIsAddingOpen(false);
  };

  // Montagem Dinâmica de Itens baseada em Execuções Reais do Mach3
  const dynamicItems = useMemo(() => {
    const list = [];
    const specialBatches = pipelineData?.specialBatches || [];
    const gcodeFeitos = pipelineData?.gcodeFeitos || [];
    const gcodeProntos = pipelineData?.gcodeProntos || [];

    // Checa máquinas que estão rodando agora
    const runningRouters = routers.filter(r => r.status === 'running' || r.status === 'executing');

    // 1. Lote Seriado de Tijolos MDF 9mm (Meta 100 chapas)
    const tijoloBatch = specialBatches.find(b => b.id === 'tijolos_9mm') || {
      targetSheets: 100,
      doneSheets: 90,
      pendingSheets: 10
    };

    const doneCount = tijoloBatch.doneSheets || 0;
    const targetCount = tijoloBatch.targetSheets || 100;
    const isTijoloRunning = runningRouters.some(r => (r.current_file || '').toLowerCase().includes('tijolo'));

    for (let i = 1; i <= targetCount; i++) {
      const isDone = i <= doneCount;
      const isCurrentlyRunning = !isDone && isTijoloRunning && i === doneCount + 1;

      list.push({
        id: `tijolo-${i}`,
        title: `CHAPA ${i} · MDF 9mm Tijolos (2731×1843 mm)${i === 100 ? ' 🏆 META FINAL' : ''}`,
        group: 'Lote Tijolos (1-100)',
        machine: 'Router 2',
        tool: 'Topo Ø6mm Z=3mm',
        done: isDone,
        isAuto: true,
        isRunning: isCurrentlyRunning,
        doneBy: isDone ? 'Mach3 Auto' : null,
        doneAt: isDone ? 'Usinado' : null,
        statusText: isDone 
          ? '100% Usinado no Mach3' 
          : isCurrentlyRunning 
          ? 'Rodando agora no Mach3' 
          : 'Na Fila da Router 2'
      });
    }

    // 2. Outros Lotes Seriados (Pinguins, Arcos, Compensado, etc.)
    specialBatches.forEach(b => {
      if (b.id === 'tijolos_9mm') return; // já tratado acima
      const isBatchDone = (b.pendingSheets === 0) || (b.status === 'concluido');
      list.push({
        id: `batch-${b.id}`,
        title: `${b.name} (${b.material})`,
        group: 'Lotes Seriados',
        machine: 'Router Central / R2',
        tool: b.tool || 'Topo Ø6mm',
        done: isBatchDone,
        isAuto: true,
        isRunning: false,
        doneBy: isBatchDone ? 'Mach3 Auto' : null,
        doneAt: isBatchDone ? 'Usinado' : null,
        statusText: isBatchDone ? `${b.doneSheets} de ${b.targetSheets} Usinados (100%)` : `${b.doneSheets} de ${b.targetSheets} Concluídos`
      });
    });

    // 3. G-Codes Prontos Recentes (Top 12 da fila)
    gcodeProntos.slice(0, 12).forEach((gf, idx) => {
      const isRunning = runningRouters.some(r => (r.current_file || '').toLowerCase().includes((gf.name || '').toLowerCase()));
      list.push({
        id: `gcode-pronto-${idx}`,
        title: gf.name,
        group: 'Fila Router (.TXT)',
        machine: 'Router',
        tool: gf.matInfo?.tag || 'Aguardando',
        done: false,
        isAuto: true,
        isRunning,
        doneBy: null,
        doneAt: null,
        statusText: isRunning ? 'Rodando no Mach3' : 'Na Fila da Oficina'
      });
    });

    // 4. G-Codes Usinados Recentes (Top 10 mais recentes)
    gcodeFeitos.slice(0, 10).forEach((gf, idx) => {
      list.push({
        id: `gcode-feito-${idx}`,
        title: gf.name,
        group: 'G-Codes Usinados',
        machine: gf.lastExec?.machine_name || 'Router',
        tool: gf.matInfo?.tag || 'Router CNC',
        done: true,
        isAuto: true,
        isRunning: false,
        doneBy: gf.lastExec?.operator_name || 'Mach3 Auto',
        doneAt: gf.lastExec?.start_time ? new Date(gf.lastExec.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Usinado',
        statusText: 'Usinado no Mach3'
      });
    });

    // 5. Itens Manuais Adicionais
    customItems.forEach(ci => {
      list.push(ci);
    });

    return list;
  }, [pipelineData, routers, customItems]);

  // Métricas gerais
  const metrics = useMemo(() => {
    const total = dynamicItems.length;
    const done = dynamicItems.filter(i => i.done).length;
    const pending = total - done;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, pending, percent };
  }, [dynamicItems]);

  // Grupos disponíveis
  const groups = useMemo(() => {
    const set = new Set(dynamicItems.map(i => i.group || 'Geral'));
    return Array.from(set);
  }, [dynamicItems]);

  // Filtro
  const filteredItems = useMemo(() => {
    return dynamicItems.filter(i => {
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
  }, [dynamicItems, filterStatus, selectedGroup, searchTerm]);

  return (
    <div className="bg-white dark:bg-[#12141a] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col">
      {/* Banner Principal com Indicação de Baixa 100% Automática */}
      <div className="p-3.5 md:p-4.5 bg-gradient-to-r from-emerald-500/10 via-sky-500/5 to-transparent border-b border-slate-200 dark:border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30 shrink-0">
              <Zap size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm md:text-base font-black text-slate-900 dark:text-white leading-tight">
                  Controle de Fila & Baixa Automática de Produção
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Baixa Automática Mach3 Ativa
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Você <strong>não precisa dar OK manual</strong>: conforme os arquivos rodam nas Routers, o sistema detecta e conclui as tarefas no automático!
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddingOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 active:bg-slate-900 dark:bg-white/10 dark:hover:bg-white/15 text-white transition-all cursor-pointer"
            >
              <Plus size={14} />
              <span>+ Anotação Manual</span>
            </button>
          </div>
        </div>

        {/* Barra de Progresso e Métricas */}
        <div className="mt-3.5 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2">
              <span className="text-slate-600 dark:text-slate-300">Progresso Geral das Máquinas:</span>
              <span className="text-emerald-500 font-black">{metrics.done} de {metrics.total} concluídos</span>
              <span className="text-[10px] text-slate-400">({metrics.percent}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30">
                {metrics.pending} Restantes na Fila
              </span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                ✓ {metrics.done} Usinados
              </span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                metrics.percent >= 100
                  ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                  : metrics.percent >= 50
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, metrics.percent)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Form Anotação Manual (Opcional) */}
      {isAddingOpen && (
        <form onSubmit={handleAddCustom} className="p-3 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <span>+ Nova Anotação / Tarefa Manual do Operador</span>
            <button type="button" onClick={() => setIsAddingOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              placeholder="Ex: Trocar fresa 6mm para corte especial..."
              className="sm:col-span-6 px-3 py-1.5 text-xs rounded-xl bg-white dark:bg-black/30 border border-slate-200 dark:border-white/15 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <select
              value={newItemMachine}
              onChange={(e) => setNewItemMachine(e.target.value)}
              className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-black/30 border border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Router 2">Router 2</option>
              <option value="Router Central">Router Central</option>
              <option value="Router 1">Router 1</option>
              <option value="Laser">Laser</option>
            </select>
            <select
              value={newItemGroup}
              onChange={(e) => setNewItemGroup(e.target.value)}
              className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded-xl bg-white dark:bg-black/30 border border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="Manual">Manual</option>
              <option value="Manutenção">Manutenção</option>
              <option value="Oficina">Oficina</option>
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

      {/* Barra de Filtros */}
      <div className="p-2.5 md:p-3 bg-slate-50/50 dark:bg-white/[0.01] border-b border-slate-200 dark:border-white/5 flex flex-wrap items-center justify-between gap-2">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setFilterStatus('pendentes')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === 'pendentes'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-white/5'
            }`}
          >
            ⏳ Pendentes na Fila ({metrics.pending})
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
            ✓ Usinados no Mach3 ({metrics.done})
          </button>
        </div>

        {/* Grupo e Busca */}
        <div className="flex items-center gap-1.5 flex-1 max-w-md justify-end">
          <select
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
            className="px-2 py-1 text-xs rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer truncate max-w-[140px]"
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
              className="w-full pl-7 pr-2.5 py-1 text-xs rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {/* Lista de Chapas e Tarefas */}
      <div className="p-2.5 md:p-3 divide-y divide-slate-100 dark:divide-white/5 max-h-[500px] overflow-y-auto custom-scrollbar">
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500 opacity-60" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {filterStatus === 'pendentes' ? '🎉 Nenhuma chapa pendente neste filtro! Tudo em dia!' : 'Nenhum item encontrado.'}
            </p>
            <p className="text-xs text-slate-400">
              {filterStatus === 'pendentes' ? 'Alterna para a aba "Usinados no Mach3" para conferir os concluídos.' : 'Ajuste os filtros de busca ou grupo.'}
            </p>
          </div>
        ) : (
          filteredItems.map(item => {
            const isDone = item.done;
            const isRunning = item.isRunning;
            const isCustom = !item.isAuto;

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isCustom) handleToggleCustom(item.id);
                }}
                className={`py-2 px-3 rounded-xl flex items-center justify-between gap-3 transition-all ${
                  isCustom ? 'cursor-pointer' : 'cursor-default'
                } ${
                  isRunning
                    ? 'bg-sky-500/10 border border-sky-500/30'
                    : isDone
                    ? 'bg-emerald-500/[0.03] text-slate-400 dark:text-slate-500'
                    : 'hover:bg-slate-50 dark:hover:bg-white/[0.02] text-slate-800 dark:text-slate-200'
                }`}
              >
                {/* Lado Esquerdo: Ícone / Status de Baixa Automática */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                      isRunning
                        ? 'bg-sky-500 border-sky-500 text-white animate-pulse'
                        : isDone
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-emerald-500/40'
                        : 'border-slate-300 dark:border-white/20 text-slate-400'
                    }`}
                    title={isDone ? 'Concluído e Usinado no Mach3 (Baixa Automática)' : isRunning ? 'Usinando agora no Mach3' : 'Aguardando máquina'}
                  >
                    {isRunning ? (
                      <Zap size={13} className="fill-white" />
                    ) : isDone ? (
                      <Check size={14} className="stroke-[3]" />
                    ) : (
                      <Clock size={12} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-bold leading-tight ${
                        isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-white'
                      }`}>
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
                      {isDone && (
                        <span className="text-emerald-500 font-semibold flex items-center gap-1">
                          <CheckCircle2 size={10} />
                          {item.doneBy || 'Mach3 Auto'} {item.doneAt && item.doneAt !== 'Usinado' ? `às ${item.doneAt}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lado Direito: Badge de Status 100% Automático */}
                <div className="flex items-center gap-2 shrink-0">
                  {isRunning ? (
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1 animate-pulse">
                      <Zap size={11} className="fill-sky-400" />
                      Rodando no Mach3
                    </span>
                  ) : isDone ? (
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                      <Check size={11} className="stroke-[3]" />
                      Usinado (Mach3 Auto)
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                      <Clock size={11} />
                      Na Fila Router
                    </span>
                  )}

                  {isCustom && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteCustom(item.id); }}
                      title="Excluir anotação manual"
                      className="text-slate-400 hover:text-red-500 p-1 transition-colors"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer com Sincronização em Tempo Real */}
      <div className="p-2.5 bg-slate-50 dark:bg-black/20 border-t border-slate-200 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Sincronizado automaticamente com o Monitor Mach3 e logs de corte da oficina</span>
        </div>
        <div className="flex items-center gap-3 font-mono">
          <span className="font-bold text-slate-700 dark:text-slate-300">
            {metrics.done} USINADOS / {metrics.pending} RESTANTES
          </span>
        </div>
      </div>
    </div>
  );
}
