// Moteur de Tir à l'arc 3D (façon Plato), logique pure + balistique.
// 2 à 6 joueuses, chacune tire 5 flèches, une par tour.
// Monde en mètres : X = latéral (+ à droite), Y = hauteur, Z = vers la cible.
// La flèche subit la gravité et un vent latéral à rafales ; le serveur simule
// le vol pas à pas (autorité), le client rejoue la même simulation en 3D
// pour l'animation. Cible à 30 m : 10 anneaux de 6 cm, 10 points au centre.

export const G = 9.81;
export const DT = 1 / 120;
export const BOW = { x: 0, y: 1.5, z: 0 };
export const TARGET = { y: 1.3, z: 20, RING: 0.06, R: 0.6, BOARD: 0.75 };
export const SPEED = { min: 30, max: 70 };      // m/s selon la puissance
export const WIND_ACCEL = 1.6;                   // poussée latérale par m/s de vent
export const WIND_MAX = 6;                       // m/s
const ROUNDS = 5;                                // flèches par joueuse
const OFFLINE_SKIP_MS = 12000;
const isOffline = (s, id) => !!(s.offline && s.offline[id]);
function nm(state, id) { return (state.names && state.names[id]) || 'quelqu\'un'; }
const newWind = () => Math.round((Math.random() * 2 - 1) * WIND_MAX * 10) / 10;

// Simulation du vol : gravité + vent à rafales (déterministe pour que le
// client rejoue exactement le même vol). Retourne le point d'arrivée :
// - sur le plan de la cible : { plane: true, x, y, t }
// - dans l'herbe avant :      { plane: false, gx, gz, t }
// `onStep(pos, vel, t)` optionnel — utilisé par le client pour animer.
export function simulateArrow({ yaw, pitch, power }, wind, onStep) {
  const v = SPEED.min + Math.max(0, Math.min(1, power)) * (SPEED.max - SPEED.min);
  const cp = Math.cos(pitch);
  let x = BOW.x, y = BOW.y, z = BOW.z;
  let vx = v * Math.sin(yaw) * cp, vy = v * Math.sin(pitch), vz = v * Math.cos(yaw) * cp;
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    const px = x, py = y, pz = z;
    vx += wind * WIND_ACCEL * (1 + 0.35 * Math.sin(t * 7)) * DT; // rafales
    vy -= G * DT;
    x += vx * DT; y += vy * DT; z += vz * DT; t += DT;
    if (z >= TARGET.z) {
      const k = (TARGET.z - pz) / (z - pz || 1);
      return { plane: true, x: px + (x - px) * k, y: py + (y - py) * k, t };
    }
    if (y <= 0) {
      const k = (0 - py) / (y - py || 1);
      return { plane: false, gx: px + (x - px) * k, gz: pz + (z - pz) * k, t };
    }
    if (onStep) onStep({ x, y, z }, { vx, vy, vz }, t);
  }
  return { plane: false, gx: x, gz: z, t };
}

export const pointsFor = (x, y) => {
  const d = Math.sqrt(x * x + (y - TARGET.y) ** 2);
  return d <= TARGET.R ? Math.max(1, 10 - Math.floor(d / TARGET.RING)) : 0;
};

export function createArchery() {
  return {
    type: 'archery',
    phase: 'waiting', // waiting -> playing -> over
    seats: [],
    scores: {},       // userId -> total de points
    arrows: [],       // { by, x, y, pts } — flèches plantées dans la cible
    round: 1,
    rounds: ROUNDS,
    turn: null,
    turnSince: null,
    wind: 0,          // m/s latéral (+ = vers la droite) pour la flèche en cours
    lastShot: null,   // { seq, by, yaw, pitch, power, wind, … } — le client anime
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

export function shootArchery(state, userId, { yaw, pitch, power }) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  if (!Number.isFinite(yaw) || !Number.isFinite(pitch)) throw new Error('Visée invalide.');
  const shot = {
    yaw: Math.max(-0.6, Math.min(0.6, yaw)),
    pitch: Math.max(-0.2, Math.min(0.7, pitch)),
    power: Math.max(0.1, Math.min(1, Number(power) || 0.5)),
  };
  const hit = simulateArrow(shot, state.wind);
  const pts = hit.plane ? pointsFor(hit.x, hit.y) : 0;

  state.shotSeq += 1;
  state.lastShot = { seq: state.shotSeq, by: userId, ...shot, wind: state.wind, ...hit, pts };
  // Une flèche se plante dans le panneau (même la bordure à 0 point).
  if (hit.plane && Math.sqrt(hit.x ** 2 + (hit.y - TARGET.y) ** 2) <= TARGET.BOARD) {
    state.arrows.push({ by: userId, x: hit.x, y: hit.y, pts });
  }
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

// Horloge serveur : une absente tire un coup honnête (petite recherche de la
// meilleure visée avec le vent du moment, puis un peu de tremblement).
export function tickArchery(state) {
  if (state.phase !== 'playing' || !state.turn) return false;
  if (!isOffline(state, state.turn)) return false;
  if (!state.turnSince || Date.now() - state.turnSince < OFFLINE_SKIP_MS) return false;
  let best = { yaw: 0, pitch: 0.05 }, bd = Infinity;
  for (let yaw = -0.08; yaw <= 0.08; yaw += 0.01) {
    for (let pitch = 0; pitch <= 0.12; pitch += 0.01) {
      const hit = simulateArrow({ yaw, pitch, power: 1 }, state.wind);
      if (!hit.plane) continue;
      const d = Math.sqrt(hit.x ** 2 + (hit.y - TARGET.y) ** 2);
      if (d < bd) { bd = d; best = { yaw, pitch }; }
    }
  }
  shootArchery(state, state.turn, {
    yaw: best.yaw + (Math.random() - 0.5) * 0.02,
    pitch: best.pitch + (Math.random() - 0.5) * 0.02,
    power: 1,
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
