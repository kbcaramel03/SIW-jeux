// Moteur de Bullshit (alias « Cheat » / « Menteur »), logique pure.
// 52 cartes distribuées à toutes les joueurs. Le rang imposé monte à chaque
// tour (A, 2, 3, … K, puis on recommence). À ton tour : pose 1 à 4 cartes face
// cachée en annonçant le rang imposé — tu peux mentir. Ensuite n'importe qui
// peut crier « Bullshit » : on révèle les cartes posées.
//   - si bluff   -> celui qui a posé ramasse toute la pile ;
//   - sinon      -> l'accusateur ramasse toute la pile.
// Si personne ne conteste, le tour passe à la suivante et le rang monte.
// Première à vider sa main (en survivant à la contestation) gagne.

import { aiTurn } from '../ai.js';

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C']; // pique, cœur, carreau, trèfle
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
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ id: id++, rank, suit });
  return deck;
}

export function createBullshit() {
  return {
    type: 'bullshit',
    phase: 'waiting', // waiting -> playing -> challenge -> over
    seats: [],
    hands: {},
    pile: [],
    turn: null,
    rankIndex: 0, // rang imposé = RANKS[rankIndex]
    lastPlay: null, // { by, cardIds, claim, count }
    lastResult: null, // { challenger, by, claim, wasBluff, revealed:[{rank,suit}], loser, picked }
    pendingWinner: null, // joueur ayant vidé sa main, en attente de la fenêtre de contestation
    since: null, // début de l'attente courante (pour l'auto-play des absentes)
    winner: null,
    log: [],
  };
}

export function joinBullshit(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 8) state.seats.push(userId);
}

function dealAll(state) {
  const deck = shuffle(buildDeck());
  for (const id of state.seats) state.hands[id] = [];
  let i = 0;
  while (deck.length) { state.hands[state.seats[i % state.seats.length]].push(deck.pop()); i++; }
}

export function startBullshit(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 3) throw new Error('Il faut au moins 3 joueuses.');
  dealAll(state);
  state.pile = [];
  state.rankIndex = 0;
  state.turn = state.seats[0];
  state.lastPlay = null;
  state.lastResult = null;
  state.pendingWinner = null;
  state.winner = null;
  state.phase = 'playing';
  state.since = Date.now();
  state.log = ['La partie commence !'];
}

const idxOf = (state, id) => state.seats.indexOf(id);
const nextSeat = (state, id) => state.seats[(idxOf(state, id) + 1) % state.seats.length];

export function playBullshit(state, userId, cardIds) {
  if (state.phase !== 'playing') throw new Error('Ce n\'est pas le moment de jouer.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  if (!Array.isArray(cardIds) || cardIds.length < 1 || cardIds.length > 4) throw new Error('Joue 1 à 4 cartes.');
  if (new Set(cardIds).size !== cardIds.length) throw new Error('Cartes en double.');
  const hand = state.hands[userId];
  const chosen = cardIds.map((id) => hand.find((c) => c.id === id));
  if (chosen.some((c) => !c)) throw new Error('Carte introuvable dans ta main.');

  state.hands[userId] = hand.filter((c) => !cardIds.includes(c.id));
  const claim = RANKS[state.rankIndex];
  for (const c of chosen) state.pile.push(c);
  state.lastPlay = { by: userId, cardIds: [...cardIds], claim, count: chosen.length };
  state.lastResult = null;
  state.pendingWinner = state.hands[userId].length === 0 ? userId : null;
  state.turn = nextSeat(state, userId); // la suivante peut accepter ou contester
  state.phase = 'challenge';
  state.since = Date.now();
  state.log.push(`${chosen.length} carte(s) annoncée(s) comme des ${claim}.`);
}

// La joueuse suivante accepte le coup précédent (pas de contestation).
export function passBullshit(state, userId) {
  if (state.phase !== 'challenge') throw new Error('Rien à accepter.');
  if (state.turn !== userId) throw new Error('Seule la joueuse suivante peut accepter.');
  if (state.pendingWinner) {
    state.winner = state.pendingWinner;
    state.phase = 'over';
    state.log.push('Main vidée, personne ne conteste : victoire !');
    return;
  }
  state.rankIndex = (state.rankIndex + 1) % RANKS.length;
  state.lastResult = null;
  state.phase = 'playing'; // c'est maintenant à userId de jouer
  state.since = Date.now();
  state.log.push(`Personne ne conteste. Rang : ${RANKS[state.rankIndex]}.`);
}

export function challengeBullshit(state, userId) {
  if (state.phase !== 'challenge') throw new Error('Rien à contester.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (!state.lastPlay) throw new Error('Aucun coup à contester.');
  if (state.lastPlay.by === userId) throw new Error('Tu ne peux pas contester ton propre coup.');

  const claim = state.lastPlay.claim;
  const revealed = state.lastPlay.cardIds.map((id) => state.pile.find((c) => c.id === id)).filter(Boolean);
  const wasBluff = revealed.some((c) => c.rank !== claim);
  const loser = wasBluff ? state.lastPlay.by : userId;

  const picked = state.pile.length;
  state.hands[loser] = state.hands[loser].concat(state.pile);
  state.pile = [];
  state.lastResult = {
    challenger: userId,
    by: state.lastPlay.by,
    claim,
    wasBluff,
    revealed: revealed.map((c) => ({ rank: c.rank, suit: c.suit })),
    loser,
    picked,
  };

  // La joueuse qui avait vidé sa main gagne si elle ne mentait pas (l'accusatrice se trompe).
  if (state.pendingWinner && !wasBluff) {
    state.winner = state.pendingWinner;
    state.phase = 'over';
    state.lastPlay = null;
    state.log.push('Annonce honnête : main vidée, victoire !');
    return;
  }

  state.pendingWinner = null;
  state.rankIndex = 0; // nouvelle manche, le rang repart à A
  state.turn = loser;  // la perdante ramasse et relance
  state.lastPlay = null;
  state.phase = 'playing';
  state.since = Date.now();
  state.log.push(wasBluff ? `Bluff démasqué ! ${picked} carte(s) ramassée(s).` : `Fausse accusation ! ${picked} carte(s) ramassée(s).`);
}

function sortHand(cards) {
  return [...cards].sort((a, b) => (RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank)) || (SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit)));
}

