// Moteur de Uno (2 à 8 joueurs), logique pure.
import { aiTurn } from '../ai.js';
// 108 cartes : 4 couleurs (0 x1, 1-9 x2, skip/reverse/+2 x2) + 4 jokers + 4 joker+4.
// Les +2/+4 SE CUMULENT : la victime peut renchérir (+2 sur +2, +4 sur tout)
// et le total glisse à la suivante — sinon elle ramasse tout. On pioche 1 carte
// (jouable immédiatement ou on passe). Premier à vider sa main gagne.

const COLORS = ['red', 'yellow', 'green', 'blue'];
const OFFLINE_SKIP_MS = 10000; // une joueuse absente joue automatiquement après 10 s
const isOffline = (s, id) => !!(s.offline && s.offline[id]);
const nm = (s, id) => (s.names && s.names[id]) || 'quelqu\'un';
function pushLog(state, text) { state.log.push(text); if (state.log.length > 30) state.log = state.log.slice(-30); }

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
    turnSince: null,   // début du tour courant (pour l'auto-play des absents)
    drawnCardId: null, // carte piochée jouable ce tour (par le joueur actif)
    pendingDraw: 0,    // cartes à ramasser (cumul des +2/+4 en cours)
    pendingType: null, // 'draw2' | 'wild4' — sur quoi on peut renchérir
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
  state.turnSince = Date.now();
  state.phase = 'playing';
  state.drawnCardId = null;
  state.pendingDraw = 0;
  state.pendingType = null;
  state.lastPenalty = null;
  state.log = ['La partie commence !'];
}

