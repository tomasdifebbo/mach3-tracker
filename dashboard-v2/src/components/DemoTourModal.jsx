import React, { useState } from 'react';
import { Sparkles, ChevronRight, ChevronLeft, X, CheckCircle2, Play, Activity, Cpu, Layers, BarChart2, Package, Wrench, ShieldCheck } from 'lucide-react';

export function DemoTourModal({ isOpen, onClose, setActiveSection }) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const tourSteps = [
    {
      id: 'dashboard',
      section: 'dashboard',
      icon: Activity,
      badge: 'Etapa 1 de 7 • Monitoramento',
      title: '🚀 Status & Telemetria em Tempo Real',
      description: 'Acompanhe todas as suas CNC Routers e Lasers conectadas simultaneamente. Veja quem está operando, qual arquivo está sendo cortado, porcentagem de progresso e status operacional em tempo real.',
      tip: '💡 Dica para o Cliente: Elimina a necessidade do gerente caminhar até a oficina para saber o status das máquinas.'
    },
    {
      id: 'operador',
      section: 'operador',
      icon: Cpu,
      badge: 'Etapa 2 de 7 • Chão de Fábrica',
      title: '👤 Modo Operador de Produção',
      description: 'Interface simplificada otimizada para tablets e monitores ao lado da máquina. Permite ao operador visualizar o trabalho atual, conferir o checklist operacional e trocar de operador via PIN seguro.',
      tip: '💡 Dica para o Cliente: Garante rastreabilidade total de qual operador produziu cada lote de peças.'
    },
    {
      id: 'historico',
      section: 'jobs',
      icon: Layers,
      badge: 'Etapa 3 de 7 • Rastreabilidade',
      title: '📊 Histórico de Produção & Cálculo de m²',
      description: 'Cada trabalho executado registra automaticamente: data/hora exatas de início e fim, duração real, dimensões da peça em mm, área total produzida em m² e valor total do material consumido.',
      tip: '💡 Dica para o Cliente: Exporte relatórios em PDF e CSV com um clique para orçamentos e auditorias.'
    },
    {
      id: 'graficos',
      section: 'charts',
      icon: BarChart2,
      badge: 'Etapa 4 de 7 • Relatórios',
      title: '📈 Gráficos de Produtividade & OEE',
      description: 'Gráficos gerenciais intuitivos mostrando horas trabalhadas por máquina, comparação entre tempo estimado vs. tempo real de corte, consumo mensal de chapas e eficiência operacional.',
      tip: '💡 Dica para o Cliente: Identifique gargalos e máquinas ociosas para maximizar seu faturamento diário.'
    },
    {
      id: 'materiais',
      section: 'materials',
      icon: Package,
      badge: 'Etapa 5 de 7 • Custos',
      title: '📦 Cadastro de Materiais & Custos',
      description: 'Cadastre o custo por m² de chapas (Acrílico, MDF, ACM, PVC, Inox). O sistema reconhece automaticamente o material pelo nome do arquivo ou configuração e calcula o custo de insumo de cada peça.',
      tip: '💡 Dica para o Cliente: Saiba o custo exato em Reais (R$) de matéria-prima gasta em cada trabalho.'
    },
    {
      id: 'encarregado',
      section: 'encarregado',
      icon: ShieldCheck,
      badge: 'Etapa 6 de 7 • Produção',
      title: '📋 Quadro Kanban de Ordens de Serviço (O.S.)',
      description: 'Gestão visual de Ordens de Serviço (A Fazer / Em Produção / Concluído). Quando o operador envia o arquivo do CorelDRAW ou LaserCAD, a O.S. no Kanban avança automaticamente!',
      tip: '💡 Dica para o Cliente: Automação total entre os arquivos enviados do computador e o painel do encarregado.'
    },
    {
      id: 'manutencao',
      section: 'maintenance',
      icon: Wrench,
      badge: 'Etapa 7 de 7 • Manutenção',
      title: '🛠️ Manutenção Preventiva & Horímetro',
      description: 'Controle inteligente de manutenção preventiva (lubrificação dos guias lineares, troca de fluido dos chillers laser, limpeza de lentes). Emite alertas para evitar quebras dispendiosas.',
      tip: '💡 Dica para o Cliente: Proteja o investimento de suas máquinas CNC prevenindo desgastes precoces.'
    }
  ];

  const step = tourSteps[currentStep];
  const Icon = step.icon;

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      if (setActiveSection) {
        setActiveSection(tourSteps[nextStep].section);
      }
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      const prevStep = currentStep - 1;
      setCurrentStep(prevStep);
      if (setActiveSection) {
        setActiveSection(tourSteps[prevStep].section);
      }
    }
  };

  const handleSelectStep = (idx) => {
    setCurrentStep(idx);
    if (setActiveSection) {
      setActiveSection(tourSteps[idx].section);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      {/* Backdrop overlay */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-2xl bg-slate-900/95 border border-cyan-500/30 p-6 sm:p-8 rounded-3xl shadow-[0_0_50px_rgba(6,182,212,0.25)] flex flex-col gap-6 animate-in zoom-in-95 duration-300">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 block">{step.badge}</span>
              <h3 className="text-base font-bold text-white tracking-tight">Guia Interativo de Apresentação</h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Body */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Icon size={28} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{step.title}</h2>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed font-normal bg-white/5 p-4 rounded-2xl border border-white/5">
            {step.description}
          </p>

          <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs font-medium flex items-start gap-3">
            <span className="text-base">💡</span>
            <span>{step.tip}</span>
          </div>
        </div>

        {/* Step Indicators Dots */}
        <div className="flex items-center justify-center gap-2 py-2">
          {tourSteps.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => handleSelectStep(idx)}
              className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${idx === currentStep ? 'w-8 bg-cyan-400 shadow-md shadow-cyan-400/50' : 'w-2.5 bg-white/20 hover:bg-white/40'}`}
              title={`Ir para etapa ${idx + 1}`}
            />
          ))}
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
          >
            <ChevronLeft size={16} /> Anterior
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-text-muted hover:text-white font-semibold text-xs transition-all cursor-pointer"
            >
              Pular Guia
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-black text-xs hover:brightness-110 transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 cursor-pointer"
            >
              {currentStep === tourSteps.length - 1 ? (
                <>Concluir <CheckCircle2 size={16} /></>
              ) : (
                <>Próxima Etapa <ChevronRight size={16} /></>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
