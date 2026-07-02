// Moteur de Flip 7 (press-your-luck), logique pure. Cartes face visible (info ouverte).
// Tour : Tirer (hit) ou Rester (stay). Doublon de nombre = bust (sauf Second Chance).
// 7 nombres uniques = Flip 7 (+15, fin de manche immédiate). Premier à 200 points gagne.
//
// Deck officiel = 94 cartes :
//   - Nombres (79) : un 0, un 1, deux 2, ... douze 12 (le chiffre = nb d'exemplaires).
//   - Modificateurs (6) : +2, +4, +6, +8, +10 (un chacun) et ×2.
//   - Actions (9) : 3 Freeze, 3 Flip Three, 3 Second Chance.
// Score : (somme des nombres) ×2 si ×2, PUIS + bonus (+N), PUIS +15 si Flip 7.

const TARGET = 200;
const ROUNDOVER_MS = 5000;
const OFFLINE_SKIP_MS = 10000; // une joueuse absente joue automatiquement après 10 s
const isOffline = (s, id) => !!(s.offline && s.offline[id]);

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function buildDeck() {
  const deck = [];
  let id = 0;
  for (let v = 0; v <= 12; v++) {
    const count = v === 0 ? 1 : v;
    for (let i = 0; i < count; i++) deck.push({ id: id++, kind: 'number', value: v });
  }
  for (const val of [2, 4, 6, 8, 10]) deck.push({ id: id++, kind: 'mod', op: 'add', val });
  deck.push({ id: id++, kind: 'mod', op: 'mult', val: 2 });
  for (let i = 0; i < 3; i++) deck.push({ id: id++, kind: 'action', action: 'freeze' });
  for (let i = 0; i < 3; i++) deck.push({ id: id++, kind: 'action', action: 'flip3' });
  for (let i = 0; i < 3; i++) deck.push({ id: id++, kind: 'action', action: 'second' });
  return deck;
}

export function createFlip7() {
  return {
    type: 'flip7', phase: 'waiting', // waiting -> playing -> roundover -> over
    seats: [], scores: {}, starter: 0,
    deck: [], discard: [], round: null,
    nextRoundAt: null,
    target: TARGET, winner: null, log: [],
  };
}

export function joinFlip7(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 8) { state.seats.push(userId); state.scores[userId] = 0; }
}

function newLine() { return { numbers: [], mods: [], actions: [], drawn: [], second: false, busted: false, bustCard: null, stayed: false, frozen: false, flip7: false }; }

// La pile est PERSISTANTE entre les manches : on ne remélange pas à chaque
// manche, on continue de piocher dans le même paquet. Quand il est épuisé,
// la défausse est remélangée automatiquement (dans drawCard).
function beginRound(state) {
  if (state.deck.length === 0 && state.discard.length === 0) state.deck = shuffle(buildDeck());
  state.nextRoundAt = null;
  const lines = {};
  for (const id of state.seats) lines[id] = newLine();
  state.round = {
    lines,
    active: [...state.seats],
    turn: state.seats[state.starter % state.seats.length],
    // File d'actions interactives à résoudre (Freeze / Flip Three / Second Chance à donner).
    // Chaque entrée : { type, by }. C'est `by` qui choisit la cible.
    pending: [],
    since: Date.now(), // début de l'attente courante (tour ou action à résoudre)
    flip7Ended: false,
    results: null,
  };
  state.phase = 'playing';
}

export function startFlip7(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut au moins 2 joueurs.');
  beginRound(state);
  state.log.push('La partie commence !');
}

function drawCard(state) {
  if (state.deck.length === 0) { state.deck = shuffle(state.discard); state.discard = []; }
  return state.deck.pop();
}

function removeActive(state, id) { state.round.active = state.round.active.filter((x) => x !== id); }

function nextActive(state, fromId) {
  const seats = state.seats; const n = seats.length;
  const i = seats.indexOf(fromId);
  for (let k = 1; k <= n; k++) { const id = seats[(i + k) % n]; if (state.round.active.includes(id)) return id; }
  return null;
}

