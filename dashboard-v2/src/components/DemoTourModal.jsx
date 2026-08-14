import React, { useState } from 'react';
import { 
  Sparkles, ChevronRight, ChevronLeft, X, CheckCircle2, 
  Activity, Layers, BarChart2, Package, Wrench, Clock, HardHat, Settings, Users, Utensils
} from 'lucide-react';

export function DemoTourModal({ isOpen, onClose, setActiveSection }) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!isOpen) return null;

  const tourSteps = [
    {
      id: 'dashboard',
      section: 'dashboard',
      icon: Activity,
      badge: 'Etapa 1 de 9 • Telemetria ao Vivo',
      title: '🚀 Status & Telemetria em Tempo Real (CNC, Laser & Vácuo)',
      description: 'Acompanhe simultaneamente todas as suas Router CNC, Laser Ruida CO2 e a nova Máquina a Vácuo (Termoformadora). Visualize quem está operando cada máquina, o arquivo em execução, barra de progresso em tempo real, tempo decorrido e a previsão exata de término (ETA).',
      tip: '💡 Dica para o Cliente: Permite ao gerente monitorar 100% da fábrica em uma única tela sem precisar caminhar até a oficina.'
    },
    {
      id: 'equipe_hoje',
      section: 'operador',
      icon: Users,
      badge: 'Etapa 2 de 9 • Alocação da Equipe & Almoço',
      title: '👷 Painel Equipe Hoje & Botão de Almoço 🍱',
      description: 'Gestão visual de alocação de pessoal: 🟢 Na Fábrica, 🍱 Horário de Almoço (com botão de 1 clique para ir/voltar do almoço), 🟡 Serviço Externo, 🔵 Outro Setor da Fábrica ou ⚫ Folga/Ausente. Operadores alocados fora ou em almoço são bloqueados de vínculo a máquinas automaticamente.',
      tip: '💡 Dica para o Cliente: Garante que você saiba exatamente onde cada operador está no momento e evita apontamento de máquina durante o horário de almoço.'
    },
    {
      id: 'timesheet',
      section: 'operador',
      icon: Clock,
      badge: 'Etapa 3 de 9 • Rastreamento Diário',
      title: '⏱️ Linha do Tempo Diária (Cards Individuais por Trabalho)',
      description: 'Rastreamento 100% automático por período. A cada início de corte, troca de setor ou ida ao almoço, o sistema encerra o card anterior e abre um NOVO CARD INDEPENDENTE com horário de início, término e duração exata de cada tarefa.',
      tip: '💡 Dica para o Cliente: Histórico limpo sem sobreposição de horários, mostrando exatamente quanto tempo cada peça ou trabalho levou.'
    },
    {
      id: 'encarregado',
      section: 'encarregado',
      icon: HardHat,
      badge: 'Etapa 4 de 9 • Gestão de Produção',
      title: '📋 Quadro Kanban de O.S. & Apontamentos',
      description: 'Painel Kanban interativo para gerenciar o fluxo da fábrica (A Fazer / Em Produção / Concluído). Permite direcionar trabalhos para Routers CNC, Laser, Vácuo, Serviços Externos e Outros Setores com prazos e prioridades.',
      tip: '💡 Dica para o Cliente: Avanço automático de status quando o operador dispara o arquivo de corte na máquina.'
    },
    {
      id: 'historico',
      section: 'jobs',
      icon: Layers,
      badge: 'Etapa 5 de 9 • Rastreabilidade & PDF',
      title: '📊 Histórico de Produção, Coluna Qtd & PDF em 6 Páginas',
      description: 'Rastreio de todas as peças cortadas com m², dimensões (X/Y mm), insumo consumido e custo em R$. Conta com Coluna de Quantidade (Qtd) ajustável manualmente pelo encarregado (especial para Vácuo) e Relatório PDF de 6 páginas em alto contraste (Resumo, Histórico, Manutenção, Peças, Alocação e Timesheet).',
      tip: '💡 Dica para o Cliente: Exporte relatórios executivos com timesheet completo, manutenções e gráficos prontos para reuniões ou clientes.'
    },
    {
      id: 'graficos',
      section: 'charts',
      icon: BarChart2,
      badge: 'Etapa 6 de 9 • Eficiência & OEE',
      title: '📈 Gráficos de Produtividade & Métricas Globais OEE',
      description: 'Cálculo automático de OEE (Disponibilidade, Desempenho e Qualidade). Gráficos intuitivos comparando tempo estimado vs. tempo real de corte, consumo mensal de chapas e horas produtivas por máquina e por turno.',
      tip: '💡 Dica para o Cliente: Identifique gargalos e máquinas ociosas para maximizar o faturamento diário da sua fábrica.'
    },
    {
      id: 'materiais',
      section: 'materials',
      icon: Package,
      badge: 'Etapa 7 de 9 • Gestão de Custos',
      title: '📦 Cadastro de Materiais & Calculadora de Insumos',
      description: 'Cadastre o custo por m² de chapas (MDF, Acrílico, ACM, PVC, Inox, Isopor). O sistema identifica automaticamente o material pelo nome do projeto e calcula o custo consumido em Reais (R$) por lote cortado.',
      tip: '💡 Dica para o Cliente: Elimine surpresas no custo final e saiba exatamente quanto gastou de matéria-prima em cada cliente.'
    },
    {
      id: 'manutencao',
      section: 'maintenance',
      icon: Wrench,
      badge: 'Etapa 8 de 9 • Conservação & Falhas',
      title: '🛠️ Manutenção Preventiva, Horímetro & Ocorrências',
      description: 'Controle de horímetro acumulado, alertas de lubrificação de guias lineares, troca de fluido de chillers e limpeza de lentes. Formulário direto de Reporte de Falhas para o operador notificar paradas ao encarregado.',
      tip: '💡 Dica para o Cliente: Proteja o investimento dos seus equipamentos prevenindo paradas não planejadas e quebras dispendiosas.'
    },
    {
      id: 'settings',
      section: 'settings',
      icon: Settings,
      badge: 'Etapa 9 de 9 • Controle de Acesso',
      title: '⚙️ Permissões por Perfil (Gerente, Encarregado, Operador)',
      description: 'Segurança e controle de permissões por perfil. O perfil Operador tem acesso apenas ao terminal simplificado de produção, enquanto Encarregados e Gerentes gerenciam custos, relatórios, Kanban e parâmetros.',
      tip: '💡 Dica para o Cliente: Interface otimizada para ser instalada em tablets ao lado de cada CNC/Laser no chão de fábrica.'
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
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-2xl bg-slate-900/95 border border-cyan-500/30 p-6 sm:p-8 rounded-3xl shadow-[0_0_60px_rgba(6,182,212,0.3)] flex flex-col gap-6 animate-in zoom-in-95 duration-300">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Sparkles size={20} className="animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 block">{step.badge}</span>
              <h3 className="text-base font-bold text-white tracking-tight">Guia Interativo de Apresentação Mach3 Tracker</h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-text-muted hover:text-white hover:bg-white/10 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
          <div 
            className="bg-gradient-to-r from-cyan-400 to-blue-500 h-full transition-all duration-300 shadow-sm"
            style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
          />
        </div>

        {/* Step Body */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-md shadow-cyan-500/5">
              <Icon size={28} />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">{step.title}</h2>
          </div>

          <p className="text-sm text-slate-300 leading-relaxed font-normal bg-white/5 p-4 rounded-2xl border border-white/5">
            {step.description}
          </p>

          <div className="p-4 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs font-medium flex items-start gap-3 shadow-inner">
            <span className="text-base">💡</span>
            <span>{step.tip}</span>
          </div>
        </div>

        {/* Step Indicators Dots */}
        <div className="flex items-center justify-center gap-1.5 py-1">
          {tourSteps.map((s, idx) => (
            <button
              key={s.id}
              onClick={() => handleSelectStep(idx)}
              className={`h-7 rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center text-[10px] font-black ${
                idx === currentStep 
                  ? 'w-9 bg-cyan-400 text-black shadow-md shadow-cyan-400/50' 
                  : 'w-7 bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'
              }`}
              title={`Etapa ${idx + 1}: ${s.title}`}
            >
              {idx + 1}
            </button>
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
