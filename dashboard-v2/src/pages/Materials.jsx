import React, { useState } from 'react';
import { 
  Box, 
  Plus, 
  Trash2, 
  DollarSign, 
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function Materials({ materials = [], onRefresh }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name || !price) return;
    
    setLoading(true);
    setStatus(null);
    try {
      const resp = await api.addMaterial(name, Number(price));
      if (resp.success) {
        setName('');
        setPrice('');
        setStatus({ type: 'success', message: 'Material cadastrado!' });
        onRefresh();
      } else {
        throw new Error('Falha ao salvar');
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Erro ao cadastrar.' });
    }
    setLoading(false);
    setTimeout(() => setStatus(null), 3000);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const resp = await api.deleteMaterial(id);
      if (resp && resp.success) {
        onRefresh();
        setConfirmDeleteId(null);
      } else {
        alert('Erro ao excluir: ' + (resp?.error || 'Erro desconhecido'));
      }
    } catch (err) { 
      alert('Erro de rede: Verifique sua conexão.'); 
    }
    setDeletingId(null);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      {/* Input Section */}
      <section className="glass p-10 rounded-[40px] border-border/40 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-cyan/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-accent-cyan/20 transition-all duration-700"></div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-8">
            <div className="p-4 bg-accent-cyan text-black rounded-2xl shadow-xl shadow-accent-cyan/20">
              <Plus size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Novo Material</h2>
              <p className="text-sm text-text-muted">Cadastre insumos para cálculo automático de custos.</p>
            </div>
          </div>

          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-6">
            <div className="flex-1 min-w-[300px] space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Nome do Insumo</label>
              <div className="relative group">
                <Box size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-cyan transition-colors" />
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Alumínio 2mm, MDF Branco..." 
                  className="w-full bg-white/5 border border-border px-12 py-3.5 rounded-2xl outline-none focus:border-accent-cyan/50 focus:bg-white/[0.08] transition-all text-white font-medium shadow-inner"
                  required
                />
              </div>
            </div>

            <div className="w-[200px] space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Preço por Unidade</label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold group-focus-within:text-accent-cyan">R$</span>
                <input 
                  type="number" 
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00" 
                  className="w-full bg-white/5 border border-border px-12 py-3.5 rounded-2xl outline-none focus:border-accent-cyan/50 transition-all text-white font-bold"
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="px-8 py-3.5 bg-accent-cyan text-black font-extrabold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent-cyan/20 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Adicionar Insumo'}
            </button>
          </form>

          {status && (
            <div className={`mt-6 flex items-center gap-2 p-3 rounded-xl text-sm font-bold border ${status.type === 'success' ? 'bg-accent-success/10 border-accent-success/30 text-accent-success' : 'bg-accent-danger/10 border-accent-danger/30 text-accent-danger'}`}>
              {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {status.message}
            </div>
          )}
        </div>
      </section>

      {/* List Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xl font-bold flex items-center gap-3">
            <Layers size={22} className="text-accent-cyan" /> 
            Materiais Cadastrados
            <span className="text-xs bg-white/5 px-2 py-1 rounded-md text-text-muted font-mono">{materials.length} itens</span>
          </h3>
          <div className="flex items-center gap-2 bg-white/5 border border-border px-4 py-2 rounded-xl focus-within:border-accent-cyan/50 transition-all w-64">
            <Search size={16} className="text-text-muted" />
            <input type="text" placeholder="Buscar..." className="bg-transparent border-none outline-none text-sm w-full" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {materials.map((m) => (
            <div key={m.id} className="glass p-6 rounded-3xl border-border/40 hover:border-accent-cyan/30 transition-all group duration-300 relative overflow-hidden">
               <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-white/5 text-text-muted rounded-xl group-hover:bg-accent-cyan/10 group-hover:text-accent-cyan transition-colors">
                    <Box size={24} />
                  </div>
                  
                  {confirmDeleteId === m.id ? (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                       <button 
                        onClick={() => handleDelete(m.id)}
                        disabled={deletingId === m.id}
                        className="px-3 py-1.5 bg-accent-danger text-white rounded-xl hover:bg-accent-danger/80 transition-all text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent-danger/20"
                      >
                        {deletingId === m.id ? '...' : 'Confirmar'}
                      </button>
                      <button 
                        onClick={() => setConfirmDeleteId(null)}
                        className="p-1.5 bg-white/5 text-text-muted rounded-lg hover:text-white transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setConfirmDeleteId(m.id)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-accent-danger/10 text-accent-danger border border-accent-danger/20 rounded-xl hover:bg-accent-danger hover:text-white transition-all text-[10px] font-black uppercase tracking-widest"
                    >
                      <Trash2 size={14} /> Excluir
                    </button>
                  )}
               </div>
              
              <h4 className="text-lg font-bold text-white mb-2 tracking-tight group-hover:translate-x-1 transition-transform">{m.name}</h4>
              <div className="flex items-center gap-2">
                <div className="text-sm font-black text-accent-cyan bg-accent-cyan/10 px-3 py-1 rounded-full border border-accent-cyan/20">
                  {formatCurrency(m.price)}
                </div>
                <span className="text-[10px] text-text-muted uppercase font-black tracking-widest">por unidade</span>
              </div>

              {confirmDeleteId === m.id && (
                <div className="mt-4 p-2 bg-accent-danger/5 rounded-lg border border-accent-danger/10 flex items-center gap-2 text-[9px] text-accent-danger font-bold uppercase tracking-tighter">
                  <AlertTriangle size={12} /> Esta ação não pode ser desfeita
                </div>
              )}
            </div>
          ))}
          
          {materials.length === 0 && (
            <div className="col-span-full py-20 text-center glass border-dashed rounded-[40px] opacity-40">
              <Box size={48} className="mx-auto mb-4" />
              <p className="font-bold">Nenhum material cadastrado ainda.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