// Auto-play d'une joueuse absente : honnête si elle a le rang demandé, sinon
// elle pose discrètement une seule carte (bluff minimal).
function autoPlayBullshit(state, userId) {
  const hand = state.hands[userId] || [];
  if (!hand.length) return;
  const claim = RANKS[state.rankIndex];
  const honest = hand.filter((c) => c.rank === claim).slice(0, 4).map((c) => c.id);
  if (honest.length) { playBullshit(state, userId, honest); return; }
  playBullshit(state, userId, [sortHand(hand)[0].id]);
}

// --- Bot ChatGPT : il ne connaît QUE sa main, la taille de la pile et les
// annonces publiques — jamais les cartes des autres. ---------------------
const nm = (state, id) => (state.names && state.names[id]) || 'quelqu\'un';

function describeHand(hand) {
  const byRank = {};
  for (const c of hand) byRank[c.rank] = (byRank[c.rank] || 0) + 1;
  return RANKS.filter((r) => byRank[r]).map((r) => `${byRank[r]}×${r}`).join(', ') || '(vide)';
}

// Options de pose : jouer honnête (1 à 4 vraies cartes) ou bluffer.
function buildPlayChoice(state) {
  const claim = RANKS[state.rankIndex];
  const hand = sortHand(state.hands.bot || []);
  const honest = hand.filter((c) => c.rank === claim);
  const others = hand.filter((c) => c.rank !== claim);
  const options = []; const moves = [];
  for (let k = 1; k <= Math.min(4, honest.length); k++) {
    options.push(`Poser ${k} vrai(s) ${claim} — honnête`);
    moves.push(honest.slice(0, k).map((c) => c.id));
  }
  // Bluffs : on se débarrasse des cartes hautes (les rangs reviendront plus tard).
  for (let k = 1; k <= Math.min(3, others.length); k++) {
    const pick = others.slice(-k);
    options.push(`Bluffer : poser ${k} carte(s) (${pick.map((c) => c.rank).join(', ')}) en annonçant ${claim}`);
    moves.push(pick.map((c) => c.id));
  }
  if (honest.length && others.length) {
    const pick = [...honest.slice(0, 1), others[others.length - 1]];
    options.push(`Mixte : 1 vrai ${claim} + 1 fausse (${pick[1].rank}), annoncés comme 2 ${claim}`);
    moves.push(pick.map((c) => c.id));
  }
  const rivals = state.seats.filter((id) => id !== 'bot').map((id) => `${nm(state, id)} (${state.hands[id].length} cartes)`).join(', ');
  return {
    label: 'le Bullshit (jeu du menteur)',
    rules: 'À ton tour tu poses 1 à 4 cartes face cachée en annonçant le rang imposé — tu as le droit de mentir. Si quelqu\'un crie Bullshit et que tu mentais, tu ramasses toute la pile. Vider sa main fait gagner.',
    situation: `Ta main : ${describeHand(hand)}. Rang imposé : ${claim}. Pile : ${state.pile.length} carte(s). Adversaires : ${rivals}.`,
    options,
    moves,
  };
}

