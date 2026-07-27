// Tests du Monopoly « règles officielles » : parties entières (achats, enchères,
// hypothèques, construction équilibrée, cartes, prison, faillites), argent
// cohérent, stock de la banque respecté, échanges valides.
import {
  createMonopoly, joinMonopoly, startMonopoly, rollMonopoly, buyMonopoly, bidMonopoly,
  buildMonopoly, mortgageMonopoly, offerTrade, respondTrade, tickMonopoly, BOARD,
} from './server/games/monopoly.js';

// 1) Plateau bien formé.
if (BOARD.length !== 40) throw new Error(`BOARD: ${BOARD.length} cases`);
for (const c of BOARD) {
  if (c.t === 'prop' && (!c.rents || c.rents.length !== 6 || !c.maison)) throw new Error(`Case mal formée: ${c.name}`);
}
console.log('✓ plateau de 40 cases bien formé');

// 2) Enchères : refuser un achat lance une enchère, la meilleure offre gagne.
{
  const s = createMonopoly();
  s.names = { a: 'A', b: 'B' };
  joinMonopoly(s, 'a'); joinMonopoly(s, 'b');
  startMonopoly(s, 'a');
  // Force la situation : A sur la case 39 (Rue de la Paix), au stage d'achat.
  s.turn = 'a'; s.stage = 'buy'; s.buyIdx = 39; s.players.a.pos = 39;
  buyMonopoly(s, 'a', false);
  if (s.stage !== 'auction' || !s.auction || s.auction.idx !== 39) throw new Error('Refus sans enchère !');
  bidMonopoly(s, 'b', 50);
  bidMonopoly(s, 'a', 80);
  s.auction.endsAt = Date.now() - 1;
  tickMonopoly(s);
  if (s.owner['39'] !== 'a') throw new Error('L\'enchère n\'a pas attribué le terrain.');
  if (s.players.a.cash !== 1500 - 80) throw new Error(`Cash après enchère: ${s.players.a.cash}`);
  console.log('✓ enchères : refus -> enchère -> adjugé au plus offrant');
}

// 3) Hypothèque et construction équilibrée.
{
  const s = createMonopoly();
  s.names = { a: 'A', b: 'B' };
  joinMonopoly(s, 'a'); joinMonopoly(s, 'b');
  startMonopoly(s, 'a');
  s.owner['1'] = 'a'; s.owner['3'] = 'a'; // groupe marron complet
  buildMonopoly(s, 'a', 1);
  let evenOk = false;
  try { buildMonopoly(s, 'a', 1); } catch { evenOk = true; } // 2e maison sur le même : interdit
  if (!evenOk) throw new Error('La règle de construction équilibrée n\'est pas appliquée.');
  buildMonopoly(s, 'a', 3);
  buildMonopoly(s, 'a', 1); // maintenant OK
  if (s.bank.houses !== 32 - 3) throw new Error(`Stock banque: ${s.bank.houses}`);
  let hypBlocked = false;
  try { mortgageMonopoly(s, 'a', 1); } catch { hypBlocked = true; } // maisons sur le groupe
  if (!hypBlocked) throw new Error('Hypothèque possible avec des maisons !');
  const cashBefore = s.players.a.cash;
  s.owner['5'] = 'a';
  mortgageMonopoly(s, 'a', 5); // gare : hypothèque OK
  if (s.players.a.cash !== cashBefore + 100) throw new Error('Valeur d\'hypothèque incorrecte.');
  mortgageMonopoly(s, 'a', 5, true); // levée à 110 %
  if (s.players.a.cash !== cashBefore + 100 - 110) throw new Error('Levée d\'hypothèque incorrecte.');
  console.log('✓ hypothèques (moitié prix, levée +10 %) et construction équilibrée');
}

// 4) Échange : proposition, acceptation, transfert.
{
  const s = createMonopoly();
  s.names = { a: 'A', b: 'B' };
  joinMonopoly(s, 'a'); joinMonopoly(s, 'b');
  startMonopoly(s, 'a');
  s.owner['1'] = 'a'; s.owner['3'] = 'b';
  offerTrade(s, 'a', { to: 'b', giveProps: [1], askProps: [3], giveCash: 40, askCash: 0 });
  respondTrade(s, 'b', true);
  if (s.owner['1'] !== 'b' || s.owner['3'] !== 'a') throw new Error('Transfert d\'échange raté.');
  if (s.players.a.cash !== 1460 || s.players.b.cash !== 1540) throw new Error('Cash d\'échange faux.');
  console.log('✓ échanges entre joueuses');
}

// 5) Parties complètes : 3 joueuses + bot ; enchères résolues par l'horloge.
let overByRuin = 0;
for (let game = 0; game < 8; game++) {
  const s = createMonopoly();
  s.names = { a: 'A', b: 'B', c: 'C' };
  joinMonopoly(s, 'a'); joinMonopoly(s, 'b'); joinMonopoly(s, 'c'); joinMonopoly(s, 'bot');
  startMonopoly(s, 'a');
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 12000) {
    if (s.stage === 'auction') {
      // parfois une humaine surenchérit, sinon l'horloge adjuge
      const bidder = ['a', 'b', 'c'][Math.floor(Math.random() * 3)];
      const next = s.auction.bid + 10 + Math.floor(Math.random() * 40);
      if (Math.random() < 0.5 && s.players[bidder].alive && s.players[bidder].cash >= next) {
        bidMonopoly(s, bidder, next);
      }
      s.auction.endsAt = Date.now() - 1;
      if (s.auction.botAt) s.auction.botAt = Date.now() - 1;
      tickMonopoly(s);
      continue;
    }
    if (s.trade) { respondTrade(s, s.trade.to, Math.random() < 0.5); continue; }
    const id = s.turn;
    if (id === 'bot') {
      s.turnSince = Date.now() - 30000;
      tickMonopoly(s);
      continue;
    }
    if (s.stage === 'buy') {
      buyMonopoly(s, id, Math.random() < 0.7);
    } else {
      if (Math.random() < 0.25) {
        for (let i = 0; i < 40; i++) {
          if (BOARD[i].t !== 'prop' || s.owner[String(i)] !== id) continue;
          try { buildMonopoly(s, id, i); } catch { /* règles */ }
        }
      }
      rollMonopoly(s, id);
    }
  }
  if (s.phase !== 'over') throw new Error(`Partie ${game} sans fin (tour ${s.round}, stage ${s.stage})`);
  if (!s.winner) throw new Error(`Partie ${game} sans gagnante`);
  const alive = s.seats.filter((x) => s.players[x].alive);
  if (alive.length === 1) overByRuin++;
  for (const x of s.seats) {
    if (s.players[x].cash < 0) throw new Error(`Cash négatif pour ${x}: ${s.players[x].cash}`);
  }
  if (s.bank.houses < 0 || s.bank.houses > 32 || s.bank.hotels < 0 || s.bank.hotels > 12) {
    throw new Error(`Stock banque incohérent: ${s.bank.houses} maisons, ${s.bank.hotels} hôtels`);
  }
}
console.log(`✅ 8/8 parties de Monopoly terminées (${overByRuin} par ruine, ${8 - overByRuin} au cap de tours)`);
