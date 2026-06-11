// Moteur de Scribbl (dessine & devine), logique pure. Le dessin (traits) transite
// par un canal temps réel léger (scribbl:draw), pas par l'état. Ici : tours, mots,
// devinettes et score. Chaque tour : la dessinatrice choisit un mot puis dessine
// pendant 75 s ; les autres devinent par écrit. Plus on devine vite, plus on marque.

const DURATION = 75000;
const WORDS = [
  // Faciles (objets/animaux courants)
  'chat', 'chien', 'maison', 'soleil', 'lune', 'étoile', 'cœur', 'arbre', 'fleur', 'pomme',
  'banane', 'fraise', 'carotte', 'pizza', 'gâteau', 'glace', 'bonbon', 'œuf', 'pain', 'fromage',
  'ballon', 'vélo', 'voiture', 'bateau', 'avion', 'train', 'bus', 'fusée', 'maison', 'porte',
  'fenêtre', 'lit', 'chaise', 'table', 'clé', 'livre', 'crayon', 'stylo', 'ciseaux', 'lunettes',
  'chapeau', 'chaussure', 'robe', 'pantalon', 'parapluie', 'horloge', 'téléphone', 'ordinateur', 'télé', 'lampe',
  'bougie', 'ampoule', 'cadeau', 'ballon', 'cerf-volant', 'tambour', 'guitare', 'piano', 'trompette', 'micro',
  // Animaux
  'poisson', 'oiseau', 'canard', 'poule', 'vache', 'cochon', 'cheval', 'mouton', 'lapin', 'souris',
  'éléphant', 'girafe', 'lion', 'tigre', 'singe', 'ours', 'panda', 'koala', 'kangourou', 'pingouin',
  'abeille', 'papillon', 'coccinelle', 'araignée', 'serpent', 'tortue', 'grenouille', 'escargot', 'crabe', 'pieuvre',
  'requin', 'baleine', 'dauphin', 'hibou', 'aigle', 'renard', 'loup', 'hérisson', 'écureuil', 'dragon',
  // Nature / lieux
  'montagne', 'plage', 'mer', 'rivière', 'forêt', 'volcan', 'île', 'désert', 'nuage', 'pluie',
  'neige', 'éclair', 'arc-en-ciel', 'feu', 'cactus', 'champignon', 'sapin', 'pont', 'château', 'tour Eiffel',
  // Nourriture / divers
  'croissant', 'baguette', 'hamburger', 'frites', 'sushi', 'pop-corn', 'café', 'théière', 'bouteille', 'ananas',
  'pastèque', 'citron', 'cerise', 'raisin', 'champignon', 'piment', 'sandwich', 'donut', 'cupcake', 'sucette',
  // Plus durs / abstraits
  'licorne', 'sorcière', 'fantôme', 'citrouille', 'squelette', 'momie', 'vampire', 'zombie', 'robot', 'extraterrestre',
  'astronaute', 'cosmonaute', 'pirate', 'sirène', 'chevalier', 'roi', 'reine', 'couronne', 'épée', 'bouclier',
  'trésor', 'boussole', 'sablier', 'téléscope', 'microscope', 'aimant', 'parachute', 'montgolfière', 'sous-marin', 'phare',
  'cascade', 'tornade', 'séisme', 'gravité', 'électricité', 'orchestre', 'marathon', 'équilibre', 'labyrinthe', 'mirage',
  // Prénoms de la team
  'Khadija', 'Zineb', 'Aya', 'Alia', 'Yasmine',
];

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}
const isLetter = (c) => /[a-zA-ZÀ-ÿ0-9]/.test(c);
function maskOf(word, revealedSet) {
  return word.split('').map((c, i) => (isLetter(c) ? ((revealedSet && revealedSet.has(i)) ? c : '_') : c)).join(' ');
}
// Nombre max de lettres révélées selon la longueur (3-4 lettres -> 1, etc.).
function maxRevealFor(len) {
  if (len <= 4) return 1;
  if (len <= 6) return 2;
  if (len <= 9) return 3;
  return 4;
}

export function createScribbl() {
  return {
    type: 'scribbl', phase: 'waiting', // waiting -> choose -> draw -> turnend -> over
    seats: [], scores: {},
    order: [], turnIdx: 0, round: 1, totalRounds: 2,
    drawer: null, choices: [], word: null, hint: null,
    revealOrder: [], revealed: 0, maxReveal: 0,
    guessed: {}, deadline: null, since: null, reveal: null, log: [], winner: null,
  };
}

export function joinScribbl(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 10) { state.seats.push(userId); state.scores[userId] = 0; }
}

function beginTurn(state) {
  state.drawer = state.order[state.turnIdx];
  state.choices = shuffle(WORDS).slice(0, 3);
  state.word = null; state.hint = null; state.guessed = {}; state.deadline = null; state.reveal = null;
  state.revealOrder = []; state.revealed = 0; state.maxReveal = 0;
  state.phase = 'choose';
  state.since = Date.now();
  state.log.push({ kind: 'system', text: 'Nouveau tour — choix du mot…' });
}

export function startScribbl(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut au moins 2 joueurs.');
  state.order = shuffle(state.seats);
  for (const id of state.seats) state.scores[id] = 0;
  state.turnIdx = 0; state.round = 1; state.log = [];
  beginTurn(state);
}

