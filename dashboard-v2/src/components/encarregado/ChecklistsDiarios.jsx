import React, { useState } from 'react';
import { SectionHeader } from './EncarregadoShared';
import { MACHINE_CHECKLISTS } from './encarregadoConstants';
import { ChecklistMaquina } from './ChecklistMaquina';
import { OcorrenciasPanel } from './OcorrenciasPanel';

export function ChecklistsDiarios() {
  const [activeTab, setActiveTab] = useState('router_central');
  const tabs = Object.entries(MACHINE_CHECKLISTS);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <SectionHeader label="Operação Diária" title="Checklists de Maquinário" />

      <div className="flex gap-2 flex-wrap">
        {tabs.map(([key, data]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${activeTab === key ? 'bg-orange-500 text-white border-orange-500' : 'glass border-white/5 text-text-muted hover:text-white hover:border-orange-500/50'}`}
          >
            {data.label}
          </button>
        ))}
      </div>

      <ChecklistMaquina key={activeTab} data={MACHINE_CHECKLISTS[activeTab]} machineKey={activeTab} />

      <OcorrenciasPanel />
    </div>
  );
}
