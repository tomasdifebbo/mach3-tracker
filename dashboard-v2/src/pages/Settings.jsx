import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Settings as SettingsIcon, 
  ShieldCheck, 
  Clock, 
  Save, 
  Info,
  CheckCircle2,
  ChevronRight,
  AlertCircle,
  Loader2,
  Database,
  FileText,
  Cpu,
  Upload
} from 'lucide-react';
import { api } from '../services/api';

import { SubscriptionPlans } from '../components/SubscriptionPlans';

export function Settings({ user, onRefresh, isTrialExpired }) {
  const [costPerHour, setCostPerHour] = useState(user?.settings?.costPerHour || 50.0);
  const [plannedHours, setPlannedHours] = useState(user?.settings?.plannedHours || 8);
  const [webhookUrl, setWebhookUrl] = useState(user?.settings?.webhookUrl || '');
  const [companyRole, setCompanyRole] = useState(localStorage.getItem('mach3_device_role') || user?.company_role || 'gerente');
  const [savingRole, setSavingRole] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(null); // tracks which plan is loading
  const [status, setStatus] = useState(null);

  const [gerentePin, setGerentePin] = useState('');
  const [supervisorPin, setSupervisorPin] = useState('');
  const [savingPins, setSavingPins] = useState(false);

  // New States for Business Plan Sections
  const [jobsData, setJobsData] = useState([]);
  const [routersCount, setRoutersCount] = useState(0);
  const [companyLogo, setCompanyLogo] = useState(user?.company_logo || localStorage.getItem('mach3_company_logo') || '');
  const [theme, setTheme] = useState(user?.theme || localStorage.getItem('mach3_theme') || 'Escuro');
  const [dailyReport, setDailyReport] = useState(user?.daily_report !== undefined ? user.daily_report : (localStorage.getItem('mach3_daily_report') !== 'false'));
  const [idleAlert, setIdleAlert] = useState(user?.idle_alert !== undefined ? user.idle_alert : (localStorage.getItem('mach3_idle_alert') !== 'false'));
  const [weeklyReport, setWeeklyReport] = useState(user?.weekly_report !== undefined ? user.weekly_report : (localStorage.getItem('mach3_weekly_report') === 'true'));
  const [reportEmail, setReportEmail] = useState(user?.report_email || localStorage.getItem('mach3_report_email') || user?.email || 'tomasdifebbo.tdf@gmail.com');
  const [savingReports, setSavingReports] = useState(false);
  const [cycleLoading, setCycleLoading] = useState(false);
  const [cycleResult, setCycleResult] = useState(null);
  const [reportFeedback, setReportFeedback] = useState(null);

  const isBusinessPlan = user?.plan === 'business' || user?.role === 'admin';

  useEffect(() => {
    if (user) {
      if (user.company_logo) setCompanyLogo(user.company_logo);
      if (user.theme) setTheme(user.theme);
      if (user.report_email) setReportEmail(user.report_email);
      if (user.daily_report !== undefined) setDailyReport(user.daily_report);
      if (user.idle_alert !== undefined) setIdleAlert(user.idle_alert);
      if (user.weekly_report !== undefined) setWeeklyReport(user.weekly_report);
    }
  }, [user]);

  useEffect(() => {
    if (isBusinessPlan) {
      const fetchData = async () => {
        try {
          const jobsResp = await api.getJobs();
          if (jobsResp && Array.isArray(jobsResp)) {
            setJobsData(jobsResp);
          } else if (jobsResp && jobsResp.data && Array.isArray(jobsResp.data)) {
            setJobsData(jobsResp.data);
          }

          const routersResp = await api.getRouters();
          if (routersResp && Array.isArray(routersResp)) {
            setRoutersCount(routersResp.length);
          } else if (routersResp && routersResp.data && Array.isArray(routersResp.data)) {
            setRoutersCount(routersResp.data.length);
          } else if (routersResp && typeof routersResp === 'object') {
             const items = routersResp.data || routersResp.routers || [];
             setRoutersCount(items.length);
          }
        } catch (err) {
          console.error("Error fetching data:", err);
        }
      };
      fetchData();
    }
  }, [isBusinessPlan]);

  const handleRoleChange = async (newRole) => {
    let pin = '';
    if (newRole === 'gerente' && user?.has_gerente_pin) {
      pin = prompt('Digite a Senha do Perfil Gerente:');
      if (pin === null) return;
    } else if (newRole === 'encarregado' && user?.has_supervisor_pin) {
      pin = prompt('Digite a Senha do Perfil Supervisor:');
      if (pin === null) return;
    }

    setSavingRole(true);
    try {
      const verifyResp = await api.verifyPin(newRole, pin);
      if (verifyResp && verifyResp.error) {
        alert(verifyResp.error);
        return;
      }
      localStorage.setItem('mach3_device_role', newRole);
      setCompanyRole(newRole);
      window.location.href = '/';
    } catch (err) {
      alert('Erro ao alterar nível de acesso.');
    } finally {
      setSavingRole(false);
    }
  };

  const handleSavePins = async (e) => {
    e.preventDefault();
    setSavingPins(true);
    try {
      await api.patch('/user/profile-pins', {
        gerente_pin: gerentePin,
        supervisor_pin: supervisorPin
      });
      if (onRefresh) await onRefresh();
      alert('Senhas de proteção dos perfis atualizadas com sucesso!');
      setGerentePin('');
      setSupervisorPin('');
    } catch (err) {
      alert('Erro ao salvar senhas.');
    } finally {
      setSavingPins(false);
    }
  };

  const handleSubscribe = async (plan) => {
    setCheckoutLoading(plan);
    try {
      const resp = await api.createPreference(plan);
      if (resp.init_point) {
        setTimeout(() => { window.location.href = resp.init_point; }, 300);
      } else {
        throw new Error(resp.error || 'Link de pagamento não retornado');
      }
    } catch (err) {
      setStatus({ type: 'error', message: 'Erro ao abrir checkout: ' + (err.message || 'tente novamente') });
      setTimeout(() => setStatus(null), 5000);
      setCheckoutLoading(null);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const resp = await api.updateUserSettings({ 
        costPerHour: parseFloat(costPerHour), 
        plannedHours: parseFloat(plannedHours),
        webhookUrl
      });
      
      if (resp && resp.success) {
        setStatus({ type: 'success', message: 'Configurações salvas na nuvem!' });
        onRefresh();
      } else {
        throw new Error(resp?.error || 'Erro ao salvar');
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Erro de conexão com o servidor.' });
    }
    setLoading(false);
    setTimeout(() => setStatus(null), 3000);
  };

  // Section Handlers
  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        setCompanyLogo(base64);
        localStorage.setItem('mach3_company_logo', base64);
        try {
          await api.saveReportSettings({ company_logo: base64 });
          if (onRefresh) onRefresh();
          setReportFeedback({ type: 'success', message: 'Logo da empresa atualizada e salva com sucesso!' });
        } catch (err) {
          console.error("Erro ao salvar logo:", err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleThemeChange = async (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem('mach3_theme', newTheme);
    const themeKey = newTheme.toLowerCase().includes('claro') 
      ? 'claro' 
      : (newTheme.toLowerCase().includes('azul') ? 'azul' : 'escuro');
    document.documentElement.setAttribute('data-theme', themeKey);
    try {
      await api.saveReportSettings({ theme: newTheme });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error("Erro ao salvar tema:", err);
    }
  };

  const saveReportSettings = async () => {
    setSavingReports(true);
    setReportFeedback(null);
    try {
      localStorage.setItem('mach3_daily_report', dailyReport);
      localStorage.setItem('mach3_idle_alert', idleAlert);
      localStorage.setItem('mach3_weekly_report', weeklyReport);
      localStorage.setItem('mach3_report_email', reportEmail);
      
      await api.saveReportSettings({
        daily_report: dailyReport,
        idle_alert: idleAlert,
        weekly_report: weeklyReport,
        report_email: reportEmail
      });
      if (onRefresh) onRefresh();
      setReportFeedback({ type: 'success', message: 'Configurações de automação salvas com sucesso no banco de dados!' });
    } catch (err) {
      setReportFeedback({ type: 'error', message: 'Erro ao salvar configurações: ' + (err.message || 'tente novamente') });
    } finally {
      setSavingReports(false);
      setTimeout(() => setReportFeedback(null), 5000);
    }
  };

  const handleTriggerCycle = async () => {
    setCycleLoading(true);
    setCycleResult(null);
    setReportFeedback(null);
    try {
      // First persist current settings
      await api.saveReportSettings({
        daily_report: dailyReport,
        idle_alert: idleAlert,
        weekly_report: weeklyReport,
        report_email: reportEmail
      });

      const res = await api.triggerReportCycle({
        report_email: reportEmail,
        daily_report: dailyReport,
        idle_alert: idleAlert
      });

      setCycleResult(res);
      setReportFeedback({
        type: 'success',
        message: `Ciclo executado com sucesso! Relatório gerado e enviado para ${res.recipient}.`
      });
      if (onRefresh) onRefresh();
    } catch (err) {
      setReportFeedback({
        type: 'error',
        message: 'Falha ao executar ciclo: ' + (err.message || 'tente novamente')
      });
    } finally {
      setCycleLoading(false);
    }
  };

  // Section 2 Data Processing
  const formatName = (str) => {
    if (!str || !str.trim()) return 'Desconhecido';
    return str.trim().toLowerCase().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const operatorStats = jobsData.reduce((acc, job) => {
    const op = formatName(job.operator_name);
    acc[op] = (acc[op] || 0) + (Number(job.duration_minutes) || 0);
    return acc;
  }, {});
  const operatorRanking = Object.entries(operatorStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const maxOpMinutes = operatorRanking.length > 0 ? operatorRanking[0][1] : 1;

  const materialStats = jobsData.reduce((acc, job) => {
    if (job.material_name && job.material_name.trim()) {
      const mat = job.material_name.trim().toUpperCase();
      acc[mat] = (acc[mat] || 0) + 1;
    }
    return acc;
  }, {});
  const totalMaterials = Object.values(materialStats).reduce((sum, count) => sum + count, 0) || 1;
  const materialColors = ['bg-cyan-400', 'bg-purple-400', 'bg-amber-400', 'bg-emerald-400', 'bg-rose-400'];
  const materialRanking = Object.entries(materialStats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 md:space-y-12 animate-in fade-in duration-500">
      {isTrialExpired && (
        <div className="mb-8 p-6 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-4 shadow-xl shadow-red-500/5">
          <div className="p-3 bg-red-500/20 text-red-400 rounded-xl">
            <AlertCircle size={28} />
          </div>
          <div>
            <h3 className="text-xl font-black text-red-400 uppercase tracking-widest mb-2">Período de Teste Expirado</h3>
            <p className="text-sm font-medium text-red-200/80 leading-relaxed">
              O seu período de degustação de 30 dias chegou ao fim e o acesso às métricas e históricos foi bloqueado. 
              Para restaurar o acesso imediato ao sistema, por favor assine um dos nossos planos abaixo.
            </p>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-3xl font-black tracking-tighter text-white">Configurações e Assinatura</h2>
        <p className="text-sm font-medium text-text-muted mt-2">Gerencie seus custos de hora máquina e escolha seu plano</p>
      </div>

      {/* Plans Section */}
      <section className="space-y-8">
        {!isBusinessPlan ? (
          <SubscriptionPlans user={user} />
        ) : (
          <div className="space-y-8">
            {/* 1. Plan Status Card */}
            <div className="glass p-8 md:p-10 rounded-[32px] md:rounded-[40px] flex flex-col md:flex-row md:items-center justify-between gap-6 border-l-4 border-l-accent-cyan">
              <div>
                <h3 className="text-3xl font-black text-white flex items-center gap-3">
                  <span className="text-4xl">💎</span> Plano Atual: BUSINESS Premium
                </h3>
                <div className="flex items-center gap-3 mt-4">
                  <span className="bg-accent-success/20 text-accent-success border border-accent-success/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 size={14} /> Ativo
                  </span>
                  <span className="text-text-muted text-sm font-medium">Próxima renovação: {user?.plan_renewal || '—'}</span>
                </div>
              </div>
              <button className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all" onClick={() => alert('Gerenciar pagamento em breve')}>
                Gerenciar Pagamento
              </button>
            </div>

            {/* 2. Efficiency Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card A */}
              <div className="glass p-8 rounded-[32px] space-y-6">
                <h4 className="text-xl font-bold text-white mb-2">Ranking de Eficiência dos Operadores</h4>
                <div className="space-y-4">
                  {operatorRanking.length > 0 ? operatorRanking.map(([op, mins], idx) => {
                    const hours = (mins / 60).toFixed(1);
                    const pct = Math.min(100, Math.round((mins / maxOpMinutes) * 100));
                    return (
                      <div key={op} className="space-y-1.5">
                        <div className="flex justify-between text-sm">
                          <span className="text-white font-medium">{op}</span>
                          <span className="text-text-muted font-bold">{hours}h</span>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-accent-cyan rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="text-sm text-text-muted">Nenhum dado encontrado.</div>
                  )}
                </div>
              </div>

              {/* Card B */}
              <div className="glass p-8 rounded-[32px] space-y-6">
                <h4 className="text-xl font-bold text-white mb-2">Distribuição de Materiais</h4>
                {materialRanking.length > 0 ? (
                  <>
                    <div className="h-4 w-full flex rounded-full overflow-hidden mb-6">
                      {materialRanking.map(([mat, count], idx) => {
                        const pct = (count / totalMaterials) * 100;
                        return (
                          <div key={mat} className={`h-full ${materialColors[idx % materialColors.length]}`} style={{ width: `${pct}%` }}></div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {materialRanking.map(([mat, count], idx) => {
                        const pct = Math.round((count / totalMaterials) * 100);
                        return (
                          <div key={mat} className="flex items-center gap-2 text-sm">
                            <div className={`w-3 h-3 rounded-full ${materialColors[idx % materialColors.length]}`}></div>
                            <span className="text-white truncate" title={mat}>{mat}</span>
                            <span className="text-text-muted font-bold ml-auto">{pct}%</span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-text-muted">Nenhum dado encontrado.</div>
                )}
              </div>
            </div>

            {/* 3. System Usage */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass p-6 rounded-[32px] flex items-center gap-4">
                <div className="p-4 bg-accent-success/10 text-accent-success rounded-2xl">
                  <Database size={28} />
                </div>
                <div>
                  <div className="text-xs text-text-muted font-medium mb-1">Database Status</div>
                  <div className="text-xl font-bold text-white">Saudável</div>
                  <div className="text-[10px] text-text-muted mt-1">PostgreSQL + Supabase</div>
                </div>
              </div>
              <div className="glass p-6 rounded-[32px] flex items-center gap-4">
                <div className="p-4 bg-accent-cyan/10 text-accent-cyan rounded-2xl">
                  <FileText size={28} />
                </div>
                <div>
                  <div className="text-xs text-text-muted font-medium mb-1">Trabalhos Registrados</div>
                  <div className="text-xl font-bold text-white">{jobsData.length}</div>
                  <div className="text-[10px] text-text-muted mt-1">Desde o início</div>
                </div>
              </div>
              <div className="glass p-6 rounded-[32px] flex items-center gap-4">
                <div className="p-4 bg-purple-500/10 text-purple-400 rounded-2xl">
                  <Cpu size={28} />
                </div>
                <div>
                  <div className="text-xs text-text-muted font-medium mb-1">Máquinas Ativas</div>
                  <div className="text-xl font-bold text-white">{routersCount}</div>
                  <div className="text-[10px] text-text-muted mt-1">Conectadas ao sistema</div>
                </div>
              </div>
            </div>

            {/* 4. Company Personalization */}
            <div className="glass p-8 rounded-[32px] space-y-6">
              <h4 className="text-xl font-bold text-white">Personalização da Empresa</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="text-xs text-text-muted font-bold block mb-3 uppercase tracking-wider">Logo da Empresa</label>
                  <label className="border-2 border-dashed border-white/10 hover:border-accent-cyan/50 bg-white/5 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all min-h-[140px]">
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    {companyLogo ? (
                      <img src={companyLogo} alt="Company Logo" className="max-h-20 object-contain" />
                    ) : (
                      <>
                        <Upload size={24} className="text-text-muted" />
                        <span className="text-sm font-medium text-text-muted">Clique para enviar a logo</span>
                      </>
                    )}
                  </label>
                </div>
                <div>
                  <label className="text-xs text-text-muted font-bold block mb-3 uppercase tracking-wider">Tema do Sistema</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Escuro', 'Claro', 'Azul Corporativo'].map(t => (
                      <div 
                        key={t}
                        onClick={() => handleThemeChange(t)}
                        className={`p-4 rounded-xl border text-center cursor-pointer transition-all ${theme === t ? 'bg-accent-cyan/10 border-accent-cyan text-white' : 'bg-white/5 border-white/5 text-text-muted hover:border-white/20'}`}
                      >
                        <div className={`w-full h-8 rounded-lg mb-2 ${t === 'Escuro' ? 'bg-zinc-900' : t === 'Claro' ? 'bg-gray-100' : 'bg-blue-900'}`}></div>
                        <span className="text-xs font-bold">{t}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 5. Report Automation */}
            <div className="glass p-8 rounded-[32px] space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-xl font-bold text-white flex items-center gap-2">
                    <span className="text-accent-cyan">⚡</span> Automação de Relatórios & Monitoramento
                  </h4>
                  <p className="text-xs text-text-muted mt-1">Disparo programado de resumos de produção e alertas de ociosidade por e-mail</p>
                </div>
                
                <button
                  onClick={handleTriggerCycle}
                  disabled={cycleLoading}
                  className="px-5 py-2.5 bg-gradient-to-r from-accent-cyan to-accent-blue text-black font-black text-xs uppercase tracking-wider rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-accent-cyan/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  title="Executa imediatamente o ciclo de análise, detecção de máquinas paradas e disparo de e-mail"
                >
                  {cycleLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                      <span>Executando Ciclo...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={14} className="fill-black" />
                      <span>Executar Ciclo Agora</span>
                    </>
                  )}
                </button>
              </div>

              {/* Feedback Alert */}
              {reportFeedback && (
                <div className={`p-4 rounded-xl border text-sm font-medium flex items-center gap-3 animate-in fade-in duration-300 ${
                  reportFeedback.type === 'success' 
                    ? 'bg-accent-success/10 border-accent-success/30 text-accent-success' 
                    : 'bg-accent-danger/10 border-accent-danger/30 text-accent-danger'
                }`}>
                  {reportFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{reportFeedback.message}</span>
                </div>
              )}

              {/* Cycle Execution Result Card */}
              {cycleResult && (
                <div className="p-6 bg-accent-cyan/5 border border-accent-cyan/30 rounded-2xl space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📊</span>
                      <span className="font-bold text-white text-sm uppercase tracking-wider">Resultado do Ciclo Executado</span>
                    </div>
                    <span className="text-xs bg-accent-cyan/20 text-accent-cyan font-bold px-3 py-1 rounded-full border border-accent-cyan/30 flex items-center gap-1">
                      <CheckCircle2 size={12} /> Concluído
                    </span>
                  </div>

                  <p className="text-xs text-text-muted">{cycleResult.summary}</p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="text-[10px] text-text-muted uppercase font-bold">Trabalhos Hoje</div>
                      <div className="text-lg font-black text-white mt-1">{cycleResult.totalJobs}</div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="text-[10px] text-text-muted uppercase font-bold">Horas Usinagem</div>
                      <div className="text-lg font-black text-accent-cyan mt-1">{cycleResult.totalHours}h</div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="text-[10px] text-text-muted uppercase font-bold">Custo Estimado</div>
                      <div className="text-lg font-black text-accent-success mt-1">{cycleResult.totalCost}</div>
                    </div>
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="text-[10px] text-text-muted uppercase font-bold">Máquinas Paradas</div>
                      <div className={`text-lg font-black mt-1 ${cycleResult.idleMachines?.length > 0 ? 'text-accent-danger' : 'text-accent-success'}`}>
                        {cycleResult.idleMachines?.length || 0}
                      </div>
                    </div>
                  </div>

                  {cycleResult.idleMachines?.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <div className="text-xs font-bold text-accent-danger flex items-center gap-1.5">
                        <AlertCircle size={14} />
                        <span>Máquinas em alerta de ociosidade (&gt; 1 hora sem corte):</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {cycleResult.idleMachines.map((m, i) => (
                          <div key={i} className="text-xs bg-red-500/10 border border-red-500/20 p-2.5 rounded-xl flex items-center justify-between">
                            <span className="font-semibold text-white truncate mr-2">{m.name}</span>
                            <span className="text-red-400 font-bold shrink-0">{m.idleFormatted}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-4 max-w-2xl">
                {[
                  { label: 'Resumo diário de produção por e-mail às 18:00', state: dailyReport, setter: setDailyReport },
                  { label: 'Alerta de máquina parada por mais de 1 hora', state: idleAlert, setter: setIdleAlert },
                  { label: 'Relatório semanal de custos (toda segunda-feira)', state: weeklyReport, setter: setWeeklyReport },
                ].map((item, idx) => (
                  <label key={idx} className="flex items-center gap-4 cursor-pointer group">
                    <div className={`w-12 h-6 rounded-full transition-colors relative ${item.state ? 'bg-accent-cyan' : 'bg-white/10'}`}>
                      <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${item.state ? 'translate-x-6' : ''}`}></div>
                    </div>
                    <input type="checkbox" className="hidden" checked={item.state} onChange={(e) => item.setter(e.target.checked)} />
                    <span className="text-sm font-medium text-white group-hover:text-accent-cyan transition-colors">{item.label}</span>
                  </label>
                ))}
                
                <div className="pt-4 space-y-2">
                  <label className="text-xs text-text-muted font-bold block uppercase tracking-wider">E-mail para receber os relatórios</label>
                  <div className="flex gap-3">
                    <input 
                      type="email" 
                      value={reportEmail}
                      onChange={(e) => setReportEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="flex-1 bg-white/5 border border-border px-4 py-3 rounded-xl outline-none focus:border-accent-cyan/50 text-white text-sm"
                    />
                    <button 
                      onClick={saveReportSettings}
                      disabled={savingReports}
                      className="px-6 py-3 bg-accent-cyan text-black font-bold text-sm uppercase tracking-wider rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-accent-cyan/20 cursor-pointer disabled:opacity-50"
                    >
                      {savingReports ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Nível de Acesso da Empresa */}
      <section className="glass p-6 md:p-10 rounded-[32px] md:rounded-[40px] space-y-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Nível de Acesso da Empresa</h3>
            <p className="text-xs text-text-muted">Alterne o perfil da conta para limitar ou liberar funcionalidades conforme a função do usuário.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { id: 'gerente', title: 'Gerente da Fábrica', icon: '👑', desc: 'Acesso total a todas as áreas, relatórios e configurações financeiras' },
            { id: 'encarregado', title: 'Encarregado de Produção', icon: '👷', desc: 'Acesso a Dashboard, Kanban de O.S., Manutenção, Estoque e Gráficos' },
            { id: 'operador', title: 'Operador de Maquinário', icon: '🧑‍🔧', desc: 'Terminal do Operador focado no chão de fábrica, O.S. e checklists' },
          ].map(r => {
            const isSelected = companyRole === r.id;
            return (
              <div
                key={r.id}
                onClick={() => handleRoleChange(r.id)}
                className={`p-5 rounded-3xl border transition-all cursor-pointer flex flex-col justify-between select-none group hover:scale-[1.02] ${
                  isSelected 
                    ? 'bg-purple-500/15 border-purple-500 text-white shadow-xl shadow-purple-500/10 ring-2 ring-purple-500/30' 
                    : 'bg-white/5 border-white/5 text-text-muted hover:border-white/20'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl">{r.icon}</span>
                    {isSelected ? (
                      <span className="text-[9px] font-black uppercase tracking-wider bg-purple-500 text-black px-2.5 py-1 rounded-full">ATIVO</span>
                    ) : (
                      <span className="text-[9px] font-bold uppercase text-text-muted opacity-60">Clique p/ Selecionar</span>
                    )}
                  </div>
                  <h4 className="font-extrabold text-white text-base mb-1.5 group-hover:text-purple-300 transition-colors">{r.title}</h4>
                  <p className="text-xs text-text-muted leading-relaxed">{r.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Form para Definir Senhas dos Perfis */}
        <form onSubmit={handleSavePins} className="pt-6 border-t border-white/10 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-purple-400" />
            <h4 className="text-sm font-bold text-white">Proteção por Senha dos Perfis</h4>
          </div>
          <p className="text-xs text-text-muted">Defina uma senha para restringir a mudança para os perfis de Gerente ou Supervisor, evitando que operadores alterem configurações.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1.5">
                Senha do Perfil Gerente (👑) {user?.has_gerente_pin && <span className="text-accent-success">(Protegido por Senha)</span>}
              </label>
              <input
                type="password"
                placeholder={user?.has_gerente_pin ? '•••• (Digite para alterar)' : 'Criar senha do Gerente (opcional)'}
                value={gerentePin}
                onChange={(e) => setGerentePin(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted block mb-1.5">
                Senha do Perfil Supervisor (👷) {user?.has_supervisor_pin && <span className="text-accent-success">(Protegido por Senha)</span>}
              </label>
              <input
                type="password"
                placeholder={user?.has_supervisor_pin ? '•••• (Digite para alterar)' : 'Criar senha do Supervisor (opcional)'}
                value={supervisorPin}
                onChange={(e) => setSupervisorPin(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-purple-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingPins || (!gerentePin && !supervisorPin)}
              className="px-5 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 text-black font-black uppercase text-xs rounded-xl transition-all shadow-lg shadow-purple-500/20 cursor-pointer"
            >
              {savingPins ? 'Salvação...' : 'Salvar Senhas dos Perfis'}
            </button>
          </div>
        </form>
      </section>

      <hr className="border-border/50" />

      {/* Machine / Cost Settings */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="glass p-10 rounded-[40px] space-y-8 h-fit">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/10 text-white rounded-2xl">
              <SettingsIcon size={24} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Configurações de Produção</h3>
              <p className="text-xs text-text-muted">Ajuste os valores base para cálculo de custos e metas.</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Valor da Hora Máquina (R$)</label>
              <div className="relative group">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-bold group-focus-within:text-accent-cyan">R$</span>
                 <input 
                    type="number" 
                    value={costPerHour}
                    onChange={(e) => setCostPerHour(e.target.value)}
                    className="w-full bg-white/5 border border-border px-12 py-3.5 rounded-2xl outline-none focus:border-accent-cyan/50 focus:bg-white/[0.08] transition-all text-white font-bold" 
                  />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-1">Horas Planejadas por Dia (Meta OEE)</label>
              <div className="relative group">
                 <Clock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-cyan" />
                 <input 
                    type="number" 
                    value={plannedHours}
                    onChange={(e) => setPlannedHours(e.target.value)}
                    className="w-full bg-white/5 border border-border px-12 py-3.5 rounded-2xl outline-none focus:border-accent-cyan/50 focus:bg-white/[0.08] transition-all text-white font-bold" 
                  />
              </div>
            </div>

            <button 
              onClick={handleSaveSettings}
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-4 bg-accent-cyan text-black rounded-2xl hover:scale-[1.02] active:scale-95 transition-all font-black uppercase tracking-widest text-xs shadow-lg shadow-accent-cyan/20 disabled:opacity-50"
            >
               <Save size={18} /> {loading ? 'Salvando...' : 'Salvar Parâmetros'}
            </button>

            {status && (
              <div className={`flex items-center gap-2 p-3 rounded-xl text-xs font-bold border animate-in fade-in duration-300 ${status.type === 'success' ? 'bg-accent-success/10 border-accent-success/30 text-accent-success' : 'bg-accent-danger/10 border-accent-danger/30 text-accent-danger'}`}>
                {status.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {status.message}
              </div>
            )}
          </div>
        </div>

        <div className="glass p-10 rounded-[40px] space-y-6 h-fit bg-gradient-to-bl from-white/5 to-transparent">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/10 text-white rounded-2xl">
               <ShieldCheck size={24} />
            </div>
            <h3 className="text-xl font-bold">Segurança e Dados</h3>
          </div>
          
          <div className="space-y-4">
             <div className="flex flex-col gap-2 p-4 bg-white/5 rounded-2xl border border-border/50">
                <div className="space-y-0.5 mb-2">
                   <div className="text-sm font-bold text-white">Endpoint de Webhook</div>
                   <div className="text-[10px] font-medium text-text-muted">URL para receber POST quando um job terminar</div>
                </div>
                <div className="relative group">
                   <input 
                     type="url"
                     value={webhookUrl}
                     onChange={(e) => setWebhookUrl(e.target.value)}
                     placeholder="https://seu-erp.com.br/api/mach3-webhook"
                     className="w-full bg-white/5 border border-border px-4 py-3 rounded-xl outline-none focus:border-accent-cyan/50 focus:bg-white/[0.08] transition-all text-white text-sm font-medium"
                   />
                </div>
                <button 
                  onClick={handleSaveSettings}
                  disabled={loading}
                  className="mt-2 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all"
                >
                  Salvar Webhook
                </button>
             </div>
             
             <div className="bg-accent-blue/10 border border-accent-blue/30 rounded-2xl p-6 flex gap-4">
               <Info size={24} className="text-accent-blue shrink-0" />
               <p className="text-xs text-accent-blue leading-relaxed font-semibold">
                 Seus dados estão protegidos por criptografia AES-256 e backups diários automáticos. Os logs do Mach3 são transmitidos de forma segura via porta 3000.
               </p>
             </div>
          </div>
        </div>
      </section>
    </div>
  );
}
