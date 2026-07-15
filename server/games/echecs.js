// Moteur d'Échecs (2 joueuses), adossé à chess.js : toutes les règles
// officielles sont garanties (roque, prise en passant, promotion, échec et
// mat, pat, règle des 50 coups, triple répétition, matériel insuffisant).
// L'état stocké est purement JSON : la position courante en FEN (rechargée en
// O(1) par chess.js), plus l'historique SAN pour l'affichage, les captures et
// le compteur de répétitions maintenus au fil de l'eau — compatible avec la
// sauvegarde des salons en base et rapide même en fin de longue partie.
import { Chess } from 'chess.js';
import { aiTurn } from '../ai.js';

const FR_RESULT = {
  mate: 'Échec et mat !',
  stalemate: 'Pat : match nul.',
  material: 'Matériel insuffisant : match nul.',
  threefold: 'Triple répétition : match nul.',
  fifty: 'Règle des 50 coups : match nul.',
  resign: 'Abandon.',
  agreed: 'Nulle acceptée.',
};

// Clé de position pour la triple répétition (FEN sans les compteurs de coups).
const posKey = (fen) => fen.split(' ').slice(0, 4).join(' ');

export function createEchecs() {
  return {
    type: 'echecs',
    phase: 'waiting', // waiting -> playing -> over
    seats: [],
    white: null,
    black: null,
    fen: null,        // position courante
    history: [],      // coups joués (SAN), pour l'affichage
    captured: { w: [], b: [] }, // pièces prises par chaque camp
    lastMove: null,   // { from, to }
    repeats: {},      // clé de position -> nombre d'occurrences
    drawOffer: null,  // userId qui propose nulle
    moveSeq: 0,       // pour les sons côté client
    lastFlags: '',    // drapeaux du dernier coup (capture, roque…)
    winner: null,
    result: null,
    names: {},
  };
}

export function joinEchecs(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 2) state.seats.push(userId);
}

export function startEchecs(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.seats.length < 2) throw new Error('Il faut 2 joueuses.');
  const [a, b] = Math.random() < 0.5 ? state.seats : [state.seats[1], state.seats[0]];
  state.white = a; state.black = b;
  const chess = new Chess();
  state.fen = chess.fen();
  state.history = []; state.captured = { w: [], b: [] }; state.lastMove = null;
  state.repeats = { [posKey(state.fen)]: 1 };
  state.drawOffer = null; state.winner = null; state.result = null;
  state.phase = 'playing';
}

function colorOf(state, userId) {
  return state.white === userId ? 'w' : state.black === userId ? 'b' : null;
}

export function moveEchecs(state, userId, { from, to, promotion }) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  const color = colorOf(state, userId);
  if (!color) throw new Error('Tu n\'es pas dans la partie.');
  const chess = new Chess(state.fen);
  if (chess.turn() !== color) throw new Error('Ce n\'est pas ton tour.');
  let mv;
  try {
    mv = chess.move({ from, to, promotion: promotion || undefined });
  } catch {
    throw new Error('Coup illégal.');
  }
  state.fen = chess.fen();
  state.history.push(mv.san);
  if (mv.captured) state.captured[mv.color].push(mv.captured);
  state.lastMove = { from: mv.from, to: mv.to };
  state.moveSeq += 1;
  state.lastFlags = mv.flags; // c = capture, e = en passant, k/q = roque, p = promotion
  state.drawOffer = null;     // toute proposition de nulle tombe après un coup

  const key = posKey(state.fen);
  state.repeats[key] = (state.repeats[key] || 0) + 1;

  if (chess.isCheckmate()) { state.phase = 'over'; state.winner = userId; state.result = 'mate'; return; }
  if (chess.isStalemate()) { state.phase = 'over'; state.result = 'stalemate'; return; }
  if (chess.isInsufficientMaterial()) { state.phase = 'over'; state.result = 'material'; return; }
  if (state.repeats[key] >= 3) { state.phase = 'over'; state.result = 'threefold'; return; }
  if (chess.isDraw()) { state.phase = 'over'; state.result = 'fifty'; }
}

export function resignEchecs(state, userId) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  const color = colorOf(state, userId);
  if (!color) throw new Error('Tu n\'es pas dans la partie.');
  state.phase = 'over';
  state.winner = color === 'w' ? state.black : state.white;
  state.result = 'resign';
}

export function drawEchecs(state, userId) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (!colorOf(state, userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.drawOffer && state.drawOffer !== userId) {
    state.phase = 'over';
    state.result = 'agreed';
  } else {
    state.drawOffer = userId;
  }
}

// --- Bot d'échecs : négamax profondeur 2 avec élagage alpha-bêta -----------
// Assez fort pour ne pas donner ses pièces, assez faible pour rester battable.
const PIECE_VAL = { p: 100, n: 305, b: 320, r: 500, q: 900, k: 0 };

