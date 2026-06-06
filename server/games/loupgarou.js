// Moteur de Loup-Garou, logique pure (rôles cachés, nuit/jour, maître du jeu vocal côté client).
// Rôles : loup, villageois, voyante, sorciere, chasseur. Les cartes spéciales sont
// choisies en pré-jeu (config). Nuit : voyante -> loups -> sorcière. Jour : débat puis vote.
// Le village gagne si tous les loups sont morts ; les loups gagnent s'ils sont >= aux autres.

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const SPECIALS = ['voyante', 'sorciere', 'chasseur'];

export function createLoupGarou() {
  return {
    type: 'loupgarou',
    phase: 'setup', // setup -> night -> day -> vote -> hunter -> over
    nightStep: null, // seer | wolves | witch
    config: { wolves: 2, voyante: true, sorciere: true, chasseur: true },
    seats: [],
    roles: {},
    alive: {},
    nightNo: 0,
    wolfVotes: {},
    pendingVictim: null,
    witch: { healUsed: false, killUsed: false, healChosen: false, killTarget: null },
    seerSeen: {},      // voyanteId -> { targetId, role } (résultat de la nuit)
    votes: {},
    hunterPending: null,
    dayDeadline: null, // fin du débat du jour (2 min)
    resumeTo: null,    // 'day' | 'night' : où reprendre après le tir du Chasseur
    lastDeaths: [],    // morts révélés au réveil
    sayId: 0,          // déclencheur de narration côté client
    say: '',
    winner: null,
    log: [],
  };
}

export function joinLoupGarou(state, userId) {
  if (state.phase !== 'setup') throw new Error('La partie a déjà commencé.');
  if (!state.seats.includes(userId) && state.seats.length < 18) state.seats.push(userId);
}

export function configLoupGarou(state, userId, config) {
  if (state.phase !== 'setup') throw new Error('Trop tard pour configurer.');
  if (config.wolves != null) state.config.wolves = Math.max(1, Math.min(6, Number(config.wolves) || 1));
  for (const s of SPECIALS) if (config[s] != null) state.config[s] = !!config[s];
}

function aliveIds(state) { return state.seats.filter((id) => state.alive[id]); }
function aliveWolves(state) { return aliveIds(state).filter((id) => state.roles[id] === 'loup'); }
function aliveRole(state, role) { return aliveIds(state).find((id) => state.roles[id] === role) || null; }

function narrate(state, text) { state.say = text; state.sayId += 1; }

export function startLoupGarou(state, userId) {
  if (state.phase !== 'setup') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  const n = state.seats.length;
  if (n < 4) throw new Error('Il faut au moins 4 joueurs.');
  const specials = SPECIALS.filter((s) => state.config[s]);
  const wolves = Math.max(1, Math.min(state.config.wolves, n - specials.length - 1));
  const need = wolves + specials.length;
  if (n < need + 1) throw new Error('Pas assez de joueurs pour ces rôles.');

  const pool = [...Array(wolves).fill('loup'), ...specials];
  while (pool.length < n) pool.push('villageois');
  const shuffled = shuffle(pool);
  const order = shuffle(state.seats);
  state.roles = {}; state.alive = {};
  order.forEach((id, i) => { state.roles[id] = shuffled[i]; state.alive[id] = true; });
  state.witch = { healUsed: false, killUsed: false, healChosen: false, killTarget: null };
  state.nightNo = 0;
  state.log = ['La partie commence !'];
  beginNight(state);
}

function firstStep(state) {
  if (aliveRole(state, 'voyante')) return 'seer';
  if (aliveWolves(state).length) return 'wolves';
  return null;
}
function nextStep(state, step) {
  const order = ['seer', 'wolves', 'witch'];
  let i = order.indexOf(step) + 1;
  for (; i < order.length; i++) {
    if (order[i] === 'wolves' && aliveWolves(state).length) return 'wolves';
    if (order[i] === 'seer' && aliveRole(state, 'voyante')) return 'seer';
    if (order[i] === 'witch' && aliveRole(state, 'sorciere')) return 'witch';
  }
  return null;
}

function beginNight(state) {
  state.nightNo += 1;
  state.phase = 'night';
  state.wolfVotes = {};
  state.pendingVictim = null;
  state.witch.healChosen = false; state.witch.killTarget = null;
  state.seerSeen = {};
  state.lastDeaths = [];
  state.nightStep = firstStep(state);
  narrate(state, state.nightNo === 1 ? 'La nuit tombe. Le village s\'endort…' : 'La nuit revient. Le village s\'endort…');
  if (!state.nightStep) resolveNight(state);
  else announceStep(state);
}

