// Moteur de Billard (8-ball façon Plato), logique pure + physique 2D.
// 2 joueuses. Table 2×1, 6 poches. La joueuse vise (direction + puissance) ;
// la simulation (frottements, rebonds, collisions élastiques) se déroule côté
// serveur jusqu'à l'arrêt des billes — le client rejoue la même simulation
// pour l'animation, puis se cale sur l'état serveur (autorité).
// Règles simplifiées : premier empochage légal fixe ton groupe (pleines 1-7 /
// rayées 9-15). Empocher une bille de son groupe = on rejoue. Blanche empochée
// = faute, la blanche revient à la ligne de tête et le tour passe. La noire (8)
// se joue en dernier : la rentrer après son groupe = victoire, avant = défaite.

export const TABLE = { W: 2, H: 1, R: 0.026, POCKET_R: 0.058 };
export const POCKETS = [
  [0.02, 0.02], [1, -0.012], [1.98, 0.02],
  [0.02, 0.98], [1, 1.012], [1.98, 0.98],
];
const FRICTION = 0.992;
const STOP = 0.00028;
const CUSHION = 0.92;
const MAX_STEPS = 4000;
const OFFLINE_SKIP_MS = 12000;
const isOffline = (s, id) => !!(s.offline && s.offline[id]);
function nm(state, id) { return (state.names && state.names[id]) || 'quelqu\'un'; }

// Positions de départ : blanche à la ligne de tête, triangle au 3/4.
export function rackBalls() {
  const balls = [{ id: 0, x: 0.5, y: 0.5, vx: 0, vy: 0, pocketed: false }];
  // Ordre du triangle : la 8 au centre, coins pleine/rayée.
  const order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
  const R = TABLE.R; const sx = 1.45; let k = 0;
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      balls.push({ id: order[k++], x: sx + row * (R * 1.74), y: 0.5 + (i - row / 2) * (R * 2.02), vx: 0, vy: 0, pocketed: false });
    }
  }
  return balls;
}

// Simulation physique complète jusqu'à l'arrêt. Mutations sur `balls`.
// `onStep` (optionnel) est appelé à chaque pas — utilisé par le client pour animer.
export function simulate(balls, shot, onStep) {
  const { R, W, H, POCKET_R } = TABLE;
  const cue = balls.find((b) => b.id === 0);
  const len = Math.sqrt(shot.dx * shot.dx + shot.dy * shot.dy) || 1;
  const speed = 0.008 + Math.max(0, Math.min(1, shot.power)) * 0.030;
  cue.vx = (shot.dx / len) * speed;
  cue.vy = (shot.dy / len) * speed;
  const potted = [];

  for (let step = 0; step < MAX_STEPS; step++) {
    let moving = false;
    for (const b of balls) {
      if (b.pocketed) continue;
      b.x += b.vx; b.y += b.vy;
      b.vx *= FRICTION; b.vy *= FRICTION;
      const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
      if (sp < STOP) { b.vx = 0; b.vy = 0; } else moving = true;

      // Poches (vérifiées avant les bandes : l'entrée de poche « avale »)
      for (const [px, py] of POCKETS) {
        const dx = b.x - px, dy = b.y - py;
        if (dx * dx + dy * dy < POCKET_R * POCKET_R) { b.pocketed = true; b.vx = 0; b.vy = 0; potted.push(b.id); break; }
      }
      if (b.pocketed) continue;

      // Bandes
      if (b.x < R && b.vx < 0) { b.x = R; b.vx = -b.vx * CUSHION; }
      if (b.x > W - R && b.vx > 0) { b.x = W - R; b.vx = -b.vx * CUSHION; }
      if (b.y < R && b.vy < 0) { b.y = R; b.vy = -b.vy * CUSHION; }
      if (b.y > H - R && b.vy > 0) { b.y = H - R; b.vy = -b.vy * CUSHION; }
    }

    // Collisions bille-bille (masses égales, choc élastique sur la normale)
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]; if (a.pocketed) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const c = balls[j]; if (c.pocketed) continue;
        const dx = c.x - a.x, dy = c.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0 && d2 < (2 * R) * (2 * R)) {
          const d = Math.sqrt(d2);
          const nx = dx / d, ny = dy / d;
          // sépare les billes qui se chevauchent
          const overlap = (2 * R - d) / 2;
          a.x -= nx * overlap; a.y -= ny * overlap;
          c.x += nx * overlap; c.y += ny * overlap;
          // échange des composantes normales des vitesses
          const va = a.vx * nx + a.vy * ny;
          const vc = c.vx * nx + c.vy * ny;
          const diff = va - vc;
          if (diff > 0) {
            a.vx -= diff * nx; a.vy -= diff * ny;
            c.vx += diff * nx; c.vy += diff * ny;
            moving = true;
          }
        }
      }
    }

    if (onStep) onStep(step);
    if (!moving) break;
  }
  return potted;
}

