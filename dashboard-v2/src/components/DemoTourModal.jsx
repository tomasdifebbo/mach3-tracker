import React, { useState } from 'react';
import { 
  Sparkles, ChevronRight, ChevronLeft, X, CheckCircle2, 
  Activity, Layers, BarChart2, Package, Wrench, Clock, HardHat, Settings, Users
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
      title: '🚀 Status & Telemetria em Tempo Real',
      description: 'Acompanhe simultaneamente todas as suas Router CNC, Laser Ruida e Máquina a Vácuo. Visualize quem está operando, o arquivo em execução, barra de progresso em tempo real, tempo restante e previsão de término (ETA).',
      tip: '💡 Dica para a Apresentação: Mostre como o gerente visualiza todas as máquinas da fábrica em uma única tela sem precisar caminhar até a oficina.'
    },
    {
      id: 'equipe_hoje',
      section: 'operador',
      icon: Users,
      badge: 'Etapa 2 de 9 • Alocação da Equipe',
      title: '👷 Painel Equipe Hoje & Controle de Status',
      description: 'Gestão visual de onde cada colaborador está atuando no momento: 🟢 Na Fábrica, 🟡 Serviço Externo, 🔵 Outro Setor, 🍱 Horário de Almoço ou ⚫ Folga/Ausente. Operadores alocados fora são bloqueados automaticamente de vinculações a máquinas.',
      tip: '💡 Dica para a Apresentação: Altere o status de um operador ao vivo e mostre a cor do badge mudando e o bloqueio automático nas máquinas.'
    },
    {
      id: 'timesheet',
      section: 'operador',
      icon: Clock,
      badge: 'Etapa 3 de 9 • Rastreamento Diário',
      title: '⏱️ Linha do Tempo & Timesheet Diário',
      description: 'Registro de tempo 100% automático por período. A cada troca de atividade ou início de almoço, o sistema encerra o tempo anterior, calcula a duração exata e vincula opcionalmente à Ordem de Serviço (Kanban).',
      tip: '💡 Dica para a Apresentação: Destaque o rastreio completo do dia do colaborador com cálculo automático de horas gastas em cada trabalho.'
    },
    {
      id: 'encarregado',
      section: 'encarregado',
      icon: HardHat,
      badge: 'Etapa 4 de 9 • Gestão de Produção',
      title: '📋 Quadro Kanban de Ordens de Serviço (O.S.)',
      description: 'Painel Kanban interativo para gerenciar o fluxo da fábrica (A Fazer / Em Produção / Concluído). Permite direcionar trabalhos para Máquinas CNC, Laser, Vácuo, Serviços Externos e Outros Setores com prazos e prioridades.',
      tip: '💡 Dica para a Apresentação: Mostre como a O.S. avança automaticamente quando o operador inicia ou conclui um trabalho.'
    },
    {
      id: 'historico',
      section: 'jobs',
      icon: Layers,
      badge: 'Etapa 5 de 9 • Rastreabilidade & PDF',
      title: '📊 Histórico de Produção & Relatório PDF em 6 Páginas',
      description: 'Registro histórico de todas as peças cortadas com cálculo de área em m², duração e custo de matéria-prima. Gera um Relatório PDF Profissional de 6 páginas com alto contraste (Resumo por Projeto, Manutenção, Peças e Timesheet da Equipe).',
      tip: '💡 Dica para a Apresentação: Abra a opção "Exportar PDF" para demonstrar o relatório completo gerado em segundos.'
    },
    {
      id: 'graficos',
      section: 'charts',
      icon: BarChart2,
      badge: 'Etapa 6 de 9 • Eficiência & OEE',
      title: '📈 Gráficos de Produtividade & Métricas OEE',
      description: 'Análise de eficiência operacional baseada nos índices globais OEE (Disponibilidade, Desempenho e Qualidade). Gráficos de uso por máquina, tempo estimado vs. tempo real e consumo mensal de chapas.',
      tip: '💡 Dica para a Apresentação: Explique como os gráficos ajudam a identificar máquinas ociosas e otimizar o ritmo de produção.'
    },
    {
      id: 'materiais',
      section: 'materials',
      icon: Package,
      badge: 'Etapa 7 de 9 • Gestão de Custos',
      title: '📦 Cadastro de Materiais & Calculadora de Insumos',
      description: 'Cadastre o custo por m² de chapas (MDF, Acrílico, ACM, PVC, Inox, Isopor). O sistema identifica o material pelo nome do projeto e calcula o custo em Reais (R$) consumido por peça.',
      tip: '💡 Dica para a Apresentação: Mostre o valor exato de matéria-prima economizado ao evitar refugos e perdas de estoque.'
    },
    {
      id: 'manutencao',
      section: 'maintenance',
      icon: Wrench,
      badge: 'Etapa 8 de 9 • Conservação & Falhas',
      title: '🛠️ Manutenção Preventiva, Horímetro & Ocorrências',
      description: 'Controle de horímetro, trocas de fluido/lentes, lubrificação de guias e agendamento de revisões. Conta com formulário de Reporte de Falhas para que o operador notifique o encarregado imediatamente.',
      tip: '💡 Dica para a Apresentação: Evite paradas não planejadas e garanta maior vida útil aos equipamentos da fábrica.'
    },
    {
      id: 'settings',
      section: 'settings',
      icon: Settings,
      badge: 'Etapa 9 de 9 • Controle de Acesso',
      title: '⚙️ Permissões por Perfil (Gerente, Encarregado, Operador)',
      description: 'Controle estrito de acesso e permissões de telas. O perfil Operador tem visão exclusiva do terminal de operação, enquanto Gerentes e Encarregados possuem acesso total a custos, relatórios e Kanban.',
      tip: '💡 Dica para a Apresentação: Demonstre a segurança de dados e a facilidade de configurar tablets dedicados ao chão de fábrica.'
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
