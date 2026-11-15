// Utility for managing system theme, custom colors, and font color modes
import { api } from '../services/api';

export const THEME_PRESETS = [
  {
    id: 'Escuro',
    label: 'Escuro Profundo',
    desc: 'Preto grafite clássico CNC com alto contraste',
    bg: '#0a0e1a',
    sidebar: '#0f1524',
    card: 'rgba(15, 21, 36, 0.75)',
    border: 'rgba(65, 84, 126, 0.3)',
    accent: '#06b6d4',
    previewBadge: 'bg-[#0a0e1a] border border-[#06b6d4]/40',
    isDark: true
  },
  {
    id: 'Claro',
    label: 'Claro Elegante',
    desc: 'Branco gelo nítido para ambientes bem iluminados',
    bg: '#f8fafc',
    sidebar: '#ffffff',
    card: 'rgba(255, 255, 255, 0.95)',
    border: 'rgba(203, 213, 225, 0.8)',
    accent: '#0284c7',
    previewBadge: 'bg-[#f8fafc] border border-slate-300',
    isDark: false
  },
  {
    id: 'Azul Corporativo',
    label: 'Azul Corporativo',
    desc: 'Azul marinho executivo com acentos em ciano',
    bg: '#061121',
    sidebar: '#0a192f',
    card: 'rgba(10, 25, 47, 0.8)',
    border: 'rgba(59, 130, 246, 0.3)',
    accent: '#38bdf8',
    previewBadge: 'bg-[#061121] border border-blue-500/40',
    isDark: true
  },
  {
    id: 'Verde Industrial',
    label: 'Verde Industrial',
    desc: 'Verde esmeralda focado em oficinas e alta clareza',
    bg: '#041810',
    sidebar: '#062418',
    card: 'rgba(6, 36, 24, 0.8)',
    border: 'rgba(16, 185, 129, 0.3)',
    accent: '#10b981',
    previewBadge: 'bg-[#041810] border border-emerald-500/40',
    isDark: true
  },
  {
    id: 'Roxo Noturno',
    label: 'Roxo Noturno',
    desc: 'Púrpura escuro moderno e sofisticado',
    bg: '#0e081e',
    sidebar: '#150d2c',
    card: 'rgba(21, 13, 44, 0.8)',
    border: 'rgba(168, 85, 247, 0.3)',
    accent: '#a855f7',
    previewBadge: 'bg-[#0e081e] border border-purple-500/40',
    isDark: true
  },
  {
    id: 'Personalizado',
    label: 'Cor Personalizada',
    desc: 'Defina a cor de fundo e a cor de destaque da sua marca',
    bg: '#0a0e1a',
    sidebar: '#0f1524',
    card: 'rgba(15, 21, 36, 0.75)',
    border: 'rgba(249, 115, 22, 0.3)',
    accent: '#f97316',
    previewBadge: 'bg-gradient-to-br from-slate-900 to-orange-950 border border-orange-500/50',
    isDark: true,
    isCustom: true
  }
];

export const FONT_COLOR_PRESETS = [
  {
    id: 'auto',
    label: 'Automática',
    badgeText: 'Auto Contraste',
    desc: 'Ajuste inteligente baseado no fundo (escuro = claro, claro = escuro)',
    colorPreview: '#f1f5f9',
    textColor: null
  },
  {
    id: 'white',
    label: 'Branco Puro',
    badgeText: '100% Branco',
    desc: 'Máximo contraste e nitidez total em telas e tablets da fábrica',
    colorPreview: '#ffffff',
    textColor: '#ffffff'
  },
  {
    id: 'amber',
    label: 'Amarelo CNC',
    badgeText: 'Dourado / CNC',
    desc: 'Estilo terminal industrial numérico de alta visibilidade',
    colorPreview: '#fde047',
    textColor: '#fef08a'
  },
  {
    id: 'cyan',
    label: 'Ciano Neon',
    badgeText: 'Mach3 Cyan',
    desc: 'Estilo tecnológico e futurista característico do sistema',
    colorPreview: '#22d3ee',
    textColor: '#67e8f9'
  },
  {
    id: 'green',
    label: 'Verde Matrix',
    badgeText: 'Terminal',
    desc: 'Verde fosforescente clássico de comandos industriais',
    colorPreview: '#4ade80',
    textColor: '#86efac'
  },
  {
    id: 'custom',
    label: 'Personalizada',
    badgeText: 'Cor Livre',
    desc: 'Escolha qualquer cor hexadecimal para as letras do painel',
    colorPreview: '#f43f5e',
    isCustom: true
  }
];

