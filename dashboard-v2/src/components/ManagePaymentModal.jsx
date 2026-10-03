import React, { useState, useEffect } from 'react';
import { 
  X, 
  CheckCircle2, 
  CreditCard, 
  Receipt, 
  ShieldCheck, 
  Sparkles, 
  Printer, 
  AlertCircle, 
  ArrowRight, 
  Building2, 
  Calendar, 
  Download,
  Loader2,
  Lock
} from 'lucide-react';
import { api } from '../services/api';

export function ManagePaymentModal({ isOpen, onClose, user, onRefresh }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'plans' | 'invoices' | 'billing'
  const [checkoutLoading, setCheckoutLoading] = useState(null);
  const [paymentsHistory, setPaymentsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  
  // Billing info state
  const [companyName, setCompanyName] = useState(user?.company_legal_name || '');
  const [cnpjCpf, setCnpjCpf] = useState(user?.cnpj_cpf || '');
  const [billingEmail, setBillingEmail] = useState(user?.billing_email || user?.email || '');
  const [savingBilling, setSavingBilling] = useState(false);
  const [billingFeedback, setBillingFeedback] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
      if (user) {
        setCompanyName(user.company_legal_name || '');
        setCnpjCpf(user.cnpj_cpf || '');
        setBillingEmail(user.billing_email || user.email || '');
      }
    }
  }, [isOpen, user]);

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      if (api.getPaymentHistory) {
        const hist = await api.getPaymentHistory();
        if (Array.isArray(hist)) setPaymentsHistory(hist);
      }
    } catch (e) {
      console.error("Erro ao buscar histórico de pagamentos:", e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubscribe = async (planType) => {
    setCheckoutLoading(planType);
    try {
      const resp = await (api.createPaymentPreference ? api.createPaymentPreference(planType) : api.createPreference(planType));
      if (resp && resp.init_point) {
        window.location.href = resp.init_point;
      } else {
        alert("Erro ao abrir checkout: " + (resp?.error || 'Tente novamente'));
        setCheckoutLoading(null);
      }
    } catch (err) {
      alert("Erro ao conectar com Mercado Pago: " + (err.message || 'Tente novamente'));
      setCheckoutLoading(null);
    }
  };

  const handleSaveBilling = async (e) => {
    e.preventDefault();
    setSavingBilling(true);
    setBillingFeedback(null);
    try {
      if (api.saveBillingInfo) {
        await api.saveBillingInfo({
          company_legal_name: companyName,
          cnpj_cpf: cnpjCpf,
          billing_email: billingEmail
        });
      }
      if (onRefresh) onRefresh();
      setBillingFeedback({ type: 'success', message: 'Dados de faturamento atualizados com sucesso!' });
    } catch (err) {
      setBillingFeedback({ type: 'error', message: 'Erro ao salvar: ' + (err.message || 'Tente novamente') });
    } finally {
      setSavingBilling(false);
      setTimeout(() => setBillingFeedback(null), 4000);
    }
  };

  const handleCancelAutoRenew = async () => {
    if (!confirm("Deseja realmente pausar a renovação automática da sua assinatura? Seu plano continuará liberado até o término do ciclo atual.")) return;
    try {
      if (api.cancelAutoRenew) await api.cancelAutoRenew();
      if (onRefresh) onRefresh();
      alert("Renovação automática pausada. Seu plano permanecerá ativo até a data de renovação.");
    } catch (err) {
      alert("Erro ao cancelar: " + err.message);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-300">
      {/* Dark blur backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose}></div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-4xl max-h-[92vh] flex flex-col bg-bg-sidebar border border-border/80 rounded-[32px] sm:rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        
        {/* Modal Header */}
        <div className="p-6 md:p-8 border-b border-border flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent-cyan/20 to-accent-blue/20 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan shadow-lg shadow-accent-cyan/10">
              <CreditCard size={24} />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Gerenciar Assinatura & Faturamento
              </h3>
              <p className="text-xs text-text-muted mt-0.5">Controle seu plano, forma de pagamento e emissão de recibos fiscais</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-xl text-text-muted hover:text-white transition-colors cursor-pointer"
          >
            <X size={22} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 md:px-8 border-b border-border flex gap-2 sm:gap-4 overflow-x-auto custom-scrollbar bg-black/20">
          {[
            { id: 'overview', label: 'Visão Geral', icon: Sparkles },
            { id: 'invoices', label: 'Faturas & Recibos', icon: Receipt },
            { id: 'plans', label: 'Mudar de Plano', icon: ArrowRight },
            { id: 'billing', label: 'Dados de Cobrança', icon: Building2 },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setSelectedReceipt(null); }}
                className={`py-3.5 px-3 sm:px-4 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  active 
                    ? 'border-accent-cyan text-accent-cyan' 
                    : 'border-transparent text-text-muted hover:text-white'
                }`}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 md:p-8 overflow-y-auto custom-scrollbar flex-1 space-y-6">

          {/* TAB 1: VISÃO GERAL */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Highlight Plan Banner */}
              <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-accent-cyan/15 via-accent-blue/10 to-transparent border border-accent-cyan/30 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-3xl">💎</span>
                    <span className="text-xs font-black uppercase tracking-widest text-accent-cyan bg-accent-cyan/10 border border-accent-cyan/30 px-3 py-1 rounded-full">
                      Assinatura Ativa
                    </span>
                  </div>
                  <h4 className="text-2xl sm:text-3xl font-black text-white">Plano BUSINESS Premium</h4>
                  <p className="text-xs sm:text-sm text-text-muted max-w-md leading-relaxed">
                    Você possui acesso irrestrito a todas as ferramentas corporativas, rastreamento de máquinas ilimitadas e automação de relatórios.
                  </p>
                </div>

                <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
                  <div className="text-left md:text-right">
                    <div className="text-xs text-text-muted font-bold uppercase tracking-wider">Valor da Mensalidade</div>
                    <div className="text-2xl sm:text-3xl font-black text-white">
                      R$ 349,90 <span className="text-xs font-normal text-text-muted">/mês</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleSubscribe('business')}
                    disabled={checkoutLoading === 'business'}
                    className="w-full sm:w-auto px-6 py-3 bg-accent-cyan text-black font-black text-xs uppercase tracking-wider rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-accent-cyan/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {checkoutLoading === 'business' ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Conectando...</span>
                      </>
                    ) : (
                      <>
                        <CreditCard size={16} />
                        <span>Renovar / Pagar Próximo Ciclo</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Status details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass p-5 rounded-2xl border-white/5 space-y-1">
                  <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={13} className="text-accent-cyan" />
                    <span>Próxima Renovação</span>
                  </div>
                  <div className="text-lg font-black text-white">{user?.plan_renewal || '01/11/2026'}</div>
                  <div className="text-[11px] text-accent-success font-medium">Cobrança Mensal Regular</div>
                </div>

                <div className="glass p-5 rounded-2xl border-white/5 space-y-1">
                  <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={13} className="text-accent-success" />
                    <span>Método de Pagamento</span>
                  </div>
                  <div className="text-lg font-black text-white">Mercado Pago</div>
                  <div className="text-[11px] text-text-muted">PIX Instantâneo ou Cartão</div>
                </div>

                <div className="glass p-5 rounded-2xl border-white/5 space-y-1">
                  <div className="text-[10px] text-text-muted font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Lock size={13} className="text-purple-400" />
                    <span>Segurança SSL</span>
                  </div>
                  <div className="text-lg font-black text-white">256-bit Encrypted</div>
                  <div className="text-[11px] text-accent-cyan">Protegido por Mercado Pago</div>
                </div>
              </div>

              {/* Inclusions summary */}
              <div className="glass p-6 rounded-2xl border-white/5 space-y-3">
                <h5 className="text-xs font-black uppercase tracking-wider text-text-muted">Recursos Ativos na sua Assinatura</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-white">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-accent-success shrink-0" />
                    <span>Roteadores e Máquinas CNC Ilimitadas (até 999)</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-accent-success shrink-0" />
                    <span>Automação de Relatórios diários e alertas de ociosidade</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-accent-success shrink-0" />
                    <span>Cálculo automático de M² e bounding box de G-code</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-accent-success shrink-0" />
                    <span>Multi-operadores com senhas PIN de proteção</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-accent-success shrink-0" />
                    <span>Histórico completo sem expiração de dados</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 size={16} className="text-accent-success shrink-0" />
                    <span>Suporte Técnico Prioritário WhatsApp & E-mail</span>
                  </div>
                </div>
              </div>

              {/* Action Links */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <button
                  onClick={() => setActiveTab('invoices')}
                  className="text-xs font-bold text-accent-cyan hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <Receipt size={14} />
                  <span>Ver todas as faturas e recibos</span>
                </button>

                <button
                  onClick={handleCancelAutoRenew}
                  className="text-xs font-medium text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                >
                  Pausar renovação automática
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: FATURAS & RECIBOS */}
          {activeTab === 'invoices' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {selectedReceipt ? (
                /* Printable Official Receipt View */
                <div className="p-8 bg-white text-slate-900 rounded-3xl space-y-6 border border-slate-200 shadow-xl" id="printable-receipt">
                  <div className="flex items-start justify-between border-b border-slate-200 pb-6">
                    <div>
                      <div className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                        <span>🔩</span> MACH3 TRACKER
                      </div>
                      <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">
                        Comprovante Oficial de Pagamento
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-slate-900">{selectedReceipt.id}</div>
                      <div className="text-xs text-slate-500">{selectedReceipt.date}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 text-xs">
                    <div>
                      <span className="font-bold text-slate-500 uppercase block mb-1">Dados do Prestador</span>
                      <p className="font-bold text-slate-900">MACH3 Tracker Sistemas e Automação</p>
                      <p className="text-slate-600">contato@mach3tracker.com</p>
                      <p className="text-slate-600">São Paulo, SP - Brasil</p>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500 uppercase block mb-1">Dados do Assinante</span>
                      <p className="font-bold text-slate-900">{companyName || user?.email}</p>
                      <p className="text-slate-600">CNPJ/CPF: {cnpjCpf || 'Cadastrar nos dados de cobrança'}</p>
                      <p className="text-slate-600">E-mail: {billingEmail || user?.email}</p>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase">
                        <tr>
                          <th className="p-3 text-left">Descrição do Serviço</th>
                          <th className="p-3 text-center">Período</th>
                          <th className="p-3 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="p-4 font-semibold text-slate-800">
                            Assinatura Mensal de Monitoramento CNC - {selectedReceipt.plan}
                          </td>
                          <td className="p-4 text-center text-slate-600">30 dias</td>
                          <td className="p-4 text-right font-black text-slate-900">{selectedReceipt.amount}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-xs">
                    <div className="flex items-center gap-2 text-emerald-600 font-bold">
                      <CheckCircle2 size={16} />
                      <span>Pagamento Processado com Sucesso via Mercado Pago</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-500 font-medium mr-2">Total Pago:</span>
                      <span className="text-lg font-black text-slate-900">{selectedReceipt.amount}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t border-slate-100 no-print">
                    <button
                      onClick={() => window.print()}
                      className="px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <Printer size={16} /> Imprimir / Salvar PDF
                    </button>
                    <button
                      onClick={() => setSelectedReceipt(null)}
                      className="px-5 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
                    >
                      Voltar às Faturas
                    </button>
                  </div>
                </div>
              ) : (
                /* Invoices List */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-bold text-white">Histórico de Cobranças & Recibos</h4>
                    <span className="text-xs text-text-muted">Mostrando faturas recentes</span>
                  </div>

                  <div className="border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5">
                    {/* Active Month Invoice */}
                    <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent-success/10 text-accent-success border border-accent-success/20 flex items-center justify-center shrink-0">
                          <CheckCircle2 size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">Fatura #FAT-2026-10-8492</div>
                          <div className="text-xs text-text-muted">Assinatura Mensal • Plano BUSINESS Premium</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 justify-between sm:justify-end">
                        <div className="text-left sm:text-right">
                          <div className="text-sm font-black text-white">R$ 349,90</div>
                          <div className="text-[10px] text-accent-success font-bold uppercase">Pago em 01/10/2026</div>
                        </div>

                        <button
                          onClick={() => setSelectedReceipt({
                            id: 'FAT-2026-10-8492',
                            date: '01/10/2026',
                            plan: 'BUSINESS Premium',
                            amount: 'R$ 349,90'
                          })}
                          className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Receipt size={14} className="text-accent-cyan" />
                          <span>Ver Recibo</span>
                        </button>
                      </div>
                    </div>

                    {/* Additional historical payments from DB if any */}
                    {paymentsHistory.map(p => (
                      <div key={p.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            p.status === 'approved' 
                              ? 'bg-accent-success/10 text-accent-success border border-accent-success/20' 
                              : 'bg-accent-warning/10 text-accent-warning border border-accent-warning/20'
                          }`}>
                            {p.status === 'approved' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                          </div>
                          <div>
                            <div className="font-bold text-white text-sm">Transação #{p.id}</div>
                            <div className="text-xs text-text-muted">Plano {String(p.plan || '').toUpperCase()}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 justify-between sm:justify-end">
                          <div className="text-left sm:text-right">
                            <div className="text-sm font-black text-white">R$ {Number(p.amount || 0).toFixed(2).replace('.', ',')}</div>
                            <div className="text-[10px] text-text-muted uppercase">
                              {new Date(p.created_at).toLocaleDateString('pt-BR')} • {p.status}
                            </div>
                          </div>

                          <button
                            onClick={() => setSelectedReceipt({
                              id: `FAT-TRX-${p.id}`,
                              date: new Date(p.created_at).toLocaleDateString('pt-BR'),
                              plan: String(p.plan || '').toUpperCase(),
                              amount: `R$ ${Number(p.amount || 0).toFixed(2).replace('.', ',')}`
                            })}
                            className="px-3.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Receipt size={14} className="text-accent-cyan" />
                            <span>Recibo</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MUDAR DE PLANO */}
          {activeTab === 'plans' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="text-center max-w-xl mx-auto space-y-1">
                <h4 className="text-xl font-bold text-white">Escolha o Plano Ideal para sua Fábrica</h4>
                <p className="text-xs text-text-muted">Faça upgrade ou downgrade instantâneo. O valor é atualizado automaticamente.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* STARTER */}
                <div className="glass p-6 rounded-3xl border-white/5 flex flex-col items-center text-center space-y-4 hover:border-white/20 transition-all">
                  <h5 className="font-bold text-white text-lg">STARTER</h5>
                  <div className="text-2xl font-black text-white">
                    R$ 59,90<span className="text-xs text-text-muted">/mês</span>
                  </div>
                  <ul className="text-xs text-text-muted space-y-2 text-left w-full flex-1">
                    <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-accent-success shrink-0" /> 1 Máquina CNC Ativa</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-accent-success shrink-0" /> Telemetria em tempo real</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-accent-success shrink-0" /> Histórico 30 dias</li>
                  </ul>
                  <button
                    onClick={() => handleSubscribe('starter')}
                    disabled={checkoutLoading === 'starter'}
                    className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    {checkoutLoading === 'starter' ? 'Carregando...' : 'Mudar para Starter'}
                  </button>
                </div>

                {/* PRO */}
                <div className="glass p-6 rounded-3xl border-white/5 flex flex-col items-center text-center space-y-4 hover:border-white/20 transition-all">
                  <h5 className="font-bold text-white text-lg">PRO</h5>
                  <div className="text-2xl font-black text-white">
                    R$ 149,90<span className="text-xs text-text-muted">/mês</span>
                  </div>
                  <ul className="text-xs text-text-muted space-y-2 text-left w-full flex-1">
                    <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-accent-success shrink-0" /> Até 3 Máquinas CNC/Laser</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-accent-success shrink-0" /> Cálculo de Consumo m²</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-accent-success shrink-0" /> Relatórios PDF / CSV</li>
                  </ul>
                  <button
                    onClick={() => handleSubscribe('pro')}
                    disabled={checkoutLoading === 'pro'}
                    className="w-full py-2.5 bg-accent-blue hover:bg-blue-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-accent-blue/20"
                  >
                    {checkoutLoading === 'pro' ? 'Carregando...' : 'Mudar para Pro'}
                  </button>
                </div>

                {/* BUSINESS (CURRENT) */}
                <div className="glass p-6 rounded-3xl border-accent-cyan/50 ring-2 ring-accent-cyan/30 flex flex-col items-center text-center space-y-4 relative">
                  <span className="text-[10px] font-black uppercase tracking-widest text-accent-cyan bg-accent-cyan/15 border border-accent-cyan/30 px-3 py-0.5 rounded-full">
                    Plano Atual
                  </span>
                  <h5 className="font-bold text-white text-lg flex items-center gap-1.5">
                    <span>💎</span> BUSINESS
                  </h5>
                  <div className="text-2xl font-black text-white">
                    R$ 349,90<span className="text-xs text-text-muted">/mês</span>
                  </div>
                  <ul className="text-xs text-text-muted space-y-2 text-left w-full flex-1">
                    <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-accent-success shrink-0" /> Máquinas Ilimitadas (até 999)</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-accent-success shrink-0" /> Automação de E-mails & Alertas</li>
                    <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-accent-success shrink-0" /> Suporte Prioritário VIP</li>
                  </ul>
                  <button
                    onClick={() => handleSubscribe('business')}
                    disabled={checkoutLoading === 'business'}
                    className="w-full py-2.5 bg-accent-cyan text-black font-black text-xs uppercase tracking-wider rounded-xl hover:scale-[1.02] transition-all cursor-pointer shadow-lg shadow-accent-cyan/25"
                  >
                    {checkoutLoading === 'business' ? 'Carregando...' : 'Pagar / Renovar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DADOS DE COBRANÇA */}
          {activeTab === 'billing' && (
            <form onSubmit={handleSaveBilling} className="space-y-6 max-w-xl mx-auto animate-in fade-in duration-300">
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-white">Dados da Empresa para Recibos & Notas</h4>
                <p className="text-xs text-text-muted">Essas informações constarão nos comprovantes emitidos pelo sistema.</p>
              </div>

              {billingFeedback && (
                <div className={`p-4 rounded-xl border text-sm font-medium flex items-center gap-3 ${
                  billingFeedback.type === 'success' 
                    ? 'bg-accent-success/10 border-accent-success/30 text-accent-success' 
                    : 'bg-accent-danger/10 border-accent-danger/30 text-accent-danger'
                }`}>
                  {billingFeedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{billingFeedback.message}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-text-muted font-bold block mb-1.5 uppercase tracking-wider">
                    Razão Social / Nome Fantasia
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Minha Empresa de Corte CNC Ltda"
                    className="w-full bg-white/5 border border-border px-4 py-3 rounded-xl outline-none focus:border-accent-cyan text-white text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs text-text-muted font-bold block mb-1.5 uppercase tracking-wider">
                    CNPJ ou CPF
                  </label>
                  <input
                    type="text"
                    value={cnpjCpf}
                    onChange={(e) => setCnpjCpf(e.target.value)}
                    placeholder="00.000.000/0001-00"
                    className="w-full bg-white/5 border border-border px-4 py-3 rounded-xl outline-none focus:border-accent-cyan text-white text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs text-text-muted font-bold block mb-1.5 uppercase tracking-wider">
                    E-mail do Financeiro
                  </label>
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    placeholder="financeiro@empresa.com"
                    className="w-full bg-white/5 border border-border px-4 py-3 rounded-xl outline-none focus:border-accent-cyan text-white text-sm"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingBilling}
                  className="w-full py-3 bg-accent-cyan text-black font-black text-xs uppercase tracking-wider rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-accent-cyan/20 cursor-pointer disabled:opacity-50"
                >
                  {savingBilling ? 'Salvando...' : 'Salvar Dados de Faturamento'}
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 border-t border-border bg-black/30 flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-2">
            <Lock size={14} className="text-accent-cyan" />
            <span>Processamento Oficial Mercado Pago • Ambiente Seguro</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 hover:bg-white/10 text-white rounded-xl font-bold transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
