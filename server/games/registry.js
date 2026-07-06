// Catalogue des jeux. `ready: true` = jouable, sinon "bientôt disponible".
// Au fur et à mesure qu'on code les jeux, on les passe à ready: true.
import * as codenames from './codenames.js';
import * as battleship from './battleship.js';
import * as uno from './uno.js';
import * as flip7 from './flip7.js';
import * as bullshit from './bullshit.js';
import * as conspiracy from './conspiracy.js';
import * as loupgarou from './loupgarou.js';
import * as scribbl from './scribbl.js';
import * as ludo from './ludo.js';
import * as echecs from './echecs.js';
import * as gofish from './gofish.js';
import * as pouilleux from './pouilleux.js';
import * as guessme from './guessme.js';
import * as pool from './pool.js';
import * as archery from './archery.js';
import * as petitbac from './petitbac.js';

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
    tick: uno.tickUno,
  },
  flip7: {
    key: 'flip7', label: 'Flip 7', emoji: '🔢', minPlayers: 2, maxPlayers: 8, ready: true,
    create: flip7.createFlip7,
    view: flip7.viewFor,
    action: applyFlip7Action,
    tick: flip7.tickFlip7,
  },
  bullshit: {
    key: 'bullshit', label: 'Bullshit', emoji: '🤥', minPlayers: 2, maxPlayers: 8, ready: true,
    create: bullshit.createBullshit,
    view: bullshit.viewFor,
    action: applyBullshitAction,
    tick: bullshit.tickBullshit,
  },
  conspiracy: {
    key: 'conspiracy', label: 'Conspiracy', emoji: '🕯️', minPlayers: 4, maxPlayers: 8, ready: true,
    create: conspiracy.createConspiracy,
    view: conspiracy.viewFor,
    action: applyConspiracyAction,
    tick: conspiracy.tickConspiracy,
  },
  scribbl: {
    key: 'scribbl', label: 'Scribbl', emoji: '🎨', minPlayers: 2, maxPlayers: 10, ready: true,
    create: scribbl.createScribbl,
    view: scribbl.viewFor,
    action: applyScribblAction,
    tick: scribbl.tickScribbl,
  },
  loupgarou: {
    key: 'loupgarou', label: 'Loup Garou', emoji: '🐺', minPlayers: 4, maxPlayers: 18, ready: true,
    create: loupgarou.createLoupGarou,
    view: loupgarou.viewFor,
    action: applyLoupGarouAction,
    tick: loupgarou.tickLoupGarou,
  },
  ludo: {
    key: 'ludo', label: 'Ludo', emoji: '🎲', minPlayers: 2, maxPlayers: 4, ready: true,
    create: ludo.createLudo,
    view: ludo.viewFor,
    action: applyLudoAction,
    tick: ludo.tickLudo,
  },
  echecs: {
    key: 'echecs', label: 'Échecs', emoji: '♟️', minPlayers: 2, maxPlayers: 2, ready: true,
    create: echecs.createEchecs,
    view: echecs.viewFor,
    action: applyEchecsAction,
  },
  gofish: {
    key: 'gofish', label: 'Go Fish', emoji: '🐠', minPlayers: 2, maxPlayers: 6, ready: true,
    create: gofish.createGoFish,
    view: gofish.viewFor,
    action: applyGoFishAction,
    tick: gofish.tickGoFish,
  },
  pouilleux: {
    key: 'pouilleux', label: 'Zombie', emoji: '🧟', minPlayers: 2, maxPlayers: 6, ready: true,
    create: pouilleux.createPouilleux,
    view: pouilleux.viewFor,
    action: applyPouilleuxAction,
    tick: pouilleux.tickPouilleux,
  },
  guessme: {
    key: 'guessme', label: 'GuessMe', emoji: '❓', minPlayers: 2, maxPlayers: 10, ready: true,
    create: guessme.createGuessMe,
    view: guessme.viewFor,
    action: applyGuessMeAction,
    tick: guessme.tickGuessMe,
  },
  pool: {
    key: 'pool', label: 'Billard', emoji: '🎱', minPlayers: 2, maxPlayers: 2, ready: true,
    create: pool.createPool,
    view: pool.viewFor,
    action: applyPoolAction,
    tick: pool.tickPool,
  },
  archery: {
    key: 'archery', label: 'Tir à l\'arc', emoji: '🏹', minPlayers: 2, maxPlayers: 6, ready: true,
    create: archery.createArchery,
    view: archery.viewFor,
    action: applyArcheryAction,
    tick: archery.tickArchery,
  },
  petitbac: {
    key: 'petitbac', label: 'Petit Bac', emoji: '✏️', minPlayers: 2, maxPlayers: 10, ready: true,
    create: petitbac.createPetitBac,
    view: petitbac.viewFor,
    action: applyPetitBacAction,
    tick: petitbac.tickPetitBac,
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
      return codenames.confirmCard(state, userId, payload.index);
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

function applyScribblAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join': return scribbl.joinScribbl(state, userId);
    case 'start': return scribbl.startScribbl(state, userId);
    case 'choose': return scribbl.chooseWord(state, userId, payload.word);
    case 'guess': return scribbl.guessScribbl(state, userId, payload.text);
    case 'timeup': return scribbl.timeupScribbl(state, userId);
    case 'reveal': return scribbl.revealScribbl(state, userId);
    case 'next': return scribbl.nextScribbl(state, userId);
    default: throw new Error('Action inconnue.');
  }
}

function applyEchecsAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join': return echecs.joinEchecs(state, userId);
    case 'start': return echecs.startEchecs(state, userId);
    case 'move': return echecs.moveEchecs(state, userId, payload);
    case 'resign': return echecs.resignEchecs(state, userId);
    case 'draw': return echecs.drawEchecs(state, userId);
    default: throw new Error('Action inconnue.');
  }
}

function applyGoFishAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join': return gofish.joinGoFish(state, userId);
    case 'start': return gofish.startGoFish(state, userId);
    case 'ask': return gofish.askGoFish(state, userId, payload.targetId, payload.rank);
    default: throw new Error('Action inconnue.');
  }
}

function applyPouilleuxAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join': return pouilleux.joinPouilleux(state, userId);
    case 'start': return pouilleux.startPouilleux(state, userId);
    case 'draw': return pouilleux.drawPouilleux(state, userId, payload.index);
    default: throw new Error('Action inconnue.');
  }
}

function applyPoolAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join': return pool.joinPool(state, userId);
    case 'start': return pool.startPool(state, userId);
    case 'shoot': return pool.shootPool(state, userId, payload);
    default: throw new Error('Action inconnue.');
  }
}

function applyPetitBacAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join': return petitbac.joinPetitBac(state, userId);
    case 'start': return petitbac.startPetitBac(state, userId);
    case 'submit': return petitbac.submitPetitBac(state, userId, payload);
    case 'reject': return petitbac.rejectPetitBac(state, userId, payload);
    case 'next': return petitbac.nextPetitBac(state, userId);
    default: throw new Error('Action inconnue.');
  }
}

function applyArcheryAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join': return archery.joinArchery(state, userId);
    case 'start': return archery.startArchery(state, userId);
    case 'shoot': return archery.shootArchery(state, userId, payload);
    default: throw new Error('Action inconnue.');
  }
}

function applyGuessMeAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join': return guessme.joinGuessMe(state, userId);
    case 'start': return guessme.startGuessMe(state, userId);
    case 'answer': return guessme.answerGuessMe(state, userId, payload.choice);
    case 'guess': return guessme.guessGuessMe(state, userId, payload.guesses);
    case 'next': return guessme.nextGuessMe(state, userId);
    default: throw new Error('Action inconnue.');
  }
}

function applyLudoAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join': return ludo.joinLudo(state, userId);
    case 'start': return ludo.startLudo(state, userId);
    case 'roll': return ludo.rollLudo(state, userId);
    case 'move': return ludo.moveLudo(state, userId, payload.pawn);
    default: throw new Error('Action inconnue.');
  }
}

function applyLoupGarouAction(state, userId, payload) {
  switch (payload.kind) {
    case 'join': return loupgarou.joinLoupGarou(state, userId);
    case 'config': return loupgarou.configLoupGarou(state, userId, payload.config || {});
    case 'start': return loupgarou.startLoupGarou(state, userId);
    case 'cupid': return loupgarou.cupidLink(state, userId, payload.a, payload.b);
    case 'wild': return loupgarou.wildPick(state, userId, payload.targetId);
    case 'guard': return loupgarou.guardProtect(state, userId, payload.targetId);
    case 'see': return loupgarou.seerSee(state, userId, payload.targetId);
    case 'wolf': return loupgarou.wolfPick(state, userId, payload.targetId);
    case 'witch': return loupgarou.witchAct(state, userId, { heal: payload.heal, killTarget: payload.killTarget });
    case 'callVote': return loupgarou.callVote(state, userId);
    case 'vote': return loupgarou.dayVote(state, userId, payload.targetId);
    case 'voteTimeout': return loupgarou.voteTimeout(state, userId);
    case 'resolveVote': return loupgarou.resolveVote(state, userId);
    case 'resume': return loupgarou.resumeLoupGarou(state, userId);
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
