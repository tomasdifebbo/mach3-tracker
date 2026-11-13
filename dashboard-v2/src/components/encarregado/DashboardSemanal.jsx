import React, { useMemo } from 'react';
import { Zap, Target } from 'lucide-react';
import { KpiCard, SectionHeader } from './EncarregadoShared';

export function DashboardSemanal({ jobs = [] }) {
  const weekJobs = useMemo(() => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + 1); // Segunda-feira
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return jobs.filter(j => {
      const d = new Date(j.start_time);
      return d >= weekStart && d <= weekEnd;
    });
  }, [jobs]);

  const totalJobs = weekJobs.length;
  const completedJobs = weekJobs.filter(j => j.end_time).length;
  const onTimeRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader label="Resumo Executivo" title="Dashboard Semanal" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon="📦" value={`${onTimeRate}%`} label="OS Entregues" color="text-orange-400" meta={`Meta: > 95%`} />
        <KpiCard icon="✅" value="96%" label="Qualidade" color="text-accent-success" meta="Meta: > 98%" />
        <KpiCard icon="⏱️" value="92%" label="No Prazo" color="text-accent-cyan" meta="Meta: > 97%" />
        <KpiCard icon="⭐" value="2" label="Kaizens" color="text-accent-warning" meta="Meta: ≥ 1/sem" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Fórmulas */}
        <div className="glass rounded-2xl p-6 border border-orange-500/20 border-l-4 border-l-orange-500">
          <h3 className="text-sm font-black uppercase tracking-widest text-white mb-5 flex items-center gap-2">
            <Zap size={16} className="text-orange-400" /> Fórmulas de Performance
          </h3>
          <div className="space-y-4">
            {[
              { lbl: 'Entregas', formula: 'OS entregues no prazo ÷ Total entregues × 100' },
              { lbl: 'Qualidade', formula: 'Peças aprovadas de 1ª ÷ Total produzidas × 100' },
              { lbl: 'Ordens', formula: 'OS concluídas ÷ OS programadas × 100' },
            ].map(f => (
              <div key={f.lbl}>
                <p className="text-[10px] font-black uppercase tracking-widest text-text-muted mb-1">{f.lbl}</p>
                <code className="block bg-black/30 text-accent-cyan text-xs p-2.5 rounded-xl border border-white/5">{f.formula}</code>
              </div>
            ))}
          </div>
        </div>

        {/* Metas */}
        <div className="glass rounded-2xl p-6 border border-white/5">
          <h3 className="text-sm font-black uppercase tracking-widest text-white mb-5 flex items-center gap-2">
            <Target size={16} className="text-orange-400" /> Metas Semanais
          </h3>
          <div className="space-y-3">
            {[
              { name: 'OS Entregues', meta: '> 95%', ok: onTimeRate >= 95 },
              { name: 'Qualidade de Peças', meta: '> 98%', ok: true },
              { name: 'Prazo de Entrega', meta: '> 97%', ok: false },
              { name: 'Kaizens Implementados', meta: '≥ 1/semana', ok: true },
            ].map(m => (
              <div key={m.name} className="flex items-center justify-between text-sm py-2 border-b border-white/5 last:border-0">
                <span className="text-text-muted font-medium">{m.name}</span>
                <span className={`font-black text-xs ${m.ok ? 'text-accent-success' : 'text-accent-warning'}`}>{m.meta}</span>
              </div>
            ))}
          </div>
          <div className="mt-5 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
            <p className="text-xs text-orange-200/80 leading-relaxed">
              <strong className="text-orange-400">Segurança:</strong> Óculos específicos e retirada diária de cavacos da Router CNC são obrigatórios antes do início do turno.
            </p>
          </div>
        </div>
      </div>

      {/* Jobs da semana */}
      {totalJobs > 0 && (
        <div className="glass rounded-2xl border border-white/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">Jobs desta semana ({totalJobs})</h3>
            <div className="flex items-center gap-4 text-[9px] font-black uppercase tracking-widest text-text-muted">
              <span>Máquina</span>
              <span>Pasta / Arquivo</span>
              <span>Status</span>
            </div>
          </div>
          <div className="divide-y divide-white/5">
            {weekJobs.slice(0, 10).map(j => (
              <div key={j.id} className="grid grid-cols-[1fr_auto] gap-4 px-6 py-3.5 hover:bg-white/[0.02] transition-colors items-center">
                <div>
                  {/* Nome do job */}
                  <p className="text-sm font-semibold text-white mb-0.5 leading-tight">
                    {j.job_name || j.file_name || '—'}
                  </p>
                  {/* Linha inferior: máquina + pasta / arquivo */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-md">
                      {j.router_name || '—'}
                    </span>
                    {j.folder && (
                      <span className="flex items-center gap-1 text-[10px] text-text-muted">
                        <span className="text-text-muted/50">📁</span>
                        <span className="font-medium">{j.folder}</span>
                      </span>
                    )}
                    {j.file_name && (
                      <span className="flex items-center gap-1 text-[10px] text-text-muted">
                        <span className="text-text-muted/50">📄</span>
                        <span className="font-medium text-accent-cyan/80">{j.file_name}</span>
                      </span>
                    )}
                    {j.material_name && !j.folder && !j.file_name && (
                      <span className="text-[10px] text-text-muted">{j.material_name}</span>
                    )}
                  </div>
                </div>
                <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full whitespace-nowrap ${
                  j.end_time
                    ? 'bg-accent-success/10 text-accent-success'
                    : 'bg-accent-cyan/10 text-accent-cyan'
                }`}>
                  {j.end_time ? 'Concluído' : 'Em curso'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
