import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { api } from './services/api';
import { lazyNamed } from './utils/lazyNamed';
import { HeadsUpNotification } from './components/HeadsUpNotification';
import { pushService } from './services/pushService';

// Lazy-loaded pages & heavy modals (Vite code-splitting)
const Dashboard = lazyNamed(() => import('./pages/Dashboard'), 'Dashboard');
const History = lazyNamed(() => import('./pages/History'), 'History');
const Charts = lazyNamed(() => import('./pages/Charts'), 'Charts');
const Materials = lazyNamed(() => import('./pages/Materials'), 'Materials');
const Maintenance = lazyNamed(() => import('./pages/Maintenance'), 'Maintenance');
const Settings = lazyNamed(() => import('./pages/Settings'), 'Settings');
const Login = lazyNamed(() => import('./pages/Login'), 'Login');
const AdminPortal = lazyNamed(() => import('./pages/AdminPortal'), 'AdminPortal');
const AdminLogin = lazyNamed(() => import('./pages/AdminLogin'), 'AdminLogin');
const PaymentResult = lazyNamed(() => import('./pages/PaymentResult'), 'PaymentResult');
const Encarregado = lazyNamed(() => import('./pages/Encarregado'), 'Encarregado');
const Operador = lazyNamed(() => import('./pages/Operador'), 'Operador');
const PaymentModal = lazyNamed(() => import('./components/PaymentModal'), 'PaymentModal');
const DemoTourModal = lazyNamed(() => import('./components/DemoTourModal'), 'DemoTourModal');

function PageFallback() {
  return (
    <div className="h-full min-h-[240px] w-full bg-bg-main flex flex-col items-center justify-center gap-3 text-accent-cyan">
      <div className="w-8 h-8 border-4 border-accent-cyan/20 border-t-accent-cyan rounded-full animate-spin" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-text-muted">Carregando módulo...</span>
    </div>
  );
}

