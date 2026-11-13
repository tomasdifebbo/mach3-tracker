import React from 'react';
import { Clock } from 'lucide-react';
import { SectionHeader } from './EncarregadoShared';

export function RotinaSemanal() {
  const today = new Date().getDay(); // 0=Dom,1=Seg...

  const weekDays = [
    { short: 'SEG', idx: 1, name: 'Segunda-feira', focus: 'Planejamento', desc: 'Alinhamento com vendas, atualização do Kanban e definição de metas semanais.' },
    { short: 'TER', idx: 2, name: 'Terça-feira', focus: 'Qualidade', desc: 'Auditoria dimensional e verificação técnica das peças finais de cada máquina.' },
    { short: 'QUA', idx: 3, name: 'Quarta-feira', focus: 'Manutenção', desc: 'Limpeza profunda, lubrificação das guias e calibração de sistemas críticos.' },
    { short: 'QUI', idx: 4, name: 'Quinta-feira', focus: 'Estoque', desc: 'Verificação de insumos, fresas, filamentos e encaminhamento de compras urgentes.' },
    { short: 'SEX', idx: 5, name: 'Sexta-feira', focus: 'Fechamento', desc: 'Cálculo de KPIs, entrega de OS finais e 5S geral da fábrica.' },
    { short: 'SÁB', idx: 6, name: 'Sábado', focus: 'Organização', desc: 'Organização final da fábrica, revisão das máquinas e preparação para a semana.' },
  ];

  const turno = [
    { moment: 'Início do Turno (10 min)', activity: 'Reunião rápida (Daily) com operadores no painel Kanban.', goal: 'Alinhar prioridades e designar cada operador ao seu maquinário.' },
    { moment: 'Meio do Turno (Gemba Walk)', activity: 'Ronda pelas máquinas: ouvir sons, detectar desvios e dar suporte técnico.', goal: 'Prevenir falhas e eliminar gargalos antes que causem paradas.' },
    { moment: 'Fim do Turno (15 min)', activity: 'Fechamento de KPIs do dia e auditoria de 5S nas bancadas.', goal: 'Garantir que OS estejam atualizadas e fábrica em ordem.' },
  ];

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <SectionHeader label="Planejamento" title="Rotina Semanal" />

      {/* Grid de Quadrados dos Dias da Semana */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {weekDays.map(d => {
          const isToday = d.idx === today;
          return (
            <div 
              key={d.short} 
              className={`rounded-2xl p-5 border transition-all flex flex-col justify-between h-full group hover:border-orange-500/40 ${
                isToday 
                  ? 'border-orange-500 bg-gradient-to-b from-orange-500/15 via-orange-500/5 to-transparent shadow-xl shadow-orange-500/10 scale-[1.02]' 
                  : 'glass border-white/5 hover:bg-white/[0.02]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-md tracking-wider ${isToday ? 'bg-orange-500 text-black font-extrabold' : 'bg-white/10 text-text-muted'}`}>
                    {d.short}
                  </span>
                  {isToday && (
                    <span className="flex items-center gap-1 text-[9px] text-orange-400 font-black tracking-widest uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
                      Hoje
                    </span>
                  )}
                </div>
                <h4 className="font-black text-white text-base mb-1.5 group-hover:text-orange-400 transition-colors">{d.focus}</h4>
                <p className="text-xs text-text-muted leading-relaxed">{d.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-4 md:p-6 border-b border-white/5">
          <h3 className="text-xs md:text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
            <Clock size={16} className="text-orange-400" /> Responsabilidades por Momento do Turno
          </h3>
        </div>
        <div className="divide-y divide-white/5">
          {turno.map(t => (
            <div key={t.moment} className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4 p-4 md:p-5 hover:bg-white/[0.02] transition-colors">
              <p className="text-sm font-bold text-white">{t.moment}</p>
              <p className="text-sm text-text-muted">{t.activity}</p>
              <p className="text-sm text-accent-cyan font-medium">{t.goal}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
