// Moteur du Petit Bac (jeu du baccalauréat), logique pure.
// 2 à 10 joueuses. Avant de démarrer, l'hôte choisit le nombre de manches et
// les catégories. À chaque manche, une lettre est tirée : chacune remplit ses
// catégories dans le temps imparti, puis tout le monde relit et VOTE sur
// chaque mot des autres (✓ valide / ✗ refuse) — plus de ✗ que de ✓ = refusé.
// Points : réponse unique valide = 10, en doublon = 5, vide/invalide = 0.
// Le serveur fait avancer les phases à l'horloge (téléphones en veille ok).

export const ALL_CATEGORIES = [
  'Prénom', 'Animal', 'Ville', 'Pays', 'Métier', 'Objet',
  'Fruit ou légume', 'Plat ou dessert', 'Boisson', 'Marque',
  'Célébrité', 'Film ou série', 'Chanteur ou chanteuse', 'Personnage de fiction',
  'Dessin animé', 'Sport ou loisir', 'Vêtement ou accessoire', 'Fleur ou plante',
  'Dans la cuisine', 'Dans la salle de bain', 'À la plage', 'À l\'école',
  'Application ou site', 'Truc qui fait peur', 'Raison d\'être en retard', 'Cadeau d\'anniversaire',
];
const DEFAULT_CATEGORIES = ['Prénom', 'Animal', 'Ville', 'Métier', 'Objet', 'Fruit ou légume'];
const LETTERS = 'ABCDEFGHIJLMNOPRSTV'; // sans les lettres impossibles (K, Q, W, X, Y, Z, U)
const WRITE_MS = 90000;
const REVIEW_MS = 60000;
const GRACE_MS = 2000; // marge pour laisser arriver les derniers envois

import { aiAvailable, petitbacJudge } from '../ai.js';

const isOffline = (s, id) => !!(s.offline && s.offline[id]);
function nm(state, id) { return (state.names && state.names[id]) || 'quelqu\'un'; }
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
}

export function createPetitBac() {
  return {
    type: 'petitbac',
    phase: 'waiting', // waiting -> write -> review -> (write…) -> over
    seats: [],
    scores: {},
    categories: DEFAULT_CATEGORIES.slice(),
    round: 1,
    rounds: 3,
    letter: null,
    used: [],         // lettres déjà jouées
    answers: {},      // userId -> { catégorie: texte }
    submitted: {},    // userId -> true
    votes: {},        // `${userId}|${cat}` -> { voterId: 1 (✓) | -1 (✗) }
    deadline: null,
    names: {},
    hostId: null,
    winners: null,
    log: [],
  };
}

function pushLog(state, text) { state.log.push(text); if (state.log.length > 30) state.log = state.log.slice(-30); }

export function joinPetitBac(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 10) state.seats.push(userId);
}

// L'hôte règle la partie avant le départ : nombre de manches et catégories.
export function configPetitBac(state, userId, { rounds, categories }) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (userId !== state.hostId) throw new Error('Seule l\'hôte peut régler la partie.');
  if (rounds != null) {
    const r = Math.round(Number(rounds));
    if (!Number.isFinite(r) || r < 1 || r > 10) throw new Error('Nombre de manches invalide (1 à 10).');
    state.rounds = r;
  }
  if (categories != null) {
    if (!Array.isArray(categories)) throw new Error('Catégories invalides.');
    const clean = [...new Set(categories)].filter((c) => ALL_CATEGORIES.includes(c));
    if (clean.length < 3) throw new Error('Choisis au moins 3 catégories.');
    if (clean.length > 10) throw new Error('Pas plus de 10 catégories.');
    state.categories = clean;
  }
}

function newLetter(state) {
  const pool = LETTERS.split('').filter((l) => !state.used.includes(l));
  const letter = pool[Math.floor(Math.random() * pool.length)];
  state.used.push(letter);
  return letter;
}

