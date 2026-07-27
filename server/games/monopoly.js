// Monopoly (plateau français classique), règles officielles : achats, enchères
// quand on refuse d'acheter, loyers (doublés sur groupe complet nu), maisons et
// hôtels à construction équilibrée, stock de la banque (32 maisons, 12 hôtels),
// hypothèques (moitié du prix, levée à +10 %), échanges entre joueuses, prison
// (payer 50 €, carte « Libéré de prison » ou tenter un double, 3 essais), les
// 16 vraies cartes Chance et 16 Caisse de Communauté (pioches mélangées qui
// tournent), faillites au profit du créancier. Seule entorse (parties en ligne) :
// au bout de 60 tours de table, la plus riche gagne. ChatGPT peut jouer.
import { aiTurn } from '../ai.js';

// rents = [terrain nu, 1 maison, 2, 3, 4, hôtel]. maison = prix d'une maison.
export const BOARD = [
  { t: 'go', name: 'Départ' },
  { t: 'prop', name: 'Bd de Belleville', price: 60, group: 'marron', rents: [2, 10, 30, 90, 160, 250], maison: 50 },
  { t: 'caisse', name: 'Caisse de Communauté' },
  { t: 'prop', name: 'Rue Lecourbe', price: 60, group: 'marron', rents: [4, 20, 60, 180, 320, 450], maison: 50 },
  { t: 'taxe', name: 'Impôts sur le revenu', amount: 200 },
  { t: 'gare', name: 'Gare Montparnasse', price: 200 },
  { t: 'prop', name: 'Rue de Vaugirard', price: 100, group: 'ciel', rents: [6, 30, 90, 270, 400, 550], maison: 50 },
  { t: 'chance', name: 'Chance' },
  { t: 'prop', name: 'Rue de Courcelles', price: 100, group: 'ciel', rents: [6, 30, 90, 270, 400, 550], maison: 50 },
  { t: 'prop', name: 'Av. de la République', price: 120, group: 'ciel', rents: [8, 40, 100, 300, 450, 600], maison: 50 },
  { t: 'prison', name: 'Prison (simple visite)' },
  { t: 'prop', name: 'Bd de la Villette', price: 140, group: 'rose', rents: [10, 50, 150, 450, 625, 750], maison: 100 },
  { t: 'cie', name: 'Cie de Distribution d\'Électricité', price: 150 },
  { t: 'prop', name: 'Av. de Neuilly', price: 140, group: 'rose', rents: [10, 50, 150, 450, 625, 750], maison: 100 },
  { t: 'prop', name: 'Rue de Paradis', price: 160, group: 'rose', rents: [12, 60, 180, 500, 700, 900], maison: 100 },
  { t: 'gare', name: 'Gare de Lyon', price: 200 },
  { t: 'prop', name: 'Av. Mozart', price: 180, group: 'orange', rents: [14, 70, 200, 550, 750, 950], maison: 100 },
  { t: 'caisse', name: 'Caisse de Communauté' },
  { t: 'prop', name: 'Bd Saint-Michel', price: 180, group: 'orange', rents: [14, 70, 200, 550, 750, 950], maison: 100 },
  { t: 'prop', name: 'Place Pigalle', price: 200, group: 'orange', rents: [16, 80, 220, 600, 800, 1000], maison: 100 },
  { t: 'parc', name: 'Parc Gratuit' },
  { t: 'prop', name: 'Av. Matignon', price: 220, group: 'rouge', rents: [18, 90, 250, 700, 875, 1050], maison: 150 },
  { t: 'chance', name: 'Chance' },
  { t: 'prop', name: 'Bd Malesherbes', price: 220, group: 'rouge', rents: [18, 90, 250, 700, 875, 1050], maison: 150 },
  { t: 'prop', name: 'Av. Henri-Martin', price: 240, group: 'rouge', rents: [20, 100, 300, 750, 925, 1100], maison: 150 },
  { t: 'gare', name: 'Gare du Nord', price: 200 },
  { t: 'prop', name: 'Fbg Saint-Honoré', price: 260, group: 'jaune', rents: [22, 110, 330, 800, 975, 1150], maison: 150 },
  { t: 'prop', name: 'Place de la Bourse', price: 260, group: 'jaune', rents: [22, 110, 330, 800, 975, 1150], maison: 150 },
  { t: 'cie', name: 'Cie de Distribution des Eaux', price: 150 },
  { t: 'prop', name: 'Rue La Fayette', price: 280, group: 'jaune', rents: [24, 120, 360, 850, 1025, 1200], maison: 150 },
  { t: 'gotojail', name: 'Allez en Prison !' },
  { t: 'prop', name: 'Av. de Breteuil', price: 300, group: 'vert', rents: [26, 130, 390, 900, 1100, 1275], maison: 200 },
  { t: 'prop', name: 'Av. Foch', price: 300, group: 'vert', rents: [26, 130, 390, 900, 1100, 1275], maison: 200 },
  { t: 'prop', name: 'Bd des Capucines', price: 320, group: 'vert', rents: [28, 150, 450, 1000, 1200, 1400], maison: 200 },
  { t: 'gare', name: 'Gare Saint-Lazare', price: 200 },
  { t: 'chance', name: 'Chance' },
  { t: 'prop', name: 'Av. des Champs-Élysées', price: 350, group: 'bleu', rents: [35, 175, 500, 1100, 1300, 1500], maison: 200 },
  { t: 'taxe', name: 'Taxe de luxe', amount: 100 },
  { t: 'caisse', name: 'Caisse de Communauté' },
  { t: 'prop', name: 'Rue de la Paix', price: 400, group: 'bleu', rents: [50, 200, 600, 1400, 1700, 2000], maison: 200 },
];

