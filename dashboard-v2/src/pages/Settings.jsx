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
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null); // tracks which plan is loading
  const [status, setStatus] = useState(null);

  const handleSubscribe = async (plan) => {
    setCheckoutLoading(plan);
    try {
      const resp = await api.createPreference(plan);
      if (resp.init_point) {
        // Small delay to show feedback before redirect
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