function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(15, 21, 36, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(15, 21, 36, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function adjustBrightness(hex, percent) {
  if (!hex || typeof hex !== 'string') return hex;
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return hex;
  let r = (num >> 16) + Math.round(255 * (percent / 100));
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100));
  let b = (num & 0x0000ff) + Math.round(255 * (percent / 100));
  r = Math.min(255, Math.max(0, r));
  g = Math.min(255, Math.max(0, g));
  b = Math.min(255, Math.max(0, b));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export function applyTheme(themeName, customColors = {}, fontConfig = {}) {
  if (typeof document === 'undefined') return;

  const currentTheme = themeName || localStorage.getItem('mach3_theme') || 'Escuro';
  const t = currentTheme.toLowerCase();
  const isLight = t.includes('claro');

  let themeKey = 'escuro';
  if (isLight) themeKey = 'claro';
  else if (t.includes('azul')) themeKey = 'azul';
  else if (t.includes('verde')) themeKey = 'verde';
  else if (t.includes('roxo')) themeKey = 'roxo';
  else if (t.includes('personalizado')) themeKey = 'personalizado';

  document.documentElement.setAttribute('data-theme', themeKey);

  // CRITICAL FIX: Ensure classList has 'dark' whenever theme is NOT light
  // This ensures Tailwind v4 `dark:` classes always activate reliably
  if (isLight) {
    document.documentElement.classList.remove('dark');
  } else {
    document.documentElement.classList.add('dark');
  }

  // Handle custom background / accent colors if 'Personalizado'
  if (themeKey === 'personalizado') {
    const bg = customColors.bg || localStorage.getItem('mach3_custom_bg_color') || '#0a0e1a';
    const accent = customColors.accent || localStorage.getItem('mach3_custom_accent_color') || '#f97316';

    document.documentElement.style.setProperty('--color-bg-main', bg);
    document.documentElement.style.setProperty('--color-bg-sidebar', adjustBrightness(bg, 6));
    document.documentElement.style.setProperty('--color-bg-card', hexToRgba(adjustBrightness(bg, 14), 0.78));
    document.documentElement.style.setProperty('--color-border', hexToRgba(accent, 0.3));
    document.documentElement.style.setProperty('--color-accent-cyan', accent);
    document.documentElement.style.setProperty('--color-accent-blue', accent);
  } else {
    document.documentElement.style.removeProperty('--color-bg-main');
    document.documentElement.style.removeProperty('--color-bg-sidebar');
    document.documentElement.style.removeProperty('--color-bg-card');
    document.documentElement.style.removeProperty('--color-border');
    document.documentElement.style.removeProperty('--color-accent-cyan');
    document.documentElement.style.removeProperty('--color-accent-blue');
  }

  // Handle Font Color Customization
  const fontMode = fontConfig.mode || localStorage.getItem('mach3_font_color_mode') || 'auto';
  document.documentElement.setAttribute('data-font-mode', fontMode);

  if (fontMode === 'custom') {
    const customFont = fontConfig.customColor || localStorage.getItem('mach3_custom_font_color') || '#ffffff';
    document.documentElement.style.setProperty('--user-font-color', customFont);
  } else if (fontMode === 'white') {
    document.documentElement.style.setProperty('--user-font-color', '#ffffff');
  } else if (fontMode === 'amber') {
    document.documentElement.style.setProperty('--user-font-color', '#fef08a');
  } else if (fontMode === 'cyan') {
    document.documentElement.style.setProperty('--user-font-color', '#67e8f9');
  } else if (fontMode === 'green') {
    document.documentElement.style.setProperty('--user-font-color', '#86efac');
  } else {
    document.documentElement.style.removeProperty('--user-font-color');
  }
}

// Auto-run applyTheme on startup
if (typeof window !== 'undefined') {
  try {
    applyTheme();
  } catch {
    // Ignore during build
  }
}