const GROUPS = {};
BOARD.forEach((c, i) => { if (c.group) (GROUPS[c.group] = GROUPS[c.group] || []).push(i); });
const GARES = [5, 15, 25, 35];
const CIES = [12, 28];

const START_CASH = 1500;
const GO_BONUS = 200;
const JAIL_POS = 10;
const BAIL = 50;
const ROUND_CAP = 60;             // entorse « soirée » : pas de partie sans fin
const BANK_HOUSES = 32;
const BANK_HOTELS = 12;
const AUCTION_START_MS = 14000;   // durée initiale d'une enchère
const AUCTION_BID_MS = 7000;      // temps restant après chaque offre
const IDLE_ROLL_MS = 35000;
const IDLE_BUY_MS = 25000;
const IDLE_TRADE_MS = 30000;

// Les 16 cartes Chance de l'édition française (francs convertis en euros).
const CHANCE = [
  { text: 'Avancez jusqu\'à la case Départ. Touchez 200 €.', go: 0 },
  { text: 'Rendez-vous à la Rue de la Paix.', go: 39 },
  { text: 'Rendez-vous à l\'Avenue Henri-Martin. Si vous passez par la case Départ, recevez 200 €.', go: 24 },
  { text: 'Avancez au Boulevard de la Villette. Si vous passez par la case Départ, recevez 200 €.', go: 11 },
  { text: 'Avancez jusqu\'à la Gare de Lyon. Si vous passez par la case Départ, recevez 200 €.', go: 15 },
  { text: 'Rendez-vous à la gare la plus proche. Si vous passez par la case Départ, recevez 200 €.', nearestGare: true },
  { text: 'Reculez de trois cases.', back: 3 },
  { text: 'Allez en prison. Ne passez pas par la case Départ, ne touchez pas 200 €.', jail: true },
  { text: 'Vous êtes libéré de prison. Cette carte peut être conservée jusqu\'à utilisation.', gooj: true },
  { text: 'Vous êtes imposé pour les réparations de voirie : 40 € par maison, 115 € par hôtel.', perHouse: 40, perHotel: 115 },
  { text: 'Faites des réparations dans toutes vos maisons : 25 € par maison, 100 € par hôtel.', perHouse: 25, perHotel: 100 },
  { text: 'Amende pour excès de vitesse : payez 15 €.', pay: 15 },
  { text: 'Payez pour frais de scolarité : 150 €.', pay: 150 },
  { text: 'La banque vous verse un dividende de 50 €.', get: 50 },
  { text: 'Votre immeuble et votre prêt rapportent : touchez 150 €.', get: 150 },
  { text: 'Vous avez gagné le prix des mots croisés : recevez 100 €.', get: 100 },
];
// Les 16 cartes Caisse de Communauté.
const CAISSE = [
  { text: 'Placez-vous sur la case Départ. Touchez 200 €.', go: 0 },
  { text: 'Retournez à Belleville.', go: 1, noGo: true },
  { text: 'Allez en prison. Ne passez pas par la case Départ, ne touchez pas 200 €.', jail: true },
  { text: 'Vous êtes libéré de prison. Cette carte peut être conservée jusqu\'à utilisation.', gooj: true },
  { text: 'Erreur de la banque en votre faveur : recevez 200 €.', get: 200 },
  { text: 'Recevez votre revenu annuel : 100 €.', get: 100 },
  { text: 'Héritage : vous touchez 100 €.', get: 100 },
  { text: 'La vente de votre stock vous rapporte 50 €.', get: 50 },
  { text: 'Intérêts sur l\'emprunt à 7 % : recevez 25 €.', get: 25 },
  { text: 'Les contributions vous remboursent 20 €.', get: 20 },
  { text: 'C\'est votre anniversaire ! Chaque joueuse vous donne 10 €.', birthday: 10 },
  { text: 'Vous avez gagné le 2e Prix de Beauté : recevez 10 €.', get: 10 },
  { text: 'Payez votre Police d\'Assurance : 50 €.', pay: 50 },
  { text: 'Payez la note du médecin : 50 €.', pay: 50 },
  { text: 'Payez une amende de 10 €.', pay: 10 },
  { text: 'Rendez-vous à la gare la plus proche. Si vous passez par la case Départ, recevez 200 €.', nearestGare: true },
];

const nm = (state, id) => (state.names && state.names[id]) || 'quelqu\'un';
const isOffline = (s, id) => !!(s.offline && s.offline[id]);
function pushLog(state, text) { state.log.push(text); if (state.log.length > 50) state.log = state.log.slice(-50); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function createMonopoly() {
  return {
    type: 'monopoly',
    phase: 'waiting', // waiting -> playing -> over
    seats: [],
    players: {},  // uid -> { cash, pos, jail, jailTries, alive, doubles, gooj: ['chance'|'caisse'] }
    owner: {},    // idx (string) -> uid
    houses: {},   // idx -> 0..5 (5 = hôtel)
    mortgaged: {},// idx -> true
    bank: { houses: BANK_HOUSES, hotels: BANK_HOTELS },
    decks: { chance: shuffle(CHANCE.map((_, i) => i)), caisse: shuffle(CAISSE.map((_, i) => i)) },
    turn: null,
    stage: 'roll', // roll | buy | auction
    buyIdx: null,
    auction: null, // { idx, bid, bidder, endsAt }
    trade: null,   // { from, to, giveProps, askProps, giveCash, askCash, at }
    dice: null,
    round: 1,
    turnSince: null,
    lastCard: null,
    names: {},
    winner: null,
    log: [],
  };
}

export function joinMonopoly(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 6) state.seats.push(userId);
}

