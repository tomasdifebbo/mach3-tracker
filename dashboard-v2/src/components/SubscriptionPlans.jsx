import React, { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export function SubscriptionPlans({ user }) {
  const [checkoutLoading, setCheckoutLoading] = useState(null);

  const handleSubscribe = async (planType) => {
    setCheckoutLoading(planType);
    try {
      const resp = await api.createPaymentPreference(planType);
      if (resp && resp.init_point) {
        window.location.href = resp.init_point;
      } else {
        alert("Erro ao gerar link de pagamento.");
        setCheckoutLoading(null);
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao conectar com o provedor de pagamento.");
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
      {/* Starter Plan */}
      <div className={`glass p-10 rounded-[40px] border-border/30 flex flex-col items-center group hover:scale-105 transition-all duration-500 ${user?.plan === 'starter' ? 'ring-2 ring-accent-cyan/50' : ''}`}>
        {user?.plan === 'starter' && <span className="text-[10px] uppercase font-black tracking-widest text-accent-cyan mb-4">Plano Atual</span>}
        <h3 className="text-xl font-bold mb-1 text-white">Starter</h3>
        <div className="text-xs font-bold text-accent-cyan uppercase tracking-widest mb-3">30 Dias Grátis</div>
        <div className="flex flex-col items-center mb-6">
          <div className="text-3xl font-black text-white">
            R$ 59,90<span className="text-xs font-medium text-text-muted">/mês</span>
          </div>
          <div className="text-xs font-bold text-text-muted line-through mt-1 opacity-60">
            R$ 99,90/mês
          </div>
        </div>
        <ul className="space-y-3 mb-8 text-xs text-text-muted font-medium w-full flex-1">
          <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success shrink-0" /> 1 Máquina Ativa (CNC Router ou Laser)</li>
          <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success shrink-0" /> Status & Telemetria em Tempo Real</li>
          <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success shrink-0" /> Histórico de Produção 30 dias</li>
          <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success shrink-0" /> Notificações de Produção</li>
          <li className="flex items-center gap-3 opacity-40"><CheckCircle2 size={16} className="shrink-0" /> Cálculo de Consumo por m²</li>
          <li className="flex items-center gap-3 opacity-40"><CheckCircle2 size={16} className="shrink-0" /> Relatórios PDF / CSV & Gráficos</li>
        </ul>
        <button 
          onClick={() => handleSubscribe('starter')}
          disabled={!!checkoutLoading || user?.plan === 'starter'}
          className="w-full py-4 rounded-2xl bg-white/5 border border-border group-hover:bg-white/10 group-hover:border-accent-cyan/30 transition-all font-black uppercase tracking-widest text-xs text-white disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {checkoutLoading === 'starter' ? <><Loader2 size={16} className="animate-spin" /> Processando...</> : user?.plan === 'starter' ? '✓ Plano Atual' : 'Assinar Starter'}
        </button>
      </div>

      {/* Pro Plan */}
      <div className={`glass p-1 w-full rounded-[40px] border-accent-cyan/30 bg-gradient-to-br from-accent-cyan/20 to-accent-blue/10 flex flex-col items-center group scale-105 relative shadow-2xl shadow-accent-cyan/10 ${user?.plan === 'pro' ? 'ring-2 ring-accent-cyan/50' : ''}`}>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-accent-cyan text-black text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full shadow-lg shadow-accent-cyan/30">MAIS POPULAR</div>
        <div className="p-9 flex flex-col items-center w-full h-full">
          <h3 className="text-xl font-bold mb-3 text-white">Profissional</h3>
          <div className="flex flex-col items-center mb-6">
            <div className="text-4xl font-black text-white">
              R$ 149,90<span className="text-sm font-medium text-text-muted">/mês</span>
            </div>
            <div className="text-xs font-bold text-text-muted line-through mt-1 opacity-70">
              De R$ 199,90/mês
            </div>
          </div>
          <ul className="space-y-3 mb-8 text-xs font-semibold w-full text-white flex-1">
            <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-cyan shrink-0" /> Até 3 Máquinas (Router & Laser)</li>
            <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-cyan shrink-0" /> Histórico de Produção Ilimitado</li>
            <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-cyan shrink-0" /> Edição de Projetos & Vinculação O.S.</li>
            <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-cyan shrink-0" /> Cálculo de Consumo por m² Utilizado</li>
            <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-cyan shrink-0" /> Relatórios PDF Profissionais & CSV</li>
            <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-cyan shrink-0" /> Gráficos de Produção & Carga</li>
            <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-cyan shrink-0" /> Gestão de Manutenção Preventiva</li>
          </ul>
          <button 
            onClick={() => handleSubscribe('pro')}
            disabled={!!checkoutLoading || user?.plan === 'pro'}
            className="w-full py-4 rounded-2xl bg-accent-cyan text-black hover:scale-105 active:scale-95 transition-all font-black uppercase tracking-widest text-xs shadow-xl shadow-accent-cyan/20 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {checkoutLoading === 'pro' ? <><Loader2 size={16} className="animate-spin" /> Processando...</> : user?.plan === 'pro' ? '✓ Plano Atual' : 'Escolher PRO'}
          </button>
        </div>
      </div>

      {/* Business Plan */}
      <div className={`glass p-10 rounded-[40px] border-border/30 flex flex-col items-center group hover:scale-105 transition-all duration-500 ${user?.plan === 'business' ? 'ring-2 ring-accent-cyan/50' : ''}`}>
        <h3 className="text-xl font-bold mb-3 text-white">Business</h3>
        <div className="flex flex-col items-center mb-6">
          <div className="text-3xl font-black text-white">
            R$ 349,90<span className="text-xs font-medium text-text-muted">/mês</span>
          </div>
          <div className="text-xs font-bold text-text-muted line-through mt-1 opacity-60">
            De R$ 399,90/mês
          </div>
        </div>
        <ul className="space-y-3 mb-8 text-xs text-text-muted font-medium w-full flex-1">
          <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success shrink-0" /> Máquinas Ilimitadas (Router, Laser, Plasma)</li>
          <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success shrink-0" /> Tudo do Plano Profissional</li>
          <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success shrink-0" /> Painel Kanban do Encarregado Completo</li>
          <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success shrink-0" /> Checklists Diários Operacionais</li>
          <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success shrink-0" /> Análise de Custos OEE & Performance</li>
          <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-accent-success shrink-0" /> Suporte Prioritário Dedicado</li>
        </ul>
        <button 
          onClick={() => handleSubscribe('business')}
          disabled={!!checkoutLoading || user?.plan === 'business'}
          className="w-full py-4 rounded-2xl bg-white/5 border border-border group-hover:bg-white/10 group-hover:border-accent-cyan/30 transition-all font-black uppercase tracking-widest text-xs text-white disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {checkoutLoading === 'business' ? <><Loader2 size={16} className="animate-spin" /> Processando...</> : user?.plan === 'business' ? '✓ Plano Atual' : 'Escolher BUSINESS'}
        </button>
      </div>
    </div>
  );
}
