// Moteur de Tir à l'arc (façon Plato), logique pure.
// 2 à 6 joueuses, chacune tire 5 flèches, une par tour. On vise au
// lance-pierre (direction + puissance) ; le vent, différent à chaque flèche,
// dévie le tir. Cible à anneaux : 10 points au centre, 1 au bord.
// Le serveur calcule le point d'impact (autorité), le client anime le vol.

export const FIELD = { W: 1, H: 1.5 };      // terrain vertical (portrait)
export const BOW = { x: 0.5, y: 1.32 };     // position de l'arc en bas
export const TARGET = { x: 0.5, y: 0.35 };  // centre de la cible
export const RING = 0.03;                    // épaisseur d'un anneau (10 anneaux)
export const MAX_RANGE = 1.25;               // portée à pleine puissance
const ROUNDS = 5;                            // flèches par joueuse
const OFFLINE_SKIP_MS = 12000;
const isOffline = (s, id) => !!(s.offline && s.offline[id]);
function nm(state, id) { return (state.names && state.names[id]) || 'quelqu\'un'; }
const newWind = () => (Math.random() * 2 - 1) * 0.05;

export function createArchery() {
  return {
    type: 'archery',
    phase: 'waiting', // waiting -> playing -> over
    seats: [],
    scores: {},       // userId -> total de points
    arrows: [],       // { by, x, y, pts } — toutes les flèches plantées
    round: 1,
    rounds: ROUNDS,
    turn: null,
    turnSince: null,
    wind: 0,          // dérive horizontale pour la flèche en cours
    lastShot: null,   // { seq, by, x, y, pts } — permet au client d'animer
    shotSeq: 0,
    names: {},
    winners: null,
    log: [],
  };
}

export function joinArchery(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 6) state.seats.push(userId);
}

export function startArchery(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut au moins 2 joueuses.');
  state.scores = Object.fromEntries(state.seats.map((id) => [id, 0]));
  state.arrows = [];
  state.round = 1;
  state.turn = state.seats[0];
  state.turnSince = Date.now();
  state.wind = newWind();
  state.winners = null; state.lastShot = null; state.shotSeq = 0;
  state.phase = 'playing';
  state.log = [`${nm(state, state.turn)} tire la première flèche !`];
}

function pushLog(state, text) { state.log.push(text); if (state.log.length > 30) state.log = state.log.slice(-30); }

export function shootArchery(state, userId, { dx, dy, power }) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) throw new Error('Direction invalide.');
  const pow = Math.max(0.05, Math.min(1, Number(power) || 0.5));
  const len = Math.sqrt(dx * dx + dy * dy);
  const range = pow * MAX_RANGE;
  // Point d'impact : direction × portée, plus la dérive du vent (proportionnelle
  // au temps de vol : plus la flèche va loin, plus elle dérive).
  let x = BOW.x + (dx / len) * range + state.wind * range;
  let y = BOW.y + (dy / len) * range;
  const d = Math.sqrt((x - TARGET.x) ** 2 + (y - TARGET.y) ** 2);
  const pts = Math.max(0, 10 - Math.floor(d / RING));
  // On garde la flèche visible sur le terrain, même ratée.
  x = Math.max(0.03, Math.min(FIELD.W - 0.03, x));
  y = Math.max(0.03, Math.min(FIELD.H - 0.03, y));

  state.shotSeq += 1;
  state.lastShot = { seq: state.shotSeq, by: userId, x, y, pts };
  state.arrows.push({ by: userId, x, y, pts });
  state.scores[userId] = (state.scores[userId] || 0) + pts;
  pushLog(state, pts === 10
    ? `${nm(state, userId)} — EN PLEIN CENTRE, 10 points !`
    : pts > 0
      ? `${nm(state, userId)} marque ${pts} point${pts > 1 ? 's' : ''}.`
      : `${nm(state, userId)} rate la cible…`);

  // Joueuse suivante ; nouvelle manche quand tout le monde a tiré.
  const idx = state.seats.indexOf(userId);
  const wrapped = (idx + 1) % state.seats.length === 0;
  if (wrapped && state.round >= state.rounds) {
    state.phase = 'over';
    const best = Math.max(...state.seats.map((id) => state.scores[id] || 0));
    state.winners = state.seats.filter((id) => (state.scores[id] || 0) === best);
    pushLog(state, state.winners.length > 1
      ? `Égalité à ${best} points !`
      : `${nm(state, state.winners[0])} gagne avec ${best} points !`);
    return;
  }
  if (wrapped) state.round += 1;
  state.turn = state.seats[(idx + 1) % state.seats.length];
  state.turnSince = Date.now();
  state.wind = newWind();
}

// Horloge serveur : une absente tire vers le centre (avec un peu de flou).
export function tickArchery(state) {
  if (state.phase !== 'playing' || !state.turn) return false;
  if (!isOffline(state, state.turn)) return false;
  if (!state.turnSince || Date.now() - state.turnSince < OFFLINE_SKIP_MS) return false;
  const dist = Math.sqrt((TARGET.x - BOW.x) ** 2 + (TARGET.y - BOW.y) ** 2);
  shootArchery(state, state.turn, {
    dx: TARGET.x - BOW.x + (Math.random() - 0.5) * 0.08,
    dy: TARGET.y - BOW.y,
    power: dist / MAX_RANGE + (Math.random() - 0.5) * 0.1,
  });
  return true;
}

export function viewFor(state, userId) {
  return {
    type: 'archery',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    scores: { ...state.scores },
    arrows: state.arrows.map((a) => ({ ...a })),
    round: state.round,
    rounds: state.rounds,
    turn: state.turn,
    isMyTurn: state.phase === 'playing' && state.turn === userId,
    wind: state.wind,
    lastShot: state.lastShot,
    winners: state.winners ? state.winners.slice() : null,
    log: state.log.slice(-6),
  };
}
