// Shadow Hunters (rôles cachés), version resserrée pour la soirée.
// Trois camps secrets : les Shadows (créatures de la nuit), les Hunters
// (chasseuses) et les Neutres (leurs propres objectifs). On se déplace aux dés
// entre 6 lieux appariés en 3 zones, on pioche des cartes (blanches, noires,
// visions), on s'attaque (dégâts = |d6 − d4|), on peut se révéler pour
// utiliser sa capacité. Shadows gagnent quand toutes les Hunters sont mortes,
// Hunters quand toutes les Shadows sont mortes ; les Neutres gagnent selon
// leur objectif perso. 4 à 8 joueuses — pas de bot, c'est un jeu de soupçons.

const CHARACTERS = [
  { id: 'vampire', name: 'Vampire', camp: 'shadow', hp: 13, ability: 'Révélée : quand ton attaque blesse, tu récupères 2 PV.' },
  { id: 'loupgarou', name: 'Loup-Garou', camp: 'shadow', hp: 14, ability: 'Révélée : quand on t\'attaque, tu contre-attaques automatiquement.' },
  { id: 'metamorphe', name: 'Métamorphe', camp: 'shadow', hp: 11, ability: 'Les cartes Vision restent muettes sur toi (même cachée).' },
  { id: 'franklin', name: 'Franklin', camp: 'hunter', hp: 12, ability: 'En te révélant : inflige 1d6 dégâts à une joueuse (une fois).' },
  { id: 'georges', name: 'Georges', camp: 'hunter', hp: 14, ability: 'En te révélant : inflige 1d4+1 dégâts à une joueuse (une fois).' },
  { id: 'emi', name: 'Emi', camp: 'hunter', hp: 10, ability: 'Révélée : tu te déplaces où tu veux, sans lancer les dés.' },
  { id: 'fuka', name: 'Fu-ka', camp: 'hunter', hp: 12, ability: 'En te révélant : remets une joueuse à pleine vie (une fois).' },
  { id: 'allie', name: 'Allie', camp: 'neutral', hp: 8, ability: 'En te révélant : tu te soignes complètement (une fois).', win: 'Être en vie à la fin de la partie.' },
  { id: 'bob', name: 'Bob', camp: 'neutral', hp: 10, ability: 'Pas de capacité — mais un objectif bien à toi.', win: 'Porter toi-même le coup fatal à une joueuse.' },
  { id: 'catherine', name: 'Catherine', camp: 'neutral', hp: 11, ability: 'Pas de capacité — mais un objectif bien à toi.', win: 'Être la première à mourir, OU être en vie à la fin.' },
];
const WIN_TEXT = {
  shadow: 'Que toutes les Hunters meurent.',
  hunter: 'Que toutes les Shadows meurent.',
};
// Répartition Shadows / Hunters / Neutres selon le nombre de joueuses.
const MIX = { 4: [2, 2, 0], 5: [2, 2, 1], 6: [2, 2, 2], 7: [3, 3, 1], 8: [3, 3, 2] };

export const AREAS = [
  { id: 'ermite', name: 'Antre de l\'Ermite', nums: [2, 3], desc: 'Piocher une carte Vision et la donner.' },
  { id: 'porte', name: 'Porte de l\'Outremonde', nums: [4, 5], desc: 'Piocher la carte de ton choix.' },
  { id: 'eglise', name: 'Église', nums: [6], desc: 'Piocher une carte blanche.' },
  { id: 'cimetiere', name: 'Cimetière', nums: [8], desc: 'Piocher une carte noire.' },
  { id: 'foret', name: 'Forêt inquiétante', nums: [9], desc: 'Infliger 2 dégâts OU soigner 1 PV à qui tu veux.' },
  { id: 'autel', name: 'Autel ancien', nums: [10], desc: 'Voler un équipement à une joueuse.' },
];