// Matériel du camp au trait moins celui de l'adversaire, lu directement dans
// le FEN : ~10× plus rapide que board(), et appelé des centaines de fois.
function evalSideToMove(chess) {
  const [placement, turn] = chess.fen().split(' ');
  let score = 0;
  for (const ch of placement) {
    const low = ch.toLowerCase();
    const v = PIECE_VAL[low];
    if (!v) continue;
    const isBlack = ch === low;
    score += (isBlack === (turn === 'b')) ? v : -v;
  }
  return score;
}

function negamax(chess, depth, alpha, beta) {
  // Aux feuilles : évaluation directe, SANS générer les coups (c'était ça qui
  // rendait chaque coup du bot 30× trop lent et bloquait le serveur).
  if (depth === 0) return evalSideToMove(chess);
  // Mat/pat détectés par la liste de coups (isCheckmate() à chaque nœud coûte cher).
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return chess.inCheck() ? -99999 - depth : 0;
  // Captures d'abord : l'élagage coupe beaucoup plus tôt.
  moves.sort((a, b) => (b.captured ? PIECE_VAL[b.captured] : 0) - (a.captured ? PIECE_VAL[a.captured] : 0));
  let best = -Infinity;
  for (const m of moves) {
    chess.move(m);
    const v = -negamax(chess, depth - 1, -beta, -alpha);
    chess.undo();
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

// Trois niveaux : la proportion de bourdes (coup au hasard) et le bruit sur
// l'évaluation (plus il est grand, moins le bot joue le coup parfait).
const LEVELS = {
  facile: { blunder: 0.3, noise: 220 },
  moyen: { blunder: 0.1, noise: 90 },
  difficile: { blunder: 0, noise: 15 },
};

function botMove(chess, level) {
  const { blunder, noise } = LEVELS[level] || LEVELS.moyen;
  const moves = chess.moves({ verbose: true });
  if (Math.random() < blunder) return moves[Math.floor(Math.random() * moves.length)];
  let best = null; let bestScore = -Infinity;
  for (const m of moves) {
    chess.move(m);
    const v = -negamax(chess, 1, -Infinity, Infinity) + Math.random() * noise;
    chess.undo();
    if (v > bestScore) { bestScore = v; best = m; }
  }
  return best;
}

// Horloge serveur : ChatGPT choisit le coup du bot (négamax local en secours).
export function tickEchecs(state) {
  if (state.phase !== 'playing') return false;
  const botColor = state.white === 'bot' ? 'w' : state.black === 'bot' ? 'b' : null;
  if (!botColor) return false;
  const chess = new Chess(state.fen);
  if (chess.turn() !== botColor) { state.botAt = null; state.aiTask = null; return false; }
  if (!state.aiTask) {
    if (!state.botAt) { state.botAt = Date.now() + 2000; return false; }
    if (Date.now() < state.botAt) return false;
  }
  state.botAt = null;
  const legal = chess.moves({ verbose: true });
  const picked = aiTurn(state, () => ({
    label: 'les Échecs',
    rules: `Tu joues les ${botColor === 'w' ? 'Blancs' : 'Noirs'}. Les options sont tes coups légaux en notation SAN. Ton niveau affiché est « ${state.botLevel || 'moyen'} » : joue en conséquence.`,
    situation: `Position (FEN) : ${state.fen}. Derniers coups : ${state.history.slice(-10).join(' ') || '(début de partie)'}.`,
    options: legal.map((m) => m.san),
    moves: legal.map((m) => ({ from: m.from, to: m.to, promotion: m.promotion ? 'q' : undefined })),
  }));
  if (picked === 'wait') return false;
  let mv = picked;
  if (!mv) {
    const b = botMove(chess, state.botLevel);
    mv = b ? { from: b.from, to: b.to, promotion: b.promotion ? 'q' : undefined } : null;
  }
  if (!mv) return false;
  moveEchecs(state, 'bot', mv);
  return true;
}

export function viewFor(state, userId) {
  const chess = state.fen ? new Chess(state.fen) : null;
  const myColor = colorOf(state, userId);
  const isMyTurn = !!chess && state.phase === 'playing' && myColor === chess.turn();
  return {
    type: 'echecs',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length === 2 && state.seats.includes(userId),
    seats: state.seats.slice(),
    white: state.white,
    black: state.black,
    myColor,
    turnColor: chess ? chess.turn() : null,
    isMyTurn,
    board: chess ? chess.board().map((row) => row.map((sq) => (sq ? { type: sq.type, color: sq.color } : null))) : null,
    legal: isMyTurn
      ? chess.moves({ verbose: true }).map((m) => ({ from: m.from, to: m.to, promotion: !!m.promotion }))
      : [],
    inCheck: chess ? chess.inCheck() : false,
    lastMove: state.lastMove,
    history: state.history.slice(-12),
    moveCount: state.history.length,
    captured: { w: state.captured.w.slice(), b: state.captured.b.slice() },
    moveSeq: state.moveSeq,
    lastFlags: state.lastFlags,
    drawOffer: state.drawOffer,
    winner: state.winner,
    result: state.result,
    resultText: state.result ? FR_RESULT[state.result] : null,
  };
}
