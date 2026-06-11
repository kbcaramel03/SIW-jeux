// Simulation de parties d'échecs aléatoires pour valider le moteur :
// coups légaux pris au hasard via la vue (comme le ferait le client).
import { createEchecs, joinEchecs, startEchecs, moveEchecs, resignEchecs, drawEchecs, viewFor } from './server/games/echecs.js';

const results = {};
for (let game = 0; game < 50; game++) {
  const s = createEchecs();
  joinEchecs(s, 'alice'); joinEchecs(s, 'beth');
  startEchecs(s, 'alice');
  let steps = 0;
  while (s.phase === 'playing' && steps++ < 250) {
    const turnId = viewFor(s, s.white).turnColor === 'w' ? s.white : s.black;
    const v = viewFor(s, turnId);
    if (!v.isMyTurn || v.legal.length === 0) throw new Error('Vue incohérente : pas de coup légal proposé.');
    const mv = v.legal[Math.floor(Math.random() * v.legal.length)];
    moveEchecs(s, turnId, { from: mv.from, to: mv.to, promotion: mv.promotion ? 'q' : undefined });
    // La vue du spectateur et de l'adversaire ne doivent jamais planter.
    viewFor(s, 'spectatrice'); viewFor(s, turnId === s.white ? s.black : s.white);
  }
  if (s.phase === 'playing') { resignEchecs(s, s.white); }
  results[s.result] = (results[s.result] || 0) + 1;
}

// Cas particuliers : nulle sur accord, coup illégal rejeté, abandon.
const s = createEchecs();
joinEchecs(s, 'a'); joinEchecs(s, 'b'); startEchecs(s, 'a');
let threw = false;
try { moveEchecs(s, s.white, { from: 'e2', to: 'e7' }); } catch { threw = true; }
if (!threw) throw new Error('Coup illégal accepté !');
drawEchecs(s, s.white);
drawEchecs(s, s.black);
if (s.phase !== 'over' || s.result !== 'agreed') throw new Error('Nulle sur accord cassée.');

// Promotion forcée : position simple roi+pion.
console.log('✅ 50 parties simulées —', JSON.stringify(results), '| illégal rejeté, nulle acceptée OK');