// Cartes blanches (bienfaisantes). target: 'self' | 'any' | null (équipement).
const WHITE_CARDS = [
  { id: 'eau', name: 'Eau bénite', text: 'Tu récupères 2 PV.', heal: 2, target: 'self' },
  { id: 'ration', name: 'Ration de survie', text: 'Tu récupères 1 PV.', heal: 1, target: 'self' },
  { id: 'secours', name: 'Premiers secours', text: 'Soigne 3 PV à qui tu veux.', heal: 3, target: 'any' },
  { id: 'benediction', name: 'Bénédiction', text: 'Soigne 2 PV à qui tu veux.', heal: 2, target: 'any' },
  { id: 'lance', name: 'Lance bénite', text: 'Équipement : tes attaques font +1 dégât.', equip: { atk: 1 } },
  { id: 'amulette', name: 'Amulette sacrée', text: 'Équipement : tu subis −1 dégât.', equip: { def: 1 } },
  { id: 'eclair', name: 'Éclair de lucidité', text: 'Pioche une carte Vision et donne-la.', vision: true },
];
// Cartes noires (maléfiques).
const BLACK_CARDS = [
  { id: 'poignard', name: 'Poignard rituel', text: 'Équipement : tes attaques font +1 dégât.', equip: { atk: 1 } },
  { id: 'hache', name: 'Hache maudite', text: 'Équipement : tes attaques font +1 dégât.', equip: { atk: 1 } },
  { id: 'malediction', name: 'Malédiction', text: 'Inflige 2 dégâts à qui tu veux.', dmg: 2, target: 'any' },
  { id: 'chauvesouris', name: 'Chauve-souris vampire', text: 'Inflige 2 dégâts et récupère 1 PV.', dmg: 2, selfHeal: 1, target: 'any' },
  { id: 'poupee', name: 'Poupée démoniaque', text: 'Inflige 1 dégât à qui tu veux.', dmg: 1, target: 'any' },
  { id: 'succube', name: 'Succube tentatrice', text: 'Vole un équipement à une joueuse.', steal: true },
  { id: 'dynamite', name: 'Dynamite', text: 'Les dés désignent un lieu : 3 dégâts à toutes ses occupantes (7 : rien).', dynamite: true },
  { id: 'rituel', name: 'Rituel diabolique', text: 'Si tu es une Shadow, tu peux te révéler et te soigner complètement.', ritual: true },
];
// Cartes Vision : données à une joueuse, son identité déclenche (ou non) l'effet.
const VISION_CARDS = [
  { id: 'v1', text: '« Je te vois rôder dans la nuit… » Si tu es une Shadow, perds 1 PV.', camps: ['shadow'], dmg: 1 },
  { id: 'v2', text: '« La nuit te protège. » Si tu es une Shadow, récupère 1 PV.', camps: ['shadow'], heal: 1 },
  { id: 'v3', text: '« Je connais ta traque. » Si tu es une Hunter, perds 1 PV.', camps: ['hunter'], dmg: 1 },
  { id: 'v4', text: '« La lumière veille sur toi. » Si tu es une Hunter, récupère 1 PV.', camps: ['hunter'], heal: 1 },
  { id: 'v5', text: '« Ton cœur balance… » Si tu es Neutre, perds 1 PV.', camps: ['neutral'], dmg: 1 },
  { id: 'v6', text: '« Le destin te sourit. » Si tu es Neutre, récupère 1 PV.', camps: ['neutral'], heal: 1 },
  { id: 'v7', text: '« Tu caches quelque chose. » Si tu n\'es PAS une Hunter, perds 1 PV.', camps: ['shadow', 'neutral'], dmg: 1 },
  { id: 'v8', text: '« Tu n\'es pas des ténèbres. » Si tu n\'es PAS une Shadow, perds 1 PV.', camps: ['hunter', 'neutral'], dmg: 1 },
];

