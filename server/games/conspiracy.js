// Moteur de Conspiracy (déduction sociale « Société vs Espions », style The Resistance).
// La Société ne sait pas qui est qui ; les Espions se connaissent entre eux.
// 5 missions max. Chaque mission : une cheffe propose une équipe -> tout le monde
// vote Pour/Contre -> si acceptée, les membres jouent secrètement Succès/Sabotage
// (la Société DOIT réussir). On révèle seulement le nombre de sabotages.
//   - >= sabotages requis -> mission échouée ; sinon réussie.
// Premier camp à 3 missions gagne. 3 rejets d'affilée -> résultat aléatoire.

const SPIES_BY_COUNT = { 4: 1, 5: 2, 6: 2, 7: 3, 8: 3 };

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Tailles d'équipe par mission selon le nombre de joueurs.
// 4 & 5 joueurs : deux variantes possibles, tirées au sort au début.
function pickTeamSizes(n) {
  if (n === 4 || n === 5) {
    const variants = [[2, 2, 2, 3, 3], [2, 3, 2, 3, 3]];
    return variants[Math.floor(Math.random() * variants.length)];
  }
  if (n === 6) return [2, 3, 4, 3, 4];
  if (n === 7) return [2, 3, 3, 4, 4];
  return [3, 4, 4, 5, 5]; // 8
}

export function createConspiracy() {
  return {
    type: 'conspiracy',
    phase: 'waiting', // waiting -> team -> vote -> mission -> reveal -> over
    seats: [],
    roles: {},        // id -> 'spy' | 'society'
    spies: [],
    teamSizes: null,
    mission: 0,       // index 0..4
    results: [],      // 'success' | 'fail' (missions terminées, public)
    leaderIdx: 0,
    team: [],
    votes: {},        // id -> bool (secret jusqu'au dépouillement)
    lastVote: null,   // { approve:[], reject:[], approved }
    rejectStreak: 0,
    missionCards: {}, // id -> 'success'|'fail' (secret)
    lastReveal: null, // { fails, outcome, need, random }
    winner: null,     // 'society' | 'spies'
    log: [],
  };
}

export function joinConspiracy(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 8) state.seats.push(userId);
}

export function startConspiracy(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  const n = state.seats.length;
  if (n < 4) throw new Error('Il faut au moins 4 joueurs.');
  const spyCount = SPIES_BY_COUNT[n];
  const order = shuffle(state.seats);
  state.roles = {}; state.spies = [];
  order.forEach((id, i) => {
    const spy = i < spyCount;
    state.roles[id] = spy ? 'spy' : 'society';
    if (spy) state.spies.push(id);
  });
  state.teamSizes = pickTeamSizes(n);
  state.mission = 0;
  state.results = [];
  state.leaderIdx = Math.floor(Math.random() * n);
  state.team = []; state.votes = {}; state.lastVote = null; state.rejectStreak = 0;
  state.missionCards = {}; state.lastReveal = null; state.winner = null;
  state.phase = 'team';
  state.log = ['La partie commence !'];
}

function recordOutcome(state, outcome, info) {
  state.results.push(outcome);
  state.lastReveal = info;
  const succ = state.results.filter((r) => r === 'success').length;
  const fail = state.results.filter((r) => r === 'fail').length;
  if (succ >= 3) { state.winner = 'society'; state.phase = 'over'; }
  else if (fail >= 3) { state.winner = 'spies'; state.phase = 'over'; }
  else state.phase = 'reveal';
}

function tallyVotes(state) {
  const n = state.seats.length;
  const approves = state.seats.filter((id) => state.votes[id]).length;
  const approved = approves * 2 > n; // majorité stricte (égalité = refus)
  state.lastVote = {
    approve: state.seats.filter((id) => state.votes[id]),
    reject: state.seats.filter((id) => state.votes[id] === false),
    approved,
  };
  state.leaderIdx = (state.leaderIdx + 1) % n; // la chefferie passe après chaque vote
  if (approved) {
    state.rejectStreak = 0;
    state.missionCards = {};
    state.phase = 'mission';
  } else {
    state.rejectStreak += 1;
    if (state.rejectStreak >= 3) {
      // 3 rejets d'affilée : la mission est résolue au hasard.
      const outcome = Math.random() < 0.5 ? 'success' : 'fail';
      state.rejectStreak = 0;
      recordOutcome(state, outcome, { random: true, outcome });
    } else {
      state.team = []; state.votes = {};
      state.phase = 'team';
    }
  }
}