export function startMonopoly(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut au moins 2 joueuses.');
  state.players = Object.fromEntries(state.seats.map((id) => [id, {
    cash: START_CASH, pos: 0, jail: false, jailTries: 0, alive: true, doubles: 0, gooj: [],
  }]));
  state.owner = {}; state.houses = {}; state.mortgaged = {};
  state.bank = { houses: BANK_HOUSES, hotels: BANK_HOTELS };
  state.decks = { chance: shuffle(CHANCE.map((_, i) => i)), caisse: shuffle(CAISSE.map((_, i) => i)) };
  state.turn = state.seats[Math.floor(Math.random() * state.seats.length)];
  state.stage = 'roll'; state.buyIdx = null; state.auction = null; state.trade = null; state.dice = null;
  state.round = 1; state.turnSince = Date.now();
  state.winner = null; state.lastCard = null; state.aiTask = null;
  state.phase = 'playing';
  state.log = [`${nm(state, state.turn)} commence avec ${START_CASH} € !`];
}

const aliveSeats = (state) => state.seats.filter((id) => state.players[id].alive);
const groupOf = (idx) => BOARD[idx].group;
const fullGroup = (state, group, uid) => GROUPS[group].every((gi) => state.owner[String(gi)] === uid);

function netWorth(state, id) {
  let w = state.players[id].cash;
  for (const [idx, uid] of Object.entries(state.owner)) {
    if (uid !== id) continue;
    w += state.mortgaged[idx] ? Math.floor((BOARD[idx].price || 0) / 2) : (BOARD[idx].price || 0);
    w += (state.houses[idx] || 0) * (BOARD[idx].maison || 0);
  }
  return w;
}

function checkEnd(state) {
  const alive = aliveSeats(state);
  if (alive.length === 1) {
    state.phase = 'over';
    state.winner = alive[0];
    pushLog(state, `${nm(state, state.winner)} ruine tout le monde et gagne !`);
    return true;
  }
  if (state.round > ROUND_CAP) {
    state.phase = 'over';
    const best = alive.map((id) => [id, netWorth(state, id)]).sort((a, b) => b[1] - a[1]);
    state.winner = best[0][0];
    pushLog(state, `${ROUND_CAP} tours de table : ${nm(state, state.winner)} est la plus riche (${best[0][1]} €) et gagne !`);
    return true;
  }
  return false;
}

// Trouve de l'argent de force : vend des maisons (à moitié prix) puis hypothèque.
// C'est ce que la banque impose à une joueuse endettée.
function raiseCash(state, id, needed) {
  const p = state.players[id];
  // 1) vendre les maisons/hôtels, niveau par niveau (du plus construit au moins)
  let sold = true;
  while (p.cash < needed && sold) {
    sold = false;
    let bestIdx = null; let bestH = 0;
    for (const [idx, uid] of Object.entries(state.owner)) {
      if (uid !== id) continue;
      const h = state.houses[idx] || 0;
      if (h > bestH) { bestH = h; bestIdx = idx; }
    }
    if (bestIdx !== null && bestH > 0) {
      if (bestH === 5) { state.bank.hotels += 1; state.bank.houses = Math.max(0, state.bank.houses - 4); }
      else state.bank.houses += 1;
      state.houses[bestIdx] = bestH - 1;
      p.cash += Math.floor((BOARD[bestIdx].maison || 0) / 2);
      sold = true;
    }
  }
  // 2) hypothéquer les terrains restants
  for (const [idx, uid] of Object.entries(state.owner)) {
    if (p.cash >= needed) return;
    if (uid !== id || state.mortgaged[idx]) continue;
    if ((state.houses[idx] || 0) > 0) continue;
    state.mortgaged[idx] = true;
    p.cash += Math.floor((BOARD[idx].price || 0) / 2);
  }
}

// Paiement avec faillite éventuelle : tout (argent, terrains hypothéqués ou non,
// cartes de sortie de prison) passe au créancier, ou revient à la banque.
function pay(state, id, amount, toId) {
  const p = state.players[id];
  raiseCash(state, id, amount);
  if (p.cash >= amount) {
    p.cash -= amount;
    if (toId && state.players[toId]) state.players[toId].cash += amount;
    return true;
  }
  const rest = p.cash;
  p.cash = 0; p.alive = false;
  const creditor = toId && state.players[toId] ? toId : null;
  if (creditor) {
    state.players[creditor].cash += rest;
    state.players[creditor].gooj.push(...p.gooj);
  } else {
    // La banque récupère : les cartes « Libéré de prison » retournent au paquet.
    for (const deck of p.gooj) returnGooj(state, deck);
  }
  p.gooj = [];
  for (const [idx, uid] of Object.entries(state.owner)) {
    if (uid !== id) continue;
    // les maisons retournent à la banque (le créancier récupère les terrains)
    const h = state.houses[idx] || 0;
    if (h === 5) state.bank.hotels += 1;
    else state.bank.houses += h;
    state.houses[idx] = 0;
    if (creditor) state.owner[idx] = creditor;
    else { delete state.owner[idx]; delete state.mortgaged[idx]; }
  }
  pushLog(state, `💥 ${nm(state, id)} fait faillite${creditor ? ` au profit de ${nm(state, creditor)}` : ''} !`);
  if (state.trade && (state.trade.from === id || state.trade.to === id)) state.trade = null;
  if (state.turn === id) advanceTurn(state);
  checkEnd(state);
  return false;
}

function returnGooj(state, deckName) {
  const deck = deckName === 'chance' ? CHANCE : CAISSE;
  const idx = deck.findIndex((c) => c.gooj);
  if (idx >= 0 && !state.decks[deckName].includes(idx)) state.decks[deckName].push(idx);
}

