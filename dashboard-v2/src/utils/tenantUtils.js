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
  'COD',
  'GCODE',
  'G-CODE',
  'CORTES',
  'CNC',
  'PROGRAMA',
  'FILES',
  'USERS',
  'ATELIER',
  'TOMAS',
  'MACH3',
  'JOBS ATIVOS',
  'DADOS2',
  'DADOS2 - JOBS ATIVOS',
  '3 - OFICINA',
  'OFICINA',
  'DESCONHECIDO',
  'GERAL'
]);

const GENERIC_SEGMENT_REGEX = /^(?:ARQUIVOS?|ROUTER|CNC|ISOPOR|COD|GCODE|G-CODE|CORTES|MACH3|TOMAS)\s*\d{0,4}$/i;
const FILE_EXT_REGEX = /\.(txt|tap|nc|gcode|cnc|cdr|eps|dxf|crv3d|crv|stl|v3d|ai|pdf)$/i;

export function isGenericProjectSegment(segment = '') {
  const up = String(segment || '').toUpperCase().trim();
  if (!up) return true;
  if (GENERIC_PROJECT_SEGMENTS.has(up)) return true;
  if (/^[A-Z]:$/.test(up)) return true;
  if (GENERIC_SEGMENT_REGEX.test(up)) return true;
  if (/^20\d{2}$/.test(up)) return true;
  if (up.includes('ARQUIVOS') || up.includes('ROUTER')) return true;
  return false;
}

function resolveProjectFromRaw(rawInput, preferLast = false) {
  const raw = String(rawInput || '').trim();
  if (!raw) return null;

  const hasPipeHierarchy = raw.includes(' | ');
  const cleaned = raw
    .replace(/^Router \d+\s*\|\s*/i, '')
    .replace(/^Router Central\s*\|\s*/i, '')
    .replace(/^Laser Ruida\s*\|\s*/i, '')
    .replace(/^\\\\[^\\/]+[\\/]?/, '')
    .replace(/^[A-Z]:[\\/]?/i, '');

  const segments = cleaned
    .split(/[\\/]|(?:\s*\|\s*)/)
    .map(s => s.trim())
    .filter(s => s && !FILE_EXT_REGEX.test(s));

  const routerIdx = segments.findIndex(s => s.toUpperCase() === 'ROUTER');
  if (routerIdx !== -1 && routerIdx < segments.length - 1) {
    const afterRouter = segments.slice(routerIdx + 1).filter(s => !isGenericProjectSegment(s));
    if (afterRouter.length > 0) {
      return preferLast ? afterRouter[afterRouter.length - 1] : afterRouter[0];
    }
  }

  const specific = segments.filter(s => !isGenericProjectSegment(s));
  if (specific.length > 0) {
    return (preferLast || hasPipeHierarchy) ? specific[specific.length - 1] : specific[0];
  }
  return null;
}

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
export function extractProjectName(folder = 'Geral', fallbackLabel = 'Geral', filePath = '') {
  const fromFolder = resolveProjectFromRaw(folder, false);
  if (fromFolder) return fromFolder;

  const fromFilePath = resolveProjectFromRaw(filePath, true);
  if (fromFilePath) return fromFilePath;

  const rawFolder = String(folder || '').trim();
  if (rawFolder && !isGenericProjectSegment(rawFolder)) return rawFolder;

  return fallbackLabel;
}
