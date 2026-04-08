import React, { useState } from 'react';
import { api } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';

export function Login({ onLoginSuccess }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const data = mode === 'login' 
        ? await api.login(email, password)
        : await api.register(email, password);

      if (data.success) {
        if (mode === 'login') {
          localStorage.setItem('mach3_token', data.token);
          onLoginSuccess();
        } else {
          setSuccess('Conta criada! Agora faça login.');
          setMode('login');
        }
      } else {
        setError(data.error || 'Erro na autenticação');
      }
    } catch (err) {
      setError('Erro de conexão com o servidor');
    }
    setLoading(false);
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-bg-main relative overflow-hidden font-inter">
      {/* Background Animated Particles (CSS Only) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute w-[800px] h-[800px] bg-accent-cyan/10 rounded-full blur-[120px] -top-1/4 -left-1/4 animate-pulse"></div>
        <div className="absolute w-[600px] h-[600px] bg-accent-blue/10 rounded-full blur-[100px] -bottom-1/4 -right-1/4 animate-pulse duration-[5s]"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-[440px] px-6"
      >
        <div className="glass p-10 rounded-[48px] border-white/5 border shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]">
           <div className="text-center mb-10 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-accent-cyan to-accent-blue rounded-[20px] text-3xl shadow-xl shadow-accent-cyan/20">
                 💠
              </div>
              <div>
                <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">2576 - GLOBOTOY</h1>
                <p className="text-sm text-text-muted font-medium">Gestão Premium de Produção CNC</p>
              </div>
           </div>

           {/* Tabs */}
           <div className="flex bg-white/5 p-1 rounded-2xl mb-8 border border-white/5">
              <button 
                onClick={() => setMode('login')}
                className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'login' ? 'bg-white/10 text-accent-cyan shadow-lg' : 'text-text-muted hover:text-white'}`}
              >
                Login
              </button>
              <button 
                onClick={() => setMode('register')}
                className={`flex-1 py-3 text-sm font-black uppercase tracking-widest rounded-xl transition-all ${mode === 'register' ? 'bg-white/10 text-accent-cyan shadow-lg' : 'text-text-muted hover:text-white'}`}
              >
                Registro
              </button>
           </div>

           <form onSubmit={handleSubmit} className="space-y-6">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-3 p-4 bg-accent-danger/10 border border-accent-danger/20 rounded-2xl text-accent-danger text-sm font-bold"
                  >
                    <AlertCircle size={18} /> {error}
                  </motion.div>
                )}
                {success && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-3 p-4 bg-accent-success/10 border border-accent-success/20 rounded-2xl text-accent-success text-sm font-bold"
                  >
                    <CheckCircle2 size={18} /> {success}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2">E-mail Corporativo</label>
                <div className="relative group">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-cyan transition-colors" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ex@empresa.com" 
                    className="w-full bg-white/5 border border-border px-11 py-4 rounded-2xl outline-none focus:border-accent-cyan/50 focus:bg-white/[0.08] transition-all text-white text-sm font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-text-muted px-2">Senha de Acesso</label>
                <div className="relative group">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-accent-cyan transition-colors" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full bg-white/5 border border-border px-11 py-4 rounded-2xl outline-none focus:border-accent-cyan/50 focus:bg-white/[0.08] transition-all text-white text-sm font-medium"
                    required
                  />
                </div>
              </div>

              {mode === 'register' && (
                <p className="text-[10px] font-black text-accent-cyan bg-accent-cyan/10 px-4 py-2 rounded-xl text-center uppercase tracking-[0.1em]">
                  ✨ Ganhe 31 dias de Trial Business ao criar sua conta!
                </p>
              )}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4.5 bg-accent-cyan text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-accent-cyan/30 flex items-center justify-center gap-3"
              >
                {loading ? 'Processando...' : mode === 'login' ? <><LogIn size={18} /> Entrar no Dashboard</> : <><UserPlus size={18} /> Criar Minha Conta</>}
              </button>
           </form>

           <div className="mt-8 text-center text-[11px] text-text-muted font-medium opacity-50">
             © 2026 Mach3 Tracker Pro. Todos os direitos reservados.
           </div>
        </div>
      </motion.div>
    </div>
  );
}
