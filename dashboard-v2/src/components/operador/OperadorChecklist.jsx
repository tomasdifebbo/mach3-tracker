import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, Edit2, Trash2 } from 'lucide-react';
import { api } from '../../services/api';

export function OperadorChecklist({ operatorName }) {
  const deviceRole = localStorage.getItem('mach3_device_role') || 'gerente';
  const canManageChecklist = deviceRole === 'gerente' || deviceRole === 'encarregado';

  const today = new Date().toISOString().split('T')[0];
  const [selectedMachine, setSelectedMachine] = useState('router1');
  const [checked, setChecked] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [newItemText, setNewItemText] = useState('');
  const [loading, setLoading] = useState(true);
  const [addingItem, setAddingItem] = useState(false);

  const DEFAULT_CHECKLISTS = {
    router1: {
      name: 'Mesa Router 1',
      items: [
        'Nível de óleo do Spindle e lubrificação dos guias lineares',
        'Limpeza das calhas, mesa de alumínio e duto de sucção de cavacos',
        'Pressão do ar comprimido da linha (Mínimo 6 bar / 87 PSI)',
        'Verificação e aperto do porta-ferramentas / pinça ER32',
        'Teste do botão de parada de emergência do painel',
        'Conferência do ponto de zero peça (X0, Y0, Z0)'
      ]
    },
    router2: {
      name: 'Mesa Router 2',
      items: [
        'Inspeção do nível de água do reservatório / Chiller do Spindle',
        'Verificação visual de folga e sujeira nos eixos X, Y e Z',
        'Limpeza geral da caixa de resíduos e exaustor',
        'Verificação de funcionamento dos sensores de fim de curso (homing)',
        'Checagem do estado físico da fresa instalada'
      ]
    },
    laser: {
      name: 'Laser CO₂ / Ruida',
      items: [
        'Temperatura do Chiller de refrigeração do tubo Laser (20°C - 24°C)',
        'Inspeção e limpeza da lente de foco de 2 polegadas e espelhos',
        'Verificação da exaustão de fumaça e soprador de ar na ponta',
        'Teste do feixe guia (Red Dot) e alinhamento básico',
        'Limpeza e remoção de aparas/retalhos inflamáveis sob o favo de mel'
      ]
    },
    geral: {
      name: 'Rotina Geral do Turno',
      items: [
        'Uso obrigatório de EPIs (Óculos de proteção, protetor auricular e calçado)',
        'Conferência da lista de Ordens de Serviço (O.S.) prioritárias do dia',
        'Organização da área de estoque de materiais (chapas MDF, ACM e Isopor)',
        'Descarte correto de retalhos e limpeza da bancada ao final do turno'
      ]
    }
  };

  const currentMachineData = DEFAULT_CHECKLISTS[selectedMachine] || DEFAULT_CHECKLISTS.router1;

  const fetchCustomItems = useCallback(async () => {
    try {
      const items = await api.get(`/checklists/items?machine_key=${selectedMachine}`);
      if (Array.isArray(items)) setCustomItems(items);
    } catch (err) {
      console.error('Erro ao buscar itens customizados do checklist:', err);
    }
  }, [selectedMachine]);

  const fetchChecklist = useCallback(async () => {
    setLoading(true);
    try {
      await fetchCustomItems();
      const rows = await api.get(`/checklists?machine_key=${selectedMachine}&date=${today}`);
      if (Array.isArray(rows)) {
        const checkedIndices = rows.filter(r => r.done).map(r => r.item_index);
        setChecked(checkedIndices);
      }
    } catch (err) {
      console.error('Erro ao buscar checklist:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMachine, today, fetchCustomItems]);

  useEffect(() => {
    fetchChecklist();
  }, [fetchChecklist]);

  const allItems = customItems.length > 0
    ? customItems.map((item, idx) => ({ id: item.id, index: idx, text: item.item_text }))
    : currentMachineData.items.map((text, idx) => ({ index: idx, text }));

  const toggleItem = async (i) => {
    const isDone = !checked.includes(i);
    setChecked(prev => isDone ? [...prev, i] : prev.filter(x => x !== i));
    try {
      await api.post('/checklists/toggle', {
        machine_key: selectedMachine,
        item_index: i,
        done: isDone,
        date: today
      });
    } catch {
      setChecked(prev => isDone ? prev.filter(x => x !== i) : [...prev, i]);
    }
  };

  const handleEditCustom = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    const newText = prompt('Editar texto do item do checklist:', item.text);
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

  const handleDeleteCustom = async (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Deseja excluir este item do checklist?')) return;
    try {
      if (item.id) {
        await api.deleteCustom(`/checklists/items/${item.id}`);
        fetchCustomItems();
      }
    } catch {
      alert('Erro ao excluir item.');
    }
  };

  const handleAddCustom = async (e) => {
    e.preventDefault();
    if (!newItemText.trim() || addingItem) return;
    setAddingItem(true);
    try {
      const created = await api.post('/checklists/items', {
        machine_key: selectedMachine,
        item_text: newItemText.trim()
      });
      if (created && created.id) {
        setCustomItems(prev => [...prev, created]);
        setNewItemText('');
      }
    } catch {
      alert('Erro ao adicionar item ao checklist.');
    } finally {
      setAddingItem(false);
    }
  };

  const completedCount = allItems.filter(item => checked.includes(item.index)).length;
  const totalCount = allItems.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="glass p-6 md:p-8 rounded-3xl border border-white/10 space-y-6">
      {/* Header do Checklist */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/20 px-2.5 py-0.5 rounded-full">
              Checklist de Operação Diária
            </span>
            <span className="text-xs text-text-muted font-bold">Hoje: {new Date().toLocaleDateString('pt-BR')}</span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white mt-1">
            Rotina & Inspeção do Turno ({operatorName})
          </h2>
          <p className="text-xs text-text-muted font-medium mt-0.5">
            Cumpra os itens de verificação antes e durante o funcionamento das máquinas
          </p>
        </div>

        {/* Barra de Progresso do Checklist */}
        <div className="bg-black/40 p-4 rounded-2xl border border-white/10 w-full md:w-64 space-y-2">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-text-muted">Progresso do Turno:</span>
            <span className={progressPct === 100 ? 'text-accent-success font-black' : 'text-accent-cyan'}>
              {completedCount}/{totalCount} ({progressPct}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 rounded-full ${progressPct === 100 ? 'bg-accent-success' : 'bg-accent-cyan'}`} 
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Botões de Seleção da Máquina / Posto de Trabalho */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'router1', label: ' Router 1 (CNC)' },
          { id: 'router2', label: ' Router 2 (CNC)' },
          { id: 'laser', label: ' Laser CO₂ Ruida' },
          { id: 'geral', label: ' Inspeção Geral do Turno' }
        ].map(m => (
          <button
            key={m.id}
            onClick={() => setSelectedMachine(m.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedMachine === m.id
                ? 'bg-accent-cyan text-black font-black shadow-lg shadow-accent-cyan/20'
                : 'bg-white/5 text-text-muted hover:text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Lista de Itens do Checklist */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-8 text-center text-text-muted text-xs font-bold">Carregando itens do checklist...</div>
        ) : (
          allItems.map(item => {
            const isDone = checked.includes(item.index);
            return (
              <div
                key={item.index}
                onClick={() => toggleItem(item.index)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                  isDone 
                    ? 'bg-accent-success/10 border-accent-success/30 text-white' 
                    : 'bg-white/5 border-white/5 hover:border-white/10 text-white/90'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                    isDone ? 'bg-accent-success border-accent-success text-black' : 'border-white/20 bg-black/40'
                  }`}>
                    {isDone && <CheckCircle2 size={16} strokeWidth={3} />}
                  </div>
                  <span className={`text-xs font-medium ${isDone ? 'line-through opacity-70' : ''}`}>
                    {item.text}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isDone && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-accent-success bg-accent-success/20 px-2.5 py-1 rounded-full">
                      Concluído por {operatorName}
                    </span>
                  )}
                  {canManageChecklist && item.id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleEditCustom(e, item)}
                        className="text-text-muted hover:text-accent-cyan p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                        title="Editar item do checklist"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteCustom(e, item)}
                        className="text-text-muted hover:text-red-400 p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                        title="Excluir item do checklist"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Adicionar Item Personalizado ao Checklist (Apenas Gerente e Coordenador/Encarregado) */}
      {canManageChecklist && (
        <form onSubmit={handleAddCustom} className="flex gap-2 pt-2 border-t border-white/10">
          <input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder={`+ Adicionar novo item ao checklist de ${currentMachineData.name}...`}
            className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-accent-cyan"
          />
          <button
            type="submit"
            disabled={addingItem || !newItemText.trim()}
            className="px-5 py-2 bg-accent-cyan hover:bg-accent-cyan/80 disabled:opacity-50 text-black font-black uppercase text-xs rounded-xl transition-all shadow-md shadow-accent-cyan/20 cursor-pointer"
          >
            {addingItem ? '...' : '+ Adicionar'}
          </button>
        </form>
      )}
    </div>
  );
}