function idxOf(state, id) { return state.seats.indexOf(id); }
function seatAt(state, fromIdx, steps) {
  const n = state.seats.length;
  return state.seats[(((fromIdx + state.direction * steps) % n) + n) % n];
}
function advance(state, steps) { state.turn = seatAt(state, idxOf(state, state.turn), steps); state.turnSince = Date.now(); }
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
  // Cumul en cours : on ne peut que renchérir (+2 sur +2, +4 sur tout) ou ramasser.
  if (state.pendingDraw > 0) {
    const canStack = card.type === 'wild4' || (card.type === 'draw2' && state.pendingType === 'draw2');
    if (!canStack) throw new Error(`Ramasse les ${state.pendingDraw} cartes, ou renchéris avec un +${state.pendingType === 'wild4' ? '4' : '2 ou +4'}.`);
  } else if (!isPlayable(card, state.currentColor, top.type)) {
    throw new Error('Carte non jouable.');
  }

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
      pushLog(state, `${nm(state, userId)} passe le tour de ${nm(state, nextPlayer(state))}.`);
      advance(state, 2);
      break;
    case 'reverse':
      state.direction *= -1;
      pushLog(state, `${nm(state, userId)} inverse le sens !`);
      advance(state, state.seats.length === 2 ? 2 : 1);
      break;
    case 'draw2':
    case 'wild4': {
      // Le malus ne tombe pas tout de suite : la victime a son tour pour
      // renchérir (le cumul glisse alors à la suivante) ou ramasser.
      const add = card.type === 'draw2' ? 2 : 4;
      const stacked = state.pendingDraw > 0;
      state.pendingDraw += add;
      state.pendingType = card.type === 'wild4' ? 'wild4' : (state.pendingType || 'draw2');
      const victim = nextPlayer(state);
      pushLog(state, stacked
        ? `${nm(state, userId)} renchérit avec un +${add} — cumul à ${state.pendingDraw} pour ${nm(state, victim)} !`
        : `${nm(state, userId)} pose un +${add} — ${nm(state, victim)} ramasse ou renchérit !`);
      advance(state, 1);
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
  // Un cumul de +2/+4 t'attend : tu ramasses tout, et le tour passe.
  if (state.pendingDraw > 0) {
    const count = state.pendingDraw;
    drawCards(state, userId, count);
    state.lastPenalty = { targetId: userId, count, by: null, nonce: Date.now() };
    pushLog(state, `${nm(state, userId)} ramasse ${count} cartes !`);
    state.pendingDraw = 0;
    state.pendingType = null;
    advance(state, 1);
    return;
  }
  drawCards(state, userId, 1);
  pushLog(state, `${nm(state, userId)} pioche une carte.`);
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

// Couleur choisie automatiquement pour un joker : la plus présente en main.
function pickColor(hand) {
  const counts = {};
  for (const c of hand) if (c.color !== 'wild') counts[c.color] = (counts[c.color] || 0) + 1;
  let best = 'red'; let max = -1;
  for (const col of COLORS) if ((counts[col] || 0) > max) { max = counts[col] || 0; best = col; }
  return best;
}

// Joue automatiquement pour la joueuse dont c'est le tour (absente).
function autoPlay(state, userId) {
  const hand = state.hands[userId] || [];
  const top = state.discard[state.discard.length - 1];
  // Un cumul l'attend : elle renchérit si elle peut, sinon elle ramasse.
  if (state.pendingDraw > 0) {
    const stackCard = hand.find((c) => c.type === 'wild4' || (c.type === 'draw2' && state.pendingType === 'draw2'));
    if (stackCard) playCard(state, userId, stackCard.id, pickColor(hand));
    else drawUno(state, userId);
    return;
  }
  if (state.drawnCardId !== null) {
    const drawn = hand.find((c) => c.id === state.drawnCardId);
    if (drawn && isPlayable(drawn, state.currentColor, top.type)) playCard(state, userId, drawn.id, pickColor(hand));
    else passUno(state, userId);
    return;
  }
  const playable = hand.find((c) => isPlayable(c, state.currentColor, top.type));
  if (playable) { playCard(state, userId, playable.id, pickColor(hand)); return; }
  drawUno(state, userId); // pioche : devient jouable (drawnCardId) ou passe le tour
  if (state.turn === userId && state.drawnCardId !== null) {
    const drawn = state.hands[userId].find((c) => c.id === state.drawnCardId);
    if (drawn) playCard(state, userId, drawn.id, pickColor(state.hands[userId]));
  }
}


// Décrit les coups légaux du bot pour ChatGPT (cartes, cumul, pioche).
const CARD_FR = { skip: 'Passe-tour', reverse: 'Inversion', draw2: '+2', wild: 'Joker', wild4: '+4' };
const COLOR_FR = { red: 'rouge', yellow: 'jaune', green: 'vert', blue: 'bleu', wild: 'noir' };
function cardFr(c) { return (CARD_FR[c.type] || c.type) + (c.color !== 'wild' ? ' ' + COLOR_FR[c.color] : ''); }
function buildUnoChoice(state) {
  const hand = state.hands.bot || [];
  const top = state.discard[state.discard.length - 1];
  const options = []; const moves = [];
  const addPlay = (c) => {
    if (c.color === 'wild') {
      for (const col of COLORS) {
        options.push(`Jouer ${cardFr(c)} en choisissant ${COLOR_FR[col]}`);
        moves.push({ kind: 'play', cardId: c.id, color: col });
      }
    } else {
      options.push(`Jouer ${cardFr(c)}`);
      moves.push({ kind: 'play', cardId: c.id });
    }
  };
  if (state.pendingDraw > 0) {
    for (const c of hand) if (c.type === 'wild4' || (c.type === 'draw2' && state.pendingType === 'draw2')) addPlay(c);
    options.push(`Ramasser les ${state.pendingDraw} cartes du cumul`);
    moves.push({ kind: 'draw' });
  } else if (state.drawnCardId !== null) {
    const drawn = hand.find((c) => c.id === state.drawnCardId);
    if (drawn && isPlayable(drawn, state.currentColor, top.type)) addPlay(drawn);
    options.push('Passer le tour');
    moves.push({ kind: 'pass' });
  } else {
    for (const c of hand) if (isPlayable(c, state.currentColor, top.type)) addPlay(c);
    options.push('Piocher une carte');
    moves.push({ kind: 'draw' });
  }
  const oppos = state.seats.filter((id) => id !== 'bot')
    .map((id) => `${nm(state, id)} : ${state.hands[id].length} cartes`).join(', ');
  return {
    label: 'Uno',
    rules: 'Défausse toutes tes cartes pour gagner. Les +2/+4 se cumulent. Une adversaire à 1-2 cartes est dangereuse : attaque-la. Garde plutôt les jokers pour les moments utiles.',
    situation: `Carte visible : ${cardFr(top)} (couleur en cours : ${COLOR_FR[state.currentColor]}). Ta main (${hand.length}) : ${hand.map(cardFr).join(', ')}. Adversaires : ${oppos}.`,
    options, moves,
  };
}

// Horloge serveur : auto-play après 10 s si la joueuse active est déconnectée.
export function tickUno(state) {
  if (state.phase !== 'playing' || !state.turn) return false;
  if (!isOffline(state, state.turn)) return false;
  const wait = state.turn === 'bot' ? 2500 : OFFLINE_SKIP_MS;
  if (!state.turnSince || Date.now() - state.turnSince < wait) return false;
  if (state.turn === 'bot') {
    const picked = aiTurn(state, () => buildUnoChoice(state));
    if (picked === 'wait') return false;
    if (picked) {
      try {
        if (picked.kind === 'play') playCard(state, 'bot', picked.cardId, picked.color);
        else if (picked.kind === 'pass') passUno(state, 'bot');
        else drawUno(state, 'bot');
        return true;
      } catch { /* option devenue invalide : heuristique locale */ }
    }
  }
  autoPlay(state, state.turn);
  return true;
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
    pendingDraw: state.pendingDraw || 0,
    pendingType: state.pendingType,
    lastPenalty: state.lastPenalty,
    winner: state.winner,
    log: state.log.slice(-8),
  };
}
