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
  // Métiers
  'pompier', 'policière', 'chirurgien', 'coiffeuse', 'boulanger', 'facteur', 'plombier', 'avocate', 'arbitre', 'clown',
  'magicien', 'jardinier', 'photographe', 'professeure', 'serveuse', 'pêcheur', 'chanteuse', 'dentiste', 'vétérinaire', 'détective',
  // Actions (à faire deviner en dessin !)
  'éternuer', 'applaudir', 'bâiller', 'ronfler', 'nager', 'grimper', 'pleurer', 'chuchoter', 'trébucher', 'jongler',
  'plonger', 'se maquiller', 'faire la sieste', 'prendre un selfie', 'faire du yoga', 'faire un câlin', 'faire la vaisselle',
  'étendre le linge', 'faire du vélo', 'claquer des doigts',
  // Sports & loisirs
  'escrime', 'judo', 'boxe', 'patinage', 'équitation', 'ping-pong', 'bowling', 'fléchettes', 'pétanque', 'surf',
  'escalade', 'tir à l\'arc', 'gymnastique', 'haltérophilie', 'badminton', 'billard', 'karaté', 'plongée', 'canoë', 'slalom',
  // Lieux & monuments
  'pyramide', 'igloo', 'moulin', 'aéroport', 'bibliothèque', 'prison', 'cimetière', 'hammam', 'mosquée', 'stade',
  'cirque', 'musée', 'oasis', 'banquise', 'gratte-ciel', 'Tour de Pise', 'Statue de la Liberté', 'Big Ben', 'Colisée', 'Sahara',
  // Abstraits difficiles
  'jalousie', 'vertige', 'insomnie', 'déjà-vu', 'karma', 'liberté', 'chance', 'mensonge', 'timidité', 'nostalgie',
  'courage', 'silence', 'écho', 'infini', 'hasard', 'paresse', 'migraine', 'canicule', 'frisson', 'patience',
  // Objets précis (durs à dessiner)
  'tire-bouchon', 'passoire', 'ventouse', 'agrafeuse', 'hamac', 'échasses', 'périscope', 'métronome', 'catapulte', 'menottes',
  'perceuse', 'arrosoir', 'cintre', 'pince à linge', 'dé à coudre', 'ascenseur', 'escalier roulant', 'distributeur', 'tapis volant', 'lampe magique',
  // Cuisine du monde
  'couscous', 'tajine', 'paella', 'ramen', 'kebab', 'falafel', 'churros', 'tiramisu', 'baklava', 'raclette',
  'crêpe', 'fondue', 'escargots', 'harira', 'msemen', 'thé à la menthe', 'chorba', 'pastilla', 'briouate', 'cornes de gazelle',
  // Personnages & films
  'Pikachu', 'Mario', 'Spiderman', 'Harry Potter', 'Cendrillon', 'Shrek', 'Titanic', 'Minion', 'Aladdin', 'La Reine des Neiges',
  'Batman', 'Dracula', 'Hulk', 'Stitch', 'Bob l\'éponge', 'Tom et Jerry', 'Mickey', 'Maléfique', 'Raiponce', 'Mulan',
  // Animaux rares
  'paresseux', 'ornithorynque', 'caméléon', 'flamant rose', 'méduse', 'scorpion', 'chauve-souris', 'autruche', 'paon', 'hippocampe',
  'lama', 'castor', 'taupe', 'suricate', 'axolotl', 'narval', 'tatou', 'gecko', 'mante religieuse', 'phacochère',
  // Encore plus corsé
  'panneau stop', 'passage piéton', 'station essence', 'casque audio', 'manette', 'chargeur', 'multiprise', 'batterie externe',
  'code secret', 'mot de passe', 'wifi', 'bug informatique', 'capture d\'écran', 'imprimante', 'scanner', 'clé USB',
  'machine à laver', 'aspirateur', 'réfrigérateur', 'micro-ondes', 'grille-pain', 'mixeur', 'casserole', 'poêle',
  'rouleau à pâtisserie', 'planche à découper', 'ouvre-boîte', 'saladier', 'verre doseur', 'tablier', 'toque', 'livreur',
  'feu tricolore', 'embouteillage', 'rond-point', 'parking', 'péage', 'trottinette', 'skateboard', 'rollers',
  'bousculade', 'queue de poisson', 'panne d\'essence', 'contrôle radar', 'permis de conduire', 'carte bancaire',
  'ticket de caisse', 'liste de courses', 'panier', 'caddie', 'cabine d\'essayage', 'étiquette', 'soldes', 'vitrine',
  'boîte aux lettres', 'colis perdu', 'facture', 'signature', 'tampon', 'calendrier', 'réveil', 'agenda',
  'examen', 'antisèche', 'récréation', 'cantine', 'cartable', 'trousse', 'compas', 'rapporteur',
  'diplôme', 'bureau', 'réunion', 'présentation', 'visioconférence', 'micro coupé', 'pause café', 'retard',
  'fou rire', 'malaise', 'grosse fatigue', 'fierté', 'panique', 'suspense', 'trahison', 'réconciliation',
  'cache-cache', 'chasse au trésor', 'jeu de piste', 'karaoké', 'blind test', 'soirée pyjama', 'photomaton', 'selfie raté',
  'potion magique', 'baguette magique', 'portail temporel', 'machine à remonter le temps', 'soucoupe volante', 'rayon laser',
  'base secrète', 'agent double', 'espion', 'détecteur de mensonge', 'coffre-fort', 'empreinte digitale', 'loupe', 'menace',
  'opéra', 'ballet', 'graffiti', 'sculpture', 'portrait robot', 'caricature', 'tatouage', 'déguisement',
  'mariage', 'anniversaire surprise', 'piñata', 'bouquet', 'feu d\'artifice', 'discothèque', 'limousine', 'tapis rouge',
  'bain moussant', 'masque beauté', 'spa', 'sauna', 'serviette', 'peignoir', 'brosse à dents', 'dentifrice',
  'pharmacie', 'pansement', 'béquilles', 'thermomètre', 'stéthoscope', 'ambulance', 'piqûre', 'radiographie',
  'zodiaque', 'horoscope', 'porte-bonheur', 'mauvais œil', 'trèfle', 'fer à cheval', 'étoile filante', 'vœu',
  'météorite', 'éclipse', 'constellation', 'satellite', 'combinaison spatiale', 'trou noir', 'planète Mars', 'voie lactée',
  'pluie de confettis', 'boule à facettes', 'fumigène', 'projecteur', 'rideau rouge', 'coulisses', 'applaudissements', 'rappel',
  // Métiers & personnages à mimer en dessin
  'coiffeuse', 'dentiste', 'arbitre', 'chef cuisinière', 'pompière', 'chirurgienne', 'maîtresse d\'école', 'plombier',
  'astronaute', 'archéologue', 'vétérinaire', 'photographe', 'facteur', 'jardinier', 'pilote', 'serveuse',
  // Actions (plus dur à dessiner !)
  'éternuer', 'ronfler', 'faire la vaisselle', 'se maquiller', 'faire du yoga', 'tricoter', 'applaudir', 'bâiller',
  'faire un selfie', 'promener son chien', 'rater son bus', 'glisser sur une peau de banane', 'faire la bise', 'bouder',
  'chuchoter', 'faire ses lacets', 'chercher ses clés', 'danser le slow', 'faire un câlin', 'claquer la porte',
  // Objets du quotidien
  'trombone', 'élastique à cheveux', 'pince à linge', 'cintre', 'passoire', 'entonnoir', 'arrosoir', 'tapette à mouches',
  'ventilateur', 'radiateur', 'interrupteur', 'poubelle', 'paillasson', 'store', 'moustiquaire', 'rallonge électrique',
  'sèche-cheveux', 'lisseur', 'pince à épiler', 'coton-tige', 'vernis à ongles', 'baume à lèvres', 'crème solaire',
  // Nourriture
  'chawarma', 'harira', 'tajine', 'pastilla', 'chebakia', 'cornes de gazelle', 'thé à la menthe', 'zaalouk',
  'raclette', 'fondue', 'ratatouille', 'quiche', 'éclair au chocolat', 'mille-feuille', 'macaron', 'churros',
  'bubble tea', 'mojito sans alcool', 'smoothie', 'barbe à papa', 'pomme d\'amour', 'marrons chauds',
  // Lieux & scènes
  'salle d\'attente', 'contrôle de sécurité', 'cour de récré', 'salle de sport', 'hammam', 'salon de coiffure',
  'marché aux poissons', 'fête foraine', 'mariage marocain', 'baby shower', 'remise des diplômes', 'examen du permis',
  // Expressions & concepts
  'jet lag', 'lundi matin', 'vendredi soir', 'nuit blanche', 'coup de soleil', 'chair de poule', 'déjà-vu',
  'panne de réveil', 'batterie faible', 'zone blanche', 'mot de passe oublié', 'appel manqué', 'boîte de réception pleine',
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
  return word.split('').map((c, i) => {
    if (isLetter(c)) return (revealedSet && revealedSet.has(i)) ? c : '_';
    return c;
  }).join(' ');
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
    order: [], turnIdx: 0, round: 1, totalRounds: 3,
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
    // Nombre de lettres du mot (sans compter espaces/tirets/apostrophes) — visible par tous.
    letters: state.word ? state.word.split('').filter((c) => isLetter(c)).length : null,
    deadline: state.phase === 'draw' ? state.deadline : null,
    canGuess: state.phase === 'draw' && !isDrawer && state.seats.includes(userId) && !state.guessed[userId],
    iGuessed: !!state.guessed[userId],
    reveal: state.reveal,
    log: state.log.slice(-14),
    winner: state.winner,
  };
}
