// Moteur de Loup-Garou, logique pure (rôles cachés, nuit/jour, maître du jeu vocal côté client).
// Rôles : loup, villageois, voyante, sorciere, chasseur, cupidon, garde, ange, enfant (sauvage).
// Nuit (ordre) : cupidon -> enfant sauvage -> garde -> voyante -> loups -> sorcière. Jour : débat + vote.
// Village gagne si plus de loups. Loups gagnent s'ils sont >= aux autres.
// Cas spéciaux : amoureux (Cupidon) meurent ensemble et gagnent s'ils sont les 2 derniers ;
// Ange gagne seul s'il est éliminé au 1er tour ; Enfant Sauvage devient loup si son modèle meurt.
//
// Rythme / ambiance : entre les phases (matin après la nuit, verdict après le vote) on passe
// par une phase « reveal » d'une dizaine de secondes où le maître du jeu commente (avec les
// prénoms) — l'hôte fait avancer le minuteur. Les votes du jour sont publics (aura sur la cible).
// Les prénoms (state.names) sont injectés par la couche temps réel avant chaque action.

function shuffle(a) {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
const SPECIALS = ['voyante', 'sorciere', 'chasseur', 'cupidon', 'garde', 'ange', 'enfant'];
const NIGHT_ORDER = ['cupid', 'wildchild', 'guard', 'seer', 'wolves', 'witch'];
const REVEAL_MS = 11000;
const DAY_MS = 120000;
const VOTE_MS = 45000;
// Si tous les joueurs attendus à une étape sont déconnectés depuis ce délai,
// on passe l'étape automatiquement (la partie ne reste plus jamais figée).
const OFFLINE_SKIP_MS = 45000;

export function createLoupGarou() {
  return {
    type: 'loupgarou',
    phase: 'setup', // setup -> night -> reveal -> day -> vote -> reveal -> hunter -> over
    nightStep: null,
    config: { wolves: 2, voyante: true, sorciere: true, chasseur: true, cupidon: true, garde: false, ange: false, enfant: false },
    seats: [],
    names: {},
    roles: {},
    alive: {},
    nightNo: 0,
    lovers: [],
    wildModel: null,
    guardLast: null,
    guardProtected: null,
    wolfVotes: {},
    pendingVictim: null,
    witch: { healUsed: false, killUsed: false, healChosen: false, killTarget: null },
    seerSeen: {},
    votes: {},
    hunterPending: null,
    stepSince: null,
    resumeTo: null,
    dayDeadline: null,
    voteDeadline: null,
    voteResultDeadline: null,
    revealDeadline: null,
    lastDeaths: [],
    sayId: 0,
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

const aliveIds = (s) => s.seats.filter((id) => s.alive[id]);
const isOffline = (s, id) => !!(s.offline && s.offline[id]);
const aliveWolves = (s) => aliveIds(s).filter((id) => s.roles[id] === 'loup');
const aliveRole = (s, role) => aliveIds(s).find((id) => s.roles[id] === role) || null;
function narrate(state, text) { state.say = text; state.sayId += 1; }
function nm(state, id) { return (state.names && state.names[id]) || 'quelqu\'un'; }
function nameList(state, ids) {
  const ns = ids.map((id) => nm(state, id));
  if (ns.length <= 1) return ns.join('');
  return `${ns.slice(0, -1).join(', ')} et ${ns[ns.length - 1]}`;
}

export function startLoupGarou(state, userId) {
  if (state.phase !== 'setup') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  const n = state.seats.length;
  if (n < 4) throw new Error('Il faut au moins 4 joueurs.');
  const specials = SPECIALS.filter((s) => state.config[s]);
  const wolves = Math.max(1, Math.min(state.config.wolves, n - specials.length - 1));
  if (n < wolves + specials.length + 1) throw new Error('Pas assez de joueurs pour ces rôles.');

  const pool = [...Array(wolves).fill('loup'), ...specials];
  while (pool.length < n) pool.push('villageois');
  const shuffled = shuffle(pool);
  const order = shuffle(state.seats);
  state.roles = {}; state.alive = {};
  order.forEach((id, i) => { state.roles[id] = shuffled[i]; state.alive[id] = true; });
  state.witch = { healUsed: false, killUsed: false, healChosen: false, killTarget: null };
  state.lovers = []; state.wildModel = null; state.guardLast = null;
  state.nightNo = 0; state.winner = null;
  state.voteDeadline = null; state.revealDeadline = null; state.resumeTo = null;
  state.log = ['La partie commence !'];
  beginNight(state);
}

function stepApplicable(state, step) {
  if (step === 'cupid') return state.nightNo === 1 && !!aliveRole(state, 'cupidon') && state.lovers.length === 0;
  if (step === 'wildchild') return state.nightNo === 1 && !!aliveRole(state, 'enfant') && !state.wildModel;
  if (step === 'guard') return !!aliveRole(state, 'garde');
  if (step === 'seer') return !!aliveRole(state, 'voyante');
  if (step === 'wolves') return aliveWolves(state).length > 0;
  if (step === 'witch') return !!aliveRole(state, 'sorciere');
  return false;
}
function firstStep(state) { return NIGHT_ORDER.find((s) => stepApplicable(state, s)) || null; }
function nextStep(state, from) {
  const i = NIGHT_ORDER.indexOf(from);
  for (let k = i + 1; k < NIGHT_ORDER.length; k++) if (stepApplicable(state, NIGHT_ORDER[k])) return NIGHT_ORDER[k];
  return null;
}

function beginNight(state) {
  state.nightNo += 1;
  state.phase = 'night';
  state.wolfVotes = {}; state.pendingVictim = null;
  state.witch.healChosen = false; state.witch.killTarget = null;
  state.seerSeen = {}; state.guardProtected = null; state.lastDeaths = [];
  state.revealDeadline = null; state.voteDeadline = null;
  state.nightStep = firstStep(state);
  narrate(state, state.nightNo === 1
    ? pick([
      'La nuit tombe sur le village… Fermez les yeux, et que les âmes sensibles retiennent leur souffle.',
      'La première nuit s\'installe doucement. Le village s\'endort, confiant… peut-être un peu trop.',
      'Les lanternes s\'éteignent une à une. Que la nuit commence…',
    ])
    : pick([
      'La nuit revient, plus lourde que la précédente. Tout le monde s\'endort…',
      'L\'obscurité reprend ses droits. Fermez les yeux, le village s\'endort…',
      'Une nouvelle nuit enveloppe le village. Silence… et dormez.',
    ]));
  if (!state.nightStep) resolveNight(state);
  else announceStep(state);
}

function announceStep(state) {
  const t = {
    cupid: 'Cupidon se réveille sur la pointe des pieds. Qui vas-tu unir par les liens de l\'amour ?',
    wildchild: 'L\'Enfant Sauvage ouvre les yeux et choisit en secret son modèle…',
    guard: 'Le Garde se lève dans l\'ombre et veille sur l\'un d\'entre vous.',
    seer: 'La Voyante se réveille et plonge dans sa boule de cristal… qui veux-tu sonder ?',
    wolves: aliveWolves(state).length > 1
      ? 'Les Loups-Garous se réveillent en silence et désignent leur proie de cette nuit…'
      : 'Le Loup-Garou se réveille, affamé, et choisit sa victime…',
    witch: 'La Sorcière se réveille auprès de son chaudron. Veux-tu sauver, empoisonner… ou ne rien faire ?',
  }[state.nightStep];
  state.stepSince = Date.now();
  if (t) narrate(state, t);
}
function advanceNight(state, from) {
  const nx = nextStep(state, from);
  if (!nx) { resolveNight(state); return; }
  state.nightStep = nx; announceStep(state);
}

export function cupidLink(state, userId, a, b) {
  if (state.phase !== 'night' || state.nightStep !== 'cupid') throw new Error('Pas le moment.');
  if (state.roles[userId] !== 'cupidon' || !state.alive[userId]) throw new Error('Tu n\'es pas Cupidon.');
  if (!a || !b || a === b || !state.alive[a] || !state.alive[b]) throw new Error('Choisis deux personnes différentes.');
  state.lovers = [a, b];
  advanceNight(state, 'cupid');
}
export function wildPick(state, userId, targetId) {
  if (state.phase !== 'night' || state.nightStep !== 'wildchild') throw new Error('Pas le moment.');
  if (state.roles[userId] !== 'enfant' || !state.alive[userId]) throw new Error('Tu n\'es pas l\'Enfant Sauvage.');
  if (!state.alive[targetId] || targetId === userId) throw new Error('Cible invalide.');
  state.wildModel = targetId;
  advanceNight(state, 'wildchild');
}
export function guardProtect(state, userId, targetId) {
  if (state.phase !== 'night' || state.nightStep !== 'guard') throw new Error('Pas le moment.');
  if (state.roles[userId] !== 'garde' || !state.alive[userId]) throw new Error('Tu n\'es pas le Garde.');
  if (!state.alive[targetId]) throw new Error('Cible invalide.');
  if (targetId === state.guardLast) throw new Error('Pas deux nuits de suite la même personne.');
  state.guardProtected = targetId; state.guardLast = targetId;
  advanceNight(state, 'guard');
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
  // Un loup déconnecté ne bloque pas la meute : on n'attend que les présents.
  const wolves = aliveWolves(state);
  if (wolves.every((w) => state.wolfVotes[w] || isOffline(state, w))) closeWolves(state);
}

// Dépouille les voix des loups (même partielles) et passe à la suite.
function closeWolves(state) {
  const cast = aliveWolves(state).map((w) => state.wolfVotes[w]).filter(Boolean);
  if (cast.length) {
    const tally = {};
    for (const t of cast) tally[t] = (tally[t] || 0) + 1;
    const max = Math.max(...Object.values(tally));
    const top = Object.keys(tally).filter((id) => tally[id] === max);
    state.pendingVictim = top[Math.floor(Math.random() * top.length)];
  } else {
    state.pendingVictim = null;
  }
  advanceNight(state, 'wolves');
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
  if (state.roles[id] === 'chasseur') state.hunterPending = id;
  // Enfant Sauvage : si son modèle meurt, il rejoint les loups.
  if (state.wildModel === id) {
    const child = state.seats.find((w) => state.roles[w] === 'enfant' && state.alive[w]);
    if (child) state.roles[child] = 'loup';
  }
  // Amoureux : le/la partenaire meurt de chagrin.
  if (state.lovers.includes(id)) {
    const other = state.lovers.find((x) => x !== id);
    if (other && state.alive[other]) killPlayer(state, other, deaths);
  }
}

function checkAnge(state) {
  // L'Ange gagne s'il est éliminé pendant le premier tour (1re nuit ou 1er vote).
  if (state.nightNo === 1 && state.lastDeaths.some((id) => state.roles[id] === 'ange')) {
    state.phase = 'over'; state.winner = 'ange';
    narrate(state, 'L\'Ange a été éliminé dès le premier tour : son vœu est exaucé, il l\'emporte… seul !');
    return true;
  }
  return false;
}

// Phase « reveal » : pause commentée (~11 s) avant la suite. `resumeTo` = 'day' ou 'night'.
function enterReveal(state, resumeTo, text) {
  state.phase = 'reveal';
  state.resumeTo = resumeTo;
  state.revealDeadline = Date.now() + REVEAL_MS;
  state.dayDeadline = null; state.voteDeadline = null;
  narrate(state, text);
}

function morningText(state, deaths) {
  if (deaths.length === 0) {
    return pick([
      'Le soleil se lève… et, ô miracle, tout le monde est encore là ! Personne n\'est mort cette nuit.',
      'Le jour se lève sur un village intact. Pas une victime — les loups auraient-ils hésité ?',
      'L\'aube est douce ce matin : personne n\'a péri cette nuit. Profitez-en…',
    ]);
  }
  const who = nameList(state, deaths);
  const plural = deaths.length > 1;
  const intro = pick([
    'Le jour se lève… mais le village est en deuil.',
    'Le coq chante, et avec lui vient la terrible nouvelle.',
    'Le soleil éclaire une scène bien triste ce matin.',
  ]);
  const verb = plural ? 'nous ont quittés cette nuit' : 'nous a quittés cette nuit';
  const sigh = pick([
    plural ? 'Quel gâchis… on les aimait bien.' : 'Oh, quel dommage… on l\'aimait bien.',
    'Un lourd silence tombe sur la place du village.',
    'Le village ne sera plus jamais tout à fait le même.',
    plural ? 'Reposez en paix, vous nous manquerez.' : 'Repose en paix, tu nous manqueras.',
  ]);
  return `${intro} ${who} ${verb}. ${sigh}`;
}

function verdictText(state, deaths, executed) {
  if (deaths.length === 0) {
    return pick([
      'Le village n\'arrive pas à se décider… Personne ne sera exécuté aujourd\'hui. Les loups jubilent en silence.',
      'Égalité ! La corde restera au placard ce soir. Espérons que vous ne le regrettiez pas…',
    ]);
  }
  const who = nameList(state, deaths);
  return pick([
    `Le village a parlé. ${who} est conduit au bûcher… La sentence est tombée.`,
    `D\'un même élan, le village condamne ${who}. Que justice soit faite !`,
    `${who} paie le prix de la méfiance générale. On verra bientôt si le village a eu raison…`,
  ]);
}

function resolveNight(state) {
  const deaths = [];
  if (state.pendingVictim && state.pendingVictim !== state.guardProtected && !state.witch.healChosen) killPlayer(state, state.pendingVictim, deaths);
  if (state.witch.killTarget) killPlayer(state, state.witch.killTarget, deaths);
  state.lastDeaths = deaths;
  state.nightStep = null;
  if (checkAnge(state)) return;
  if (checkWin(state)) return;
  if (state.hunterPending) {
    state.phase = 'hunter'; state.resumeTo = 'day'; state.stepSince = Date.now();
    narrate(state, 'Dans un dernier souffle, le Chasseur empoigne son fusil… qui va-t-il emporter ?');
    return;
  }
  enterReveal(state, 'day', morningText(state, deaths));
}

function openDay(state) {
  state.phase = 'day';
  state.votes = {};
  state.dayDeadline = Date.now() + DAY_MS;
  state.revealDeadline = null;
  narrate(state, pick([
    'Place au débat ! Démasquez les loups… vous avez deux minutes avant le vote.',
    'À vous de jouer, villageois. Discutez, accusez, défendez-vous : deux minutes au compteur.',
    'Le village se rassemble sur la place. Qui est suspect ? Deux minutes pour en débattre.',
  ]));
}

function startVote(state) {
  state.phase = 'vote'; state.votes = {};
  state.dayDeadline = null;
  state.voteResultDeadline = null;
  state.voteDeadline = Date.now() + VOTE_MS;
  narrate(state, pick([
    'Assez parlé ! L\'heure du jugement a sonné. Que chacun désigne son suspect.',
    'Le temps presse : choisissez votre suspect, puis validez votre vote.',
    'Que le vote commence ! Désignez celui ou celle que vous soupçonnez, puis validez.',
  ]));
}

export function callVote(state, userId) {
  if (state.phase !== 'day') throw new Error('Pas le moment.');
  if (!state.seats.includes(userId)) throw new Error('Interdit.');
  // Le vote démarre tout seul à la fin des 2 minutes de débat ; l'hôte peut
  // aussi écourter le débat à tout moment (« Passer au vote »).
  const isHost = state.hostId && userId === state.hostId;
  if (!isHost && state.dayDeadline && Date.now() < state.dayDeadline - 1200) throw new Error('Le débat n\'est pas terminé.');
  startVote(state);
}

// Tous les bulletins sont déposés : on les laisse affichés quelques secondes
// (dépouillement) avant de résoudre, pour que chacun voie qui a voté qui.
function lockVotes(state) {
  if (state.voteResultDeadline) return;
  state.voteDeadline = null;
  state.voteResultDeadline = Date.now() + 6000;
  narrate(state, pick([
    'Les bulletins sont tombés… le village retient son souffle.',
    'Tous les votes sont déposés. Voyons qui le village a désigné…',
  ]));
}

function tallyAndResolveDay(state) {
  const voters = aliveIds(state);
  // Les votes blancs ne comptent pour personne : on les exclut du dépouillement.
  const cast = voters.filter((id) => state.votes[id] && state.votes[id] !== 'blank');
  const tally = {};
  for (const v of cast) tally[state.votes[v]] = (tally[state.votes[v]] || 0) + 1;
  const deaths = [];
  let executed = null;
  if (cast.length) {
    const max = Math.max(...Object.values(tally));
    const top = Object.keys(tally).filter((id) => tally[id] === max);
    if (top.length === 1) { executed = top[0]; killPlayer(state, top[0], deaths); }
  }
  state.lastDeaths = deaths;
  state.voteDeadline = null;
  if (checkAnge(state)) return;
  if (checkWin(state)) return;
  if (state.hunterPending) {
    state.phase = 'hunter'; state.resumeTo = 'night'; state.stepSince = Date.now();
    narrate(state, 'Touché à mort, le Chasseur lève une dernière fois son fusil…');
    return;
  }
  enterReveal(state, 'night', verdictText(state, deaths, executed));
}

export function dayVote(state, userId, targetId) {
  if (state.phase !== 'vote') throw new Error('Pas de vote en cours.');
  if (state.voteResultDeadline) throw new Error('Les votes sont clos.');
  if (!state.alive[userId]) throw new Error('Les morts ne votent pas.');
  // 'blank' = vote blanc (abstention) : compte comme avoir voté, mais n'accuse personne.
  if (targetId !== 'blank' && !state.alive[targetId]) throw new Error('Cible invalide.');
  state.votes[userId] = targetId;
  // Les votants déconnectés ne bloquent pas la clôture du vote.
  const voters = aliveIds(state).filter((id) => !isOffline(state, id));
  if (voters.length && voters.every((id) => state.votes[id])) lockVotes(state);
}

// Fin du temps de vote : on verrouille avec les bulletins déposés (abstentions = nulles).
export function voteTimeout(state) {
  if (state.phase !== 'vote' || state.voteResultDeadline) return;
  if (state.voteDeadline && Date.now() < state.voteDeadline - 1500) return;
  lockVotes(state);
}

// Fin du dépouillement : on résout enfin (élimination).
export function resolveVote(state) {
  if (state.phase !== 'vote' || !state.voteResultDeadline) return;
  if (Date.now() < state.voteResultDeadline - 1200) return;
  state.voteResultDeadline = null;
  tallyAndResolveDay(state);
}

// L'hôte fait avancer la pause commentée (déclenché à la fin du minuteur).
export function resumeLoupGarou(state, userId) {
  if (state.phase !== 'reveal') return;
  if (state.revealDeadline && Date.now() < state.revealDeadline - 1500) return;
  const to = state.resumeTo;
  state.resumeTo = null; state.revealDeadline = null;
  if (to === 'day') openDay(state); else beginNight(state);
}

// Joueurs dont on attend l'action à l'étape de nuit courante.
function stepActors(state) {
  const step = state.nightStep;
  if (step === 'cupid') return [aliveRole(state, 'cupidon')].filter(Boolean);
  if (step === 'wildchild') return [aliveRole(state, 'enfant')].filter(Boolean);
  if (step === 'guard') return [aliveRole(state, 'garde')].filter(Boolean);
  if (step === 'seer') return [aliveRole(state, 'voyante')].filter(Boolean);
  if (step === 'wolves') return aliveWolves(state).filter((w) => !state.wolfVotes[w]);
  if (step === 'witch') return [aliveRole(state, 'sorciere')].filter(Boolean);
  return [];
}

// Horloge serveur (appelée chaque seconde par la couche temps réel) :
// résout les échéances (débat → vote, clôture, dépouillement, pauses commentées)
// et débloque la nuit si tous les joueurs attendus sont déconnectés.
export function tickLoupGarou(state) {
  const now = Date.now();
  if (state.phase === 'day' && state.dayDeadline && now >= state.dayDeadline) {
    startVote(state);
    return true;
  }
  if (state.phase === 'vote' && !state.voteResultDeadline && state.voteDeadline && now >= state.voteDeadline) {
    lockVotes(state);
    return true;
  }
  if (state.phase === 'vote' && state.voteResultDeadline && now >= state.voteResultDeadline) {
    state.voteResultDeadline = null;
    tallyAndResolveDay(state);
    return true;
  }
  if (state.phase === 'reveal' && state.revealDeadline && now >= state.revealDeadline) {
    const to = state.resumeTo;
    state.resumeTo = null; state.revealDeadline = null;
    if (to === 'day') openDay(state); else beginNight(state);
    return true;
  }
  // Nuit / chasseur figés par un joueur déconnecté : on passe après un délai de grâce.
  if (!state.stepSince || now < state.stepSince + OFFLINE_SKIP_MS) return false;
  if (state.phase === 'hunter' && isOffline(state, state.hunterPending)) {
    state.hunterPending = null;
    const to = state.resumeTo === 'night' ? 'night' : 'day';
    state.resumeTo = null;
    enterReveal(state, to, 'Le Chasseur est introuvable… son fusil restera muet.');
    return true;
  }
  if (state.phase === 'night') {
    const actors = stepActors(state);
    if (actors.length && actors.every((id) => isOffline(state, id))) {
      if (state.nightStep === 'witch') resolveNight(state);
      else if (state.nightStep === 'wolves') closeWolves(state);
      else advanceNight(state, state.nightStep);
      return true;
    }
  }
  return false;
}

export function hunterShoot(state, userId, targetId) {
  if (state.phase !== 'hunter') throw new Error('Pas le moment.');
  if (state.hunterPending !== userId) throw new Error('Ce n\'est pas à toi de tirer.');
  state.hunterPending = null;
  const deaths = [];
  if (state.alive[targetId]) killPlayer(state, targetId, deaths);
  state.lastDeaths = state.lastDeaths.concat(deaths);
  if (checkWin(state)) return;
  if (state.hunterPending) { state.phase = 'hunter'; state.stepSince = Date.now(); return; }
  const to = state.resumeTo === 'night' ? 'night' : 'day';
  state.resumeTo = null;
  const shot = deaths.length ? `Le Chasseur emporte ${nameList(state, deaths)} dans sa chute.` : 'Le coup de feu se perd dans le vide.';
  enterReveal(state, to, shot);
}

function checkWin(state) {
  const alive = aliveIds(state);
  // Les amoureux derniers en vie l'emportent.
  if (alive.length === 2 && state.lovers.length === 2 && state.lovers.every((l) => state.alive[l])) {
    state.phase = 'over'; state.winner = 'amoureux';
    narrate(state, 'Les amoureux sont les derniers survivants : leur amour triomphe de tout !');
    return true;
  }
  const wolves = aliveWolves(state).length;
  const others = alive.length - wolves;
  if (wolves === 0) { state.phase = 'over'; state.winner = 'village'; narrate(state, 'L\'aube se lève : tous les Loups ont été éliminés. Le village triomphe !'); return true; }
  if (wolves >= others) { state.phase = 'over'; state.winner = 'loups'; narrate(state, 'Les Loups-Garous l\'emportent… le village a perdu.'); return true; }
  return false;
}

export function viewFor(state, userId) {
  const meRole = state.roles[userId] || null;
  const amWolf = meRole === 'loup';
  const over = state.phase === 'over';
  const amLover = state.lovers.includes(userId);
  const players = state.seats.map((id) => ({
    id,
    alive: !!state.alive[id],
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
    lovers: amLover || over ? state.lovers.slice() : null,
    amLover,
    wildModel: (meRole === 'enfant' || over) ? state.wildModel : null,
    nightNo: state.nightNo,
    canCupid: state.phase === 'night' && state.nightStep === 'cupid' && meRole === 'cupidon' && state.alive[userId] && state.lovers.length === 0,
    canWild: state.phase === 'night' && state.nightStep === 'wildchild' && meRole === 'enfant' && state.alive[userId] && !state.wildModel,
    canGuard: state.phase === 'night' && state.nightStep === 'guard' && meRole === 'garde' && state.alive[userId] && !state.guardProtected,
    guardLast: meRole === 'garde' ? state.guardLast : null,
    canSee: state.phase === 'night' && state.nightStep === 'seer' && meRole === 'voyante' && state.alive[userId] && !state.seerSeen[userId],
    seerResult: state.seerSeen[userId] || null,
    canWolf: state.phase === 'night' && state.nightStep === 'wolves' && amWolf && state.alive[userId] && !state.wolfVotes[userId],
    wolfTarget: state.wolfVotes[userId] || null,
    // Les loups voient en direct les cibles désignées par leurs complices (aura).
    wolfPicks: (amWolf && state.phase === 'night' && state.nightStep === 'wolves') ? { ...state.wolfVotes } : null,
    witch: isWitchStep ? { victim: state.pendingVictim, healLeft: !state.witch.healUsed, killLeft: !state.witch.killUsed } : null,
    canVote: state.phase === 'vote' && !state.voteResultDeadline && state.alive[userId] && !state.votes[userId],
    myVote: state.phase === 'vote' ? (state.votes[userId] || null) : null,
    // Votes publics du jour : tout le village voit qui accuse qui (aura + noms).
    votes: state.phase === 'vote' ? { ...state.votes } : null,
    voteLocked: !!state.voteResultDeadline,
    voteResultDeadline: state.phase === 'vote' ? (state.voteResultDeadline || null) : null,
    canShoot: state.phase === 'hunter' && state.hunterPending === userId,
    lastDeaths: state.lastDeaths.slice(),
    resumeTo: state.phase === 'reveal' ? state.resumeTo : null,
    dayDeadline: state.phase === 'day' ? (state.dayDeadline || null) : null,
    voteDeadline: state.phase === 'vote' ? (state.voteDeadline || null) : null,
    revealDeadline: state.phase === 'reveal' ? (state.revealDeadline || null) : null,
    say: state.say,
    sayId: state.sayId,
    winner: state.winner,
  };
}
