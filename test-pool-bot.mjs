// Le bot billard (secours local, sans clé API) : des parties entières se
// terminent, le bot ne tire jamais au hasard (ses coups sont simulés avant),
// et le calcul des candidats reste rapide.
import { createPool, joinPool, startPool, shootPool, tickPool, SKILLS } from './server/games/pool.js';

let botWins = 0; let done = 0;
for (let g = 0; g < 10; g++) {
  const s = createPool();
  s.names = { a: 'A' };
  joinPool(s, 'a'); joinPool(s, 'bot');
  startPool(s, 'a');
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 4000) {
    if (s.turn === 'bot') {
      // On avance les horloges pour ne pas attendre en vrai.
      s.turnSince = Date.now() - 20000;
      if (s.botPlan) s.botPlan.at = Date.now() - 1;
      tickPool(s);
      if (s.botSkill && !SKILLS[s.botSkill]) throw new Error(`Niveau inconnu: ${s.botSkill}`);
    } else {
      // L'humaine : pousse sa bille la plus proche (comme le test existant).
      const cue = s.balls.find((b) => b.id === 0);
      const targets = s.balls.filter((b) => !b.pocketed && b.id !== 0 && b.id !== 8);
      const t = targets[Math.floor(Math.random() * targets.length)] || s.balls.find((b) => b.id === 8 && !b.pocketed);
      shootPool(s, s.turn, {
        dx: t.x - cue.x + (Math.random() - 0.5) * 0.1,
        dy: t.y - cue.y + (Math.random() - 0.5) * 0.1,
        power: 0.3 + Math.random() * 0.5,
      });
    }
  }
  if (s.phase !== 'over') throw new Error(`Partie ${g} sans fin (niveau bot: ${s.botSkill})`);
  done++;
  if (s.winner === 'bot') botWins++;
}
console.log(`✓ ${done}/10 parties bot terminées — le bot en gagne ${botWins} (secours local)`);

// Vitesse du calcul des candidats sur une table pleine (appelé à chaque tour bot).
{
  const s = createPool();
  s.names = { a: 'A' };
  joinPool(s, 'a'); joinPool(s, 'bot');
  startPool(s, 'a');
  s.groups = { bot: 'solid', a: 'stripe' };
  s.turn = 'bot'; s.turnSince = Date.now() - 20000;
  const t0 = Date.now();
  tickPool(s); // sans clé API : construit les candidats et planifie le tir
  const ms = Date.now() - t0;
  if (ms > 800) throw new Error(`candidateShots trop lent: ${ms}ms`);
  console.log(`✓ tour de bot calculé en ${ms}ms (table pleine)`);
}
