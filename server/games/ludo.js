// Moteur de Ludo (2 à 4 joueurs), logique pure. Règles classiques :
// - il faut un 6 pour sortir un pion de l'écurie ; un 6 fait rejouer ;
// - trois 6 d'affilée : le tour est perdu ;
// - atterrir sur un pion adverse (hors case étoile) le renvoie à l'écurie
//   et fait rejouer ; les cases étoiles (et départs) sont protégées ;
// - l'arrivée se fait au compte exact ; rentrer un pion fait rejouer ;
// - premier à rentrer ses 4 pions = vainqueur (on classe les suivants).
//
// Position d'un pion (p) : -1 = écurie ; 0..50 = piste (case absolue =
// (départ + p) % 52) ; 51..55 = colonne d'arrivée ; 56 = au centre (rentré).

const GOAL = 56;
const COLOR_ORDER = ['red', 'green', 'yellow', 'blue'];
// Décalage du départ de chaque couleur sur la boucle de 52 cases.
const START = { red: 1, green: 14, yellow: 27, blue: 40 };
// Cases protégées : les 4 départs + les 4 étoiles (8 cases au total).
const SAFE = new Set([1, 9, 14, 22, 27, 35, 40, 48]);
const FR = { red: 'Rouge', green: 'Vert', yellow: 'Jaune', blue: 'Bleu' };
const OFFLINE_SKIP_MS = 45000;

const absCell = (color, p) => (START[color] + p) % 52;
const isOffline = (s, id) => !!(s.offline && s.offline[id]);
function nm(state, id) { return (state.names && state.names[id]) || 'quelqu\'un'; }

export function createLudo() {
  return {
    type: 'ludo',
    phase: 'waiting', // waiting -> playing -> over
    seats: [],
    colors: {},      // userId -> couleur
    pawns: {},       // userId -> [p, p, p, p]
    turn: null,
    die: null,       // valeur à jouer (null = il faut lancer)
    lastDie: null,   // dernière valeur lancée (affichage du dé)
    dieSeq: 0,       // numéro de lancer (anime le dé chez tout le monde)
    sixes: 0,        // 6 consécutifs du joueur courant
    movable: [],     // index des pions jouables après le lancer
    ranks: [],       // ordre d'arrivée (userIds)
    lastEvent: null, // { seq, kind: 'move'|'capture'|'goal'|'out', by }
    eventSeq: 0,
    stepSince: null,
    names: {},
    log: [],
    winner: null,
  };
}

export function joinLudo(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 4) {
    state.seats.push(userId);
    state.colors[userId] = COLOR_ORDER[state.seats.length - 1];
    state.pawns[userId] = [-1, -1, -1, -1];
  }
}

export function startLudo(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut au moins 2 joueurs.');
  // À 2 joueuses : coins opposés (plus équitable) ; à 3-4 : ordre classique.
  const layout = { 2: ['red', 'yellow'], 3: ['red', 'green', 'yellow'], 4: COLOR_ORDER }[state.seats.length];
  state.seats.forEach((id, i) => { state.colors[id] = layout[i]; });
  state.phase = 'playing';
  state.turn = state.seats[Math.floor(Math.random() * state.seats.length)];
  state.die = null; state.sixes = 0; state.movable = [];
  state.stepSince = Date.now();
  state.log = [`${FR[state.colors[state.turn]]} commence !`];
}

function pushLog(state, text) {
  state.log.push(text);
  if (state.log.length > 30) state.log = state.log.slice(-30);
}
function event(state, kind, by) {
  state.eventSeq += 1;
  state.lastEvent = { seq: state.eventSeq, kind, by };
}

function nextTurn(state) {
  state.die = null; state.movable = []; state.sixes = 0;
  const order = state.seats.filter((id) => !state.ranks.includes(id));
  if (order.length === 0) return;
  const i = order.indexOf(state.turn);
  state.turn = order[(i + 1) % order.length];
  state.stepSince = Date.now();
}
function replay(state) {
  state.die = null; state.movable = [];
  state.stepSince = Date.now();
}

// Pions jouables avec ce dé : sortir (6) ou avancer sans dépasser l'arrivée.
function movablePawns(state, userId, die) {
  const out = [];
  state.pawns[userId].forEach((p, i) => {
    if (p === -1 ? die === 6 : p + die <= GOAL) out.push(i);
  });
  return out;
}

