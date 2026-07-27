// Tests de Présages : équipes formées par les Absolus, conditions de défausse,
// contrainte ±, et parties entières (4/5/6 joueuses + bot) qui se terminent.
import { createPresages, joinPresages, startPresages, playPresages, tickPresages, CARDS } from './server/games/presages.js';

// 1) Table des cartes : 35 cartes, couleurs et textes présents.
for (let v = 1; v <= 35; v++) {
  if (!CARDS[v] || !CARDS[v].text) throw new Error(`Carte ${v} manquante`);
  if (v <= 29 && !CARDS[v].color) throw new Error(`Carte ${v} sans couleur`);
}
console.log('✓ 35 cartes arcanes bien définies');

// 2) Équipes : le plus fort Absolu avec le plus faible.
{
  const s = createPresages();
  const ids = ['a', 'b', 'c', 'd'];
  s.names = Object.fromEntries(ids.map((id) => [id, id]));
  for (const id of ids) joinPresages(s, id);
  startPresages(s, 'a');
  const sorted = s.seats.slice().sort((x, y) => s.absolus[y] - s.absolus[x]);
  const t0 = s.teams.find((t) => t.includes(sorted[0]));
  if (!t0.includes(sorted[3])) throw new Error('Le plus fort Absolu doit jouer avec le plus faible.');
  for (const id of ids) {
    if (s.hands[id].length !== 5) throw new Error(`Main de ${s.hands[id].length} cartes à 4 joueuses`);
    if (!s.hands[id].includes(s.absolus[id])) throw new Error('L\'Absolu doit être dans la main.');
  }
  console.log('✓ équipes par Absolus + mains de 5 cartes à 4 joueuses');
}

// 3) Le pli : la plus forte est défaussée, les autres reviennent en main.
{
  const s = createPresages();
  const ids = ['a', 'b', 'c', 'd'];
  s.names = Object.fromEntries(ids.map((id) => [id, id]));
  for (const id of ids) joinPresages(s, id);
  startPresages(s, 'a');
  // Mains contrôlées : cartes sans effet de défausse automatique entre elles.
  const order = [];
  let cur = s.leader;
  for (let k = 0; k < 4; k++) { order.push(cur); cur = s.seats[(s.seats.indexOf(cur) + 1) % 4]; }
  s.hands[order[0]] = [30, 14]; // gagnera avec 30
  s.hands[order[1]] = [9, 31];  // 9 = ne peut pas remporter
  s.hands[order[2]] = [23, 32]; // 23 = ne peut pas remporter
  s.hands[order[3]] = [14, 33];
  s.hands[order[3]] = [33, 5];  // 33 en jeu perdra contre... non : 33 > 30 !
  s.hands[order[0]] = [34, 14]; // 34 gagne
  playPresages(s, order[0], 34);
  playPresages(s, order[1], 9);
  playPresages(s, order[2], 23);
  playPresages(s, order[3], 33);
  if (!s.lastTrick) throw new Error('Pli non résolu');
  const disc = s.lastTrick.cards.filter((c) => c.discarded).map((c) => c.card);
  if (!disc.includes(34)) throw new Error(`La gagnante (34) devait être défaussée: ${disc}`);
  if (s.hands[order[1]].includes(9) === false) throw new Error('Le 9 devait revenir en main.');
  if (s.leader !== order[0]) throw new Error('La gagnante devait mener le tour suivant.');
  console.log('✓ pli : la plus forte défaussée, les autres reviennent, la gagnante mène');
}

// 4) Parties complètes au hasard (avec bot en secours local).
for (const n of [4, 5, 6]) {
  const s = createPresages();
  const ids = Array.from({ length: n - 1 }, (_, i) => `p${i}`);
  s.names = Object.fromEntries(ids.map((id) => [id, id]));
  for (const id of ids) joinPresages(s, id);
  joinPresages(s, 'bot');
  startPresages(s, ids[0]);
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 4000) {
    if (s.mancheEnd) { s.mancheEnd.until = Date.now() - 1; tickPresages(s); continue; }
    const id = s.turn;
    if (!id) throw new Error('Tour perdu');
    if (id === 'bot') {
      s.turnSince = Date.now() - 60000;
      tickPresages(s);
      continue;
    }
    const hand = s.hands[id];
    const legalAll = hand.filter((card) => {
      if (!s.constraint) return true;
      return s.constraint.dir === 'up' ? card > s.constraint.val : card < s.constraint.val;
    });
    const legal = legalAll.length ? legalAll : hand;
    playPresages(s, id, legal[Math.floor(Math.random() * legal.length)]);
  }
  if (s.phase !== 'over') throw new Error(`${n} joueuses : partie sans fin (manche ${s.manche})`);
  if (!s.winners?.length) throw new Error(`${n} joueuses : pas de gagnantes`);
  console.log(`✓ ${n} joueuses : partie finie en ${s.manche} manche(s), gagnantes = ${s.winners.join(' & ')}`);
}
console.log('✅ Présages OK');
