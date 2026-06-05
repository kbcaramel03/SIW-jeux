// Moteur du jeu Code Names (logique pure).
// Deux modes :
//  - VERSUS (4+ joueurs) : 2 équipes rouge/bleu, l'une contre l'autre.
//  - DUO/DUET (2-3 joueurs) : coopératif. Deux côtés avec chacun sa propre clé,
//    on se fait deviner mutuellement pour trouver 15 agents en 9 tours, sans
//    toucher d'assassin. Inspiré des règles officielles de Codenames Duet.
//
// Mécanique commune : on SÉLECTIONNE une carte (visible par tous, en temps réel),
// puis on VALIDE pour la révéler — jamais au simple clic.

const WORDS = [
  'KHADIJA', 'ZINEB', 'AYA', 'ALIA', 'YASMINE',
  'CHAT', 'CHIEN', 'LUNE', 'SOLEIL', 'PLAGE', 'MONTAGNE', 'RIVIÈRE', 'FORÊT',
  'ÉCOLE', 'AVION', 'BATEAU', 'VOITURE', 'TRAIN', 'POMME', 'BANANE', 'CHOCOLAT',
  'CAFÉ', 'THÉ', 'LIVRE', 'STYLO', 'TÉLÉPHONE', 'ORDINATEUR', 'MUSIQUE', 'DANSE',
  'FILM', 'THÉÂTRE', 'ÉTOILE', 'NUAGE', 'PLUIE', 'NEIGE', 'FEU', 'GLACE',
  'ROI', 'REINE', 'CHÂTEAU', 'DRAGON', 'MAGIE', 'SORCIÈRE', 'PIRATE', 'TRÉSOR',
  'ÎLE', 'DÉSERT', 'JUNGLE', 'TIGRE', 'LION', 'ÉLÉPHANT', 'SERPENT', 'ARAIGNÉE',
  'FLEUR', 'ARBRE', 'JARDIN', 'CUISINE', 'GÂTEAU', 'BONBON', 'FROMAGE', 'PAIN',
  'MER', 'POISSON', 'REQUIN', 'BALEINE', 'OISEAU', 'PAPILLON', 'ABEILLE', 'MIEL',
  'HÔPITAL', 'DOCTEUR', 'POLICE', 'POMPIER', 'BANQUE', 'ARGENT', 'OR', 'DIAMANT',
  'MASQUE', 'ROBE', 'COURONNE', 'MIROIR', 'PARFUM', 'ROUGE', 'CŒUR', 'CADEAU',
  'PARIS', 'LONDRES', 'TOKYO', 'PLANÈTE', 'FUSÉE', 'ROBOT', 'FANTÔME', 'ZOMBIE',
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createCodenames(options = {}) {
  const words = shuffle(WORDS).slice(0, 25);
  const mode = options.mode === 'versus' ? 'versus' : options.mode === 'duet' ? 'duet' : null;
  return {
    type: 'codenames',
    phase: 'setup', // setup -> playing -> over
    mode, // 'versus' | 'duet' (choisi à la création du salon)
    board: words.map((word) => ({ word, revealed: false, kind: null })),
    teams: {
      red: { spymaster: null, operatives: [] },
      blue: { spymaster: null, operatives: [] },
    },
    selections: {}, // userId -> index de carte sélectionnée (transitoire)
    // --- versus ---
    colors: null, // [25] 'red'|'blue'|'neutral'|'assassin'
    startingTeam: null,
    turn: null,
    clue: null, // { word, count, by }
    guessesLeft: 0,
    // --- duet ---
    keyRed: null, // [25] 'agent'|'assassin'|'bystander' (clé du côté rouge)
    keyBlue: null,
    agentsFound: 0,
    agentsTotal: 15,
    turnsLeft: 9,
    winner: null, // 'red' | 'blue' (versus) | null
    result: null, // 'won' | 'lost' (duet)
    log: [],
  };
}

// Versus : une équipe est complète si elle a un maître-espion ET au moins un agent.
export function canPlay(state, team) {
  return !!state.teams[team].spymaster && state.teams[team].operatives.length > 0;
}
// Duo : un côté est « occupé » dès qu'au moins un joueur y est (rôle indifférent).
export function sideManned(state, team) {
  return !!state.teams[team].spymaster || state.teams[team].operatives.length > 0;
}

// --- Composition des équipes ---
export function assignRole(state, userId, team, role) {
  if (state.phase !== 'setup') throw new Error('La partie a déjà commencé.');
  if (!['red', 'blue'].includes(team)) throw new Error('Équipe invalide.');
  for (const t of ['red', 'blue']) {
    if (state.teams[t].spymaster === userId) state.teams[t].spymaster = null;
    state.teams[t].operatives = state.teams[t].operatives.filter((id) => id !== userId);
  }
  if (role === 'spymaster') {
    if (state.teams[team].spymaster && state.teams[team].spymaster !== userId) {
      throw new Error('Cette équipe a déjà un maître-espion.');
    }
    state.teams[team].spymaster = userId;
  } else {
    state.teams[team].operatives.push(userId);
  }
}

function buildVersus(state) {
  const startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
  const otherTeam = startingTeam === 'red' ? 'blue' : 'red';
  const colors = shuffle([
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(otherTeam),
    ...Array(7).fill('neutral'),
    'assassin',
  ]);
  state.colors = colors;
  state.startingTeam = startingTeam;
  state.turn = startingTeam;
}

// Distribution officielle des paires (clé rouge / clé bleue) pour le mode Duo.
// agent=A, bystander=B, assassin=X. Total 25 cartes, 15 agents uniques.
function buildDuet(state) {
  const pairs = [];
  const add = (a, b, n) => { for (let i = 0; i < n; i++) pairs.push([a, b]); };
  add('agent', 'agent', 3);
  add('agent', 'bystander', 5);
  add('agent', 'assassin', 1);
  add('bystander', 'agent', 5);
  add('bystander', 'bystander', 6);
  add('bystander', 'assassin', 2);
  add('assassin', 'agent', 1);
  add('assassin', 'bystander', 2);
  const shuffled = shuffle(pairs);
  state.keyRed = shuffled.map((p) => p[0]);
  state.keyBlue = shuffled.map((p) => p[1]);
  state.turn = Math.random() < 0.5 ? 'red' : 'blue'; // côté qui donne le 1er indice
  state.agentsFound = 0;
  state.agentsTotal = 15;
  state.turnsLeft = 9;
}

export function startGame(state) {
  if (state.phase !== 'setup') throw new Error('Déjà démarrée.');
  const versusReady = canPlay(state, 'red') && canPlay(state, 'blue');
  const duetReady = sideManned(state, 'red') && sideManned(state, 'blue');

  // Le mode est choisi à la création du salon ; sinon on déduit (compatibilité).
  let mode = state.mode;
  if (mode === 'versus') {
    if (!versusReady) throw new Error('En Versus, chaque équipe a besoin d\'un maître-espion ET d\'au moins un agent (4 joueurs min).');
  } else if (mode === 'duet') {
    if (!duetReady) throw new Error('En Duo, il faut au moins un joueur de chaque côté.');
  } else {
    if (versusReady) mode = 'versus';
    else if (duetReady) mode = 'duet';
    else throw new Error('Il faut soit 2 équipes complètes (Versus), soit au moins 1 joueur de chaque côté (Duo).');
  }

  state.mode = mode;
  if (mode === 'versus') {
    buildVersus(state);
    state.log.push(`Partie lancée ! L'équipe ${state.turn === 'red' ? 'rouge' : 'bleue'} commence.`);
  } else {
    buildDuet(state);
    state.log.push('Mode Duo : trouvez les 15 agents en 9 tours, sans toucher d\'assassin !');
  }
  state.phase = 'playing';
  state.clue = null;
  state.guessesLeft = 0;
  state.selections = {};
}

// --- Indice donné par le maître-espion (versus) ou le côté actif (duet) ---
export function giveClue(state, userId, word, count) {
  if (state.phase !== 'playing') throw new Error('La partie n\'est pas en cours.');
  if (state.clue) throw new Error('Un indice a déjà été donné.');
  if (!isClueGiver(state, userId)) throw new Error('Ce n\'est pas à toi de donner l\'indice.');
  const n = Math.max(0, Math.min(9, parseInt(count, 10) || 0));
  state.clue = { word: String(word || '').trim().toUpperCase().slice(0, 24), count: n, by: userId };
  state.guessesLeft = n + 1;
  state.log.push(`Indice (${sideLabel(state.turn)}) : « ${state.clue.word} » — ${n}`);
}

// Qui a le droit de donner l'indice ?
function isClueGiver(state, userId) {
  if (state.mode === 'versus') return state.teams[state.turn].spymaster === userId;
  // duet : n'importe quel joueur du côté actif
  return isOnSide(state, userId, state.turn);
}
// Qui a le droit de deviner ?
function isGuesser(state, userId) {
  if (state.mode === 'versus') return state.teams[state.turn].operatives.includes(userId);
  // duet : les joueurs du côté opposé à celui qui donne l'indice
  const other = state.turn === 'red' ? 'blue' : 'red';
  return isOnSide(state, userId, other);
}
function isOnSide(state, userId, side) {
  return state.teams[side].spymaster === userId || state.teams[side].operatives.includes(userId);
}
function sideLabel(side) {
  return side === 'red' ? 'rouge' : 'bleu';
}

// --- Sélection d'une carte (visible en temps réel, ne révèle PAS) ---
export function selectCard(state, userId, index) {
  if (state.phase !== 'playing') throw new Error('La partie n\'est pas en cours.');
  if (!state.clue) throw new Error('Attends l\'indice avant de sélectionner.');
  if (!isGuesser(state, userId)) throw new Error('Ce n\'est pas à ton équipe de deviner.');
  const card = state.board[index];
  if (!card || card.revealed) throw new Error('Carte invalide.');
  // Clique à nouveau sur la même carte = on désélectionne.
  if (state.selections[userId] === index) delete state.selections[userId];
  else state.selections[userId] = index;
}

// --- Validation : révèle la carte sélectionnée par ce joueur ---
export function confirmCard(state, userId) {
  if (state.phase !== 'playing') throw new Error('La partie n\'est pas en cours.');
  if (!isGuesser(state, userId)) throw new Error('Ce n\'est pas à ton équipe de deviner.');
  const index = state.selections[userId];
  if (index === undefined) throw new Error('Sélectionne d\'abord une carte.');
  reveal(state, index);
}

function clearSelectionsOn(state, index) {
  for (const uid of Object.keys(state.selections)) {
    if (state.selections[uid] === index) delete state.selections[uid];
  }
}

function reveal(state, index) {
  const card = state.board[index];
  if (!card || card.revealed) return;
  clearSelectionsOn(state, index);

  if (state.mode === 'versus') revealVersus(state, card, index);
  else revealDuet(state, card, index);
}

// ===== VERSUS =====
function revealVersus(state, card, index) {
  const color = state.colors[index];
  card.revealed = true;
  card.kind = color;
  state.log.push(`Carte « ${card.word} » → ${color}.`);

  if (color === 'assassin') {
    state.phase = 'over';
    state.winner = state.turn === 'red' ? 'blue' : 'red';
    state.log.push(`Assassin ! L'équipe ${sideLabel(state.turn)} perd.`);
    return;
  }
  if (checkVersusWin(state)) return;

  if (color === state.turn) {
    state.guessesLeft -= 1;
    if (state.guessesLeft <= 0) endTurnVersus(state);
  } else {
    endTurnVersus(state);
  }
}
function endTurnVersus(state) {
  state.turn = state.turn === 'red' ? 'blue' : 'red';
  state.clue = null;
  state.guessesLeft = 0;
  state.selections = {};
}
function checkVersusWin(state) {
  for (const t of ['red', 'blue']) {
    const remaining = state.colors.filter((c, i) => c === t && !state.board[i].revealed).length;
    if (remaining === 0) {
      state.phase = 'over';
      state.winner = t;
      state.log.push(`L'équipe ${sideLabel(t)} a trouvé tous ses agents !`);
      return true;
    }
  }
  return false;
}

// ===== DUET =====
function revealDuet(state, card, index) {
  // On vérifie selon la clé du côté qui a DONNÉ l'indice (state.turn).
  const giverKey = state.turn === 'red' ? state.keyRed : state.keyBlue;
  const kind = giverKey[index];
  card.revealed = true;
  card.kind = kind === 'agent' ? 'agent' : kind === 'assassin' ? 'assassin' : 'bystander';
  state.log.push(`Carte « ${card.word} » → ${frKind(card.kind)}.`);

  if (kind === 'assassin') {
    state.phase = 'over';
    state.result = 'lost';
    state.log.push('Assassin ! Partie perdue.');
    return;
  }
  if (kind === 'agent') {
    state.agentsFound += 1;
    if (state.agentsFound >= state.agentsTotal) {
      state.phase = 'over';
      state.result = 'won';
      state.log.push('Bravo, les 15 agents sont trouvés ! Vous avez gagné !');
      return;
    }
    state.guessesLeft -= 1;
    if (state.guessesLeft <= 0) endTurnDuet(state);
    return;
  }
  // bystander -> le tour s'arrête
  endTurnDuet(state);
}
function endTurnDuet(state) {
  state.turnsLeft -= 1;
  state.turn = state.turn === 'red' ? 'blue' : 'red';
  state.clue = null;
  state.guessesLeft = 0;
  state.selections = {};
  if (state.turnsLeft <= 0 && state.phase === 'playing') {
    state.phase = 'over';
    state.result = 'lost';
    state.log.push('Plus de tours disponibles… Partie perdue.');
  }
}
function frKind(k) {
  return k === 'agent' ? 'agent ✓' : k === 'assassin' ? 'assassin' : 'passant';
}

// --- Passer / arrêter de deviner ---
export function passTurn(state, userId) {
  if (state.phase !== 'playing') throw new Error('La partie n\'est pas en cours.');
  if (!isGuesser(state, userId)) throw new Error('Seuls les devineurs peuvent passer.');
  if (!state.clue) throw new Error('Attends l\'indice avant de passer.');
  state.log.push(`Le côté ${sideLabel(state.turn === 'red' ? 'blue' : 'red')} arrête de deviner.`);
  if (state.mode === 'versus') endTurnVersus(state);
  else endTurnDuet(state);
}

// --- Vue personnalisée pour chaque joueur ---
export function viewFor(state, userId) {
  const common = {
    type: 'codenames',
    phase: state.phase,
    mode: state.mode,
    teams: state.teams,
    clue: state.clue,
    guessesLeft: state.guessesLeft,
    turn: state.turn,
    selections: state.selections,
    winner: state.winner,
    result: state.result,
    log: state.log.slice(-8),
  };

  if (state.phase === 'setup' || !state.mode) {
    return {
      ...common,
      board: state.board.map((c) => ({ word: c.word, revealed: false, color: null })),
    };
  }

  if (state.mode === 'versus') {
    const isSpymaster = state.teams.red.spymaster === userId || state.teams.blue.spymaster === userId;
    const showAll = isSpymaster || state.phase === 'over';
    return {
      ...common,
      isSpymaster,
      isClueGiver: isClueGiver(state, userId),
      isGuesser: isGuesser(state, userId),
      board: state.board.map((c, i) => ({
        word: c.word,
        revealed: c.revealed,
        color: c.revealed || showAll ? state.colors[i] : null,
      })),
      counts: {
        red: state.colors.filter((c, i) => c === 'red' && !state.board[i].revealed).length,
        blue: state.colors.filter((c, i) => c === 'blue' && !state.board[i].revealed).length,
      },
    };
  }

  // DUET : chaque joueur voit la clé de SON côté.
  const mySide = isOnSide(state, userId, 'red') ? 'red' : isOnSide(state, userId, 'blue') ? 'blue' : null;
  const myKey = mySide === 'red' ? state.keyRed : mySide === 'blue' ? state.keyBlue : null;
  const showAll = state.phase === 'over';
  return {
    ...common,
    mySide,
    isClueGiver: isClueGiver(state, userId),
    isGuesser: isGuesser(state, userId),
    agentsFound: state.agentsFound,
    agentsTotal: state.agentsTotal,
    turnsLeft: state.turnsLeft,
    board: state.board.map((c, i) => ({
      word: c.word,
      revealed: c.revealed,
      // couleur révélée pour tous ; sinon, indice de MA clé (vert/noir/beige).
      color: c.revealed ? c.kind : null,
      hint: !c.revealed && myKey ? myKey[i] : null,
      hintVisible: !c.revealed && showAll === false,
    })),
  };
}
