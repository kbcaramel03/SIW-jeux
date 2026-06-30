// Simulation de parties de Go Fish (jeu aléatoire valide) pour valider le moteur.
import { createGoFish, joinGoFish, startGoFish, askGoFish, viewFor } from './server/games/gofish.js';

for (let game = 0; game < 300; game++) {
  const s = createGoFish();
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, 2 + (game % 5));
  s.names = Object.fromEntries(ids.map((i) => [i, i.toUpperCase()]));
  for (const id of ids) joinGoFish(s, id);
  startGoFish(s, ids[0]);

  let steps = 0;
  while (s.phase === 'playing' && steps++ < 5000) {
    const me = s.turn;
    const hand = s.hands[me];
    // Invariant : la joueuse active a toujours au moins une carte (sinon le moteur l'a fait piger/passer).
    if (hand.length === 0) throw new Error('Joueuse active sans carte !');
    const rank = hand[Math.floor(Math.random() * hand.length)].rank;
    const opponents = ids.filter((id) => id !== me);
    const target = opponents[Math.floor(Math.random() * opponents.length)];
    askGoFish(s, me, target, rank);

    // Invariants globaux : total des cartes conservé (52), pas de carré > 13.
    const inHands = ids.reduce((n, id) => n + s.hands[id].length, 0);
    const inBooks = ids.reduce((n, id) => n + s.books[id].length, 0) * 4;
    if (inHands + s.pool.length + inBooks !== 52) throw new Error(`Cartes perdues: ${inHands}+${s.pool.length}+${inBooks}`);
    for (const id of ids) viewFor(s, id);
    viewFor(s, 'spectatrice');
  }
  if (s.phase !== 'over') throw new Error(`Partie ${game} sans fin (${steps} coups)`);
  const books = ids.reduce((n, id) => n + s.books[id].length, 0);
  if (books !== 13) throw new Error(`Fin sans 13 carrés : ${books}`);
  if (!s.winner) throw new Error('Pas de vainqueur');
}
console.log('✅ 300 parties Go Fish simulées (2 à 6 joueuses) — 52 cartes conservées, 13 carrés, vainqueur OK');
