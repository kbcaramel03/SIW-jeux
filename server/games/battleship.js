// Moteur de Bataille navale (1 contre 1), logique pure.
import { aiTurn } from '../ai.js';
// Grille 10x10, flotte classique : 5, 4, 3, 3, 2.
// Placement aléatoire (re-mélangeable) puis tirs au tour par tour.
// Règle choisie : un TOUCHÉ rejoue, un raté passe la main (plus dynamique).

const SIZE = 10;
const FLEET = [
  { name: 'Porte-avions', size: 5 },
  { name: 'Cuirassé', size: 4 },
  { name: 'Croiseur', size: 3 },
  { name: 'Sous-marin', size: 3 },
  { name: 'Torpilleur', size: 2 },
];

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => ({ ship: null, fired: false })));
}

function randomBoard() {
  const grid = emptyGrid();
  const ships = [];
  let id = 0;
  for (const def of FLEET) {
    let placed = false;
    while (!placed) {
      const horizontal = Math.random() < 0.5;
      const x = Math.floor(Math.random() * (horizontal ? SIZE - def.size + 1 : SIZE));
      const y = Math.floor(Math.random() * (horizontal ? SIZE : SIZE - def.size + 1));
      const cells = [];
      let ok = true;
      for (let i = 0; i < def.size; i++) {
        const cx = horizontal ? x + i : x;
        const cy = horizontal ? y : y + i;
        if (grid[cy][cx].ship !== null) { ok = false; break; }
        cells.push([cx, cy]);
      }
      if (!ok) continue;
      for (const [cx, cy] of cells) grid[cy][cx].ship = id;
      ships.push({ id, name: def.name, size: def.size, cells, hits: 0, sunk: false });
      placed = true;
      id++;
    }
  }
  return { grid, ships };
}

export function createBattleship() {
  return {
    type: 'bataille',
    phase: 'placing', // placing -> playing -> over
    seats: [],        // [userId, userId]
    boards: {},       // userId -> { grid, ships }
    ready: {},        // userId -> bool
    turn: null,
    winner: null,
    lastEvent: null,  // { by, x, y, result, ship, seq }
    eventSeq: 0,
    log: [],
  };
}

function ensureSeat(state, userId) {
  if (!state.seats.includes(userId) && state.seats.length < 2) state.seats.push(userId);
}
function opponentOf(state, userId) {
  return state.seats.find((id) => id !== userId) || null;
}

export function shuffleFleet(state, userId) {
  if (state.phase !== 'placing') throw new Error('Le placement est terminé.');
  ensureSeat(state, userId);
  if (!state.seats.includes(userId)) throw new Error('La partie est complète.');
  if (state.ready[userId]) throw new Error('Tu es déjà prêt, dé-valide pour re-mélanger.');
  state.boards[userId] = randomBoard();
}

// Placement manuel : déplacer un bateau (tête en x,y) et/ou le pivoter.
export function placeShip(state, userId, { id, x, y, horizontal }) {
  if (state.phase !== 'placing') throw new Error('Le placement est terminé.');
  const board = state.boards[userId];
  if (!board) throw new Error('Mélange d\'abord ta flotte.');
  if (state.ready[userId]) throw new Error('Dé-valide « Prêt » pour bouger tes bateaux.');
  const ship = board.ships.find((s) => s.id === Number(id));
  if (!ship) throw new Error('Bateau inconnu.');
  const px = Math.round(Number(x)), py = Math.round(Number(y));
  const h = !!horizontal;
  const cells = [];
  for (let i = 0; i < ship.size; i++) {
    const cx = h ? px + i : px;
    const cy = h ? py : py + i;
    if (cx < 0 || cx >= SIZE || cy < 0 || cy >= SIZE) throw new Error('Ça dépasse de la mer !');
    const other = board.grid[cy][cx].ship;
    if (other !== null && other !== ship.id) throw new Error('Deux bateaux ne peuvent pas se chevaucher.');
    cells.push([cx, cy]);
  }
  for (const [ox, oy] of ship.cells) board.grid[oy][ox].ship = null;
  for (const [cx, cy] of cells) board.grid[cy][cx].ship = ship.id;
  ship.cells = cells;
}

