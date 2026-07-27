// Bounce façon Plato (type Ballz) : chaque joueuse a SON plateau de briques
// numérotées ; on tire une volée de balles depuis le bas, les balles rebondissent
// (murs, briques) et cassent les briques (chaque brique encaisse « son numéro »
// de coups). Après chaque volée, les briques descendent d'un rang et une
// nouvelle ligne apparaît en haut — la même pour tout le monde (graine
// partagée) : c'est équitable. Une brique qui atteint le bas élimine la
// joueuse. Chacune joue à son rythme ; quand tout le monde est éliminé, la
// gagnante est celle qui a survécu le plus de manches (puis le plus de briques).
import { aiAvailable, chatJSON } from '../ai.js';

export const BOARD = {
  W: 1, H: 1.3, COLS: 7, R: 0.016,
  TOP: 0.06, CELL_H: 0.078, MAX_ROWS: 13, LAUNCH_Y: 1.22,
};
const CELL_W = BOARD.W / BOARD.COLS;
const SPEED = 0.02;
const SUBSTEPS = 2;      // la balle avance de 0,01 par contrôle : fiable vs briques de 0,14
const STAGGER = 9;       // pas entre deux lancers de balles de la même volée
const MAX_STEPS = 9000;  // garde-fou : une volée se termine toujours
const MAX_BALLS = 40;
const ROUND_CAP = 60;    // au-delà, la survivante est déclarée gagnante
const AFK_MS = 25000;    // absente / distraite : tir automatique tout droit

