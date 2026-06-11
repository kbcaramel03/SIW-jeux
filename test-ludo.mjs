// Simulation de parties de Ludo (façon Plato) pour valider le moteur :
// joue au hasard jusqu'à la fin et vérifie les invariants des règles.
import { createLudo, joinLudo, startLudo, rollLudo, moveLudo, viewFor } from './server/games/ludo.js';

const RING = 56;
const START = { red: 8, green: 22, yellow: 36, blue: 50 };

let captures = 0, threeSixes = 0, exitOnOne = 0;
for (let game = 0; game < 200; game++) {
  const s = createLudo();
  const ids = ['a', 'b', 'c', 'd'].slice(0, 2 + (game % 3));
  s.names = Object.fromEntries(ids.map((i) => [i, i.toUpperCase()]));
  for (const id of ids) joinLudo(s, id);
  startLudo(s, ids[0]);

  let steps = 0;
  while (s.phase === 'playing' && steps++ < 30000) {
    if (s.die == null) {
      rollLudo(s, s.turn);
      if (s.die === 1 && s.movable.some((i) => s.pawns[s.turn][i] === -1)) exitOnOne = 1;
    } else {
      moveLudo(s, s.turn, s.movable[Math.floor(Math.random() * s.movable.length)]);
    }
    if (s.log.some((l) => l.includes('mange'))) captures = 1;
    if (s.log.some((l) => l.includes('trois 6'))) threeSixes = 1;

    // Invariant Plato : jamais deux pions sur la même case (anneau ET lignes).
    const occ = new Set();
    for (const id of s.seats) {
      for (const p of s.pawns[id]) {
        if (p === -1 || p === 62) continue;
        const key = p < RING ? `r${(START[s.colors[id]] + p) % RING}` : `${s.colors[id]}-l${p}`;
        if (occ.has(key)) throw new Error(`Deux pions sur la case ${key} !`);
        occ.add(key);
      }
    }
    // Invariant : 4 pions chacun, positions dans [-1, 62].
    for (const id of s.seats) {
      if (s.pawns[id].length !== 4) throw new Error('Pas 4 pions !');
      if (s.pawns[id].some((p) => p < -1 || p > 62)) throw new Error('Position hors limites !');
    }
  }
  if (s.phase !== 'over') throw new Error(`Partie ${game} sans fin (${steps} coups)`);
  if (!s.winner || s.ranks.length !== ids.length) throw new Error('Classement incomplet : ' + JSON.stringify(s.ranks));
  for (const id of [...ids, 'spectateur']) viewFor(s, id);
}
console.log(`✅ 200 parties Plato simulées sans erreur (captures: ${captures ? 'oui' : 'non'}, triple 6: ${threeSixes ? 'oui' : 'non'}, sortie au 1: ${exitOnOne ? 'oui' : 'non'})`);
