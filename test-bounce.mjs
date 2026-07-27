// Tests de Bounce : la volée se termine toujours, les briques encaissent bien,
// et des parties entières (joueuses + bot en secours local) se terminent.
import { createBounce, joinBounce, startBounce, shootBounce, tickBounce, simulateVolley, BOARD } from './server/games/bounce.js';

// 1) Une volée simple casse une brique posée juste au-dessus du lanceur.
{
  const grid = [Array(BOARD.COLS).fill(null)];
  grid[0][3] = { hp: 2 };
  const res = simulateVolley(grid, 3, 0.5, { dx: 0, dy: -1 });
  if (grid[0][3] !== null) throw new Error(`Brique pas cassée: ${JSON.stringify(grid[0][3])}`);
  if (res.destroyed !== 1) throw new Error(`destroyed=${res.destroyed}`);
  console.log('✓ volée droite casse la brique (hp 2, 3 balles)');
}

// 2) Le bonus « +1 balle » est ramassé sans rebond.
{
  const grid = [Array(BOARD.COLS).fill(null)];
  grid[0][3] = { ball: true };
  const res = simulateVolley(grid, 1, 0.5, { dx: 0, dy: -1 });
  if (res.gained !== 1) throw new Error(`gained=${res.gained}`);
  console.log('✓ bonus balle ramassé');
}

// 3) Parties complètes : 2 joueuses + bot, tirs aléatoires vers le haut.
for (let g = 0; g < 5; g++) {
  const s = createBounce();
  s.names = { a: 'A', b: 'B' };
  joinBounce(s, 'a'); joinBounce(s, 'b'); joinBounce(s, 'bot');
  startBounce(s, 'a');
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 2000) {
    for (const id of ['a', 'b']) {
      if (s.phase !== 'playing') break;
      if (s.players[id].alive) {
        shootBounce(s, id, { dx: (Math.random() - 0.5) * 1.6, dy: -0.4 - Math.random() });
      }
    }
    if (s.phase !== 'playing') break;
    if (s.players.bot.alive) {
      s.botAt = Date.now() - 1;
      tickBounce(s);
    }
  }
  if (s.phase !== 'over') throw new Error(`Partie bounce ${g} sans fin`);
  if (!s.winners?.length) throw new Error(`Partie bounce ${g} sans gagnante`);
}
console.log('✅ 5/5 parties de Bounce terminées avec gagnante(s)');