// Générateur pseudo-aléatoire déterministe (la même ligne de briques pour toutes).
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Nouvelle ligne du haut pour la manche `round` : briques (pv = numéro de
// manche, parfois double) et bonus « +1 balle ».
function newRow(seed, round) {
  const rng = mulberry32((seed * 9973 + round * 7919) | 0);
  const row = [];
  let bricks = 0;
  for (let c = 0; c < BOARD.COLS; c++) {
    const r = rng();
    if (r < 0.12) row.push({ ball: true });
    else if (r < 0.58) { row.push({ hp: rng() < 0.15 ? round * 2 : round }); bricks++; }
    else row.push(null);
  }
  if (!bricks) row[Math.floor(rng() * BOARD.COLS)] = { hp: round };
  return row;
}

const brickRect = (i, c) => ({
  x: c * CELL_W + 0.004,
  y: BOARD.TOP + i * BOARD.CELL_H + 0.004,
  w: CELL_W - 0.008,
  h: BOARD.CELL_H - 0.008,
});

// Simulation d'une volée complète (déterministe : le client rejoue la même pour
// l'animation). Mutations sur `grid`. Renvoie { newLaunchX, destroyed, gained }.
export function simulateVolley(grid, ballCount, launchX, dir, onStep) {
  const { W, R, LAUNCH_Y } = BOARD;
  const len = Math.sqrt(dir.dx * dir.dx + dir.dy * dir.dy) || 1;
  let ux = dir.dx / len, uy = dir.dy / len;
  if (uy > -0.12) { // jamais à l'horizontale : au minimum ~7° vers le haut
    uy = -0.12; const s = Math.sqrt(1 - uy * uy); ux = Math.sign(ux || 1) * s;
  }
  const balls = [];
  for (let k = 0; k < ballCount; k++) {
    balls.push({ x: launchX, y: LAUNCH_Y, vx: ux * SPEED, vy: uy * SPEED, wait: k * STAGGER, out: false });
  }
  let newLaunchX = null, destroyed = 0, gained = 0;

  for (let step = 0; step < MAX_STEPS; step++) {
    let alive = false;
    for (const b of balls) {
      if (b.out) continue;
      if (b.wait > 0) { b.wait--; alive = true; continue; }
      alive = true;
      for (let ss = 0; ss < SUBSTEPS; ss++) {
        b.x += b.vx / SUBSTEPS; b.y += b.vy / SUBSTEPS;
        if (b.x < R && b.vx < 0) { b.x = R; b.vx = -b.vx; }
        if (b.x > W - R && b.vx > 0) { b.x = W - R; b.vx = -b.vx; }
        if (b.y < R && b.vy < 0) { b.y = R; b.vy = -b.vy; }
        if (b.y > LAUNCH_Y + 0.02 && b.vy > 0) {
          b.out = true;
          if (newLaunchX === null) newLaunchX = Math.max(R, Math.min(W - R, b.x));
          break;
        }
        // briques voisines de la balle (au plus 4 cellules à contrôler)
        const ci = Math.floor((b.y - BOARD.TOP) / BOARD.CELL_H);
        const cc = Math.floor(b.x / CELL_W);
        for (let i = ci - 1; i <= ci + 1; i++) {
          if (i < 0 || i >= grid.length) continue;
          for (let c = cc - 1; c <= cc + 1; c++) {
            if (c < 0 || c >= BOARD.COLS) continue;
            const cell = grid[i][c];
            if (!cell) continue;
            const rct = brickRect(i, c);
            const nx = Math.max(rct.x, Math.min(b.x, rct.x + rct.w));
            const ny = Math.max(rct.y, Math.min(b.y, rct.y + rct.h));
            const dx = b.x - nx, dy = b.y - ny;
            const d2 = dx * dx + dy * dy;
            if (d2 >= R * R) continue;
            if (cell.ball) { grid[i][c] = null; gained++; continue; } // bonus : pas de rebond
            // rebond sur la brique + un point de vie en moins
            if (dx === 0 && dy === 0) { b.vy = -b.vy; }
            else if (Math.abs(dx) > Math.abs(dy)) {
              b.x = nx + Math.sign(dx) * R;
              if (Math.sign(b.vx) !== Math.sign(dx)) b.vx = -b.vx;
            } else {
              b.y = ny + Math.sign(dy) * R;
              if (Math.sign(b.vy) !== Math.sign(dy)) b.vy = -b.vy;
            }
            cell.hp -= 1;
            if (cell.hp <= 0) { grid[i][c] = null; destroyed++; }
          }
        }
      }
    }
    if (onStep) onStep(step, balls);
    if (!alive) break;
  }
  return { newLaunchX: newLaunchX ?? launchX, destroyed, gained };
}

export function createBounce() {
  return {
    type: 'bounce',
    phase: 'waiting', // waiting -> playing -> over
    seats: [],
    seed: Math.floor(Math.random() * 1e9),
    players: {}, // uid -> { grid, balls, launchX, round, alive, bricks, shotSeq, lastShot, roundSince }
    names: {},
    winners: null,
    log: [],
  };
}

export function joinBounce(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 6) state.seats.push(userId);
}

function freshPlayer(state) {
  return {
    grid: [newRow(state.seed, 1)],
    balls: 1,
    launchX: 0.5,
    round: 1,
    alive: true,
    bricks: 0,
    shotSeq: 0,
    lastShot: null,
    roundSince: Date.now(),
  };
}

export function startBounce(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut au moins 2 joueuses.');
  state.players = Object.fromEntries(state.seats.map((id) => [id, freshPlayer(state)]));
  state.winners = null;
  state.botSkill = null; state.aiTask = null; state.botAt = null;
  state.phase = 'playing';
  state.log = ['C\'est parti : cassez des briques, la dernière survivante gagne !'];
}

function pushLog(state, text) { state.log.push(text); if (state.log.length > 30) state.log = state.log.slice(-30); }
const nm = (state, id) => (state.names && state.names[id]) || 'quelqu\'un';

function maybeFinish(state) {
  const alive = state.seats.filter((id) => state.players[id].alive);
  if (alive.length > 0) return;
  state.phase = 'over';
  const best = Math.max(...state.seats.map((id) => state.players[id].round));
  const cands = state.seats.filter((id) => state.players[id].round === best);
  const bestBricks = Math.max(...cands.map((id) => state.players[id].bricks));
  state.winners = cands.filter((id) => state.players[id].bricks === bestBricks);
  pushLog(state, `Partie finie ! ${state.winners.map((id) => nm(state, id)).join(' et ')} gagne${state.winners.length > 1 ? 'nt' : ''} (manche ${best}).`);
}

