// Mini Golf façon Plato : parcours vertical de 6 trous (murs, sable), logique
// pure + physique 2D. Chaque joueuse a sa balle (les balles ne se touchent pas :
// fantômes entre elles). La joueuse vise (direction + puissance) ; la simulation
// (frottements, rebonds sur murs, capture du trou) se déroule côté serveur
// jusqu'à l'arrêt — le client rejoue la même simulation pour l'animation.
// Score = total de coups sur les 6 trous, le plus petit gagne (8 coups max/trou).
import { aiAvailable, chatJSON } from '../ai.js';

export const COURSE = { W: 1, H: 1.6, R: 0.022, HOLE_R: 0.034 };
const WALL = 0.05;
// Chaque trou : départ en bas, trou en haut, murs (rectangles) et sable
// (la balle y freine fort). `par` est indicatif pour l'affichage.
export const HOLES = [
  { name: 'Tout droit', par: 2, start: [0.5, 1.42], hole: [0.5, 0.18], walls: [], sand: [] },
  {
    name: 'La chicane', par: 3, start: [0.5, 1.42], hole: [0.5, 0.15],
    walls: [{ x: 0, y: 0.95, w: 0.62, h: WALL }, { x: 0.38, y: 0.55, w: 0.62, h: WALL }], sand: [],
  },
  {
    name: 'L\'île', par: 3, start: [0.5, 1.42], hole: [0.5, 0.16],
    walls: [{ x: 0.32, y: 0.62, w: 0.36, h: 0.3 }], sand: [],
  },
  {
    name: 'Le couloir', par: 3, start: [0.18, 1.42], hole: [0.82, 0.15],
    walls: [{ x: 0.28, y: 0.28, w: WALL, h: 0.92 }, { x: 0.62, y: 0.5, w: WALL, h: 1.1 }], sand: [],
  },
  {
    name: 'La plage', par: 3, start: [0.5, 1.42], hole: [0.5, 0.15],
    walls: [], sand: [{ x: 0.1, y: 0.5, w: 0.8, h: 0.35 }],
  },
  {
    name: 'Le labyrinthe', par: 4, start: [0.5, 1.45], hole: [0.16, 0.14],
    walls: [
      { x: 0, y: 1.05, w: 0.7, h: WALL },
      { x: 0.3, y: 0.68, w: 0.7, h: WALL },
      { x: 0, y: 0.32, w: 0.7, h: WALL },
    ], sand: [],
  },
];

const FRICTION = 0.9915;
const SAND_FRICTION = 0.955;   // en plus du frottement normal : le sable colle
const STOP = 0.00025;
const CUSHION = 0.88;
const CAPTURE_SPEED = 0.02;    // trop vite = la balle saute par-dessus le trou
const MAX_STEPS = 2500;
const SUBSTEPS = 6;            // comme au billard : les rebonds au bon endroit
const MAX_STROKES = 8;         // au 8e coup raté, le trou est « abandonné »
const OFFLINE_SKIP_MS = 12000;
const isOffline = (s, id) => !!(s.offline && s.offline[id]);
const nm = (state, id) => (state.names && state.names[id]) || 'quelqu\'un';

const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

// Rebond balle/mur (cercle contre rectangle, coins compris).
function bounceWalls(hd, b) {
  const { R } = COURSE;
  for (const w of hd.walls) {
    const nx = Math.max(w.x, Math.min(b.x, w.x + w.w));
    const ny = Math.max(w.y, Math.min(b.y, w.y + w.h));
    const dx = b.x - nx, dy = b.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= R * R) continue;
    if (dx === 0 && dy === 0) {
      // centre à l'intérieur : on ressort par la face la plus proche
      const pl = b.x - w.x, pr = w.x + w.w - b.x, pt = b.y - w.y, pb = w.y + w.h - b.y;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) { b.x = w.x - R; if (b.vx > 0) b.vx = -b.vx * CUSHION; }
      else if (m === pr) { b.x = w.x + w.w + R; if (b.vx < 0) b.vx = -b.vx * CUSHION; }
      else if (m === pt) { b.y = w.y - R; if (b.vy > 0) b.vy = -b.vy * CUSHION; }
      else { b.y = w.y + w.h + R; if (b.vy < 0) b.vy = -b.vy * CUSHION; }
    } else {
      const d = Math.sqrt(d2) || 1e-9;
      const ux = dx / d, uy = dy / d;
      b.x = nx + ux * R; b.y = ny + uy * R;
      const vn = b.vx * ux + b.vy * uy;
      if (vn < 0) { b.vx -= (1 + CUSHION) * vn * ux; b.vy -= (1 + CUSHION) * vn * uy; }
    }
  }
}

