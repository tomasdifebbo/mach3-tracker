import React, { useState, useEffect } from 'react';
import { X, Link2, FileText, CheckCircle2, Loader2, Play } from 'lucide-react';
import { api } from '../services/api';

export function LinkProjectModal({ job, routerName, onClose, onSuccess }) {
  const [kanbanCards, setKanbanCards] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [customName, setCustomName] = useState(job?.file_name || '');
  const [mode, setMode] = useState('link'); // 'link' or 'custom'
  const [loadingCards, setLoadingCards] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadCards() {
      setLoadingCards(true);
      setError('');
      try {
        const cards = await api.get('/kanban');
        if (Array.isArray(cards)) {
          // Filter only 'todo' tasks to show as options to link
          const todoCards = cards.filter(c => c.column_id === 'todo');
          setKanbanCards(todoCards);
          if (todoCards.length > 0) {
            setSelectedCardId(todoCards[0].id);
          } else {
            setMode('custom'); // Default to custom if no TODO cards exist
          }
        }
      } catch (err) {
        console.error('Erro ao carregar cartões Kanban:', err);
        setError('Não foi possível carregar as Ordens de Serviço.');
      } finally {
        setLoadingCards(false);
      }
    }
    loadCards();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (mode === 'link') {
        const card = kanbanCards.find(c => String(c.id) === String(selectedCardId));
        if (!card) {
          throw new Error('Nenhuma Ordem de Serviço selecionada.');
        }

        // 1. Update the Kanban card status to 'doing' and set machine to routerName
        await api.patch(`/kanban/${card.id}`, { 
          column_id: 'doing', 
          machine: routerName 
        });

        // 2. Update the active job's file_name to match the Kanban card's title
        await api.patch(`/jobs/${job.id}`, {
          file_name: card.title,
          folder: `LaserCAD`
        });
      } else {
        if (!customName.trim()) {
          throw new Error('Por favor, informe o nome do projeto.');
        }

        // Update the active job's file_name to the custom name
        await api.patch(`/jobs/${job.id}`, {
          file_name: customName.trim(),
          folder: `LaserCAD`
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao salvar a vinculação.');
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
          <div className="flex items-center gap-2">
            <Link2 className="text-orange-400" size={18} />
            <h3 className="text-sm font-black uppercase tracking-widest text-orange-400">
              Vincular O.S. à Máquina
            </h3>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-text-muted hover:text-white transition-colors font-bold text-xs uppercase tracking-wider"
          >
            Fechar
          </button>
        </div>

        {/* Current status info */}
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">Arquivo na máquina ({routerName})</span>
          <div className="flex items-center gap-2 text-white">
            <FileText size={16} className="text-accent-cyan" />
            <span className="text-sm font-semibold truncate">{job?.file_name}</span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl font-medium">
            {error}
          </div>
        )}

        {/* Mode selector tab */}
        {kanbanCards.length > 0 && (
          <div className="flex border-b border-white/5 pb-2 mb-2 gap-4">
            <button
              type="button"
              onClick={() => setMode('link')}
              className={`text-xs font-bold uppercase tracking-wider pb-1 transition-colors relative ${
                mode === 'link' ? 'text-white' : 'text-text-muted hover:text-white'
              }`}
            >
              Vincular a uma O.S.
              {mode === 'link' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />}
            </button>
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`text-xs font-bold uppercase tracking-wider pb-1 transition-colors relative ${
                mode === 'custom' ? 'text-white' : 'text-text-muted hover:text-white'
              }`}
            >
              Definir Nome Manual
              {mode === 'custom' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400" />}
            </button>
          </div>
        )}

        {mode === 'link' ? (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Selecione a Ordem de Serviço (A Fazer)</label>
            {loadingCards ? (
              <div className="flex items-center justify-center p-4 text-xs text-text-muted gap-2">
                <Loader2 className="animate-spin text-orange-400" size={14} /> Carregando cartões...
              </div>
            ) : (
              <select
                value={selectedCardId}
                onChange={(e) => setSelectedCardId(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors cursor-pointer"
              >
                {kanbanCards.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.title} {c.priority ? `(${c.priority.toUpperCase()})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-text-muted">Nome do Projeto / O.S.</label>
            <input
              type="text"
              required
              placeholder="ex: Caixa de Som do João"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:border-orange-500 focus:outline-none transition-colors"
            />
          </div>
        )}

        <div className="flex items-center gap-3 mt-4">
          <button
            type="submit"
            disabled={saving || (mode === 'link' && kanbanCards.length === 0)}
            className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/40 text-black font-black uppercase tracking-widest rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin" size={14} /> Salvando...
              </>
            ) : (
              <>
                <CheckCircle2 size={14} /> Confirmar Vinculação
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
