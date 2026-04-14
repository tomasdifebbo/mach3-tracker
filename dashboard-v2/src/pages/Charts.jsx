import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  PieChart, 
  Calendar,
  Activity,
  History
} from 'lucide-react';
import { 
  Chart as ChartJS, 
  CategoryScale, 
  LinearScale, 
  BarElement, 
  Title, 
  Tooltip, 
  Legend,
  PointElement,
  LineElement,
  Filler,
  ArcElement
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  Filler,
  ArcElement
);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: { grid: { color: 'rgba(255,255,255,0.05)' }, border: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
    x: { grid: { display: false }, border: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } }
  },
  plugins: { legend: { display: false } }
};

// Helper to get last N days as ISO date strings
function getLastNDays(n) {
  return [...Array(n)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d.toISOString().split('T')[0];
  });
}

// Helper to get day-of-week label
function getDayLabel(dateStr) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
  return days[new Date(dateStr + 'T12:00:00').getDay()];
}

// Helper to get month label
function getMonthLabel(monthIndex) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return months[monthIndex];
}

export function Charts({ jobs = [] }) {
  // ─── Productivity Line Chart (last 7 days) ───
  const last7 = getLastNDays(7);
  const weeklyHours = last7.map(date => {
    const dayJobs = jobs.filter(j => j.start_time && j.start_time.startsWith(date) && j.end_time);
    return dayJobs.reduce((acc, j) => acc + (j.duration_minutes || 0), 0) / 60;
  });
  const weeklyLabels = last7.map(d => getDayLabel(d));

  // ─── Jobs per Day Bar (last 7 days) ───
  const weeklyJobCounts = last7.map(date => {
    return jobs.filter(j => j.start_time && j.start_time.startsWith(date)).length;
  });

  // ─── Monthly Distribution (last 6 months) ───
  const now = new Date();
  const monthlyData = [];
  const monthlyLabels = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = d.getMonth();
    const year = d.getFullYear();
    monthlyLabels.push(getMonthLabel(month));
    
    const monthJobs = jobs.filter(j => {
      if (!j.start_time) return false;
      const jDate = new Date(j.start_time);
      return jDate.getMonth() === month && jDate.getFullYear() === year;
    });
    
    const totalMinutes = monthJobs.reduce((acc, j) => acc + (j.duration_minutes || 0), 0);
    const totalHours = totalMinutes / 60;
    // Assuming ~8h/day, ~22 days/month = 176h max -> percentage
    const efficiency = Math.min(100, Math.round((totalHours / 176) * 100));
    monthlyData.push({ effective: efficiency, idle: 100 - efficiency });
  }

  // ─── Machine/Origin Distribution (Doughnut) ───
  const originCounts = {};
  jobs.forEach(j => {
    // Extract machine name from folder (e.g. "TOMAS | path" or just path)
    let origin = 'Principal';
    if (j.folder?.includes('|')) {
      origin = j.folder.split('|')[0].trim();
    } else if (j.folder?.includes('Router A')) {
      origin = 'Router A';
    } else if (j.folder?.includes('Router B')) {
      origin = 'Router B';
    }
    originCounts[origin] = (originCounts[origin] || 0) + 1;
  });
  const originLabels = Object.keys(originCounts).slice(0, 5);
  const originData = originLabels.map(k => originCounts[k]);
  const originColors = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  // ─── Empty state helpers ───
  const hasJobs = jobs.length > 0;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700">
      {/* Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Productivity Line Chart */}
        <div className="glass p-10 rounded-[40px] border-border/40 min-h-[450px] relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-accent-cyan/5 via-transparent to-transparent pointer-events-none"></div>
          <div className="flex items-center justify-between mb-10 relative z-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent-cyan/10 text-accent-cyan rounded-2xl">
                <TrendingUp size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Produtividade Semanal</h3>
                <p className="text-xs text-text-muted font-medium">Horas de máquina por dia (últimos 7 dias)</p>
              </div>
            </div>
          </div>
          <div className="h-[300px] relative z-10">
            {hasJobs ? (
              <Line 
                data={{
                  labels: weeklyLabels,
                  datasets: [{
                    label: 'Horas',
                    data: weeklyHours,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6,182,212,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#06b6d4',
                    pointBorderColor: '#0a0e1a',
                    pointBorderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 8
                  }]
                }}
                options={{...chartOptions, scales: {...chartOptions.scales, y: {...chartOptions.scales.y, ticks: {...chartOptions.scales.y.ticks, callback: v => v.toFixed(1) + 'h'}}}}}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted opacity-40 font-bold">Nenhum dado ainda</div>
            )}
          </div>
        </div>

        {/* Jobs per Day Bar Chart */}
        <div className="glass p-10 rounded-[40px] border-border/40 min-h-[450px] relative overflow-hidden group">
           <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent-success/10 text-accent-success rounded-2xl">
                <BarChart3 size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold tracking-tight">Frequência de Jobs</h3>
                <p className="text-xs text-text-muted font-medium">Quantidade de arquivos processados (últimos 7 dias)</p>
              </div>
            </div>
          </div>
          <div className="h-[300px]">
            {hasJobs ? (
              <Bar 
                data={{
                  labels: weeklyLabels,
                  datasets: [{
                    label: 'Jobs',
                    data: weeklyJobCounts,
                    backgroundColor: '#10b981',
                    borderRadius: 12,
                    barThickness: 32
                  }]
                }}
                options={chartOptions}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted opacity-40 font-bold">Nenhum dado ainda</div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Analysis Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 glass p-10 rounded-[40px] border-border/40">
           <div className="flex items-center gap-4 mb-10">
            <div className="p-3 bg-accent-warning/10 text-accent-warning rounded-2xl">
              <Activity size={24} />
            </div>
            <h3 className="text-xl font-bold tracking-tight">Distribuição de Carga (Últimos 6 Meses)</h3>
          </div>
          <div className="h-[350px]">
            {hasJobs ? (
              <Bar 
                data={{
                  labels: monthlyLabels,
                  datasets: [
                    { label: 'Efetivo %', data: monthlyData.map(d => d.effective), backgroundColor: '#06b6d4', borderRadius: 4 },
                    { label: 'Ocioso %', data: monthlyData.map(d => d.idle), backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4 }
                  ]
                }}
                options={{
                  ...chartOptions,
                  scales: {
                    ...chartOptions.scales,
                    x: { ...chartOptions.scales.x, stacked: true },
                    y: { ...chartOptions.scales.y, stacked: true, max: 100, ticks: { ...chartOptions.scales.y.ticks, callback: v => v + '%' } }
                  }
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-text-muted opacity-40 font-bold">Nenhum dado ainda</div>
            )}
          </div>
        </div>

        <div className="glass p-10 rounded-[40px] border-border/40 flex flex-col items-center">
          <h3 className="text-xl font-bold mb-10 self-start">Utilização por Máquina</h3>
          <div className="h-[300px] w-full flex items-center justify-center mb-8">
            {originLabels.length > 0 ? (
              <Doughnut 
                data={{
                  labels: originLabels,
                  datasets: [{
                    data: originData,
                    backgroundColor: originColors.slice(0, originLabels.length),
                    borderWidth: 0,
                    hoverOffset: 20
                  }]
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  cutout: '70%',
                  plugins: { legend: { display: true, position: 'bottom', labels: { padding: 30, color: '#94a3b8', font: { weight: 'bold' } } } }
                }}
              />
            ) : (
              <div className="text-text-muted opacity-40 font-bold text-center">Nenhum dado<br/>de máquina</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
