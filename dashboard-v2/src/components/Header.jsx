import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Bell, User, Zap, CheckCircle2, Clock, LogOut, Settings, Menu,
  Play, AlertTriangle, Wrench, WifiOff, Timer
} from 'lucide-react';
import { api } from '../services/api';

function timeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins}min atrás`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h atrás`;
  const days = Math.floor(hrs / 24);
  return `${days}d atrás`;
}

export function Header({ title, subtitle, user, jobs = [], routers = [], maintenance = [], onMenuToggle, onSectionChange }) {
  const expiry = user?.trial_expiry ? new Date(user.trial_expiry) : null;
  const daysLeft = expiry ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)) : 0;

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [dismissedIds, setDismissedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_notifs') || '[]'); } catch { return []; }
  });
  const dropdownRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate real notifications from system data
  const notifications = useMemo(() => {
    const notifs = [];
    const now = new Date();

    // 1. Active jobs (machines currently cutting)
    const activeJobs = jobs.filter(j => j.start_time && !j.end_time);
    activeJobs.forEach(j => {
      notifs.push({
        id: `active-${j.id}`,
        title: `${j.router_name || 'Máquina'} cortando`,
        desc: j.file_name || 'Arquivo em processo',
        time: timeAgo(j.start_time),
        timestamp: new Date(j.start_time),
        icon: Play,
        color: 'text-accent-cyan',
        action: 'dashboard'
      });
    });

    // 2. Recently completed jobs (last 24h)
    const recentCompleted = jobs
      .filter(j => j.end_time && (now - new Date(j.end_time)) < 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(b.end_time) - new Date(a.end_time))
      .slice(0, 5);
    
    recentCompleted.forEach(j => {
      const dur = j.duration_minutes || ((new Date(j.end_time) - new Date(j.start_time)) / 60000);
      notifs.push({
        id: `done-${j.id}`,
        title: `Corte finalizado`,
        desc: `${j.file_name || 'Arquivo'} (${j.router_name || 'Máquina'}) — ${dur.toFixed(0)}min`,
        time: timeAgo(j.end_time),
        timestamp: new Date(j.end_time),
        icon: CheckCircle2,
        color: 'text-accent-success',
        action: 'jobs'
      });
    });

    // 3. Offline routers
    const offlineRouters = routers.filter(r => r.status === 'offline');
    offlineRouters.forEach(r => {
      notifs.push({
        id: `offline-${r.name}`,
        title: `${r.name} offline`,
        desc: 'Máquina desconectada ou desligada',
        time: r.last_seen ? timeAgo(r.last_seen) : '-',
        timestamp: r.last_seen ? new Date(r.last_seen) : new Date(0),
        icon: WifiOff,
        color: 'text-accent-danger',
        action: 'dashboard'
      });
    });

    // 4. Maintenance due soon (next 7 days) or overdue
    maintenance.forEach(m => {
      if (!m.next_date) return;
      const nextDate = new Date(m.next_date);
      const daysUntil = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 7) {
        notifs.push({
          id: `maint-${m.id}`,
          title: daysUntil <= 0 ? 'Manutenção atrasada!' : 'Manutenção próxima',
          desc: `${m.task || m.description || 'Tarefa'} — ${daysUntil <= 0 ? 'VENCIDA' : `em ${daysUntil} dias`}`,
          time: daysUntil <= 0 ? 'Atrasada' : `${daysUntil}d`,
          timestamp: nextDate,
          icon: daysUntil <= 0 ? AlertTriangle : Wrench,
          color: daysUntil <= 0 ? 'text-accent-danger' : 'text-accent-warning',
          action: 'maintenance'
        });
      }
    });

    // 5. Trial expiring soon
    if (user?.plan === 'starter' && daysLeft > 0 && daysLeft <= 10) {
      notifs.push({
        id: 'trial-expiring',
        title: daysLeft <= 3 ? 'Trial expirando!' : 'Trial expira em breve',
        desc: `Seu plano Starter expira em ${daysLeft} dias. Renove para não perder acesso.`,
        time: `${daysLeft}d`,
        timestamp: new Date(now.getTime() - 1000), // show near top
        icon: Timer,
        color: daysLeft <= 3 ? 'text-accent-danger' : 'text-accent-warning'
      });
    }

    // Sort by timestamp (most recent first)
    notifs.sort((a, b) => b.timestamp - a.timestamp);

    return notifs;
  }, [jobs, routers, maintenance, user, daysLeft]);

  const activeNotifs = notifications.filter(n => !dismissedIds.includes(n.id));
  const hasNew = activeNotifs.length > 0;

  const handleDismiss = (id) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    localStorage.setItem('dismissed_notifs', JSON.stringify(updated));
  };

  const handleDismissAll = () => {
    const updated = notifications.map(n => n.id);
    setDismissedIds(updated);
    localStorage.setItem('dismissed_notifs', JSON.stringify(updated));
  };

  return (
    <header className="h-20 border-b border-border flex items-center justify-between px-4 md:px-8 bg-bg-main/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex items-center gap-3">
        <button 
          onClick={onMenuToggle}
          className="md:hidden p-2 text-text-muted hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>
        <div className="flex flex-col">
          <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">{title}</h2>
          <p className="text-xs md:text-sm text-text-muted hidden sm:block">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-6">

        {/* User Status / Plan */}
        {user && (
          <div className="relative">
            <button 
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2 sm:gap-4 bg-white/5 border border-border pl-2 pr-2 sm:pr-4 py-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <div className={`
                hidden sm:block px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest
                ${user.plan === 'starter' ? 'bg-slate-500 text-white' : ''}
                ${user.plan === 'pro' ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20' : ''}
                ${user.plan === 'business' ? 'bg-accent-warning text-black shadow-lg shadow-accent-warning/20' : ''}
              `}>
                {user.plan}
              </div>
              
              <div className="flex flex-col min-w-0">
                <span className="text-xs sm:text-sm font-semibold text-white leading-none mb-1 truncate max-w-[100px] sm:max-w-[200px]">{user.email}</span>
                <span className={`text-[9px] sm:text-[10px] font-bold flex items-center gap-1 ${user.plan === 'starter' ? (daysLeft > 0 ? 'text-accent-warning' : 'text-accent-danger') : 'text-accent-cyan'}`}>
                  <Zap size={10} fill="currentColor" className="shrink-0" />
                  <span className="truncate">{user.plan === 'starter' ? (daysLeft > 0 ? `Renove em ${daysLeft}d` : 'Expirado') : 'Plano Ativo'}</span>
                </span>
              </div>
              
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr border flex items-center justify-center overflow-hidden shrink-0 ${user.plan === 'starter' && daysLeft <= 0 ? 'from-accent-danger/20 to-red-900/20 border-accent-danger/30 text-accent-danger' : 'from-accent-cyan/20 to-accent-blue/20 border-accent-cyan/30 text-accent-cyan'}`}>
                 <User size={16} className="sm:hidden" />
                 <User size={18} className="hidden sm:block" />
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-4 w-64 glass rounded-2xl overflow-hidden border border-border shadow-2xl p-2 animate-in slide-in-from-top-2 duration-200 z-[200]">
                <div className="px-3 py-2 border-b border-white/10 mb-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-text-muted">Perfil de Acesso Ativo</p>
                  <div className="flex gap-1 mt-2">
                    {[
                      { id: 'gerente', label: '👑 Gerente' },
                      { id: 'encarregado', label: '👷 Supervisor' },
                      { id: 'operador', label: '🧑‍🔧 Operador' },
                    ].map(r => {
                      const active = (user?.company_role || 'gerente') === r.id;
                      return (
                        <button
                          key={r.id}
                          onClick={async () => {
                            if (active) return;
                            try {
                              let resp = await api.patch('/user/company-role', { company_role: r.id });
                              if (resp && resp.error) {
                                resp = await api.post('/user/company-role', { company_role: r.id });
                              }
                              if (resp && resp.error) {
                                alert(resp.error);
                              } else {
                                window.location.href = '/';
                              }
                            } catch (e) {
                              alert('Erro ao alterar perfil: ' + (e?.message || 'Tente novamente em instantes'));
                            }
                          }}
                          className={`flex-1 py-1.5 px-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            active 
                              ? 'bg-accent-cyan text-black font-extrabold shadow-sm' 
                              : 'bg-white/5 text-text-muted hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {user?.company_role !== 'operador' && (
                  <button 
                    onClick={() => {
                      setShowUserMenu(false);
                      if (onSectionChange) onSectionChange('settings');
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <Settings size={16} className="text-text-muted" /> Configurações
                  </button>
                )}
                <div className="h-px bg-border my-1 mx-2"></div>
                <button 
                  onClick={() => {
                    localStorage.removeItem('mach3_token');
                    window.location.reload();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-accent-danger hover:bg-accent-danger/10 transition-colors cursor-pointer"
                >
                  <LogOut size={16} /> Sair
                </button>
              </div>
            )}
          </div>
        )}

        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className={`p-2 hover:bg-white/5 rounded-full text-text-muted transition-colors relative cursor-pointer ${showNotifications ? 'bg-white/10 text-white' : ''}`}
          >
            <Bell size={20} />
            {hasNew && (
              <>
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-accent-danger rounded-full ring-4 ring-bg-main animate-pulse"></span>
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-accent-danger text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                  {activeNotifs.length}
                </span>
              </>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-4 w-[calc(100vw-2rem)] max-w-sm sm:w-96 glass rounded-3xl overflow-hidden border border-border shadow-2xl p-2 animate-in slide-in-from-top-2 duration-200 z-[200]">
              <div className="p-4 border-b border-border flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-white">Notificações</span>
                  {activeNotifs.length > 0 && (
                    <span className="bg-accent-danger/20 text-accent-danger text-[10px] font-black px-2 py-0.5 rounded-full">
                      {activeNotifs.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {activeNotifs.length > 0 && (
                    <span 
                      className="text-[10px] font-black uppercase text-text-muted tracking-widest cursor-pointer hover:text-white transition-colors"
                      onClick={handleDismissAll}
                    >
                      Limpar
                    </span>
                  )}
                  <span 
                    className="text-[10px] font-black uppercase text-accent-cyan tracking-widest cursor-pointer hover:text-white transition-colors" 
                    onClick={() => setShowNotifications(false)}
                  >
                    Fechar
                  </span>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                {activeNotifs.length === 0 ? (
                  <div className="py-12 text-center">
                    <Bell size={32} className="text-text-muted/20 mx-auto mb-3" />
                    <p className="text-sm text-text-muted font-bold">Nenhuma notificação</p>
                    <p className="text-[11px] text-text-muted/60 mt-1">Tudo em dia!</p>
                  </div>
                ) : (
                  activeNotifs.map((n) => (
                    <div 
                      key={n.id} 
                      className={`p-4 hover:bg-white/5 transition-colors flex gap-4 border-b border-border/30 last:border-0 group ${n.action ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        handleDismiss(n.id);
                        if (n.action && onSectionChange) {
                          onSectionChange(n.action);
                          setShowNotifications(false);
                        }
                      }}
                    >
                      <div className={`p-2 rounded-xl bg-white/5 ${n.color} transition-transform group-hover:scale-110 shrink-0 h-fit`}>
                        <n.icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="text-xs font-bold text-white flex justify-between items-center gap-2">
                          <span className="truncate">{n.title}</span>
                          <span className="text-[10px] font-medium text-text-muted whitespace-nowrap">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-text-muted leading-relaxed truncate">{n.desc}</p>
                      </div>
                      <button 
                        onClick={() => handleDismiss(n.id)}
                        className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-white text-xs transition-all shrink-0 self-center"
                        title="Dispensar"
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
