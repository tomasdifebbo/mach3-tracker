import React from 'react';
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
  if (!minutes) return "00:00:00";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.floor((minutes * 60) % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function Dashboard({ jobs = [], user }) {
  const activeJob = jobs.find(j => !j.end_time);
  
  // Calculate Stats
  const totalHours = jobs.reduce((acc, j) => acc + (j.duration_minutes || 0), 0) / 60;
  const totalCost = jobs.reduce((acc, j) => acc + (j.duration_minutes / 60 * 50) + (j.material_price || 0), 0);
  
  const stats = [
    { label: 'Total de Jobs', value: jobs.length, icon: Users, color: 'text-accent-blue', trend: '+12%' },
    { label: 'Horas Totais', value: formatDuration(totalHours * 60).split(':')[0] + 'h', icon: Clock, color: 'text-accent-cyan', trend: '+8h' },
    { label: 'Custo Total', value: formatCurrency(totalCost), icon: DollarSign, color: 'text-accent-warning', trend: '-2%' },
    { label: 'OEE (Hoje)', value: '85.4%', icon: Activity, color: 'text-accent-success', trend: '+5%' },
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      {/* Active Job Banner */}
      {activeJob && (
        <motion.div 
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
                <span className="text-[10px] font-black uppercase tracking-widest text-accent-cyan bg-accent-cyan/20 px-2 py-0.5 rounded">Em Andamento</span>
                <h3 className="text-lg font-bold text-white uppercase">{activeJob.file_name}</h3>
              </div>
              <p className="text-xs text-text-muted font-medium opacity-60 truncate max-w-sm">{activeJob.folder}</p>
            </div>
          </div>
          <div className="text-3xl font-mono font-bold text-accent-cyan tracking-tighter tabular-nums">
             {/* Simple ticker logic omitted for brevity in Dash - handled in App or use a hook */}
             01:12:45
          </div>
        </motion.div>
      )}

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
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.trend.startsWith('+') ? 'bg-accent-success/10 text-accent-success' : 'bg-accent-danger/10 text-accent-danger'}`}>
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
            <h3 className="text-lg font-bold">Produção (Últimos 30 dias)</h3>
            <div className="flex items-center gap-2 text-xs text-text-muted font-bold">
              <div className="w-3 h-3 bg-accent-cyan rounded-sm"></div> Horas Máquina
            </div>
          </div>
          <Bar 
            data={{
              labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'],
              datasets: [{
                label: 'Horas',
                data: [4, 6, 5, 8, 4, 3, 2],
                backgroundColor: '#06b6d4',
                borderRadius: 8,
                barThickness: 24,
              }]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false } },
                x: { grid: { display: false }, border: { display: false } }
              },
              plugins: { legend: { display: false } }
            }}
          />
        </div>

        <div className="glass p-8 rounded-3xl h-[400px]">
          <h3 className="text-lg font-bold mb-8">Top Projetos</h3>
          <div className="h-[250px] flex items-center justify-center">
            <Doughnut 
              data={{
                labels: ['Peças CNC', 'Móveis', 'Letreiros', 'Outros'],
                datasets: [{
                  data: [45, 25, 20, 10],
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
          </div>
        </div>
      </div>
    </div>
  );
}