function advanceTurn(state) {
  if (state.phase !== 'playing') return;
  const order = state.seats;
  const i = order.indexOf(state.turn);
  for (let k = 1; k <= order.length; k++) {
    const cand = order[(i + k) % order.length];
    if (state.players[cand].alive) {
      if ((i + k) >= order.length) state.round += 1;
      state.turn = cand;
      break;
    }
  }
  state.stage = 'roll';
  state.buyIdx = null;
  state.players[state.turn].doubles = 0;
  state.turnSince = Date.now();
  checkEnd(state);
}

// Après résolution de la case : un double fait rejouer, sinon tour suivant.
function afterResolve(state, id) {
  if (state.phase !== 'playing') return;
  const p = state.players[id];
  if (!p || !p.alive || state.turn !== id) return;
  if (p.doubles > 0 && !p.jail) {
    state.stage = 'roll';
    state.buyIdx = null;
    state.turnSince = Date.now();
    pushLog(state, `Double ! ${nm(state, id)} rejoue.`);
  } else {
    advanceTurn(state);
  }
}

// --- Enchères (règle officielle : un refus d'achat déclenche une enchère) -----
function startAuction(state, idx) {
  state.stage = 'auction';
  state.buyIdx = null;
  state.auction = { idx, bid: 0, bidder: null, endsAt: Date.now() + AUCTION_START_MS };
  pushLog(state, `🔨 ${BOARD[idx].name} est mise aux enchères !`);
}

export function bidMonopoly(state, userId, amount) {
  if (state.phase !== 'playing' || state.stage !== 'auction' || !state.auction) throw new Error('Aucune enchère en cours.');
  const p = state.players[userId];
  if (!p || !p.alive) throw new Error('Tu ne peux pas enchérir.');
  const a = Math.round(Number(amount));
  if (!Number.isFinite(a) || a <= state.auction.bid) throw new Error('Offre trop basse.');
  if (a > p.cash) throw new Error('Tu n\'as pas cet argent.');
  state.auction.bid = a;
  state.auction.bidder = userId;
  state.auction.endsAt = Date.now() + AUCTION_BID_MS;
  pushLog(state, `${nm(state, userId)} monte à ${a} € pour ${BOARD[state.auction.idx].name}.`);
}

function finishAuction(state) {
  const auc = state.auction;
  state.auction = null;
  state.stage = 'roll';
  if (auc.bidder) {
    const p = state.players[auc.bidder];
    p.cash -= auc.bid; // les offres sont plafonnées au liquide : pas de faillite ici
    state.owner[String(auc.idx)] = auc.bidder;
    pushLog(state, `🔨 Adjugé ! ${nm(state, auc.bidder)} remporte ${BOARD[auc.idx].name} pour ${auc.bid} €.`);
  } else {
    pushLog(state, `🔨 Personne n'en veut : ${BOARD[auc.idx].name} reste à la banque.`);
  }
  afterResolve(state, state.turn);
}

// --- Cartes -------------------------------------------------------------------
function drawCard(state, id, deckName) {
  const deck = state.decks[deckName];
  const cards = deckName === 'chance' ? CHANCE : CAISSE;
  if (!deck.length) state.decks[deckName] = shuffle(cards.map((_, i) => i).filter((i) => !cards[i].gooj || !heldGooj(state, deckName)));
  const ci = state.decks[deckName].shift();
  const card = cards[ci];
  state.lastCard = { text: card.text, deck: deckName === 'chance' ? 'Chance' : 'Caisse de Communauté', by: id };
  pushLog(state, `🃏 ${nm(state, id)} (${state.lastCard.deck}) : « ${card.text} »`);
  const p = state.players[id];

  if (card.gooj) { p.gooj.push(deckName); afterResolve(state, id); return; } // gardée, ne revient pas au paquet
  state.decks[deckName].push(ci); // les autres cartes retournent sous le paquet

  if (card.jail) { sendToJail(state, id); advanceTurn(state); return; }
  if (card.get) { p.cash += card.get; afterResolve(state, id); return; }
  if (card.pay) { if (!pay(state, id, card.pay, null)) return; afterResolve(state, id); return; }
  if (card.birthday) {
    for (const other of aliveSeats(state)) {
      if (other === id) continue;
      if (state.phase !== 'playing') break;
      pay(state, other, card.birthday, id);
    }
    if (state.phase !== 'playing' || state.turn !== id) return;
    afterResolve(state, id);
    return;
  }
  if (card.perHouse) {
    let due = 0;
    for (const [idx, uid] of Object.entries(state.owner)) {
      if (uid !== id) continue;
      const h = state.houses[idx] || 0;
      due += h === 5 ? card.perHotel : h * card.perHouse;
    }
    if (due && !pay(state, id, due, null)) return;
    afterResolve(state, id);
    return;
  }
  if (card.back) { p.pos = (p.pos - card.back + 40) % 40; landOn(state, id); return; }
  if (card.nearestGare) {
    const next = GARES.find((g) => g > p.pos) ?? GARES[0];
    if (next <= p.pos) { p.cash += GO_BONUS; pushLog(state, `${nm(state, id)} passe par le Départ : +${GO_BONUS} €.`); }
    p.pos = next;
    landOn(state, id);
    return;
  }
  if (card.go !== undefined) {
    if (card.go === 0) { p.pos = 0; p.cash += GO_BONUS; afterResolve(state, id); return; } // un seul bonus de 200 €
    if (card.go < p.pos && !card.noGo) { p.cash += GO_BONUS; pushLog(state, `${nm(state, id)} passe par le Départ : +${GO_BONUS} €.`); }
    p.pos = card.go;
    landOn(state, id);
    return;
  }
  afterResolve(state, id);
}

const heldGooj = (state, deckName) => state.seats.some((id) => state.players[id]?.gooj?.includes(deckName));

function sendToJail(state, id) {
  const p = state.players[id];
  p.pos = JAIL_POS; p.jail = true; p.jailTries = 0; p.doubles = 0;
  pushLog(state, `🚔 ${nm(state, id)} file en prison !`);
}