// Simulation d'UN coup (une seule balle : les balles sont fantômes entre elles).
// Mutations sur `ball`. Renvoie true si la balle est rentrée dans le trou.
export function simulateGolf(hd, ball, shot, onStep) {
  const { W, H, R, HOLE_R } = COURSE;
  const len = Math.sqrt(shot.dx * shot.dx + shot.dy * shot.dy) || 1;
  const speed = 0.006 + Math.max(0, Math.min(1, shot.power)) * 0.030;
  ball.vx = (shot.dx / len) * speed;
  ball.vy = (shot.dy / len) * speed;

  for (let step = 0; step < MAX_STEPS; step++) {
    let moving = false;
    for (let ss = 0; ss < SUBSTEPS; ss++) {
      ball.x += ball.vx / SUBSTEPS; ball.y += ball.vy / SUBSTEPS;
      bounceWalls(hd, ball);
      if (ball.x < R && ball.vx < 0) { ball.x = R; ball.vx = -ball.vx * CUSHION; }
      if (ball.x > W - R && ball.vx > 0) { ball.x = W - R; ball.vx = -ball.vx * CUSHION; }
      if (ball.y < R && ball.vy < 0) { ball.y = R; ball.vy = -ball.vy * CUSHION; }
      if (ball.y > H - R && ball.vy > 0) { ball.y = H - R; ball.vy = -ball.vy * CUSHION; }
      // Le trou avale la balle si elle passe dessus assez lentement.
      const hx = ball.x - hd.hole[0], hy = ball.y - hd.hole[1];
      const sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
      if (hx * hx + hy * hy < HOLE_R * HOLE_R && sp < CAPTURE_SPEED) {
        ball.x = hd.hole[0]; ball.y = hd.hole[1]; ball.vx = 0; ball.vy = 0;
        return true;
      }
    }
    let f = FRICTION;
    for (const s of hd.sand) if (inRect(ball.x, ball.y, s)) { f *= SAND_FRICTION; break; }
    ball.vx *= f; ball.vy *= f;
    if (Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy) < STOP) { ball.vx = 0; ball.vy = 0; }
    else moving = true;
    if (onStep) onStep(step);
    if (!moving) break;
  }
  return false;
}

export function createGolf() {
  return {
    type: 'golf',
    phase: 'waiting', // waiting -> playing -> over
    seats: [],
    hole: 0,
    balls: {},   // userId -> { x, y, strokes (sur ce trou), done }
    scores: {},  // userId -> [coups par trou]
    turn: null,
    turnSince: null,
    lastShot: null, // { seq, by, dx, dy, power, holed } — le client anime
    shotSeq: 0,
    breakUntil: null, // petite pause tableau des scores entre deux trous
    names: {},
    winners: null,
    log: [],
  };
}

export function joinGolf(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 6) state.seats.push(userId);
}

function resetHole(state) {
  const hd = HOLES[state.hole];
  for (const id of state.seats) {
    state.balls[id] = { x: hd.start[0], y: hd.start[1], strokes: 0, done: false };
  }
  state.turn = state.seats[0];
  state.turnSince = Date.now();
  state.breakUntil = null;
}

export function startGolf(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut au moins 2 joueuses.');
  state.hole = 0;
  state.scores = Object.fromEntries(state.seats.map((id) => [id, []]));
  state.winners = null; state.lastShot = null; state.shotSeq = 0;
  state.botSkill = null; state.aiTask = null; state.botPlan = null; state.botAim = null;
  state.phase = 'playing';
  resetHole(state);
  state.log = [`Trou 1 — ${HOLES[0].name} (par ${HOLES[0].par}). ${nm(state, state.turn)} commence !`];
}

function pushLog(state, text) { state.log.push(text); if (state.log.length > 30) state.log = state.log.slice(-30); }

