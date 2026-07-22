import React, { useState, useMemo } from 'react';
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
  AlertTriangle,
  Zap,
  Maximize2,
  Edit2,
  Gauge
} from 'lucide-react';
import { api } from '../services/api';
import { calculateInsumo } from '../utils/insumoCalculator';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

export function Materials({ materials = [], onRefresh }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [feedRate, setFeedRate] = useState('3000');
  const [passWidth, setPassWidth] = useState('100');
  const [sheetWidth, setSheetWidth] = useState('2750');
  const [sheetHeight, setSheetHeight] = useState('1850');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState(null);

  // Live preview for 60 min (1 hour) & Sheet Area
  const sheetAreaM2 = useMemo(() => {
    const w = parseFloat(sheetWidth) || 0;
    const h = parseFloat(sheetHeight) || 0;
    return ((w * h) / 1000000).toFixed(3);
  }, [sheetWidth, sheetHeight]);

  const preview = useMemo(() => {
    const p = parseFloat(String(price).replace(',', '.')) || 0;
    const f = parseFloat(feedRate) || 3000;
    const w = parseFloat(passWidth) || 100;
    return calculateInsumo({
      durationMinutes: 60,
      pricePerM2: p,
      feedRateMmMin: f,
      passWidthMm: w
    });
  }, [price, feedRate, passWidth]);

  const handleAddOrUpdate = async (e) => {
    e.preventDefault();
    if (!name || price === '') return;
    
    let numPrice = typeof price === 'string' ? parseFloat(price.replace(',', '.')) : Number(price);
    let numFeed = parseFloat(feedRate) || 3000;
    let numPass = parseFloat(passWidth) || 100;
    let numSheetW = parseFloat(sheetWidth) || 2750;
    let numSheetH = parseFloat(sheetHeight) || 1850;
    
    if (isNaN(numPrice)) {
      setStatus({ type: 'error', message: 'Preço por m² inválido.' });
      setTimeout(() => setStatus(null), 3000);
      return;
    }
    
    setLoading(true);
    setStatus(null);
    try {
      if (editingMaterial) {
        const resp = await api.updateMaterial(editingMaterial.id, {
          name,
          price: numPrice,
          feed_rate: numFeed,
          pass_width: numPass,
          sheet_width_mm: numSheetW,
          sheet_height_mm: numSheetH
        });
        if (resp && resp.success) {
          setName('');
          setPrice('');
          setFeedRate('3000');
          setPassWidth('100');
          setSheetWidth('2750');
          setSheetHeight('1850');
          setEditingMaterial(null);
          setStatus({ type: 'success', message: 'Material atualizado!' });
          onRefresh();
        } else {
          throw new Error(resp?.error || 'Falha ao atualizar');
        }
      } else {
        const resp = await api.addMaterial(name, numPrice, numFeed, numPass, numSheetW, numSheetH);
        if (resp && resp.success) {
          setName('');
          setPrice('');
          setFeedRate('3000');
          setPassWidth('100');
          setSheetWidth('2750');
          setSheetHeight('1850');
          setStatus({ type: 'success', message: 'Insumo cadastrado com sucesso!' });
          onRefresh();
        } else {
          throw new Error(resp?.error || 'Falha ao salvar');
        }
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Erro ao salvar material.' });
    }
    setLoading(false);
    setTimeout(() => setStatus(null), 3000);
  };

  const handleStartEdit = (mat) => {
    setEditingMaterial(mat);
    setName(mat.name || '');
    setPrice(mat.price !== undefined ? String(mat.price) : '');
    setFeedRate(mat.feed_rate !== undefined ? String(mat.feed_rate) : '3000');
    setPassWidth(mat.pass_width !== undefined ? String(mat.pass_width) : '100');
    setSheetWidth(mat.sheet_width_mm !== undefined ? String(mat.sheet_width_mm) : '2750');
    setSheetHeight(mat.sheet_height_mm !== undefined ? String(mat.sheet_height_mm) : '1850');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingMaterial(null);
    setName('');
    setPrice('');
    setFeedRate('3000');
    setPassWidth('100');
    setSheetWidth('2750');
    setSheetHeight('1850');
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

  const filteredMaterials = materials.filter(m => 
    m.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      {/* Form Section */}
      <section className="glass p-10 rounded-[40px] border-border/40 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent-cyan/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-accent-cyan/20 transition-all duration-700"></div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-accent-cyan text-black rounded-2xl shadow-xl shadow-accent-cyan/20">
                {editingMaterial ? <Edit2 size={24} /> : <Plus size={24} />}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {editingMaterial ? 'Editar Insumo' : 'Novo Insumo / Material'}
                </h2>
                <p className="text-sm text-text-muted">
                  Cálculo automático de m² baseado na velocidade da fresa (feed rate) e largura do passo.
                </p>
              </div>
            </div>
            {editingMaterial && (
              <button 
                onClick={handleCancelEdit}
                className="px-4 py-2 bg-white/10 text-xs font-bold text-white rounded-xl hover:bg-white/20 transition-all"
              >
                Cancelar Edição
              </button>
            )}
          </div>

          <form onSubmit={handleAddOrUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Nome do Insumo */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Nome do Insumo</label>
                <div className="relative group">
                  <Box size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-cyan transition-colors" />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: MDF 15mm, Acrílico 3mm..." 
                    className="w-full bg-white/5 border border-border px-11 py-3 rounded-2xl outline-none focus:border-accent-cyan/50 focus:bg-white/[0.08] transition-all text-white font-medium text-sm shadow-inner"
                    required
                  />
                </div>
              </div>

              {/* Preço por m² */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Preço por m² (R$/m²)</label>
                <div className="relative group">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold text-xs group-focus-within:text-accent-cyan">R$</span>
                  <input 
                    type="text" 
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00" 
                    className="w-full bg-white/5 border border-border px-11 py-3 rounded-2xl outline-none focus:border-accent-cyan/50 transition-all text-white font-bold text-sm"
                    required
                  />
                </div>
              </div>

              {/* Velocidade da Fresa (Feed Rate) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1 flex items-center justify-between">
                  <span>Velocidade Fresa</span>
                  <span className="text-accent-cyan font-mono text-[9px]">mm/min</span>
                </label>
                <div className="relative group">
                  <Gauge size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-cyan transition-colors" />
                  <input 
                    type="number" 
                    value={feedRate}
                    onChange={(e) => setFeedRate(e.target.value)}
                    placeholder="3000" 
                    className="w-full bg-white/5 border border-border px-11 py-3 rounded-2xl outline-none focus:border-accent-cyan/50 transition-all text-white font-bold text-sm"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Configurações da Chapa Padrão & Passo Lateral */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-white/5">
              {/* Passo Lateral */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1 flex items-center justify-between">
                  <span>Passo Lateral</span>
                  <span className="text-accent-cyan font-mono text-[9px]">mm</span>
                </label>
                <div className="relative group">
                  <Maximize2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-cyan transition-colors" />
                  <input 
                    type="number" 
                    value={passWidth}
                    onChange={(e) => setPassWidth(e.target.value)}
                    placeholder="100" 
                    className="w-full bg-white/5 border border-border px-11 py-3 rounded-2xl outline-none focus:border-accent-cyan/50 transition-all text-white font-bold text-sm"
                    required
                  />
                </div>
              </div>

              {/* Largura da Chapa (mm) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1 flex items-center justify-between">
                  <span>Largura Chapa Padrão</span>
                  <span className="text-orange-400 font-mono text-[9px]">mm</span>
                </label>
                <div className="relative group">
                  <Maximize2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400 group-focus-within:text-accent-cyan transition-colors" />
                  <input 
                    type="number" 
                    value={sheetWidth}
                    onChange={(e) => setSheetWidth(e.target.value)}
                    placeholder="2750" 
                    className="w-full bg-white/5 border border-border px-11 py-3 rounded-2xl outline-none focus:border-accent-cyan/50 transition-all text-white font-bold text-sm"
                    required
                  />
                </div>
              </div>

              {/* Comprimento da Chapa (mm) */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1 flex items-center justify-between">
                  <span>Comprimento Chapa Padrão</span>
                  <span className="text-orange-400 font-mono text-[9px]">mm</span>
                </label>
                <div className="relative group">
                  <Maximize2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400 group-focus-within:text-accent-cyan transition-colors" />
                  <input 
                    type="number" 
                    value={sheetHeight}
                    onChange={(e) => setSheetHeight(e.target.value)}
                    placeholder="1850" 
                    className="w-full bg-white/5 border border-border px-11 py-3 rounded-2xl outline-none focus:border-accent-cyan/50 transition-all text-white font-bold text-sm"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Simulation callout box */}
            <div className="p-4 bg-white/[0.03] border border-white/10 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs text-text-muted">
                <Zap size={18} className="text-orange-400 shrink-0" />
                <div>
                  <span className="text-white font-bold">Simulação em 1 Hora de Operação: </span>
                  <span>
                    A <strong className="text-orange-400">{feedRate || 3000} mm/min</strong> e passo de <strong className="text-accent-cyan">{passWidth || 100} mm</strong>, usina:
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0 text-xs font-mono">
                <div className="bg-black/30 border border-white/5 px-3 py-1.5 rounded-xl">
                  <span className="text-text-muted">Linear: </span>
                  <strong className="text-white">{preview.linearMeters} m</strong>
                </div>
                <div className="bg-black/30 border border-white/5 px-3 py-1.5 rounded-xl">
                  <span className="text-text-muted">Área: </span>
                  <strong className="text-accent-cyan">{preview.areaM2} m²</strong>
                </div>
                <div className="bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-xl">
                  <span className="text-orange-400">Insumo/h: </span>
                  <strong className="text-orange-400">{formatCurrency(preview.totalCost)}</strong>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button 
                type="submit" 
                disabled={loading}
                className="px-8 py-3 bg-accent-cyan text-black font-extrabold rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent-cyan/20 disabled:opacity-50 text-xs uppercase tracking-widest"
              >
                {loading ? 'Salvando...' : editingMaterial ? 'Atualizar Insumo' : 'Cadastrar Insumo'}
              </button>
            </div>
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
            Insumos Cadastrados
            <span className="text-xs bg-white/5 px-2.5 py-1 rounded-md text-text-muted font-mono">{materials.length} itens</span>
          </h3>
          <div className="flex items-center gap-2 bg-white/5 border border-border px-4 py-2 rounded-xl focus-within:border-accent-cyan/50 transition-all w-64">
            <Search size={16} className="text-text-muted" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar insumo..." 
              className="bg-transparent border-none outline-none text-sm w-full text-white" 
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMaterials.map((m) => {
            const fRate = m.feed_rate || 3000;
            const pWidth = m.pass_width || 100;
            const m1h = calculateInsumo({ durationMinutes: 60, pricePerM2: m.price || 0, feedRateMmMin: fRate, passWidthMm: pWidth });
            
            return (
              <div key={m.id} className="glass p-6 rounded-3xl border-border/40 hover:border-accent-cyan/30 transition-all group duration-300 relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-white/5 text-text-muted rounded-xl group-hover:bg-accent-cyan/10 group-hover:text-accent-cyan transition-colors">
                      <Box size={22} />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleStartEdit(m)}
                        className="p-2 bg-white/5 border border-border text-text-muted hover:text-white hover:bg-white/10 transition-all rounded-xl text-xs"
                        title="Editar insumo"
                      >
                        <Edit2 size={14} />
                      </button>

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
                          className="p-2 bg-accent-danger/10 text-accent-danger border border-accent-danger/20 rounded-xl hover:bg-accent-danger hover:text-white transition-all text-xs"
                          title="Excluir insumo"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                
                  <h4 className="text-lg font-bold text-white mb-2 tracking-tight group-hover:translate-x-1 transition-transform">{m.name}</h4>
                  
                  <div className="flex items-center gap-2 mb-4">
                    <div className="text-sm font-black text-accent-cyan bg-accent-cyan/10 px-3 py-1 rounded-full border border-accent-cyan/20">
                      {formatCurrency(m.price)} / m²
                    </div>
                  </div>

                  {/* Operational parameters */}
                  <div className="space-y-2 py-3 border-t border-white/5 text-xs text-text-muted font-mono">
                    <div className="flex justify-between items-center">
                      <span>Chapa Padrão:</span>
                      <span className="text-orange-400 font-bold">
                        {m.sheet_width_mm || 2750} × {m.sheet_height_mm || 1850} mm ({(((m.sheet_width_mm || 2750) * (m.sheet_height_mm || 1850)) / 1000000).toFixed(2)} m²)
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Velocidade Fresa:</span>
                      <span className="text-white font-bold">{fRate} mm/min</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Passo Lateral:</span>
                      <span className="text-white font-bold">{pWidth} mm</span>
                    </div>
                    <div className="flex justify-between items-center text-orange-400 font-bold border-t border-white/5 pt-2 mt-1">
                      <span>Consumo / Hora:</span>
                      <span>{m1h.areaM2} m² ({formatCurrency(m1h.totalCost)}/h)</span>
                    </div>
                  </div>
                </div>

                {confirmDeleteId === m.id && (
                  <div className="mt-4 p-2 bg-accent-danger/5 rounded-lg border border-accent-danger/10 flex items-center gap-2 text-[9px] text-accent-danger font-bold uppercase tracking-tighter">
                    <AlertTriangle size={12} /> Esta ação não pode ser desfeita
                  </div>
                )}
              </div>
            );
          })}
          
          {filteredMaterials.length === 0 && (
            <div className="col-span-full py-20 text-center glass border-dashed rounded-[40px] opacity-40">
              <Box size={48} className="mx-auto mb-4" />
              <p className="font-bold">Nenhum material encontrado.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
