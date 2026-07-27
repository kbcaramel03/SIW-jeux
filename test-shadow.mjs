// Tests de Shadow Hunters : les rôles sont bien répartis, des parties entières
// jouées au hasard se terminent, et les vues ne fuient pas les identités.
import { createShadow, joinShadow, startShadow, rollShadow, placeShadow, actShadow, targetShadow, attackShadow, revealShadow, tickShadow, viewFor, AREAS } from './server/games/shadowhunters.js';

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

for (const nPlayers of [4, 5, 6, 7, 8]) {
  const s = createShadow();
  const ids = Array.from({ length: nPlayers }, (_, i) => `p${i}`);
  s.names = Object.fromEntries(ids.map((id) => [id, id.toUpperCase()]));
  for (const id of ids) joinShadow(s, id);
  startShadow(s, ids[0]);

  // Répartition des camps conforme.
  const camps = ids.map((id) => s.players[id].camp);
  const count = (c) => camps.filter((x) => x === c).length;
  const expected = { 4: [2, 2, 0], 5: [2, 2, 1], 6: [2, 2, 2], 7: [3, 3, 1], 8: [3, 3, 2] }[nPlayers];
  if (count('shadow') !== expected[0] || count('hunter') !== expected[1] || count('neutral') !== expected[2]) {
    throw new Error(`${nPlayers}j : répartition ${count('shadow')}/${count('hunter')}/${count('neutral')} au lieu de ${expected}`);
  }

  // Les identités des autres ne fuient pas tant que rien n'est révélé.
  const v = viewFor(s, ids[0]);
  for (const id of ids.slice(1)) {
    if (v.players[id].char !== null) throw new Error('Identité visible sans révélation !');
    if (v.players[id].maxHp !== null) throw new Error('PV max visibles (indice d\'identité) !');
  }
  if (!v.me?.char?.name) throw new Error('Ma propre identité devrait être visible.');

  // Partie jouée au hasard jusqu'au bout.
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 5000) {
    const id = s.turn;
    const p = s.players[id];
    try {
      if (s.stage === 'move') {
        if (!p.revealed && Math.random() < 0.05) {
          const others = ids.filter((x) => x !== id && s.players[x].alive);
          revealShadow(s, id, others.length ? rand(others) : undefined);
        }
        if (s.phase === 'playing' && s.turn === id && s.stage === 'move') rollShadow(s, id);
      } else if (s.stage === 'place') {
        placeShadow(s, id, rand(AREAS.filter((a) => a.id !== p.area)).id);
      } else if (s.stage === 'action') {
        const choices = {
          ermite: ['vision', 'skip'], porte: ['white', 'black', 'vision', 'skip'],
          eglise: ['white', 'skip'], cimetiere: ['black', 'skip'],
          foret: ['damage', 'heal', 'skip'], autel: ['skip'],
        }[p.area];
        actShadow(s, id, rand(choices));
      } else if (s.stage === 'target') {
        const alive = ids.filter((x) => s.players[x].alive);
        const pend = s.pending || {};
        const pool = pend.kind === 'steal'
          ? alive.filter((x) => x !== id && s.players[x].equips.length)
          : pend.kind === 'foret-heal' ? alive : alive.filter((x) => x !== id);
        if (pool.length) targetShadow(s, id, rand(pool));
        else { s.pending = null; s.stage = 'attack'; }
      } else if (s.stage === 'attack') {
        const zone = s.zones.find((z) => z.includes(p.area));
        const targets = ids.filter((x) => x !== id && s.players[x].alive && zone.includes(s.players[x].area));
        attackShadow(s, id, targets.length && Math.random() < 0.8 ? rand(targets) : null);
      }
    } catch (e) {
      throw new Error(`${nPlayers}j, étape ${s.stage}: ${e.message}`);
    }
  }
  if (s.phase !== 'over') throw new Error(`${nPlayers}j : partie sans fin`);
  console.log(`✓ ${nPlayers} joueuses : partie finie, gagnantes = ${s.winners.length ? s.winners.join(', ') : 'aucune'}`);
}

// L'horloge débloque une joueuse muette à chaque étape.
{
  const s = createShadow();
  const ids = ['a', 'b', 'c', 'd'];
  s.names = Object.fromEntries(ids.map((id) => [id, id]));
  for (const id of ids) joinShadow(s, id);
  startShadow(s, ids[0]);
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 3000) {
    s.turnSince = Date.now() - 60000;
    tickShadow(s);
  }
  if (s.phase !== 'over') throw new Error('tickShadow ne termine pas la partie');
  console.log('✓ l\'horloge joue les absentes jusqu\'à la fin de partie');
}
console.log('✅ Shadow Hunters OK');
