// Moteur de Ludo (2 à 4 joueurs), logique pure. Plateau classique en croix :
// piste de 52 cases, puis colonne d'arrivée privée de 5 cases vers le centre.
// Règles (comme l'appli Plato) :
// - on sort de l'écurie avec un 1 OU un 6 ;
// - un 6 fait rejouer ; trois 6 d'affilée : tour perdu ;
// - une seule pièce par case : on ne peut pas s'empiler, une case occupée par
//   soi-même est bloquée ;
// - atterrir sur un pion adverse le renvoie à l'écurie et fait rejouer ;
// - 4 cases étoiles protégées pour tout le monde ; la case départ de chaque
//   couleur protège uniquement les pions de cette couleur ;
// - l'arrivée se fait au compte exact ; rentrer un pion fait rejouer ;
// - première à rentrer ses 4 pions = vainqueur (on classe les suivantes).
//
// Position d'un pion (p) : -1 = écurie ; 0..50 = piste (case absolue =
// (départ + p) % 52) ; 51..55 = colonne d'arrivée ; 56 = au centre (rentré).

const RING = 52;
const TRACK_MAX = 50; // dernière position sur la piste partagée
const GOAL = 56;
const COLOR_ORDER = ['red', 'green', 'yellow', 'blue'];
// Départ de chaque couleur sur la piste.
const START = { red: 1, green: 14, yellow: 27, blue: 40 };
// Cases étoiles : protégées pour tout le monde.
const STARS = new Set([9, 22, 35, 48]);
// Cases départ : protègent uniquement leur propre couleur (règle Plato).
const START_CELL = { 1: 'red', 14: 'green', 27: 'yellow', 40: 'blue' };
const FR = { red: 'Rouge', green: 'Vert', yellow: 'Jaune', blue: 'Bleu' };
const OFFLINE_SKIP_MS = 10000;

const absCell = (color, p) => (START[color] + p) % RING;
const isOffline = (s, id) => !!(s.offline && s.offline[id]);
function nm(state, id) { return (state.names && state.names[id]) || 'quelqu\'un'; }
function isProtected(cell, color) { return STARS.has(cell) || START_CELL[cell] === color; }

// Qui occupe cette case de l'anneau ? (au plus un pion : pas d'empilement)
function occupantAt(state, cell) {
  for (const id of state.seats) {
    const c = state.colors[id];
    const pawns = state.pawns[id];
    for (let i = 0; i < 4; i++) {
      const p = pawns[i];
      if (p >= 0 && p <= TRACK_MAX && absCell(c, p) === cell) return { id, idx: i, color: c };
    }
  }
  return null;
}

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
  // À 2 joueuses : côtés opposés (plus équitable) ; à 3-4 : ordre classique.
  const layout = { 2: ['red', 'yellow'], 3: ['red', 'green', 'yellow'], 4: COLOR_ORDER }[state.seats.length];
  state.seats.forEach((id, i) => { state.colors[id] = layout[i]; });
  state.phase = 'playing';
  state.turn = state.seats[Math.floor(Math.random() * state.seats.length)];
  state.die = null; state.sixes = 0; state.movable = [];
  state.stepSince = Date.now();
  state.log = [`${FR[state.colors[state.turn]]} commence ! (sortie avec un 1 ou un 6)`];
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

// Un pion peut-il jouer ce dé ? (sortie au 1/6, case exacte, pas d'empilement,
// pions adverses protégés sur les étoiles et sur leur case départ)
function canMove(state, userId, pawnIdx, die) {
  const color = state.colors[userId];
  const p = state.pawns[userId][pawnIdx];
  if (p === GOAL) return false;
  if (p === -1) {
    if (die !== 6 && die !== 1) return false;
    const occ = occupantAt(state, START[color]);
    return !occ || (occ.id !== userId && !isProtected(START[color], occ.color));
  }
  const np = p + die;
  if (np > GOAL) return false;
  if (np <= TRACK_MAX) {
    const cell = absCell(color, np);
    const occ = occupantAt(state, cell);
    return !occ || (occ.id !== userId && !isProtected(cell, occ.color));
  }
  if (np < GOAL && state.pawns[userId].some((q, j) => j !== pawnIdx && q === np)) return false;
  return true;
}

function movablePawns(state, userId, die) {
  return [0, 1, 2, 3].filter((i) => canMove(state, userId, i, die));
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

  let np;
  if (pawns[idx] === -1) {
    np = 0;
    event(state, 'out', userId);
    pushLog(state, `${nm(state, userId)} sort un pion !`);
  } else {
    np = pawns[idx] + die;
    event(state, 'move', userId);
  }

  // Capture : un pion adverse non protégé sur la case d'arrivée du coup.
  if (np <= TRACK_MAX) {
    const cell = absCell(color, np);
    const occ = occupantAt(state, cell);
    if (occ && occ.id !== userId) {
      state.pawns[occ.id][occ.idx] = -1;
      bonus = true;
      event(state, 'capture', userId);
      pushLog(state, `${nm(state, userId)} mange un pion de ${nm(state, occ.id)} ! Oups…`);
    }
  }
  pawns[idx] = np;

  // Arrivée au centre : pion rentré, on rejoue.
  if (np === GOAL) {
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
// un moment, on joue pour elle (lancer puis un pion jouable au hasard).
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