export function chooseWord(state, userId, word) {
  if (state.phase !== 'choose') throw new Error('Pas le moment.');
  if (state.drawer !== userId) throw new Error('Ce n\'est pas à toi de choisir.');
  if (!state.choices.includes(word)) throw new Error('Mot invalide.');
  state.word = word;
  const idxs = shuffle(word.split('').map((c, i) => (isLetter(c) ? i : -1)).filter((i) => i >= 0));
  state.maxReveal = Math.min(maxRevealFor(idxs.length), Math.max(0, idxs.length - 1));
  state.revealOrder = idxs;
  state.revealed = 0;
  state.hint = maskOf(word, new Set());
  state.deadline = Date.now() + DURATION;
  state.phase = 'draw';
  state.log.push({ kind: 'system', text: 'Le dessin commence !' });
}

function activeGuessers(state) { return state.seats.filter((id) => id !== state.drawer); }

function endTurn(state) {
  state.reveal = state.word;
  state.phase = 'turnend';
  state.since = Date.now();
  state.log.push({ kind: 'system', text: `Le mot était : ${state.word}.` });
}

export function guessScribbl(state, userId, text) {
  if (state.phase !== 'draw') throw new Error('Pas le moment de deviner.');
  if (userId === state.drawer) throw new Error('Tu dessines, tu ne devines pas.');
  if (!state.seats.includes(userId)) throw new Error('Interdit.');
  if (state.guessed[userId]) return; // déjà trouvé
  const name = userId;
  if (norm(text) === norm(state.word)) {
    const remaining = Math.max(0, (state.deadline || 0) - Date.now());
    const pts = Math.round(20 + 60 * (remaining / DURATION));
    state.scores[userId] = (state.scores[userId] || 0) + pts;
    state.scores[state.drawer] = (state.scores[state.drawer] || 0) + 15;
    state.guessed[userId] = Object.keys(state.guessed).length + 1;
    state.log.push({ kind: 'correct', id: userId, text: 'a trouvé le mot !' });
    if (activeGuessers(state).every((id) => state.guessed[id])) endTurn(state);
  } else {
    state.log.push({ kind: 'guess', id: userId, text: String(text || '').slice(0, 60) });
    if (state.log.length > 60) state.log = state.log.slice(-60);
  }
}

export function timeupScribbl(state, userId) {
  if (state.phase !== 'draw') return;
  if (!state.deadline || Date.now() < state.deadline) return;
  endTurn(state);
}

// Révèle progressivement des lettres au fil du temps (indices répartis sur la durée).
export function revealScribbl(state) {
  if (state.phase !== 'draw' || !state.deadline) return;
  if (state.revealed >= state.maxReveal) return;
  const fraction = (DURATION - (state.deadline - Date.now())) / DURATION;
  const due = (state.revealed + 1) / (state.maxReveal + 1); // étalé sur la durée
  if (fraction < due) return;
  state.revealed += 1;
  state.hint = maskOf(state.word, new Set(state.revealOrder.slice(0, state.revealed)));
}

function advanceTurn(state) {
  state.turnIdx += 1;
  if (state.turnIdx >= state.order.length) { state.turnIdx = 0; state.round += 1; }
  if (state.round > state.totalRounds) {
    state.phase = 'over';
    state.winner = state.seats.reduce((b, id) => ((state.scores[id] || 0) > (state.scores[b] || 0) ? id : b), state.seats[0]);
    state.log.push({ kind: 'system', text: 'Fin de la partie !' });
    return;
  }
  beginTurn(state);
}

export function nextScribbl(state, userId) {
  if (state.phase !== 'turnend') throw new Error('Pas en fin de tour.');
  if (!state.seats.includes(userId)) throw new Error('Interdit.');
  advanceTurn(state);
}

// Délais d'inactivité : choix du mot (drawer absent), enchaînement de fin de tour.
const CHOOSE_SKIP_MS = 30000;
const TURNEND_MS = 12000;

// Horloge serveur (chaque seconde) : fin du temps de dessin, lettres révélées
// au fil du temps, tour suivant automatique, et dessinateur déconnecté passé.
export function tickScribbl(state) {
  const now = Date.now();
  if (state.phase === 'choose' && state.since && now >= state.since + CHOOSE_SKIP_MS
    && state.offline && state.offline[state.drawer]) {
    state.log.push({ kind: 'system', text: 'Dessinateur·rice absent·e — on passe au tour suivant.' });
    advanceTurn(state);
    return true;
  }
  if (state.phase === 'draw') {
    const before = state.revealed;
    revealScribbl(state);
    if (state.deadline && now >= state.deadline) { endTurn(state); return true; }
    return state.revealed !== before;
  }
  if (state.phase === 'turnend' && state.since && now >= state.since + TURNEND_MS) {
    advanceTurn(state);
    return true;
  }
  return false;
}

export function viewFor(state, userId) {
  const isDrawer = state.drawer === userId;
  return {
    type: 'scribbl',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    players: state.seats.map((id) => ({ id, score: state.scores[id] || 0, guessed: !!state.guessed[id], isDrawer: state.drawer === id })),
    drawer: state.drawer,
    isDrawer,
    round: state.round, totalRounds: state.totalRounds,
    choices: isDrawer && state.phase === 'choose' ? state.choices : null,
    word: isDrawer ? state.word : null,
    hint: state.hint,
    deadline: state.phase === 'draw' ? state.deadline : null,
    canGuess: state.phase === 'draw' && !isDrawer && state.seats.includes(userId) && !state.guessed[userId],
    iGuessed: !!state.guessed[userId],
    reveal: state.reveal,
    log: state.log.slice(-14),
    winner: state.winner,
  };
}
