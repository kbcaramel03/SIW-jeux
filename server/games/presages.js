// Présages (Spiral Éditions, Maxime Rambourg) — jeu de défausse en équipes,
// sans communication. 35 cartes Arcane (1-29 en 4 couleurs + les Absolus
// 30-35). Chaque tour, chacune joue une carte : la plus forte remporte le pli
// et est DÉFAUSSÉE, les autres reviennent en main… sauf si leur condition
// « Défaussez cette carte si… » se déclenche (effets sablier, résolus en fin
// de tour). Certains effets éclair s'appliquent dès que la carte est jouée.
// Une équipe gagne la manche dès qu'une de ses joueuses n'a plus qu'une carte
// (ou zéro) en fin de tour ; 2 manches gagnées = partie. Les équipes viennent
// des Absolus distribués face visible : le plus fort avec le plus faible.
import { aiTurn } from '../ai.js';

export const COLORS = ['jaune', 'vert', 'rouge', 'bleu'];
const colorOfVal = (v) => COLORS[(v - 1) % 4];

// Les 35 cartes. Effets sablier (fin de tour) : colorIn (défaussée si cette
// couleur est en jeu), alone (défaussée si seule de sa couleur), discardTop /
// discardLow (défausse la plus forte / faible de cette couleur en jeu),
// discardLowest (défausse la plus faible du tour), noWin (ne peut pas
// remporter), chain (si défaussée, défausse une autre carte de ta main),
// topLoses (la plus forte du tour ne remporte pas). Effets éclair (immédiats) :
// leftLeads (ta voisine de gauche mènera le prochain tour), mustHigher /
// mustLower (les suivantes jouent plus fort / faible si possible), reveal
// (révèle ta plus forte carte en main).
export const CARDS = {};
function def(v, effect, text) { CARDS[v] = { v, color: v <= 29 ? colorOfVal(v) : null, effect, text }; }
def(1, { alone: true }, 'Défaussée si c\'est la seule carte de sa couleur en jeu.');
def(2, { colorIn: 'rouge' }, 'Défaussée si une carte rouge est en jeu.');
def(3, { discardLow: 'vert' }, 'Défausse la carte verte la plus faible en jeu.');
def(4, { colorIn: 'jaune' }, 'Défaussée si une carte jaune est en jeu.');
def(5, { chain: true }, 'Si elle est défaussée, défausse aussi une carte au hasard de ta main.');
def(6, { alone: true }, 'Défaussée si c\'est la seule carte de sa couleur en jeu.');
def(7, { discardTop: 'bleu' }, 'Défausse la carte bleue la plus forte en jeu.');
def(8, { colorIn: 'vert' }, 'Défaussée si une carte verte est en jeu.');
def(9, { noWin: true }, 'Ne peut pas remporter le pli.');
def(10, { leftLeads: true }, '⚡ Ta voisine de gauche mènera le prochain tour.');
def(11, { colorIn: 'bleu' }, 'Défaussée si une carte bleue est en jeu.');
def(12, { discardLow: 'jaune' }, 'Défausse la carte jaune la plus faible en jeu.');
def(13, { alone: true }, 'Défaussée si c\'est la seule carte de sa couleur en jeu.');
def(14, {}, 'Aucun effet : solide et fiable.');
def(15, { topLoses: true }, 'La carte la plus forte du tour ne remporte pas le pli.');
def(16, { colorIn: 'rouge' }, 'Défaussée si une carte rouge est en jeu.');
def(17, { reveal: true }, '⚡ Révèle à toutes ta carte la plus forte en main.');
def(18, { discardLow: 'rouge' }, 'Défausse la carte rouge la plus faible en jeu.');
def(19, { alone: true }, 'Défaussée si c\'est la seule carte de sa couleur en jeu.');
def(20, { mustHigher: true }, '⚡ Les suivantes doivent jouer plus fort que 20, si possible.');
def(21, { colorIn: 'vert' }, 'Défaussée si une carte verte est en jeu.');
def(22, { chain: true }, 'Si elle est défaussée, défausse aussi une carte au hasard de ta main.');
def(23, { noWin: true }, 'Ne peut pas remporter le pli.');
def(24, { discardTop: 'vert' }, 'Défausse la carte verte la plus forte en jeu.');
def(25, { discardLowest: true }, 'Défausse la carte la plus faible du tour.');
def(26, { mustLower: true }, '⚡ Les suivantes doivent jouer plus faible que 26, si possible.');
def(27, { topLoses: true }, 'La carte la plus forte du tour ne remporte pas le pli.');
def(28, { reveal: true }, '⚡ Révèle à toutes ta carte la plus forte en main.');
def(29, { discardTop: 'rouge' }, 'Défausse la carte rouge la plus forte en jeu.');
for (let v = 30; v <= 35; v++) def(v, {}, 'L\'Absolu — pure puissance, aucun effet.');