// Applique une carte tirée à la ligne d'un joueur. Les actions interactives
// (Freeze, Flip Three, Second Chance à donner) sont empilées dans `pending`
// et résolues plus tard — y compris quand la carte est tirée via un Flip Three.
function applyCard(state, owner, card) {
  const line = state.round.lines[owner];
  if (card.kind === 'number') {
    if (line.numbers.includes(card.value)) {
      if (line.second) {
        line.second = false; state.discard.push(card);
        state.log.push('Doublon évité grâce à Second Chance.');
      } else {
        line.busted = true; line.bustCard = card; removeActive(state, owner); state.discard.push(card);
        state.log.push(`Perdu ! Doublon de ${card.value}.`);
      }
    } else {
      line.numbers.push(card.value);
      line.drawn.push(card); // carte gardée en ligne : ira à la défausse en fin de manche
      if (line.numbers.length === 7) {
        line.flip7 = true; state.round.flip7Ended = true;
        state.log.push('FLIP 7 ! +15 et fin de manche.');
      }
    }
  } else if (card.kind === 'mod') {
    line.mods.push(card);
    line.drawn.push(card);
  } else if (card.kind === 'action') {
    // Les cartes action sont consommées : elles partent tout de suite à la défausse
    // (l'effet est mémorisé dans la ligne / la file pending).
    state.discard.push(card);
    if (card.action === 'second') {
      if (!line.second) line.second = true; // un second exemplaire est simplement défaussé
    } else if (card.action === 'freeze') {
      state.round.pending.push({ type: 'freeze', by: owner });
    } else if (card.action === 'flip3') {
      state.round.pending.push({ type: 'flip3', by: owner });
    }
  }
}

// Cibles valides pour une action en attente (même logique côté serveur et vue).
function pendingTargets(state, pa) {
  const r = state.round;
  return r.active.slice(); // freeze / flip3 : n'importe quel joueur encore actif (soi compris)
}

// Retire en tête de file les actions devenues impossibles (plus aucune cible),
// p.ex. un Freeze tiré pendant un Flip Three par un joueur qui bust ensuite.
function dropDeadPending(state) {
  while (state.round.pending.length && pendingTargets(state, state.round.pending[0]).length === 0) {
    const dead = state.round.pending.shift();
    state.log.push(`Action « ${dead.type} » sans cible : annulée.`);
  }
}

