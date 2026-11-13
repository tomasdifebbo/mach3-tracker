import { CheckCircle2, ExternalLink, Building2, Utensils, Sparkles, LogOut, Moon } from 'lucide-react';

export const formatDuration = (minutes) => {
  if (minutes === null || minutes === undefined) return "00:00:00";
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  const s = Math.floor((minutes * 60) % 60);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const getLocalTodayStr = () => {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
};

export const getLogLocalDateStr = (dtVal) => {
  if (!dtVal) return getLocalTodayStr();
  try {
    return new Date(dtVal).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  } catch {
    return new Date(dtVal).toISOString().split('T')[0];
  }
};

export const matchesOperatorLog = (log, op) => {
  if (!log || !op) return false;
  if (log.operator_id && Number(log.operator_id) === Number(op.id)) return true;
  return !!(log.operator_name && op.name && log.operator_name.trim().toLowerCase() === op.name.trim().toLowerCase());
};

// Calcula minutos reais trabalhados sem duplicar máquinas simultâneas e ignorando folga/fim de expediente
export const calcMergedWorkedMinutes = (logsArr) => {
  const intervals = [];
  const nowTs = Date.now();
  for (const l of logsArr) {
    const st = l.status || 'disponivel';
    if (st === 'ausente' || st === 'fim_expediente' || st === 'almoco') continue;
    if (!l.start_time) continue;
    const sMs = new Date(l.start_time).getTime();
    const eMs = l.end_time ? new Date(l.end_time).getTime() : nowTs;
    if (eMs > sMs) intervals.push([sMs, eMs]);
  }
  if (intervals.length === 0) return 0;
  intervals.sort((a, b) => a[0] - b[0]);
  const merged = [intervals[0].slice()];
  for (let i = 1; i < intervals.length; i++) {
    const cur = intervals[i];
    const last = merged[merged.length - 1];
    if (cur[0] <= last[1]) {
      last[1] = Math.max(last[1], cur[1]);
    } else {
      merged.push(cur.slice());
    }
  }
  return merged.reduce((acc, [s, e]) => acc + (e - s) / 60000, 0);
};

export const getDateRange = (period, customDateFrom = '', customDateTo = '') => {
  const todayStr = getLocalTodayStr();
  const today = new Date();
  if (period === 'hoje') return { from: todayStr, to: todayStr };
  if (period === 'semana') {
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    let mondayStr = todayStr;
    try {
      mondayStr = monday.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    } catch { /* ignore */ }
    return { from: mondayStr, to: todayStr };
  }
  if (period === 'mes') {
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    let firstDayStr = todayStr;
    try {
      firstDayStr = firstDay.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    } catch { /* ignore */ }
    return { from: firstDayStr, to: todayStr };
  }
  return { from: customDateFrom || todayStr, to: customDateTo || todayStr };
};

export const OPERATOR_STATUS_CONFIG = {
  disponivel:     { label: 'Na Fábrica', color: 'text-emerald-400', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', icon: CheckCircle2, dot: 'bg-emerald-400' },
  externo:        { label: 'Serviço Externo', color: 'text-amber-400', bg: 'bg-amber-500/15', border: 'border-amber-500/30', icon: ExternalLink, dot: 'bg-amber-400' },
  outro_setor:    { label: 'Outro Setor', color: 'text-blue-400', bg: 'bg-blue-500/15', border: 'border-blue-500/30', icon: Building2, dot: 'bg-blue-400' },
  almoco:         { label: 'Horário de Almoço', color: 'text-orange-400', bg: 'bg-orange-500/15', border: 'border-orange-500/30', icon: Utensils, dot: 'bg-orange-400' },
  limpeza:        { label: 'Limpeza e Manutenção', color: 'text-cyan-400', bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', icon: Sparkles, dot: 'bg-cyan-400' },
  fim_expediente: { label: 'Fim de Expediente', color: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/30', icon: LogOut, dot: 'bg-purple-400' },
  ausente:        { label: 'Folga / Ausente', color: 'text-zinc-400', bg: 'bg-zinc-500/15', border: 'border-zinc-500/30', icon: Moon, dot: 'bg-zinc-500' }
};
