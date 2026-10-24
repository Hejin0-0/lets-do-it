// The jellies in the order the page shows them. Each loads on demand, so the page downloads one specimen at a time;
// tint colours the curtain while it comes in.
export const SPECIMENS = [
  { id: '01', tint: '#e9a92f', name: 'Ring mold Jelly', load: () => import('./01-pineapple/index.js') },
  { id: '02', tint: '#df3346', name: 'Gummy Bear', load: () => import('./02-gummy-bear/index.js') },
  { id: '03', tint: '#2c63c9', name: 'Dolphin Jelly', load: () => import('./03-dolphin/index.js') },
  { id: '04', tint: '#b8691f', name: 'Custard Pudding', load: () => import('./04-pudding/index.js') },
  { id: '05', tint: '#3f6b25', name: 'Whole Melon', load: () => import('./05-whole-melon/index.js') },
  { id: '06', tint: '#b8283a', name: 'Melon Jelly', load: () => import('./06-melon-knife/index.js') },
  { id: '07', tint: '#ea842c', name: 'Citrus Jelly', load: () => import('./07-citrus-cutter/index.js') },
  { id: '08', tint: '#f5c400', name: 'Jelly Press', load: () => import('./08-press/index.js') },
  { id: '09', tint: '#2f6fd6', name: 'Jelly Dice', load: () => import('./09-dice/index.js') },
  { id: '10', tint: '#178a8a', name: 'Island Jelly', load: () => import('./10-island/index.js') },
  { id: '11', tint: '#1f7a8c', name: 'Harbor Jelly', load: () => import('./11-harbor/index.js') },
  { id: '12', tint: '#5a8f3a', name: 'Lock Jelly', load: () => import('./12-lock/index.js') },
  { id: '13', tint: '#2f86c4', name: 'Iceberg Jelly', load: () => import('./13-iceberg/index.js') },
];