function announceStep(state) {
  if (state.nightStep === 'seer') narrate(state, 'La Voyante se réveille et désigne une personne à sonder.');
  else if (state.nightStep === 'wolves') narrate(state, aliveWolves(state).length > 1
    ? 'Les Loups-Garous se réveillent et choisissent leur victime.'
    : 'Le Loup-Garou se réveille et choisit sa victime.');
  else if (state.nightStep === 'witch') narrate(state, 'La Sorcière se réveille. Veux-tu empoisonner ou ressusciter quelqu\'un ?');
}

function advanceNight(state, fromStep) {
  const nx = nextStep(state, fromStep);
  if (!nx) { resolveNight(state); return; }
  state.nightStep = nx;
  announceStep(state);
}

export function seerSee(state, userId, targetId) {
  if (state.phase !== 'night' || state.nightStep !== 'seer') throw new Error('Pas le moment.');
  if (state.roles[userId] !== 'voyante' || !state.alive[userId]) throw new Error('Tu n\'es pas la Voyante.');
  if (!state.alive[targetId] || targetId === userId) throw new Error('Cible invalide.');
  state.seerSeen[userId] = { targetId, role: state.roles[targetId] };
  advanceNight(state, 'seer');
}

export function wolfPick(state, userId, targetId) {
  if (state.phase !== 'night' || state.nightStep !== 'wolves') throw new Error('Pas le moment.');
  if (state.roles[userId] !== 'loup' || !state.alive[userId]) throw new Error('Tu n\'es pas un Loup.');
  if (!state.alive[targetId] || state.roles[targetId] === 'loup') throw new Error('Cible invalide.');
  state.wolfVotes[userId] = targetId;
  const wolves = aliveWolves(state);
  if (wolves.every((w) => state.wolfVotes[w])) {
    const tally = {};
    for (const w of wolves) tally[state.wolfVotes[w]] = (tally[state.wolfVotes[w]] || 0) + 1;
    const max = Math.max(...Object.values(tally));
    const top = Object.keys(tally).filter((id) => tally[id] === max);
    state.pendingVictim = top[Math.floor(Math.random() * top.length)];
    advanceNight(state, 'wolves');
  }
}

export function witchAct(state, userId, { heal, killTarget }) {
  if (state.phase !== 'night' || state.nightStep !== 'witch') throw new Error('Pas le moment.');
  if (state.roles[userId] !== 'sorciere' || !state.alive[userId]) throw new Error('Tu n\'es pas la Sorcière.');
  if (heal && !state.witch.healUsed && state.pendingVictim) { state.witch.healChosen = true; state.witch.healUsed = true; }
  if (killTarget && !state.witch.killUsed && state.alive[killTarget]) { state.witch.killTarget = killTarget; state.witch.killUsed = true; }
  resolveNight(state);
}

function killPlayer(state, id, deaths) {
  if (!state.alive[id]) return;
  state.alive[id] = false;
  deaths.push(id);
  if (state.roles[id] === 'chasseur') state.hunterPending = id; // tirera ensuite
}

function resolveNight(state) {
  const deaths = [];
  if (state.pendingVictim && !state.witch.healChosen) killPlayer(state, state.pendingVictim, deaths);
  if (state.witch.killTarget) killPlayer(state, state.witch.killTarget, deaths);
  state.lastDeaths = deaths;
  state.nightStep = null;
  if (checkWin(state)) return;
  if (state.hunterPending) { state.phase = 'hunter'; state.resumeTo = 'day'; narrate(state, 'Dans un dernier souffle, le Chasseur saisit son fusil…'); return; }
  openDay(state);
}

function openDay(state) {
  state.phase = 'day';
  state.votes = {};
  state.dayDeadline = Date.now() + 120000; // 2 minutes pour débattre
  const n = state.lastDeaths.length;
  const morts = n ? `${n} personne${n > 1 ? 's sont mortes' : ' est morte'} cette nuit.` : 'Personne n\'est mort cette nuit.';
  narrate(state, `Le village se réveille. ${morts} Vous avez 2 minutes pour décider qui abattre aujourd'hui.`);
}

export function callVote(state, userId) {
  if (state.phase !== 'day') throw new Error('Pas le moment.');
  if (!state.seats.includes(userId)) throw new Error('Interdit.');
  state.phase = 'vote';
  state.votes = {};
  narrate(state, 'Le village doit désigner un coupable. Que le vote commence !');
}