// Options de contestation : accepter ou crier Bullshit.
function buildChallengeChoice(state) {
  const lp = state.lastPlay;
  const mine = (state.hands.bot || []).filter((c) => c.rank === lp.claim).length;
  const warn = state.pendingWinner ? ' ATTENTION : cette joueuse vient de vider sa main — si tu acceptes, elle gagne la partie.' : '';
  return {
    label: 'le Bullshit (jeu du menteur)',
    rules: 'Quelqu\'un vient de poser des cartes face cachée avec une annonce. Si tu cries Bullshit et que c\'était un mensonge, elle ramasse la pile ; si c\'était vrai, c\'est TOI qui ramasses tout.',
    situation: `${nm(state, lp.by)} annonce ${lp.count} carte(s) de rang ${lp.claim}. Il n'existe que 4 cartes de chaque rang et tu en as ${mine} dans ta main. Pile : ${state.pile.length} carte(s).${warn}`,
    options: ['Accepter sans rien dire', 'Crier Bullshit !'],
    moves: ['pass', 'challenge'],
  };
}

// Secours local si l'API ne répond pas : conteste l'impossible, sinon au flair.
function fallbackChallenge(state) {
  const lp = state.lastPlay;
  const mine = (state.hands.bot || []).filter((c) => c.rank === lp.claim).length;
  if (lp.count + mine > 4) return 'challenge';
  if (state.pendingWinner) return Math.random() < 0.6 ? 'challenge' : 'pass';
  return Math.random() < (mine >= 2 ? 0.35 : 0.12) ? 'challenge' : 'pass';
}

// Horloge serveur : le bot joue avec un délai « humain », les absentes après 10 s.
export function tickBullshit(state) {
  if (!state.since) return false;
  if (state.turn === 'bot' && (state.phase === 'playing' || state.phase === 'challenge')) {
    const wait = 1600 + (state.since % 2900);
    if (!state.aiTask && Date.now() - state.since < wait) return false;
    const phase = state.phase;
    const picked = aiTurn(state, () => (phase === 'playing' ? buildPlayChoice(state) : buildChallengeChoice(state)));
    if (picked === 'wait') return false;
    if (phase === 'challenge') {
      const act = picked || fallbackChallenge(state);
      if (act === 'challenge') challengeBullshit(state, 'bot'); else passBullshit(state, 'bot');
      return true;
    }
    try { if (picked) { playBullshit(state, 'bot', picked); return true; } } catch { /* main changée entre-temps */ }
    autoPlayBullshit(state, 'bot');
    return true;
  }
  if (Date.now() - state.since < OFFLINE_SKIP_MS) return false;
  if (state.phase === 'playing' && state.turn && isOffline(state, state.turn)) { autoPlayBullshit(state, state.turn); return true; }
  if (state.phase === 'challenge' && state.turn && isOffline(state, state.turn)) { passBullshit(state, state.turn); return true; }
  return false;
}

export function viewFor(state, userId) {
  const lp = state.lastPlay;
  return {
    type: 'bullshit',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 3 && state.seats.includes(userId),
    seats: state.seats.slice(),
    players: state.seats.map((id) => ({ id, count: state.hands[id] ? state.hands[id].length : 0 })),
    myHand: state.hands[userId] ? sortHand(state.hands[userId]) : [],
    pileCount: state.pile.length,
    currentRank: RANKS[state.rankIndex],
    turn: state.turn,
    isMyTurn: state.phase === 'playing' && state.turn === userId,
    canPass: state.phase === 'challenge' && state.turn === userId,
    canChallenge: state.phase === 'challenge' && state.seats.includes(userId) && !!lp && lp.by !== userId,
    lastPlay: lp ? { by: lp.by, count: lp.count, claim: lp.claim } : null,
    lastResult: state.lastResult,
    winner: state.winner,
  };
}
