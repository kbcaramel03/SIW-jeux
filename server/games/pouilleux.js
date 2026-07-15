// Moteur de Zombie (« Old Maid » / « Zombie » sur Plato), logique pure.
// 2 à 6 joueuses. Paquet ENTIER : chaque créature en 4 exemplaires
// (13 × 4 = 52 cartes, comme un vrai jeu) + 1 carte Zombie unique.
// On distribue tout, chacune jette ses paires (2 par 2). À son tour, on pioche
// une carte (face cachée) dans la main de la voisine de gauche ; chaque paire
// formée est écartée. Une main vide = sauvée. À la fin, la seule qui reste
// tient le Zombie : elle perd.

const MONSTERS = ['fantome', 'citrouille', 'chauvesouris', 'araignee', 'serpent', 'scorpion', 'rat', 'hibou', 'crapaud', 'raton', 'loup', 'crane', 'toile'];
const OFFLINE_SKIP_MS = 10000;
const isOffline = (s, id) => !!(s.offline && s.offline[id]);

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function buildDeck() {
  const deck = []; let id = 0;
  for (const m of MONSTERS) for (let k = 0; k < 4; k++) deck.push({ id: id++, kind: m });
  deck.push({ id: id++, kind: 'zombie' }); // la carte Zombie, sans paire
  return deck;
}
function nm(state, id) { return (state.names && state.names[id]) || 'quelqu\'un'; }

export function createPouilleux() {
  return {
    type: 'pouilleux',
    phase: 'waiting', // waiting -> playing -> over
    seats: [],
    hands: {},        // id -> [{id,kind}]
    safe: [],         // joueuses ayant vidé leur main (à l'abri)
    turn: null,
    turnSince: null,
    lastAction: null, // { seq, kind:'pair'|'draw'|'safe', by, from, monster }
    actionSeq: 0,
    names: {},
    loser: null,
    log: [],
  };
}

export function joinPouilleux(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 6) state.seats.push(userId);
}

function event(state, kind, data) { state.actionSeq += 1; state.lastAction = { seq: state.actionSeq, kind, ...data }; }
function pushLog(state, text) { state.log.push(text); if (state.log.length > 40) state.log = state.log.slice(-40); }

// Jette les paires présentes dans une main, 2 par 2 : avec 4 exemplaires par
// créature, 3 cartes identiques = 1 paire jetée + 1 carte gardée.
function discardPairs(state, id) {
  const byKind = {};
  for (const c of state.hands[id]) (byKind[c.kind] ||= []).push(c);
  for (const kind of Object.keys(byKind)) {
    if (kind === 'zombie') continue;
    const pairs = Math.floor(byKind[kind].length / 2);
    if (pairs === 0) continue;
    const toRemove = new Set(byKind[kind].slice(0, pairs * 2).map((c) => c.id));
    state.hands[id] = state.hands[id].filter((c) => !toRemove.has(c.id));
    event(state, 'pair', { by: id, monster: kind });
    pushLog(state, `${nm(state, id)} jette ${pairs > 1 ? `${pairs} paires` : 'une paire'} de ${kind}.`);
  }
}

const activePlayers = (state) => state.seats.filter((id) => state.hands[id].length > 0);

export function startPouilleux(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut au moins 2 joueuses.');
  const deck = shuffle(buildDeck());
  state.hands = {}; state.safe = [];
  for (const id of state.seats) state.hands[id] = [];
  let i = 0;
  while (deck.length) { state.hands[state.seats[i % state.seats.length]].push(deck.pop()); i++; }
  for (const id of state.seats) {
    state.hands[id] = shuffle(state.hands[id]);
    discardPairs(state, id);
  }
  state.safe = state.seats.filter((id) => state.hands[id].length === 0);
  state.turn = activePlayers(state)[0] || state.seats[0];
  state.turnSince = Date.now();
  state.loser = null; state.lastAction = null; state.actionSeq = 0;
  state.phase = 'playing';
  state.log = ['La partie commence ! Débarrassez-vous de vos paires.'];
  checkEnd(state);
}

// Voisine « de gauche » : prochaine joueuse active après `id`.
function nextActive(state, id) {
  const n = state.seats.length;
  const i = state.seats.indexOf(id);
  for (let k = 1; k <= n; k++) {
    const cand = state.seats[(i + k) % n];
    if (state.hands[cand].length > 0 && cand !== id) return cand;
  }
  return null;
}

function checkEnd(state) {
  const active = activePlayers(state);
  if (active.length <= 1) {
    state.phase = 'over';
    state.loser = active[0] || null; // celle qui reste tient le Zombie
    if (state.loser) pushLog(state, `${nm(state, state.loser)} reste avec le Zombie… perdu !`);
    return true;
  }
  return false;
}

function advanceTurn(state) {
  const nxt = nextActive(state, state.turn);
  if (nxt) { state.turn = nxt; state.turnSince = Date.now(); }
  else checkEnd(state);
}

export function drawPouilleux(state, userId, cardIndex) {
  if (state.phase !== 'playing') throw new Error('La partie n\'est pas en cours.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  const target = nextActive(state, userId);
  if (!target) { checkEnd(state); return; }
  const tHand = state.hands[target];
  const idx = Number(cardIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= tHand.length) throw new Error('Carte invalide.');
  const card = tHand.splice(idx, 1)[0];
  state.hands[userId].push(card);
  event(state, 'draw', { by: userId, from: target, monster: card.kind });
  pushLog(state, `${nm(state, userId)} pioche une carte chez ${nm(state, target)}.`);
  discardPairs(state, userId);

  // Mises à l'abri (mains vidées).
  for (const id of [target, userId]) {
    if (state.hands[id].length === 0 && !state.safe.includes(id)) {
      state.safe.push(id);
      event(state, 'safe', { by: id });
      pushLog(state, `${nm(state, id)} n'a plus de cartes : sauvée !`);
    }
  }
  if (checkEnd(state)) return;
  advanceTurn(state);
}

// Auto-play d'une absente : pioche une carte au hasard chez la voisine.
export function tickPouilleux(state) {
  if (state.phase !== 'playing' || !state.turn) return false;
  if (!isOffline(state, state.turn)) return false;
  const wait = state.turn === 'bot' ? 1700 + (state.turnSince % 2400) : OFFLINE_SKIP_MS;
  if (!state.turnSince || Date.now() - state.turnSince < wait) return false;
  const target = nextActive(state, state.turn);
  if (!target) { checkEnd(state); return true; }
  drawPouilleux(state, state.turn, Math.floor(Math.random() * state.hands[target].length));
  return true;
}

export function viewFor(state, userId) {
  const target = state.phase === 'playing' ? nextActive(state, state.turn) : null;
  const myHand = state.hands[userId] ? state.hands[userId].slice() : [];
  return {
    type: 'pouilleux',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    players: state.seats.map((id) => ({
      id,
      count: state.hands[id] ? state.hands[id].length : 0,
      safe: state.safe.includes(id),
    })),
    myHand,
    turn: state.turn,
    isMyTurn: state.phase === 'playing' && state.turn === userId,
    target,                       // la voisine chez qui je pioche
    targetCount: target ? state.hands[target].length : 0,
    lastAction: state.lastAction,
    loser: state.loser,
    iLost: state.loser === userId,
    log: state.log.slice(-10),
  };
}
