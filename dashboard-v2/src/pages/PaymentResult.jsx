import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../services/api';

const STATES = {
  success: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'from-emerald-500/20 to-emerald-500/5',
    ring: 'ring-emerald-500/30',
    title: 'Pagamento Aprovado! 🎉',
    message: 'Seu plano foi ativado com sucesso. O dashboard já está atualizado com todos os recursos do seu plano.',
  },
  failure: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'from-red-500/20 to-red-500/5',
    ring: 'ring-red-500/30',
    title: 'Pagamento Recusado',
    message: 'Houve um problema com o seu pagamento. Nenhum valor foi cobrado. Por favor, tente novamente ou escolha outro método de pagamento.',
  },
  pending: {
    icon: Clock,
    color: 'text-amber-400',
    bg: 'from-amber-500/20 to-amber-500/5',
    ring: 'ring-amber-500/30',
    title: 'Pagamento em Análise',
    message: 'Seu pagamento está sendo processado. Assim que aprovado, seu plano será atualizado automaticamente. Você receberá uma confirmação.',
  }
};

export function PaymentResult({ status = 'success', onGoToDashboard }) {
  const [planInfo, setPlanInfo] = useState(null);
  const [loading, setLoading] = useState(status === 'success');
  const state = STATES[status] || STATES.success;
  const Icon = state.icon;

  useEffect(() => {
    if (status === 'success') {
      // Poll up to 5x for the plan to be updated (webhook can take a few seconds)
      let attempts = 0;
      const interval = setInterval(async () => {
        try {
          const data = await api.getPaymentStatus();
          if (data && data.plan !== 'starter') {
            setPlanInfo(data);
            setLoading(false);
            clearInterval(interval);
          }
          attempts++;
          if (attempts >= 5) { setLoading(false); clearInterval(interval); }
        } catch { attempts++; if (attempts >= 5) { setLoading(false); clearInterval(interval); } }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [status]);

  return (
    <div className="min-h-screen bg-bg-main flex items-center justify-center p-6 font-inter">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className={`absolute w-[700px] h-[700px] rounded-full blur-[140px] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br ${state.bg}`} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className={`relative z-10 max-w-lg w-full glass rounded-[40px] p-12 border ring-1 ${state.ring} text-center space-y-8`}
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          className={`inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br ${state.bg} ring-1 ${state.ring} mx-auto`}
        >
          <Icon size={48} className={state.color} />
        </motion.div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-3xl font-black tracking-tight text-white">{state.title}</h1>
          <p className="text-text-muted text-sm leading-relaxed font-medium">{state.message}</p>
        </div>

        {/* Plan info (success only) */}
        {status === 'success' && (
          <div className={`bg-gradient-to-br ${state.bg} ring-1 ${state.ring} rounded-2xl p-6 space-y-2`}>
            {loading ? (
              <div className="flex items-center justify-center gap-3 text-sm font-bold text-emerald-400">
                <Loader2 size={18} className="animate-spin" />
                Confirmando plano...
              </div>
            ) : planInfo ? (
              <>
                <div className="text-xs uppercase tracking-widest text-text-muted font-black">Plano Ativo</div>
                <div className="text-2xl font-black text-white uppercase">{planInfo.plan}</div>
                {planInfo.trial_expiry && (
                  <div className="text-xs text-text-muted">
                    Próxima renovação: {new Date(planInfo.trial_expiry).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm font-bold text-emerald-400">Plano ativado! Retorne ao dashboard.</div>
            )}
          </div>
        )}

        {/* CTA */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onGoToDashboard}
          className="w-full py-4 bg-accent-cyan text-black font-black uppercase tracking-widest text-sm rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-accent-cyan/20"
        >
          {status === 'failure' ? 'Tentar Novamente' : 'Ir para o Dashboard'}
          <ArrowRight size={18} />
        </motion.button>
      </motion.div>
    </div>
  );
}