const MANCHE_BREAK_MS = 4500;
const IDLE_MS = 30000;
const nm = (state, id) => (state.names && state.names[id]) || 'quelqu\'un';
const isOffline = (s, id) => !!(s.offline && s.offline[id]);
function pushLog(state, text) { state.log.push(text); if (state.log.length > 40) state.log = state.log.slice(-40); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function createPresages() {
  return {
    type: 'presages',
    phase: 'waiting', // waiting -> playing -> over
    seats: [],
    teams: [],       // [[uid, uid], ...]
    absolus: {},     // uid -> 30..35 (visible de toutes)
    hands: {},       // uid -> [valeurs]
    played: [],      // [{ by, card }] dans l'ordre du tour
    leader: null,
    turn: null,
    turnSince: null,
    constraint: null, // { dir: 'up'|'down', val, by }
    nextLeader: null,
    manche: 1,
    wins: [],         // victoires de manche par équipe
    mancheEnd: null,  // { team, until }
    lastTrick: null,  // { cards: [{by, card, discarded}], winnerBy } pour l'affichage
    names: {},
    winners: null,
    log: [],
  };
}

export function joinPresages(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 6) state.seats.push(userId);
}

const teamOf = (state, uid) => state.teams.findIndex((t) => t.includes(uid));

function deal(state) {
  // Arcanes 1-29 mélangées ; chaque main = son Absolu + des arcanes.
  const deck = shuffle(Array.from({ length: 29 }, (_, i) => i + 1));
  state.hands = {};
  for (const id of state.seats) {
    const teamSize = state.teams[teamOf(state, id)].length;
    // Une équipe plus nombreuse reçoit une carte de plus (règle officielle) :
    // avoir moins de cartes rapproche de la victoire.
    const arcanes = state.seats.length === 4 ? 4 : teamSize >= 3 ? 4 : 3;
    state.hands[id] = [state.absolus[id], ...deck.splice(0, arcanes)];
  }
  state.played = [];
  state.constraint = null;
  state.nextLeader = null;
  state.lastTrick = null;
  // La détentrice de l'Absolu le plus fort mène le premier tour de la manche.
  state.leader = state.seats.slice().sort((a, b) => state.absolus[b] - state.absolus[a])[0];
  state.turn = state.leader;
  state.turnSince = Date.now();
}

export function startPresages(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  const n = state.seats.length;
  if (n < 4) throw new Error('Il faut au moins 4 joueuses.');
  state.seats = shuffle(state.seats.slice());
  // Absolus distribués face visible : ils définissent les équipes.
  const absolus = shuffle([30, 31, 32, 33, 34, 35]).slice(0, n);
  state.absolus = {};
  state.seats.forEach((id, i) => { state.absolus[id] = absolus[i]; });
  const sorted = state.seats.slice().sort((a, b) => state.absolus[b] - state.absolus[a]);
  if (n === 6) {
    // Trois équipes de 2 : le plus fort avec le plus faible, etc.
    state.teams = [[sorted[0], sorted[5]], [sorted[1], sorted[4]], [sorted[2], sorted[3]]];
  } else {
    // Le plus fort s'associe au plus faible ; les autres forment l'autre équipe.
    state.teams = [[sorted[0], sorted[n - 1]], sorted.slice(1, n - 1)];
  }
  state.wins = state.teams.map(() => 0);
  state.manche = 1;
  state.winners = null;
  state.aiTask = null;
  state.phase = 'playing';
  state.log = [];
  const teamsTxt = state.teams.map((t) => t.map((id) => nm(state, id)).join(' & ')).join('  ⚔️  ');
  pushLog(state, `Les Absolus parlent : ${teamsTxt}.`);
  deal(state);
  pushLog(state, `Manche 1 — ${nm(state, state.leader)} mène le premier tour.`);
}

