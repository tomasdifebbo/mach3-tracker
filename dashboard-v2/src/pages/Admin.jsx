import React, { useEffect, useState } from 'react';
import { ShieldCheck, UserCog, CalendarPlus, BadgeAlert, Crown } from 'lucide-react';
import { api } from '../services/api';

export function Admin({ user }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/admin/users');
      setUsers(data);
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

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center p-8 bg-panel-bg/40 backdrop-blur-md rounded-[40px] border border-border/40 max-w-sm">
          <BadgeAlert size={48} className="mx-auto text-red-500 mb-4" />
          <h2 className="text-xl font-bold tracking-tight">Acesso Negado</h2>
          <p className="text-sm text-text-muted mt-2">Você não ter permissões de Master.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      <div className="flex items-center gap-4 mb-10">
        <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl">
          <Crown size={24} />
        </div>
        <div>
          <h3 className="text-2xl font-bold tracking-tight">Painel Master</h3>
          <p className="text-sm text-text-muted font-medium">Gerencie usuários, planos e liberações</p>
        </div>
      </div>

      <div className="glass p-10 rounded-[40px] border-border/40">
        {loading ? (
          <div className="flex justify-center p-8"><ShieldCheck className="animate-spin text-purple-500" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="px-6 py-4 text-left text-xs font-black tracking-widest text-text-muted uppercase">ID</th>
                  <th className="px-6 py-4 text-left text-xs font-black tracking-widest text-text-muted uppercase">E-mail</th>
                  <th className="px-6 py-4 text-left text-xs font-black tracking-widest text-text-muted uppercase">Plano</th>
                  <th className="px-6 py-4 text-left text-xs font-black tracking-widest text-text-muted uppercase">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border/10 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-sm">{u.id}</td>
                    <td className="px-6 py-4 font-bold">
                      {u.email}
                      {u.role === 'admin' && <span className="ml-2 text-[10px] bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full uppercase tracking-tighter">Master</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[11px] bg-accent/20 text-accent px-3 py-1 rounded-full uppercase font-bold tracking-widest">
                        {u.plan}
                      </span>
                      <div className="text-xs text-text-muted mt-2"> Expira: {new Date(u.trial_expiry).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 flex gap-2">
                       <select 
                          className="bg-panel-bg border border-border/50 text-xs rounded-lg px-2 py-1 text-white hover:border-accent transition-colors outline-none cursor-pointer"
                          onChange={(e) => { if(e.target.value) changePlan(u.id, e.target.value); e.target.value=""; }}
                          defaultValue=""
                       >
                         <option value="" disabled>Mudar Plano</option>
                         <option value="starter">Starter</option>
                         <option value="pro">Pro</option>
                         <option value="business">Business</option>
                       </select>
                       <button onClick={() => extendTrial(u.id, 30)} className="bg-accent-success/20 text-accent-success px-3 py-1 rounded-lg text-xs font-bold hover:bg-accent-success/40 transition-colors flex items-center gap-1">
                         <CalendarPlus size={14} /> +30 Dias
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