// --- Atterrissage sur une case ------------------------------------------------
function landOn(state, id) {
  const p = state.players[id];
  const c = BOARD[p.pos];
  const idx = String(p.pos);

  if (c.t === 'gotojail') { sendToJail(state, id); advanceTurn(state); return; }
  if (c.t === 'taxe') {
    pushLog(state, `${nm(state, id)} paie ${c.amount} € (${c.name}).`);
    if (!pay(state, id, c.amount, null)) return;
    afterResolve(state, id);
    return;
  }
  if (c.t === 'chance') { drawCard(state, id, 'chance'); return; }
  if (c.t === 'caisse') { drawCard(state, id, 'caisse'); return; }

  if (c.t === 'prop' || c.t === 'gare' || c.t === 'cie') {
    const owner = state.owner[idx];
    if (!owner) {
      if (p.cash >= c.price) {
        state.stage = 'buy';
        state.buyIdx = p.pos;
        state.turnSince = Date.now();
        return; // acheter… ou l'envoyer aux enchères (règle officielle)
      }
      pushLog(state, `${nm(state, id)} n'a pas de quoi acheter ${c.name}.`);
      startAuction(state, p.pos);
      return;
    }
    if (owner === id) { afterResolve(state, id); return; }
    if (state.mortgaged[idx]) {
      pushLog(state, `${c.name} est hypothéquée : pas de loyer.`);
      afterResolve(state, id);
      return;
    }
    let rent = 0;
    if (c.t === 'prop') {
      const h = state.houses[idx] || 0;
      rent = h > 0 ? c.rents[h] : (fullGroup(state, c.group, owner) ? c.rents[0] * 2 : c.rents[0]);
    } else if (c.t === 'gare') {
      const n = GARES.filter((gi) => state.owner[String(gi)] === owner && !state.mortgaged[String(gi)]).length;
      rent = 25 * (2 ** (n - 1));
    } else {
      const n = CIES.filter((gi) => state.owner[String(gi)] === owner && !state.mortgaged[String(gi)]).length;
      const d = state.dice ? state.dice[0] + state.dice[1] : 7;
      rent = d * (n === 2 ? 10 : 4);
    }
    pushLog(state, `${nm(state, id)} paie ${rent} € de loyer à ${nm(state, owner)} (${c.name}).`);
    if (!pay(state, id, rent, owner)) return;
    afterResolve(state, id);
    return;
  }
  // go, prison (visite), parc : rien
  afterResolve(state, id);
}

function movePlayer(state, id, steps) {
  const p = state.players[id];
  const next = (p.pos + steps) % 40;
  if (next < p.pos) {
    p.cash += GO_BONUS;
    pushLog(state, `${nm(state, id)} passe par le Départ : +${GO_BONUS} €.`);
  }
  p.pos = next;
  landOn(state, id);
}

// --- Tour de jeu --------------------------------------------------------------
export function rollMonopoly(state, userId) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  if (state.stage !== 'roll') throw new Error('Termine d\'abord l\'action en cours.');
  const p = state.players[userId];
  const d1 = 1 + Math.floor(Math.random() * 6);
  const d2 = 1 + Math.floor(Math.random() * 6);
  state.dice = [d1, d2];
  state.lastCard = null;

  if (p.jail) {
    if (d1 === d2) {
      p.jail = false; p.jailTries = 0;
      pushLog(state, `${nm(state, userId)} fait un double et sort de prison !`);
      p.doubles = 0; // en sortant sur un double, on ne rejoue pas (règle officielle)
      movePlayer(state, userId, d1 + d2);
      return;
    }
    p.jailTries += 1;
    if (p.jailTries >= 3) {
      pushLog(state, `Troisième essai raté : ${nm(state, userId)} paie ${BAIL} € et sort.`);
      if (!pay(state, userId, BAIL, null)) return;
      p.jail = false; p.jailTries = 0; p.doubles = 0;
      movePlayer(state, userId, d1 + d2);
      return;
    }
    pushLog(state, `${nm(state, userId)} reste en prison (pas de double, essai ${p.jailTries}/3).`);
    advanceTurn(state);
    return;
  }

  if (d1 === d2) {
    p.doubles += 1;
    if (p.doubles >= 3) {
      pushLog(state, `Trois doubles d'affilée !`);
      sendToJail(state, userId);
      advanceTurn(state);
      return;
    }
  } else {
    p.doubles = 0;
  }
  movePlayer(state, userId, d1 + d2);
}

export function bailMonopoly(state, userId) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (state.turn !== userId || state.stage !== 'roll') throw new Error('Ce n\'est pas le moment.');
  const p = state.players[userId];
  if (!p.jail) throw new Error('Tu n\'es pas en prison.');
  if (p.cash < BAIL) throw new Error('Pas assez d\'argent pour la caution.');
  p.cash -= BAIL; p.jail = false; p.jailTries = 0;
  pushLog(state, `${nm(state, userId)} paie ${BAIL} € de caution : libre ! Elle lance les dés.`);
}

export function useGoojMonopoly(state, userId) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (state.turn !== userId || state.stage !== 'roll') throw new Error('Ce n\'est pas le moment.');
  const p = state.players[userId];
  if (!p.jail) throw new Error('Tu n\'es pas en prison.');
  if (!p.gooj.length) throw new Error('Tu n\'as pas de carte « Libéré de prison ».');
  const deck = p.gooj.shift();
  returnGooj(state, deck);
  p.jail = false; p.jailTries = 0;
  pushLog(state, `${nm(state, userId)} utilise sa carte « Libéré de prison » ! Elle lance les dés.`);
}

