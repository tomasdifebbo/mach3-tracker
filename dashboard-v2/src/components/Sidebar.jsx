import React from 'react';
import { 
  LayoutDashboard, 
  History, 
  BarChart3, 
  Box, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Crown
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function Sidebar({ activeSection, onSectionChange, user }) {
  const [isOpen, setIsOpen] = React.useState(true);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'jobs', label: 'Histórico', icon: History },
    { id: 'charts', label: 'Gráficos', icon: BarChart3 },
    { id: 'materials', label: 'Materiais', icon: Box },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  if (user?.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Painel Master', icon: Crown });
  }

  return (
    <aside className={cn(
      "h-screen bg-bg-sidebar border-r border-border transition-all duration-300 flex flex-col z-50",
      isOpen ? "w-[260px]" : "w-[80px]"
    )}>
      {/* Header */}
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div className={cn("flex items-center gap-3 overflow-hidden transition-all", isOpen ? "opacity-100" : "opacity-0 w-0")}>
          <div className="w-8 h-8 bg-gradient-to-br from-accent-cyan to-accent-blue rounded-lg flex items-center justify-center text-xl shadow-lg shadow-accent-cyan/20">
            🔩
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight">MACH3</h1>
            <span className="text-[10px] text-accent-cyan font-bold tracking-[0.2em]">TRACKER V5.0</span>
          </div>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 hover:bg-white/5 rounded-md text-text-muted hover:text-white transition-colors"
        >
          {isOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 mt-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-all group relative",
              activeSection === item.id 
                ? "bg-gradient-to-r from-accent-cyan/10 to-transparent text-accent-cyan border-l-4 border-accent-cyan shadow-[inset_20px_0_20px_-20px_rgba(6,182,212,0.3)]"
                : "text-text-muted hover:bg-white/5 hover:text-white"
            )}
          >
            <item.icon size={22} className={cn("shrink-0", activeSection === item.id ? "text-accent-cyan" : "group-hover:text-white")} />
            <span className={cn("whitespace-nowrap transition-all", isOpen ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none w-0")}>
              {item.label}
            </span>
            {!isOpen && (
              <div className="absolute left-16 bg-bg-sidebar border border-border px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
                {item.label}
              </div>
            )}
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <button
          onClick={() => {
            localStorage.removeItem('mach3_token');
            window.location.reload();
          }}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-accent-danger hover:bg-accent-danger/10 transition-all group"
        >
          <LogOut size={22} className="shrink-0" />
          <span className={cn("whitespace-nowrap transition-all", isOpen ? "opacity-100" : "opacity-0 w-0 pointer-events-none")}>
            Sair
          </span>
        </button>
      </div>
    </aside>
  );
}
