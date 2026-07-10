import React from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { SubscriptionPlans } from './SubscriptionPlans';

export function PaymentModal({ user }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-500">
      {/* Backdrop (Dark blur) */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md pointer-events-auto"></div>
      
      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-5xl max-h-full overflow-y-auto custom-scrollbar bg-bg-main/90 border border-white/10 p-6 md:p-10 rounded-[40px] shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-500">
        
        {/* Lock Icon */}
        <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_40px_-10px_rgba(239,68,68,0.5)]">
           <Lock size={32} />
        </div>

        <h2 className="text-3xl md:text-4xl font-black text-white text-center tracking-tighter mb-4 uppercase italic">
          Tempo Esgotado
        </h2>
        
        <p className="text-center text-text-muted font-medium mb-10 max-w-xl">
          O seu período de degustação chegou ao fim e o sistema foi congelado por segurança. 
          Para restaurar o acesso <strong className="text-white">imediato</strong> a todos os seus dados e máquinas, assine um plano.
        </p>

        <div className="w-full">
           <SubscriptionPlans user={user} />
        </div>
      </div>
    </div>
  );
}