const IDLE_MS = 35000;
const nm = (state, id) => (state.names && state.names[id]) || 'quelqu\'un';
const isOffline = (s, id) => !!(s.offline && s.offline[id]);
function pushLog(state, text) { state.log.push(text); if (state.log.length > 40) state.log = state.log.slice(-40); }
const d6 = () => 1 + Math.floor(Math.random() * 6);
const d4 = () => 1 + Math.floor(Math.random() * 4);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function createShadow() {
  return {
    type: 'shadow',
    phase: 'waiting', // waiting -> playing -> over
    seats: [],
    players: {}, // uid -> { charId, camp, hp, maxHp, area, revealed, alive, equips[], usedOneShot }
    zones: [],   // [[areaId, areaId] × 3]
    turn: null,
    stage: 'move', // move | place | action | target | attack
    pending: null, // contexte de choix de cible { kind, card?, heal?, dmg? }
    dice: null,    // dernier jet de déplacement { d6, d4, total }
    atk: null,     // dernier jet d'attaque { by, target, d6, d4, dmg }
    firstDeath: null,
    killers: {},   // uid -> true (a porté un coup fatal)
    names: {},
    winners: null,
    turnSince: null,
    log: [],
  };
}

export function joinShadow(state, userId) {
  if (state.phase !== 'waiting') throw new Error('La partie a déjà commencée.');
  if (!state.seats.includes(userId) && state.seats.length < 8) state.seats.push(userId);
}

export function startShadow(state, userId) {
  if (state.phase !== 'waiting') throw new Error('Déjà démarrée.');
  if (!state.seats.includes(userId)) throw new Error('Tu n\'es pas dans la partie.');
  const n = state.seats.length;
  if (n < 4) throw new Error('Il faut au moins 4 joueuses.');
  const [ns, nh, nn] = MIX[Math.min(8, n)];
  const shadows = shuffle(CHARACTERS.filter((c) => c.camp === 'shadow').slice()).slice(0, ns);
  const hunters = shuffle(CHARACTERS.filter((c) => c.camp === 'hunter').slice()).slice(0, nh);
  const neutrals = shuffle(CHARACTERS.filter((c) => c.camp === 'neutral').slice()).slice(0, nn);
  const deal = shuffle([...shadows, ...hunters, ...neutrals]);
  const order = shuffle(state.seats.slice());
  state.seats = order;
  state.zones = shuffle(AREAS.map((a) => a.id));
  state.zones = [state.zones.slice(0, 2), state.zones.slice(2, 4), state.zones.slice(4, 6)];
  state.players = {};
  order.forEach((id, i) => {
    const ch = deal[i];
    state.players[id] = {
      charId: ch.id, camp: ch.camp, hp: ch.hp, maxHp: ch.hp,
      area: AREAS[i % AREAS.length].id, revealed: false, alive: true,
      equips: [], usedOneShot: false,
    };
  });
  state.turn = order[0];
  state.stage = 'move'; state.pending = null; state.dice = null; state.atk = null;
  state.firstDeath = null; state.killers = {}; state.winners = null;
  state.turnSince = Date.now();
  state.phase = 'playing';
  state.log = [`La chasse commence… ${nm(state, state.turn)} ouvre le bal !`];
}

const charOf = (p) => CHARACTERS.find((c) => c.id === p.charId);
const zoneOf = (state, areaId) => state.zones.find((z) => z.includes(areaId)) || [];
const areaByNum = (total) => AREAS.find((a) => a.nums.includes(total));
const aliveIds = (state) => state.seats.filter((id) => state.players[id].alive);