export function dayVote(state, userId, targetId) {
  if (state.phase !== 'vote') throw new Error('Pas de vote en cours.');
  if (!state.alive[userId]) throw new Error('Les morts ne votent pas.');
  if (!state.alive[targetId]) throw new Error('Cible invalide.');
  state.votes[userId] = targetId;
  const voters = aliveIds(state);
  if (voters.every((id) => state.votes[id])) {
    const tally = {};
    for (const v of voters) tally[state.votes[v]] = (tally[state.votes[v]] || 0) + 1;
    const max = Math.max(...Object.values(tally));
    const top = Object.keys(tally).filter((id) => tally[id] === max);
    const deaths = [];
    if (top.length === 1) { killPlayer(state, top[0], deaths); }
    state.lastDeaths = deaths;
    narrate(state, deaths.length ? 'Le village a parlé. Le bûcher s\'embrase…' : 'Égalité… personne n\'est exécuté aujourd\'hui.');
    if (checkWin(state)) return;
    if (state.hunterPending) { state.phase = 'hunter'; state.resumeTo = 'night'; narrate(state, 'Le Chasseur, touché, lève son arme une dernière fois…'); return; }
    beginNight(state);
  }
}

export function hunterShoot(state, userId, targetId) {
  if (state.phase !== 'hunter') throw new Error('Pas le moment.');
  if (state.hunterPending !== userId) throw new Error('Ce n\'est pas à toi de tirer.');
  state.hunterPending = null;
  const deaths = [];
  if (state.alive[targetId]) killPlayer(state, targetId, deaths);
  if (checkWin(state)) return;
  if (state.hunterPending) { state.phase = 'hunter'; return; } // un chasseur a tué un chasseur
  if (state.resumeTo === 'night') beginNight(state);
  else openDay(state);
}

function checkWin(state) {
  const wolves = aliveWolves(state).length;
  const others = aliveIds(state).length - wolves;
  if (wolves === 0) { state.phase = 'over'; state.winner = 'village'; narrate(state, 'L\'aube se lève : tous les Loups ont été éliminés. Le village triomphe !'); return true; }
  if (wolves >= others) { state.phase = 'over'; state.winner = 'loups'; narrate(state, 'Les Loups-Garous l\'emportent… le village a perdu.'); return true; }
  return false;
}

export function viewFor(state, userId) {
  const meRole = state.roles[userId] || null;
  const amWolf = meRole === 'loup';
  const over = state.phase === 'over';
  const players = state.seats.map((id) => ({
    id,
    alive: !!state.alive[id],
    // Rôle révélé si mort ou fin de partie ; les loups se voient entre eux.
    role: (over || !state.alive[id] || (amWolf && state.roles[id] === 'loup')) ? state.roles[id] : null,
  }));
  const isWitchStep = state.phase === 'night' && state.nightStep === 'witch' && meRole === 'sorciere' && state.alive[userId];
  return {
    type: 'loupgarou',
    phase: state.phase,
    nightStep: state.nightStep,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'setup' && state.seats.length >= 4 && state.seats.includes(userId),
    config: state.config,
    seats: state.seats.slice(),
    players,
    myRole: meRole,
    alive: !!state.alive[userId],
    fellowWolves: amWolf ? aliveWolves(state) : null,
    nightNo: state.nightNo,
    // Actions possibles
    canSee: state.phase === 'night' && state.nightStep === 'seer' && meRole === 'voyante' && state.alive[userId] && !state.seerSeen[userId],
    seerResult: state.seerSeen[userId] || null,
    canWolf: state.phase === 'night' && state.nightStep === 'wolves' && amWolf && state.alive[userId] && !state.wolfVotes[userId],
    wolfTarget: state.wolfVotes[userId] || null,
    witch: isWitchStep ? { victim: state.pendingVictim, healLeft: !state.witch.healUsed, killLeft: !state.witch.killUsed } : null,
    canVote: state.phase === 'vote' && state.alive[userId] && !state.votes[userId],
    myVote: state.votes[userId] || null,
    canShoot: state.phase === 'hunter' && state.hunterPending === userId,
    lastDeaths: state.lastDeaths.slice(),
    dayDeadline: state.phase === 'day' ? (state.dayDeadline || null) : null,
    say: state.say,
    sayId: state.sayId,
    winner: state.winner,
  };
}