const group = (id) => (id >= 1 && id <= 7 ? 'solid' : id >= 9 && id <= 15 ? 'stripe' : null);

export function createPool() {
  return {
    type: 'pool',
    phase: 'waiting', // waiting -> playing -> over
    seats: [],
    balls: rackBalls(),
    groups: {},       // userId -> 'solid' | 'stripe'
    turn: null,
    turnSince: null,
    lastShot: null,   // { seq, by, dx, dy, power } — permet au client d'animer
    shotSeq: 0,
    lastEvent: null,  // { seq, kind:'pot'|'scratch'|'win', ids }
    names: {},
    winner: null,
    log: [],
  };
}

export function joinPool(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 2) state.seats.push(userId);
}

export function startPool(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut 2 joueuses.');
  state.balls = rackBalls();
  state.groups = {};
  state.turn = state.seats[Math.floor(Math.random() * 2)];
  state.turnSince = Date.now();
  state.winner = null; state.lastShot = null; state.shotSeq = 0;
  state.phase = 'playing';
  state.log = [`${nm(state, state.turn)} casse !`];
}

function pushLog(state, text) { state.log.push(text); if (state.log.length > 30) state.log = state.log.slice(-30); }

// Replace la blanche à la ligne de tête (après une faute), sur une case libre.
function respotCue(state) {
  const cue = state.balls.find((b) => b.id === 0);
  const { R } = TABLE;
  for (let dy = 0; dy < 0.5; dy += R) {
    for (const sign of dy === 0 ? [1] : [1, -1]) {
      const y = 0.5 + sign * dy;
      const free = state.balls.every((b) => b.id === 0 || b.pocketed || ((b.x - 0.5) ** 2 + (b.y - y) ** 2) > (2.2 * R) ** 2);
      if (free && y > R && y < 1 - R) { cue.pocketed = false; cue.x = 0.5; cue.y = y; cue.vx = 0; cue.vy = 0; return; }
    }
  }
  cue.pocketed = false; cue.x = 0.5; cue.y = 0.5; cue.vx = 0; cue.vy = 0;
}

const remainingOf = (state, g) => state.balls.filter((b) => !b.pocketed && group(b.id) === g).length;

export function shootPool(state, userId, { dx, dy, power }) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) throw new Error('Direction invalide.');
  const pow = Math.max(0.05, Math.min(1, Number(power) || 0.5));

  state.shotSeq += 1;
  state.lastShot = { seq: state.shotSeq, by: userId, dx, dy, power: pow };
  const potted = simulate(state.balls, { dx, dy, power: pow });

  const opponent = state.seats.find((id) => id !== userId);
  const myGroup = state.groups[userId] || null;
  const scratch = potted.includes(0);
  const potted8 = potted.includes(8);

  if (potted8) {
    // La noire : victoire si ton groupe était déjà vidé et pas de faute, sinon défaite.
    const cleared = myGroup && remainingOf(state, myGroup) === 0;
    state.winner = cleared && !scratch ? userId : opponent;
    state.phase = 'over';
    pushLog(state, cleared && !scratch
      ? `${nm(state, userId)} empoche la noire et gagne !`
      : `${nm(state, userId)} fait tomber la noire trop tôt… ${nm(state, state.winner)} gagne !`);
    return;
  }

  if (scratch) {
    respotCue(state);
    state.turn = opponent;
    state.turnSince = Date.now();
    pushLog(state, `${nm(state, userId)} empoche la blanche — faute !`);
    return;
  }

  const pottedGroups = potted.map(group).filter(Boolean);
  if (pottedGroups.length && !myGroup && !state.groups[opponent]) {
    // Premier empochage : attribution des groupes.
    const g = pottedGroups[0];
    state.groups[userId] = g;
    state.groups[opponent] = g === 'solid' ? 'stripe' : 'solid';
    pushLog(state, `${nm(state, userId)} prend les ${g === 'solid' ? 'pleines' : 'rayées'} et rejoue !`);
    return; // rejoue
  }
  if (pottedGroups.length && myGroup && pottedGroups.includes(myGroup)) {
    pushLog(state, `${nm(state, userId)} empoche et rejoue !`);
    return; // rejoue
  }

  state.turn = opponent;
  state.turnSince = Date.now();
  if (potted.length) pushLog(state, `${nm(state, userId)} empoche… pour l'adversaire. Tour suivant.`);
}