export function proposeTeam(state, userId, team) {
  if (state.phase !== 'team') throw new Error('Ce n\'est pas le moment de proposer une équipe.');
  if (state.seats[state.leaderIdx] !== userId) throw new Error('Tu n\'es pas la cheffe ce tour-ci.');
  const size = state.teamSizes[state.mission];
  if (!Array.isArray(team) || team.length !== size) throw new Error(`Il faut exactement ${size} membres.`);
  if (new Set(team).size !== team.length) throw new Error('Doublon dans l\'équipe.');
  if (team.some((id) => !state.seats.includes(id))) throw new Error('Membre invalide.');
  state.team = [...team];
  state.votes = {};
  state.lastVote = null;
  state.phase = 'vote';
}

export function voteTeam(state, userId, approve) {
  if (state.phase !== 'vote') throw new Error('Aucun vote en cours.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  if (state.votes[userId] != null) throw new Error('Tu as déjà voté.');
  state.votes[userId] = !!approve;
  if (state.seats.every((id) => state.votes[id] != null)) tallyVotes(state);
}

export function playMissionCard(state, userId, value) {
  if (state.phase !== 'mission') throw new Error('Aucune mission en cours.');
  if (!state.team.includes(userId)) throw new Error('Tu n\'es pas dans l\'équipe.');
  if (state.missionCards[userId] != null) throw new Error('Tu as déjà joué ta carte.');
  if (value !== 'success' && value !== 'fail') throw new Error('Carte invalide.');
  if (state.roles[userId] === 'society' && value === 'fail') throw new Error('La Société doit réussir la mission.');
  state.missionCards[userId] = value;
  if (state.team.every((id) => state.missionCards[id] != null)) {
    const fails = state.team.filter((id) => state.missionCards[id] === 'fail').length;
    const need = (state.mission === 3 && state.seats.length >= 7) ? 2 : 1; // mission 4 renforcée à 7-8
    const outcome = fails >= need ? 'fail' : 'success';
    recordOutcome(state, outcome, { fails, outcome, need });
  }
}

export function nextMission(state, userId) {
  if (state.phase !== 'reveal') throw new Error('Pas en fin de mission.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  state.mission += 1;
  state.team = []; state.votes = {}; state.lastVote = null; state.lastReveal = null;
  state.missionCards = {}; state.rejectStreak = 0;
  state.phase = 'team'; // la chefferie a déjà tourné au dépouillement
}

export function viewFor(state, userId) {
  const me = state.roles[userId] || null;
  const isSpy = me === 'spy';
  const n = state.seats.length;
  const leader = state.phase === 'waiting' ? null : (state.seats[state.leaderIdx] ?? null);
  return {
    type: 'conspiracy',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && n >= 4 && state.seats.includes(userId),
    seats: state.seats.slice(),
    players: state.seats.map((id) => ({ id })),
    myRole: me,
    spies: isSpy ? state.spies.slice() : null,
    spyCount: state.phase === 'waiting' ? null : (SPIES_BY_COUNT[n] ?? null),
    missionNo: state.mission + 1,
    teamSizes: state.teamSizes,
    teamSize: state.teamSizes ? state.teamSizes[state.mission] : null,
    results: state.results.slice(),
    leader,
    isLeader: state.phase === 'team' && leader === userId,
    team: state.team.slice(),
    hasVoted: state.votes[userId] != null,
    votedCount: state.seats.filter((id) => state.votes[id] != null).length,
    lastVote: state.lastVote,
    amOnTeam: state.team.includes(userId),
    hasSubmitted: state.missionCards[userId] != null,
    submittedCount: Object.keys(state.missionCards).length,
    lastReveal: state.lastReveal,
    rejectStreak: state.rejectStreak,
    winner: state.winner,
  };
}
