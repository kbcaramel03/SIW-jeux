// Moteur de Go Fish (« la pêche »), logique pure. 2 à 6 joueuses.
// But : réunir le plus de « carrés » (quatre cartes d'un même rang).
// À ton tour, tu demandes à une autre joueuse toutes ses cartes d'un rang que
// tu possèdes déjà : si elle en a, elle te les donne et tu rejoues ; sinon
// « à la pêche » — tu piges une carte dans la pioche. Si tu piges justement le
// rang demandé, tu rejoues ; sinon le tour passe. Quatre cartes d'un rang = un
// carré posé. La partie s'arrête quand les 13 carrés sont faits : le plus de
// carrés l'emporte.

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];
const OFFLINE_SKIP_MS = 10000;
const isOffline = (s, id) => !!(s.offline && s.offline[id]);

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function buildDeck() {
  const deck = []; let id = 0;
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ id: id++, rank, suit });
  return deck;
}
function nm(state, id) { return (state.names && state.names[id]) || 'quelqu\'un'; }

export function createGoFish() {
  return {
    type: 'gofish',
    phase: 'waiting', // waiting -> playing -> over
    seats: [],
    hands: {},        // id -> [{id,rank,suit}]
    pool: [],         // pioche
    books: {},        // id -> [rangs des carrés posés]
    turn: null,
    turnSince: null,
    lastAction: null, // { seq, kind:'got'|'fish'|'book', by, target, rank, count }
    lastAsk: null,    // { seq, by, target, rank } : la demande, visible par toutes
    actionSeq: 0,
    names: {},
    winner: null,     // id ou 'tie'
    log: [],
  };
}

export function joinGoFish(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 6) state.seats.push(userId);
}

export function startGoFish(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut au moins 2 joueuses.');
  const deck = shuffle(buildDeck());
  const dealt = state.seats.length <= 3 ? 7 : 5;
  state.hands = {}; state.books = {};
  for (const id of state.seats) { state.hands[id] = []; state.books[id] = []; }
  for (let i = 0; i < dealt; i++) for (const id of state.seats) state.hands[id].push(deck.pop());
  state.pool = deck;
  state.turn = state.seats[0]; // le tour part de la première joueuse et suit le cercle
  state.turnSince = Date.now();
  state.lastAction = null; state.actionSeq = 0; state.winner = null;
  state.phase = 'playing';
  state.log = ['La partie commence !'];
  // Les carrés déjà servis (rare) sont posés d'office.
  for (const id of state.seats) extractBooks(state, id);
  startTurnDraw(state);
}

function event(state, kind, data) {
  state.actionSeq += 1;
  state.lastAction = { seq: state.actionSeq, kind, ...data };
}
function pushLog(state, text) { state.log.push(text); if (state.log.length > 40) state.log = state.log.slice(-40); }

// Pose les carrés (4 cartes d'un même rang) trouvés dans la main d'une joueuse.
function extractBooks(state, id) {
  const counts = {};
  for (const c of state.hands[id]) counts[c.rank] = (counts[c.rank] || 0) + 1;
  for (const rank of RANKS) {
    if (counts[rank] === 4) {
      state.hands[id] = state.hands[id].filter((c) => c.rank !== rank);
      state.books[id].push(rank);
      event(state, 'book', { by: id, rank });
      pushLog(state, `${nm(state, id)} complète un carré de ${rank} !`);
    }
  }
}

const totalBooks = (state) => state.seats.reduce((s, id) => s + state.books[id].length, 0);

function endGame(state) {
  state.phase = 'over';
  let best = -1; let winner = null; let tie = false;
  for (const id of state.seats) {
    const n = state.books[id].length;
    if (n > best) { best = n; winner = id; tie = false; }
    else if (n === best) tie = true;
  }
  state.winner = tie ? 'tie' : winner;
  pushLog(state, 'Partie terminée !');
}

// Si la main de la joueuse active est vide, elle pige une carte pour rester en
// jeu ; si la pioche est vide aussi, on passe à la suivante (ou fin de partie).
function startTurnDraw(state, guard = 0) {
  if (guard > state.seats.length) { endGame(state); return; }
  const id = state.turn;
  if (state.hands[id].length === 0) {
    if (state.pool.length > 0) {
      state.hands[id].push(state.pool.pop());
      extractBooks(state, id);
      if (state.hands[id].length === 0) { advanceTurn(state, guard + 1); }
    } else {
      advanceTurn(state, guard + 1);
    }
  }
}

