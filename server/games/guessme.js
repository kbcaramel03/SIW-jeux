// Moteur de GuessMe, logique pure. 2 à 10 joueuses.
// Chaque manche : une question « ceci ou cela ». 1) tout le monde répond pour
// soi (secret) ; 2) chacune devine la réponse des autres ; 3) révélation et
// points (+1 par bonne devinette). La joueuse avec le plus de points gagne.

const ANSWER_MS = 25000; // délai avant auto-réponse des absentes
const GUESS_MS = 30000;
const REVEAL_MS = 9000;  // pause de révélation avant la manche suivante
const isOffline = (s, id) => !!(s.offline && s.offline[id]);

// Grosse banque de questions « A ou B ? » (le max possible).
const QUESTIONS = [
  // Nourriture & boissons
  ['Coca', 'Pepsi'], ['Sucré', 'Salé'], ['Pizza', 'Burger'], ['Thé', 'Café'],
  ['Chocolat noir', 'Chocolat au lait'], ['Frites', 'Purée'], ['Ketchup', 'Mayo'],
  ['Crêpe', 'Gaufre'], ['Pain au chocolat', 'Croissant'], ['Tacos', 'Kebab'],
  ['Sushi', 'Pâtes'], ['Eau plate', 'Eau gazeuse'], ['Tisane', 'Jus de fruit'],
  ['Glace', 'Gâteau'], ['Fromage', 'Dessert'], ['Épicé', 'Doux'], ['Fraise', 'Framboise'],
  ['Pomme', 'Banane'], ['Cornet', 'Pot de glace'], ['Bonbon', 'Chips'],
  ['Petit-déj sucré', 'Petit-déj salé'], ['Cuisson à point', 'Bien cuit'],
  // Voyage & lieux
  ['Plage', 'Montagne'], ['Ville', 'Campagne'], ['Mer', 'Piscine'], ['Été', 'Hiver'],
  ['Avion', 'Train'], ['Road trip', 'Tout compris'], ['Nord', 'Sud'], ['Désert', 'Forêt'],
  ['Camping', 'Hôtel'], ['Voyage organisé', 'À l\'aventure'], ['Lever de soleil', 'Coucher de soleil'],
  ['Île déserte', 'Grande ville'], ['Randonnée', 'Farniente'], ['Visite culturelle', 'Détente'],
  // Mode de vie
  ['Matinale', 'Couche-tard'], ['Ordre', 'Désordre'], ['Douche', 'Bain'],
  ['Sport', 'Canapé'], ['Lecture', 'Série'], ['Musique forte', 'Silence'],
  ['Économe', 'Dépensière'], ['Planifier', 'Improviser'], ['Solo', 'En groupe'],
  ['Appeler', 'Texter'], ['Photo', 'Vidéo'], ['Chien', 'Chat'],
  ['Maison rangée', 'Maison vivante'], ['Réveil tôt le week-end', 'Grasse matinée'],
  ['Travailler en musique', 'Travailler au calme'], ['Liste de tâches', 'De tête'],
  // Écrans & loisirs
  ['Netflix', 'YouTube'], ['Film', 'Série'], ['Cinéma', 'Maison'], ['Comédie', 'Action'],
  ['Horreur', 'Romance'], ['Manga', 'BD'], ['Jeu vidéo', 'Jeu de société'],
  ['TikTok', 'Instagram'], ['Podcast', 'Radio'], ['Livre papier', 'Livre numérique'],
  ['Documentaire', 'Téléréalité'], ['Concert', 'Festival'], ['Karaoké', 'Soirée dansante'],
  // Personnalité
  ['Timide', 'Extravertie'], ['Logique', 'Émotive'], ['Optimiste', 'Réaliste'],
  ['Tête en l\'air', 'Organisée'], ['Suiveuse', 'Meneuse'], ['Prudente', 'Casse-cou'],
  ['Bavarde', 'Discrète'], ['Patiente', 'Impatiente'], ['Sensible', 'Cool'],
  ['Compétitive', 'Tranquille'], ['Spontanée', 'Réfléchie'], ['Romantique', 'Pragmatique'],
  // Petits dilemmes
  ['Pouvoir voler', 'Être invisible'], ['Lire les pensées', 'Voir le futur'],
  ['Trop chaud', 'Trop froid'], ['Plus de temps', 'Plus d\'argent'],
  ['Célèbre', 'Riche'], ['Passé', 'Futur'], ['Super-force', 'Super-vitesse'],
  ['Toujours en retard', 'Toujours en avance'], ['Perdre la voix', 'Perdre le goût'],
  ['Vivre à la mer', 'Vivre à la montagne'], ['Ne plus jamais voyager', 'Ne plus jamais manger ton plat préféré'],
  ['Gagner au loto', 'Trouver l\'amour'], ['Sans téléphone une semaine', 'Sans dessert un mois'],
  ['Pieds nus', 'En chaussettes'], ['Connaître toutes les langues', 'Jouer de tous les instruments'],
  // Beauté & style
  ['Cheveux lâchés', 'Cheveux attachés'], ['Maquillée', 'Au naturel'],
  ['Talons', 'Baskets'], ['Robe', 'Pantalon'], ['Couleurs vives', 'Tons neutres'],
  ['Bijoux', 'Sobre'], ['Parfum sucré', 'Parfum frais'], ['Vernis', 'Ongles nus'],
  ['Lunettes', 'Lentilles'], ['Chic', 'Décontractée'],
  // Émotions & soirées
  ['Soirée tranquille', 'Soirée folle'], ['Rester', 'Partir tôt'],
  ['Danser', 'Discuter'], ['Surprise', 'Prévenue'], ['Cadeau utile', 'Cadeau fun'],
  ['Fêter en petit comité', 'Grande fête'], ['Rire', 'Pleurer devant un film'],
  // Études & travail
  ['Réviser tôt', 'Réviser à la dernière minute'], ['Travailler seule', 'En équipe'],
  ['Maths', 'Français'], ['Théorie', 'Pratique'], ['Présentiel', 'À distance'],
  ['Bureau rangé', 'Bureau créatif'], ['Email', 'Appel'], ['Note manuscrite', 'Note sur téléphone'],
  // Saisons & ambiance
  ['Printemps', 'Automne'], ['Pluie', 'Canicule'], ['Bougie', 'Guirlande'],
  ['Cosy', 'Minimaliste'], ['Plaid', 'Climatisation'], ['Feu de cheminée', 'Ventilateur'],
  // Divers fun
  ['Salé au ciné', 'Sucré au ciné'], ['Emoji', 'Mots'], ['Vouvoyer', 'Tutoyer'],
  ['Marcher', 'Vélo'], ['Sieste', 'Café'], ['Montre', 'Téléphone pour l\'heure'],
  ['Papier cadeau', 'Sac cadeau'], ['Sapin naturel', 'Sapin artificiel'],
  ['Mer chaude', 'Mer fraîche'], ['Citadine', 'Aventurière'], ['Étoiles', 'Vagues'],
];

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function createGuessMe(options = {}) {
  return {
    type: 'guessme',
    phase: 'waiting', // waiting -> answer -> guess -> reveal -> over
    seats: [],
    scores: {},
    order: [],          // indices de questions, mélangés
    round: 0,
    totalRounds: Math.min(10, QUESTIONS.length),
    question: null,     // { a, b }
    answers: {},        // id -> 'a' | 'b'
    guesses: {},        // guesserId -> { targetId: 'a'|'b' }
    roundGain: {},      // id -> points gagnés à la dernière manche
    since: null,        // début de la phase (auto-play)
    revealAt: null,
    names: {},
    winner: null,
    log: [],
  };
}