function startRound(state) {
  state.letter = newLetter(state);
  state.answers = {};
  state.submitted = {};
  state.votes = {};
  state.phase = 'write';
  state.deadline = Date.now() + WRITE_MS;
  pushLog(state, `Manche ${state.round} — lettre ${state.letter} !`);
}

export function startPetitBac(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut au moins 2 joueuses.');
  state.scores = Object.fromEntries(state.seats.map((id) => [id, 0]));
  state.round = 1; state.used = []; state.winners = null; state.log = [];
  startRound(state);
}

// Toutes les joueuses (encore connectées) ont rendu leur copie ?
const allDone = (state) => state.seats.every((id) => state.submitted[id] || isOffline(state, id));

function toReview(state) {
  state.phase = 'review';
  state.deadline = Date.now() + REVIEW_MS;
  pushLog(state, 'Relecture : validez (✓) ou refusez (✗) chaque mot !');
  requestAiVerdicts(state);
}

// Pré-correction par l'IA : elle donne son avis sur chaque mot (✓/✗), mais les
// votes des joueuses gardent TOUJOURS le dernier mot. Sans clé API ou en cas
// de panne, on continue aux votes seuls, comme avant.
function requestAiVerdicts(state) {
  if (!aiAvailable()) { state.ai = null; return; }
  const letter = state.letter;
  const items = [];
  for (const id of state.seats) {
    for (const cat of state.categories) {
      const word = (state.answers[id] || {})[cat] || '';
      if (norm(word).length >= 2) items.push({ id: `${id}|${cat}`, category: cat, word });
    }
  }
  if (!items.length) { state.ai = null; return; }
  state.ai = { status: 'pending' };
  petitbacJudge(letter, items).then((verdicts) => {
    // La manche a pu se terminer entre-temps : on vérifie qu'on parle bien
    // de la même lettre et qu'on est toujours en relecture.
    if (state.phase !== 'review' || state.letter !== letter) return;
    state.ai = verdicts ? { status: 'done', verdicts } : { status: 'off' };
  }).catch(() => { state.ai = { status: 'off' }; });
}