// Prochaine joueuse qui n'a pas fini le trou (rotation), ou null si tout le monde a fini.
function nextTurn(state, after) {
  const n = state.seats.length;
  const from = state.seats.indexOf(after);
  for (let k = 1; k <= n; k++) {
    const id = state.seats[(from + k) % n];
    if (!state.balls[id].done) return id;
  }
  return null;
}

function endHole(state) {
  // Verse les coups du trou au score puis remet les compteurs de balle à zéro
  // (sinon le total affiché les compterait en double pendant la pause).
  for (const id of state.seats) {
    state.scores[id].push(state.balls[id].strokes);
    state.balls[id].strokes = 0;
  }
  state.turn = null;
  state.breakUntil = Date.now() + 3500;
  const totals = state.seats.map((id) => `${nm(state, id)} ${state.scores[id].reduce((a, b) => a + b, 0)}`).join(' · ');
  pushLog(state, `Fin du trou ${state.hole + 1}. Totaux : ${totals}.`);
}

export function shootGolf(state, userId, { dx, dy, power }) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (state.breakUntil) throw new Error('Le trou est terminé, on change !');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) throw new Error('Direction invalide.');
  const pow = Math.max(0.05, Math.min(1, Number(power) || 0.5));

  const ball = state.balls[userId];
  const hd = HOLES[state.hole];
  state.shotSeq += 1;
  state.lastShot = { seq: state.shotSeq, by: userId, from: { x: ball.x, y: ball.y }, dx, dy, power: pow };
  const holed = simulateGolf(hd, ball, { dx, dy, power: pow });
  ball.strokes += 1;
  state.lastShot.holed = holed;

  if (holed) {
    ball.done = true;
    pushLog(state, `${nm(state, userId)} rentre la balle en ${ball.strokes} coup${ball.strokes > 1 ? 's' : ''} !`);
  } else if (ball.strokes >= MAX_STROKES) {
    ball.done = true;
    pushLog(state, `${nm(state, userId)} abandonne le trou (${MAX_STROKES} coups).`);
  }

  const next = nextTurn(state, userId);
  if (next) {
    state.turn = next;
    state.turnSince = Date.now();
  } else {
    endHole(state);
  }
}

// Passage au trou suivant (ou fin de partie) après la pause des scores.
function advanceHole(state) {
  if (state.hole + 1 >= HOLES.length) {
    state.phase = 'over';
    state.breakUntil = null;
    const totals = state.seats.map((id) => [id, state.scores[id].reduce((a, b) => a + b, 0)]);
    const best = Math.min(...totals.map(([, t]) => t));
    state.winners = totals.filter(([, t]) => t === best).map(([id]) => id);
    pushLog(state, `Partie finie ! ${state.winners.map((id) => nm(state, id)).join(' et ')} gagne${state.winners.length > 1 ? 'nt' : ''} avec ${best} coups.`);
    return;
  }
  state.hole += 1;
  resetHole(state);
  const hd = HOLES[state.hole];
  pushLog(state, `Trou ${state.hole + 1} — ${hd.name} (par ${hd.par}). ${nm(state, state.turn)} joue !`);
}

// --- ChatGPT au mini golf -----------------------------------------------------
// Comme au billard : il choisit son niveau de jeu en début de partie et s'y
// tient ; l'erreur d'exécution en découle. Jamais de tir au hasard : chaque
// option proposée a été simulée.
const SKILLS = {
  mediocre:  { aim: 0.06, pow: 0.22, label: 'médiocre' },
  moyen:     { aim: 0.028, pow: 0.12, label: 'moyen' },
  bien:      { aim: 0.012, pow: 0.07, label: 'bien' },
  tres_bien: { aim: 0.005, pow: 0.035, label: 'très bien' },
};
const pickLocalSkill = () => {
  const r = Math.random();
  return r < 0.15 ? 'mediocre' : r < 0.5 ? 'moyen' : r < 0.85 ? 'bien' : 'tres_bien';
};

