// Catalogue des jeux. `ready: true` = jouable, sinon "bientôt disponible".
// Au fur et à mesure qu'on code les jeux, on les passe à ready: true.
import * as codenames from './codenames.js';

export const GAMES = {
  codenames: {
    key: 'codenames',
    label: 'Code Names',
    emoji: '🕵️',
    minPlayers: 4,
    maxPlayers: 8,
    ready: true,
    create: codenames.createCodenames,
    view: codenames.viewFor,
    action: applyCodenamesAction,
  },
  bataille: { key: 'bataille', label: 'Bataille navale', emoji: '🚢', minPlayers: 2, maxPlayers: 2, ready: false },
  uno: { key: 'uno', label: 'Uno', emoji: '🎴', minPlayers: 2, maxPlayers: 8, ready: false },
  flip7: { key: 'flip7', label: 'Flip 7', emoji: '🔢', minPlayers: 2, maxPlayers: 8, ready: false },
  bullshit: { key: 'bullshit', label: 'Bullshit', emoji: '🤥', minPlayers: 3, maxPlayers: 8, ready: false },
  conspiracy: { key: 'conspiracy', label: 'Conspiracy', emoji: '🕯️', minPlayers: 4, maxPlayers: 10, ready: false },
  scribbl: { key: 'scribbl', label: 'Scribbl', emoji: '🎨', minPlayers: 2, maxPlayers: 10, ready: false },
  loupgarou: { key: 'loupgarou', label: 'Loup Garou', emoji: '🐺', minPlayers: 5, maxPlayers: 18, ready: false },
};

export function gameList() {
  return Object.values(GAMES).map(({ key, label, emoji, minPlayers, maxPlayers, ready }) => ({
    key, label, emoji, minPlayers, maxPlayers, ready,
  }));
}

function applyCodenamesAction(state, userId, payload) {
  switch (payload.kind) {
    case 'assign':
      return codenames.assignRole(state, userId, payload.team, payload.role);
    case 'start':
      return codenames.startGame(state);
    case 'clue':
      return codenames.giveClue(state, userId, payload.word, payload.count);
    case 'guess':
      return codenames.guessCard(state, userId, payload.index);
    case 'pass':
      return codenames.passTurn(state, userId);
    default:
      throw new Error('Action inconnue.');
  }
}
