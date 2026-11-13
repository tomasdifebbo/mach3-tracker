import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import { api } from '../../services/api';
import { SectionHeader } from './EncarregadoShared';

const POP_STEPS = [
  { title: 'Identificação', desc: 'Mapear o processo atual, listar cada etapa e identificar pontos de desperdício ou risco de erro.' },
  { title: 'Análise da Causa', desc: 'Aplicar 5 Porquês ou Diagrama de Ishikawa para encontrar a causa raiz do problema.' },
  { title: 'Solução Proposta', desc: 'Definir a melhoria, designar responsável e estabelecer prazo para implementação.' },
  { title: 'Implementação', desc: 'Executar a mudança no processo, atualizar o POP e treinar os operadores.' },
  { title: 'Verificação', desc: 'Medir resultado após 1 semana. Comparar indicadores antes e depois da melhoria.' },
  { title: 'Padronização', desc: 'Registrar no caderno de kaizens, atualizar documento e replicar em outras máquinas se aplicável.' },
];

export function CicloPOP() {
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