function App() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [routers, setRouters] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('mach3_token'));
  const [loading, setLoading] = useState(() => !!localStorage.getItem('mach3_token'));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTrialExpired, setIsTrialExpired] = useState(false);
  const [isDemoTourOpen, setIsDemoTourOpen] = useState(false);
  const [headsUpAlert, setHeadsUpAlert] = useState(null);
  const activeJobsRef = useRef(new Set());

  // Auth Check & User Data
  const loadUser = useCallback(async () => {
    try {
      const userData = await api.getMe();
      setUser(userData);
      
      // Trial Expiration Logic
      let trialExpired = false;
      if (userData?.plan === 'starter' && userData?.trial_expiry) {
         const expiry = new Date(userData.trial_expiry);
         if (expiry < new Date()) {
            trialExpired = true;
         }
      }
      setIsTrialExpired(trialExpired);

      // Feature / Device Role Redirection Check
      const deviceRole = localStorage.getItem('mach3_device_role') || userData?.company_role || 'gerente';
      if (trialExpired) {
        setActiveSection('settings');
      } else if (deviceRole === 'operador') {
        setActiveSection('operador');
      } else if (userData?.features && userData.features['dashboard'] === false) {
        // If dashboard is disabled by Master Admin, find first allowed section
        const firstAllowed = Object.keys(userData.features).find(k => userData.features[k] === true && k !== 'dashboard');
        setActiveSection(firstAllowed || 'settings');
      }

      setIsLoggedIn(true);
    } catch (err) {
      console.error("Auth failed:", err);
      setIsLoggedIn(false);
      localStorage.removeItem('mach3_token');
      setLoading(false);
    }
  }, []);

  // Data Polling
  const fetchData = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const [jobsData, materialsData, routersData, maintenanceData] = await Promise.all([
        api.getJobs(),
        api.getMaterials(),
        api.getRouters(),
        api.getMaintenance()
      ]);
      if (Array.isArray(jobsData)) {
        // Detecta cortes que acabaram de finalizar para disparar o banner heads-up WhatsApp
        const currentActive = new Set(jobsData.filter(j => !j.end_time).map(j => j.id));
        if (activeJobsRef.current.size > 0) {
          for (const prevId of activeJobsRef.current) {
            if (!currentActive.has(prevId)) {
              const finishedJob = jobsData.find(j => j.id === prevId);
              if (finishedJob && finishedJob.end_time) {
                const durMin = Math.round(Number(finishedJob.duration_minutes) || 0);
                const durStr = durMin >= 60 ? `${Math.floor(durMin / 60)}h ${durMin % 60}m` : `${Math.max(1, durMin)} min`;
                setHeadsUpAlert({
                  title: `🔔 Corte Concluído - ${finishedJob.router_name || 'CNC Router'}`,
                  body: `Arquivo: ${finishedJob.file_name} · Duração: ${durStr}`,
                  jobId: finishedJob.id
                });
                pushService.playChime();
              }
            }
          }
        }
        activeJobsRef.current = currentActive;
        setJobs(jobsData);
      }
      if (Array.isArray(materialsData)) setMaterials(materialsData);
      if (Array.isArray(routersData)) setRouters(routersData);
      if (Array.isArray(maintenanceData)) setMaintenance(maintenanceData);
      setLoading(false);
    } catch (err) {
      console.error("Fetch failed:", err);
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const init = async () => {
      await loadUser();
      await fetchData();
      const token = localStorage.getItem('mach3_token');
      if (token) {
        pushService.autoSync(token);
      }
    };
    init();

    // Listener para eventos do Service Worker (ex: push recebido com o app aberto)
    const onSwMessage = (event) => {
      if (event.data && event.data.type === 'MACH3_JOB_COMPLETED') {
        const payload = event.data.payload || {};
        setHeadsUpAlert({
          title: payload.title || '🔔 Corte Concluído',
          body: payload.body || 'Um trabalho foi concluído na máquina.',
          jobId: payload.job_id
        });
        pushService.playChime();
        fetchData();
      }
    };

    // Listener para teste manual de notificação disparado em Configurações
    const onTestAlert = (event) => {
      if (event.detail) {
        setHeadsUpAlert({
          title: event.detail.title || '🔔 Teste - Mach3 Tracker',
          body: event.detail.body || 'Banner flutuante estilo WhatsApp com auto-recolhimento.',
          jobId: Date.now()
        });
      }
    };

    if (typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', onSwMessage);
      }
      window.addEventListener('mach3:test-alert', onTestAlert);
    }

    // Polling de 25 segundos
    const interval = setInterval(fetchData, 25000);
    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.removeEventListener('message', onSwMessage);
        }
        window.removeEventListener('mach3:test-alert', onTestAlert);
      }
    };
  }, [isLoggedIn, fetchData, loadUser]);

  // Sync System Theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('mach3_theme') || user?.theme || 'Escuro';
    const t = savedTheme.toLowerCase();
    const themeKey = t.includes('claro') ? 'claro' : (t.includes('azul') ? 'azul' : 'escuro');
    document.documentElement.setAttribute('data-theme', themeKey);
  }, [user?.theme]);

  // Handle Admin Portal Route (/admin)
  const pathParts = window.location.pathname.split('/');
  const isAdminRoute = pathParts[1] === 'admin';

  if (isAdminRoute) {
    if (!isLoggedIn) {
      return (
        <Suspense fallback={<PageFallback />}>
          <AdminLogin onLoginSuccess={() => {
            setIsLoggedIn(true);
            window.location.reload();
          }} />
        </Suspense>
      );
    }
    if (user && user.role === 'admin') {
      return (
        <Suspense fallback={<PageFallback />}>
          <AdminPortal />
        </Suspense>
      );
    } else if (user && user.role !== 'admin') {
      return (
        <Suspense fallback={<PageFallback />}>
          <AdminLogin onLoginSuccess={() => {
            setIsLoggedIn(true);
            window.location.reload();
          }} />
        </Suspense>
      );
    }
    return <div className="h-screen w-full bg-zinc-950 flex items-center justify-center text-purple-500 font-bold">Carregando...</div>;
  }

  // Handle standard routes
  if (!isLoggedIn || (!loading && !user)) {
    return (
      <Suspense fallback={<PageFallback />}>
        <Login onLoginSuccess={() => { setIsLoggedIn(true); loadUser(); }} />
      </Suspense>
    );
  }

  // Show Loading Screen while user data fetches (prevents brief dashboard flash on F5/Login)
  if (loading && !user) {
    return (
      <div className="h-screen w-full bg-bg-main flex flex-col items-center justify-center gap-4 text-accent-cyan font-bold">
        <div className="w-10 h-10 border-4 border-accent-cyan/20 border-t-accent-cyan rounded-full animate-spin"></div>
        <span className="text-xs uppercase tracking-widest text-text-muted">Carregando sistema...</span>
      </div>
    );
  }

  // Handle Mercado Pago return URLs (/payment/success, /payment/failure, /payment/pending)
  if (pathParts[1] === 'payment') {
    const paymentStatus = pathParts[2] || 'success';
    return (
      <Suspense fallback={<PageFallback />}>
        <PaymentResult
          status={paymentStatus}
          onGoToDashboard={() => {
            window.history.replaceState({}, '', '/');
            setActiveSection(paymentStatus === 'failure' ? 'settings' : 'dashboard');
            window.location.href = '/';
          }}
        />
      </Suspense>
    );
  }

  const renderContent = () => {
    if (isTrialExpired) {
      return <Settings user={user} onRefresh={loadUser} isTrialExpired={isTrialExpired} />;
    }

    const deviceRole = localStorage.getItem('mach3_device_role') || user?.company_role || 'gerente';
    if (deviceRole === 'operador' && activeSection !== 'operador') {
      return (
        <div className="p-8 text-center space-y-4 animate-in fade-in duration-300">
          <div className="text-xl font-bold text-red-400">Acesso Restrito ao Operador</div>
          <p className="text-sm text-text-muted">Histórico, Manutenção, Gráficos e Configurações são restritos a Coordenadores e Gerentes.</p>
          <button onClick={() => setActiveSection('operador')} className="px-6 py-2.5 bg-accent-cyan text-black font-bold rounded-xl text-xs uppercase tracking-widest cursor-pointer">
            Voltar ao Terminal do Operador
          </button>
        </div>
      );
    }

    if (user?.features && user.features[activeSection] === false) {
      return (
        <div className="p-8 text-center space-y-4 animate-in fade-in duration-300">
          <div className="text-xl font-bold text-red-400">Recurso não incluído no seu plano</div>
          <p className="text-sm text-text-muted">Entre em contato com o suporte ou atualize seu plano em Configurações.</p>
          <button onClick={() => setActiveSection('settings')} className="px-6 py-2.5 bg-accent-cyan text-black font-bold rounded-xl text-xs uppercase tracking-widest cursor-pointer">
            Ir para Configurações
          </button>
        </div>
      );
    }

    switch (activeSection) {
      case 'dashboard': return <Dashboard jobs={jobs} user={user} routers={routers} onRefresh={fetchData} />;
      case 'operador': return <Operador jobs={jobs} routers={routers} onRefresh={fetchData} />;
      case 'jobs': return <History jobs={jobs} materials={materials} onRefresh={fetchData} user={user} />;
      case 'charts': return <Charts jobs={jobs} />;
      case 'materials': return <Materials materials={materials} onRefresh={fetchData} />;
      case 'maintenance': return <Maintenance maintenance={maintenance} routers={routers} onRefresh={fetchData} user={user} />;
      case 'settings': return <Settings user={user} onRefresh={loadUser} isTrialExpired={isTrialExpired} />;
      case 'encarregado': return <Encarregado jobs={jobs} routers={routers} user={user} />;
      default: return <Dashboard jobs={jobs} user={user} routers={routers} onRefresh={fetchData} />;
    }
  };

  const titles = {
    'dashboard': ['Dashboard', 'Visão geral dos jobs CNC'],
    'operador': ['Operador', 'Terminal de execução e apontamentos de máquinas'],
    'jobs': ['Histórico', 'Registro completo de atividades'],
    'charts': ['Gráficos', 'Análise aprofundada de produção'],
    'materials': ['Materiais', 'Cadastro de insumos e preços'],
    'maintenance': ['Manutenção', 'Agenda e histórico preventivo'],
    'settings': ['Configurações', 'Ajustes de custo e produção'],
    'encarregado': ['Encarregado', 'Planner operacional e checklists'],
  };

  return (
    <div className="flex h-screen bg-bg-main overflow-hidden text-slate-200 relative">
      <Suspense fallback={null}>
        {isTrialExpired && <PaymentModal user={user} />}
        {isDemoTourOpen && <DemoTourModal isOpen={isDemoTourOpen} onClose={() => setIsDemoTourOpen(false)} setActiveSection={setActiveSection} />}
      </Suspense>
      
      <Sidebar 
        activeSection={activeSection} 
        onSectionChange={(section) => {
          if (!isTrialExpired) setActiveSection(section);
          setIsMobileMenuOpen(false);
        }} 
        user={user} 
        maintenance={maintenance}
        isMobileOpen={isMobileMenuOpen}
        setIsMobileOpen={setIsMobileMenuOpen}
        isTrialExpired={isTrialExpired}
      />
      
      <main className="flex-1 flex flex-col overflow-hidden w-full">
        <Header 
          title={titles[activeSection]?.[0] || 'MACH3 Tracker'} 
          subtitle={titles[activeSection]?.[1] || 'Gerenciamento de Fábrica'} 
          user={user} 
          jobs={jobs}
          routers={routers}
          maintenance={maintenance}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenDemoTour={() => setIsDemoTourOpen(true)}
          onSectionChange={(section) => {
            if (!isTrialExpired) setActiveSection(section);
          }}
        />
        
        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
          <Suspense fallback={<PageFallback />}>
            {renderContent()}
          </Suspense>
        </div>
      </main>

      {/* Banner flutuante no estilo WhatsApp que desce do topo e retrai sozinho */}
      <HeadsUpNotification 
        notification={headsUpAlert} 
        onDismiss={() => setHeadsUpAlert(null)} 
        onOpen={() => setActiveSection('jobs')} 
      />
    </div>
  );
}

export default App;
