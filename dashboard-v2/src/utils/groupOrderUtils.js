/**
 * Utilitários de ordenação manual (prioridade) dos conjuntos / cards
 * na Ficha Técnica e no Terminal do Operador.
 */

export const GROUP_ORDER_STORAGE_KEY = 'mach3_pipeline_group_order';

export function normalizeGroupOrderKey(jobName, subfolder) {
  const j = String(jobName || 'geral').replace(/\s+/g, ' ').trim().toLowerCase();
  const s = String(subfolder || 'raiz').replace(/\s+/g, ' ').trim().toLowerCase();
  return `${j}|||${s}`;
}

export function readCachedGroupOrder() {
  try {
    const raw = localStorage.getItem(GROUP_ORDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string' && x.trim()) : [];
  } catch {
    return [];
  }
}

export function writeCachedGroupOrder(order) {
  try {
    if (Array.isArray(order)) {
      localStorage.setItem(GROUP_ORDER_STORAGE_KEY, JSON.stringify(order));
    }
  } catch {
    // ignore storage quota errors
  }
}

function isGroupIsopor(g) {
  return (
    (g.subfolder || '').toLowerCase().includes('isopor') ||
    (Array.isArray(g.tasks) &&
      g.tasks.some(
        t =>
          (t.material || '').toLowerCase().includes('isopor') ||
          (t.name || '').toLowerCase().includes('isopor')
      ))
  );
}

/**
 * Ordena os grupos conforme a lista salva de prioridade (`savedOrder`).
 * Grupos presentes em `savedOrder` aparecem primeiro na ordem definida pelo usuário;
 * grupos novos seguem depois (mantendo Isopor/EPS no topo entre os novos).
 */
export function sortGroupsByPriority(groups = [], savedOrder = [], prioritizeIsoporFallback = true) {
  const indexMap = new Map();
  if (Array.isArray(savedOrder)) {
    savedOrder.forEach((k, idx) => {
      if (typeof k === 'string' && k && !indexMap.has(k)) {
        indexMap.set(k, idx);
      }
    });
  }

  return [...groups]
    .map((g, origIdx) => ({
      g,
      origIdx,
      orderKey: g.orderKey || normalizeGroupOrderKey(g.jobName, g.subfolder)
    }))
    .sort((a, b) => {
      const idxA = indexMap.has(a.orderKey) ? indexMap.get(a.orderKey) : Infinity;
      const idxB = indexMap.has(b.orderKey) ? indexMap.get(b.orderKey) : Infinity;
      if (idxA !== idxB) return idxA - idxB;

      if (prioritizeIsoporFallback) {
        const aIso = isGroupIsopor(a.g);
        const bIso = isGroupIsopor(b.g);
        if (aIso && !bIso) return -1;
        if (!aIso && bIso) return 1;
      }
      return a.origIdx - b.origIdx;
    })
    .map(item => ({ ...item.g, orderKey: item.orderKey }));
}

/**
 * Move um grupo visível de `fromIndex` para `toIndex` e retorna o novo array completo
 * de chaves de prioridade, preservando chaves de outros projetos atualmente filtrados.
 */
export function moveGroupInOrder(visibleGroups = [], savedOrder = [], fromIndex, toIndex) {
  if (
    !Array.isArray(visibleGroups) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= visibleGroups.length ||
    toIndex >= visibleGroups.length ||
    fromIndex === toIndex
  ) {
    return Array.isArray(savedOrder) ? [...savedOrder] : [];
  }

  const visibleKeys = visibleGroups.map(
    g => g.orderKey || normalizeGroupOrderKey(g.jobName, g.subfolder)
  );
  const reorderedVisible = [...visibleKeys];
  const [moved] = reorderedVisible.splice(fromIndex, 1);
  reorderedVisible.splice(toIndex, 0, moved);

  const visibleSet = new Set(reorderedVisible);
  const hiddenPreserved = (Array.isArray(savedOrder) ? savedOrder : []).filter(
    k => typeof k === 'string' && k && !visibleSet.has(k)
  );

  return [...reorderedVisible, ...hiddenPreserved];
}
