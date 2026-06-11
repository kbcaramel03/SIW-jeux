// Simulation de parties de Ludo complètes pour valider le moteur :
// joue au hasard jusqu'à la fin et vérifie les invariants des règles.
import { createLudo, joinLudo, startLudo, rollLudo, moveLudo, viewFor } from './server/games/ludo.js';

const SAFE = new Set([1, 9, 14, 22, 27, 35, 40, 48]);
const START = { red: 1, green: 14, yellow: 27, blue: 40 };

let captures = 0, threeSixes = 0;
for (let game = 0; game < 200; game++) {
  const s = createLudo();
  const ids = ['a', 'b', 'c', 'd'].slice(0, 2 + (game % 3));
  s.names = Object.fromEntries(ids.map((i) => [i, i.toUpperCase()]));
  for (const id of ids) joinLudo(s, id);
  startLudo(s, ids[0]);

  let steps = 0;
  while (s.phase === 'playing' && steps++ < 20000) {
    const before = JSON.stringify(s.pawns);
    if (s.die == null) rollLudo(s, s.turn);
    else moveLudo(s, s.turn, s.movable[Math.floor(Math.random() * s.movable.length)]);
    if (s.log.some((l) => l.includes('mange'))) captures = 1;
    if (s.log.some((l) => l.includes('trois 6'))) threeSixes = 1;

    // Invariant : jamais deux couleurs différentes sur une case non protégée.
    const occ = {};
    for (const id of s.seats) {
      for (const p of s.pawns[id]) {
        if (p < 0 || p > 50) continue;
        const cell = (START[s.colors[id]] + p) % 52;
        if (SAFE.has(cell)) continue;
        if (occ[cell] && occ[cell] !== s.colors[id]) {
          throw new Error(`Deux couleurs sur la case ${cell} ! ${before}`);
        }
        occ[cell] = s.colors[id];
      }
    }
    // Invariant : chaque joueur a toujours exactement 4 pions, p dans [-1, 56].
    for (const id of s.seats) {
      if (s.pawns[id].length !== 4) throw new Error('Pas 4 pions !');
      if (s.pawns[id].some((p) => p < -1 || p > 56)) throw new Error('Position hors limites !');
    }
  }
  if (s.phase !== 'over') throw new Error(`Partie ${game} sans fin (${steps} coups)`);
  if (!s.winner || s.ranks.length !== ids.length) throw new Error('Classement incomplet : ' + JSON.stringify(s.ranks));
  // La vue ne doit pas planter pour chaque joueur ni pour un spectateur.
  for (const id of [...ids, 'spectateur']) viewFor(s, id);
}
console.log(`✅ 200 parties simulées sans erreur (captures vues: ${captures ? 'oui' : 'non'}, triple 6 vu: ${threeSixes ? 'oui' : 'non'})`);