// La joueuse suivante dans l'ordre des sièges à partir de `from` (exclu).
function nextSeat(state, from) {
  const i = state.seats.indexOf(from);
  return state.seats[(i + 1) % state.seats.length];
}

// Peut-elle jouer cette carte compte tenu d'une contrainte ± en cours ?
function satisfies(state, card) {
  const c = state.constraint;
  if (!c) return true;
  return c.dir === 'up' ? card > c.val : card < c.val;
}
function hasSatisfying(state, uid) {
  return state.hands[uid].some((card) => satisfies(state, card));
}

export function playPresages(state, userId, card) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (state.mancheEnd) throw new Error('La manche est finie, on redistribue !');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  const hand = state.hands[userId];
  const val = Number(card);
  if (!hand.includes(val)) throw new Error('Tu n\'as pas cette carte.');
  if (!satisfies(state, val) && hasSatisfying(state, userId)) {
    throw new Error(state.constraint.dir === 'up'
      ? `Tu dois jouer plus fort que ${state.constraint.val}.`
      : `Tu dois jouer plus faible que ${state.constraint.val}.`);
  }

  hand.splice(hand.indexOf(val), 1);
  state.played.push({ by: userId, card: val });
  state.lastTrick = null;

  // Effets éclair : résolus immédiatement, avant la joueuse suivante.
  const eff = CARDS[val].effect;
  if (eff.leftLeads) {
    state.nextLeader = nextSeat(state, userId);
    pushLog(state, `⚡ ${nm(state, userId)} joue le ${val} : ${nm(state, state.nextLeader)} mènera le prochain tour.`);
  }
  if (eff.mustHigher) { state.constraint = { dir: 'up', val, by: userId }; }
  if (eff.mustLower) { state.constraint = { dir: 'down', val, by: userId }; }
  if (eff.reveal) {
    const top = Math.max(...(hand.length ? hand : [0]));
    if (top > 0) pushLog(state, `⚡ ${nm(state, userId)} révèle sa plus forte carte en main : le ${top} !`);
  }

  if (state.played.length >= state.seats.length) {
    resolveTrick(state);
  } else {
    state.turn = nextSeat(state, userId);
    state.turnSince = Date.now();
  }
}

