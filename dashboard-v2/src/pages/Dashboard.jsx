import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Clock, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Activity,
  Play
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

export function Dashboard({ jobs = [], user }) {
  const [elapsed, setElapsed] = useState(0);
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
  
  // Group by filename and sum duration
  const groupedJobs = jobs.reduce((acc, j) => {
    const name = j.file_name || 'Desconhecido';
    if (!acc[name]) {
      acc[name] = { name, count: 0, totalMinutes: 0 };
    }
    const dur = j.duration_minutes || (j.end_time ? (new Date(j.end_time) - new Date(j.start_time)) / 60000 : 0);
    acc[name].count += 1;
    acc[name].totalMinutes += dur;
    return acc;
  }, {});
  
  const sortedGrouped = Object.values(groupedJobs).sort((a, b) => b.totalMinutes - a.totalMinutes).slice(0, 10);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      {/* Active Jobs Banners */}
      <div className="space-y-4">
        {activeJobs.map(job => (
          <motion.div 
            key={job.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-accent-cyan/10 border border-accent-cyan/30 rounded-2xl p-6 flex items-center justify-between shadow-[0_0_30px_rgba(6,182,212,0.1)]"
          >
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-accent-cyan rounded-xl flex items-center justify-center text-black animate-pulse">
                <Play size={24} fill="currentColor" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-accent-cyan bg-accent-cyan/20 px-2 py-0.5 rounded">
                    {job.router_name || 'ROUTER'} - EM ANDAMENTO
                  </span>
                  <h3 className="text-lg font-bold text-white uppercase truncate max-w-xs">{job.file_name}</h3>
                </div>
                <p className="text-xs text-text-muted font-medium opacity-60 truncate max-w-sm">{job.folder}</p>
              </div>
            </div>
            <div className="text-3xl font-mono font-bold text-accent-cyan tracking-tighter tabular-nums">
               {formatDuration((Math.floor((Date.now() - new Date(job.start_time)) / 1000) / 60))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {stats.map((s, i) => (
          <motion.div 
            key={i}
            whileHover={{ y: -5 }}
            className="glass p-6 rounded-2xl group transition-all"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl bg-white/5 ${s.color} transition-colors group-hover:bg-white/10 group-hover:scale-110 duration-300`}>
                <s.icon size={24} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-text-muted`}>
                {s.trend}
              </span>
            </div>
            <h4 className="text-sm text-text-muted font-medium mb-1">{s.label}</h4>
            <div className="text-2xl font-bold text-white tracking-tight">{s.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass p-8 rounded-3xl h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-bold">Produção (Últimos 7 dias)</h3>
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

        <div className="glass p-8 rounded-3xl h-[400px]">
          <h3 className="text-lg font-bold mb-8">Materiais Usados</h3>
          <div className="h-[250px] flex items-center justify-center">
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
      {/* Grouped Totals Table */}
      <div className="glass p-8 rounded-3xl overflow-hidden">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-lg font-bold">Resumo por Arquivo (Tempo Somado)</h3>
          <span className="text-xs text-text-muted">Totalizando trabalhos com nomes idênticos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-y-2">
            <thead>
              <tr className="text-text-muted text-[10px] font-black uppercase tracking-widest">
                <th className="px-4 py-2">Nome do Arquivo</th>
                <th className="px-4 py-2">Repetições</th>
                <th className="px-4 py-2">Tempo Total Acumulado</th>
                <th className="px-4 py-2">Barra de Produtividade</th>
              </tr>
            </thead>
            <tbody>
              {sortedGrouped.map((item, idx) => {
                const maxTime = sortedGrouped[0].totalMinutes || 1;
                const percentage = (item.totalMinutes / maxTime) * 100;
                
                return (
                  <tr key={idx} className="group hover:bg-white/5 transition-colors bg-white/5 rounded-xl">
                    <td className="px-4 py-4 font-bold text-sm rounded-l-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent-blue/20 flex items-center justify-center text-accent-blue">
                          <FileText size={16} />
                        </div>
                        {item.name}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm font-medium">{item.count}x</td>
                    <td className="px-4 py-4 text-sm font-bold text-accent-cyan">
                      {item.totalMinutes > 60 
                        ? `${Math.floor(item.totalMinutes / 60)}h ${Math.round(item.totalMinutes % 60)}min` 
                        : `${Math.round(item.totalMinutes)} min`}
                    </td>
                    <td className="px-4 py-4 rounded-r-xl w-64">
                      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${percentage}%` }}
                          className="h-full bg-gradient-to-r from-accent-blue to-accent-cyan"
                        />
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
  );
}