export function rollLudo(state, userId) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  if (state.die != null) throw new Error('Tu as déjà lancé : joue un pion.');
  const die = 1 + Math.floor(Math.random() * 6);
  state.die = die;
  state.lastDie = die;
  state.dieSeq += 1;
  if (die === 6) {
    state.sixes += 1;
    if (state.sixes >= 3) {
      pushLog(state, `${nm(state, userId)} fait trois 6 d'affilée… tour perdu !`);
      nextTurn(state);
      return;
    }
  } else {
    state.sixes = 0;
  }
  state.movable = movablePawns(state, userId, die);
  if (state.movable.length === 0) {
    pushLog(state, `${nm(state, userId)} fait ${die} : aucun coup possible.`);
    if (die === 6) replay(state); else nextTurn(state);
  } else {
    state.stepSince = Date.now();
  }
}

export function moveLudo(state, userId, pawnIdx) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  if (state.die == null) throw new Error('Lance d\'abord le dé.');
  const idx = Number(pawnIdx);
  if (!state.movable.includes(idx)) throw new Error('Ce pion ne peut pas bouger.');
  const die = state.die;
  const color = state.colors[userId];
  const pawns = state.pawns[userId];
  let bonus = die === 6;

  if (pawns[idx] === -1) {
    pawns[idx] = 0;
    event(state, 'out', userId);
    pushLog(state, `${nm(state, userId)} sort un pion !`);
  } else {
    pawns[idx] += die;
    event(state, 'move', userId);
  }
  const p = pawns[idx];

  // Capture : case de piste non protégée occupée par l'adversaire.
  if (p >= 0 && p <= 50) {
    const cell = absCell(color, p);
    if (!SAFE.has(cell)) {
      for (const other of state.seats) {
        if (other === userId) continue;
        const oc = state.colors[other];
        state.pawns[other].forEach((op, oi) => {
          if (op >= 0 && op <= 50 && absCell(oc, op) === cell) {
            state.pawns[other][oi] = -1;
            bonus = true;
            event(state, 'capture', userId);
            pushLog(state, `${nm(state, userId)} mange un pion de ${nm(state, other)} !`);
          }
        });
      }
    }
  }

  // Arrivée au centre : pion rentré, on rejoue.
  if (p === GOAL) {
    bonus = true;
    event(state, 'goal', userId);
    pushLog(state, `${nm(state, userId)} rentre un pion ! (${pawns.filter((x) => x === GOAL).length}/4)`);
    if (pawns.every((x) => x === GOAL)) {
      state.ranks.push(userId);
      pushLog(state, `🏆 ${nm(state, userId)} a rentré ses 4 pions !`);
      const left = state.seats.filter((id) => !state.ranks.includes(id));
      if (left.length <= 1) {
        if (left.length === 1) state.ranks.push(left[0]);
        state.phase = 'over';
        state.winner = state.ranks[0];
        return;
      }
      nextTurn(state);
      return;
    }
  }

  if (bonus) replay(state); else nextTurn(state);
}

// Horloge serveur : si la joueuse dont c'est le tour est déconnectée depuis
// un moment, on joue pour elle (lancer puis premier pion jouable).
export function tickLudo(state) {
  if (state.phase !== 'playing' || !state.turn) return false;
  if (!isOffline(state, state.turn)) return false;
  if (!state.stepSince || Date.now() < state.stepSince + OFFLINE_SKIP_MS) return false;
  if (state.die == null) {
    rollLudo(state, state.turn);
  } else {
    const choice = state.movable[Math.floor(Math.random() * state.movable.length)];
    moveLudo(state, state.turn, choice);
  }
  return true;
}

export function viewFor(state, userId) {
  return {
    type: 'ludo',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    players: state.seats.map((id) => ({
      id,
      color: state.colors[id],
      pawns: state.pawns[id].slice(),
      home: state.pawns[id].filter((p) => p === GOAL).length,
      rank: state.ranks.indexOf(id) + 1 || null,
    })),
    turn: state.turn,
    isMyTurn: state.turn === userId && state.phase === 'playing',
    die: state.die,
    lastDie: state.lastDie,
    dieSeq: state.dieSeq,
    sixes: state.sixes,
    canRoll: state.phase === 'playing' && state.turn === userId && state.die == null,
    movable: state.turn === userId && state.die != null ? state.movable.slice() : [],
    lastEvent: state.lastEvent,
    ranks: state.ranks.slice(),
    log: state.log.slice(-10),
    winner: state.winner,
  };
}
