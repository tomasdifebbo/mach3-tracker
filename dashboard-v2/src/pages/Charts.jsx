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
  Filler
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
  Filler
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

export function Charts({ jobs = [] }) {
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
                <p className="text-xs text-text-muted font-medium">Horas de máquina por dia úteis</p>
              </div>
            </div>
          </div>
          <div className="h-[300px] relative z-10">
            <Line 
              data={{
                labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'],
                datasets: [{
                  label: 'Horas',
                  data: [4.2, 5.8, 6.1, 4.5, 7.2, 2.1, 0.5],
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
              options={chartOptions}
            />
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
                <p className="text-xs text-text-muted font-medium">Quantidade de arquivos processados</p>
              </div>
            </div>
          </div>
          <div className="h-[300px]">
            <Bar 
              data={{
                labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'],
                datasets: [{
                  label: 'Jobs',
                  data: [12, 18, 15, 22, 19, 8, 3],
                  backgroundColor: '#10b981',
                  borderRadius: 12,
                  barThickness: 32
                }]
              }}
              options={chartOptions}
            />
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
            <h3 className="text-xl font-bold tracking-tight">Distribuição de Carga</h3>
          </div>
          <div className="h-[350px]">
            <Bar 
              data={{
                labels: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
                datasets: [
                  { label: 'Efetivo', data: [85, 92, 78, 88, 95, 82], backgroundColor: '#06b6d4', borderRadius: 4 },
                  { label: 'Ocioso', data: [15, 8, 22, 12, 5, 18], backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 4 }
                ]
              }}
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  x: { ...chartOptions.scales.x, stacked: true },
                  y: { ...chartOptions.scales.y, stacked: true, max: 100 }
                }
              }}
            />
          </div>
        </div>

        <div className="glass p-10 rounded-[40px] border-border/40 flex flex-col items-center">
          <h3 className="text-xl font-bold mb-10 self-start">Utilização por Máquina</h3>
          <div className="h-[300px] w-full flex items-center justify-center mb-8">
             <Doughnut 
              data={{
                labels: ['Router 1', 'Router 2', 'Laser 1'],
                datasets: [{
                  data: [120, 85, 45],
                  backgroundColor: ['#3b82f6', '#06b6d4', '#10b981'],
                  borderWidth: 0,
                  hoverOffset: 20
                }]
              }}
              options={{
                ...chartOptions,
                cutout: '70%',
                plugins: { legend: { display: true, position: 'bottom', labels: { padding: 30, color: '#94a3b8', font: { weight: 'bold' } } } }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