function advanceTurn(state, guard = 0) {
  if (totalBooks(state) >= 13) { endGame(state); return; }
  const n = state.seats.length;
  const i = state.seats.indexOf(state.turn);
  state.turn = state.seats[(i + 1) % n];
  state.turnSince = Date.now();
  startTurnDraw(state, guard);
}

// La joueuse rejoue (carré complété ou pêche chanceuse) : si sa main est vide,
// elle pige une carte pour pouvoir continuer ; sinon le tour passe.
function keepTurnOrDraw(state, id) {
  if (state.hands[id].length > 0) return;
  if (state.pool.length > 0) {
    state.hands[id].push(state.pool.pop());
    extractBooks(state, id);
    if (state.hands[id].length === 0) keepTurnOrDraw(state, id);
  } else {
    advanceTurn(state);
  }
}

export function askGoFish(state, userId, targetId, rank) {
  if (state.phase !== 'playing') throw new Error('La partie n\'est pas en cours.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  if (!state.seats.includes(targetId) || targetId === userId) throw new Error('Choisis une autre joueuse.');
  if (!RANKS.includes(rank)) throw new Error('Rang invalide.');
  const hand = state.hands[userId];
  if (!hand.some((c) => c.rank === rank)) throw new Error('Tu dois posséder une carte de ce rang pour le demander.');

  // La demande est publique : tout le monde voit qui demande quoi à qui.
  state.actionSeq += 1;
  state.lastAsk = { seq: state.actionSeq, by: userId, target: targetId, rank };

  const targetHand = state.hands[targetId];
  const matches = targetHand.filter((c) => c.rank === rank);
  if (matches.length > 0) {
    state.hands[targetId] = targetHand.filter((c) => c.rank !== rank);
    for (const c of matches) hand.push(c);
    event(state, 'got', { by: userId, target: targetId, rank, count: matches.length });
    pushLog(state, `${nm(state, userId)} prend ${matches.length} ${rank} à ${nm(state, targetId)}.`);
    extractBooks(state, userId);
    if (totalBooks(state) >= 13) { endGame(state); return; }
    keepTurnOrDraw(state, userId); // rejoue (turn stays)
    return;
  }

  // « À la pêche »
  const drawn = state.pool.length > 0 ? state.pool.pop() : null;
  if (drawn) hand.push(drawn);
  const lucky = drawn && drawn.rank === rank;
  event(state, 'fish', { by: userId, target: targetId, rank, drawnRank: lucky ? rank : null });
  pushLog(state, `${nm(state, targetId)} dit « à la pêche » — ${nm(state, userId)} pige une carte${lucky ? ` et tombe sur un ${rank} !` : '.'}`);
  if (drawn) extractBooks(state, userId);
  if (totalBooks(state) >= 13) { endGame(state); return; }
  if (lucky) { keepTurnOrDraw(state, userId); return; } // rejoue
  advanceTurn(state);
}

// Auto-play d'une absente : demande un rang qu'elle possède à une adversaire
// qui a encore des cartes (sinon n'importe laquelle).
export function tickGoFish(state) {
  if (state.phase !== 'playing' || !state.turn) return false;
  if (!isOffline(state, state.turn)) return false;
  const wait = state.turn === 'bot' ? 2500 : OFFLINE_SKIP_MS;
  if (!state.turnSince || Date.now() - state.turnSince < wait) return false;
  const me = state.turn;
  const hand = state.hands[me];
  if (!hand.length) { advanceTurn(state); return true; }
  const rank = hand[Math.floor(Math.random() * hand.length)].rank;
  const opponents = state.seats.filter((id) => id !== me);
  const withCards = opponents.filter((id) => state.hands[id].length > 0);
  const target = (withCards.length ? withCards : opponents)[Math.floor(Math.random() * (withCards.length || opponents.length))];
  try { askGoFish(state, me, target, rank); } catch { advanceTurn(state); }
  return true;
}

export function viewFor(state, userId) {
  const hand = state.hands[userId] ? [...state.hands[userId]] : [];
  hand.sort((a, b) => (RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank)) || (SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)));
  // Rangs que je possède (les seuls que je peux demander).
  const myRanks = [...new Set(hand.map((c) => c.rank))].sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b));
  return {
    type: 'gofish',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    players: state.seats.map((id) => ({
      id,
      count: state.hands[id] ? state.hands[id].length : 0,
      books: state.books[id] ? state.books[id].slice() : [],
    })),
    myHand: hand,
    myRanks,
    poolCount: state.pool.length,
    turn: state.turn,
    isMyTurn: state.phase === 'playing' && state.turn === userId,
    lastAction: state.lastAction,
    lastAsk: state.lastAsk,
    winner: state.winner,
    log: state.log.slice(-10),
  };
}
