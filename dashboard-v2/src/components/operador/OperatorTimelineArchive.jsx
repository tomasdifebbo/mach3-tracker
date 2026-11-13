import React from 'react';
import { RefreshCw, CalendarClock } from 'lucide-react';
import {
  formatDuration, getLogLocalDateStr, matchesOperatorLog,
  calcMergedWorkedMinutes, OPERATOR_STATUS_CONFIG
} from './operadorUtils';

export function OperatorTimelineArchive({
  operatorsList, timeLogs, archiveLogs, archiveLoading,
  timelinePeriod, setTimelinePeriod, filterOperator, setFilterOperator,
  customDateFrom, setCustomDateFrom, customDateTo, setCustomDateTo,
  fetchArchiveLogs
}) {
  return (
    <>
      {/* Histórico da Linha do Tempo — Filtro por Semana/Mês + Resumo por Operador */}
      {(operatorsList.length > 0 || timeLogs.length > 0) && (
        <div className="glass p-5 md:p-6 rounded-3xl border border-white/10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
              <CalendarClock size={16} /> Histórico da Linha do Tempo (Acumulado)
            </h3>
            <button 
              onClick={fetchArchiveLogs}
              disabled={archiveLoading}
              className="px-4 py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shrink-0"
            >
              <RefreshCw size={14} className={archiveLoading ? 'animate-spin' : ''} />
              {archiveLoading ? 'Carregando...' : 'Consultar'}
            </button>
          </div>

          {/* Filtros de Período */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mr-1">Período:</span>
            {[
              { key: 'hoje', label: '📅 Hoje' },
              { key: 'semana', label: '📆 Esta Semana' },
              { key: 'mes', label: '🗓️ Este Mês' },
              { key: 'custom', label: '🔎 Personalizado' }
            ].map(p => (
              <button
                key={p.key}
                onClick={() => { setTimelinePeriod(p.key); }}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                  timelinePeriod === p.key 
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm' 
                    : 'text-text-muted hover:text-purple-300 border border-transparent'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range */}
          {timelinePeriod === 'custom' && (
            <div className="flex flex-wrap items-center gap-3 p-3 bg-white/[0.02] rounded-xl border border-white/5">
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">De:</label>
              <input 
                type="date" 
                value={customDateFrom} 
                onChange={e => setCustomDateFrom(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-purple-500 transition-colors"
              />
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Até:</label>
              <input 
                type="date" 
                value={customDateTo} 
                onChange={e => setCustomDateTo(e.target.value)}
                className="bg-black/50 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          )}

          {/* Filtro por Operador */}
          {archiveLogs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider mr-1">Operador:</span>
              <button
                onClick={() => setFilterOperator('all')}
                className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                  filterOperator === 'all' ? 'bg-white/10 text-white border border-white/20' : 'text-text-muted hover:text-white'
                }`}
              >
                👥 Todos
              </button>
              {operatorsList.map(op => {
                const opLogCount = archiveLogs.filter(l => matchesOperatorLog(l, op)).length;
                if (opLogCount === 0) return null;
                return (
                  <button
                    key={op.id}
                    onClick={() => setFilterOperator(op.id)}
                    className={`px-3 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                      filterOperator === op.id ? 'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/40' : 'text-text-muted hover:text-accent-cyan'
                    }`}
                  >
                    👷 {op.name} ({opLogCount})
                  </button>
                );
              })}
            </div>
          )}

          {/* Resumo de Horas por Operador — KPI Cards */}
          {archiveLogs.length > 0 && (() => {
            const filteredOps = filterOperator === 'all' ? operatorsList : operatorsList.filter(op => op.id === filterOperator);
            const summaryData = filteredOps.map(op => {
              const opLogs = archiveLogs.filter(l => matchesOperatorLog(l, op));
              const activeLogsOnly = opLogs.filter(l => (l.status || 'disponivel') !== 'ausente' && l.status !== 'fim_expediente');
              const totalMinutes = calcMergedWorkedMinutes(opLogs);
              const daysWorked = new Set(activeLogsOnly.map(l => getLogLocalDateStr(l.start_time))).size;
              const statusBreakdown = {};
              if (totalMinutes > 0) {
                statusBreakdown['disponivel'] = totalMinutes;
              }
              opLogs.forEach(l => {
                const st = l.status || 'disponivel';
                if (st === 'disponivel' || st === 'ausente' || st === 'fim_expediente') return;
                const dur = l.duration_minutes || (l.end_time ? (new Date(l.end_time) - new Date(l.start_time)) / 60000 : 0);
                statusBreakdown[st] = (statusBreakdown[st] || 0) + dur;
              });
              return { op, totalMinutes, daysWorked, logCount: activeLogsOnly.length || opLogs.length, statusBreakdown };
            }).filter(s => s.logCount > 0);

            return (
              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-300/70">
                  📊 Resumo de Horas Trabalhadas por Operador
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {summaryData.map(({ op, totalMinutes, daysWorked, logCount, statusBreakdown }) => {
                    const totalHrs = totalMinutes / 60;
                    const avgHrsPerDay = daysWorked > 0 ? totalHrs / daysWorked : 0;
                    const factoryMin = statusBreakdown['disponivel'] || 0;
                    const factoryPct = totalMinutes > 0 ? Math.round((factoryMin / totalMinutes) * 100) : 0;

                    return (
                      <div key={op.id} className="p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 space-y-3 hover:border-purple-500/40 transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-300 text-sm font-black">
                              {op.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{op.name}</p>
                              <p className="text-[9px] text-text-muted">{daysWorked} dia{daysWorked !== 1 ? 's' : ''} · {logCount} registros</p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 bg-white/[0.03] rounded-lg">
                            <p className="text-lg font-black text-accent-cyan tabular-nums">{totalHrs.toFixed(1)}<span className="text-[9px] text-text-muted">h</span></p>
                            <p className="text-[8px] text-text-muted font-bold uppercase tracking-wider">Total</p>
                          </div>
                          <div className="p-2 bg-white/[0.03] rounded-lg">
                            <p className="text-lg font-black text-emerald-400 tabular-nums">{avgHrsPerDay.toFixed(1)}<span className="text-[9px] text-text-muted">h</span></p>
                            <p className="text-[8px] text-text-muted font-bold uppercase tracking-wider">Média/Dia</p>
                          </div>
                          <div className="p-2 bg-white/[0.03] rounded-lg">
                            <p className="text-lg font-black text-purple-300 tabular-nums">{factoryPct}<span className="text-[9px] text-text-muted">%</span></p>
                            <p className="text-[8px] text-text-muted font-bold uppercase tracking-wider">Na Fábrica</p>
                          </div>
                        </div>

                        {/* Mini status breakdown */}
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(statusBreakdown).map(([status, mins]) => {
                            const cfg = OPERATOR_STATUS_CONFIG[status] || OPERATOR_STATUS_CONFIG.disponivel;
                            return (
                              <span key={status} className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                                {cfg.label}: {(mins / 60).toFixed(1)}h
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Timeline Detalhada Agrupada por Dia */}
          {archiveLogs.length > 0 && (() => {
            const selectedOpObj = filterOperator === 'all' ? null : operatorsList.find(o => o.id === filterOperator);
            const filteredLogs = filterOperator === 'all'
              ? archiveLogs
              : archiveLogs.filter(l => selectedOpObj ? matchesOperatorLog(l, selectedOpObj) : l.operator_id === filterOperator);
            
            // Group by date (fuso horário de Brasília America/Sao_Paulo)
            const byDate = {};
            filteredLogs.forEach(l => {
              const dateKey = getLogLocalDateStr(l.start_time);
              if (!byDate[dateKey]) byDate[dateKey] = [];
              byDate[dateKey].push(l);
            });
            const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

            return (
              <div className="space-y-3 pt-3 border-t border-white/5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-text-muted">
                  📋 Detalhamento por Dia ({filteredLogs.length} registros)
                </h4>
                {sortedDates.map(dateKey => {
                  const dayLogs = byDate[dateKey];
                  const dayLabel = new Date(dateKey + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
                  // Soma horas reais trabalhadas por operador no dia (sem duplicar máquinas simultâneas)
                  const opsInDay = {};
                  dayLogs.forEach(l => {
                    const k = (l.operator_name || 'Desconhecido').toLowerCase();
                    if (!opsInDay[k]) opsInDay[k] = [];
                    opsInDay[k].push(l);
                  });
                  const dayTotalMin = Object.values(opsInDay).reduce((s, arr) => s + calcMergedWorkedMinutes(arr), 0);

                  // Group by operator within the day
                  const byOp = {};
                  dayLogs.forEach(l => {
                    const key = l.operator_name || 'Desconhecido';
                    if (!byOp[key]) byOp[key] = [];
                    byOp[key].push(l);
                  });

                  return (
                    <div key={dateKey} className="p-3 bg-white/[0.015] rounded-xl border border-white/5 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white capitalize">{dayLabel}</span>
                        <span className="text-[10px] font-black text-purple-300 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                          {formatDuration(dayTotalMin)} total
                        </span>
                      </div>
                      {Object.entries(byOp).map(([opName, logs]) => (
                        <div key={opName} className="pl-3 border-l-2 border-purple-500/30 space-y-1">
                          <p className="text-[10px] font-bold text-accent-cyan">👷 {opName}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-1.5">
                            {logs.map(log => {
                              const st = OPERATOR_STATUS_CONFIG[log.status || 'disponivel'] || OPERATOR_STATUS_CONFIG.disponivel;
                              const startStr = new Date(log.start_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                              const endStr = log.end_time ? new Date(log.end_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Aberto';
                              const durMin = log.duration_minutes || (log.end_time ? (new Date(log.end_time) - new Date(log.start_time)) / 60000 : 0);
                              return (
                                <div key={log.id} className={`p-2 rounded-lg border ${st.border} ${st.bg} text-[10px] space-y-0.5`}>
                                  <div className="flex items-center justify-between">
                                    <span className={`font-bold ${st.color}`}>{startStr} → {endStr} ({formatDuration(durMin)})</span>
                                    <span className={`px-1 py-0.5 rounded text-[8px] font-black ${st.bg} ${st.color}`}>{st.label}</span>
                                  </div>
                                  <p className="font-bold text-white/80 text-[10px] truncate">{log.location || st.label}</p>
                                  {log.kanban_title && <p className="text-[9px] text-purple-300 truncate">📋 {log.kanban_title}</p>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {archiveLogs.length === 0 && !archiveLoading && (
            <div className="text-center py-8 text-text-muted">
              <CalendarClock size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-bold">Selecione o período e clique em "Consultar"</p>
              <p className="text-[10px] mt-1">Os dados da linha do tempo serão carregados para análise</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}
