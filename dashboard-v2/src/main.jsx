import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-full bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center mb-4 text-2xl font-bold border border-cyan-500/30">
            ⚡
          </div>
          <h1 className="text-2xl font-black mb-2 text-white uppercase tracking-tight">Painel Atualizado</h1>
          <p className="text-slate-400 text-sm max-w-md mb-6">
            O sistema recebeu atualizações de interface. Clique no botão abaixo para recarregar o painel.
          </p>
          <button 
            onClick={() => {
              try { localStorage.removeItem('dismissed_notifs'); } catch(e){}
              window.location.href = '/';
            }}
            className="px-6 py-3 bg-cyan-400 hover:bg-cyan-300 text-black font-black rounded-xl text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-cyan-400/20 mb-4"
          >
            Recarregar Sistema
          </button>
          {this.state.error && (
            <div className="text-[10px] font-mono text-slate-500 max-w-lg truncate bg-black/40 p-2 rounded border border-white/5">
              {String(this.state.error?.message || this.state.error)}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