// Éventail de coups simulés : angle direct vers le trou + variations (rebonds),
// plusieurs puissances. Gardés : ceux qui rentrent, puis les meilleures approches.
function candidateShots(state) {
  const hd = HOLES[state.hole];
  const ball = state.balls.bot;
  const aHole = Math.atan2(hd.hole[1] - ball.y, hd.hole[0] - ball.x);
  const results = [];
  const angles = [aHole];
  for (let k = 1; k <= 20; k++) { angles.push(aHole + k * 0.15, aHole - k * 0.15); }
  for (const a of angles) {
    for (const power of [0.3, 0.55, 0.8, 1]) {
      const sim = { x: ball.x, y: ball.y, vx: 0, vy: 0 };
      const holed = simulateGolf(hd, sim, { dx: Math.cos(a), dy: Math.sin(a), power });
      const dist = Math.sqrt((sim.x - hd.hole[0]) ** 2 + (sim.y - hd.hole[1]) ** 2);
      results.push({ a, power, holed, dist, direct: Math.abs(a - aHole) < 0.2 });
    }
  }
  // Les coups qui rentrent d'abord (doux de préférence), puis les meilleures approches.
  results.sort((p, q) => (q.holed - p.holed) || (p.holed ? p.power - q.power : p.dist - q.dist));
  const kept = [];
  for (const r of results) {
    if (kept.length >= 4) break;
    // évite les quasi-doublons d'angle
    if (kept.some((k) => Math.abs(k.a - r.a) < 0.12 && Math.abs(k.power - r.power) < 0.2)) continue;
    kept.push(r);
  }
  const options = kept.map((r) => (r.holed
    ? `Rentrer la balle (tir ${r.direct ? 'direct' : 'avec rebond'}, puissance ${Math.round(r.power * 100)} %)`
    : `Approcher la balle à ${Math.round(r.dist * 100)} cm du trou (tir ${r.direct ? 'direct' : 'avec rebond'})`));
  const moves = kept.map((r) => ({ dx: Math.cos(r.a), dy: Math.sin(r.a), power: r.power, holed: r.holed }));
  return {
    rules: `Trou ${state.hole + 1}/${HOLES.length} (« ${hd.name} », par ${hd.par}). Tu en es à ${ball.strokes} coup(s) sur ce trou ; le moins de coups possible gagne.`,
    situation: `Options simulées, de la meilleure à la moins bonne. Adversaires : ${state.seats.filter((id) => id !== 'bot').map((id) => nm(state, id)).join(', ')}.`,
    options, moves,
  };
}

function botChoose(state, build) {
  const t = state.aiTask;
  if (t?.status === 'pending') {
    if (Date.now() - (t.t0 || 0) > 8000) { state.aiTask = null; return null; }
    return 'wait';
  }
  if (t?.status === 'done') {
    state.aiTask = null;
    const r = t.result;
    if (!state.botSkill && r && SKILLS[r.niveau]) state.botSkill = r.niveau;
    const i = r?.choix;
    return Number.isInteger(i) && t.moves && t.moves[i] !== undefined ? t.moves[i] : null;
  }
  if (!aiAvailable()) return null;
  const built = build();
  if (!built || !built.options.length) return null;
  const task = { status: 'pending', t0: Date.now(), moves: built.moves };
  state.aiTask = task;
  const askLevel = !state.botSkill;
  const sys = 'Tu joues au Mini Golf contre des joueuses humaines. ' + built.rules + ' '
    + (askLevel
      ? 'Commence par choisir ton niveau de jeu pour TOUTE cette partie, comme une vraie joueuse selon ton humeur du jour : "mediocre", "moyen", "bien" ou "tres_bien". '
      : `Tu as choisi de jouer à un niveau ${SKILLS[state.botSkill].label} pour cette partie : reste cohérente avec ce niveau. `)
    + 'Joue comme une joueuse humaine SENSÉE, jamais au hasard : un bon niveau tente le trou, un niveau faible assure une approche. '
    + `Réponds UNIQUEMENT en JSON : {"choix": <numéro de l'option>${askLevel ? ', "niveau": "mediocre|moyen|bien|tres_bien"' : ''}}.`;
  chatJSON(sys, { situation: built.situation, options: built.options.map((o, i) => `${i}. ${o}`) }, { timeoutMs: 6500 })
    .then((out) => {
      task.status = 'done';
      task.result = out ? { choix: Math.round(Number(out.choix)), niveau: String(out.niveau || '') } : null;
    })
    .catch(() => { task.status = 'done'; task.result = null; });
  return 'wait';
}

