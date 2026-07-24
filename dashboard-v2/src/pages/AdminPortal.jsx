import React, { useEffect, useState } from 'react';
import { 
  ShieldCheck, CalendarPlus, Crown, LogOut, CheckSquare, 
  Settings2, Check, X, RefreshCw, Layers, LayoutGrid, Sparkles
} from 'lucide-react';
import { api } from '../services/api';

const ALL_FEATURES = [
  { id: 'dashboard', label: 'Dashboard Principal', category: 'Visão Geral', desc: 'Acesso à visão geral de máquinas e métricas do dia' },
  { id: 'operador', label: 'Painel do Operador', category: 'Operação', desc: 'Terminal de operação, fila de O.S. e apontamento de falhas' },
  { id: 'jobs', label: 'Histórico de Produção', category: 'Produção', desc: 'Registro de cortes e edição inline de nomes de projetos' },
  { id: 'charts', label: 'Gráficos Avançados', category: 'Análise', desc: 'Gráfico de carga horária por máquina e eficiência mensal' },
  { id: 'materials', label: 'Cadastro de Materiais', category: 'Estoque', desc: 'Cadastro de chaparia, insumos e custos por m²' },
  { id: 'maintenance', label: 'Manutenção Preventiva', category: 'Operação', desc: 'Agenda, alertas visuais e histórico preventivo' },
  { id: 'encarregado', label: 'Painel do Encarregado', category: 'Operação', desc: 'Kanban de O.S., checklists diários e rotina semanal' },
  { id: 'm2_calculation', label: 'Cálculo por m² Utilizado', category: 'Análise', desc: 'Cálculo automático de área utilizada na tabela de histórico' },
  { id: 'export_pdf_csv', label: 'Relatórios PDF & CSV', category: 'Relatórios', desc: 'Exportação de relatórios executivos em PDF e planilhas CSV' },
  { id: 'notifications', label: 'Notificações em Tempo Real', category: 'Sistema', desc: 'Alertas visuais no sino para eventos de produção' },
];