export function buyMonopoly(state, userId, accept) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (state.turn !== userId || state.stage !== 'buy') throw new Error('Aucun achat en cours.');
  const idx = state.buyIdx;
  const c = BOARD[idx];
  const p = state.players[userId];
  if (accept) {
    if (p.cash < c.price) throw new Error('Pas assez d\'argent.');
    p.cash -= c.price;
    state.owner[String(idx)] = userId;
    pushLog(state, `${nm(state, userId)} achète ${c.name} pour ${c.price} €.`);
    state.stage = 'roll';
    state.buyIdx = null;
    afterResolve(state, userId);
  } else {
    // Règle officielle : refuser d'acheter envoie le terrain aux enchères.
    startAuction(state, idx);
  }
}

// --- Construction (équilibrée) et hypothèques ---------------------------------
export function buildMonopoly(state, userId, idx, sell = false) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  const c = BOARD[idx];
  if (!c || c.t !== 'prop') throw new Error('On ne construit pas ici.');
  if (state.owner[String(idx)] !== userId) throw new Error('Ce terrain n\'est pas à toi.');
  if (!state.players[userId].alive) throw new Error('Tu es en faillite.');
  if (!fullGroup(state, c.group, userId)) throw new Error('Il te faut tout le groupe de couleur.');
  const gIdxs = GROUPS[c.group];
  const h = state.houses[String(idx)] || 0;
  const p = state.players[userId];
  if (sell) {
    if (h <= 0) throw new Error('Rien à vendre ici.');
    // vente équilibrée : on vend d'abord les terrains les plus construits
    const maxH = Math.max(...gIdxs.map((gi) => state.houses[String(gi)] || 0));
    if (h < maxH) throw new Error('Vends d\'abord sur le terrain le plus construit (règle équilibrée).');
    if (h === 5) {
      if (state.bank.houses < 4) throw new Error('La banque n\'a plus assez de maisons pour remplacer l\'hôtel.');
      state.bank.hotels += 1; state.bank.houses -= 4;
    } else {
      state.bank.houses += 1;
    }
    state.houses[String(idx)] = h - 1;
    p.cash += Math.floor(c.maison / 2);
    pushLog(state, `${nm(state, userId)} revend ${h === 5 ? 'l\'hôtel' : 'une maison'} de ${c.name} (+${Math.floor(c.maison / 2)} €).`);
  } else {
    if (gIdxs.some((gi) => state.mortgaged[String(gi)])) throw new Error('Impossible de construire : un terrain du groupe est hypothéqué.');
    if (h >= 5) throw new Error('Déjà un hôtel.');
    // construction équilibrée : on construit d'abord sur le moins bâti
    const minH = Math.min(...gIdxs.map((gi) => state.houses[String(gi)] || 0));
    if (h > minH) throw new Error('Construis d\'abord sur le terrain le moins bâti (règle équilibrée).');
    if (p.cash < c.maison) throw new Error('Pas assez d\'argent.');
    if (h === 4) {
      if (state.bank.hotels < 1) throw new Error('La banque n\'a plus d\'hôtels.');
      state.bank.hotels -= 1; state.bank.houses += 4; // l'hôtel remplace les 4 maisons
    } else {
      if (state.bank.houses < 1) throw new Error('La banque n\'a plus de maisons.');
      state.bank.houses -= 1;
    }
    p.cash -= c.maison;
    state.houses[String(idx)] = h + 1;
    pushLog(state, `${nm(state, userId)} construit ${h + 1 === 5 ? 'un hôtel' : 'une maison'} sur ${c.name} (${c.maison} €).`);
  }
}

export function mortgageMonopoly(state, userId, idx, lift = false) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  const c = BOARD[idx];
  if (!c || !c.price) throw new Error('Case invalide.');
  if (state.owner[String(idx)] !== userId) throw new Error('Ce n\'est pas à toi.');
  if (!state.players[userId].alive) throw new Error('Tu es en faillite.');
  const p = state.players[userId];
  const value = Math.floor(c.price / 2);
  if (lift) {
    if (!state.mortgaged[String(idx)]) throw new Error('Pas d\'hypothèque ici.');
    const cost = value + Math.ceil(value / 10); // +10 % d'intérêts (règle officielle, arithmétique entière)
    if (p.cash < cost) throw new Error(`Il faut ${cost} € pour lever l'hypothèque.`);
    p.cash -= cost;
    delete state.mortgaged[String(idx)];
    pushLog(state, `${nm(state, userId)} lève l'hypothèque de ${c.name} (${cost} €).`);
  } else {
    if (state.mortgaged[String(idx)]) throw new Error('Déjà hypothéquée.');
    if (c.group && GROUPS[c.group].some((gi) => (state.houses[String(gi)] || 0) > 0)) {
      throw new Error('Vends d\'abord les maisons du groupe.');
    }
    state.mortgaged[String(idx)] = true;
    p.cash += value;
    pushLog(state, `${nm(state, userId)} hypothèque ${c.name} (+${value} €).`);
  }
}