export function shootBounce(state, userId, { dx, dy }) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  const p = state.players[userId];
  if (!p) throw new Error('Tu n\'es pas dans la partie.');
  if (!p.alive) throw new Error('Tu es éliminée — regarde les autres finir !');
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || dy >= 0) throw new Error('Vise vers le haut !');

  const before = { grid: p.grid.map((row) => row.map((c) => (c ? { ...c } : null))), launchX: p.launchX, balls: p.balls };
  const res = simulateVolley(p.grid, p.balls, p.launchX, { dx, dy });
  p.launchX = res.newLaunchX;
  p.bricks += res.destroyed;
  p.balls = Math.min(MAX_BALLS, p.balls + res.gained);
  p.shotSeq += 1;
  p.lastShot = { seq: p.shotSeq, dx, dy, from: before.launchX, balls: before.balls, grid: before.grid };

  // Les briques descendent, une nouvelle ligne apparaît en haut.
  p.round += 1;
  p.grid.unshift(newRow(state.seed, p.round));
  // Une brique au fond = éliminée. Les bonus qui touchent le fond disparaissent.
  let dead = false;
  for (let i = BOARD.MAX_ROWS; i < p.grid.length; i++) {
    if (p.grid[i].some((c) => c && c.hp)) dead = true;
  }
  p.grid.length = Math.min(p.grid.length, BOARD.MAX_ROWS + 1);
  if (dead) {
    p.alive = false;
    pushLog(state, `${nm(state, userId)} est submergée à la manche ${p.round - 1} (${p.bricks} briques cassées) !`);
    maybeFinish(state);
  } else if (p.round > ROUND_CAP) {
    p.alive = false;
    pushLog(state, `${nm(state, userId)} atteint la manche ${ROUND_CAP} — record !`);
    maybeFinish(state);
  }
  p.roundSince = Date.now();
}

// --- ChatGPT à Bounce ---------------------------------------------------------
const SKILLS = {
  mediocre:  { aim: 0.12, label: 'médiocre' },
  moyen:     { aim: 0.05, label: 'moyen' },
  bien:      { aim: 0.02, label: 'bien' },
  tres_bien: { aim: 0.006, label: 'très bien' },
};
const pickLocalSkill = () => {
  const r = Math.random();
  return r < 0.15 ? 'mediocre' : r < 0.5 ? 'moyen' : r < 0.85 ? 'bien' : 'tres_bien';
};