function checkEnd(state) {
  if (state.phase !== 'playing') return false;
  const alive = aliveIds(state);
  const shadowsDead = state.seats.every((id) => state.players[id].camp !== 'shadow' || !state.players[id].alive);
  const huntersDead = state.seats.every((id) => state.players[id].camp !== 'hunter' || !state.players[id].alive);
  if (!shadowsDead && !huntersDead && alive.length > 1) return false;

  state.phase = 'over';
  const winners = [];
  for (const id of state.seats) {
    const p = state.players[id];
    if (p.camp === 'shadow' && huntersDead) winners.push(id);
    if (p.camp === 'hunter' && shadowsDead) winners.push(id);
    if (p.charId === 'allie' && p.alive) winners.push(id);
    if (p.charId === 'catherine' && (state.firstDeath === id || p.alive)) winners.push(id);
    if (p.charId === 'bob' && state.killers[id]) winners.push(id);
  }
  state.winners = [...new Set(winners)];
  pushLog(state, huntersDead && shadowsDead
    ? 'Carnage total : plus une Hunter ni une Shadow debout !'
    : huntersDead ? 'Les Shadows règnent sur la nuit !' : 'Les Hunters ont purgé les ténèbres !');
  if (state.winners.length) {
    pushLog(state, `Gagnent : ${state.winners.map((id) => nm(state, id)).join(', ')}.`);
  } else {
    pushLog(state, 'Personne ne remplit son objectif… nuit blanche pour tout le monde.');
  }
  return true;
}

function kill(state, id, byId) {
  const p = state.players[id];
  p.alive = false; p.hp = 0; p.equips = [];
  if (!state.firstDeath) state.firstDeath = id;
  if (byId && byId !== id) state.killers[byId] = true;
  const ch = charOf(p);
  pushLog(state, `☠️ ${nm(state, id)} tombe — c'était ${ch.name} (${p.camp === 'shadow' ? 'Shadow' : p.camp === 'hunter' ? 'Hunter' : 'Neutre'}) !`);
  if (checkEnd(state)) return;
  if (state.turn === id) advanceTurn(state);
}

function damage(state, id, amount, byId) {
  const p = state.players[id];
  if (!p.alive || amount <= 0) return 0;
  const def = p.equips.reduce((s, e) => s + (e.def || 0), 0);
  const real = Math.max(0, amount - def);
  if (real <= 0) { pushLog(state, `${nm(state, id)} encaisse sans une égratignure (équipement).`); return 0; }
  p.hp -= real;
  if (p.hp <= 0) kill(state, id, byId);
  return real;
}

function heal(state, id, amount) {
  const p = state.players[id];
  if (!p.alive) return;
  p.hp = Math.min(p.maxHp, p.hp + amount);
}

function advanceTurn(state) {
  if (state.phase !== 'playing') return;
  const order = state.seats;
  let i = order.indexOf(state.turn);
  for (let k = 1; k <= order.length; k++) {
    const cand = order[(i + k) % order.length];
    if (state.players[cand].alive) { state.turn = cand; break; }
  }
  state.stage = 'move'; state.pending = null; state.atk = null;
  state.turnSince = Date.now();
}

