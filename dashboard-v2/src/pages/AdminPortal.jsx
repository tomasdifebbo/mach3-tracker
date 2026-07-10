import React, { useEffect, useState } from 'react';
import { ShieldCheck, CalendarPlus, BadgeAlert, Crown, LogOut } from 'lucide-react';
import { api } from '../services/api';

export function AdminPortal() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const data = await api.get('/admin/users');
      if (Array.isArray(data)) {
        setUsers(data);
      } else if (data && data.error) {
        console.error(data.error);
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

  const handleLogout = () => {
    localStorage.removeItem('mach3_token');
    window.location.href = '/admin';
  };

  return (
    <div className="min-h-screen bg-zinc-950 font-inter text-white flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-md px-8 py-4 flex items-center justify-between sticky top-0 z-50">
         <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-fuchsia-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
               <ShieldCheck size={20} className="text-white" />
            </div>
            <div>
               <h1 className="font-black text-lg tracking-tight uppercase italic">Portal Master</h1>
               <p className="text-[10px] text-purple-400 font-bold tracking-widest uppercase">Central de Controle</p>
            </div>
         </div>
         <button 
           onClick={handleLogout}
           className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-red-500/10 hover:text-red-400 rounded-xl transition-all text-sm font-bold text-text-muted"
         >
            <LogOut size={16} />
            Sair
         </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-700">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-2xl">
            <Crown size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-bold tracking-tight">Gerenciamento de Assinaturas</h3>
            <p className="text-sm text-text-muted font-medium">Controle de clientes, trials e permissões do SaaS</p>
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
                    <th className="px-6 py-5 text-xs font-black tracking-widest text-text-muted uppercase">Status do Plano</th>
                    <th className="px-6 py-5 text-xs font-black tracking-widest text-text-muted uppercase text-right">Ações Rápidas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 text-sm text-text-muted font-medium">#{u.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-white flex items-center gap-2">
                          {u.email}
                          {u.role === 'admin' && <span className="text-[9px] bg-purple-500/20 border border-purple-500/30 text-purple-400 px-2 py-0.5 rounded-full uppercase tracking-widest font-black">Admin</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-[10px] bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan px-3 py-1 rounded-full uppercase font-black tracking-widest">
                            {u.plan}
                          </span>
                          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                            Exp: <span className="text-white">{new Date(u.trial_expiry).toLocaleDateString()}</span>
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
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
                             className="bg-accent-success/10 border border-accent-success/20 text-accent-success px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-accent-success hover:text-black transition-all flex items-center gap-2"
                           >
                             <CalendarPlus size={14} /> +30 Dias
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
