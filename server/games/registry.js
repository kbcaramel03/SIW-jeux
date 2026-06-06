// Catalogue des jeux. `ready: true` = jouable, sinon "bientôt disponible".
// Au fur et à mesure qu'on code les jeux, on les passe à ready: true.
import * as codenames from './codenames.js';
import * as battleship from './battleship.js';
import * as uno from './uno.js';
import * as flip7 from './flip7.js';
import * as bullshit from './bullshit.js';
import * as conspiracy from './conspiracy.js';
import * as loupgarou from './loupgarou.js';

export const GAMES = {
  codenames: {
    key: 'codenames',
    label: 'Code Names',
    emoji: '🕵️',
    minPlayers: 2,
    maxPlayers: 10,
    ready: true,
    create: codenames.createCodenames,
    view: codenames.viewFor,
    action: applyCodenamesAction,
  },
  bataille: {
    key: 'bataille', label: 'Bataille navale', emoji: '🚢', minPlayers: 2, maxPlayers: 2, ready: true,
    create: battleship.createBattleship,
    view: battleship.viewFor,
    action: applyBattleshipAction,
  },
  uno: {
    key: 'uno', label: 'Uno', emoji: '🎴', minPlayers: 2, maxPlayers: 8, ready: true,
    create: uno.createUno,
    view: uno.viewFor,
    action: applyUnoAction,
  },
  flip7: {
    key: 'flip7', label: 'Flip 7', emoji: '🔢', minPlayers: 2, maxPlayers: 8, ready: true,
    create: flip7.createFlip7,
    view: flip7.viewFor,
    action: applyFlip7Action,
  },
  bullshit: {
    key: 'bullshit', label: 'Bullshit', emoji: '🤥', minPlayers: 2, maxPlayers: 8, ready: true,
    create: bullshit.createBullshit,
    view: bullshit.viewFor,
    action: applyBullshitAction,
  },
  conspiracy: {
    key: 'conspiracy', label: 'Conspiracy', emoji: '🕯️', minPlayers: 4, maxPlayers: 8, ready: true,
    create: conspiracy.createConspiracy,
    view: conspiracy.viewFor,
    action: applyConspiracyAction,
  },
  scribbl: { key: 'scribbl', label: 'Scribbl', emoji: '🎨', minPlayers: 2, maxPlayers: 10, ready: false },
  loupgarou: {
    key: 'loupgarou', label: 'Loup Garou', emoji: '🐺', minPlayers: 4, maxPlayers: 18, ready: true,
    create: loupgarou.createLoupGarou,
    view: loupgarou.viewFor,
    action: applyLoupGarouAction,
  },
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
    case 'select':
      return codenames.selectCard(state, userId, payload.index);
    case 'confirm':
      return codenames.confirmCard(state, userId);
    case 'pass':
      return codenames.passTurn(state, userId);
    default:
      throw new Error('Action inconnue.');
  }
}

function applyUnoAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join':
      return uno.joinUno(state, userId);
    case 'start':
      return uno.startUno(state, userId);
    case 'play':
      return uno.playCard(state, userId, payload.cardId, payload.color);
    case 'draw':
      return uno.drawUno(state, userId);
    case 'pass':
      return uno.passUno(state, userId);
    default:
      throw new Error('Action inconnue.');
  }
}

function applyFlip7Action(state, userId, payload) {
  switch (payload.kind) {
    case 'join':
      return flip7.joinFlip7(state, userId);
    case 'start':
      return flip7.startFlip7(state, userId);
    case 'hit':
      return flip7.hitFlip7(state, userId);
    case 'stay':
      return flip7.stayFlip7(state, userId);
    case 'resolve':
      return flip7.resolveAction(state, userId, payload.targetId);
    case 'next':
      return flip7.nextRound(state, userId);
    default:
      throw new Error('Action inconnue.');
  }
}

function applyBullshitAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join':
      return bullshit.joinBullshit(state, userId);
    case 'start':
      return bullshit.startBullshit(state, userId);
    case 'play':
      return bullshit.playBullshit(state, userId, payload.cardIds);
    case 'pass':
      return bullshit.passBullshit(state, userId);
    case 'challenge':
      return bullshit.challengeBullshit(state, userId);
    default:
      throw new Error('Action inconnue.');
  }
}

function applyConspiracyAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join':
      return conspiracy.joinConspiracy(state, userId);
    case 'start':
      return conspiracy.startConspiracy(state, userId);
    case 'propose':
      return conspiracy.proposeTeam(state, userId, payload.team);
    case 'vote':
      return conspiracy.voteTeam(state, userId, payload.approve);
    case 'card':
      return conspiracy.playMissionCard(state, userId, payload.value);
    case 'next':
      return conspiracy.nextMission(state, userId);
    default:
      throw new Error('Action inconnue.');
  }
}

function applyLoupGarouAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join': return loupgarou.joinLoupGarou(state, userId);
    case 'config': return loupgarou.configLoupGarou(state, userId, payload.config || {});
    case 'start': return loupgarou.startLoupGarou(state, userId);
    case 'see': return loupgarou.seerSee(state, userId, payload.targetId);
    case 'wolf': return loupgarou.wolfPick(state, userId, payload.targetId);
    case 'witch': return loupgarou.witchAct(state, userId, { heal: payload.heal, killTarget: payload.killTarget });
    case 'callVote': return loupgarou.callVote(state, userId);
    case 'vote': return loupgarou.dayVote(state, userId, payload.targetId);
    case 'shoot': return loupgarou.hunterShoot(state, userId, payload.targetId);
    default: throw new Error('Action inconnue.');
  }
}

function applyBattleshipAction(state, userId, payload) {
  switch (payload.kind) {
    case 'shuffle':
      return battleship.shuffleFleet(state, userId);
    case 'ready':
      return battleship.setReady(state, userId, payload.value !== false);
    case 'fire':
      return battleship.fire(state, userId, payload.x, payload.y);
    default:
      throw new Error('Action inconnue.');
  }
}
