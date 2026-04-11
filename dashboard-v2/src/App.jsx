import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { api } from './services/api';

// Components
import { Dashboard } from './pages/Dashboard';
import { History } from './pages/History';
import { Charts } from './pages/Charts';
import { Materials } from './pages/Materials';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Admin } from './pages/Admin';

function App() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('mach3_token'));

  // Auth Check & User Data
  const loadUser = async () => {
    try {
      const userData = await api.getMe();
      setUser(userData);
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
      const [jobsData, materialsData] = await Promise.all([
        api.getJobs(),
        api.getMaterials()
      ]);
      setJobs(jobsData);
      setMaterials(materialsData);
      setLoading(false);
    } catch (err) {
      console.error("Fetch failed:", err);
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
    }
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return <Login onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard': return <Dashboard jobs={jobs} user={user} />;
      case 'jobs': return <History jobs={jobs} materials={materials} onRefresh={fetchData} user={user} />;
      case 'charts': return <Charts jobs={jobs} />;
      case 'materials': return <Materials materials={materials} onRefresh={fetchData} />;
      case 'settings': return <Settings user={user} onRefresh={loadUser} />;
      case 'admin': return <Admin user={user} />;
      default: return <Dashboard jobs={jobs} user={user} />;
    }
  };

  const titles = {
    'dashboard': ['Dashboard', 'Visão geral dos jobs CNC'],
    'jobs': ['Histórico', 'Registro completo de atividades'],
    'charts': ['Gráficos', 'Análise aprofundada de produção'],
    'materials': ['Materiais', 'Cadastro de insumos e preços'],
    'settings': ['Configurações', 'Ajustes de custo e produção'],
    'admin': ['Painel Master', 'Gerenciamento avançado do SaaS']
  };

  return (
    <div className="flex h-screen bg-bg-main overflow-hidden text-slate-200">
      <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} user={user} />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title={titles[activeSection][0]} 
          subtitle={titles[activeSection][1]} 
          user={user} 
        />
        
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {renderSection()}
        </div>
      </main>
    </div>
  );
}

export default App;
