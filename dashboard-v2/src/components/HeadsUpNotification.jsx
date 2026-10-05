import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X, ExternalLink } from 'lucide-react';

export function HeadsUpNotification({ notification, onDismiss, onOpen }) {
  useEffect(() => {
    if (!notification) return;

    // Retrai automaticamente após 4.5 segundos (idêntico ao WhatsApp)
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);

    return () => clearTimeout(timer);
  }, [notification, onDismiss]);

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          key="heads-up-banner"
          initial={{ y: -120, opacity: 0, scale: 0.92 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -120, opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          drag="y"
          dragConstraints={{ top: -100, bottom: 0 }}
          dragElastic={0.3}
          onDragEnd={(_, info) => {
            if (info.offset.y < -20) {
              onDismiss();
            }
          }}
          className="fixed top-3 left-0 right-0 mx-auto z-[99999] w-[94%] max-w-md cursor-pointer select-none"
          onClick={() => {
            if (onOpen) onOpen();
            onDismiss();
          }}
        >
          <div className="relative overflow-hidden rounded-2xl bg-[#0f172a]/95 backdrop-blur-2xl border border-emerald-500/40 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.65),0_0_30px_rgba(16,185,129,0.25)]">
            {/* Header com estilo push de sistema */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-lg bg-emerald-500 flex items-center justify-center text-black shadow-sm shadow-emerald-500/50">
                  <CheckCircle2 size={13} strokeWidth={3} />
                </div>
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                  MACH3 TRACKER
                </span>
                <span className="text-[10px] text-white/40 font-medium">· agora</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDismiss();
                }}
                className="p-1 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                title="Fechar"
              >
                <X size={14} />
              </button>
            </div>

            {/* Conteúdo da Mensagem */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-white tracking-tight leading-snug">
                  {notification.title || '🔔 Corte Concluído'}
                </h4>
                <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
                  {notification.body || 'Um trabalho de corte foi concluído na máquina.'}
                </p>
              </div>
              <div className="shrink-0 p-1.5 rounded-xl bg-white/5 text-emerald-400 border border-white/5">
                <ExternalLink size={14} />
              </div>
            </div>

            {/* Barra de progresso do auto-recolhimento (4.5s) */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 4.5, ease: 'linear' }}
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400"
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
