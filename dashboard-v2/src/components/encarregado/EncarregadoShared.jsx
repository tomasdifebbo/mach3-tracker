import React from 'react';

export function KpiCard({ icon, value, label, color = 'text-accent-cyan', meta }) {
  return (
    <div className="glass rounded-2xl p-6 border border-white/5 flex flex-col items-center text-center group hover:border-white/10 transition-all">
      <div className="text-3xl mb-2">{icon}</div>
      <div className={`text-4xl font-black ${color} mb-1`}>{value}</div>
      <div className="text-xs font-bold uppercase tracking-widest text-text-muted">{label}</div>
      {meta && <div className="mt-2 text-[10px] text-text-muted border border-white/5 rounded-full px-2 py-0.5">{meta}</div>}
    </div>
  );
}

export function SectionHeader({ label, title, action, children }) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.3em] text-orange-400 mb-2">{label}</p>
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-3xl font-black text-white tracking-tight">{title}</h2>
          {children}
        </div>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
