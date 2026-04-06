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
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';

export function Settings({ user, onRefresh }) {
  const [costPerHour, setCostPerHour] = useState(user?.settings?.costPerHour || 50.0);
  const [plannedHours, setPlannedHours] = useState(user?.settings?.plannedHours || 8);
  const [status, setStatus] = useState(null);

  const handleSubscribe = async (plan) => {
    try {
      const resp = await api.createPreference(plan);
      if (resp.init_point) {
        window.location.href = resp.init_point;
      }
    } catch (err) {
      alert('Erro ao iniciar checkout');
    }
  };

  const handleSaveSettings = async () => {
    setStatus(null);
    try {
      // Logic for saving settings would go here. 
      // For now we simulate success and update local state
      const settings = { costPerHour: Number(costPerHour), plannedHours: Number(plannedHours) };
      localStorage.setItem('mach3_settings', JSON.stringify(settings));
      
      setStatus({ type: 'success', message: 'Configurações salvas!' });
      setTimeout(() => setStatus(null), 3000);
      onRefresh();
    } catch (err) {
      setStatus({ type: 'error', message: 'Erro ao salvar.' });
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-12 animate-in slide-in-from-bottom duration-700">
      {/* Plans Section */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-black tracking-tight text-white uppercase italic">Upgrade para o Plano Pro</h2>
          <p className="text-text-muted">Acesso ilimitado a relatórios avançados, monitoramento de múltiplas máquinas e exportação PDF.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Starter Plan */}
          <div className={`glass p-10 rounded-[40px] border-border/30 flex flex-col items-center group hover:scale-105 transition-all duration-500 ${user?.plan === 'starter' ? 'ring-2 ring-accent-cyan/50' : ''}`}>
             {user?.plan === 'starter' && <span className="text-[10px] uppercase font-black tracking-widest text-accent-cyan mb-4">Plano Atual</span>}
            <h3 className="text-xl font-bold mb-2">Starter</h3>
            <div className="text-4xl font-black text-white mb-6">Grátis*</div>
            <ul className="space-y-4 mb-10 text-sm text-text-muted font-medium w-full">
              <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success" /> 1 Máquina Ativa</li>
              <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success" /> Histórico 30 dias</li>
              <li className="flex items-center gap-3 opacity-30"><CheckCircle2 size={16} /> Gráficos Avançados</li>
              <li className="flex items-center gap-3 opacity-30"><CheckCircle2 size={16} /> Exportação CSV/PDF</li>
            </ul>
             <button className="w-full py-4 rounded-2xl bg-white/5 border border-border hover:bg-white/10 transition-colors font-black uppercase tracking-widest text-xs">Ativo</button>
          </div>

          {/* Pro Plan */}
          <div className={`glass p-1 w-full rounded-[40px] border-accent-cyan/30 bg-gradient-to-br from-accent-cyan/20 to-accent-blue/10 flex flex-col items-center group scale-110 relative ${user?.plan === 'pro' ? 'ring-2 ring-accent-cyan/50' : ''}`}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-accent-cyan text-black text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-lg shadow-accent-cyan/30">MAIS POPULAR</div>
            <div className="p-9 flex flex-col items-center w-full">
              <h3 className="text-xl font-bold mb-2 text-white">Profissional</h3>
              <div className="text-4xl font-black text-white mb-6">R$ 149<span className="text-sm font-medium text-text-muted">/mês</span></div>
              <ul className="space-y-4 mb-10 text-sm font-semibold w-full">
                <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-cyan" /> Até 3 Máquinas</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-cyan" /> Histórico Ilimitado</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-cyan" /> Gráficos de Produção</li>
                <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-cyan" /> Exportação Completa</li>
              </ul>
              <button 
                onClick={() => handleSubscribe('pro')}
                className="w-full py-4 rounded-2xl bg-accent-cyan text-black hover:scale-105 active:scale-95 transition-all font-black uppercase tracking-widest text-xs shadow-xl shadow-accent-cyan/20"
              >
                Escolher PRO
              </button>
            </div>
          </div>

          {/* Business Plan */}
          <div className={`glass p-10 rounded-[40px] border-border/30 flex flex-col items-center group hover:scale-105 transition-all duration-500 ${user?.plan === 'business' ? 'ring-2 ring-accent-cyan/50' : ''}`}>
            <h3 className="text-xl font-bold mb-2">Business</h3>
            <div className="text-4xl font-black text-white mb-6">R$ 349<span className="text-sm font-medium text-text-muted">/mês</span></div>
            <ul className="space-y-4 mb-10 text-sm text-text-muted font-medium w-full">
              <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success" /> Máquinas Ilimitadas</li>
              <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success" /> Análise de Custos OEE</li>
              <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success" /> Suporte Prioritário</li>
              <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success" /> White-label App</li>
            </ul>
             <button 
                onClick={() => handleSubscribe('business')}
                className="w-full py-4 rounded-2xl bg-white/5 border border-border group-hover:bg-white/10 group-hover:border-accent-cyan/30 transition-all font-black uppercase tracking-widest text-xs"
              >
                Escolher BUSINESS
              </button>
          </div>
        </div>
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
              className="flex items-center justify-center gap-2 w-full py-4 bg-accent-cyan text-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all font-black uppercase tracking-widest text-xs shadow-lg shadow-accent-cyan/20"
            >
               <Save size={18} /> Salvar Parâmetros
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
             <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-border/50">
                <div className="space-y-0.5">
                   <div className="text-sm font-bold text-white">Endpoint de Webhook</div>
                   <div className="text-[10px] font-medium text-text-muted">URL para integração com ERP externa</div>
                </div>
                <ChevronRight size={18} className="text-text-muted" />
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
