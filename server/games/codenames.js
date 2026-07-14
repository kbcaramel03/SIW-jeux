// Moteur du jeu Code Names (logique pure + IA optionnelle côté bleu en Duo).
import { aiAvailable, codenamesClue, codenamesGuess } from '../ai.js';

// Deux modes :
//  - VERSUS (4+ joueurs) : 2 équipes rouge/bleu, l'une contre l'autre.
//  - DUO/DUET (2-3 joueurs) : coopératif. Deux côtés avec chacun sa propre clé,
//    on se fait deviner mutuellement pour trouver 15 agents en 9 tours, sans
//    toucher d'assassin. Inspiré des règles officielles de Codenames Duet.
//
// Mécanique commune : on SÉLECTIONNE une carte (visible par tous, en temps réel),
// puis on VALIDE pour la révéler — jamais au simple clic.

const WORDS = [...new Set([
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
  'AMOUR', 'AMITIÉ', 'SECRET', 'MENSONGE', 'RÊVE', 'CAUCHEMAR', 'CHANCE', 'DESTIN',
  'MYSTÈRE', 'INDICE', 'PIÈGE', 'MISSION', 'ESPION', 'AGENT', 'VOLEUR', 'HÉROS',
  'VILAIN', 'MONSTRE', 'GÉANT', 'NINJA', 'SAMOURAÏ', 'CHEVALIER', 'REBELLE', 'ROI',
  'REINE', 'PRINCESSE', 'PRINCE', 'SIRÈNE', 'FÉE', 'LICORNE', 'GÉNIE', 'VAMPIRE',
  'LOUP', 'RENARD', 'OURS', 'SINGE', 'GIRAFE', 'ZÈBRE', 'KOALA', 'PANDA',
  'DAUPHIN', 'TORTUE', 'CRABE', 'HOMARD', 'MOUETTE', 'HIBOU', 'AIGLE', 'COLOMBE',
  'MOUSTIQUE', 'FOURMI', 'CIGALE', 'SCORPION', 'DINOSAURE', 'VOLCAN', 'LAVE', 'ORAGE',
  'VENT', 'TEMPÊTE', 'ARC', 'BOUSSOLE', 'CARTE', 'BAGAGE', 'VALISE', 'PASSEPORT',
  'TICKET', 'MÉTRO', 'TRAM', 'TAXI', 'VÉLO', 'SCOOTER', 'FUNICULAIRE', 'HÉLICOPTÈRE',
  'AÉROPORT', 'GARE', 'PORT', 'ROUTE', 'PONT', 'TUNNEL', 'PHARE', 'ANCRE',
  'NAVIRE', 'SOUS-MARIN', 'VOILE', 'CANON', 'ÉPÉE', 'BOUCLIER', 'ARMURE', 'CASQUE',
  'FLÈCHE', 'CIBLE', 'BOMBE', 'FUSIL', 'PRISON', 'TRIBUNAL', 'JUGE', 'AVOCAT',
  'DÉTECTIVE', 'LOUPE', 'CAMÉRA', 'PHOTO', 'ALBUM', 'CADRE', 'PEINTURE', 'STATUE',
  'MUSÉE', 'GALERIE', 'CONCERT', 'SCÈNE', 'MICRO', 'GUITARE', 'PIANO', 'VIOLON',
  'BATTERIE', 'RADIO', 'CASQUE', 'DISQUE', 'CLIP', 'CHANSON', 'CHORALE', 'RYTHME',
  'BALLET', 'CIRQUE', 'MAGICIEN', 'CLOWN', 'MANÈGE', 'FÊTE', 'CONFETTI', 'BALLON',
  'BOUGIE', 'SURPRISE', 'INVITÉ', 'DÎNER', 'BRUNCH', 'PIZZA', 'BURGER', 'FRITES',
  'SALADE', 'SOUPE', 'TOMATE', 'CAROTTE', 'PATATE', 'RIZ', 'PÂTES', 'SUSHI',
  'TACOS', 'CRÊPE', 'GAUFRE', 'CROISSANT', 'BISCUIT', 'GLACE', 'VANILLE', 'FRAISE',
  'CITRON', 'ORANGE', 'RAISIN', 'CERISE', 'PASTÈQUE', 'ANANAS', 'NOIX', 'MENTHE',
  'SEL', 'SUCRE', 'POIVRE', 'FARINE', 'ŒUF', 'LAIT', 'BEURRE', 'HUILE',
  'VERRE', 'BOUTEILLE', 'TASSE', 'ASSIETTE', 'FOURCHETTE', 'COUTEAU', 'CUILLÈRE', 'NAPPE',
  'MAISON', 'APPARTEMENT', 'CHAMBRE', 'SALON', 'GARAGE', 'BALCON', 'TOIT', 'PORTE',
  'FENÊTRE', 'ESCALIER', 'ASCENSEUR', 'COULOIR', 'LAMPE', 'BOUGIE', 'CANAPÉ', 'CHAISE',
  'TABLE', 'BUREAU', 'LIT', 'COUSSIN', 'DRAP', 'ARMOIRE', 'TIROIR', 'CLÉ',
  'CADENAS', 'HORLOGE', 'MONTRE', 'CALENDRIER', 'AGENDA', 'CAHIER', 'CRAYON', 'GOMME',
  'RÈGLE', 'COLLE', 'CISEAUX', 'CARTABLE', 'EXAMEN', 'NOTE', 'PROF', 'ÉLÈVE',
  'SCIENCE', 'MATHS', 'HISTOIRE', 'GÉOGRAPHIE', 'LANGUE', 'POÈME', 'ROMAN', 'BD',
  'JOURNAL', 'PAPIER', 'ENCRE', 'IMPRIMANTE', 'CLAVIER', 'ÉCRAN', 'SOURIS', 'TABLETTE',
  'APPLICATION', 'INTERNET', 'RÉSEAU', 'MOT', 'CODE', 'VIRUS', 'BUG', 'PIXEL',
  'DRONE', 'SATELLITE', 'ANTENNE', 'LASER', 'MOTEUR', 'ÉNERGIE', 'PILE', 'BATTERIE',
  'AIMANT', 'ROUE', 'VIS', 'MARTEAU', 'SCIE', 'PINCE', 'ÉCHELLE', 'CORDE',
  'PARAPLUIE', 'BOTTES', 'MANTEAU', 'ÉCHARPE', 'GANTS', 'LUNETTES', 'CHAPEAU', 'SAC',
  'BIJOU', 'BAGUE', 'COLLIER', 'BRACELET', 'MONTRE', 'MAQUILLAGE', 'ROUGE', 'SOURIRE',
  'LARME', 'VOIX', 'MAIN', 'PIED', 'TÊTE', 'ŒIL', 'OREILLE', 'NEZ',
  'BOUCHE', 'CHEVEU', 'DENT', 'CERVEAU', 'CŒUR', 'SANG', 'OS', 'MUSCLE',
  'DOCTEUR', 'INFIRMIER', 'PHARMACIE', 'MÉDICAMENT', 'VACCIN', 'PANSEMENT', 'AMBULANCE', 'RADIO',
  'STADE', 'BALLON', 'BUT', 'MATCH', 'COUPE', 'MÉDAILLE', 'SKI', 'SURF',
  'TENNIS', 'BASKET', 'FOOT', 'DANSE', 'YOGA', 'PISCINE', 'PLONGÉE', 'COURSE',
  'CAMPING', 'TENTE', 'FEU', 'BÛCHE', 'LAC', 'CASCADE', 'GROTTE', 'FALAISE',
  'VALLÉE', 'SOMMET', 'NEIGE', 'SABLE', 'ROCHER', 'CANYON', 'OASIS', 'PALMIER',
  'ÉGLISE', 'MOSQUÉE', 'TEMPLE', 'TOUR', 'GRATTE-CIEL', 'HÔTEL', 'RESTAURANT', 'MAGASIN',
  'MARCHÉ', 'BOULANGERIE', 'LIBRAIRIE', 'CINÉMA', 'BIBLIOTHÈQUE', 'UNIVERSITÉ', 'MAIRIE', 'POSTE',
  'EUROPE', 'AFRIQUE', 'ASIE', 'AMÉRIQUE', 'MAROC', 'FRANCE', 'ITALIE', 'ESPAGNE',
  'BRÉSIL', 'CANADA', 'CHINE', 'JAPON', 'ALGÉRIE', 'TUNISIE', 'MEXIQUE', 'ÉGYPTE',
  'MARS', 'VÉNUS', 'JUPITER', 'GALAXIE', 'ASTÉROÏDE', 'COMÈTE', 'ORBITE', 'COSMOS',
  'ALIEN', 'ASTRONAUTE', 'NAVETTE', 'LABO', 'EXPÉRIENCE', 'FORMULE', 'POISON', 'POTION',
  'ÉNIGME', 'PUZZLE', 'DÉ', 'CARTE', 'JETON', 'PLATEAU', 'ÉCHEC', 'DAME',
  'UNO', 'KARAOKÉ', 'TIKTOK', 'SELFIE', 'SNAP', 'MESSAGE', 'GROUPE', 'STATUT',
  'QUEEN', 'BESTIE', 'CRUSH', 'DRAMA', 'GOSSIP', 'VIBE', 'MOOD', 'STAR',
  'HAMMAM', 'CAFTAN', 'HENNÉ', 'MEDINA', 'SOUK', 'TAJINE', 'MENTHE', 'ATLAS',
  'CHAMEAU', 'FAUCON', 'GAZELLE', 'FENNEC', 'CACTUS', 'DUNE', 'CARAVANE', 'BERBÈRE',
  'MARIAGE', 'BOUQUET', 'ALLIANCE', 'DEMOISELLE', 'TRAÎNE', 'VOILE', 'DOT', 'YOUYOU',
  'PYJAMA', 'OREILLER', 'RÉVEIL', 'INSOMNIE', 'SIESTE', 'BÂILLEMENT', 'BERCEUSE', 'SOMNAMBULE',
  'JALOUSIE', 'RUMEUR', 'PROMESSE', 'SERMENT', 'TRAHISON', 'PARDON', 'VENGEANCE', 'COMPLOT',
  'MIRAGE', 'ÉCHO', 'OMBRE', 'REFLET', 'BRUME', 'AUBE', 'CRÉPUSCULE', 'HORIZON',
  'AVALANCHE', 'SÉISME', 'TSUNAMI', 'CANICULE', 'GEL', 'GRÊLE', 'MOUSSON', 'SÉCHERESSE',
  'LABYRINTHE', 'PYRAMIDE', 'SPHINX', 'MOMIE', 'PHARAON', 'HIÉROGLYPHE', 'OBÉLISQUE', 'PAPYRUS',
])];

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
  // Mode « ia » : un Duo classique où le côté bleu est tenu par l'IA
  // (elle donne ses indices ET devine les vôtres).
  const ai = options.mode === 'ia';
  const mode = options.mode === 'versus' ? 'versus' : (options.mode === 'duet' || ai) ? 'duet' : null;
  const state = {
    type: 'codenames',
    phase: 'setup', // setup -> playing -> over
    mode, // 'versus' | 'duet' — choisi par l'hôte dans le salon (setMode)
    uiMode: ai ? 'ia' : mode, // ce que l'hôte a choisi ('ia' = duet + ChatGPT)
    ai,   // true = le côté bleu est joué par ChatGPT (mode Duo)
    board: words.map((word) => ({ word, revealed: false, kind: null })),
    teams: {
      red: { spymaster: null, spymasters: [], operatives: [] },
      blue: { spymaster: null, spymasters: [], operatives: [] },
    },
    selections: {}, // userId -> [index] de cartes présélectionnées (transitoire)
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
    aiTask: null,   // appel IA en cours { kind, status, result }
    aiGuesses: null, // devinettes de l'IA en cours de déroulé { list, i, at }
    log: [],
  };
  if (ai) state.teams.blue.spymasters = ['ai']; // l'IA occupe le côté bleu
  return state;
}