function resolveTrick(state) {
  const played = state.played;
  const byColor = (col) => played.filter((p) => CARDS[p.card].color === col);
  const marked = new Set(); // cartes (valeurs) défaussées ce tour

  // Effets sablier, évalués simultanément sur l'état du tour.
  for (const p of played) {
    const eff = CARDS[p.card].effect;
    if (eff.colorIn && byColor(eff.colorIn).length > 0) marked.add(p.card);
    if (eff.alone && byColor(CARDS[p.card].color).length === 1) marked.add(p.card);
    if (eff.discardTop) {
      const cands = byColor(eff.discardTop);
      if (cands.length) marked.add(Math.max(...cands.map((x) => x.card)));
    }
    if (eff.discardLow) {
      const cands = byColor(eff.discardLow);
      if (cands.length) marked.add(Math.min(...cands.map((x) => x.card)));
    }
    if (eff.discardLowest) marked.add(Math.min(...played.map((x) => x.card)));
  }

  // Qui remporte le pli ? La plus forte, sauf « ne peut pas remporter » et
  // sauf si un « la plus forte ne gagne pas » est en jeu.
  let contenders = played.filter((p) => !CARDS[p.card].effect.noWin).map((p) => p.card).sort((a, b) => b - a);
  if (played.some((p) => CARDS[p.card].effect.topLoses) && contenders.length > 1) {
    contenders = contenders.slice(1);
  }
  const winCard = contenders[0] ?? null;
  const winnerBy = winCard ? played.find((p) => p.card === winCard).by : null;
  if (winCard) marked.add(winCard);

  // Défausses en chaîne (✚✚) : une carte de la main part en plus.
  for (const p of played) {
    if (marked.has(p.card) && CARDS[p.card].effect.chain && state.hands[p.by].length) {
      const hand = state.hands[p.by];
      const extra = hand[Math.floor(Math.random() * hand.length)];
      hand.splice(hand.indexOf(extra), 1);
      pushLog(state, `✚✚ Le ${p.card} entraîne le ${extra} de la main de ${nm(state, p.by)} !`);
    }
  }

  // Les cartes non défaussées reviennent en main.
  for (const p of played) {
    if (!marked.has(p.card)) state.hands[p.by].push(p.card);
  }
  state.lastTrick = {
    cards: played.map((p) => ({ by: p.by, card: p.card, discarded: marked.has(p.card) })),
    winnerBy,
  };
  const discardedTxt = [...marked].sort((a, b) => a - b).join(', ');
  pushLog(state, winCard
    ? `${nm(state, winnerBy)} remporte le pli avec le ${winCard}. Défaussées : ${discardedTxt || 'aucune'}.`
    : `Personne ne remporte ce pli. Défaussées : ${discardedTxt || 'aucune'}.`);

  state.played = [];
  state.constraint = null;

  // Fin de manche : une joueuse à 1 carte (ou 0) fait gagner son équipe.
  const finishers = state.seats.filter((id) => state.hands[id].length <= 1);
  if (finishers.length) {
    // Départage : la carte restante la plus forte (main vide = imbattable).
    finishers.sort((a, b) => {
      const va = state.hands[a].length ? state.hands[a][0] : 99;
      const vb = state.hands[b].length ? state.hands[b][0] : 99;
      return vb - va;
    });
    const champion = finishers[0];
    const team = teamOf(state, champion);
    state.wins[team] += 1;
    state.turn = null;
    pushLog(state, `🔮 ${nm(state, champion)} lit l'avenir : la manche ${state.manche} est pour ${state.teams[team].map((id) => nm(state, id)).join(' & ')} !`);
    if (state.wins[team] >= 2) {
      state.phase = 'over';
      state.winners = state.teams[team].slice();
      state.mancheEnd = null;
      pushLog(state, `Victoire finale de ${state.winners.map((id) => nm(state, id)).join(' & ')} !`);
    } else {
      state.mancheEnd = { team, until: Date.now() + MANCHE_BREAK_MS };
    }
    return;
  }

  // Tour suivant : la gagnante mène (ou la voisine désignée par un ⚡).
  state.leader = state.nextLeader || winnerBy || state.leader;
  state.nextLeader = null;
  state.turn = state.leader;
  state.turnSince = Date.now();
}

function nextManche(state) {
  state.manche += 1;
  state.mancheEnd = null;
  deal(state);
  pushLog(state, `Manche ${state.manche} — ${nm(state, state.leader)} mène.`);
}

// --- ChatGPT ------------------------------------------------------------------
// Décrit chaque carte jouable et laisse l'API choisir ; secours local sensé.
function describeCard(state, card) {
  const c = CARDS[card];
  const col = c.color ? ` ${c.color}` : ' (Absolu)';
  return `Jouer le ${card}${col} — ${c.text}`;
}

