// Couche temps réel (Socket.IO) : salons, présence, chat, et actions de jeu.
// Les salons vivent en mémoire (transitoires) ; seuls les comptes sont persistés.
import { Server } from 'socket.io';
import { nanoid } from 'nanoid';
import { userFromToken } from './auth.js';
import { GAMES, gameList } from './games/registry.js';
import { DEV_ORIGINS, IS_PROD } from './config.js';

const rooms = new Map(); // roomId -> room

function roomSummary(room) {
  return {
    id: room.id,
    name: room.name,
    gameKey: room.gameKey,
    gameLabel: GAMES[room.gameKey].label,
    emoji: GAMES[room.gameKey].emoji,
    players: room.players.length,
    maxPlayers: GAMES[room.gameKey].maxPlayers,
    inProgress: !!room.game && room.game.phase !== 'setup' && room.game.phase !== 'over',
  };
}

function lobbyList() {
  return [...rooms.values()].map(roomSummary);
}

export function createRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: IS_PROD ? {} : { origin: DEV_ORIGINS, credentials: true },
  });

  // Authentification de la socket via le jeton JWT.
  io.use(async (socket, next) => {
    const user = await userFromToken(socket.handshake.auth?.token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = { id: user.id, displayName: user.displayName, role: user.role };
    next();
  });

  function broadcastLobby() {
    io.to('lobby').emit('lobby:rooms', lobbyList());
  }

  // Envoie l'état du salon, personnalisé pour chaque joueuse (vue du jeu différente).
  async function emitRoomState(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    const sockets = await io.in(roomId).fetchSockets();
    for (const s of sockets) {
      const uid = s.data.user.id;
      const gameView = room.game ? GAMES[room.gameKey].view(room.game, uid) : null;
      s.emit('room:state', {
        id: room.id,
        name: room.name,
        gameKey: room.gameKey,
        gameLabel: GAMES[room.gameKey].label,
        hostId: room.hostId,
        players: room.players,
        chat: room.chat.slice(-50),
        game: gameView,
        me: { id: uid },
      });
    }
  }

  async function leaveRoom(socket) {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.leave(roomId);
    socket.data.roomId = null;
    const room = rooms.get(roomId);
    if (!room) return;

    // La joueuse a-t-elle encore une autre socket dans ce salon (autre onglet) ?
    const others = await io.in(roomId).fetchSockets();
    const stillHere = others.some((s) => s.data.user.id === socket.data.user.id);
    if (!stillHere) {
      room.players = room.players.filter((p) => p.id !== socket.data.user.id);
      if (room.hostId === socket.data.user.id && room.players[0]) {
        room.hostId = room.players[0].id; // transfert de l'hôte
      }
    }
    if (room.players.length === 0) {
      rooms.delete(roomId);
    } else {
      await emitRoomState(roomId);
    }
    broadcastLobby();
  }

  io.on('connection', (socket) => {
    socket.join('lobby');
    socket.emit('lobby:rooms', lobbyList());
    socket.emit('lobby:games', gameList());

    socket.on('room:create', ({ gameKey, name }, ack) => {
      const game = GAMES[gameKey];
      if (!game || !game.ready) return ack?.({ error: 'Ce jeu n\'est pas encore disponible.' });
      const id = nanoid(6);
      const room = {
        id,
        name: String(name || '').trim().slice(0, 40) || `Salon de ${socket.data.user.displayName}`,
        gameKey,
        hostId: socket.data.user.id,
        players: [],
        chat: [],
        game: null,
        createdAt: Date.now(),
      };
      rooms.set(id, room);
      broadcastLobby();
      ack?.({ roomId: id });
    });

    socket.on('room:join', async ({ roomId }, ack) => {
      const room = rooms.get(roomId);
      if (!room) return ack?.({ error: 'Ce salon n\'existe plus.' });
      const game = GAMES[room.gameKey];
      const already = room.players.find((p) => p.id === socket.data.user.id);
      if (!already && room.players.length >= game.maxPlayers) {
        return ack?.({ error: 'Le salon est complet.' });
      }
      if (socket.data.roomId && socket.data.roomId !== roomId) await leaveRoom(socket);

      socket.join(roomId);
      socket.data.roomId = roomId;
      if (!already) {
        room.players.push({ id: socket.data.user.id, displayName: socket.data.user.displayName });
      }
      ack?.({ ok: true });
      await emitRoomState(roomId);
      broadcastLobby();
    });

    socket.on('room:leave', async () => {
      await leaveRoom(socket);
    });

    socket.on('chat:send', async ({ text }) => {
      const roomId = socket.data.roomId;
      const room = rooms.get(roomId);
      if (!room) return;
      const clean = String(text || '').trim().slice(0, 400);
      if (!clean) return;
      room.chat.push({
        id: nanoid(8),
        userId: socket.data.user.id,
        displayName: socket.data.user.displayName,
        text: clean,
        ts: Date.now(),
      });
      if (room.chat.length > 200) room.chat = room.chat.slice(-200);
      await emitRoomState(roomId);
    });

    // Démarre / relance une partie (réservé à l'hôte).
    socket.on('game:new', async (ack) => {
      const room = rooms.get(socket.data.roomId);
      if (!room) return ack?.({ error: 'Pas dans un salon.' });
      if (room.hostId !== socket.data.user.id) return ack?.({ error: 'Seul l\'hôte peut lancer une partie.' });
      room.game = GAMES[room.gameKey].create();
      room.chat.push({ id: nanoid(8), userId: 'system', displayName: 'Système', text: '🎲 Nouvelle partie ! Choisissez vos équipes.', ts: Date.now() });
      ack?.({ ok: true });
      await emitRoomState(room.id);
      broadcastLobby();
    });

    // Action de jeu générique, déléguée au moteur du jeu concerné.
    socket.on('game:action', async (payload, ack) => {
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.game) return ack?.({ error: 'Aucune partie en cours.' });
      try {
        GAMES[room.gameKey].action(room.game, socket.data.user.id, payload || {});
        ack?.({ ok: true });
        await emitRoomState(room.id);
        broadcastLobby();
      } catch (e) {
        ack?.({ error: e.message || 'Action impossible.' });
      }
    });

    socket.on('disconnect', async () => {
      await leaveRoom(socket);
    });
  });

  return io;
}