// Versus : une équipe est complète si elle a un maître-espion ET au moins un agent.
export function canPlay(state, team) {
  return spymastersOf(state, team).length > 0 && operativesOf(state, team).length > 0;
}
// Duo : un côté est « occupé » dès qu'au moins un joueur y est (rôle indifférent).
export function sideManned(state, team) {
  return spymastersOf(state, team).length > 0 || operativesOf(state, team).length > 0;
}

function spymastersOf(state, team) {
  const t = state.teams[team] || {};
  const ids = [...(t.spymasters || []), t.spymaster].filter(Boolean);
  return [...new Set(ids)];
}

function operativesOf(state, team) {
  const ids = state.teams[team]?.operatives || [];
  return [...new Set(ids.filter(Boolean))];
}

function normalizedTeams(state) {
  return {
    red: {
      spymaster: null,
      spymasters: spymastersOf(state, 'red'),
      operatives: operativesOf(state, 'red'),
    },
    blue: {
      spymaster: null,
      spymasters: spymastersOf(state, 'blue'),
      operatives: operativesOf(state, 'blue'),
    },
  };
}

// L'hôte choisit le mode DANS le salon, avant le départ (plus à la création).
export function setMode(state, userId, mode) {
  if (state.phase !== 'setup') throw new Error('La partie a déjà commencé.');
  if (userId !== state.hostId) throw new Error('Seule l\'hôte choisit le mode.');
  if (!['versus', 'duet', 'ia'].includes(mode)) throw new Error('Mode inconnu.');
  state.ai = mode === 'ia';
  state.mode = mode === 'ia' ? 'duet' : mode;
  state.uiMode = mode;
  const blue = state.teams.blue;
  const humansBlue = [...new Set([...(blue.spymasters || []), blue.spymaster, ...(blue.operatives || [])]
    .filter((id) => id && id !== 'ai'))];
  if (state.ai) {
    // Le côté bleu devient celui de ChatGPT : les humaines basculent côté rouge.
    blue.spymaster = null; blue.spymasters = ['ai']; blue.operatives = [];
    for (const id of humansBlue) {
      if (!state.teams.red.operatives.includes(id)) state.teams.red.operatives.push(id);
    }
  } else {
    blue.spymasters = (blue.spymasters || []).filter((id) => id !== 'ai');
  }
}