function maybeStart(state) {
  if (state.seats.length === 2 && state.seats.every((id) => state.ready[id])) {
    state.phase = 'playing';
    state.turn = state.seats[Math.floor(Math.random() * 2)];
    state.log.push('Les deux flottes sont prêtes. Que la bataille commence !');
  }
}

export function setReady(state, userId, value) {
  if (state.phase !== 'placing') throw new Error('Le placement est terminé.');
  ensureSeat(state, userId);
  if (value && !state.boards[userId]) throw new Error('Place ta flotte d\'abord.');
  state.ready[userId] = !!value;
  maybeStart(state);
}

// Invite l'Amirale IA comme adversaire (quand on est seule dans le salon).
// Trois niveaux : facile (étourdie), moyen (humaine), difficile (redoutable).
export function addBot(state, userId, level) {
  if (state.phase !== 'placing') throw new Error('La partie a déjà commencé.');
  ensureSeat(state, userId);
  if (!state.seats.includes(userId)) throw new Error('La partie est complète.');
  if (state.seats.length >= 2) throw new Error('Vous êtes déjà deux.');
  state.seats.push('bot');
  state.botLevel = ['facile', 'difficile'].includes(level) ? level : 'moyen';
  state.boards.bot = randomBoard();
  state.ready.bot = true;
  state.log.push(`ChatGPT (niveau ${state.botLevel}) rejoint la partie et place sa flotte.`);
  maybeStart(state);
}

