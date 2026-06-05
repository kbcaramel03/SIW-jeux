// Moteur du jeu Code Names (logique pure, indépendante du réseau).
// Le plateau fait 25 cartes : 9 pour l'équipe qui commence, 8 pour l'autre,
// 7 neutres, et 1 assassin (à ne SURTOUT pas révéler).

// Liste de mots en français + vos prénoms intégrés, comme demandé 💜
const WORDS = [
  // prénoms de la team
  'KHADIJA', 'ZINEB', 'AYA', 'ALIA', 'YASMINE',
  // mots classiques
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

export function createCodenames() {
  const words = shuffle(WORDS).slice(0, 25);
  const startingTeam = Math.random() < 0.5 ? 'red' : 'blue';
  const otherTeam = startingTeam === 'red' ? 'blue' : 'red';

  // Couleurs : 9 équipe qui commence, 8 autre équipe, 7 neutres, 1 assassin.
  const colors = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(otherTeam),
    ...Array(7).fill('neutral'),
    'assassin',
  ];
  const shuffledColors = shuffle(colors);

  const board = words.map((word, i) => ({ word, color: shuffledColors[i], revealed: false }));

  return {
    type: 'codenames',
    phase: 'setup', // setup -> playing -> over
    board,
    startingTeam,
    turn: startingTeam,
    clue: null, // { word, count, by }
    guessesLeft: 0,
    teams: {
      red: { spymaster: null, operatives: [] },
      blue: { spymaster: null, operatives: [] },
    },
    winner: null,
    log: [],
  };
}

// Place une joueuse dans une équipe + un rôle (spymaster ou agent).
export function assignRole(state, userId, team, role) {
  if (state.phase !== 'setup') throw new Error('La partie a déjà commencé.');
  if (!['red', 'blue'].includes(team)) throw new Error('Équipe invalide.');

  // Retire la joueuse de partout d'abord.
  for (const t of ['red', 'blue']) {
    if (state.teams[t].spymaster === userId) state.teams[t].spymaster = null;
    state.teams[t].operatives = state.teams[t].operatives.filter((id) => id !== userId);
  }

  if (role === 'spymaster') {
    if (state.teams[team].spymaster && state.teams[team].spymaster !== userId) {
      throw new Error('Cette équipe a déjà un·e maître-espion.');
    }
    state.teams[team].spymaster = userId;
  } else {
    state.teams[team].operatives.push(userId);
  }
}

export function startGame(state) {
  if (state.phase !== 'setup') throw new Error('Déjà démarrée.');
  for (const t of ['red', 'blue']) {
    if (!state.teams[t].spymaster) throw new Error('Chaque équipe a besoin d\'un·e maître-espion.');
  }
  state.phase = 'playing';
  state.log.push(`La partie commence ! L'équipe ${state.startingTeam === 'red' ? 'rouge' : 'bleue'} joue en premier.`);
}

export function giveClue(state, userId, word, count) {
  if (state.phase !== 'playing') throw new Error('La partie n\'est pas en cours.');
  if (state.teams[state.turn].spymaster !== userId) throw new Error('Seul·e le·la maître-espion de l\'équipe active donne l\'indice.');
  if (state.clue) throw new Error('Un indice a déjà été donné, à ton équipe de deviner.');
  const n = Math.max(0, Math.min(9, parseInt(count, 10) || 0));
  state.clue = { word: String(word || '').trim().toUpperCase(), count: n, by: userId };
  // On peut deviner count + 1 fois.
  state.guessesLeft = n + 1;
  state.log.push(`Indice (${state.turn === 'red' ? 'rouge' : 'bleu'}) : "${state.clue.word}" — ${n}`);
}

function endTurn(state) {
  state.turn = state.turn === 'red' ? 'blue' : 'red';
  state.clue = null;
  state.guessesLeft = 0;
}

function checkWin(state) {
  for (const t of ['red', 'blue']) {
    const remaining = state.board.filter((c) => c.color === t && !c.revealed).length;
    if (remaining === 0) {
      state.phase = 'over';
      state.winner = t;
      state.log.push(`🎉 L'équipe ${t === 'red' ? 'rouge' : 'bleue'} a gagné !`);
      return true;
    }
  }
  return false;
}

export function guessCard(state, userId, cardIndex) {
  if (state.phase !== 'playing') throw new Error('La partie n\'est pas en cours.');
  if (!state.clue) throw new Error('Attends l\'indice du·de la maître-espion.');
  const isOperative = state.teams[state.turn].operatives.includes(userId);
  if (!isOperative) throw new Error('Seuls les agents de l\'équipe active devinent.');

  const card = state.board[cardIndex];
  if (!card || card.revealed) throw new Error('Carte invalide.');

  card.revealed = true;
  state.log.push(`Carte révélée : "${card.word}" (${card.color}).`);

  if (card.color === 'assassin') {
    // L'équipe qui révèle l'assassin perd immédiatement.
    state.phase = 'over';
    state.winner = state.turn === 'red' ? 'blue' : 'red';
    state.log.push(`💀 Assassin ! L'équipe ${state.turn === 'red' ? 'rouge' : 'bleue'} perd.`);
    return;
  }

  if (checkWin(state)) return;

  if (card.color === state.turn) {
    // Bonne carte : on peut continuer.
    state.guessesLeft -= 1;
    if (state.guessesLeft <= 0) endTurn(state);
  } else {
    // Carte neutre ou de l'équipe adverse : le tour s'arrête.
    endTurn(state);
  }
}

export function passTurn(state, userId) {
  if (state.phase !== 'playing') throw new Error('La partie n\'est pas en cours.');
  if (!state.teams[state.turn].operatives.includes(userId)) throw new Error('Seuls les agents peuvent passer.');
  if (!state.clue) throw new Error('Attends l\'indice avant de passer.');
  state.log.push(`L'équipe ${state.turn === 'red' ? 'rouge' : 'bleue'} passe son tour.`);
  endTurn(state);
}

// Vue du jeu adaptée à chaque joueuse : les agents ne voient pas les couleurs
// des cartes non révélées, seuls les maîtres-espions voient tout.
export function viewFor(state, userId) {
  const isSpymaster = state.teams.red.spymaster === userId || state.teams.blue.spymaster === userId;
  const showAll = isSpymaster || state.phase === 'over';
  const board = state.board.map((c) => ({
    word: c.word,
    revealed: c.revealed,
    color: c.revealed || showAll ? c.color : null,
  }));
  const counts = {
    red: state.board.filter((c) => c.color === 'red' && !c.revealed).length,
    blue: state.board.filter((c) => c.color === 'blue' && !c.revealed).length,
  };
  return {
    type: 'codenames',
    phase: state.phase,
    board,
    turn: state.turn,
    clue: state.clue,
    guessesLeft: state.guessesLeft,
    teams: state.teams,
    winner: state.winner,
    counts,
    startingTeam: state.startingTeam,
    isSpymaster,
    log: state.log.slice(-8),
  };
}