// Visée visible puis tir imparfait, exactement comme au billard.
function planBotShot(state, shot) {
  const sk = SKILLS[state.botSkill] || SKILLS.moyen;
  const finalA = Math.atan2(shot.dy, shot.dx);
  const steps = [];
  const n = 2 + Math.floor(Math.random() * 2);
  const startOff = (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.3);
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const a = finalA + startOff * (1 - k) + (Math.random() - 0.5) * 0.05 * (1 - k);
    steps.push({ dx: Math.cos(a), dy: Math.sin(a), power: shot.power * (0.25 + 0.75 * k) });
  }
  const a = finalA + (Math.random() * 2 - 1) * sk.aim;
  const power = Math.max(0.1, Math.min(1, shot.power * (1 + (Math.random() * 2 - 1) * sk.pow)));
  state.botPlan = {
    steps, i: 0, at: Date.now() + 500,
    final: { dx: Math.cos(a), dy: Math.sin(a), power },
  };
}

// Horloge serveur : pause de fin de trou, tour du bot, absentes déconnectées.
export function tickGolf(state) {
  if (state.phase !== 'playing') return false;

  if (state.breakUntil) {
    if (Date.now() < state.breakUntil) return false;
    advanceHole(state);
    return true;
  }
  if (!state.turn) return false;

  if (state.turn === 'bot') {
    if (state.botPlan) {
      const p = state.botPlan;
      if (Date.now() < p.at) return false;
      if (p.i < p.steps.length) {
        state.botAim = p.steps[p.i];
        p.i += 1;
        p.at = Date.now() + 420 + Math.random() * 430;
        return true;
      }
      const shot = p.final;
      state.botPlan = null;
      state.botAim = null;
      shootGolf(state, 'bot', shot);
      return true;
    }
    const wait = 800 + (state.turnSince % 1400);
    if (!state.turnSince || Date.now() - state.turnSince < wait) return false;
    const picked = botChoose(state, () => candidateShots(state));
    if (picked === 'wait') return false;
    let shot = picked;
    if (!shot) {
      if (!state.botSkill) state.botSkill = pickLocalSkill();
      const built = candidateShots(state);
      // Secours local : le meilleur coup (un niveau médiocre prend parfois le 2e).
      const idx = state.botSkill === 'mediocre' && built.moves.length > 1 && Math.random() < 0.4 ? 1 : 0;
      shot = built.moves[idx];
    }
    if (!shot) return false;
    planBotShot(state, shot);
    return false;
  }

  if (!isOffline(state, state.turn)) return false;
  if (!state.turnSince || Date.now() - state.turnSince < OFFLINE_SKIP_MS) return false;
  const hd = HOLES[state.hole];
  const ball = state.balls[state.turn];
  shootGolf(state, state.turn, { dx: hd.hole[0] - ball.x, dy: hd.hole[1] - ball.y, power: 0.4 });
  return true;
}

export function viewFor(state, userId) {
  const hd = HOLES[state.hole] || HOLES[0];
  return {
    type: 'golf',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    hole: state.hole,
    holeCount: HOLES.length,
    layout: { name: hd.name, par: hd.par, start: hd.start, hole: hd.hole, walls: hd.walls, sand: hd.sand },
    balls: Object.fromEntries(state.seats.map((id) => {
      const b = state.balls[id] || { x: hd.start[0], y: hd.start[1], strokes: 0, done: false };
      return [id, { x: b.x, y: b.y, strokes: b.strokes, done: b.done }];
    })),
    scores: Object.fromEntries(state.seats.map((id) => [id, (state.scores[id] || []).slice()])),
    totals: Object.fromEntries(state.seats.map((id) => [id, (state.scores[id] || []).reduce((a, b) => a + b, 0)])),
    turn: state.turn,
    isMyTurn: state.phase === 'playing' && state.turn === userId && !state.breakUntil,
    onBreak: !!state.breakUntil,
    lastShot: state.lastShot,
    botAim: state.turn === 'bot' ? state.botAim || null : null,
    winners: state.winners,
    log: state.log.slice(-6),
  };
}