export function hitFlip7(state, userId) {
  if (state.phase !== 'playing') throw new Error('Pas en cours.');
  if (state.round.pending.length) throw new Error('Une action est en attente.');
  if (state.round.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  applyCard(state, userId, drawCard(state));
  if (state.round.flip7Ended) { endRound(state); return; }
  dropDeadPending(state);
  if (state.round.pending.length) { state.round.since = Date.now(); return; } // on attend la résolution d'une action
  advance(state);
}

export function stayFlip7(state, userId) {
  if (state.phase !== 'playing') throw new Error('Pas en cours.');
  if (state.round.pending.length) throw new Error('Une action est en attente.');
  if (state.round.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  state.round.lines[userId].stayed = true;
  removeActive(state, userId);
  advance(state);
}

export function resolveAction(state, userId, targetId) {
  if (state.phase !== 'playing') throw new Error('Pas en cours.');
  const pa = state.round.pending[0];
  if (!pa || pa.by !== userId) throw new Error('Pas d\'action à résoudre.');

  if (pa.type === 'freeze') {
    if (!state.round.active.includes(targetId)) throw new Error('Cible invalide.');
    const l = state.round.lines[targetId];
    l.frozen = true; l.stayed = true;
    l.actions.push({ kind: 'action', action: 'freeze' });
    removeActive(state, targetId);
    state.round.pending.shift();
    state.log.push('Stop : un joueur est stoppé, ses points sont mis en banque.');
  } else if (pa.type === 'flip3') {
    if (!state.round.active.includes(targetId)) throw new Error('Cible invalide.');
    state.round.pending.shift();
    state.round.lines[targetId].actions.push({ kind: 'action', action: 'flip3' });
    state.log.push('Pioche 3 : 3 cartes forcées !');
    for (let i = 0; i < 3; i++) {
      if (!state.round.active.includes(targetId)) break; // bust ou gelé en cours de route
      if (state.round.flip7Ended) break;
      applyCard(state, targetId, drawCard(state)); // actions tirées => empilées dans pending
    }
  }

  if (state.round.flip7Ended) { endRound(state); return; }
  dropDeadPending(state);
  if (state.round.pending.length) { state.round.since = Date.now(); return; } // d'autres actions restent à résoudre
  advance(state);
}

function advance(state) {
  if (state.round.flip7Ended || state.round.active.length === 0) { endRound(state); return; }
  const nxt = nextActive(state, state.round.turn);
  if (!nxt) { endRound(state); return; }
  state.round.turn = nxt;
  state.round.since = Date.now();
}

function scoreLine(line) {
  if (line.busted) return 0;
  const numSum = line.numbers.reduce((a, n) => a + n, 0);
  const x2 = line.mods.some((m) => m.op === 'mult');
  const addSum = line.mods.filter((m) => m.op === 'add').reduce((a, m) => a + m.val, 0);
  return numSum * (x2 ? 2 : 1) + addSum + (line.flip7 ? 15 : 0);
}

function endRound(state) {
  const results = {};
  for (const id of state.seats) {
    const line = state.round.lines[id];
    const pts = scoreLine(line);
    results[id] = pts;
    state.scores[id] += pts;
    state.discard.push(...line.drawn);
  }
  state.round.results = results;
  state.starter = (state.starter + 1) % state.seats.length;

  const leader = state.seats.reduce((b, id) => (state.scores[id] > state.scores[b] ? id : b), state.seats[0]);
  if (state.scores[leader] >= state.target) {
    state.phase = 'over';
    state.winner = leader;
    state.log.push('Fin de partie !');
  } else {
    state.phase = 'roundover';
    state.nextRoundAt = Date.now() + ROUNDOVER_MS;
    state.log.push('Fin de manche.');
  }
}

export function nextRound(state, userId) {
  if (state.phase !== 'roundover') throw new Error('Pas en fin de manche.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  beginRound(state);
}

export function tickFlip7(state) {
  if (state.phase === 'roundover') {
    if (!state.nextRoundAt) { state.nextRoundAt = Date.now() + ROUNDOVER_MS; return true; }
    if (Date.now() < state.nextRoundAt) return false;
    beginRound(state);
    return true;
  }
  // En manche : auto-play après 10 s si la personne attendue est absente.
  if (state.phase !== 'playing' || !state.round) return false;
  const r = state.round;
  if (!r.since || Date.now() - r.since < OFFLINE_SKIP_MS) return false;
  if (r.pending.length) {
    const pa = r.pending[0];
    if (!isOffline(state, pa.by)) return false;
    resolveAction(state, pa.by, pa.by); // l'absente se cible elle-même (toujours valide)
    return true;
  }
  if (r.turn && isOffline(state, r.turn)) {
    stayFlip7(state, r.turn); // choix sûr : on banque les points et on sort de la manche
    return true;
  }
  return false;
}

export function viewFor(state, userId) {
  const r = state.round;
  const players = state.seats.map((id) => {
    const line = r ? r.lines[id] : null;
    return {
      id,
      score: state.scores[id] || 0,
      active: r ? r.active.includes(id) : false,
      line: line ? {
        numbers: line.numbers, mods: line.mods, actions: line.actions, second: line.second,
        busted: line.busted, bustCard: line.bustCard, stayed: line.stayed, frozen: line.frozen, flip7: line.flip7,
        current: scoreLine(line),
      } : null,
      roundResult: r && r.results ? r.results[id] : null,
    };
  });
  const pending = r ? r.pending : [];
  const pa = pending[0] || null;
  const targets = pa ? pendingTargets(state, pa) : [];
  return {
    type: 'flip7',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    players,
    turn: r ? r.turn : null,
    isMyTurn: !!r && !pending.length && r.turn === userId,
    pendingAction: pa,
    iResolve: pa ? pa.by === userId : false,
    targets,
    deckCount: state.deck.length,
    nextRoundAt: state.phase === 'roundover' ? state.nextRoundAt : null,
    target: state.target,
    winner: state.winner,
    log: state.log.slice(-8),
  };
}