// Cerveau de l'Amirale IA — elle joue comme une humaine, sans tricher :
// elle ne « voit » que les cases où elle a déjà tiré (touché/raté/coulé).
// 1) Cible : un bateau est blessé -> on prolonge la ligne ou on tape autour.
// 2) Chasse : sinon, tir en damier (les bateaux font au moins 2 cases).
function candidateCells(board, hard) {
  const damaged = [];
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const c = board.grid[y][x];
      if (c.fired && c.ship !== null && !board.ships.find((s) => s.id === c.ship).sunk) {
        damaged.push([x, y]);
      }
    }
  }
  const unfired = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE && !board.grid[y][x].fired;
  const candidates = [];
  if (damaged.length >= 2) {
    // Deux touches alignées : on vise les deux bouts de la ligne.
    for (const [x, y] of damaged) {
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        if (damaged.some(([ax, ay]) => ax === x + dx && ay === y + dy)) {
          let [hx, hy] = [x, y];
          while (damaged.some(([ax, ay]) => ax === hx - dx && ay === hy - dy)) { hx -= dx; hy -= dy; }
          let [tx, ty] = [x + dx, y + dy];
          while (damaged.some(([ax, ay]) => ax === tx + dx && ay === ty + dy)) { tx += dx; ty += dy; }
          if (unfired(hx - dx, hy - dy)) candidates.push([hx - dx, hy - dy]);
          if (unfired(tx, ty)) candidates.push([tx, ty]);
        }
      }
    }
  }
  if (!candidates.length) {
    for (const [x, y] of damaged) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (unfired(x + dx, y + dy)) candidates.push([x + dx, y + dy]);
      }
    }
  }
  if (!candidates.length && hard) {
    // Niveau difficile : chasse en damier (les bateaux font au moins 2 cases).
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if ((x + y) % 2 === 0 && unfired(x, y)) candidates.push([x, y]);
  }
  if (!candidates.length) {
    // Chasse au hasard (niveaux facile/moyen : elle doit rester battable).
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (unfired(x, y)) candidates.push([x, y]);
  }
  return candidates;
}
function botPickTarget(board, hard) {
  const candidates = candidateCells(board, hard);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// Question posée à ChatGPT : grille connue + cases candidates lisibles.
const COLS = 'ABCDEFGHIJ';
function buildFireChoice(state, board) {
  const rows = [];
  for (let y = 0; y < SIZE; y++) {
    let line = '';
    for (let x = 0; x < SIZE; x++) {
      const c = board.grid[y][x];
      if (!c.fired) line += '.';
      else if (c.ship === null) line += 'o';
      else line += board.ships.find((s) => s.id === c.ship).sunk ? 'X' : 'x';
    }
    rows.push((y + 1).toString().padStart(2) + ' ' + line);
  }
  // Candidats : la traque en priorité, complétés par des cases de chasse variées.
  const seen = new Set();
  const cands = [];
  for (const [x, y] of candidateCells(board, true)) {
    const k = x + ',' + y;
    if (!seen.has(k)) { seen.add(k); cands.push([x, y]); }
    if (cands.length >= 12) break;
  }
  return {
    label: 'la Bataille navale',
    rules: 'Grille 10x10 : . = inconnue, o = raté, x = touché (bateau blessé pas coulé), X = coulé. Un bateau blessé continue en ligne droite : vise autour des x.',
    situation: 'Colonnes A-J, lignes 1-10 :\n   ' + COLS + '\n' + rows.join('\n'),
    options: cands.map(([x, y]) => 'Tirer en ' + COLS[x] + (y + 1)),
    moves: cands,
  };
}

// Un tir complètement au hasard (l'Amirale se déconcentre parfois exprès).
function randomShot(board) {
  const cells = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (!board.grid[y][x].fired) cells.push([x, y]);
  return cells.length ? cells[Math.floor(Math.random() * cells.length)] : null;
}

// Horloge serveur : l'Amirale tire ~1 coup par seconde quand c'est son tour.
export function tickBattleship(state) {
  if (state.phase !== 'playing' || state.turn !== 'bot') return false;
  if (state.botAt && Date.now() < state.botAt) return false;
  state.botAt = Date.now() + 1100; // petit temps de « réflexion » entre deux tirs
  const human = state.seats.find((id) => id !== 'bot');
  const board = state.boards[human];
  // Étourderie selon le niveau : proportion de tirs qui partent au hasard.
  const level = state.botLevel || 'moyen';
  // ChatGPT choisit la case (heuristique locale selon le niveau en secours).
  const picked = aiTurn(state, () => buildFireChoice(state, board));
  if (picked === 'wait') return false;
  let target = picked;
  if (!target) {
    const distraction = level === 'facile' ? 0.6 : level === 'difficile' ? 0 : 0.2;
    target = Math.random() < distraction ? randomShot(board) : botPickTarget(board, level === 'difficile');
  }
  if (!target) return false;
  fire(state, 'bot', target[0], target[1]);
  return true;
}

export function fire(state, userId, x, y) {
  if (state.phase !== 'playing') throw new Error('La bataille n\'a pas commencé.');
  if (state.turn !== userId) throw new Error('Ce n\'est pas ton tour.');
  const opp = opponentOf(state, userId);
  const board = state.boards[opp];
  if (!board) throw new Error('Adversaire non prêt.');
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) throw new Error('Case invalide.');
  const cell = board.grid[y][x];
  if (cell.fired) throw new Error('Tu as déjà tiré ici.');
  cell.fired = true;

  let result = 'miss';
  let shipName = null;
  if (cell.ship !== null) {
    const ship = board.ships.find((s) => s.id === cell.ship);
    ship.hits += 1;
    if (ship.hits >= ship.size) {
      ship.sunk = true;
      result = 'sunk';
      shipName = ship.name;
    } else {
      result = 'hit';
    }
  }

  state.eventSeq += 1;
  state.lastEvent = { by: userId, x, y, result, ship: shipName, seq: state.eventSeq };
  state.log.push(result === 'miss' ? `Tir en (${x + 1},${y + 1}) : à l'eau.` : result === 'sunk' ? `${shipName} coulé !` : `Touché en (${x + 1},${y + 1}) !`);

  if (board.ships.every((s) => s.sunk)) {
    state.phase = 'over';
    state.winner = userId;
    state.log.push('Toute la flotte adverse est coulée. Victoire !');
    return;
  }
  // Touché/coulé : on rejoue. Raté : on passe la main.
  if (result === 'miss') state.turn = opp;
}

