import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { api } from './services/api';

// Components
import { Dashboard } from './pages/Dashboard';
import { History } from './pages/History';
import { Charts } from './pages/Charts';
import { Materials } from './pages/Materials';
import { Maintenance } from './pages/Maintenance';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { AdminPortal } from './pages/AdminPortal';
import { AdminLogin } from './pages/AdminLogin';
import { PaymentResult } from './pages/PaymentResult';
import { PaymentModal } from './components/PaymentModal';
import { Encarregado } from './pages/Encarregado';
import { Operador } from './pages/Operador';

function App() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [routers, setRouters] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('mach3_token'));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTrialExpired, setIsTrialExpired] = useState(false);

  // Auth Check & User Data
  const loadUser = async () => {
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

      // Feature / Expiration Redirection Check
      if (trialExpired) {
        setActiveSection('settings');
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
    }
  };

  // Data Polling
  const fetchData = async () => {
    if (!isLoggedIn) return;
    try {
      const [jobsData, materialsData, routersData, maintenanceData] = await Promise.all([
        api.getJobs(),
        api.getMaterials(),
        api.getRouters(),
        api.getMaintenance()
      ]);
      if (Array.isArray(jobsData)) setJobs(jobsData);
      if (Array.isArray(materialsData)) setMaterials(materialsData);
      if (Array.isArray(routersData)) setRouters(routersData);
      if (Array.isArray(maintenanceData)) setMaintenance(maintenanceData);
      setLoading(false);
    } catch (err) {
      console.error("Fetch failed:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      const init = async () => {
        await loadUser();
        await fetchData();
      };
      init();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    } else {
      setLoading(false);
    }
  }, [isLoggedIn]);

  // Handle Admin Portal Route (/admin)
  const pathParts = window.location.pathname.split('/');
  const isAdminRoute = pathParts[1] === 'admin';

  if (isAdminRoute) {
    if (!isLoggedIn) {
      return <AdminLogin onLoginSuccess={() => {
        setIsLoggedIn(true);
        window.location.reload();
      }} />;
    }
    if (user && user.role === 'admin') {
      return <AdminPortal />;
    } else if (user && user.role !== 'admin') {
      return <AdminLogin onLoginSuccess={() => {
        setIsLoggedIn(true);
        window.location.reload();
      }} />;
    }
    return <div className="h-screen w-full bg-zinc-950 flex items-center justify-center text-purple-500 font-bold">Carregando...</div>;
  }

  // Handle standard routes
  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  // Show Loading Screen while user data fetches (prevents brief dashboard flash on F5/Login)
  if (loading || !user) {
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
      <PaymentResult
        status={paymentStatus}
        onGoToDashboard={() => {
          window.history.replaceState({}, '', '/');
          setActiveSection(paymentStatus === 'failure' ? 'settings' : 'dashboard');
          window.location.href = '/';
        }}
      />
    );
  }

  const renderSection = () => {
    if (isTrialExpired) {
      return <Settings user={user} onRefresh={loadUser} isTrialExpired={isTrialExpired} />;
    }

    if (user?.company_role === 'operador' && activeSection === 'settings') {
      return (
        <div className="p-8 text-center space-y-4 animate-in fade-in duration-300">
          <div className="text-xl font-bold text-red-400">Acesso Restrito ao Operador</div>
          <p className="text-sm text-text-muted">As configurações do sistema são restritas ao perfil de Gerente.</p>
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
      case 'encarregado': return <Encarregado jobs={jobs} />;
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
      {isTrialExpired && <PaymentModal user={user} />}
      
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
          title={titles[activeSection][0]} 
          subtitle={titles[activeSection][1]} 
          user={user} 
          jobs={jobs}
          routers={routers}
          maintenance={maintenance}
          onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onSectionChange={(section) => {
            if (!isTrialExpired) setActiveSection(section);
          }}
        />
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}

export default App;
