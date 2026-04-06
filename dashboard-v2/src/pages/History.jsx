import React, { useState } from 'react';
import { 
  Filter, 
  Download, 
  Trash2, 
  ExternalLink, 
  Calendar,
  Layers,
  ChevronDown,
  Search,
  CheckCircle2,
  X,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '-';

export function History({ jobs = [], materials = [], onRefresh }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  
  const filteredJobs = jobs.filter(j => 
    j.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    j.folder?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    const headers = ['ID', 'Arquivo', 'Projeto', 'Inicio', 'Fim', 'Duracao (min)', 'Material', 'Custo (R$)', 'Data'];
    const rows = jobs.map(j => [
      j.id,
      j.file_name,
      j.folder?.split('|').pop()?.split('\\').pop() || '-',
      formatTime(j.start_time),
      j.end_time ? formatTime(j.end_time) : 'Ativo',
      (j.duration_minutes || 0).toFixed(2),
      j.material_name || '-',
      ((j.duration_minutes / 60 * 50) + (j.material_price || 0)).toFixed(2),
      formatDate(j.start_time)
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_mach3_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      const data = await api.deleteJob(id);
      if (data && data.success) {
        onRefresh();
        setConfirmDeleteId(null);
      } else {
        alert('Erro ao excluir: ' + (data?.error || 'Desconhecido'));
      }
    } catch (err) {
      alert('Erro de conexão ao excluir job');
    }
    setDeletingId(null);
  };

  const handleUpdateMaterial = async (jobId, mat) => {
    try {
      const payload = mat ? {
        material_id: mat.id,
        material_name: mat.name,
        material_price: mat.price
      } : {
        material_id: null,
        material_name: null,
        material_price: 0
      };
      const data = await api.updateJobMaterial(jobId, payload);
      if (data && data.success) {
        setActiveDropdown(null);
        onRefresh();
      } else {
        alert('Erro ao vincular: ' + (data?.error || 'Desconhecido'));
      }
    } catch (err) {
      alert('Erro de conexão ao atualizar material');
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass p-4 rounded-2xl">
        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <div className="flex items-center gap-2 bg-white/5 border border-border px-4 py-2 rounded-xl focus-within:border-accent-cyan/50 flex-1">
            <Search size={18} className="text-text-muted" />
            <input 
              type="text" 
              placeholder="Filtrar por nome ou projeto..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full"
            />
          </div>
          <button className="p-2.5 bg-white/5 border border-border rounded-xl text-text-muted hover:text-white transition-all">
            <Filter size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-6 py-2.5 bg-accent-cyan text-black font-black uppercase tracking-widest text-[11px] rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent-cyan/20"
          >
            <Download size={18} /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="glass rounded-[40px] overflow-hidden border border-border/40 backdrop-blur-xl">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-text-muted text-[10px] font-black uppercase tracking-[0.2em] border-b border-border">
                <th className="px-8 py-5">Arquivo</th>
                <th className="px-8 py-5">Projeto</th>
                <th className="px-8 py-5">Início</th>
                <th className="px-8 py-5">Fim</th>
                <th className="px-8 py-5">Duração</th>
                <th className="px-8 py-5 text-center">Insumo</th>
                <th className="px-8 py-5">Custo</th>
                <th className="px-8 py-5">Data</th>
                <th className="px-8 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="hover:bg-white/[0.03] transition-colors group">
                  <td className="px-8 py-5 max-w-[200px]">
                    <div className="font-bold text-white text-sm truncate">{job.file_name}</div>
                    <div className="text-[10px] text-text-muted opacity-50 font-black tracking-widest">#{job.id}</div>
                  </td>
                  <td className="px-8 py-5 min-w-[150px]">
                     <span className="text-[10px] font-black uppercase tracking-widest text-accent-cyan bg-accent-cyan/10 px-2.5 py-1 rounded-lg border border-accent-cyan/20">
                       {job.folder?.split('|').pop()?.split('\\').pop() || '-'}
                     </span>
                  </td>
                  <td className="px-8 py-5 text-xs font-bold text-white/80">{formatTime(job.start_time)}</td>
                  <td className="px-8 py-5 text-xs font-bold">
                    {job.end_time ? <span className="text-white/80">{formatTime(job.end_time)}</span> : <span className="text-accent-warning animate-pulse flex items-center gap-2"><div className="w-1.5 h-1.5 bg-accent-warning rounded-full"></div> ATIVO</span>}
                  </td>
                  <td className="px-8 py-5">
                    <div className="text-xs font-mono font-black text-white bg-white/5 py-1 px-3 rounded-lg w-fit border border-white/5 shadow-inner">
                      {Math.floor(job.duration_minutes || 0)} MIN
                    </div>
                  </td>
                  <td className="px-8 py-5 text-center relative overflow-visible">
                    <button 
                      onClick={() => setActiveDropdown(activeDropdown === job.id ? null : job.id)}
                      className="text-[10px] font-black uppercase tracking-widest py-1.5 px-3 rounded-xl border border-border bg-white/5 hover:border-accent-cyan transition-all text-text-muted hover:text-white flex items-center gap-2 mx-auto shadow-sm"
                    >
                      {job.material_name || 'Vincular'} <ChevronDown size={12} className={activeDropdown === job.id ? "rotate-180 transition-transform" : "transition-transform"} />
                    </button>
                    
                    <AnimatePresence>
                      {activeDropdown === job.id && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                          className="absolute left-1/2 -translate-x-1/2 mt-2 w-48 glass border border-border rounded-2xl shadow-2xl z-[100] p-1.5"
                        >
                          <button 
                            onClick={() => handleUpdateMaterial(job.id, null)}
                            className="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-white/5 hover:text-white rounded-lg transition-all"
                          >
                            × Sem Material
                          </button>
                          {materials.map(m => (
                            <button 
                              key={m.id}
                              onClick={() => handleUpdateMaterial(job.id, m)}
                              className="w-full text-left px-4 py-2 text-xs font-bold text-white hover:bg-accent-cyan hover:text-black rounded-lg transition-all flex justify-between group"
                            >
                              <span>{m.name}</span>
                              <span className="opacity-0 group-hover:opacity-100 text-[10px] font-black">R$ {m.price}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </td>
                  <td className="px-8 py-5 font-black text-white text-sm tracking-tighter">
                    {formatCurrency((job.duration_minutes / 60 * 50) + (job.material_price || 0))}
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 text-[10px] text-text-muted font-black tracking-widest uppercase">
                      <Calendar size={12} className="opacity-50 text-accent-cyan" /> {formatDate(job.start_time)}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                       {confirmDeleteId === job.id ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2">
                          <button 
                            onClick={() => handleDelete(job.id)}
                            disabled={deletingId === job.id}
                            className="p-2 bg-accent-danger text-white rounded-xl hover:bg-accent-danger/80 transition-all shadow-lg shadow-accent-danger/20"
                            title="Confirmar exclusão"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(null)}
                            className="p-2 bg-white/5 text-text-muted rounded-xl hover:text-white transition-all underline text-[10px] font-bold"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => setConfirmDeleteId(job.id)}
                          className="p-2.5 bg-white/5 border border-border text-text-muted hover:text-white hover:bg-accent-danger/20 hover:border-accent-danger/40 transition-all rounded-xl shadow-lg opacity-40 group-hover:opacity-100"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredJobs.length === 0 && (
            <div className="py-24 text-center space-y-6">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Layers size={40} className="text-text-muted opacity-20" />
              </div>
              <div className="text-text-muted font-bold text-lg">Nenhum registro encontrado</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