// Bateaux « entiers » pour le dessin client : position de la tête, longueur,
// orientation. On n'envoie côté ennemi que les bateaux coulés (ou fin de partie).
function shipSpans(board, keep) {
  return board.ships.filter(keep).map((s) => ({
    id: s.id,
    x: s.cells[0][0],
    y: s.cells[0][1],
    len: s.size,
    horizontal: s.cells.length === 1 || s.cells[0][1] === s.cells[1][1],
    sunk: s.sunk,
  }));
}

// Pour chaque case de bateau : orientation + position (pour dessiner la coque).
function shipSegments(board) {
  const map = {};
  for (const s of board.ships) {
    const horizontal = s.cells.length > 1 && s.cells[0][1] === s.cells[1][1];
    s.cells.forEach(([x, y], i) => {
      const part = s.cells.length === 1 ? 'single' : i === 0 ? 'start' : i === s.cells.length - 1 ? 'end' : 'mid';
      map[`${x},${y}`] = { orient: horizontal ? 'h' : 'v', part, head: i === 0 };
    });
  }
  return map;
}

// Vue personnalisée : je vois MES bateaux, mais pas ceux de l'adversaire (sauf coulés / fin).
export function viewFor(state, userId) {
  const isSeat = state.seats.includes(userId);
  const opp = opponentOf(state, userId);
  const over = state.phase === 'over';

  function myBoardView() {
    const b = state.boards[userId];
    if (!b) return null;
    const seg = shipSegments(b);
    return b.grid.map((row, y) => row.map((c, x) => ({
      ship: c.ship !== null,
      fired: c.fired,
      sunk: c.ship !== null && b.ships.find((s) => s.id === c.ship)?.sunk === true,
      seg: c.ship !== null ? seg[`${x},${y}`] : null,
    })));
  }

  function enemyBoardView() {
    const b = opp ? state.boards[opp] : null;
    if (!b) return null;
    const seg = shipSegments(b);
    return b.grid.map((row, y) => row.map((c, x) => {
      const ship = c.ship !== null ? b.ships.find((s) => s.id === c.ship) : null;
      const revealShip = over || (ship && ship.sunk);
      return {
        fired: c.fired,
        hit: c.fired && c.ship !== null,
        sunk: ship ? ship.sunk : false,
        ship: revealShip ? c.ship !== null : false,
        seg: revealShip ? seg[`${x},${y}`] : null,
      };
    }));
  }

  function fleetStatus(id) {
    const b = state.boards[id];
    if (!b) return null;
    return b.ships.map((s) => ({ name: s.name, size: s.size, sunk: s.sunk }));
  }

  return {
    type: 'bataille',
    phase: state.phase,
    isSeat,
    vsBot: state.seats.includes('bot'),
    seatsCount: state.seats.length,
    turn: state.turn,
    isMyTurn: state.turn === userId,
    myReady: !!state.ready[userId],
    oppReady: opp ? !!state.ready[opp] : false,
    oppPresent: !!opp,
    winner: state.winner,
    iWon: state.winner === userId,
    myBoard: myBoardView(),
    enemyBoard: enemyBoardView(),
    myShips: state.boards[userId] ? shipSpans(state.boards[userId], () => true) : null,
    enemyShips: opp && state.boards[opp] ? shipSpans(state.boards[opp], (s) => over || s.sunk) : [],
    myFleet: fleetStatus(userId),
    enemyFleet: opp ? fleetStatus(opp) : null,
    lastEvent: state.lastEvent,
    log: state.log.slice(-8),
  };
}