export function joinGuessMe(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 10) { state.seats.push(userId); state.scores[userId] = 0; }
}

function beginRound(state) {
  const qi = state.order[state.round];
  state.question = { a: QUESTIONS[qi][0], b: QUESTIONS[qi][1] };
  state.answers = {};
  state.guesses = {};
  state.roundGain = {};
  state.revealAt = null;
  state.phase = 'answer';
  state.since = Date.now();
}

export function startGuessMe(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut au moins 2 joueuses.');
  state.order = shuffle(QUESTIONS.map((_, i) => i));
  state.round = 0;
  state.totalRounds = Math.min(10, QUESTIONS.length);
  for (const id of state.seats) state.scores[id] = 0;
  state.winner = null;
  state.log = ['La partie commence !'];
  beginRound(state);
}

const allAnswered = (s) => s.seats.every((id) => s.answers[id] != null);
function guessesDoneFor(s, id) {
  const g = s.guesses[id] || {};
  return s.seats.filter((t) => t !== id).every((t) => g[t] != null);
}
const allGuessed = (s) => s.seats.every((id) => guessesDoneFor(s, id));

export function answerGuessMe(state, userId, choice) {
  if (state.phase !== 'answer') throw new Error('Pas le moment de répondre.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (choice !== 'a' && choice !== 'b') throw new Error('Réponse invalide.');
  state.answers[userId] = choice;
  if (allAnswered(state)) { state.phase = 'guess'; state.since = Date.now(); }
}

export function guessGuessMe(state, userId, map) {
  if (state.phase !== 'guess') throw new Error('Pas le moment de deviner.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  const clean = {};
  for (const t of state.seats) {
    if (t === userId) continue;
    const v = map && map[t];
    if (v !== 'a' && v !== 'b') throw new Error('Pronostic incomplet.');
    clean[t] = v;
  }
  state.guesses[userId] = clean;
  if (allGuessed(state)) doReveal(state);
}

function doReveal(state) {
  state.roundGain = {};
  for (const id of state.seats) state.roundGain[id] = 0;
  for (const guesser of state.seats) {
    const g = state.guesses[guesser] || {};
    for (const target of state.seats) {
      if (target === guesser) continue;
      if (g[target] && g[target] === state.answers[target]) state.roundGain[guesser] += 1;
    }
  }
  for (const id of state.seats) state.scores[id] = (state.scores[id] || 0) + state.roundGain[id];
  state.phase = 'reveal';
  state.revealAt = Date.now() + REVEAL_MS;
}

export function nextGuessMe(state, userId) {
  if (state.phase !== 'reveal') throw new Error('Pas en fin de manche.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  advance(state);
}

function advance(state) {
  state.round += 1;
  if (state.round >= state.totalRounds) {
    state.phase = 'over';
    let best = -1; let winner = null;
    for (const id of state.seats) if (state.scores[id] > best) { best = state.scores[id]; winner = id; }
    state.winner = winner;
    return;
  }
  beginRound(state);
}

// Horloge serveur : auto-réponse/auto-pronostics des absentes, et pacing de la révélation.
export function tickGuessMe(state) {
  if (state.phase === 'answer') {
    if (!state.since || Date.now() - state.since < ANSWER_MS) return false;
    let changed = false;
    for (const id of state.seats) {
      if (state.answers[id] == null && isOffline(state, id)) { state.answers[id] = Math.random() < 0.5 ? 'a' : 'b'; changed = true; }
    }
    if (changed && allAnswered(state)) { state.phase = 'guess'; state.since = Date.now(); }
    return changed;
  }
  if (state.phase === 'guess') {
    if (!state.since || Date.now() - state.since < GUESS_MS) return false;
    let changed = false;
    for (const id of state.seats) {
      if (!guessesDoneFor(state, id) && isOffline(state, id)) {
        const m = {};
        for (const t of state.seats) if (t !== id) m[t] = Math.random() < 0.5 ? 'a' : 'b';
        state.guesses[id] = m; changed = true;
      }
    }
    if (changed && allGuessed(state)) doReveal(state);
    return changed;
  }
  if (state.phase === 'reveal') {
    if (!state.revealAt || Date.now() < state.revealAt) return false;
    advance(state);
    return true;
  }
  return false;
}

export function viewFor(state, userId) {
  const reveal = state.phase === 'reveal' || state.phase === 'over';
  return {
    type: 'guessme',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    round: state.round + 1,
    totalRounds: state.totalRounds,
    question: state.question,
    myAnswer: state.answers[userId] || null,
    answeredCount: state.seats.filter((id) => state.answers[id] != null).length,
    iGuessed: guessesDoneFor(state, userId),
    guessedCount: state.seats.filter((id) => guessesDoneFor(state, id)).length,
    myGuesses: state.guesses[userId] || {},
    players: state.seats.map((id) => ({
      id,
      score: state.scores[id] || 0,
      answer: reveal ? (state.answers[id] || null) : null,
      gain: state.phase === 'reveal' ? (state.roundGain[id] || 0) : null,
    })),
    revealAt: state.phase === 'reveal' ? state.revealAt : null,
    winner: state.winner,
    log: state.log.slice(-8),
  };
}