export function AdminPortal() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null); // User for Feature Checklist modal
  const [editingFeatures, setEditingFeatures] = useState({});
  const [savingFeatures, setSavingFeatures] = useState(false);

  const fetchUsers = async () => {
    try {
      const data = await api.get('/admin/users');
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const changePlan = async (id, newPlan) => {
    if (!confirm(`Tem certeza que deseja mudar para o plano: ${newPlan.toUpperCase()}?`)) return;
    try {
      await api.patch(`/admin/users/${id}/plan`, { plan: newPlan });
      fetchUsers();
    } catch (e) {
      alert('Erro ao mudar plano');
    }
  };

  const extendTrial = async (id, days) => {
    if (!confirm(`Adicionar ${days} dias ao trial deste usuário?`)) return;
    try {
      await api.patch(`/admin/users/${id}/plan`, { addDays: days });
      fetchUsers();
    } catch (e) {
      alert('Erro ao extender trial');
    }
  };

  const openFeatureModal = (u) => {
    setSelectedUser(u);
    setEditingFeatures({ ...u.features });
  };

  const handleToggleFeature = (featId) => {
    setEditingFeatures(prev => ({
      ...prev,
      [featId]: !prev[featId]
    }));
  };

  const handleSaveFeatures = async () => {
    if (!selectedUser) return;
    setSavingFeatures(true);
    try {
      await api.patch(`/admin/users/${selectedUser.id}/features`, { features: editingFeatures });
      await fetchUsers();
      setSelectedUser(null);
    } catch (e) {
      alert('Erro ao salvar permissões do cliente.');
    } finally {
      setSavingFeatures(false);
    }
  };

  const handleEnableAll = () => {
    const allOn = {};
    ALL_FEATURES.forEach(f => { allOn[f.id] = true; });
    setEditingFeatures(allOn);
  };

  const handleDisableAll = () => {
    const allOff = {};
    ALL_FEATURES.forEach(f => { allOff[f.id] = false; });
    // Keep dashboard and jobs enabled
    allOff.dashboard = true;
    allOff.jobs = true;
    setEditingFeatures(allOff);
  };

  const handleLogout = () => {
    localStorage.removeItem('mach3_token');
    window.location.href = '/admin';
  };

  return (
    <div className="min-h-screen bg-zinc-950 font-inter text-white flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-md px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-fuchsia-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
            <ShieldCheck size={20} className="text-white" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tight uppercase italic">Portal Master</h1>
            <p className="text-[10px] text-purple-400 font-bold tracking-widest uppercase">Central de Controle SaaS</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all text-sm font-bold text-text-muted"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-700 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl">
              <Crown size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold tracking-tight">Gerenciamento de Clientes & Checklist de Funções</h3>
              <p className="text-sm text-text-muted font-medium">Libere ou bloqueie funcionalidades específicas por cliente final</p>
            </div>
          </div>
        </div>

        <div className="glass p-1 rounded-[32px] border border-white/10 shadow-2xl shadow-black/50 bg-black/40 backdrop-blur-xl">
          {loading ? (
            <div className="flex justify-center p-20"><ShieldCheck className="animate-spin text-purple-500" size={40} /></div>
          ) : (
            <div className="overflow-x-auto rounded-[28px] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-white/5">
                  <tr>
                    <th className="px-6 py-5 text-xs font-black tracking-widest text-text-muted uppercase">ID</th>
                    <th className="px-6 py-5 text-xs font-black tracking-widest text-text-muted uppercase">E-mail do Cliente</th>
                    <th className="px-6 py-5 text-xs font-black tracking-widest text-text-muted uppercase">Plano</th>
                    <th className="px-6 py-5 text-xs font-black tracking-widest text-text-muted uppercase">Checklist de Funções</th>
                    <th className="px-6 py-5 text-xs font-black tracking-widest text-text-muted uppercase text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map(u => {
                    const activeCount = Object.values(u.features || {}).filter(Boolean).length;
                    const totalCount = ALL_FEATURES.length;
                    return (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4 text-sm text-text-muted font-medium">#{u.id}</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-white flex items-center gap-2">
                            {u.email}
                            {u.role === 'admin' && <span className="text-[9px] bg-purple-500/20 border border-purple-500/30 text-purple-400 px-2 py-0.5 rounded-full uppercase tracking-widest font-black">Master Admin</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-1">
                            <span className="text-[10px] bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan px-3 py-1 rounded-full uppercase font-black tracking-widest">
                              {u.plan}
                            </span>
                            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                              Exp: <span className="text-white">{u.trial_expiry ? new Date(u.trial_expiry).toLocaleDateString() : '-'}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => openFeatureModal(u)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-300 rounded-xl text-xs font-bold transition-all cursor-pointer group-hover:scale-105"
                          >
                            <Settings2 size={14} className="text-purple-400" />
                            <span>Checklist ({activeCount}/{totalCount})</span>
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <select 
                              className="bg-black/50 border border-white/10 text-[11px] font-bold uppercase tracking-wider rounded-xl px-3 py-2 text-white hover:border-purple-500/50 focus:border-purple-500 transition-all outline-none cursor-pointer appearance-none"
                              onChange={(e) => { if(e.target.value) changePlan(u.id, e.target.value); e.target.value=""; }}
                              defaultValue=""
                            >
                              <option value="" disabled>MUDAR PLANO</option>
                              <option value="starter">Starter</option>
                              <option value="pro">Pro</option>
                              <option value="business">Business</option>
                            </select>
                            <button 
                              onClick={() => extendTrial(u.id, 30)} 
                              className="bg-accent-success/10 border border-accent-success/20 text-accent-success px-3 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-accent-success hover:text-black transition-all flex items-center gap-1.5"
                              title="Adicionar 30 dias de trial"
                            >
                              <CalendarPlus size={14} /> +30 Days
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Feature Checklist Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setSelectedUser(null)} />
          
          <div className="relative z-10 w-full max-w-2xl bg-zinc-950 border border-purple-500/30 p-6 md:p-8 rounded-3xl shadow-2xl flex flex-col gap-6 text-white max-h-[90vh] overflow-y-auto custom-scrollbar">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl">
                  <CheckSquare size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Checklist de Funções do Cliente</h3>
                  <p className="text-xs text-text-muted font-medium">{selectedUser.email} (Plano {selectedUser.plan?.toUpperCase()})</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)}
                className="text-text-muted hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Action Bar */}
            <div className="flex items-center justify-between gap-3 bg-white/5 p-3 rounded-2xl border border-white/5">
              <span className="text-xs font-bold text-text-muted">Ações rápidas:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEnableAll}
                  className="px-3 py-1.5 bg-accent-success/20 border border-accent-success/30 text-accent-success hover:bg-accent-success hover:text-black text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  Liberar Todas
                </button>
                <button
                  type="button"
                  onClick={handleDisableAll}
                  className="px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all"
                >
                  Bloquear Opcionais
                </button>
              </div>
            </div>

            {/* Checklist Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ALL_FEATURES.map((feat) => {
                const isEnabled = !!editingFeatures[feat.id];
                return (
                  <div 
                    key={feat.id}
                    onClick={() => handleToggleFeature(feat.id)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-start justify-between gap-3 ${
                      isEnabled 
                        ? 'bg-purple-500/10 border-purple-500/40 text-white shadow-lg shadow-purple-500/5' 
                        : 'bg-white/[0.02] border-white/5 text-text-muted hover:border-white/10'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${isEnabled ? 'bg-purple-500/20 text-purple-300' : 'bg-white/5 text-text-muted'}`}>
                          {feat.category}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white truncate">{feat.label}</h4>
                      <p className="text-[11px] text-text-muted leading-tight opacity-75 line-clamp-2">{feat.desc}</p>
                    </div>

                    {/* Toggle Switch */}
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                      isEnabled ? 'bg-purple-500 text-white shadow-md' : 'bg-white/10 text-text-muted'
                    }`}>
                      {isEnabled ? <Check size={14} /> : <X size={14} />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-5 py-2.5 rounded-xl border border-white/10 text-xs font-bold uppercase tracking-wider text-text-muted hover:text-white hover:bg-white/5 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveFeatures}
                disabled={savingFeatures}
                className="px-6 py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2"
              >
                {savingFeatures ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                Salvar Checklist
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
