export const PRIORITY_CONFIG = {
  urgente: { color: 'bg-red-500', label: 'Urgente', text: 'text-red-400' },
  alta:    { color: 'bg-orange-400', label: 'Alta', text: 'text-orange-400' },
  media:   { color: 'bg-yellow-400', label: 'Média', text: 'text-yellow-400' },
  baixa:   { color: 'bg-blue-400', label: 'Baixa', text: 'text-blue-400' },
};

export const INITIAL_CARDS = {
  todo: [
    { id: 'k1', title: 'Peças de MDF — Cliente Marcenaria X', machine: 'Router Central', date: 'Hoje 18:00', priority: 'alta' },
    { id: 'k2', title: 'Gravação Acrílico — Loja Y', machine: 'Laser', date: 'Amanhã', priority: 'media' },
  ],
  doing: [
    { id: 'k4', title: 'Moldes de PETG — Embalagens Z', machine: 'Mesa de Vácuo', operator: 'Op. João', priority: 'urgente' },
    { id: 'k5', title: 'Corte Chapas — Sinalização ABC', machine: 'Laser', operator: 'Op. Maria', priority: 'alta' },
  ],
  done: [
    { id: 'k6', title: 'Usinagem Painel — Cliente W', machine: 'Router 2', date: 'Entregue ontem', priority: 'media' },
  ],
};

export const KANBAN_COLS = [
  { id: 'todo',  label: 'A Fazer',      color: 'text-text-muted',   bg: 'bg-white/[0.02]',      border: 'border-white/5',        countBg: 'bg-bg-main text-white' },
  { id: 'doing', label: 'Em Andamento', color: 'text-orange-400',   bg: 'bg-orange-500/5',     border: 'border-orange-500/20', countBg: 'bg-orange-500 text-white' },
  { id: 'done',  label: 'Concluído',    color: 'text-accent-success', bg: 'bg-accent-success/5', border: 'border-accent-success/20', countBg: 'bg-accent-success text-black' },
];

export const STAR_LABELS = ['', 'Péssima', 'Ruim', 'Regular', 'Boa', 'Excelente'];

export const KANBAN_MACHINES = [
  'Router Central',
  'Router 2',
  'Laser',
  'Mesa de Vácuo',
];

export function normalizeStr(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\.(txt|tap|nc|gcode|cnc|dxf)$/i, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchKanbanTitle(jobFileName, jobFolder, cardTitle) {
  const normTitle = normalizeStr(cardTitle);
  if (!normTitle) return false;

  const normFile   = normalizeStr(jobFileName);
  const normFolder = normalizeStr(jobFolder);
  const fullJobText = `${normFile} ${normFolder}`.trim();

  // 1. Exact match — always valid
  if (normFile && normFile === normTitle) return true;
  if (normFolder && normFolder === normTitle) return true;

  // 2. The job filename fully contains the entire card title string
  if (normFile && normFile.includes(normTitle) && normTitle.length >= 6) return true;
  if (normFolder && normFolder.includes(normTitle) && normTitle.length >= 6) return true;

  // 3. STRICT: ALL meaningful words of the card title must be present in the job text.
  // This ensures a generic filename like "mdf 9mm" NEVER matches a specific card like
  // "chapa 2 MDF 9MM VETOR LOGO TARTARUGA e4mm" — because "vetor", "tartaruga", etc.
  // would be missing from the job filename.
  const titleWords = normTitle.split(' ').filter(w => w.length >= 3);
  if (titleWords.length >= 2) {
    const allTitleWordsInJob = titleWords.every(w => fullJobText.includes(w));
    if (allTitleWordsInJob) {
      // Extra guard: the job must also cover at least 50% of those words
      // (avoids matching when folder path accidentally contains many unrelated words)
      const jobWords = fullJobText.split(' ').filter(w => w.length >= 3);
      const jobHits  = jobWords.filter(w => normTitle.includes(w)).length;
      if (jobWords.length === 0 || jobHits / jobWords.length >= 0.5) {
        return true;
      }
    }
  }

  return false;
}