// Le bot cherche un vrai coup : pour ses billes les plus proches, il vise le
// point fantôme derrière la bille (aligné bille → poche), simule le tir et
// note le résultat (empocher les siennes = bien, blanche/noire trop tôt = non).
function bestBotShot(state, shooter) {
  const balls = state.balls;
  const cue = balls.find((b) => b.id === 0);
  const myGroup = state.groups[shooter] || null;
  const cleared = myGroup && remainingOf(state, myGroup) === 0;
  const targets = balls
    .filter((b) => !b.pocketed && b.id !== 0)
    .filter((b) => (cleared ? b.id === 8 : myGroup ? group(b.id) === myGroup : b.id !== 8))
    .sort((a, b) => ((a.x - cue.x) ** 2 + (a.y - cue.y) ** 2) - ((b.x - cue.x) ** 2 + (b.y - cue.y) ** 2))
    .slice(0, 4);
  let best = null; let bestScore = -Infinity;
  for (const t of targets) {
    const pockets = [...POCKETS].sort((p, q) => ((p[0] - t.x) ** 2 + (p[1] - t.y) ** 2) - ((q[0] - t.x) ** 2 + (q[1] - t.y) ** 2)).slice(0, 3);
    for (const [px, py] of pockets) {
      const dx = px - t.x, dy = py - t.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const gx = t.x - (dx / d) * 2 * TABLE.R, gy = t.y - (dy / d) * 2 * TABLE.R;
      const aim = { dx: gx - cue.x, dy: gy - cue.y };
      for (const power of [0.5, 0.8]) {
        const sim = balls.map((b) => ({ ...b }));
        const potted = simulate(sim, { ...aim, power });
        let score = Math.random(); // départage aléatoire
        if (potted.includes(0)) score -= 80;
        if (potted.includes(8)) score += cleared && !potted.includes(0) ? 300 : -600;
        for (const id of potted) {
          if (id === 0 || id === 8) continue;
          score += !myGroup ? 40 : group(id) === myGroup ? 50 : -25;
        }
        if (score > bestScore) { bestScore = score; best = { ...aim, power }; }
      }
    }
  }
  return best;
}

// Horloge serveur : le bot joue son vrai coup ; une absente tire doucement
// vers la bille la plus proche (pilote automatique de secours).
export function tickPool(state) {
  if (state.phase !== 'playing' || !state.turn) return false;
  if (!isOffline(state, state.turn)) return false;
  const wait = state.turn === 'bot' ? 3000 : OFFLINE_SKIP_MS;
  if (!state.turnSince || Date.now() - state.turnSince < wait) return false;
  if (state.turn === 'bot') {
    const shot = bestBotShot(state, 'bot');
    if (shot) { shootPool(state, 'bot', shot); return true; }
  }
  const cue = state.balls.find((b) => b.id === 0);
  let best = null; let bd = Infinity;
  for (const b of state.balls) {
    if (b.id === 0 || b.pocketed) continue;
    const d = (b.x - cue.x) ** 2 + (b.y - cue.y) ** 2;
    if (d < bd) { bd = d; best = b; }
  }
  if (!best) return false;
  shootPool(state, state.turn, { dx: best.x - cue.x, dy: best.y - cue.y, power: 0.4 });
  return true;
}

export function viewFor(state, userId) {
  const opponent = state.seats.find((id) => id !== userId) || null;
  return {
    type: 'pool',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length === 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    balls: state.balls.map((b) => ({ id: b.id, x: b.x, y: b.y, pocketed: b.pocketed })),
    groups: { ...state.groups },
    myGroup: state.groups[userId] || null,
    turn: state.turn,
    isMyTurn: state.phase === 'playing' && state.turn === userId,
    lastShot: state.lastShot,
    remaining: {
      solid: state.balls.filter((b) => !b.pocketed && group(b.id) === 'solid').map((b) => b.id),
      stripe: state.balls.filter((b) => !b.pocketed && group(b.id) === 'stripe').map((b) => b.id),
      eight: !state.balls.find((b) => b.id === 8).pocketed,
    },
    winner: state.winner,
    log: state.log.slice(-6),
  };
}
