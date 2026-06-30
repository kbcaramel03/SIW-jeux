// Simulation du Pouilleux : jeu aléatoire jusqu'à ce qu'une joueuse reste avec le Zombie.
import { createPouilleux, joinPouilleux, startPouilleux, drawPouilleux, viewFor } from './server/games/pouilleux.js';

for (let game = 0; game < 400; game++) {
  const s = createPouilleux();
  const ids = ['a', 'b', 'c', 'd', 'e', 'f'].slice(0, 2 + (game % 5));
  s.names = Object.fromEntries(ids.map((i) => [i, i.toUpperCase()]));
  for (const id of ids) joinPouilleux(s, id);
  startPouilleux(s, ids[0]);

  let steps = 0;
  while (s.phase === 'playing' && steps++ < 3000) {
    const me = s.turn;
    const target = ids.find((id) => id !== me && s.hands[id].length > 0); // approx voisine
    const v = viewFor(s, me);
    if (!v.target) break;
    drawPouilleux(s, me, Math.floor(Math.random() * s.hands[v.target].length));
    // Invariant : le Zombie existe toujours exactement une fois et ne se jette jamais.
    const zombies = ids.reduce((n, id) => n + s.hands[id].filter((c) => c.kind === 'zombie').length, 0);
    if (zombies !== 1) throw new Error(`Zombie compté ${zombies} fois`);
    for (const id of ids) viewFor(s, id);
  }
  if (s.phase !== 'over') throw new Error(`Partie ${game} sans fin (${steps} coups)`);
  // La perdante doit tenir le Zombie (et rien d'autre).
  if (s.loser) {
    const h = s.hands[s.loser];
    if (h.length !== 1 || h[0].kind !== 'zombie') throw new Error('La perdante ne tient pas (que) le Zombie : ' + JSON.stringify(h));
  }
}
console.log('✅ 400 parties Pouilleux simulées (2 à 6 joueuses) — le Zombie reste unique, la perdante le tient à la fin');