export function submitPetitBac(state, userId, { answers }) {
  if (state.phase !== 'write') throw new Error('Ce n\'est plus le moment d\'écrire.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.submitted[userId]) throw new Error('Déjà envoyé.');
  const clean = {};
  for (const cat of state.categories) {
    clean[cat] = String((answers || {})[cat] || '').trim().slice(0, 40);
  }
  state.answers[userId] = clean;
  state.submitted[userId] = true;
  pushLog(state, `${nm(state, userId)} a rendu sa copie.`);
  if (allDone(state)) toReview(state);
}

// Vote sur le mot d'une autre joueuse : 1 = ✓ valide, -1 = ✗ refuse.
// Revoter pareil retire le vote ; voter autrement change d'avis.
export function votePetitBac(state, userId, { targetId, cat, value }) {
  if (state.phase !== 'review') throw new Error('Pas en phase de relecture.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (targetId === userId) throw new Error('On ne vote pas pour son propre mot.');
  if (!state.categories.includes(cat) || !state.seats.includes(targetId)) throw new Error('Réponse inconnue.');
  const v = value === 1 ? 1 : -1;
  const key = `${targetId}|${cat}`;
  const box = state.votes[key] || (state.votes[key] = {});
  if (box[userId] === v) delete box[userId]; else box[userId] = v;
}

const voteCounts = (state, id, cat) => {
  const box = state.votes[`${id}|${cat}`] || {};
  let plus = 0, minus = 0;
  for (const v of Object.values(box)) { if (v === 1) plus++; else minus++; }
  return { plus, minus };
};

// Un mot est refusé si les ✗ l'emportent sur les ✓ (les votes des autres).
// Sans aucun vote, c'est l'avis de l'IA qui s'applique (si elle a corrigé).
const refused = (state, id, cat) => {
  const { plus, minus } = voteCounts(state, id, cat);
  if (plus + minus > 0) return minus > plus;
  return state.ai?.verdicts?.[`${id}|${cat}`] === false;
};

// Points de la manche en cours : 10 unique, 5 doublon, 0 vide/invalide/refusé.
function roundResults(state) {
  const res = {};
  for (const id of state.seats) res[id] = {};
  for (const cat of state.categories) {
    const counts = {};
    for (const id of state.seats) {
      const text = (state.answers[id] || {})[cat] || '';
      const n = norm(text);
      const valid = n.length >= 2 && n[0] === state.letter.toLowerCase() && !refused(state, id, cat);
      res[id][cat] = { text, valid, n };
      if (valid) counts[n] = (counts[n] || 0) + 1;
    }
    for (const id of state.seats) {
      const r = res[id][cat];
      r.pts = r.valid ? (counts[r.n] > 1 ? 5 : 10) : 0;
      delete r.n;
    }
  }
  return res;
}

function finishRound(state) {
  const res = roundResults(state);
  const gains = state.seats.map((id) => {
    const g = state.categories.reduce((s, cat) => s + res[id][cat].pts, 0);
    state.scores[id] = (state.scores[id] || 0) + g;
    return `${nm(state, id)} +${g}`;
  });
  pushLog(state, `Manche ${state.round} (${state.letter}) : ${gains.join(', ')}.`);
  if (state.round >= state.rounds || state.used.length >= LETTERS.length) {
    state.phase = 'over';
    state.deadline = null;
    const best = Math.max(...state.seats.map((id) => state.scores[id] || 0));
    state.winners = state.seats.filter((id) => (state.scores[id] || 0) === best);
    pushLog(state, state.winners.length > 1
      ? `Égalité à ${best} points !`
      : `${nm(state, state.winners[0])} gagne avec ${best} points !`);
    return;
  }
  state.round += 1;
  startRound(state);
}

// L'hôte peut valider la relecture sans attendre la fin du minuteur.
export function nextPetitBac(state, userId) {
  if (state.phase !== 'review') throw new Error('Pas en phase de relecture.');
  if (userId !== state.hostId) throw new Error('Seule l\'hôte peut valider.');
  finishRound(state);
}

// Horloge serveur : fait tomber les couperets d'écriture et de relecture,
// et diffuse la pré-correction de l'IA dès qu'elle arrive.
export function tickPetitBac(state) {
  if (state.phase === 'review' && state.ai?.status === 'done' && !state.ai.shown) {
    state.ai.shown = true;
    pushLog(state, 'L\'IA a pré-corrigé — vos votes gardent le dernier mot.');
    return true;
  }
  if (!state.deadline || Date.now() < state.deadline + GRACE_MS) return false;
  if (state.phase === 'write') { toReview(state); return true; }
  if (state.phase === 'review') { finishRound(state); return true; }
  return false;
}

export function viewFor(state, userId) {
  return {
    type: 'petitbac',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    scores: { ...state.scores },
    categories: state.categories.slice(),
    allCategories: state.phase === 'waiting' ? ALL_CATEGORIES.slice() : undefined,
    round: state.round,
    rounds: state.rounds,
    letter: state.letter,
    deadline: state.deadline,
    submitted: { ...state.submitted },
    mySubmitted: !!state.submitted[userId],
    // Les réponses des autres ne sont visibles qu'à la relecture.
    results: state.phase === 'review'
      ? (() => {
        const res = roundResults(state);
        for (const id of state.seats) {
          for (const cat of state.categories) {
            const { plus, minus } = voteCounts(state, id, cat);
            const box = state.votes[`${id}|${cat}`] || {};
            res[id][cat].plus = plus;
            res[id][cat].minus = minus;
            res[id][cat].myVote = box[userId] || 0;
            const v = state.ai?.verdicts?.[`${id}|${cat}`];
            res[id][cat].ai = v === true ? 1 : v === false ? -1 : 0;
          }
        }
        return res;
      })()
      : null,
    aiStatus: state.ai?.status || null,
    isHost: userId === state.hostId,
    winners: state.winners ? state.winners.slice() : null,
    log: state.log.slice(-6),
  };
}
