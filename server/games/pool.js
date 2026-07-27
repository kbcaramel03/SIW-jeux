// Moteur de Billard (8-ball façon Plato), logique pure + physique 2D.
import { aiAvailable, chatJSON } from '../ai.js';
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
// Sous-pas de simulation : à pleine puissance une bille avançait de 0,038 par
// pas (1,5× son rayon !) — les chocs étaient détectés trop tard et la
// trajectoire réelle ne suivait pas la flèche de visée. Avec 8 sous-pas, le
// déplacement max par contrôle de collision est ~0,18 rayon : le point de
// contact (et donc la direction prise par la bille touchée) devient fidèle.
const SUBSTEPS = 8;
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
export function simulate(balls, shot, onStep, maxSteps = MAX_STEPS) {
  const { R, W, H, POCKET_R } = TABLE;
  const cue = balls.find((b) => b.id === 0);
  const len = Math.sqrt(shot.dx * shot.dx + shot.dy * shot.dy) || 1;
  const speed = 0.008 + Math.max(0, Math.min(1, shot.power)) * 0.030;
  cue.vx = (shot.dx / len) * speed;
  cue.vy = (shot.dy / len) * speed;
  const potted = [];

  for (let step = 0; step < maxSteps; step++) {
    let moving = false;
    for (let ss = 0; ss < SUBSTEPS; ss++) {
      for (const b of balls) {
        if (b.pocketed) continue;
        b.x += b.vx / SUBSTEPS; b.y += b.vy / SUBSTEPS;

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
    }

    // Frottements et arrêt : une fois par pas plein (le rythme du jeu ne change pas)
    for (const b of balls) {
      if (b.pocketed) continue;
      b.vx *= FRICTION; b.vy *= FRICTION;
      if (Math.sqrt(b.vx * b.vx + b.vy * b.vy) < STOP) { b.vx = 0; b.vy = 0; } else moving = true;
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
  state.botSkill = null; state.aiTask = null; state.botPlan = null; state.botAim = null;
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

// --- ChatGPT au billard -------------------------------------------------------
const POCKET_FR = ['en haut à gauche', 'en haut au milieu', 'en haut à droite',
  'en bas à gauche', 'en bas au milieu', 'en bas à droite'];

// Niveaux de jeu : ChatGPT en choisit UN pour toute la partie (comme une vraie
// joueuse d'humeur variable). L'erreur d'exécution (angle, puissance) en découle.
export const SKILLS = {
  mediocre:  { aim: 0.050, pow: 0.25, label: 'médiocre' },   // ~±3° : ça rate souvent
  moyen:     { aim: 0.022, pow: 0.14, label: 'moyen' },      // ~±1,3°
  bien:      { aim: 0.010, pow: 0.08, label: 'bien' },       // ~±0,6° : les coups nets rentrent
  tres_bien: { aim: 0.004, pow: 0.04, label: 'très bien' },  // ~±0,2° : presque pro
};
const pickLocalSkill = () => {
  const r = Math.random();
  return r < 0.15 ? 'mediocre' : r < 0.5 ? 'moyen' : r < 0.85 ? 'bien' : 'tres_bien';
};

// Un couloir est-il libre entre deux points (aucune autre bille à moins de 2R
// du segment) ? Pré-filtre géométrique : on ne simule que les coups plausibles.
function pathClear(balls, x0, y0, x1, y1, ignore) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len, uy = dy / len;
  const rr = (2 * TABLE.R) * (2 * TABLE.R);
  for (const b of balls) {
    if (b.pocketed || ignore.includes(b.id)) continue;
    const cx = b.x - x0, cy = b.y - y0;
    const proj = cx * ux + cy * uy;
    if (proj <= 0 || proj >= len) continue;
    if (cx * cx + cy * cy - proj * proj < rr) return false;
  }
  return true;
}

// Coups jouables calculés localement (géométrie + simulation), décrits pour
// ChatGPT et triés du plus facile au plus difficile. Jamais de tir au hasard :
// soit un empochage vérifié par simulation, soit un coup de placement doux.
function candidateShots(state) {
  const balls = state.balls;
  const cue = balls.find((b) => b.id === 0);
  const myGroup = state.groups.bot || null;
  const cleared = myGroup && remainingOf(state, myGroup) === 0;
  const targets = balls
    .filter((b) => !b.pocketed && b.id !== 0)
    .filter((b) => (cleared ? b.id === 8 : myGroup ? group(b.id) === myGroup : b.id !== 8))
    .sort((a, b) => ((a.x - cue.x) ** 2 + (a.y - cue.y) ** 2) - ((b.x - cue.x) ** 2 + (b.y - cue.y) ** 2))
    .slice(0, 5);
  const found = [];
  for (const t of targets) {
    POCKETS.forEach((pk, pi) => {
      if (found.length >= 8) return;
      const dxp = pk[0] - t.x, dyp = pk[1] - t.y;
      const dp = Math.sqrt(dxp * dxp + dyp * dyp) || 1;
      const gx = t.x - (dxp / dp) * 2 * TABLE.R, gy = t.y - (dyp / dp) * 2 * TABLE.R;
      const adx = gx - cue.x, ady = gy - cue.y;
      const ad = Math.sqrt(adx * adx + ady * ady) || 1;
      // Angle de coupe : la blanche doit pousser la bille VERS la poche.
      const cosCut = (adx * dxp + ady * dyp) / (ad * dp);
      if (cosCut < 0.15) return; // coupe > ~81° : injouable, on ne simule même pas
      // Couloirs bouchés (blanche->bille ou bille->poche) : pas la peine de simuler.
      if (!pathClear(balls, cue.x, cue.y, gx, gy, [0, t.id])) return;
      if (!pathClear(balls, t.x, t.y, pk[0], pk[1], [0, t.id])) return;
      // Puissance minimale qui rentre (les humaines ne défoncent pas tout).
      for (const power of [0.45, 0.7, 1]) {
        const sim = balls.map((b) => ({ ...b }));
        const potted = simulate(sim, { dx: adx, dy: ady, power }, null, 2000);
        if (potted.includes(0)) continue;             // blanche : jamais proposé
        if (potted.includes(8) && !cleared) continue; // noire trop tôt : jamais proposé
        if (!potted.includes(t.id)) continue;         // le coup ne rentre pas
        const score = (ad + dp) + (1 - cosCut) * 1.5; // court et droit = facile
        const diff = score < 0.9 ? 'facile' : score < 1.6 ? 'moyen' : 'difficile';
        found.push({
          text: `Empocher la bille ${t.id} dans la poche ${POCKET_FR[pi]} (coup ${diff})`,
          move: { dx: adx, dy: ady, power, sure: true },
          score,
        });
        break;
      }
    });
    if (found.length >= 8) break;
  }
  found.sort((a, b) => a.score - b.score);
  const options = found.map((f) => f.text);
  const moves = found.map((f) => f.move);
  // Coup de placement : rapprocher doucement sa bille la plus proche de SA
  // poche la plus proche (utile quand rien ne rentre, jamais un tir au hasard).
  const t0 = targets[0] || balls.find((b) => !b.pocketed && b.id !== 0);
  if (t0) {
    let bp = POCKETS[0]; let bd = Infinity;
    for (const pk of POCKETS) {
      const d = (pk[0] - t0.x) ** 2 + (pk[1] - t0.y) ** 2;
      if (d < bd) { bd = d; bp = pk; }
    }
    const dpp = Math.sqrt(bd) || 1;
    const gx = t0.x - ((bp[0] - t0.x) / dpp) * 2 * TABLE.R, gy = t0.y - ((bp[1] - t0.y) / dpp) * 2 * TABLE.R;
    const adx = gx - cue.x, ady = gy - cue.y;
    const ad = Math.sqrt(adx * adx + ady * ady) || 1;
    // Si la coupe vers la poche est impossible, pousser simplement la bille.
    const cosCut = (adx * (bp[0] - t0.x) + ady * (bp[1] - t0.y)) / (ad * dpp);
    const aim = cosCut > 0.15 ? { dx: adx, dy: ady } : { dx: t0.x - cue.x, dy: t0.y - cue.y };
    options.push(`Coup de placement : pousser doucement la bille ${t0.id} vers une poche, sans risque`);
    moves.push({ ...aim, power: Math.max(0.25, Math.min(0.5, ad * 0.45)), sure: false });
  }
  return {
    rules: `Tu joues les ${myGroup === 'stripe' ? 'rayées (9-15)' : myGroup === 'solid' ? 'pleines (1-7)' : 'billes (groupe pas encore attribué)'}${cleared ? ' — ton groupe est vidé : empocher la NOIRE (8) fait gagner' : ''}. Empocher une des tiennes te fait rejouer.`,
    situation: `Il te reste ${cleared ? 'la noire (8)' : targets.map((t) => t.id).join(', ') || 'aucune bille directe'}. `
      + `${found.length ? `${found.length} empochage(s) possible(s), listés du plus facile au plus difficile.` : 'Aucun empochage direct : le placement est le coup raisonnable.'} `
      + `Adversaire : ${state.seats.filter((id) => id !== 'bot').map((id) => nm(state, id)).join(', ')}.`,
    options, moves,
  };
}

// Choix du coup par ChatGPT (asynchrone, façon aiTurn mais spécifique billard :
// au premier tour de la partie, il choisit AUSSI son niveau de jeu et s'y tient).
// Renvoie 'wait', null (API absente/en panne -> heuristique locale) ou un move.
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
  const sys = 'Tu joues au Billard 8-ball contre une joueuse humaine. ' + built.rules + ' '
    + (askLevel
      ? 'Commence par choisir ton niveau de jeu pour TOUTE cette partie, comme une vraie joueuse selon ton humeur du jour : "mediocre", "moyen", "bien" ou "tres_bien". '
      : `Tu as choisi de jouer à un niveau ${SKILLS[state.botSkill].label} pour cette partie : reste cohérente avec ce niveau. `)
    + 'Joue comme une joueuse humaine SENSÉE, jamais au hasard : privilégie les empochages faciles ; un niveau faible évite les coups difficiles et se rabat sur le placement, un bon niveau ose davantage. '
    + `Réponds UNIQUEMENT en JSON : {"choix": <numéro de l'option>${askLevel ? ', "niveau": "mediocre|moyen|bien|tres_bien"' : ''}}.`;
  chatJSON(sys, { situation: built.situation, options: built.options.map((o, i) => `${i}. ${o}`) }, { timeoutMs: 6500 })
    .then((out) => {
      task.status = 'done';
      task.result = out ? { choix: Math.round(Number(out.choix)), niveau: String(out.niveau || '') } : null;
    })
    .catch(() => { task.status = 'done'; task.result = null; });
  return 'wait';
}

// La visée « humaine » : une série d'orientations qui convergent vers le coup
// final (les adversaires la voient bouger), puis un tir dont l'imprécision
// dépend du niveau choisi par ChatGPT pour la partie.
function planBotShot(state, shot) {
  const sk = SKILLS[state.botSkill] || SKILLS.moyen;
  const finalA = Math.atan2(shot.dy, shot.dx);
  const steps = [];
  const n = 2 + Math.floor(Math.random() * 2); // 2 à 3 ajustements visibles
  const startOff = (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.3);
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const a = finalA + startOff * (1 - k) + (Math.random() - 0.5) * 0.05 * (1 - k);
    steps.push({ dx: Math.cos(a), dy: Math.sin(a), power: shot.power * (0.25 + 0.75 * k) });
  }
  // Erreur d'exécution proportionnelle au niveau : un très bon niveau rentre
  // presque tout, un niveau médiocre tremble.
  const a = finalA + (Math.random() * 2 - 1) * sk.aim;
  const power = Math.max(0.2, Math.min(1, shot.power * (1 + (Math.random() * 2 - 1) * sk.pow)));
  state.botPlan = {
    steps, i: 0, at: Date.now() + 500,
    final: { dx: Math.cos(a), dy: Math.sin(a), power },
  };
}

// Horloge serveur : ChatGPT (siège bot) vise sous vos yeux puis tire ;
// une absente déconnectée tire doucement vers la bille la plus proche.
export function tickPool(state) {
  if (state.phase !== 'playing' || !state.turn) return false;

  if (state.turn === 'bot') {
    // Déroulé de la visée visible, puis tir.
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
      shootPool(state, 'bot', shot);
      return true;
    }
    // Temps de réflexion humain (variable), puis choix du coup via ChatGPT
    // (qui choisit aussi son niveau de jeu au premier tour de la partie).
    const wait = 800 + (state.turnSince % 1400);
    if (!state.turnSince || Date.now() - state.turnSince < wait) return false;
    const picked = botChoose(state, () => candidateShots(state));
    if (picked === 'wait') return false;
    let shot = picked;
    if (!shot) {
      // Secours local (API indisponible) : niveau tiré au sort une fois pour
      // la partie, puis coup le plus facile — jamais de tir au hasard.
      if (!state.botSkill) state.botSkill = pickLocalSkill();
      const built = candidateShots(state);
      const sure = built.moves.filter((m) => m.sure);
      // Un niveau faible se rabat parfois sur le placement même quand ça rentre.
      const timid = state.botSkill === 'mediocre' && Math.random() < 0.4;
      shot = (!timid && sure[0]) || built.moves[built.moves.length - 1];
    }
    if (!shot) return false;
    planBotShot(state, shot);
    return false;
  }

  if (!isOffline(state, state.turn)) return false;
  if (!state.turnSince || Date.now() - state.turnSince < OFFLINE_SKIP_MS) return false;
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
    botAim: state.turn === 'bot' ? state.botAim || null : null,
    remaining: {
      solid: state.balls.filter((b) => !b.pocketed && group(b.id) === 'solid').map((b) => b.id),
      stripe: state.balls.filter((b) => !b.pocketed && group(b.id) === 'stripe').map((b) => b.id),
      eight: !state.balls.find((b) => b.id === 8).pocketed,
    },
    winner: state.winner,
    log: state.log.slice(-6),
  };
}
