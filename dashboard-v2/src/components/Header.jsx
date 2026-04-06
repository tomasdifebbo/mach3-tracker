import React, { useState } from 'react';
import { Bell, Search, User, Zap, CheckCircle2, Clock, LogOut, Settings } from 'lucide-react';

export function Header({ title, subtitle, user }) {
  const expiry = user?.trial_expiry ? new Date(user.trial_expiry) : null;
  const daysLeft = expiry ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)) : 0;

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [hasNew, setHasNew] = useState(true);

  const notifications = [
    { id: 1, title: 'Bem-vindo ao SaaS!', desc: 'Seu trial de 31 dias começou.', time: 'Agora', icon: Zap, color: 'text-accent-cyan' },
    { id: 2, title: 'Backup Concluído', desc: 'Logs de ontem sincronizados.', time: '2h atrás', icon: CheckCircle2, color: 'text-accent-success' },
    { id: 3, title: 'Dica Pró', desc: 'Configure materiais para ver custos.', time: '5h atrás', icon: Clock, color: 'text-accent-warning' },
  ];

  return (
    <header className="h-20 border-b border-border flex items-center justify-between px-8 bg-bg-main/50 backdrop-blur-sm sticky top-0 z-40">
      <div className="flex flex-col">
        <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
        <p className="text-sm text-text-muted">{subtitle}</p>
      </div>

      <div className="flex items-center gap-6">
        {/* Search */}
        <div className="hidden md:flex items-center gap-3 bg-white/5 border border-border px-4 py-2 rounded-full w-64 transition-all focus-within:border-accent-cyan/50 focus-within:w-80">
          <Search size={18} className="text-text-muted" />
          <input 
            type="text" 
            placeholder="Buscar jobs..." 
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-text-muted"
          />
        </div>

        {/* User Status / Plan */}
        {user && (
          <div className="relative">
            <button 
              onClick={() => {
                setShowUserMenu(!showUserMenu);
                setShowNotifications(false);
              }}
              className="flex items-center gap-4 bg-white/5 border border-border pl-2 pr-4 py-1.5 rounded-full hover:bg-white/10 transition-colors cursor-pointer text-left"
            >
              <div className={`
                px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest
                ${user.plan === 'starter' ? 'bg-slate-500 text-white' : ''}
                ${user.plan === 'pro' ? 'bg-accent-blue text-white shadow-lg shadow-accent-blue/20' : ''}
                ${user.plan === 'business' ? 'bg-accent-warning text-black shadow-lg shadow-accent-warning/20' : ''}
              `}>
                {user.plan}
              </div>
              
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white leading-none mb-1">{user.email}</span>
                <span className="text-[10px] text-accent-cyan font-bold flex items-center gap-1">
                  <Zap size={10} fill="currentColor" />
                  {daysLeft > 0 ? `Trial: ${daysLeft} dias` : 'Plano Ativo'}
                </span>
              </div>
              
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent-cyan/20 to-accent-blue/20 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan overflow-hidden">
                 <User size={18} />
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-4 w-56 glass rounded-2xl overflow-hidden border border-border shadow-2xl p-1.5 animate-in slide-in-from-top-2 duration-200">
                <button 
                  onClick={() => {
                    setShowUserMenu(false);
                    alert("Acesse as configurações pelo menu lateral.");
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-white hover:bg-white/5 transition-colors"
                >
                  <Settings size={16} className="text-text-muted" /> Configurações
                </button>
                <div className="h-px bg-border my-1 mx-2"></div>
                <button 
                  onClick={() => {
                    localStorage.removeItem('mach3_token');
                    window.location.reload();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-accent-danger hover:bg-accent-danger/10 transition-colors"
                >
                  <LogOut size={16} /> Sair
                </button>
              </div>
            )}
          </div>
        )}

        <div className="relative">
          <button 
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
              setHasNew(false);
            }}
            className={`p-2 hover:bg-white/5 rounded-full text-text-muted transition-colors relative cursor-pointer ${showNotifications ? 'bg-white/10 text-white' : ''}`}
          >
            <Bell size={20} />
            {hasNew && <span className="absolute top-2 right-2 w-2 h-2 bg-accent-danger rounded-full ring-4 ring-bg-main animate-pulse"></span>}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-4 w-80 glass rounded-3xl overflow-hidden border border-border shadow-2xl p-2 animate-in slide-in-from-top-2 duration-200">
              <div className="p-4 border-b border-border flex justify-between items-center">
                <span className="text-sm font-bold text-white">Notificações</span>
                <span className="text-[10px] font-black uppercase text-accent-cyan tracking-widest cursor-pointer hover:text-white" onClick={() => setShowNotifications(false)}>Fechar</span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.map((n) => (
                  <div key={n.id} className="p-4 hover:bg-white/5 transition-colors flex gap-4 border-b border-border last:border-0 group cursor-pointer">
                    <div className={`p-2 rounded-xl bg-white/5 ${n.color} transition-transform group-hover:scale-110`}>
                      <n.icon size={18} />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="text-xs font-bold text-white flex justify-between items-center">
                        {n.title}
                        <span className="text-[10px] font-medium text-text-muted">{n.time}</span>
                      </div>
                      <p className="text-[11px] text-text-muted leading-relaxed truncate w-40">{n.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => alert("Histórico completo de atividades em breve!")}
                className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-text-muted hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                Ver todas as atividades
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