// --- Échanges -----------------------------------------------------------------
export function offerTrade(state, userId, { to, giveProps = [], askProps = [], giveCash = 0, askCash = 0 }) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (state.trade) throw new Error('Un échange est déjà en cours.');
  const p = state.players[userId];
  const t = state.players[to];
  if (!p?.alive || !t?.alive || to === userId) throw new Error('Joueuse invalide.');
  const give = [...new Set(giveProps.map(Number))];
  const ask = [...new Set(askProps.map(Number))];
  const gCash = Math.max(0, Math.floor(Number(giveCash) || 0));
  const aCash = Math.max(0, Math.floor(Number(askCash) || 0));
  if (!give.length && !ask.length && !gCash && !aCash) throw new Error('L\'échange est vide.');
  if (gCash > p.cash) throw new Error('Tu n\'as pas cet argent.');
  if (aCash > t.cash) throw new Error('Elle n\'a pas cet argent.');
  for (const i of give) {
    if (state.owner[String(i)] !== userId) throw new Error('Tu ne possèdes pas tout ça.');
    const g = groupOf(i);
    if (g && GROUPS[g].some((gi) => (state.houses[String(gi)] || 0) > 0)) throw new Error(`Vends d'abord les maisons du groupe ${g}.`);
  }
  for (const i of ask) {
    if (state.owner[String(i)] !== to) throw new Error('Elle ne possède pas tout ça.');
    const g = groupOf(i);
    if (g && GROUPS[g].some((gi) => (state.houses[String(gi)] || 0) > 0)) throw new Error(`Il y a des maisons sur le groupe ${g}.`);
  }
  state.trade = { from: userId, to, giveProps: give, askProps: ask, giveCash: gCash, askCash: aCash, at: Date.now() };
  pushLog(state, `🤝 ${nm(state, userId)} propose un échange à ${nm(state, to)}.`);
}

export function respondTrade(state, userId, accept) {
  const tr = state.trade;
  if (!tr) throw new Error('Aucun échange en cours.');
  if (userId !== tr.to && !(userId === tr.from && !accept)) throw new Error('Cet échange ne t\'attend pas.');
  state.trade = null;
  if (!accept) {
    pushLog(state, userId === tr.from
      ? `${nm(state, tr.from)} retire sa proposition.`
      : `${nm(state, tr.to)} refuse l'échange.`);
    return;
  }
  const from = state.players[tr.from];
  const to = state.players[tr.to];
  if (!from?.alive || !to?.alive || from.cash < tr.giveCash || to.cash < tr.askCash) {
    pushLog(state, 'L\'échange n\'est plus possible.');
    return;
  }
  from.cash -= tr.giveCash; to.cash += tr.giveCash;
  to.cash -= tr.askCash; from.cash += tr.askCash;
  for (const i of tr.giveProps) state.owner[String(i)] = tr.to;
  for (const i of tr.askProps) state.owner[String(i)] = tr.from;
  const desc = [
    tr.giveProps.map((i) => BOARD[i].name).join(', '),
    tr.giveCash ? `${tr.giveCash} €` : '',
  ].filter(Boolean).join(' + ') || 'rien';
  const desc2 = [
    tr.askProps.map((i) => BOARD[i].name).join(', '),
    tr.askCash ? `${tr.askCash} €` : '',
  ].filter(Boolean).join(' + ') || 'rien';
  pushLog(state, `🤝 Échange conclu : ${nm(state, tr.from)} donne ${desc} contre ${desc2}.`);
}

// --- ChatGPT ------------------------------------------------------------------
// Valeur d'un terrain aux yeux d'une joueuse (sert au bot pour enchérir/échanger).
function botValue(state, idx, forId) {
  const c = BOARD[idx];
  if (!c.price) return 0;
  let v = c.price;
  if (c.group) {
    const others = GROUPS[c.group].filter((gi) => gi !== idx);
    const mine = others.filter((gi) => state.owner[String(gi)] === forId).length;
    v *= 1 + 0.5 * (mine / others.length);
    if (mine === others.length) v *= 1.9; // complète le groupe : très précieux
  } else if (c.t === 'gare') {
    const mine = GARES.filter((gi) => gi !== idx && state.owner[String(gi)] === forId).length;
    v *= 1 + 0.2 * mine;
  }
  if (state.mortgaged[String(idx)]) v *= 0.55;
  return v;
}

function botManage(state) {
  const p = state.players.bot;
  // lever les hypothèques quand on est à l'aise
  for (const [idx, uid] of Object.entries(state.owner)) {
    if (uid !== 'bot' || !state.mortgaged[idx]) continue;
    const half = Math.floor(BOARD[idx].price / 2);
    const cost = half + Math.ceil(half / 10);
    if (p.cash > cost + 350) { try { mortgageMonopoly(state, 'bot', Number(idx), true); } catch { /* tant pis */ } }
  }
  // construire (équilibré) en gardant un coussin
  for (const [grp, idxs] of Object.entries(GROUPS)) {
    if (!idxs.every((gi) => state.owner[String(gi)] === 'bot')) continue;
    for (let pass = 0; pass < 5; pass++) {
      for (const gi of idxs) {
        const c = BOARD[gi];
        if ((state.houses[String(gi)] || 0) >= 5) continue;
        if (p.cash < c.maison + 350) continue;
        try { buildMonopoly(state, 'bot', gi); } catch { /* règle équilibrée ou stock */ }
      }
    }
  }
}

function botJailAndRoll(state) {
  const p = state.players.bot;
  if (p.jail) {
    if (p.gooj.length) { useGoojMonopoly(state, 'bot'); }
    else if (p.cash > 250) { try { bailMonopoly(state, 'bot'); } catch { /* tant pis */ } }
  }
  rollMonopoly(state, 'bot');
}

function botBuyDecision(state) {
  const idx = state.buyIdx;
  const c = BOARD[idx];
  const p = state.players.bot;
  const groupInfo = c.group
    ? `Groupe ${c.group} : tu possèdes ${GROUPS[c.group].filter((gi) => state.owner[String(gi)] === 'bot').length}/${GROUPS[c.group].length} terrains.`
    : c.t === 'gare' ? `Tu possèdes ${GARES.filter((gi) => state.owner[String(gi)] === 'bot').length} gare(s).`
      : `Tu possèdes ${CIES.filter((gi) => state.owner[String(gi)] === 'bot').length} compagnie(s).`;
  const picked = aiTurn(state, () => ({
    label: 'Monopoly',
    rules: 'Achète intelligemment : compléter un groupe est très fort, bloquer un groupe adverse aussi ; refuser envoie le terrain aux enchères (tu pourras enchérir moins cher, mais les autres aussi).',
    situation: `On te propose ${c.name} pour ${c.price} €. Tu as ${p.cash} €. ${groupInfo} Tour ${state.round}/${ROUND_CAP}.`,
    options: [`Acheter ${c.name} (${c.price} €)`, 'Refuser et laisser partir aux enchères'],
    moves: [true, false],
  }));
  if (picked === 'wait') return false;
  let accept = picked;
  if (accept === null || accept === undefined) {
    accept = botValue(state, idx, 'bot') >= c.price * 0.95 && p.cash - c.price > 120;
  }
  buyMonopoly(state, 'bot', !!accept);
  return true;
}