// --- Composition des équipes ---
export function assignRole(state, userId, team, role) {
  if (state.phase !== 'setup') throw new Error('La partie a déjà commencé.');
  if (!['red', 'blue'].includes(team)) throw new Error('Équipe invalide.');
  if (state.ai && team === 'blue') throw new Error('Ce côté est tenu par ChatGPT 🤖.');
  for (const t of ['red', 'blue']) {
    if (state.teams[t].spymaster === userId) state.teams[t].spymaster = null;
    state.teams[t].spymasters = spymastersOf(state, t).filter((id) => id !== userId);
    state.teams[t].operatives = operativesOf(state, t).filter((id) => id !== userId);
  }
  if (role === 'spymaster') {
    state.teams[team].spymaster = null;
    state.teams[team].spymasters = [...spymastersOf(state, team), userId];
  } else {
    state.teams[team].operatives = [...operativesOf(state, team), userId];
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
    state.log.push(state.ai
      ? 'Duo avec ChatGPT : trouvez les 15 agents en 9 tours — il donne SES indices et devine les vôtres !'
      : 'Mode Duo : trouvez les 15 agents en 9 tours, sans toucher d\'assassin !');
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
  if (state.mode === 'versus') return spymastersOf(state, state.turn).includes(userId);
  // duet : n'importe quel joueur du côté actif
  return isOnSide(state, userId, state.turn);
}
// Qui a le droit de deviner ?
function isGuesser(state, userId) {
  if (state.mode === 'versus') return operativesOf(state, state.turn).includes(userId);
  // duet : les joueurs du côté opposé à celui qui donne l'indice
  const other = state.turn === 'red' ? 'blue' : 'red';
  return isOnSide(state, userId, other);
}
function isOnSide(state, userId, side) {
  return spymastersOf(state, side).includes(userId) || operativesOf(state, side).includes(userId);
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
  const current = Array.isArray(state.selections[userId])
    ? state.selections[userId]
    : state.selections[userId] == null ? [] : [state.selections[userId]];
  if (current.includes(index)) {
    const next = current.filter((i) => i !== index);
    if (next.length) state.selections[userId] = next;
    else delete state.selections[userId];
  } else {
    state.selections[userId] = [...current, index];
  }
}

// --- Validation : révèle une carte présélectionnée par ce joueur ---
export function confirmCard(state, userId, index = null) {
  if (state.phase !== 'playing') throw new Error('La partie n\'est pas en cours.');
  if (!isGuesser(state, userId)) throw new Error('Ce n\'est pas à ton équipe de deviner.');
  const selected = Array.isArray(state.selections[userId])
    ? state.selections[userId]
    : state.selections[userId] == null ? [] : [state.selections[userId]];
  const chosen = index == null ? selected[0] : Number(index);
  if (!selected.includes(chosen)) throw new Error('Sélectionne d\'abord cette carte.');
  reveal(state, chosen);
}

function clearSelectionsOn(state, index) {
  for (const uid of Object.keys(state.selections)) {
    const selected = Array.isArray(state.selections[uid]) ? state.selections[uid] : [state.selections[uid]];
    const next = selected.filter((i) => i !== index);
    if (next.length) state.selections[uid] = next;
    else delete state.selections[uid];
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

// --- Horloge serveur : fait jouer l'IA (côté bleu du mode Duo) ---------------
// Deux moments : donner un indice quand c'est son tour, deviner quand les
// humaines ont donné le leur. Les appels API sont asynchrones : on pose une
// « tâche », le tick suivant l'applique quand elle est prête. Si l'API rame
// plus de 20 s (ou après un redémarrage du serveur), l'IA passe son tour.
export function tickCodenames(state) {
  if (!state.ai || state.phase !== 'playing' || state.mode !== 'duet') return false;

  // Tâche expirée (panne, redémarrage) : on la solde en échec propre.
  if (state.aiTask?.status === 'pending' && Date.now() - (state.aiTask.t0 || 0) > 20000) {
    state.aiTask = { ...state.aiTask, status: 'done', result: null };
  }

  // 1) C'est à l'IA de donner un indice.
  if (state.turn === 'blue' && !state.clue) {
    if (!state.aiTask) {
      if (!aiAvailable()) {
        state.log.push('ChatGPT n\'a pas de clé API configurée — il passe son tour.');
        endTurnDuet(state);
        return true;
      }
      const words = state.board
        .map((c, i) => ({ word: c.word, kind: state.keyBlue[i], revealed: c.revealed }))
        .filter((w) => !w.revealed)
        .map(({ word, kind }) => ({ word, kind }));
      const task = { kind: 'clue', status: 'pending', t0: Date.now() };
      state.aiTask = task;
      codenamesClue(words)
        .then((r) => { task.status = 'done'; task.result = r; })
        .catch(() => { task.status = 'done'; task.result = null; });
      state.log.push('ChatGPT réfléchit à un indice…');
      return true;
    }
    if (state.aiTask.status === 'done') {
      const r = state.aiTask.result;
      state.aiTask = null;
      if (r) giveClue(state, 'ai', r.clue, r.count);
      else { state.log.push('ChatGPT sèche sur ce coup… il passe.'); endTurnDuet(state); }
      return true;
    }
    return false;
  }

  // 2) Les humaines ont donné un indice : l'IA devine.
  if (state.turn === 'red' && state.clue) {
    if (!state.aiGuesses && !state.aiTask) {
      if (!aiAvailable()) { endTurnDuet(state); return true; }
      const words = state.board.filter((c) => !c.revealed).map((c) => c.word);
      const task = { kind: 'guess', status: 'pending', t0: Date.now() };
      state.aiTask = task;
      codenamesGuess(state.clue.word, state.clue.count, words)
        .then((r) => { task.status = 'done'; task.result = r; })
        .catch(() => { task.status = 'done'; task.result = null; });
      state.log.push('ChatGPT réfléchit à votre indice…');
      return true;
    }
    if (state.aiTask?.status === 'done') {
      const list = state.aiTask.result;
      state.aiTask = null;
      if (!list || !list.length) { state.log.push('ChatGPT ne voit pas le lien… il passe.'); endTurnDuet(state); return true; }
      state.aiGuesses = { list, i: 0, at: Date.now() + 1200, picked: null };
      return true;
    }
    if (state.aiGuesses && Date.now() >= state.aiGuesses.at) {
      const gs = state.aiGuesses;
      if (gs.picked == null) {
        // Étape 1 : elle « hésite » — sa sélection s'affiche chez tout le monde.
        while (gs.i < gs.list.length) {
          const idx = state.board.findIndex((c) => !c.revealed && c.word === gs.list[gs.i]);
          if (idx >= 0) { gs.picked = idx; state.selections.ai = [idx]; gs.at = Date.now() + 1600; return true; }
          gs.i += 1;
        }
        state.aiGuesses = null;
        if (state.clue) { state.log.push('ChatGPT s\'arrête là.'); endTurnDuet(state); }
        return true;
      }
      // Étape 2 : elle révèle la carte.
      const idx = gs.picked;
      gs.picked = null; gs.i += 1; gs.at = Date.now() + 1400;
      delete state.selections.ai;
      reveal(state, idx);
      if (state.phase !== 'playing' || state.turn !== 'red' || !state.clue) state.aiGuesses = null;
      return true;
    }
    return false;
  }

  return false;
}

// --- Vue personnalisée pour chaque joueur ---
export function viewFor(state, userId) {
  const common = {
    type: 'codenames',
    phase: state.phase,
    mode: state.mode,
    uiMode: state.uiMode ?? (state.ai ? 'ia' : state.mode),
    ai: !!state.ai,
    aiKey: aiAvailable(), // pour prévenir si la clé OpenAI manque sur Render
    aiThinking: !!(state.aiTask && state.aiTask.status === 'pending'),
    teams: normalizedTeams(state),
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
    const isSpymaster = spymastersOf(state, 'red').includes(userId) || spymastersOf(state, 'blue').includes(userId);
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