// Éventail d'angles simulés sur une copie du plateau : on garde les meilleurs.
function candidateShots(state) {
  const p = state.players.bot;
  const results = [];
  for (let deg = 20; deg <= 160; deg += 5) {
    const a = (deg * Math.PI) / 180;
    const dir = { dx: Math.cos(a), dy: -Math.sin(a) };
    const copy = p.grid.map((row) => row.map((c) => (c ? { ...c } : null)));
    const res = simulateVolley(copy, p.balls, p.launchX, dir);
    // Danger : points de vie restants dans les 4 rangées les plus basses.
    let danger = 0;
    for (let i = Math.max(0, copy.length - 4); i < copy.length; i++) {
      for (const c of copy[i]) if (c && c.hp) danger += Math.min(c.hp, 10);
    }
    results.push({ dir, score: res.destroyed * 2 + res.gained * 3 - danger * 0.4, destroyed: res.destroyed, gained: res.gained, deg });
  }
  results.sort((a, b) => b.score - a.score);
  const kept = [];
  for (const r of results) {
    if (kept.length >= 4) break;
    if (kept.some((k) => Math.abs(k.deg - r.deg) < 15)) continue;
    kept.push(r);
  }
  const zone = (deg) => (deg < 70 ? 'vers la droite' : deg > 110 ? 'vers la gauche' : 'au centre');
  return {
    options: kept.map((r) => `Tirer ${zone(r.deg)} : ~${r.destroyed} brique(s) cassée(s)${r.gained ? `, +${r.gained} balle(s)` : ''}`),
    moves: kept.map((r) => r.dir),
    situation: `Manche ${p.round}, ${p.balls} balle(s) par volée, ${p.bricks} briques cassées. Adversaires encore en vie : ${state.seats.filter((id) => id !== 'bot' && state.players[id].alive).map((id) => nm(state, id)).join(', ') || 'aucune'}.`,
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
  const sys = 'Tu joues à Bounce (casse-briques à volées de balles) contre des joueuses humaines. Survis le plus de manches possible. '
    + (askLevel
      ? 'Commence par choisir ton niveau de jeu pour TOUTE cette partie, selon ton humeur : "mediocre", "moyen", "bien" ou "tres_bien". '
      : `Tu joues à un niveau ${SKILLS[state.botSkill].label} pour cette partie : reste cohérente. `)
    + 'Choisis un des tirs simulés, comme une joueuse humaine sensée (casser beaucoup, ramasser des balles, éviter d\'être submergée). '
    + `Réponds UNIQUEMENT en JSON : {"choix": <numéro>${askLevel ? ', "niveau": "mediocre|moyen|bien|tres_bien"' : ''}}.`;
  chatJSON(sys, { situation: built.situation, options: built.options.map((o, i) => `${i}. ${o}`) }, { timeoutMs: 6500 })
    .then((out) => {
      task.status = 'done';
      task.result = out ? { choix: Math.round(Number(out.choix)), niveau: String(out.niveau || '') } : null;
    })
    .catch(() => { task.status = 'done'; task.result = null; });
  return 'wait';
}

export function tickBounce(state) {
  if (state.phase !== 'playing') return false;
  let changed = false;

  // ChatGPT : réfléchit quelques secondes puis tire (angle bruité selon niveau).
  const bot = state.players.bot;
  if (bot && bot.alive) {
    if (!state.botAt) state.botAt = Date.now() + 3000 + Math.random() * 4000;
    if (Date.now() >= state.botAt) {
      const picked = botChoose(state, () => candidateShots(state));
      if (picked !== 'wait') {
        let dir = picked;
        if (!dir) {
          if (!state.botSkill) state.botSkill = pickLocalSkill();
          const built = candidateShots(state);
          dir = built.moves[0];
        }
        if (dir) {
          const sk = SKILLS[state.botSkill] || SKILLS.moyen;
          const a = Math.atan2(dir.dy, dir.dx) + (Math.random() * 2 - 1) * sk.aim;
          shootBounce(state, 'bot', { dx: Math.cos(a), dy: Math.min(-0.12, Math.sin(a)) });
          state.botAt = Date.now() + 3500 + Math.random() * 4500;
          changed = true;
        }
      }
    }
  }

  // Joueuses absentes ou bloquées : tir automatique pour ne pas geler la partie.
  for (const id of state.seats) {
    if (id === 'bot') continue;
    const p = state.players[id];
    if (!p.alive) continue;
    const away = state.offline && state.offline[id];
    const idleMs = Date.now() - (p.roundSince || 0);
    if ((away && idleMs > 15000) || idleMs > AFK_MS) {
      shootBounce(state, id, { dx: (Math.random() - 0.5) * 0.6, dy: -1 });
      changed = true;
    }
  }
  return changed;
}

export function viewFor(state, userId) {
  const mine = state.players[userId] || null;
  return {
    type: 'bounce',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    me: mine && {
      grid: mine.grid, balls: mine.balls, launchX: mine.launchX, round: mine.round,
      alive: mine.alive, bricks: mine.bricks, lastShot: mine.lastShot,
    },
    others: Object.fromEntries(state.seats.filter((id) => id !== userId).map((id) => {
      const p = state.players[id] || {};
      return [id, { grid: p.grid || [], round: p.round || 1, alive: p.alive !== false, bricks: p.bricks || 0, balls: p.balls || 1 }];
    })),
    winners: state.winners,
    log: state.log.slice(-6),
  };
}