function requireTurn(state, userId, stage) {
  if (state.phase !== 'playing') throw new Error('La partie est finie.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  if (stage && state.stage !== stage) throw new Error('Pas à cette étape.');
  if (!state.players[userId].alive) throw new Error('Tu es morte.');
}

// --- Déplacement --------------------------------------------------------------
export function rollShadow(state, userId) {
  requireTurn(state, userId, 'move');
  const p = state.players[userId];
  if (p.charId === 'emi' && p.revealed) {
    state.stage = 'place'; state.pending = { kind: 'emi' };
    pushLog(state, `${nm(state, userId)} choisit librement sa destination (Emi).`);
    return;
  }
  const a = d6(), b = d4(), total = a + b;
  state.dice = { d6: a, d4: b, total };
  if (total === 7) {
    state.stage = 'place'; state.pending = { kind: 'seven' };
    pushLog(state, `${nm(state, userId)} fait 7 : destination libre !`);
    return;
  }
  const area = areaByNum(total);
  if (area.id === p.area) {
    state.stage = 'place'; state.pending = { kind: 'same' };
    pushLog(state, `${nm(state, userId)} retombe sur place (${total}) : elle choisit un autre lieu.`);
    return;
  }
  p.area = area.id;
  state.stage = 'action';
  state.turnSince = Date.now();
  pushLog(state, `${nm(state, userId)} (${total}) arrive : ${area.name}.`);
}

export function placeShadow(state, userId, areaId) {
  requireTurn(state, userId, 'place');
  const p = state.players[userId];
  const area = AREAS.find((a) => a.id === areaId);
  if (!area) throw new Error('Lieu inconnu.');
  if (area.id === p.area) throw new Error('Choisis un AUTRE lieu.');
  p.area = area.id;
  state.stage = 'action'; state.pending = null;
  state.turnSince = Date.now();
  pushLog(state, `${nm(state, userId)} arrive : ${area.name}.`);
}

// --- Action du lieu ------------------------------------------------------------
function drawCard(state, userId, deckName) {
  const p = state.players[userId];
  if (deckName === 'vision') {
    state.pending = { kind: 'vision', card: VISION_CARDS[Math.floor(Math.random() * VISION_CARDS.length)] };
    state.stage = 'target';
    return;
  }
  const deck = deckName === 'white' ? WHITE_CARDS : BLACK_CARDS;
  const card = deck[Math.floor(Math.random() * deck.length)];
  pushLog(state, `${nm(state, userId)} pioche « ${card.name} » (${deckName === 'white' ? 'blanche' : 'noire'}).`);
  if (card.equip) {
    p.equips.push({ id: card.id, name: card.name, ...card.equip });
    state.stage = 'attack';
    return;
  }
  if (card.vision) { drawCard(state, userId, 'vision'); return; }
  if (card.dynamite) {
    const total = d6() + d4();
    const area = areaByNum(total);
    if (!area) {
      pushLog(state, 'La dynamite fait long feu (7) : personne n\'est touché.');
    } else {
      pushLog(state, `💥 La dynamite explose : ${area.name} !`);
      for (const id of aliveIds(state)) {
        if (state.players[id].area === area.id) {
          pushLog(state, `${nm(state, id)} prend 3 dégâts.`);
          damage(state, id, 3, userId);
        }
      }
    }
    if (state.phase !== 'playing' || state.turn !== userId) return;
    state.stage = 'attack';
    return;
  }
  if (card.ritual) {
    if (p.camp === 'shadow') {
      if (!p.revealed) { p.revealed = true; pushLog(state, `⚡ ${nm(state, userId)} se révèle : ${charOf(p).name} !`); }
      p.hp = p.maxHp;
      pushLog(state, `${nm(state, userId)} accomplit le rituel et retrouve toute sa vie !`);
    } else {
      pushLog(state, 'Le rituel reste silencieux…');
    }
    state.stage = 'attack';
    return;
  }
  if (card.steal) {
    const cands = aliveIds(state).filter((id) => id !== userId && state.players[id].equips.length);
    if (!cands.length) { pushLog(state, 'Personne à détrousser : rien ne se passe.'); state.stage = 'attack'; return; }
    state.pending = { kind: 'steal', card };
    state.stage = 'target';
    return;
  }
  if (card.target === 'self') {
    heal(state, userId, card.heal);
    pushLog(state, `${nm(state, userId)} récupère ${card.heal} PV.`);
    state.stage = 'attack';
    return;
  }
  // dégâts ou soin sur cible au choix
  state.pending = { kind: 'card', card };
  state.stage = 'target';
}

export function actShadow(state, userId, choice) {
  requireTurn(state, userId, 'action');
  const p = state.players[userId];
  if (choice === 'skip') { state.stage = 'attack'; state.turnSince = Date.now(); return; }
  const areaId = p.area;
  if (areaId === 'ermite' && choice === 'vision') return drawCard(state, userId, 'vision');
  if (areaId === 'eglise' && choice === 'white') return drawCard(state, userId, 'white');
  if (areaId === 'cimetiere' && choice === 'black') return drawCard(state, userId, 'black');
  if (areaId === 'porte' && ['white', 'black', 'vision'].includes(choice)) return drawCard(state, userId, choice);
  if (areaId === 'foret' && choice === 'damage') { state.pending = { kind: 'foret-dmg' }; state.stage = 'target'; return; }
  if (areaId === 'foret' && choice === 'heal') { state.pending = { kind: 'foret-heal' }; state.stage = 'target'; return; }
  if (areaId === 'autel' && choice === 'steal') {
    const cands = aliveIds(state).filter((id) => id !== userId && state.players[id].equips.length);
    if (!cands.length) throw new Error('Personne n\'a d\'équipement à voler.');
    state.pending = { kind: 'steal' };
    state.stage = 'target';
    return;
  }
  throw new Error('Action impossible ici.');
}

export function targetShadow(state, userId, targetId) {
  requireTurn(state, userId, 'target');
  const pend = state.pending;
  if (!pend) throw new Error('Rien à cibler.');
  const t = state.players[targetId];
  if (!t || !t.alive) throw new Error('Cible invalide.');
  const p = state.players[userId];

  if (pend.kind === 'vision') {
    if (targetId === userId) throw new Error('La vision se donne à quelqu\'un d\'autre.');
    const card = pend.card;
    pushLog(state, `${nm(state, userId)} tend une Vision à ${nm(state, targetId)} : « ${card.text} »`);
    if (t.charId === 'metamorphe') {
      pushLog(state, `${nm(state, targetId)} reste de marbre. Rien ne se passe…`);
    } else if (card.camps.includes(t.camp)) {
      if (card.dmg) { pushLog(state, `${nm(state, targetId)} vacille : −${card.dmg} PV.`); damage(state, targetId, card.dmg, userId); }
      if (card.heal) { heal(state, targetId, card.heal); pushLog(state, `${nm(state, targetId)} rayonne : +${card.heal} PV.`); }
    } else {
      pushLog(state, `${nm(state, targetId)} reste de marbre. Rien ne se passe…`);
    }
  } else if (pend.kind === 'steal') {
    if (targetId === userId) throw new Error('Choisis quelqu\'un d\'autre.');
    if (!t.equips.length) throw new Error('Elle n\'a pas d\'équipement.');
    const eq = t.equips.shift();
    p.equips.push(eq);
    pushLog(state, `${nm(state, userId)} vole « ${eq.name} » à ${nm(state, targetId)} !`);
  } else if (pend.kind === 'foret-dmg') {
    pushLog(state, `La forêt frappe : ${nm(state, userId)} inflige 2 dégâts à ${nm(state, targetId)}.`);
    damage(state, targetId, 2, userId);
  } else if (pend.kind === 'foret-heal') {
    heal(state, targetId, 1);
    pushLog(state, `${nm(state, userId)} soigne 1 PV à ${nm(state, targetId)}.`);
  } else if (pend.kind === 'card') {
    const card = pend.card;
    if (card.dmg) {
      pushLog(state, `« ${card.name} » : ${nm(state, userId)} inflige ${card.dmg} dégâts à ${nm(state, targetId)}.`);
      damage(state, targetId, card.dmg, userId);
      if (card.selfHeal) heal(state, userId, card.selfHeal);
    } else if (card.heal) {
      heal(state, targetId, card.heal);
      pushLog(state, `« ${card.name} » : ${nm(state, targetId)} récupère ${card.heal} PV.`);
    }
  } else {
    throw new Error('Rien à cibler.');
  }
  if (state.phase !== 'playing' || state.turn !== userId) return;
  state.pending = null;
  state.stage = 'attack';
  state.turnSince = Date.now();
}

// --- Révélation & capacités ----------------------------------------------------
export function revealShadow(state, userId, targetId) {
  requireTurn(state, userId);
  if (!['move', 'action', 'attack'].includes(state.stage)) throw new Error('Pas maintenant.');
  const p = state.players[userId];
  if (p.revealed) throw new Error('Tu es déjà révélée.');
  // La cible de la capacité se valide AVANT la révélation (sinon une erreur
  // de cible « grillerait » la révélation et la capacité avec).
  if (['franklin', 'georges', 'fuka'].includes(p.charId)) {
    const t0 = state.players[targetId];
    if (!t0 || !t0.alive) throw new Error('Choisis une cible pour ta capacité.');
  }
  p.revealed = true;
  const ch = charOf(p);
  pushLog(state, `⚡ ${nm(state, userId)} se révèle : ${ch.name} (${p.camp === 'shadow' ? 'Shadow' : p.camp === 'hunter' ? 'Hunter' : 'Neutre'}) !`);

  // Capacités « une fois, en te révélant »
  if (p.charId === 'allie') {
    p.hp = p.maxHp; p.usedOneShot = true;
    pushLog(state, `${nm(state, userId)} retrouve toute sa vie !`);
    return;
  }
  if (['franklin', 'georges', 'fuka'].includes(p.charId)) {
    const t = state.players[targetId];
    if (!t || !t.alive) throw new Error('Choisis une cible pour ta capacité.');
    p.usedOneShot = true;
    if (p.charId === 'franklin') {
      const roll = d6();
      pushLog(state, `Franklin foudroie ${nm(state, targetId)} : ${roll} dégâts !`);
      damage(state, targetId, roll, userId);
    } else if (p.charId === 'georges') {
      const roll = d4() + 1;
      pushLog(state, `Georges canonne ${nm(state, targetId)} : ${roll} dégâts !`);
      damage(state, targetId, roll, userId);
    } else {
      t.hp = t.maxHp;
      pushLog(state, `Fu-ka remet ${nm(state, targetId)} à pleine vie !`);
    }
  }
}

// --- Attaque -------------------------------------------------------------------
export function attackShadow(state, userId, targetId) {
  requireTurn(state, userId, 'attack');
  const p = state.players[userId];
  if (!targetId) {
    pushLog(state, `${nm(state, userId)} n'attaque personne.`);
    advanceTurn(state);
    return;
  }
  const t = state.players[targetId];
  if (!t || !t.alive || targetId === userId) throw new Error('Cible invalide.');
  const zone = zoneOf(state, p.area);
  if (!zone.includes(t.area)) throw new Error('Elle est trop loin (autre zone).');

  const a = d6(), b = d4();
  const bonus = p.equips.reduce((s, e) => s + (e.atk || 0), 0);
  const raw = Math.abs(a - b);
  const dmg = raw === 0 ? 0 : raw + bonus;
  state.atk = { by: userId, target: targetId, d6: a, d4: b, dmg };
  if (dmg === 0) {
    pushLog(state, `${nm(state, userId)} attaque ${nm(state, targetId)}… et rate (${a} − ${b}) !`);
  } else {
    pushLog(state, `⚔️ ${nm(state, userId)} attaque ${nm(state, targetId)} : ${dmg} dégât${dmg > 1 ? 's' : ''} (|${a} − ${b}|${bonus ? ` +${bonus}` : ''}).`);
    const dealt = damage(state, targetId, dmg, userId);
    // Vampire révélée : se soigne quand elle blesse.
    if (dealt > 0 && p.charId === 'vampire' && p.revealed && p.alive) {
      heal(state, userId, 2);
      pushLog(state, `${nm(state, userId)} se repaît : +2 PV.`);
    }
    // Loup-Garou révélée : contre-attaque automatique.
    if (t.alive && t.charId === 'loupgarou' && t.revealed && p.alive) {
      const ca = d6(), cb = d4();
      const cdmg = Math.abs(ca - cb);
      if (cdmg > 0) {
        pushLog(state, `🐺 ${nm(state, targetId)} contre-attaque : ${cdmg} dégât${cdmg > 1 ? 's' : ''} !`);
        damage(state, userId, cdmg, targetId);
      } else {
        pushLog(state, `🐺 ${nm(state, targetId)} contre-attaque… dans le vide.`);
      }
    }
  }
  if (state.phase !== 'playing') return;
  if (state.turn === userId) advanceTurn(state);
}

// --- Horloge : absentes / distraites -------------------------------------------
export function tickShadow(state) {
  if (state.phase !== 'playing' || !state.turn) return false;
  const id = state.turn;
  const idle = Date.now() - (state.turnSince || 0);
  const away = isOffline(state, id);
  const limit = away ? 10000 : IDLE_MS;
  if (idle < limit) return false;
  // On joue le minimum à sa place pour que la partie avance.
  try {
    if (state.stage === 'move') rollShadow(state, id);
    else if (state.stage === 'place') {
      const p = state.players[id];
      const other = AREAS.filter((a) => a.id !== p.area);
      placeShadow(state, id, other[Math.floor(Math.random() * other.length)].id);
    } else if (state.stage === 'action') actShadow(state, id, 'skip');
    else if (state.stage === 'target') {
      const cands = aliveIds(state).filter((x) => x !== id);
      const pend = state.pending || {};
      const pool = pend.kind === 'steal' ? cands.filter((x) => state.players[x].equips.length) : cands;
      if (pool.length) targetShadow(state, id, pool[Math.floor(Math.random() * pool.length)]);
      else { state.pending = null; state.stage = 'attack'; }
    } else if (state.stage === 'attack') {
      // L'auto-jeu attaque quand c'est possible : une table de muettes doit
      // quand même finir par se départager.
      const zone = zoneOf(state, state.players[id].area);
      const targets = aliveIds(state).filter((x) => x !== id && zone.includes(state.players[x].area));
      attackShadow(state, id, targets.length ? targets[Math.floor(Math.random() * targets.length)] : null);
    } else advanceTurn(state);
  } catch {
    advanceTurn(state);
  }
  state.turnSince = Date.now();
  return true;
}

export function viewFor(state, userId) {
  const over = state.phase === 'over';
  const me = state.players[userId] || null;
  const myChar = me ? charOf(me) : null;
  return {
    type: 'shadow',
    phase: state.phase,
    amSeated: state.seats.includes(userId),
    canStart: state.phase === 'waiting' && state.seats.length >= 4 && state.seats.includes(userId),
    seats: state.seats.slice(),
    zones: state.zones,
    areas: AREAS.map((a) => ({ id: a.id, name: a.name, nums: a.nums, desc: a.desc })),
    players: Object.fromEntries(state.seats.map((id) => {
      const p = state.players[id] || {};
      const show = over || p.revealed || id === userId;
      const ch = p.charId ? charOf(p) : null;
      return [id, {
        hp: p.hp, maxHp: show ? p.maxHp : null, area: p.area, alive: p.alive !== false,
        revealed: !!p.revealed,
        char: show && ch ? { id: ch.id, name: ch.name, camp: p.camp } : null,
        equips: (p.equips || []).map((e) => ({ name: e.name, atk: e.atk || 0, def: e.def || 0 })),
      }];
    })),
    me: me && myChar ? {
      char: { id: myChar.id, name: myChar.name, camp: me.camp, ability: myChar.ability },
      win: myChar.win || WIN_TEXT[me.camp],
      hp: me.hp, maxHp: me.maxHp, revealed: me.revealed, alive: me.alive,
      canOneShot: ['franklin', 'georges', 'fuka'].includes(me.charId) && !me.revealed,
      isEmi: me.charId === 'emi' && me.revealed,
    } : null,
    turn: state.turn,
    isMyTurn: state.phase === 'playing' && state.turn === userId,
    stage: state.stage,
    pending: state.pending ? {
      kind: state.pending.kind,
      text: state.pending.card?.text || null,
      name: state.pending.card?.name || null,
    } : null,
    dice: state.dice,
    atk: state.atk,
    winners: state.winners,
    log: state.log.slice(-10),
  };
}
