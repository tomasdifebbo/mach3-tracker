import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeGroupOrderKey,
  sortGroupsByPriority,
  moveGroupInOrder
} from '../src/utils/groupOrderUtils.js';

test('groupOrderUtils sorts groups by saved priority and preserves hidden groups when reordering', () => {
  const gA = { jobName: '2640  - EXPRESSO HOGWARTS CCXP', subfolder: 'PORTA PRINCIPAL', tasks: [{ material: 'MDF 6mm' }] };
  const gB = { jobName: '2640 - EXPRESSO HOGWARTS CCXP', subfolder: 'ISOPOR COLUNAS parte 2', tasks: [{ material: 'Isopor EPS 100mm' }] };
  const gC = { jobName: '2640 - EXPRESSO HOGWARTS CCXP', subfolder: 'TOPO', tasks: [{ material: 'Compensado 6mm' }] };

  // Normalizes multiple spaces identically
  assert.equal(
    normalizeGroupOrderKey(gA.jobName, gA.subfolder),
    '2640 - expresso hogwarts ccxp|||porta principal'
  );

  // Without saved order, Isopor stays on top
  const defaultSorted = sortGroupsByPriority([gA, gB, gC], [], true);
  assert.equal(defaultSorted[0].subfolder, 'ISOPOR COLUNAS parte 2');

  // Move index 2 (TOPO) to index 0 (top priority), while preserving another hidden project key
  const hiddenKey = '9999 - outro projeto|||raiz';
  const nextOrder = moveGroupInOrder(defaultSorted, [hiddenKey], 2, 0);
  assert.equal(nextOrder[0], normalizeGroupOrderKey(gC.jobName, gC.subfolder));
  assert.equal(nextOrder[nextOrder.length - 1], hiddenKey);

  // Re-sorting with saved order puts TOPO at #1 ahead of Isopor
  const customSorted = sortGroupsByPriority([gA, gB, gC], nextOrder, true);
  assert.equal(customSorted[0].subfolder, 'TOPO');
  assert.equal(customSorted[1].subfolder, 'ISOPOR COLUNAS parte 2');
  assert.equal(customSorted[2].subfolder, 'PORTA PRINCIPAL');
});