function botAuction(state) {
  const auc = state.auction;
  const p = state.players.bot;
  if (!p || !p.alive || auc.bidder === 'bot') return false;
  if (!auc.botMax) {
    // prix max décidé une fois par enchère (léger aléa d'humeur)
    auc.botMax = Math.min(p.cash - 80, Math.round(botValue(state, auc.idx, 'bot') * (0.75 + Math.random() * 0.4)));
    auc.botAt = Date.now() + 1500 + Math.random() * 2000;
  }
  if (Date.now() < auc.botAt) return false;
  const step = Math.max(10, Math.round(BOARD[auc.idx].price * 0.1));
  const next = Math.min(auc.botMax, auc.bid + step);
  if (next <= auc.bid) return false;
  bidMonopoly(state, 'bot', next);
  auc.botAt = Date.now() + 1500 + Math.random() * 2000;
  return true;
}

function botTradeResponse(state) {
  const tr = state.trade;
  if (!tr || tr.to !== 'bot') return false;
  if (!tr.botAt) { tr.botAt = Date.now() + 2500 + Math.random() * 2500; return false; }
  if (Date.now() < tr.botAt) return false;
  // Ce que le bot reçoit vs ce qu'il donne (valeur perçue APRÈS échange).
  const received = tr.giveProps.reduce((s, i) => s + botValue(state, i, 'bot'), 0) + tr.giveCash;
  const given = tr.askProps.reduce((s, i) => s + botValue(state, i, tr.from), 0) + tr.askCash;
  const cashAfter = state.players.bot.cash + tr.giveCash - tr.askCash;
  const accept = cashAfter >= 60 && received >= given * 1.02;
  respondTrade(state, 'bot', accept);
  return true;
}

// --- Horloge ------------------------------------------------------------------
export function tickMonopoly(state) {
  if (state.phase !== 'playing') return false;
  let changed = false;

  // Enchère en cours : le bot enchérit, puis le marteau tombe.
  if (state.stage === 'auction' && state.auction) {
    if (state.players.bot?.alive) changed = botAuction(state) || changed;
    if (Date.now() >= state.auction.endsAt) { finishAuction(state); return true; }
    return changed;
  }

  // Échange en attente : réponse du bot, ou refus automatique si ça traîne.
  if (state.trade) {
    if (state.trade.to === 'bot') { if (botTradeResponse(state)) return true; }
    else if (Date.now() - state.trade.at > IDLE_TRADE_MS || isOffline(state, state.trade.to)) {
      respondTrade(state, state.trade.to, false);
      return true;
    }
  }

  if (!state.turn) return changed;
  const id = state.turn;
  const idle = Date.now() - (state.turnSince || 0);

  if (id === 'bot') {
    if (idle < 1500 + (state.turnSince % 1500)) return changed;
    if (state.stage === 'buy') return botBuyDecision(state) || changed;
    botManage(state);
    botJailAndRoll(state);
    return true;
  }

  // Absentes / distraites : la partie ne se fige jamais (refus = enchères,
  // comme la vraie règle quand on ne veut pas acheter).
  const away = isOffline(state, id);
  if (state.stage === 'buy' && (idle > IDLE_BUY_MS || (away && idle > 10000))) {
    buyMonopoly(state, id, false);
    return true;
  }
  if (state.stage === 'roll' && (idle > IDLE_ROLL_MS || (away && idle > 10000))) {
    const p = state.players[id];
    if (p.jail && p.gooj.length) useGoojMonopoly(state, id);
    rollMonopoly(state, id);
    return true;
  }
  return changed;
}

export function viewFor(state, userId) {
  return {
    type: 'monopoly',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    players: Object.fromEntries(state.seats.map((id) => {
      const p = state.players[id] || { cash: START_CASH, pos: 0, jail: false, alive: true, gooj: [] };
      return [id, { cash: p.cash, pos: p.pos, jail: p.jail, jailTries: p.jailTries || 0, alive: p.alive, gooj: (p.gooj || []).length }];
    })),
    owner: { ...state.owner },
    houses: { ...state.houses },
    mortgaged: { ...state.mortgaged },
    bank: { ...state.bank },
    turn: state.turn,
    isMyTurn: state.phase === 'playing' && state.turn === userId,
    stage: state.stage,
    buyIdx: state.buyIdx,
    auction: state.auction ? {
      idx: state.auction.idx,
      bid: state.auction.bid,
      bidder: state.auction.bidder,
      secondsLeft: Math.max(0, Math.ceil((state.auction.endsAt - Date.now()) / 1000)),
    } : null,
    trade: state.trade ? {
      from: state.trade.from, to: state.trade.to,
      giveProps: state.trade.giveProps, askProps: state.trade.askProps,
      giveCash: state.trade.giveCash, askCash: state.trade.askCash,
    } : null,
    dice: state.dice,
    round: state.round,
    roundCap: ROUND_CAP,
    lastCard: state.lastCard,
    winner: state.winner,
    log: state.log.slice(-8),
  };
}
