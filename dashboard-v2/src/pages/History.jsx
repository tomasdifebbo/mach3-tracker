import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { 
  Filter, 
  Download, 
  Trash2, 
  ChevronDown,
  Search,
  Calendar,
  Layers,
  FileText,
  FileDown,
  Check,
  X,
  PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { generateProductionReport } from '../utils/generateReport';
import { calculateInsumo } from '../utils/insumoCalculator';

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const formatTime = (iso) => iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-';
const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '-';

export function History({ jobs = [], materials = [], onRefresh, user }) {
  const costPerHour = user?.settings?.costPerHour || 50;
  const userCompanyRole = localStorage.getItem('mach3_device_role') || user?.company_role || 'gerente';
  const canEditOperator = userCompanyRole === 'gerente' || userCompanyRole === 'encarregado' || user?.role === 'admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [showPdfMenu, setShowPdfMenu] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const pdfMenuRef = useRef(null);
  const [editingJobId, setEditingJobId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  
  // Operator & Quantity Editing States
  const [operatorsList, setOperatorsList] = useState([]);
  const [editingOperatorJobId, setEditingOperatorJobId] = useState(null);
  const [customOperatorValue, setCustomOperatorValue] = useState('');
  const [isCustomOperatorInput, setIsCustomOperatorInput] = useState(false);
  const [editingQtyJobId, setEditingQtyJobId] = useState(null);
  const [editingQtyValue, setEditingQtyValue] = useState('1');

  useEffect(() => {
    const fetchOperators = async () => {
      try {
        const list = await api.getOperators();
        if (Array.isArray(list)) setOperatorsList(list);
      } catch (err) {
        console.error('Failed to load operators list:', err);
      }
    };
    fetchOperators();
  }, []);

  const handleUpdateProjectName = async (job, newName) => {
    try {
      const targetIds = job.ids || [job.id];
      for (const id of targetIds) {
        await api.patch(`/jobs/${id}`, { folder: newName });
      }
      setEditingJobId(null);
      onRefresh();
    } catch (err) {
      alert('Erro ao atualizar nome do projeto');
    }
  };

  const handleUpdateOperatorName = async (job, newOperatorName) => {
    try {
      const targetIds = job.ids || [job.id];
      for (const id of targetIds) {
        await api.patch(`/jobs/${id}`, { operator_name: newOperatorName });
      }
      setEditingOperatorJobId(null);
      setIsCustomOperatorInput(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Erro ao atualizar operador do job');
    }
  };

  const handleUpdateQuantity = async (job, newQuantity) => {
    try {
      const qtyNum = parseInt(newQuantity);
      if (isNaN(qtyNum) || qtyNum < 1) return;
      const targetIds = job.ids || [job.id];
      for (const id of targetIds) {
        await api.patch(`/jobs/${id}`, { quantity: qtyNum });
      }
      setEditingQtyJobId(null);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Erro ao atualizar quantidade do job');
    }
  };

  // Close PDF menu on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (pdfMenuRef.current && !pdfMenuRef.current.contains(e.target)) {
        setShowPdfMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportPdf = async (filterType) => {
    setExportingPdf(true);
    setShowPdfMenu(false);
    try {
      const routerStatusLog = await api.getRouterStatusLog();
      const maintenanceSchedule = await api.getMaintenance();
      const operators = await api.getOperators();
      const operatorTimeLogs = await api.getOperatorTimeLogs();
      generateProductionReport({ 
        jobs, 
        user, 
        filterType, 
        routerStatusLog, 
        maintenanceSchedule, 
        operators: Array.isArray(operators) ? operators : [],
        operatorTimeLogs: Array.isArray(operatorTimeLogs) ? operatorTimeLogs : []
      });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar PDF: ' + err.message);
    }
    setExportingPdf(false);
  };
  
  // Helper to group jobs by File + Folder + Day
  const consolidateJobs = (jobList) => {
    const groups = jobList.reduce((acc, j) => {
      const dateKey = j.start_time ? new Date(j.start_time).toISOString().split('T')[0] : 'und';
      const key = `${j.file_name}-${j.folder}-${dateKey}`;
      
      if (!acc[key]) {
        acc[key] = { 
          ...j, 
          duration_minutes: 0, 
          count: 0, 
          ids: [],
          isSomeActive: false
        };
      }
      
      const dur = j.duration_minutes || (j.end_time ? (new Date(j.end_time) - new Date(j.start_time)) / 60000 : 0);
      acc[key].duration_minutes += Math.max(0, dur);
      acc[key].count += 1;
      acc[key].ids.push(j.id);
      if (!j.end_time) acc[key].isSomeActive = true;
      
      // Keep the most recent data for display
      if (new Date(j.start_time) > new Date(acc[key].start_time)) {
        acc[key].id = j.id;
        acc[key].start_time = j.start_time;
        acc[key].end_time = j.end_time;
      }
      
      return acc;
    }, {});
    
    return Object.values(groups).sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
  };
  const [selectedRouter, setSelectedRouter] = useState('all');
  const [selectedDateRange, setSelectedDateRange] = useState('all');
  const [selectedOperator, setSelectedOperator] = useState('all');
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const availableRouters = Array.from(new Set(jobs.map(j => j.router_name).filter(Boolean)));
  const availableOperators = Array.from(new Set(jobs.map(j => j.operator_name).filter(Boolean)));

  const activeFilterCount = (selectedRouter !== 'all' ? 1 : 0) + 
                            (selectedDateRange !== 'all' ? 1 : 0) + 
                            (selectedOperator !== 'all' ? 1 : 0) + 
                            (searchTerm.trim() ? 1 : 0);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedRouter('all');
    setSelectedDateRange('all');
    setSelectedOperator('all');
  };

  const filteredJobs = consolidateJobs(jobs).filter(j => {
    const matchesText = !searchTerm || 
      j.file_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.folder?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRouter = selectedRouter === 'all' || 
      (j.router_name && j.router_name.toLowerCase().includes(selectedRouter.toLowerCase()));

    const matchesOperator = selectedOperator === 'all' || 
      (j.operator_name && j.operator_name.toLowerCase() === selectedOperator.toLowerCase());

    let matchesDate = true;
    if (selectedDateRange !== 'all' && j.start_time) {
      const jobDate = new Date(j.start_time);
      const now = new Date();
      if (selectedDateRange === 'today') {
        matchesDate = jobDate.toDateString() === now.toDateString();
      } else if (selectedDateRange === '7days') {
        const diffDays = (now - jobDate) / (1000 * 3600 * 24);
        matchesDate = diffDays <= 7;
      } else if (selectedDateRange === '30days') {
        const diffDays = (now - jobDate) / (1000 * 3600 * 24);
        matchesDate = diffDays <= 30;
      }
    }

    return matchesText && matchesRouter && matchesOperator && matchesDate;
  });

  const handleExportCSV = () => {
    const headers = ['ID', 'Arquivo', 'Projeto', 'Router', 'Operador', 'Quantidade', 'Inicio', 'Fim', 'Duracao (min)', 'Material', 'm2 Utilizado', 'Custo (R$)', 'Data'];
    const rows = filteredJobs.map(j => {
      const mat = materials.find(m => m.id === j.material_id);
      const ins = mat ? calculateInsumo({
        durationMinutes: j.duration_minutes || 0,
        pricePerM2: mat.price || 0,
        maxXMm: j.max_x,
        maxYMm: j.max_y,
        boundingAreaM2: j.bounding_area_m2,
        sheetWidthMm: mat.sheet_width_mm,
        sheetHeightMm: mat.sheet_height_mm
      }) : null;
      return [
        j.id,
        j.file_name,
        j.folder?.split('|').pop()?.split('\\').pop() || '-',
        j.router_name || 'Central',
        j.operator_name || 'Desconhecido',
        j.quantity || 1,
        formatTime(j.start_time),
        j.end_time ? formatTime(j.end_time) : 'Ativo',
        (j.duration_minutes || 0).toFixed(2),
        j.material_name || '-',
        ins ? ins.areaM2.toFixed(4) : '-',
        (((j.duration_minutes || 0) / 60 * costPerHour) + (j.material_price || 0)).toFixed(2),
        formatDate(j.start_time)
      ];
    });

    const escapeCSV = (val) => {
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + headers.join(",") + "\n"
      + rows.map(e => e.map(escapeCSV).join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `relatorio_mach3_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = async (job) => {
    setDeletingId(job.id);
    try {
      // If consolidated, delete all IDs in the group
      const targetIds = job.ids || [job.id];
      for (const id of targetIds) {
        await api.deleteJob(id);
      }
      onRefresh();
      setConfirmDeleteId(null);
    } catch (err) {
      alert('Erro ao excluir jobs');
    }
    setDeletingId(null);
  };

  const handleUpdateMaterial = async (job, mat) => {
    try {
      let payload = {
        material_id: null,
        material_name: null,
        material_price: 0
      };

      if (mat) {
        const insumo = calculateInsumo({
          durationMinutes: job.duration_minutes || 0,
          pricePerM2: mat.price || 0,
          maxXMm: job.max_x,
          maxYMm: job.max_y,
          boundingAreaM2: job.bounding_area_m2,
          sheetWidthMm: mat.sheet_width_mm,
          sheetHeightMm: mat.sheet_height_mm
        });

        payload = {
          material_id: mat.id,
          material_name: mat.name,
          material_price: insumo.totalCost
        };
      }

      // Update all IDs if consolidated
      const targetIds = job.ids || [job.id];
      for (const id of targetIds) {
        await api.updateJobMaterial(id, payload);
      }
      setActiveDropdown(null);
      onRefresh();
    } catch (err) {
      alert('Erro ao atualizar material');
    }
  };

  const handleCreateKanbanFromJob = async (job) => {
    try {
      await api.post('/kanban', {
        title: job.file_name,
        machine: job.router_name || 'Router CNC',
        operator: job.operator_name || 'Operador',
        priority: 'alta',
        column_id: 'doing',
        date: new Date().toISOString().split('T')[0]
      });
      alert(`Serviço "${job.file_name}" adicionado com sucesso como Ordem de Serviço no Kanban!`);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert('Erro ao criar O.S. a partir do log: ' + err.message);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-4 md:space-y-6">
      {/* Filters Bar */}
      <div className="space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 glass p-4 rounded-2xl relative z-10">
          <div className="flex items-center gap-2 md:gap-4 flex-1 w-full md:min-w-[300px]">
            <div className="flex items-center gap-2 bg-white/5 border border-border px-4 py-2 rounded-xl focus-within:border-accent-cyan/50 flex-1">
              <Search size={18} className="text-text-muted" />
              <input 
                type="text" 
                placeholder="Filtrar por nome do arquivo ou projeto..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-text-muted"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="text-text-muted hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>

            <button 
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={clsx(
                "flex items-center gap-2 px-3.5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                showFilterPanel || activeFilterCount > 0
                  ? "bg-accent-cyan/20 border-accent-cyan text-accent-cyan shadow-lg shadow-accent-cyan/10"
                  : "bg-white/5 border-border text-text-muted hover:text-white"
              )}
            >
              <Filter size={18} />
              <span className="hidden sm:inline">Filtros</span>
              {activeFilterCount > 0 && (
                <span className="bg-accent-cyan text-black text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 md:gap-3 justify-between w-full md:w-auto">
            <button 
              onClick={handleExportCSV}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2 md:py-2.5 bg-white/5 border border-border text-white font-black uppercase tracking-widest text-[10px] md:text-[11px] rounded-xl hover:bg-white/10 hover:scale-105 active:scale-95 transition-all"
            >
              <Download size={16} /> CSV
            </button>
            <button 
              onClick={() => handleExportPdf('all')}
              disabled={exportingPdf}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-3 md:px-5 py-2 md:py-2.5 bg-gradient-to-r from-accent-blue to-accent-cyan text-white font-black uppercase tracking-widest text-[10px] md:text-[11px] rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent-cyan/20 disabled:opacity-50"
            >
              <FileDown size={16} />
              {exportingPdf ? 'Gerando...' : 'Exportar PDF'}
            </button>
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {showFilterPanel && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass p-4 rounded-2xl border border-accent-cyan/30 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end animate-in fade-in duration-200"
          >
            {/* Filter 1: Machine / Router */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-accent-cyan flex items-center gap-1.5">
                <Layers size={12} /> Máquina / Router
              </label>
              <select
                value={selectedRouter}
                onChange={(e) => setSelectedRouter(e.target.value)}
                className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-accent-cyan cursor-pointer"
              >
                <option value="all">Todas as Máquinas</option>
                {availableRouters.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Filter 2: Date Range */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-accent-cyan flex items-center gap-1.5">
                <Calendar size={12} /> Período de Data
              </label>
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-accent-cyan cursor-pointer"
              >
                <option value="all">Todo o Histórico</option>
                <option value="today">Somente Hoje</option>
                <option value="7days">Últimos 7 Dias</option>
                <option value="30days">Últimos 30 Dias</option>
              </select>
            </div>

            {/* Filter 3: Operator */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-accent-cyan flex items-center gap-1.5">
                <FileText size={12} /> Operador
              </label>
              <select
                value={selectedOperator}
                onChange={(e) => setSelectedOperator(e.target.value)}
                className="w-full bg-slate-900 border border-border rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-accent-cyan cursor-pointer"
              >
                <option value="all">Todos os Operadores</option>
                {availableOperators.map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>

            {/* Reset Button */}
            <div>
              <button
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-white/5 border border-border hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400 text-text-muted rounded-xl text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >
                <X size={14} /> Limpar Filtros
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Table Container */}
      <div className="glass rounded-[40px] overflow-hidden border border-border/40 backdrop-blur-xl">
        <div className="overflow-x-auto overflow-y-visible">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-text-muted text-[10px] font-black uppercase tracking-[0.2em] border-b border-border">
                <th className="px-6 py-5">Arquivo</th>
                <th className="px-6 py-5">Projeto</th>
                <th className="px-6 py-5">Router</th>
                <th className="px-6 py-5">Operador</th>
                <th className="px-4 py-5 text-center">Qtd</th>
                <th className="px-6 py-5">Cronograma</th>
                <th className="px-6 py-5">Duração</th>
                <th className="px-6 py-5 text-center">Insumo</th>
                <th className="px-6 py-5 text-center">m²</th>
                <th className="px-6 py-5">Custo Estimado</th>
                <th className="px-6 py-5">Data</th>
                <th className="px-6 py-5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredJobs.map((job) => (
                <tr key={job.id} className="border-b border-border/40 hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-5 min-w-[250px] max-w-[400px]">
                    <div className="flex flex-col">
                      <div className="flex items-start gap-2 justify-between">
                        <span className="font-bold text-white text-sm break-all" title={job.file_name}>
                          {job.file_name}
                        </span>
                        {job.count > 1 && (
                          <span className="text-[10px] bg-accent-blue/20 text-accent-blue px-1.5 py-0.5 rounded-lg font-black tracking-tighter shrink-0 mt-0.5">
                            {job.count}X
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-text-muted opacity-50 font-black tracking-widest mt-1">
                        ID: #{job.id}
                      </div>
                    </div>
                  </td>
                    <td className="px-6 py-4">
                      {(() => {
                        let projectName = '';
                        if (job.folder && !job.folder.includes('\\') && !job.folder.includes('/')) {
                          projectName = job.folder;
                        } else {
                          const pathParts = (job.folder || 'Geral').replace(/^Router \d+ \| /, '').split('\\');
                          const routerIdx = pathParts.findIndex(p => p.toUpperCase() === 'ROUTER');
                          
                          if (routerIdx !== -1 && routerIdx < pathParts.length - 1) {
                            projectName = pathParts[routerIdx + 1];
                          } else {
                            const folderOnlyParts = pathParts.filter(p => !p.toUpperCase().includes('.TXT') && !p.toUpperCase().includes('.TAP') && !p.toUpperCase().includes('.NC'));
                            const cleanPath = folderOnlyParts.join('\\').replace(/^\\\\.*?\\/, '').replace(/^[A-Z]:\\/, '');
                            const parts = cleanPath.split('\\').filter(p => {
                              const up = p.toUpperCase();
                              const isGeneric = up.includes('TOMAS') || up.includes('ARQUIVOS') || up.includes('ROUTER') || 
                                                up.includes('ISOPOR') || up.includes('2024') || up.includes('2026') || 
                                                up === 'CNC' || up === 'PROGRAMA' || up === 'FILES';
                              return p && !isGeneric;
                            });
                            projectName = parts.length > 0 ? parts[0] : (folderOnlyParts.pop() || 'Produção Geral');
                          }
                        }
                        
                        const isEditing = editingJobId === job.id;
                        
                        if (isEditing) {
                          return (
                            <div className="flex items-center gap-1.5 min-w-[150px]">
                              <input
                                type="text"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                className="bg-black/50 border border-orange-500/40 rounded-xl px-2 py-1 text-xs text-white focus:outline-none focus:border-orange-500 w-full"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleUpdateProjectName(job, editingValue);
                                  } else if (e.key === 'Escape') {
                                    setEditingJobId(null);
                                  }
                                }}
                              />
                              <button 
                                onClick={() => handleUpdateProjectName(job, editingValue)}
                                className="p-1 hover:bg-white/10 rounded-lg text-accent-success transition-all cursor-pointer"
                                title="Salvar"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={() => setEditingJobId(null)}
                                className="p-1 hover:bg-white/10 rounded-lg text-accent-danger transition-all cursor-pointer"
                                title="Cancelar"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          );
                        }

                        return (
                          <div className="flex items-center gap-2 group/proj min-w-[120px]">
                            <span className="text-[10px] font-black uppercase tracking-widest text-accent-cyan bg-accent-cyan/10 px-2 py-1 rounded border border-accent-cyan/20 block whitespace-normal" title={projectName}>
                              {projectName}
                            </span>
                            <button
                              onClick={() => {
                                setEditingJobId(job.id);
                                setEditingValue(projectName);
                              }}
                              className="p-1 text-[10px] text-text-muted hover:text-white hover:bg-white/5 rounded-lg opacity-0 group-hover/proj:opacity-100 transition-all cursor-pointer animate-in fade-in duration-100"
                              title="Editar Projeto"
                            >
                              ✏️
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                  <td className="px-6 py-5">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-md border ${job.router_name?.includes('2') ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                      {job.router_name || 'Central'}
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    {canEditOperator && editingOperatorJobId === job.id ? (
                      <div className="flex items-center gap-1.5 min-w-[170px] relative z-20">
                        {!isCustomOperatorInput ? (
                          <select
                            value={job.operator_name || ''}
                            onChange={(e) => {
                              if (e.target.value === '__custom__') {
                                setIsCustomOperatorInput(true);
                                setCustomOperatorValue(job.operator_name || '');
                              } else {
                                handleUpdateOperatorName(job, e.target.value);
                              }
                            }}
                            className="bg-slate-900 border border-accent-cyan/60 rounded-xl px-2 py-1 text-xs text-white focus:outline-none focus:border-accent-cyan w-full cursor-pointer shadow-lg shadow-black/50"
                            autoFocus
                          >
                            <option value="" disabled>Selecionar Operador...</option>
                            {operatorsList.map(op => (
                              <option key={op.id || op.name} value={op.name}>
                                {op.name} {op.shift ? `(${op.shift})` : ''}
                              </option>
                            ))}
                            {job.operator_name && !operatorsList.some(o => o.name === job.operator_name) && (
                              <option value={job.operator_name}>{job.operator_name}</option>
                            )}
                            <option value="__custom__">✏️ Outro (Digitar Nome)...</option>
                          </select>
                        ) : (
                          <div className="flex items-center gap-1 w-full">
                            <input
                              type="text"
                              value={customOperatorValue}
                              onChange={(e) => setCustomOperatorValue(e.target.value)}
                              placeholder="Nome do Operador"
                              className="bg-black/70 border border-accent-cyan rounded-xl px-2 py-1 text-xs text-white focus:outline-none w-full"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleUpdateOperatorName(job, customOperatorValue);
                                } else if (e.key === 'Escape') {
                                  setEditingOperatorJobId(null);
                                  setIsCustomOperatorInput(false);
                                }
                              }}
                            />
                            <button
                              onClick={() => handleUpdateOperatorName(job, customOperatorValue)}
                              className="p-1 hover:bg-white/10 rounded-lg text-accent-success transition-all cursor-pointer shrink-0"
                              title="Salvar Operador"
                            >
                              <Check size={14} />
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setEditingOperatorJobId(null);
                            setIsCustomOperatorInput(false);
                          }}
                          className="p-1 hover:bg-white/10 rounded-lg text-text-muted hover:text-white transition-all cursor-pointer shrink-0"
                          title="Cancelar"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group/op min-w-[130px]">
                        <span 
                          onClick={() => {
                            if (canEditOperator) {
                              setEditingOperatorJobId(job.id);
                              setIsCustomOperatorInput(false);
                            }
                          }}
                          className={clsx(
                            "text-[10px] font-bold text-accent-cyan bg-accent-cyan/10 px-2.5 py-1 rounded-full border border-accent-cyan/20 flex items-center gap-1.5 w-fit whitespace-nowrap transition-all",
                            canEditOperator && "cursor-pointer hover:bg-accent-cyan/20 hover:border-accent-cyan/40"
                          )}
                          title={canEditOperator ? "Clique para alterar o operador" : undefined}
                        >
                          👤 {job.operator_name || 'Desconhecido'}
                        </span>
                        {canEditOperator && (
                          <button
                            onClick={() => {
                              setEditingOperatorJobId(job.id);
                              setIsCustomOperatorInput(false);
                            }}
                            className="p-1 text-[10px] text-text-muted hover:text-white hover:bg-white/5 rounded-lg opacity-0 group-hover/op:opacity-100 transition-all cursor-pointer"
                            title="Alterar Operador"
                          >
                            ✏️
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-5 text-center">
                    {editingQtyJobId === job.id ? (
                      <div className="flex items-center justify-center gap-1 min-w-[90px]">
                        <input
                          type="number"
                          min="1"
                          value={editingQtyValue}
                          onChange={(e) => setEditingQtyValue(e.target.value)}
                          className="w-16 bg-slate-900 border border-orange-500 rounded-lg px-2 py-1 text-xs font-bold text-white text-center outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleUpdateQuantity(job, editingQtyValue);
                            } else if (e.key === 'Escape') {
                              setEditingQtyJobId(null);
                            }
                          }}
                        />
                        <button
                          onClick={() => handleUpdateQuantity(job, editingQtyValue)}
                          className="p-1 hover:bg-white/10 rounded text-accent-success cursor-pointer"
                          title="Salvar Quantidade"
                        >
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-1">
                        <span 
                          onClick={() => {
                            if (canEditOperator || job.router_name?.toLowerCase().includes('vacuo') || job.router_name?.toLowerCase().includes('vácuo')) {
                              setEditingQtyJobId(job.id);
                              setEditingQtyValue(String(job.quantity || 1));
                            }
                          }}
                          className={clsx(
                            "text-xs font-black px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 cursor-pointer",
                            (job.router_name?.toLowerCase().includes('vacuo') || job.router_name?.toLowerCase().includes('vácuo'))
                              ? "bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30"
                              : "bg-white/5 text-white border-white/10 hover:border-white/20"
                          )}
                          title="Clique para ajustar quantidade (Alimentação Manual/Encarregado)"
                        >
                          {(job.router_name?.toLowerCase().includes('vacuo') || job.router_name?.toLowerCase().includes('vácuo')) && '📦 '}
                          {job.quantity || 1} UN
                        </span>
                        <button
                          onClick={() => {
                            setEditingQtyJobId(job.id);
                            setEditingQtyValue(String(job.quantity || 1));
                          }}
                          className="p-1 text-[10px] text-text-muted hover:text-white rounded hover:bg-white/5 cursor-pointer"
                          title="Ajustar Quantidade"
                        >
                          ✏️
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-0.5 min-w-[100px]">
                      <span className="text-xs font-bold text-white/80">{formatTime(job.start_time)} {job.end_time && `→ ${formatTime(job.end_time)}`}</span>
                      {job.isSomeActive && <span className="text-[9px] text-accent-success font-black animate-pulse">EM ANDAMENTO</span>}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-xs font-mono font-black text-white bg-white/5 py-1 px-3 rounded-lg w-fit border border-white/5 shadow-inner">
                      {Math.floor(job.duration_minutes)} MIN
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center relative overflow-visible">
                    <div className="flex flex-col items-center gap-1">
                      <button 
                        onClick={() => setActiveDropdown(activeDropdown === job.id ? null : job.id)}
                        className="text-[10px] font-black uppercase tracking-widest py-1.5 px-3 rounded-xl border border-border bg-white/5 hover:border-accent-cyan transition-all text-text-muted hover:text-white flex items-center gap-2 mx-auto shadow-sm whitespace-nowrap"
                      >
                        {job.material_name || 'Vincular'} <ChevronDown size={12} className={activeDropdown === job.id ? "rotate-180 transition-transform" : "transition-transform"} />
                      </button>
                      {job.material_name && (
                        <span className="text-[9px] font-mono text-accent-cyan/80 font-bold bg-accent-cyan/10 px-2 py-0.5 rounded-md">
                          Insumo: {formatCurrency(job.material_price || 0)}
                        </span>
                      )}
                    </div>
                    
                    <AnimatePresence>
                      {activeDropdown === job.id && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                          className="absolute left-1/2 -translate-x-1/2 mt-2 w-52 glass border border-border rounded-2xl shadow-2xl z-[100] p-1.5"
                        >
                          <button 
                            onClick={() => handleUpdateMaterial(job, null)}
                            className="w-full text-left px-3 py-2 text-[10px] font-black uppercase tracking-widest text-text-muted hover:bg-white/5 hover:text-white rounded-lg transition-all"
                          >
                            × Sem Material
                          </button>
                          {materials.map(m => {
                            const ins = calculateInsumo({
                              durationMinutes: job.duration_minutes || 0,
                              pricePerM2: m.price || 0,
                              maxXMm: job.max_x,
                              maxYMm: job.max_y,
                              boundingAreaM2: job.bounding_area_m2,
                              sheetWidthMm: m.sheet_width_mm,
                              sheetHeightMm: m.sheet_height_mm
                            });
                            return (
                              <button 
                                key={m.id}
                                onClick={() => handleUpdateMaterial(job, m)}
                                className="w-full text-left px-3 py-2 text-xs font-bold text-white hover:bg-accent-cyan hover:text-black rounded-lg transition-all flex justify-between items-center group"
                              >
                                <span>{m.name}</span>
                                <span className="text-[9px] font-mono text-accent-cyan group-hover:text-black font-black">
                                  {ins.areaM2.toFixed(4)}m² ({formatCurrency(ins.totalCost)})
                                </span>
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </td>
                  <td className="px-6 py-5 text-center whitespace-nowrap">
                    {(() => {
                      const mat = materials.find(m => m.id === job.material_id);
                      if (!mat) return <span className="text-text-muted text-xs">-</span>;
                      const ins = calculateInsumo({
                        durationMinutes: job.duration_minutes || 0,
                        pricePerM2: mat.price || 0,
                        maxXMm: job.max_x,
                        maxYMm: job.max_y,
                        boundingAreaM2: job.bounding_area_m2,
                        sheetWidthMm: mat.sheet_width_mm,
                        sheetHeightMm: mat.sheet_height_mm
                      });
                      return (
                        <span className="text-sm font-bold text-accent-cyan">
                          {ins.areaM2.toFixed(4)} <span className="text-[10px] text-text-muted">m²</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-5 font-black text-white text-sm tracking-tighter whitespace-nowrap">
                    {formatCurrency(((job.duration_minutes || 0) / 60 * costPerHour) + (job.material_price || 0))}
                  </td>
                  <td className="px-6 py-5">
                    <div className="text-[10px] text-text-muted font-black tracking-widest uppercase text-accent-cyan whitespace-nowrap">
                       {formatDate(job.start_time)}
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                       {confirmDeleteId === job.id ? (
                        <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2">
                          <button 
                            onClick={() => handleDelete(job)}
                            disabled={deletingId === job.id}
                            className="p-2 bg-accent-danger text-white rounded-xl hover:bg-accent-danger/80 transition-all shadow-lg shadow-accent-danger/20"
                            title="Confirmar exclusão (Todos repetidos)"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(null)}
                            className="p-2 bg-white/5 text-text-muted rounded-xl hover:text-white transition-all underline text-[10px] font-bold"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCreateKanbanFromJob(job)}
                            className="px-2.5 py-1.5 bg-accent-cyan/10 hover:bg-accent-cyan/20 border border-accent-cyan/30 text-accent-cyan rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            title="Adicionar este serviço do log como Ordem de Serviço no Kanban"
                          >
                            <PlusCircle size={13} />
                            <span>Gerar O.S.</span>
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(job.id)}
                            className="p-2.5 bg-white/5 border border-border text-text-muted hover:text-white hover:bg-accent-danger/20 hover:border-accent-danger/40 transition-all rounded-xl shadow-lg"
                            title="Excluir do histórico"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredJobs.length === 0 && (
            <div className="py-24 text-center space-y-6">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto">
                <Layers size={40} className="text-text-muted opacity-20" />
              </div>
              <div className="text-text-muted font-bold text-lg">Nenhum registro encontrado</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
