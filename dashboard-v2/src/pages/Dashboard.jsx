import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Activity,
  Play,
  FileText,
  Wrench,
  Power,
  WifiOff,
  CheckCircle2
} from 'lucide-react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  ArcElement,
  PointElement,
  LineElement
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import { motion } from 'framer-motion';
import { LinkProjectModal } from '../components/LinkProjectModal';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
  LineElement
);

// Helper for Duration
const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined) return "00:00:00";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.floor((minutes * 60) % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function Dashboard({ jobs = [], user, routers = [], onRefresh }) {
  const [elapsed, setElapsed] = useState(0);
  const [togglingId, setTogglingId] = useState(null);
  const [selectedLinkJob, setSelectedLinkJob] = useState(null);
  const [selectedLinkRouter, setSelectedLinkRouter] = useState('');
  const activeJobs = jobs.filter(j => !j.end_time);
  
  // Live Timer Effect for multiple jobs
  useEffect(() => {
    if (activeJobs.length === 0) {
      setElapsed(0);
      return;
    }
    
    const update = () => {
      // For simplicity, we track the elapsed time of the most recent active job for the main display
      // but in the UI we can show multiple trackers.
      const newestJob = [...activeJobs].sort((a, b) => new Date(b.start_time) - new Date(a.start_time))[0];
      const startDt = new Date(newestJob.start_time);
      const diffSec = Math.floor((Date.now() - startDt) / 1000);
      setElapsed(diffSec > 0 ? diffSec / 60 : 0);
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeJobs.length]);

  // Settings
  const costPerHour = user?.settings?.costPerHour || 50;
  const plannedHours = user?.settings?.plannedHours || 8;

  // Calculate Stats
  const totalMinutes = jobs.reduce((acc, j) => {
    const dur = j.duration_minutes || (j.end_time ? (new Date(j.end_time) - new Date(j.start_time)) / 60000 : 0);
    return acc + (dur > 0 ? dur : 0);
  }, 0);
  
  const totalCost = jobs.reduce((acc, j) => {
    const dur = j.duration_minutes || (j.end_time ? (new Date(j.end_time) - new Date(j.start_time)) / 60000 : 0);
    const machineCost = (dur / 60) * costPerHour;
    const matCost = j.material_price || 0;
    return acc + machineCost + matCost;
  }, 0);

  // Stats for Cards
  const now = new Date();
  const isToday = (isoStr) => {
    const d = new Date(isoStr);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  };
  const jobsToday = jobs.filter(j => isToday(j.start_time)).length;
  const minutesToday = jobs.filter(j => isToday(j.start_time)).reduce((acc, j) => acc + (j.duration_minutes || 0), 0);
  const oee = Math.min(100, (minutesToday / (plannedHours * 60)) * 100);

  const stats = [
    { label: 'Total de Jobs', value: jobs.length, icon: Users, color: 'text-accent-blue', trend: 'Total' },
    { label: 'Horas Totais', value: Math.floor(totalMinutes / 60) + 'h', icon: Clock, color: 'text-accent-cyan', trend: `${(totalMinutes/60).toFixed(1)}h` },
    { label: 'Produção Estimada', value: formatCurrency(totalCost), icon: DollarSign, color: 'text-accent-warning', trend: 'R$' },
    { label: 'OEE (Hoje)', value: oee.toFixed(1) + '%', icon: Activity, color: 'text-accent-success', trend: now.toLocaleDateString('pt-BR') },
  ];

  // Chart Data Preparation
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const chartData = last7Days.map(date => {
    const dayJobs = jobs.filter(j => j.start_time && j.start_time.startsWith(date));
    const dayMins = dayJobs.reduce((acc, j) => acc + (j.duration_minutes || 0), 0);
    return dayMins / 60;
  });
  
  // Group by filename AND project to avoid mixing identically named files from different projects
  const groupedJobs = jobs.reduce((acc, j) => {
    const name = j.file_name || 'Desconhecido';
    
    // Extract neat project name (skipping generic folders like ROUTER, ISOPOR, etc)
    // Extract project name from folder path
    // Aggressive project name extraction
    const pathParts = (j.folder || 'Geral').replace(/^Router \d+ \| /, '').split('\\');
    // Specialized Log Logic: Find the folder immediately AFTER 'router'
    const routerIdx = pathParts.findIndex(p => p.toUpperCase() === 'ROUTER');
    let projectName = '';
    
    if (routerIdx !== -1 && routerIdx < pathParts.length - 1) {
      projectName = pathParts[routerIdx + 1];
    } else {
      // Fallback for non-log paths (like Globotoy)
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
    
    const key = `${name}-${projectName}-${j.router_name || 'Central'}`;
    
    if (!acc[key]) {
      acc[key] = { 
        name, 
        projectName, 
        routerName: j.router_name || 'Central',
        count: 0, 
        totalMinutes: 0 
      };
    }
    const dur = j.duration_minutes || (j.end_time ? (new Date(j.end_time) - new Date(j.start_time)) / 60000 : 0);
    acc[key].count += 1;
    acc[key].totalMinutes += dur;
    return acc;
  }, {});
  
  const sortedGrouped = Object.values(groupedJobs).sort((a, b) => b.totalMinutes - a.totalMinutes).slice(0, 10);
  
  // Group by folder and sum duration
  const groupedFolders = jobs.reduce((acc, j) => {
    // Use the same intelligent project name extraction
    // Aggressive project name extraction
    const pathParts = (j.folder || 'Geral').replace(/^Router \d+ \| /, '').split('\\');
    const routerIdx = pathParts.findIndex(p => p.toUpperCase() === 'ROUTER');
    let projectName = '';
    
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
                 
    if (!acc[projectName]) {
      acc[projectName] = { name: projectName, count: 0, totalMinutes: 0 };
    }
    const dur = j.duration_minutes || (j.end_time ? (new Date(j.end_time) - new Date(j.start_time)) / 60000 : 0);
    acc[projectName].count += 1;
    acc[projectName].totalMinutes += dur;
    return acc;
  }, {});
  
  const sortedFolders = Object.values(groupedFolders).sort((a, b) => b.totalMinutes - a.totalMinutes).slice(0, 10);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
      {/* Active Jobs Banners */}
      <div className="space-y-4">
        {activeJobs.map(job => {
          const startDt = new Date(job.start_time);
          const elapsedMin = Math.max(0, (Date.now() - startDt) / 60000);
          const estMin = job.estimated_minutes;
          const hasEstimate = estMin && estMin > 0;
          const progress = hasEstimate ? Math.min(100, (elapsedMin / estMin) * 100) : null;
          const remaining = hasEstimate ? Math.max(0, estMin - elapsedMin) : null;
          const eta = hasEstimate ? new Date(startDt.getTime() + estMin * 60000) : null;
          const isNearEnd = progress !== null && progress >= 85;

          return (
          <motion.div 
            key={job.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-accent-cyan/10 border border-accent-cyan/30 rounded-2xl p-4 md:p-6 shadow-[0_0_30px_rgba(6,182,212,0.1)]"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4 md:gap-0">
              <div className="flex items-center gap-4 md:gap-6">
                <div className={`w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-xl flex items-center justify-center text-black ${isNearEnd ? 'bg-accent-success animate-pulse' : 'bg-accent-cyan animate-pulse'}`}>
                  <Play size={20} className="md:w-6 md:h-6" fill="currentColor" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-accent-cyan bg-accent-cyan/20 px-2 py-0.5 rounded">
                      {job.router_name || 'ROUTER'} - EM ANDAMENTO
                    </span>
                    <h3 className="text-lg font-bold text-white uppercase truncate max-w-xs">{job.file_name}</h3>
                  </div>
                  <p className="text-xs text-text-muted font-medium opacity-60 truncate max-w-[200px] sm:max-w-sm">{job.folder}</p>
                </div>
              </div>
              <div className="text-left md:text-right">
                <div className="text-2xl md:text-3xl font-mono font-bold text-accent-cyan tracking-tighter tabular-nums">
                   {formatDuration(elapsedMin)}
                </div>
                {hasEstimate && (
                  <div className="text-[10px] font-bold text-text-muted mt-1">
                    Estimado: {formatDuration(estMin)}
                  </div>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {hasEstimate && (
              <div className="mt-2 md:mt-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-1 sm:gap-0">
                  <span className={`text-xs font-bold ${isNearEnd ? 'text-accent-success' : 'text-accent-cyan'}`}>
                    {progress.toFixed(1)}% concluído
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-text-muted">
                    {remaining > 0 
                      ? `Faltam ${Math.floor(remaining)}min · ETA ${eta.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}` 
                      : '✅ Finalização prevista atingida!'
                    }
                  </span>
                </div>
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden relative">
                  <motion.div 
                    initial={{ width: 0 }} 
                    animate={{ width: `${Math.min(progress, 100)}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      isNearEnd 
                        ? 'bg-gradient-to-r from-accent-cyan to-accent-success shadow-[0_0_12px_rgba(16,185,129,0.5)]' 
                        : 'bg-gradient-to-r from-accent-blue to-accent-cyan shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                    }`}
                  />
                  {progress >= 100 && (
                    <div className="absolute inset-0 bg-accent-success/20 animate-pulse rounded-full" />
                  )}
                </div>
              </div>
            )}
          </motion.div>
          );
        })}
      </div>

      {/* Router Status Panel */}
      {routers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {routers.map(router => {
            const statusConfig = {
              active: { 
                label: 'ATIVA', 
                color: 'text-accent-success', 
                bg: 'bg-accent-success/10', 
                border: 'border-accent-success/30',
                glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]',
                icon: CheckCircle2,
                dot: 'bg-accent-success'
              },
              maintenance: { 
                label: 'EM MANUTENÇÃO', 
                color: 'text-amber-400', 
                bg: 'bg-amber-400/10', 
                border: 'border-amber-400/30',
                glow: 'shadow-[0_0_20px_rgba(251,191,36,0.1)]',
                icon: Wrench,
                dot: 'bg-amber-400'
              },
              offline: { 
                label: 'OFFLINE', 
                color: 'text-red-400', 
                bg: 'bg-red-400/10', 
                border: 'border-red-400/30',
                glow: 'shadow-[0_0_20px_rgba(248,113,113,0.1)]',
                icon: WifiOff,
                dot: 'bg-red-400'
              }
            };
            const cfg = statusConfig[router.status] || statusConfig.active;
            const StatusIcon = cfg.icon;
            const isActive = router.status === 'active';
            const routerActiveJob = activeJobs.find(j => {
              const rn = (j.router_name || '').toLowerCase();
              const name = router.name.toLowerCase();
              return rn === name || rn.includes(name) || name.includes(rn);
            });

            const handleToggle = async (newStatus) => {
              setTogglingId(router.id);
              try {
                const { api } = await import('../services/api');
                await api.updateRouterStatus(router.id, newStatus);
                if (onRefresh) onRefresh();
              } catch (err) {
                console.error('Erro ao atualizar status:', err);
              }
              setTogglingId(null);
            };

            return (
              <motion.div
                key={router.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`${cfg.bg} border ${cfg.border} rounded-2xl p-5 ${cfg.glow} transition-all`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center ${cfg.color}`}>
                      <StatusIcon size={20} className={router.status === 'maintenance' ? 'animate-[spin_3s_linear_infinite]' : ''} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">{router.name}</h4>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className={`w-2 h-2 rounded-full ${cfg.dot} ${isActive ? 'animate-pulse' : ''}`} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="text-[10px] font-medium text-text-muted mt-1 flex items-center gap-1">
                        <span>👷 Operador:</span>
                        <span className={`font-bold ${router.operator_name ? 'text-purple-300' : 'text-text-muted/60'}`}>
                          {router.operator_name || 'Livre'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {routerActiveJob && (
                    <div className="text-right flex flex-col items-end">
                      <div className="text-[9px] font-bold text-accent-cyan uppercase">Cortando</div>
                      <div className="text-[10px] font-bold text-white truncate max-w-[120px]">{routerActiveJob.file_name}</div>
                      <button 
                        onClick={() => {
                          setSelectedLinkJob(routerActiveJob);
                          setSelectedLinkRouter(router.name);
                        }} 
                        className="text-[9px] text-orange-400 hover:text-orange-300 font-bold underline mt-0.5"
                      >
                        ✏️ Vincular O.S.
                      </button>
                    </div>
                  )}
                </div>

                {/* Status Toggle Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggle('active')}
                    disabled={togglingId === router.id}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      router.status === 'active'
                        ? 'bg-accent-success/20 text-accent-success border border-accent-success/40'
                        : 'bg-white/5 text-text-muted border border-white/10 hover:bg-accent-success/10 hover:text-accent-success hover:border-accent-success/30'
                    }`}
                  >
                    <Power size={12} /> Ativa
                  </button>
                  <button
                    onClick={() => handleToggle('maintenance')}
                    disabled={togglingId === router.id}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      router.status === 'maintenance'
                        ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
                        : 'bg-white/5 text-text-muted border border-white/10 hover:bg-amber-400/10 hover:text-amber-400 hover:border-amber-400/30'
                    }`}
                  >
                    <Wrench size={12} /> Manutenção
                  </button>
                  <button
                    onClick={() => handleToggle('offline')}
                    disabled={togglingId === router.id}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      router.status === 'offline'
                        ? 'bg-red-400/20 text-red-400 border border-red-400/40'
                        : 'bg-white/5 text-text-muted border border-white/10 hover:bg-red-400/10 hover:text-red-400 hover:border-red-400/30'
                    }`}
                  >
                    <WifiOff size={12} /> Offline
                  </button>
                </div>

                {router.status_note && (
                  <div className={`mt-3 text-[10px] font-medium ${cfg.color} opacity-70 italic`}>
                    {router.status_note}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
        {stats.map((s, i) => (
          <motion.div 
            key={i}
            whileHover={{ y: -5 }}
            className="glass p-4 md:p-6 rounded-2xl group transition-all"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start gap-2 sm:gap-0 mb-3 md:mb-4">
              <div className={`p-2.5 md:p-3 rounded-xl bg-white/5 ${s.color} transition-colors group-hover:bg-white/10 group-hover:scale-110 duration-300`}>
                <s.icon className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-text-muted`}>
                {s.trend}
              </span>
            </div>
            <h4 className="text-xs md:text-sm text-text-muted font-medium mb-1">{s.label}</h4>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight">{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 glass p-4 md:p-8 rounded-3xl h-[300px] md:h-[400px]">
          <div className="flex items-center justify-between mb-4 md:mb-8">
            <h3 className="text-base md:text-lg font-bold">Produção (Últimos 7 dias)</h3>
            <div className="flex items-center gap-2 text-xs text-text-muted font-bold">
              <div className="w-3 h-3 bg-accent-cyan rounded-sm"></div> Horas Máquina
            </div>
          </div>
          <Bar 
            data={{
              labels: last7Days.map(d => d.split('-').slice(1).reverse().join('/')),
              datasets: [{
                label: 'Horas',
                data: chartData,
                backgroundColor: '#06b6d4',
                borderRadius: 8,
                barThickness: 24,
              }]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false }, ticks: { callback: v => v + 'h' } },
                x: { grid: { display: false }, border: { display: false } }
              },
              plugins: { legend: { display: false } }
            }}
          />
        </div>

        <div className="glass p-4 md:p-8 rounded-3xl h-[300px] md:h-[400px]">
          <h3 className="text-base md:text-lg font-bold mb-4 md:mb-8">Materiais Usados</h3>
          <div className="h-[200px] md:h-[250px] flex items-center justify-center">
            {jobs.some(j => j.material_name) ? (
              <Doughnut 
                data={{
                  labels: [...new Set(jobs.filter(j => j.material_name).map(j => j.material_name))].slice(0, 4),
                  datasets: [{
                    data: [...new Set(jobs.filter(j => j.material_name).map(j => j.material_name))].slice(0, 4).map(name => 
                      jobs.filter(j => j.material_name === name).length
                    ),
                    backgroundColor: ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b'],
                    borderWidth: 0,
                    hoverOffset: 20
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '75%',
                  plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 20, font: { weight: '600' } } } }
                }}
              />
            ) : (
              <div className="text-center text-text-muted text-sm opacity-50">Nenhum material <br/> atrelado aos jobs</div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-8">
        {/* Grouped Totals Table (Files) */}
        <div className="glass p-4 md:p-8 rounded-3xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4 md:mb-8">
            <h3 className="text-base md:text-lg font-bold">Resumo por Arquivo</h3>
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-tighter">Tempo Somado</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className="text-[10px] text-text-muted font-black uppercase tracking-widest border-b border-white/5">
                  <th className="px-4 pb-3">Nome do Arquivo</th>
                  <th className="px-4 pb-3">Projeto</th>
                  <th className="px-4 pb-3">Router</th>
                  <th className="px-4 pb-3 text-center">Repetições</th>
                  <th className="px-4 pb-3">Tempo Total Acumulado</th>
                  <th className="px-4 pb-3 text-right">Produtividade</th>
                </tr>
              </thead>
              <tbody>
                {sortedGrouped.map((item, idx) => {
                  const maxTime = Math.max(1, sortedGrouped[0].totalMinutes);
                  const percentage = (item.totalMinutes / maxTime) * 100;
                  return (
                    <tr key={idx} className="group hover:bg-white/5 transition-colors bg-white/5">
                      <td className="px-4 py-3 rounded-l-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center text-accent-blue shrink-0">
                             <FileText size={14} />
                          </div>
                          <span className="text-xs font-bold text-white truncate max-w-[180px]" title={item.name}>{item.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-accent-cyan bg-accent-cyan/10 px-2 py-1 rounded border border-accent-cyan/20 block min-w-[100px]" title={item.projectName}>
                          {item.projectName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${item.routerName?.includes('2') ? 'bg-purple-500/10 text-purple-400' : 'bg-orange-500/10 text-orange-400'}`}>
                          {item.routerName}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-text-muted text-center">
                        {item.count}x
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-accent-cyan whitespace-nowrap">
                        {Math.floor(item.totalMinutes / 60)}h {Math.round(item.totalMinutes % 60)}min
                      </td>
                      <td className="px-4 py-3 rounded-r-xl w-28">
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className="h-full bg-accent-blue" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grouped Totals Table (Folders) */}
        <div className="glass p-4 md:p-8 rounded-3xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-4 md:mb-8">
            <h3 className="text-base md:text-lg font-bold">Resumo por Pasta/Projeto</h3>
            <span className="text-[10px] text-text-muted font-bold uppercase tracking-tighter">Total por Pasta</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-y-2">
              <tbody>
                {sortedFolders.map((item, idx) => {
                  const maxTime = Math.max(1, sortedFolders[0].totalMinutes);
                  const percentage = (item.totalMinutes / maxTime) * 100;
                  return (
                    <tr key={idx} className="group hover:bg-white/5 transition-colors bg-white/5">
                      <td className="px-4 py-3 rounded-l-xl">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 flex items-center justify-center text-accent-cyan">
                             <TrendingUp size={14} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-accent-cyan bg-accent-cyan/10 px-2 py-1 rounded border border-accent-cyan/20 block min-w-[150px]" title={item.name}>
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-accent-success">
                        {Math.floor(item.totalMinutes / 60)}h {Math.round(item.totalMinutes % 60)}m
                      </td>
                      <td className="px-4 py-3 rounded-r-xl w-32">
                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className="h-full bg-accent-success" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {selectedLinkJob && (
        <LinkProjectModal 
          job={selectedLinkJob}
          routerName={selectedLinkRouter}
          onClose={() => {
            setSelectedLinkJob(null);
            setSelectedLinkRouter('');
          }}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
