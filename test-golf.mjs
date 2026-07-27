// Tests du Mini Golf : chaque trou est finissable par tir simulé, les balles
// restent dans les limites, et des parties entières (bot en secours local +
// joueuses aléatoires) se terminent avec des gagnantes.
import { createGolf, joinGolf, startGolf, shootGolf, tickGolf, simulateGolf, HOLES, COURSE } from './server/games/minigolf.js';

// 1) Chaque trou est finissable : un éventail de tirs simulés depuis le départ
// doit toucher le trou en moins de 8 coups (stratégie gloutonne : meilleur coup).
for (let h = 0; h < HOLES.length; h++) {
  const hd = HOLES[h];
  const ball = { x: hd.start[0], y: hd.start[1], vx: 0, vy: 0 };
  let holed = false;
  let strokes = 0;
  while (!holed && strokes < 8) {
    strokes++;
    // cherche le meilleur coup depuis la position courante
    const aHole = Math.atan2(hd.hole[1] - ball.y, hd.hole[0] - ball.x);
    let best = null;
    for (let k = -20; k <= 20; k++) {
      for (const power of [0.3, 0.55, 0.8, 1]) {
        const sim = { x: ball.x, y: ball.y, vx: 0, vy: 0 };
        const a = aHole + k * 0.15;
        const ok = simulateGolf(hd, sim, { dx: Math.cos(a), dy: Math.sin(a), power });
        const dist = Math.hypot(sim.x - hd.hole[0], sim.y - hd.hole[1]);
        if (!best || (ok && !best.ok) || (ok === best.ok && dist < best.dist)) best = { a, power, ok, dist };
      }
    }
    holed = simulateGolf(hd, ball, { dx: Math.cos(best.a), dy: Math.sin(best.a), power: best.power });
    if (ball.x < 0 || ball.x > COURSE.W || ball.y < 0 || ball.y > COURSE.H) {
      throw new Error(`Trou ${h + 1} : balle hors limites (${ball.x}, ${ball.y})`);
    }
  }
  if (!holed) throw new Error(`Trou ${h + 1} (${hd.name}) infinissable en 8 coups`);
  console.log(`✓ trou ${h + 1} (${hd.name}) fini en ${strokes} coup(s) par le meilleur tir`);
}

// 2) Parties complètes : 3 joueuses dont le bot (secours local, sans clé API).
for (let g = 0; g < 5; g++) {
  const s = createGolf();
  s.names = { a: 'A', b: 'B' };
  joinGolf(s, 'a'); joinGolf(s, 'b'); joinGolf(s, 'bot');
  startGolf(s, 'a');
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 3000) {
    if (s.breakUntil) { s.breakUntil = Date.now() - 1; tickGolf(s); continue; }
    if (s.turn === 'bot') {
      s.turnSince = Date.now() - 20000;
      if (s.botPlan) s.botPlan.at = Date.now() - 1;
      tickGolf(s);
    } else if (s.turn) {
      const hd = HOLES[s.hole];
      const b = s.balls[s.turn];
      shootGolf(s, s.turn, {
        dx: hd.hole[0] - b.x + (Math.random() - 0.5) * 0.4,
        dy: hd.hole[1] - b.y + (Math.random() - 0.5) * 0.4,
        power: 0.2 + Math.random() * 0.8,
      });
    }
  }
  if (s.phase !== 'over') throw new Error(`Partie golf ${g} sans fin`);
  if (!s.winners?.length) throw new Error(`Partie golf ${g} sans gagnante`);
}
console.log('✅ 5/5 parties de mini golf terminées avec gagnante(s)');
