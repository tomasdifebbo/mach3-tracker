import React, { useState } from 'react';
import { 
  Zap, 
  Settings as SettingsIcon, 
  ShieldCheck, 
  Clock, 
  Save, 
  Info,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { api } from '../services/api';

import { SubscriptionPlans } from '../components/SubscriptionPlans';

export function Settings({ user, onRefresh, isTrialExpired }) {
  const [costPerHour, setCostPerHour] = useState(user?.settings?.costPerHour || 50.0);
  const [plannedHours, setPlannedHours] = useState(user?.settings?.plannedHours || 8);
  const [webhookUrl, setWebhookUrl] = useState(user?.settings?.webhookUrl || '');
  const [companyRole, setCompanyRole] = useState(localStorage.getItem('mach3_device_role') || user?.company_role || 'gerente');
  const [savingRole, setSavingRole] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null); // tracks which plan is loading
  const [status, setStatus] = useState(null);

  const [gerentePin, setGerentePin] = useState('');
  const [supervisorPin, setSupervisorPin] = useState('');
  const [savingPins, setSavingPins] = useState(false);

  const handleRoleChange = async (newRole) => {
    let pin = '';
    if (newRole === 'gerente' && user?.has_gerente_pin) {
      pin = prompt('Digite a Senha do Perfil Gerente:');
      if (pin === null) return;
    } else if (newRole === 'encarregado' && user?.has_supervisor_pin) {
      pin = prompt('Digite a Senha do Perfil Supervisor:');
      if (pin === null) return;
    }

    setSavingRole(true);
    try {
      const verifyResp = await api.verifyPin(newRole, pin);
      if (verifyResp && verifyResp.error) {
        alert(verifyResp.error);
        return;
      }
      localStorage.setItem('mach3_device_role', newRole);
      setCompanyRole(newRole);
      window.location.href = '/';
    } catch (err) {
      alert('Erro ao alterar nível de acesso.');
    } finally {
      setSavingRole(false);
    }
  };

  const handleSavePins = async (e) => {
    e.preventDefault();
    setSavingPins(true);
    try {
      await api.patch('/user/profile-pins', {
        gerente_pin: gerentePin,
        supervisor_pin: supervisorPin
      });
      if (onRefresh) await onRefresh();
      alert('Senhas de proteção dos perfis atualizadas com sucesso!');
      setGerentePin('');
      setSupervisorPin('');
    } catch (err) {
      alert('Erro ao salvar senhas.');
    } finally {
      setSavingPins(false);
    }
  };

  const handleSubscribe = async (plan) => {
    setCheckoutLoading(plan);
    try {
      const resp = await api.createPreference(plan);
      if (resp.init_point) {
        setTimeout(() => { window.location.href = resp.init_point; }, 300);
      } else {
        throw new Error(resp.error || 'Link de pagamento não retornado');
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Erro ao abrir checkout: ' + (err.message || 'tente novamente') });
      setTimeout(() => setStatus(null), 5000);
      setCheckoutLoading(null);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const resp = await api.updateUserSettings({ 
        costPerHour: parseFloat(costPerHour), 
        plannedHours: parseFloat(plannedHours),
        webhookUrl
      });
      
      if (resp && resp.success) {
        setStatus({ type: 'success', message: 'Configurações salvas na nuvem!' });
        onRefresh();
      } else {
        throw new Error(resp?.error || 'Erro ao salvar');
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Erro de conexão com o servidor.' });
    }
    setLoading(false);
    setTimeout(() => setStatus(null), 3000);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-12 animate-in fade-in duration-500">
      {isTrialExpired && (
        <div className="mb-8 p-6 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-4 shadow-xl shadow-red-500/5">
          <div className="p-3 bg-red-500/20 text-red-400 rounded-xl">
            <AlertCircle size={28} />
          </div>
          <div>
            <h3 className="text-xl font-black text-red-400 uppercase tracking-widest mb-2">Período de Teste Expirado</h3>
            <p className="text-sm font-medium text-red-200/80 leading-relaxed">
              O seu período de degustação de 30 dias chegou ao fim e o acesso às métricas e históricos foi bloqueado. 
              Para restaurar o acesso imediato ao sistema, por favor assine um dos nossos planos abaixo.
            </p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tighter text-white">Configurações e Assinatura</h2>
        <p className="text-sm font-medium text-text-muted mt-2">Gerencie seus custos de hora máquina e escolha seu plano</p>
      </div>

      {/* Plans Section */}
      <section className="space-y-8">
        <SubscriptionPlans user={user} />
      </section>

      {/* Nível de Acesso da Empresa */}
      <section className="glass p-6 md:p-10 rounded-[32px] md:rounded-[40px] space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Nível de Acesso da Empresa</h3>
            <p className="text-xs text-text-muted">Alterne o perfil da conta para limitar ou liberar funcionalidades conforme a função do usuário.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { id: 'gerente', title: 'Gerente da Fábrica', icon: '👑', desc: 'Acesso total a todas as áreas, relatórios e configurações financeiras' },
            { id: 'encarregado', title: 'Encarregado de Produção', icon: '👷', desc: 'Acesso a Dashboard, Kanban de O.S., Manutenção, Estoque e Gráficos' },
            { id: 'operador', title: 'Operador de Maquinário', icon: '🧑‍🔧', desc: 'Terminal do Operador focado no chão de fábrica, O.S. e checklists' },
          ].map(r => {
            const isSelected = companyRole === r.id;
            return (
              <div
                key={r.id}
                onClick={() => handleRoleChange(r.id)}
                className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between select-none group hover:scale-[1.02] ${
                  isSelected 
                    ? 'bg-purple-500/15 border-purple-500 text-white shadow-xl shadow-purple-500/10 ring-2 ring-purple-500/30' 
                    : 'bg-white/5 border-white/5 text-text-muted hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl">{r.icon}</span>
                    {isSelected ? (
                      <span className="text-[9px] font-black uppercase tracking-wider bg-purple-500 text-black px-2.5 py-1 rounded-full">ATIVO</span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase text-text-muted opacity-60">Clique p/ Selecionar</span>
                    )}
                  </div>
                  <h4 className="font-extrabold text-white text-base mb-1.5 group-hover:text-purple-300 transition-colors">{r.title}</h4>
                  <p className="text-xs text-text-muted leading-relaxed">{r.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Form para Definir Senhas dos Perfis */}
        <form onSubmit={handleSavePins} className="pt-6 border-t border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-purple-400" />
            <h4 className="text-sm font-bold text-white">Proteção por Senha dos Perfis</h4>
          </div>
          <p className="text-xs text-text-muted">Defina uma senha para restringir a mudança para os perfis de Gerente ou Supervisor, evitando que operadores alterem configurações.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1.5">
                Senha do Perfil Gerente (👑) {user?.has_gerente_pin && <span className="text-accent-success">(Protegido por Senha)</span>}
              </label>
              <input
                type="password"
                placeholder={user?.has_gerente_pin ? '•••• (Digite para alterar)' : 'Criar senha do Gerente (opcional)'}
                value={gerentePin}
                onChange={(e) => setGerentePin(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1.5">
                Senha do Perfil Supervisor (👷) {user?.has_supervisor_pin && <span className="text-accent-success">(Protegido por Senha)</span>}
              </label>
              <input
                type="password"
                placeholder={user?.has_supervisor_pin ? '•••• (Digite para alterar)' : 'Criar senha do Supervisor (opcional)'}
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingPins || (!gerentePin && !supervisorPin)}
              className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-black font-black uppercase text-xs rounded-xl transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
            >
              {savingPins ? 'Salvação...' : 'Salvar Senhas dos Perfis'}
            </button>
          </div>
        </form>
      </section>

      <hr className="border-border/50" />

      {/* Machine / Cost Settings */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="glass p-10 rounded-[40px] space-y-8 h-fit">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 text-white rounded-2xl">
              <SettingsIcon size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Configurações de Produção</h3>
              <p className="text-xs text-text-muted">Ajuste os valores base para cálculo de custos e metas.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Valor da Hora Máquina (R$)</label>
              <div className="relative group">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold group-focus-within:text-accent-cyan">R$</span>
                 <input 
                    type="number" 
                    value={costPerHour}
                    onChange={(e) => setCostPerHour(e.target.value)}
                    className="w-full bg-white/5 border border-border px-12 py-3.5 rounded-2xl outline-none focus:border-accent-cyan/50 focus:bg-white/[0.08] transition-all text-white font-bold" 
                  />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Horas Planejadas por Dia (Meta OEE)</label>
              <div className="relative group">
                 <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-cyan" />
                 <input 
                    type="number" 
                    value={plannedHours}
                    onChange={(e) => setPlannedHours(e.target.value)}
                    className="w-full bg-white/5 border border-border px-12 py-3.5 rounded-2xl outline-none focus:border-accent-cyan/50 focus:bg-white/[0.08] transition-all text-white font-bold" 
                  />
              </div>
            </div>

            <button 
              onClick={handleSaveSettings}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-4 bg-accent-cyan text-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all font-black uppercase tracking-widest text-xs shadow-lg shadow-accent-cyan/20 disabled:opacity-50"
            >
               <Save size={18} /> {loading ? 'Salvando...' : 'Salvar Parâmetros'}
            </button>

            {status && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold border animate-in fade-in duration-300 ${status.type === 'success' ? 'bg-accent-success/10 border-accent-success/30 text-accent-success' : 'bg-accent-danger/10 border-accent-danger/30 text-accent-danger'}`}>
                {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {status.message}
              </div>
            )}
          </div>
        </div>

        <div className="glass p-10 rounded-[40px] space-y-6 h-fit bg-gradient-to-bl from-white/5 to-transparent">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/10 text-white rounded-2xl">
               <ShieldCheck size={24} />
            </div>
            <h3 className="text-xl font-bold">Segurança e Dados</h3>
          </div>
          
          <div className="space-y-4">
             <div className="flex flex-col gap-2 p-4 bg-white/5 rounded-2xl border border-border/50">
                <div className="space-y-0.5 mb-2">
                   <div className="text-sm font-bold text-white">Endpoint de Webhook</div>
                   <div className="text-[10px] font-medium text-text-muted">URL para receber POST quando um job terminar</div>
                </div>
                <div className="relative group">
                   <input 
                     type="url"
                     value={webhookUrl}
                     onChange={(e) => setWebhookUrl(e.target.value)}
                     placeholder="https://seu-erp.com.br/api/mach3-webhook"
                     className="w-full bg-white/5 border border-border px-4 py-3 rounded-xl outline-none focus:border-accent-cyan/50 focus:bg-white/[0.08] transition-all text-white text-sm font-medium"
                   />
                </div>
                <button 
                  onClick={handleSaveSettings}
                  disabled={loading}
                  className="mt-2 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                >
                  Salvar Webhook
                </button>
             </div>
             
             <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-2xl p-6 flex gap-4">
               <Info size={24} className="text-accent-blue shrink-0" />
               <p className="text-xs text-accent-blue leading-relaxed font-semibold">
                 Seus dados estão protegidos por criptografia AES-256 e backups diários automáticos. Os logs do Mach3 são transmitidos de forma segura via porta 3000.
               </p>
             </div>
          </div>
        </div>
      </section>
    </div>
  );
}
