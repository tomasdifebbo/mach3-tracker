/**
 * Utilitários Multi-Tenant para normalização de caminhos CNC e resolução dinâmica de operadores por turno.
 */

const GENERIC_PROJECT_SEGMENTS = new Set([
  'ARQUIVOS',
  'ARQUIVOS 2024',
  'ARQUIVOS 2025',
  'ARQUIVOS 2026',
  'ROUTER',
  'ROUTER 1',
  'ROUTER 2',
  'ROUTER CENTRAL',
  'ISOPOR',
  'CNC',
  'PROGRAMA',
  'FILES',
  'USERS',
  'ATELIER',
  'JOBS ATIVOS',
  'DADOS2',
  'DADOS2 - JOBS ATIVOS',
  '3 - OFICINA',
  'OFICINA',
  'GERAL'
]);

/**
 * Indica se o horário informado pertence ao turno noturno (22:00 às 05:59).
 */
export function isNightShiftHour(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const h = Number.isNaN(d.getTime()) ? new Date().getHours() : d.getHours();
  return h >= 22 || h < 6;
}

/**
 * Resolve dinamicamente o nome do operador do turno atual usando:
 * 1) Lista de operadores cadastrados no PostgreSQL (`operators`)
 * 2) Operador padrão salvo nas configurações da empresa (`user.default_day_operator` / `default_night_operator`)
 * 3) Rotulo genérico neutro caso nenhum esteja configurado.
 */
export function resolveShiftOperator({ user = null, operators = [], date = new Date() } = {}) {
  const isNight = isNightShiftHour(date);
  const list = Array.isArray(operators) ? operators : [];

  if (isNight) {
    const matched = list.find(o => /noite|night|noturno/i.test(String(o?.shift || '')));
    return (matched?.name || '').trim() || (user?.default_night_operator || '').trim() || 'Operador Noite';
  }

  const matched = list.find(o => /manha|manhã|dia|day|diurno|tarde/i.test(String(o?.shift || '')));
  return (matched?.name || '').trim() || (user?.default_day_operator || '').trim() || 'Operador';
}

/**
 * Extrai o nome legível do projeto/cliente a partir de caminhos Windows/rede salvos nos registros do Mach3.
 */
export function extractProjectName(folder = 'Geral', fallbackLabel = 'Geral') {
  const raw = String(folder || fallbackLabel || 'Geral');
  const pathParts = raw.replace(/^Router \d+ \| /i, '').split(/[\\/]/).filter(Boolean);
  const routerIdx = pathParts.findIndex(p => p.toUpperCase() === 'ROUTER');

  if (routerIdx !== -1 && routerIdx < pathParts.length - 1) {
    return pathParts[routerIdx + 1];
  }

  const folderOnlyParts = pathParts.filter(
    p => !/\.(txt|tap|nc|gcode|cnc)$/i.test(p)
  );
  const cleanPath = folderOnlyParts.join('\\').replace(/^\\\\.*?\\/, '').replace(/^[A-Z]:\\/i, '');
  const parts = cleanPath.split('\\').filter(p => {
    const up = p.toUpperCase().trim();
    if (!up) return false;
    if (GENERIC_PROJECT_SEGMENTS.has(up)) return false;
    if (/^ARQUIVOS\s*\d{4}$/i.test(up) || /^20\d{2}$/.test(up)) return false;
    if (up.includes('ARQUIVOS') || up.includes('ROUTER')) return false;
    return true;
  });

  return parts.length > 0 ? parts[0] : (folderOnlyParts.pop() || fallbackLabel);
}
