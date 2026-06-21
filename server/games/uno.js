// Moteur de Uno (2 à 8 joueurs), logique pure.
// 108 cartes : 4 couleurs (0 x1, 1-9 x2, skip/reverse/+2 x2) + 4 jokers + 4 joker+4.
// Règles simplifiées et claires : pas de cumul de +2/+4, on pioche 1 carte (jouable
// immédiatement ou on passe). Premier à vider sa main gagne.

const COLORS = ['red', 'yellow', 'green', 'blue'];

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck() {
  const deck = [];
  let id = 0;
  for (const color of COLORS) {
    deck.push({ id: id++, color, type: '0' });
    for (let n = 1; n <= 9; n++) { deck.push({ id: id++, color, type: String(n) }); deck.push({ id: id++, color, type: String(n) }); }
    for (const t of ['skip', 'reverse', 'draw2']) { deck.push({ id: id++, color, type: t }); deck.push({ id: id++, color, type: t }); }
  }
  for (let i = 0; i < 4; i++) deck.push({ id: id++, color: 'wild', type: 'wild' });
  for (let i = 0; i < 4; i++) deck.push({ id: id++, color: 'wild', type: 'wild4' });
  return deck;
}

export function createUno() {
  return {
    type: 'uno',
    phase: 'waiting', // waiting -> playing -> over
    seats: [],
    hands: {},
    deck: [],
    discard: [],
    currentColor: null,
    direction: 1,
    turn: null,
    drawnCardId: null, // carte piochée jouable ce tour (par le joueur actif)
    lastPenalty: null, // { targetId, count, by, nonce } pour l'animation +2/+4
    winner: null,
    log: [],
  };
}

export function joinUno(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 8) state.seats.push(userId);
}

function reshuffleIfNeeded(state) {
  if (state.deck.length === 0) {
    const top = state.discard.pop();
    state.deck = shuffle(state.discard);
    state.discard = top ? [top] : [];
  }
}

function drawCards(state, userId, n) {
  for (let i = 0; i < n; i++) {
    reshuffleIfNeeded(state);
    if (state.deck.length === 0) break;
    state.hands[userId].push(state.deck.pop());
  }
}

export function startUno(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut au moins 2 joueurs.');

  state.deck = shuffle(buildDeck());
  state.hands = {};
  for (const id of state.seats) state.hands[id] = [];
  for (let i = 0; i < 7; i++) for (const id of state.seats) state.hands[id].push(state.deck.pop());

  // Première carte de la défausse : on évite une carte spéciale pour rester simple.
  let first = state.deck.pop();
  while (first.color === 'wild' || ['skip', 'reverse', 'draw2'].includes(first.type)) {
    state.deck.unshift(first);
    first = state.deck.pop();
  }
  state.discard = [first];
  state.currentColor = first.color;
  state.direction = 1;
  state.turn = state.seats[0];
  state.phase = 'playing';
  state.drawnCardId = null;
  state.lastPenalty = null;
  state.log.push('La partie commence !');
}

function idxOf(state, id) { return state.seats.indexOf(id); }
function seatAt(state, fromIdx, steps) {
  const n = state.seats.length;
  return state.seats[(((fromIdx + state.direction * steps) % n) + n) % n];
}
function advance(state, steps) { state.turn = seatAt(state, idxOf(state, state.turn), steps); }
function nextPlayer(state) { return seatAt(state, idxOf(state, state.turn), 1); }

export function isPlayable(card, currentColor, topType) {
  return card.color === 'wild' || card.color === currentColor || card.type === topType;
}

export function playCard(state, userId, cardId, chosenColor) {
  if (state.phase !== 'playing') throw new Error('La partie n\'est pas en cours.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  if (state.drawnCardId !== null && cardId !== state.drawnCardId) {
    throw new Error('Tu ne peux jouer que la carte piochée, ou passer.');
  }
  const hand = state.hands[userId];
  const ci = hand.findIndex((c) => c.id === cardId);
  if (ci === -1) throw new Error('Carte introuvable.');
  const card = hand[ci];
  const top = state.discard[state.discard.length - 1];
  if (!isPlayable(card, state.currentColor, top.type)) throw new Error('Carte non jouable.');

  // couleur pour les jokers
  if (card.color === 'wild') {
    if (!COLORS.includes(chosenColor)) throw new Error('Choisis une couleur.');
  }

  hand.splice(ci, 1);
  state.discard.push(card);
  state.currentColor = card.color === 'wild' ? chosenColor : card.color;
  state.drawnCardId = null;

  if (hand.length === 0) {
    state.phase = 'over';
    state.winner = userId;
    state.log.push('Carte finale jouée — victoire !');
    return;
  }

  switch (card.type) {
    case 'skip':
      advance(state, 2);
      break;
    case 'reverse':
      state.direction *= -1;
      advance(state, state.seats.length === 2 ? 2 : 1);
      break;
    case 'draw2': {
      const victim = nextPlayer(state);
      drawCards(state, victim, 2);
      state.lastPenalty = { targetId: victim, count: 2, by: userId, nonce: Date.now() };
      advance(state, 2);
      break;
    }
    case 'wild4': {
      const victim = nextPlayer(state);
      drawCards(state, victim, 4);
      state.lastPenalty = { targetId: victim, count: 4, by: userId, nonce: Date.now() };
      advance(state, 2);
      break;
    }
    default:
      advance(state, 1);
  }
}

// Piocher une carte : elle devient jouable immédiatement, sinon on passe.
export function drawUno(state, userId) {
  if (state.phase !== 'playing') throw new Error('La partie n\'est pas en cours.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  if (state.drawnCardId !== null) throw new Error('Tu as déjà pioché — joue-la ou passe.');
  drawCards(state, userId, 1);
  const hand = state.hands[userId];
  const drawn = hand[hand.length - 1];
  const top = state.discard[state.discard.length - 1];
  if (drawn && isPlayable(drawn, state.currentColor, top.type)) {
    state.drawnCardId = drawn.id; // jouable ce tour
  } else {
    advance(state, 1); // rien à jouer -> tour suivant
  }
}

export function passUno(state, userId) {
  if (state.phase !== 'playing') throw new Error('La partie n\'est pas en cours.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  if (state.drawnCardId === null) throw new Error('Tu dois d\'abord piocher.');
  state.drawnCardId = null;
  advance(state, 1);
}

export function viewFor(state, userId) {
  const top = state.discard[state.discard.length - 1] || null;
  return {
    type: 'uno',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    players: state.seats.map((id) => ({ id, count: state.hands[id] ? state.hands[id].length : 0 })),
    myHand: state.hands[userId] ? state.hands[userId].slice() : [],
    topCard: top,
    currentColor: state.currentColor,
    topType: top ? top.type : null,
    direction: state.direction,
    turn: state.turn,
    isMyTurn: state.turn === userId,
    myDrawnCardId: state.turn === userId ? state.drawnCardId : null,
    deckCount: state.deck.length,
    lastPenalty: state.lastPenalty,
    winner: state.winner,
    log: state.log.slice(-8),
  };
}
