import React, { useState } from 'react';
import { api } from '../services/api';
import { Mail, Lock, ShieldAlert, LogIn, AlertCircle } from 'lucide-react';

export function AdminLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api.login(email, password);

      if (data.success) {
        if (data.user.role === 'admin') {
          localStorage.setItem('mach3_token', data.token);
          onLoginSuccess();
        } else {
          setError('Acesso Negado: Privilégios insuficientes.');
        }
      } else {
        setError(data.error || 'Erro na autenticação');
      }
    } catch {
      setError('Erro de conexão com o servidor');
    }
    setLoading(false);
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-zinc-950 relative overflow-hidden font-inter">
      {/* Background Animated Particles for Admin */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute w-[800px] h-[800px] bg-purple-600/20 rounded-full blur-[120px] -top-1/4 -left-1/4 animate-pulse"></div>
        <div className="absolute w-[600px] h-[600px] bg-fuchsia-600/20 rounded-full blur-[100px] -bottom-1/4 -right-1/4 animate-pulse duration-[5s]"></div>
      </div>

      <div className="relative z-10 w-full max-w-[440px] px-6">
        <div className="glass p-10 rounded-[48px] border-purple-500/20 border shadow-[0_32px_64px_-16px_rgba(168,85,247,0.2)] bg-black/40 backdrop-blur-xl">
           <div className="text-center mb-10 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/10 border border-purple-500/30 rounded-[20px] shadow-xl shadow-purple-500/10 p-2.5">
                <ShieldAlert className="w-8 h-8 text-purple-400" />
              </div>
              <div>
                <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter">PORTAL MASTER</h1>
                <p className="text-sm text-purple-300/60 font-medium">Autenticação Administrativa Global</p>
              </div>
           </div>

           <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm font-bold">
                  <AlertCircle size={18} /> {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2">E-mail Master</label>
                <div className="relative group">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-purple-400 transition-colors" />
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@mach3.com" 
                    className="w-full bg-zinc-900/50 border border-zinc-800 px-11 py-4 rounded-2xl outline-none focus:border-purple-500/50 focus:bg-zinc-900 transition-all text-white text-sm font-medium"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-2">Chave de Segurança</label>
                <div className="relative group">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-purple-400 transition-colors" />
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" 
                    className="w-full bg-zinc-900/50 border border-zinc-800 px-11 py-4 rounded-2xl outline-none focus:border-purple-500/50 focus:bg-zinc-900 transition-all text-white text-sm font-medium"
                    required
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full py-4.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-purple-500/20 flex items-center justify-center gap-3 cursor-pointer"
              >
                {loading ? 'Validando...' : <><LogIn size={18} /> Acessar Painel Master</>}
              </button>
           </form>

           <div className="mt-8 text-center text-[11px] text-zinc-500 font-medium">
             Acesso monitorado e restrito ao superadministrador.
           </div>
        </div>
      </div>
    </div>
  );
}
