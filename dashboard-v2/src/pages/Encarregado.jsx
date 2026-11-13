import React, { Suspense, useState } from 'react';
import {
  LayoutGrid, Calendar, Columns3, CheckSquare2, Package, TrendingUp,
  FileCode, Box, ClipboardList, FolderSync, Layers
} from 'lucide-react';
import { DAYS } from '../components/encarregado/encarregadoConstants';
import { lazyNamed } from '../utils/lazyNamed';

const ConversorGcodeDxf = lazyNamed(() => import('../components/ConversorGcodeDxf'), 'ConversorGcodeDxf');
const GeradorLetraCaixa3D = lazyNamed(() => import('../components/GeradorLetraCaixa3D'), 'GeradorLetraCaixa3D');
const GeradorFichaTecnica = lazyNamed(() => import('../components/GeradorFichaTecnica'), 'GeradorFichaTecnica');
const ControlePastasOficina = lazyNamed(() => import('../components/ControlePastasOficina'), 'ControlePastasOficina');
const PipelineArquivosProducao = lazyNamed(() => import('../components/PipelineArquivosProducao'), 'PipelineArquivosProducao');
const DashboardSemanal = lazyNamed(() => import('../components/encarregado/DashboardSemanal'), 'DashboardSemanal');
const RotinaSemanal = lazyNamed(() => import('../components/encarregado/RotinaSemanal'), 'RotinaSemanal');
const PainelKanban = lazyNamed(() => import('../components/encarregado/PainelKanban'), 'PainelKanban');
const ChecklistsDiarios = lazyNamed(() => import('../components/encarregado/ChecklistsDiarios'), 'ChecklistsDiarios');
const ControleEstoque = lazyNamed(() => import('../components/encarregado/ControleEstoque'), 'ControleEstoque');
const CicloPOP = lazyNamed(() => import('../components/encarregado/CicloPOP'), 'CicloPOP');

const NAV_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard Semanal', icon: LayoutGrid, group: 'Visão Geral' },
  { id: 'rotina', label: 'Rotina Semanal', icon: Calendar, group: 'Visão Geral' },
  { id: 'kanban', label: 'Painel Kanban', icon: Columns3, group: 'Produção' },
  { id: 'pipeline_arquivos', label: 'Pipeline de Arquivos & Usinagem', icon: Layers, group: 'Produção' },
  { id: 'ficha_tecnica', label: 'Ficha Técnica & Checklist', icon: ClipboardList, group: 'Produção' },
  { id: 'liberacao_oficina', label: 'Controle de Pastas (3 - OFICINA)', icon: FolderSync, group: 'Produção' },
  { id: 'checklists', label: 'Checklists Diários', icon: CheckSquare2, group: 'Operação' },
  { id: 'estoque', label: 'Controle de Estoque', icon: Package, group: 'Operação' },
  { id: 'kaizen', label: 'Ciclo POP / Kaizen', icon: TrendingUp, group: 'Melhoria' },
  { id: 'letra_caixa', label: 'Gerador Letra Caixa 3D', icon: Box, group: 'Ferramentas' },
  { id: 'gcode_dxf', label: 'Conversor G-Code ➔ DXF', icon: FileCode, group: 'Ferramentas' },
];

export function Encarregado({ jobs = [], routers = [], user = null }) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const today = new Date();
  const dayName = DAYS[today.getDay()];

  const groups = [...new Set(NAV_SECTIONS.map(s => s.group))];

  const renderSection = () => {
    switch (activeTab) {
      case 'dashboard':     return <DashboardSemanal jobs={jobs} />;
      case 'rotina':        return <RotinaSemanal />;
      case 'kanban':            return <PainelKanban jobs={jobs} />;
      case 'pipeline_arquivos': return <PipelineArquivosProducao jobs={jobs} routers={routers} user={user} />;
      case 'ficha_tecnica':     return <GeradorFichaTecnica jobs={jobs} routers={routers} />;
      case 'liberacao_oficina': return <ControlePastasOficina />;
      case 'checklists':        return <ChecklistsDiarios />;
      case 'estoque':     return <ControleEstoque />;
      case 'kaizen':      return <CicloPOP />;
      case 'letra_caixa': return <GeradorLetraCaixa3D />;
      case 'gcode_dxf':   return <ConversorGcodeDxf />;
      default:            return <DashboardSemanal jobs={jobs} />;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      {/* Mobile Header / Navigation Bar */}
      <div className="md:hidden bg-slate-100 dark:bg-black/40 border-b border-slate-200 dark:border-white/5 p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <div>
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-500 dark:text-orange-400">Planner Operacional</p>
            <h2 className="font-black text-slate-900 dark:text-white text-sm">Painel do <span className="text-orange-500 dark:text-orange-400">Encarregado</span></h2>
          </div>
          <div className="px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 dark:bg-orange-400 animate-pulse"></span>
            <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">{dayName}-feira</span>
          </div>
        </div>

        {/* Horizontal Nav Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 pt-1">
          {NAV_SECTIONS.map(s => {
            const Icon = s.icon;
            const active = activeTab === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                  active 
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
                    : 'bg-white dark:bg-white/5 text-slate-600 dark:text-text-muted hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-transparent'
                }`}
              >
                <Icon size={14} className="shrink-0" />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mini sidebar interna (Desktop Only) */}
      <aside className="hidden md:flex w-60 flex-shrink-0 bg-slate-100/90 dark:bg-black/30 border-r border-slate-200 dark:border-white/5 flex-col overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-white/5">
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-orange-500 dark:text-orange-400 mb-1">Planner Operacional</p>
          <h2 className="font-black text-slate-900 dark:text-white text-lg leading-tight">Painel do <span className="text-orange-500 dark:text-orange-400">Encarregado</span></h2>
        </div>

        {/* Dia atual */}
        <div className="mx-4 my-3 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 dark:bg-orange-400 animate-pulse"></span>
          <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{dayName}-feira</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 pb-4">
          {groups.map(group => (
            <div key={group} className="mb-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-white/20 px-3 py-2">{group}</p>
              {NAV_SECTIONS.filter(s => s.group === group).map(s => {
                const Icon = s.icon;
                const active = activeTab === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveTab(s.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold mb-0.5 transition-all cursor-pointer ${
                      active 
                        ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400 font-bold border-l-2 border-orange-500' 
                        : 'text-slate-600 dark:text-text-muted hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <span className="text-xs leading-tight">{s.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* KPIs Sidebar */}
        <div className="m-4 p-4 bg-white/80 dark:bg-white/[0.03] rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-text-muted mb-3">Progresso da Semana</p>
          {[
            { label: 'OS Entregues', val: 87 },
            { label: 'Qualidade', val: 96 },
            { label: 'Prazo', val: 92 },
          ].map(k => (
            <div key={k.label} className="mb-3 last:mb-0">
              <div className="flex justify-between text-[10px] mb-1">
                <span className="text-slate-600 dark:text-text-muted">{k.label}</span>
                <span className="font-black text-slate-900 dark:text-white">{k.val}%</span>
              </div>
              <div className="h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full" style={{ width: `${k.val}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Conteúdo */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        <Suspense fallback={
          <div className="h-64 flex items-center justify-center text-xs font-bold uppercase tracking-widest text-orange-400">
            Carregando módulo do encarregado...
          </div>
        }>
          {renderSection()}
        </Suspense>
      </main>
    </div>
  );
}