function candidateMoves(state) {
  const hand = state.hands.bot;
  const legalAll = hand.filter((card) => satisfies(state, card));
  const legal = legalAll.length ? legalAll : hand.slice();
  const inPlay = state.played.map((p) => `${p.card} ${CARDS[p.card].color || 'Absolu'} (${nm(state, p.by)})`).join(', ') || 'aucune pour l\'instant';
  const mate = state.teams[teamOf(state, 'bot')].filter((id) => id !== 'bot').map((id) => `${nm(state, id)} (${state.hands[id].length} cartes)`).join(', ');
  return {
    label: 'Présages (défausse en équipes)',
    rules: 'La carte la plus forte du tour est DÉFAUSSÉE (c\'est bien !), les autres reviennent en main sauf si leur condition de défausse se déclenche. Ton équipe gagne la manche dès qu\'une de vous n\'a plus qu\'une carte. Vider ta main OU aider ta partenaire à vider la sienne.',
    situation: `Tu as ${hand.length} carte(s). Ta partenaire : ${mate || 'aucune'}. Cartes déjà jouées ce tour : ${inPlay}.`,
    options: legal.map((card) => describeCard(state, card)),
    moves: legal,
  };
}

// Secours local : privilégie une carte dont la condition va se déclencher,
// sinon la plus forte (pour remporter et défausser).
function localPick(state) {
  const hand = state.hands.bot;
  const legalAll = hand.filter((card) => satisfies(state, card));
  const legal = legalAll.length ? legalAll : hand.slice();
  const byColor = (col) => state.played.filter((p) => CARDS[p.card].color === col);
  let best = null; let bestScore = -Infinity;
  for (const card of legal) {
    const eff = CARDS[card].effect;
    let score = card / 35; // les grosses cartes gagnent le pli et se défaussent
    if (eff.colorIn && byColor(eff.colorIn).length) score += 2;
    if (eff.alone && byColor(CARDS[card].color).length === 0 && state.played.length >= state.seats.length - 2) score += 2;
    if (eff.discardLowest && state.played.length && card < Math.min(...state.played.map((p) => p.card))) score += 1.5;
    if (eff.noWin) score -= 0.5;
    if (score > bestScore) { bestScore = score; best = card; }
  }
  return best;
}

export function tickPresages(state) {
  if (state.phase !== 'playing') return false;

  if (state.mancheEnd) {
    if (Date.now() < state.mancheEnd.until) return false;
    nextManche(state);
    return true;
  }
  if (!state.turn) return false;

  if (state.turn === 'bot') {
    const wait = 1200 + (state.turnSince % 1800);
    if (!state.turnSince || Date.now() - state.turnSince < wait) return false;
    const picked = aiTurn(state, () => candidateMoves(state));
    if (picked === 'wait') return false;
    const card = picked ?? localPick(state);
    if (card == null) return false;
    playPresages(state, 'bot', card);
    return true;
  }

  const away = isOffline(state, state.turn);
  const idle = Date.now() - (state.turnSince || 0);
  if ((away && idle > 10000) || idle > IDLE_MS) {
    const hand = state.hands[state.turn];
    const legalAll = hand.filter((card) => satisfies(state, card));
    const legal = legalAll.length ? legalAll : hand;
    playPresages(state, state.turn, legal[Math.floor(Math.random() * legal.length)]);
    return true;
  }
  return false;
}

export function viewFor(state, userId) {
  return {
    type: 'presages',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 4 && state.seats.includes(userId),
    seats: state.seats.slice(),
    teams: state.teams.map((t) => t.slice()),
    absolus: { ...state.absolus },
    wins: state.wins.slice(),
    manche: state.manche,
    hand: (state.hands[userId] || []).slice().sort((a, b) => a - b),
    handCounts: Object.fromEntries(state.seats.map((id) => [id, (state.hands[id] || []).length])),
    played: state.played.map((p) => ({ by: p.by, card: p.card })),
    lastTrick: state.lastTrick,
    leader: state.leader,
    turn: state.turn,
    isMyTurn: state.phase === 'playing' && state.turn === userId && !state.mancheEnd,
    constraint: state.constraint ? { dir: state.constraint.dir, val: state.constraint.val } : null,
    onBreak: !!state.mancheEnd,
    cards: undefined, // le client a sa propre table CARDS (copie)
    winners: state.winners,
    log: state.log.slice(-8),
  };
}
