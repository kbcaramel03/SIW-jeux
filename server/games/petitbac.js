// Moteur du Petit Bac (jeu du baccalauréat), logique pure.
// 2 à 10 joueuses. À chaque manche, une lettre est tirée : chacune remplit
// ses catégories dans le temps imparti, puis tout le monde relit les réponses
// et peut contester celles des autres (majorité = réponse refusée).
// Points : réponse unique valide = 10, en doublon = 5, vide/invalide = 0.
// Le serveur fait avancer les phases à l'horloge (téléphones en veille ok).

export const CATEGORIES = ['Prénom', 'Animal', 'Ville ou pays', 'Nourriture', 'Métier', 'Objet'];
const LETTERS = 'ABCDEFGHIJLMNOPRSTV'; // sans les lettres impossibles (K, Q, W, X, Y, Z, U)
const ROUNDS = 3;
const WRITE_MS = 90000;
const REVIEW_MS = 45000;
const GRACE_MS = 2000; // marge pour laisser arriver les derniers envois

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
    categories: CATEGORIES.slice(),
    round: 1,
    rounds: ROUNDS,
    letter: null,
    used: [],         // lettres déjà jouées
    answers: {},      // userId -> { catégorie: texte }
    submitted: {},    // userId -> true
    rejects: {},      // `${userId}|${cat}` -> [id des contestataires]
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
  state.rejects = {};
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
  pushLog(state, 'Relecture : contestez les réponses douteuses !');
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

export function rejectPetitBac(state, userId, { targetId, cat }) {
  if (state.phase !== 'review') throw new Error('Pas en phase de relecture.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (targetId === userId) throw new Error('Tu ne peux pas contester ta propre réponse.');
  if (!state.categories.includes(cat) || !state.seats.includes(targetId)) throw new Error('Réponse inconnue.');
  const key = `${targetId}|${cat}`;
  const voters = state.rejects[key] || (state.rejects[key] = []);
  const i = voters.indexOf(userId);
  if (i >= 0) voters.splice(i, 1); else voters.push(userId); // toggle
}

// Une réponse est refusée si la majorité des AUTRES joueuses la conteste.
const rejected = (state, id, cat) =>
  (state.rejects[`${id}|${cat}`] || []).length >= Math.ceil((state.seats.length - 1) / 2);

// Points de la manche en cours : 10 unique, 5 doublon, 0 vide/invalide/refusée.
function roundResults(state) {
  const res = {};
  for (const id of state.seats) res[id] = {};
  for (const cat of state.categories) {
    const counts = {};
    for (const id of state.seats) {
      const text = (state.answers[id] || {})[cat] || '';
      const n = norm(text);
      const valid = n.length >= 2 && n[0] === state.letter.toLowerCase() && !rejected(state, id, cat);
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
  if (state.round >= state.rounds) {
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

// Horloge serveur : fait tomber les couperets d'écriture et de relecture.
export function tickPetitBac(state) {
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
            const voters = state.rejects[`${id}|${cat}`] || [];
            res[id][cat].rejects = voters.length;
            res[id][cat].iRejected = voters.includes(userId);
          }
        }
        return res;
      })()
      : null,
    isHost: userId === state.hostId,
    winners: state.winners ? state.winners.slice() : null,
    log: state.log.slice(-6),
  };
}
