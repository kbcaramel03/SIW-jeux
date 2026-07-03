// Tests du moteur de Billard : la simulation s'arrête, les billes restent sur
// la table, les poches avalent, et des parties aléatoires se terminent.
import { createPool, joinPool, startPool, shootPool, simulate, rackBalls, TABLE } from './server/games/pool.js';

// 1) La casse s'arrête et les billes restent dans les limites.
{
  const balls = rackBalls();
  const potted = simulate(balls, { dx: 1, dy: 0.02, power: 1 });
  for (const b of balls) {
    if (b.pocketed) continue;
    if (b.x < 0 || b.x > TABLE.W || b.y < 0 || b.y > TABLE.H) throw new Error(`Bille hors table: ${JSON.stringify(b)}`);
  }
  console.log(`✓ casse OK (${potted.length} empochée(s), billes dans les limites)`);
}

// 2) Un tir visé vers une poche empoche la bille.
{
  const balls = [
    { id: 0, x: 0.5, y: 0.5, vx: 0, vy: 0, pocketed: false },
    { id: 1, x: 1.7, y: 0.5, vx: 0, vy: 0, pocketed: false },
  ];
  // On vise la bille 1 alignée vers la poche du coin (1.98, 0.98) ? Non : alignons
  // blanche -> bille 1 -> poche droite du milieu haut… tir droit vers le coin bas droit.
  const b1 = balls[1];
  const target = [1.98, 0.98];
  // place la bille 1 sur la ligne blanche->poche
  const t = 0.7;
  b1.x = 0.5 + (target[0] - 0.5) * t; b1.y = 0.5 + (target[1] - 0.5) * t;
  const potted = simulate(balls, { dx: target[0] - 0.5, dy: target[1] - 0.5, power: 0.9 });
  if (!potted.includes(1)) throw new Error('La bille visée n\'est pas tombée: ' + JSON.stringify(potted));
  console.log('✓ empochage visé OK');
}

// 3) Parties complètes aléatoires (2 joueuses) : toujours une gagnante.
let wins = 0;
for (let g = 0; g < 30; g++) {
  const s = createPool();
  s.names = { a: 'A', b: 'B' };
  joinPool(s, 'a'); joinPool(s, 'b');
  startPool(s, 'a');
  let n = 0;
  while (s.phase === 'playing' && n++ < 400) {
    const cue = s.balls.find((b) => b.id === 0);
    const targets = s.balls.filter((b) => !b.pocketed && b.id !== 0);
    const t = targets[Math.floor(Math.random() * targets.length)];
    const jx = (Math.random() - 0.5) * 0.2, jy = (Math.random() - 0.5) * 0.2;
    shootPool(s, s.turn, { dx: t.x - cue.x + jx, dy: t.y - cue.y + jy, power: 0.3 + Math.random() * 0.7 });
  }
  if (s.phase !== 'over') throw new Error(`Partie ${g} sans fin (${n} tirs)`);
  wins++;
}
console.log(`✅ ${wins}/30 parties de billard terminées avec une gagnante`);
