import React, { useState } from 'react';
import { 
  ClipboardList, Plus, Calendar, Clock, Wrench, CheckCircle2, AlertTriangle, Trash2, Edit3, X, Save
} from 'lucide-react';
import { api } from '../services/api';

export function Maintenance({ maintenance = [], routers = [], onRefresh, user }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    router_id: '',
    scheduled_date: '',
    scheduled_time: '',
    type: 'preventive',
    description: '',
    technician: ''
  });
  
  const [completeModal, setCompleteModal] = useState(null); // ID of maintenance being completed
  const [partsReplaced, setPartsReplaced] = useState('');

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const getUrgency = (m) => {
    if (m.status !== 'pending') return 'none';
    
    // Parse date without timezone shift
    const [year, month, day] = m.scheduled_date.split('T')[0].split('-');
    const mDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    if (m.scheduled_time) {
      const [h, min] = m.scheduled_time.split(':');
      mDate.setHours(parseInt(h), parseInt(min), 0, 0);
    } else {
      mDate.setHours(23, 59, 59, 999);
    }
    
    if (mDate < now) return 'overdue';
    if (mDate <= tomorrow) return 'urgent';
    return 'upcoming';
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const r = routers.find(r => r.id.toString() === form.router_id);
      await api.createMaintenance({ ...form, router_name: r?.name });
      setShowForm(false);
      setForm({ router_id: '', scheduled_date: '', scheduled_time: '', type: 'preventive', description: '', technician: '' });
      onRefresh();
    } catch (err) {
      alert('Erro ao agendar manutenção: ' + err.message);
    }
  };

  const handleComplete = async (id) => {
    try {
      await api.updateMaintenance(id, { 
        status: 'done', 
        parts_replaced: partsReplaced,
        completed_at: new Date().toISOString()
      });
      setCompleteModal(null);
      setPartsReplaced('');
      onRefresh();
    } catch (err) {
      alert('Erro ao concluir manutenção');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Excluir este registro?')) return;
    try {
      await api.deleteMaintenance(id);
      onRefresh();
    } catch (err) {
      alert('Erro ao excluir');
    }
  };

  const formatDt = (isoDate, timeStr) => {
    if (!isoDate) return '-';
    let d = new Date(isoDate);
    d = new Date(d.getTime() + d.getTimezoneOffset() * 60000); // Adjust timezone
    const day = String(d.getDate()).padStart(2, '0');
    const month = d.toLocaleString('pt-BR', { month: 'short' }).replace('.', '');
    const dateStr = `${day} de ${month}`;
    if (timeStr) {
      const [h, m] = timeStr.split(':');
      return `${dateStr} às ${h}:${m}`;
    }
    return dateStr;
  };

  const pending = maintenance.filter(m => m.status === 'pending');
  const history = maintenance.filter(m => m.status !== 'pending');

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* ALERTS SECTION */}
      {pending.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {pending.map(m => {
            const urgency = getUrgency(m);
            const isOverdue = urgency === 'overdue';
            const isUrgent = urgency === 'urgent';
            
            return (
              <div key={`alert-${m.id}`} className={`p-4 rounded-2xl border ${isOverdue ? 'bg-red-500/10 border-red-500/30' : isUrgent ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-white/5 border-white/10'} flex flex-col gap-2 relative overflow-hidden`}>
                <div className="flex items-center gap-2">
                  {isOverdue && <AlertTriangle className="text-red-500" size={20} />}
                  {isUrgent && <Clock className="text-yellow-500" size={20} />}
                  {!isOverdue && !isUrgent && <Calendar className="text-blue-400" size={20} />}
                  <h3 className={`font-bold ${isOverdue ? 'text-red-400' : isUrgent ? 'text-yellow-400' : 'text-blue-400'}`}>
                    {isOverdue ? 'Atrasada' : isUrgent ? 'Próxima (24h)' : 'Agendada'}
                  </h3>
                </div>
                <p className="text-white font-medium text-lg">{m.router_name}</p>
                <div className="text-sm text-text-muted flex justify-between items-end">
                  <span>{formatDt(m.scheduled_date, m.scheduled_time)}</span>
                  <span className="text-xs uppercase bg-black/20 px-2 py-1 rounded">{m.type === 'preventive' ? 'Preventiva' : 'Corretiva'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* HEADER & NEW BUTTON */}
      <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
        <div className="flex items-center gap-3">
          <ClipboardList className="text-accent-cyan" />
          <h2 className="text-xl font-bold text-white">Cronograma de Manutenção</h2>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-cyan text-black font-bold rounded-xl hover:bg-cyan-400 transition-all"
        >
          {showForm ? <X size={18} /> : <Plus size={18} />}
          {showForm ? 'Cancelar' : 'Agendar'}
        </button>
      </div>

      {/* NEW MAINTENANCE FORM */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-bg-sidebar border border-white/10 p-6 rounded-2xl space-y-4 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-text-muted font-bold uppercase">Router</label>
              <select 
                required
                value={form.router_id} 
                onChange={e => setForm({...form, router_id: e.target.value})}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-accent-cyan"
              >
                <option value="">Selecione...</option>
                {routers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-xs text-text-muted font-bold uppercase">Tipo</label>
              <select 
                value={form.type} 
                onChange={e => setForm({...form, type: e.target.value})}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-accent-cyan"
              >
                <option value="preventive">Preventiva</option>
                <option value="corrective">Corretiva</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-text-muted font-bold uppercase">Data Agendada</label>
              <input 
                type="date" required
                value={form.scheduled_date} 
                onChange={e => setForm({...form, scheduled_date: e.target.value})}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-accent-cyan [color-scheme:dark]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-text-muted font-bold uppercase">Hora Prevista (Opcional)</label>
              <input 
                type="time" 
                value={form.scheduled_time} 
                onChange={e => setForm({...form, scheduled_time: e.target.value})}
                className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-accent-cyan [color-scheme:dark]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-muted font-bold uppercase">Descrição (O que será feito)</label>
            <input 
              type="text" required placeholder="Ex: Limpeza e lubrificação dos eixos X e Y"
              value={form.description} 
              onChange={e => setForm({...form, description: e.target.value})}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-accent-cyan"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-text-muted font-bold uppercase">Técnico (Opcional)</label>
            <input 
              type="text" placeholder="Nome do técnico responsável"
              value={form.technician} 
              onChange={e => setForm({...form, technician: e.target.value})}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-white outline-none focus:border-accent-cyan"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-accent-cyan text-black font-bold rounded-xl hover:bg-cyan-400 transition-all">
              <Save size={18} /> Salvar Agendamento
            </button>
          </div>
        </form>
      )}

      {/* LIST SECTION */}
      <div className="bg-bg-sidebar border border-white/10 rounded-3xl overflow-hidden mt-6">
        <div className="p-5 border-b border-white/5 flex gap-4">
          <h3 className="font-bold text-lg text-white">Histórico Geral</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-text-muted text-[10px] uppercase font-bold tracking-widest border-b border-white/5">
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Router</th>
                <th className="px-6 py-4">Serviço</th>
                <th className="px-6 py-4">Técnico</th>
                <th className="px-6 py-4">Status / Peças</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {maintenance.map(m => (
                <tr key={m.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-white">{formatDt(m.scheduled_date, m.scheduled_time)}</div>
                    {m.completed_at && <div className="text-[10px] text-green-400">Feito: {new Date(m.completed_at).toLocaleDateString('pt-BR')}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-white/10 px-2 py-1 rounded text-xs font-medium text-white/80">{m.router_name}</span>
                  </td>
                  <td className="px-6 py-4 max-w-[200px]">
                    <div className="font-medium text-white truncate" title={m.description}>{m.description}</div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider">{m.type === 'preventive' ? 'Preventiva' : 'Corretiva'}</div>
                  </td>
                  <td className="px-6 py-4 text-text-muted">{m.technician || '-'}</td>
                  <td className="px-6 py-4 max-w-[250px]">
                    {m.status === 'pending' ? (
                      <span className="text-yellow-500 font-bold text-xs uppercase bg-yellow-500/10 px-2 py-1 rounded">Pendente</span>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="text-green-500 font-bold text-xs uppercase bg-green-500/10 px-2 py-1 rounded w-fit">Concluído</span>
                        {m.parts_replaced && <div className="text-[11px] text-text-muted italic truncate" title={m.parts_replaced}>"Trocado: {m.parts_replaced}"</div>}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {m.status === 'pending' && (
                        <button 
                          onClick={() => setCompleteModal(m.id)}
                          className="p-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500 hover:text-white transition-all"
                          title="Marcar como Concluído"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => handleDelete(m.id)}
                        className="p-2 bg-white/5 text-text-muted rounded-lg hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {maintenance.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-text-muted">Nenhuma manutenção agendada</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* COMPLETE MODAL */}
      {completeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-bg-sidebar border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">Concluir Manutenção</h3>
            <p className="text-sm text-text-muted mb-4">
              Deseja registrar alguma peça que foi trocada ou adicionar observações sobre o serviço executado?
            </p>
            <textarea
              placeholder="Ex: Trocado rolamento linear eixo Y"
              value={partsReplaced}
              onChange={(e) => setPartsReplaced(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-green-500 min-h-[100px] mb-6"
            />
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => { setCompleteModal(null); setPartsReplaced(''); }}
                className="px-4 py-2 bg-white/5 text-white font-medium rounded-xl hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleComplete(completeModal)}
                className="px-4 py-2 bg-green-500 text-white font-bold rounded-xl hover:bg-green-400 transition-all flex items-center gap-2"
              >
                <CheckCircle2 size={18} /> Finalizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
