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
  Crown,
  ClipboardList,
  HardHat
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function Sidebar({ activeSection, onSectionChange, user, maintenance = [], isMobileOpen, setIsMobileOpen, isTrialExpired }) {
  const [isOpen, setIsOpen] = React.useState(true);

  // Check if there is an urgent maintenance
  const hasUrgentMaintenance = React.useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return maintenance.some(m => {
      if (m.status === 'done' || m.status === 'cancelled') return false;
      const [year, month, day] = m.scheduled_date.split('T')[0].split('-');
      const mDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (m.scheduled_time) {
        const [h, min] = m.scheduled_time.split(':');
        mDate.setHours(parseInt(h), parseInt(min), 0, 0);
      } else {
        mDate.setHours(23, 59, 59, 999);
      }
      return mDate <= tomorrow;
    });
  }, [maintenance]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'jobs', label: 'Histórico', icon: History },
    { id: 'charts', label: 'Gráficos', icon: BarChart3 },
    { id: 'materials', label: 'Materiais', icon: Box },
    { id: 'maintenance', label: 'Manutenção', icon: ClipboardList, badge: hasUrgentMaintenance },
    { id: 'encarregado', label: 'Encarregado', icon: HardHat },
    { id: 'settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed md:static inset-y-0 left-0 bg-bg-sidebar border-r border-border transition-all duration-300 flex flex-col z-50",
        // Desktop widths
        isOpen ? "md:w-[260px]" : "md:w-[80px]",
        // Mobile visibility
        isMobileOpen ? "translate-x-0 w-[260px]" : "-translate-x-full md:translate-x-0"
      )}>
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div className={cn("flex items-center gap-3 overflow-hidden transition-all", (isOpen || isMobileOpen) ? "opacity-100" : "opacity-0 w-0")}>
          <div className="w-8 h-8 bg-gradient-to-br from-accent-cyan to-accent-blue rounded-lg flex items-center justify-center text-xl shadow-lg shadow-accent-cyan/20 shrink-0">
            🔩
          </div>
          <div className="truncate">
            <h1 className="text-lg font-bold tracking-tight text-white leading-tight truncate">MACH3 TRACKER</h1>
            <span className="text-[10px] text-accent-cyan font-bold tracking-[0.2em]">PRODUCTION V2.0</span>
          </div>
        </div>
        <button 
          onClick={() => {
            if (isMobileOpen && setIsMobileOpen) {
              setIsMobileOpen(false);
            } else {
              setIsOpen(!isOpen);
            }
          }}
          className="p-1.5 hover:bg-white/5 rounded-md text-text-muted hover:text-white transition-colors"
          title={isMobileOpen ? "Fechar menu" : "Alternar menu"}
        >
          {isOpen || isMobileOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 mt-4 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isFeatureDisabled = user?.features && user.features[item.id] === false;
          const isDisabled = (isTrialExpired && item.id !== 'settings') || isFeatureDisabled;
          const showText = isOpen || isMobileOpen;
          return (
            <button
              key={item.id}
              onClick={() => { 
                if (!isDisabled) {
                  onSectionChange(item.id); 
                  if (setIsMobileOpen) setIsMobileOpen(false);
                } 
              }}
              disabled={isDisabled}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-xl font-medium transition-all group relative cursor-pointer",
                activeSection === item.id 
                  ? "bg-gradient-to-r from-accent-cyan/10 to-transparent text-accent-cyan border-l-4 border-accent-cyan shadow-[inset_20px_0_20px_-20px_rgba(6,182,212,0.3)]"
                  : "text-text-muted hover:bg-white/5 hover:text-white",
                isDisabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-text-muted"
              )}
            >
            <div className="relative">
              <item.icon size={22} className={cn("shrink-0", activeSection === item.id ? "text-accent-cyan" : "group-hover:text-white")} />
              {item.badge && (
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                </span>
              )}
            </div>
            <span className={cn("whitespace-nowrap transition-all flex-1 text-left truncate", showText ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 pointer-events-none w-0")}>
              {item.label}
            </span>
            {isDisabled && showText && (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 opacity-60 shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            )}
            {!showText && (
              <div className="absolute left-16 bg-bg-sidebar border border-border px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
                {item.label} {isDisabled ? '(Bloqueado)' : ''}
              </div>
            )}
          </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <button
          onClick={() => {
            localStorage.removeItem('mach3_token');
            window.location.reload();
          }}
          className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-accent-danger hover:bg-accent-danger/10 transition-all group cursor-pointer"
        >
          <LogOut size={22} className="shrink-0" />
          <span className={cn("whitespace-nowrap transition-all truncate", (isOpen || isMobileOpen) ? "opacity-100" : "opacity-0 w-0 pointer-events-none")}>
            Sair
          </span>
        </button>
      </div>
    </aside>
    </>
  );
}
