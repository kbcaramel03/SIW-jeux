// Moteur de Bataille navale (1 contre 1), logique pure.
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

export function setReady(state, userId, value) {
  if (state.phase !== 'placing') throw new Error('Le placement est terminé.');
  ensureSeat(state, userId);
  if (value && !state.boards[userId]) throw new Error('Place ta flotte d\'abord.');
  state.ready[userId] = !!value;

  if (state.seats.length === 2 && state.seats.every((id) => state.ready[id])) {
    state.phase = 'playing';
    state.turn = state.seats[Math.floor(Math.random() * 2)];
    state.log.push('Les deux flottes sont prêtes. Que la bataille commence !');
  }
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

// Vue personnalisée : je vois MES bateaux, mais pas ceux de l'adversaire (sauf coulés / fin).
export function viewFor(state, userId) {
  const isSeat = state.seats.includes(userId);
  const opp = opponentOf(state, userId);
  const over = state.phase === 'over';

  function myBoardView() {
    const b = state.boards[userId];
    if (!b) return null;
    return b.grid.map((row) => row.map((c) => ({
      ship: c.ship !== null,
      fired: c.fired,
      sunk: c.ship !== null && b.ships.find((s) => s.id === c.ship)?.sunk === true,
    })));
  }

  function enemyBoardView() {
    const b = opp ? state.boards[opp] : null;
    if (!b) return null;
    return b.grid.map((row) => row.map((c) => {
      const ship = c.ship !== null ? b.ships.find((s) => s.id === c.ship) : null;
      const revealShip = over || (c.fired && c.ship !== null) || (ship && ship.sunk);
      return {
        fired: c.fired,
        hit: c.fired && c.ship !== null,
        sunk: ship ? ship.sunk : false,
        ship: revealShip ? c.ship !== null : false,
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
    myFleet: fleetStatus(userId),
    enemyFleet: opp ? fleetStatus(opp) : null,
    lastEvent: state.lastEvent,
    log: state.log.slice(-8),
  };
}
