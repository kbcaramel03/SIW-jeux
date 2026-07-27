// Couche temps réel (Socket.IO) : salons, présence, chat, et actions de jeu.
// Les salons vivent en mémoire (transitoires) ; seuls les comptes sont persistés.
import { Server } from 'socket.io';
import { nanoid } from 'nanoid';
import db, { scheduleWrite } from './db.js';
import { userFromToken } from './auth.js';
import { GAMES, gameList } from './games/registry.js';
import { DEV_ORIGINS, IS_PROD } from './config.js';

// --- Helpers chats privés & groupes (persistés en base) ---
function userMini(id) {
  const u = db.data.users.find((x) => x.id === id);
  return u ? { id: u.id, displayName: u.displayName, gender: u.gender, avatar: u.avatar || null }
    : { id, displayName: '?', gender: 'A', avatar: null };
}
function convListFor(userId) {
  return db.data.conversations
    .filter((c) => c.members.includes(userId))
    .map((c) => {
      const msgs = db.data.messages.filter((m) => m.convId === c.id);
      const last = msgs[msgs.length - 1] || null;
      const lastRead = (c.reads && c.reads[userId]) || 0;
      const unread = msgs.filter((m) => m.ts > lastRead && m.userId !== userId).length;
      return {
        id: c.id, type: c.type, name: c.name || null,
        members: c.members.map(userMini),
        reads: c.reads || {},
        last: last ? { text: last.deleted ? '' : (last.text || (last.image ? '📷 Photo' : '')), ts: last.ts, userId: last.userId, deleted: !!last.deleted } : null,
        unread,
      };
    })
    .sort((a, b) => (b.last?.ts || 0) - (a.last?.ts || 0));
}
const totalUnread = (userId) => convListFor(userId).reduce((s, c) => s + c.unread, 0);

const rooms = new Map(); // roomId -> room
const online = new Map(); // userId -> { displayName, gender, sockets:number }

function gameInProgress(room) {
  const phase = room.game?.phase;
  return !!phase && !['setup', 'waiting', 'over'].includes(phase);
}

function roomSummary(room) {
  return {
    id: room.id,
    name: room.name,
    gameKey: room.gameKey,
    gameLabel: GAMES[room.gameKey].label,
    emoji: GAMES[room.gameKey].emoji,
    players: room.players.filter((p) => p.connected !== false).length,
    maxPlayers: GAMES[room.gameKey].maxPlayers,
    inProgress: gameInProgress(room),
  };
}

function lobbyList() {
  return [...rooms.values()].map(roomSummary);
}

// Recale la liste des joueurs sur les sockets réellement présentes dans le salon.
// Indispensable car les handlers join/leave sont asynchrones et peuvent s'entrelacer
// (React StrictMode qui double-monte en dev, ou simples reconnexions socket en prod) :
// on ne se fie donc jamais à un compteur mutable, on relit l'état réel des sockets.
// Pendant une partie en cours, un joueur déconnecté garde sa place (marqué
// connected:false) : son nom reste affiché et il peut revenir reprendre sa partie.
function reconcilePlayers(room, sockets) {
  const present = new Map();
  for (const s of sockets) {
    if (!present.has(s.data.user.id)) present.set(s.data.user.id, s.data.user);
  }
  const keepAbsent = gameInProgress(room);
  room.players = room.players.filter((p) => present.has(p.id) || keepAbsent);
  for (const p of room.players) p.connected = present.has(p.id);
  for (const [id, u] of present) {
    if (!room.players.some((p) => p.id === id)) {
      room.players.push({ id, displayName: u.displayName, gender: u.gender, avatar: u.avatar || null, connected: true });
    }
  }
  // Trombinoscope persistant : garde l'identité de tout le monde tant que le salon
  // vit, pour que les noms restent affichés même après un départ définitif.
  for (const p of room.players) room.roster[p.id] = { id: p.id, displayName: p.displayName, gender: p.gender, avatar: p.avatar || null };
  // L'hôte : la créatrice du salon reprend sa couronne dès qu'elle est connectée
  // (avant, une micro-coupure la faisait passer à quelqu'un d'autre pour de bon,
  // et elle perdait ses boutons d'hôte en pleine partie).
  const owner = room.players.find((p) => p.id === room.ownerId && p.connected);
  const host = room.players.find((p) => p.id === room.hostId);
  if (owner) {
    room.hostId = owner.id;
  } else if (!host || !host.connected) {
    const candidate = room.players.find((p) => p.connected);
    if (candidate) room.hostId = candidate.id;
  }
}

// Prénoms pour la narration des moteurs de jeu (Loup Garou…) + connectivité,
// pour que les jeux puissent passer le tour d'un joueur durablement absent.
// L'hôte est aussi transmis (certains pouvoirs lui sont réservés, ex. écourter
// le débat du Loup Garou).
function syncGameContext(room) {
  if (!room.game) return;
  room.game.names = Object.fromEntries(Object.values(room.roster).map((u) => [u.id, u.displayName]));
  room.game.offline = Object.fromEntries(room.players.filter((p) => p.connected === false).map((p) => [p.id, true]));
  room.game.hostId = room.hostId;
  // Adversaire IA : le siège « bot » est traité comme une joueuse absente —
  // les moteurs jouent automatiquement pour elle (en plus rapide et plus malin).
  const g = room.game;
  if (g.seats?.includes('bot') || g.white === 'bot' || g.black === 'bot') {
    g.names.bot = 'ChatGPT';
    g.offline.bot = true;
  }
}

export function createRealtime(httpServer) {
  const io = new Server(httpServer, {
    cors: IS_PROD ? {} : { origin: DEV_ORIGINS, credentials: true },
  });

  // Authentification de la socket via le jeton JWT.
  io.use(async (socket, next) => {
    const user = await userFromToken(socket.handshake.auth?.token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = { id: user.id, displayName: user.displayName, role: user.role, gender: user.gender, avatar: user.avatar || null };
    next();
  });

  function broadcastLobby() {
    io.to('lobby').emit('lobby:rooms', lobbyList());
  }

  function presenceList() {
    return [...online.entries()].map(([id, u]) => ({ id, displayName: u.displayName, gender: u.gender, avatar: u.avatar || null }));
  }
  function broadcastPresence() {
    io.emit('presence:list', presenceList());
  }
  function addPresence(u) {
    const cur = online.get(u.id) || { displayName: u.displayName, gender: u.gender, avatar: u.avatar || null, sockets: 0 };
    cur.sockets += 1;
    online.set(u.id, cur);
  }
  function removePresence(u) {
    const cur = online.get(u.id);
    if (!cur) return;
    cur.sockets -= 1;
    if (cur.sockets <= 0) online.delete(u.id);
  }

  // Envoie l'état du salon, personnalisé pour chaque joueur (vue du jeu différente).
  // Supprime un salon vide après un court délai de grâce : un remontage StrictMode
  // ou une reconnexion peut rejoindre dans la foulée. On annule si quelqu'un revient.
  function scheduleDelete(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    clearTimeout(room.deleteTimer);
    // Pendant une partie en cours, on laisse une vraie marge : une coupure réseau
    // générale (wifi, veille mobile) ne doit pas détruire la partie en 3 secondes.
    const grace = gameInProgress(room) ? 120000 : 3000;
    room.deleteTimer = setTimeout(async () => {
      const r = rooms.get(roomId);
      if (!r) return;
      const socks = await io.in(roomId).fetchSockets();
      if (socks.length === 0) { rooms.delete(roomId); snapshotRooms(); broadcastLobby(); }
    }, grace);
  }

  // Sauvegarde les salons en base (sans le timer, non sérialisable) : le serveur
  // gratuit redémarre ou s'endort parfois, et toutes les parties en cours
  // disparaissaient d'un coup (« Aucune partie en cours » en plein jeu).
  function snapshotRooms() {
    db.data.rooms = [...rooms.values()].map(({ deleteTimer, ...r }) => r);
    db.data.roomsSavedAt = Date.now();
    scheduleWrite();
  }

  // Restaure les salons sauvegardés au démarrage (au plus 6 h en arrière).
  if (Array.isArray(db.data.rooms) && Date.now() - (db.data.roomsSavedAt || 0) < 6 * 3600 * 1000) {
    for (const saved of db.data.rooms) {
      if (!saved?.id || !GAMES[saved.gameKey]) continue;
      const room = { ...saved, roster: saved.roster || {}, chat: saved.chat || [] };
      room.players = (room.players || []).map((p) => ({ ...p, connected: false }));
      // On repart de zéro sur les chronos d'inactivité : le temps que tout le
      // monde se reconnecte, le serveur ne doit pas jouer à leur place.
      if (room.game?.stepSince) room.game.stepSince = Date.now();
      if (room.game?.since) room.game.since = Date.now();
      rooms.set(room.id, room);
      scheduleDelete(room.id); // supprimé après le délai de grâce si personne ne revient
    }
    if (rooms.size) console.log(`♻️  ${rooms.size} salon(s) restauré(s) après redémarrage.`);
  }

  // Dernière sauvegarde avant l'arrêt (déploiement / mise en veille Render).
  process.once('SIGTERM', snapshotRooms);
  process.once('SIGINT', snapshotRooms);

  async function emitRoomState(roomId) {
    const room = rooms.get(roomId);
    if (!room) return;
    const sockets = await io.in(roomId).fetchSockets();
    reconcilePlayers(room, sockets);
    syncGameContext(room);
    const roster = Object.values(room.roster);
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
        roster,
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

    // On recale la liste sur les sockets restantes (gère aussi le cas « même
    // joueur encore présente via un autre onglet » et le transfert d'hôte).
    const others = await io.in(roomId).fetchSockets();
    reconcilePlayers(room, others);
    if (others.length === 0) {
      scheduleDelete(roomId);
    } else {
      await emitRoomState(roomId);
    }
    broadcastLobby();
  }

  io.on('connection', (socket) => {
    const uid = socket.data.user.id;
    socket.join('lobby');
    socket.join(`u:${uid}`); // salon perso pour les notifications de chat
    addPresence(socket.data.user);
    socket.emit('lobby:rooms', lobbyList());
    socket.emit('lobby:games', gameList());
    socket.emit('presence:list', presenceList());
    socket.emit('chat:list', convListFor(uid));
    socket.emit('chat:inbox', { total: totalUnread(uid) });
    broadcastPresence();

    // ---- Chats privés & groupes ----
    socket.on('people:all', (ack) => {
      const list = db.data.users.filter((u) => u.status === 'approved' && u.id !== uid).map((u) => userMini(u.id));
      ack?.(list);
    });
    socket.on('chat:list', (ack) => ack?.(convListFor(uid)));

    socket.on('chat:create', async ({ memberIds, name }, ack) => {
      const members = [...new Set([uid, ...(memberIds || [])])].filter((id) => db.data.users.some((u) => u.id === id));
      if (members.length < 2) return ack?.({ error: 'Choisis au moins une personne.' });
      const isGroup = members.length > 2 || !!(name && name.trim());
      if (!isGroup) {
        const ex = db.data.conversations.find((c) => c.type === 'dm' && c.members.length === 2
          && c.members.includes(members[0]) && c.members.includes(members[1]));
        if (ex) return ack?.({ convId: ex.id });
      }
      const conv = { id: nanoid(8), type: isGroup ? 'group' : 'dm', name: isGroup ? (name?.trim() || 'Groupe') : null,
        members, createdBy: uid, createdAt: Date.now(), reads: {} };
      db.data.conversations.push(conv);
      scheduleWrite();
      for (const m of members) io.to(`u:${m}`).emit('chat:list', convListFor(m));
      ack?.({ convId: conv.id });
    });

    socket.on('chat:history', async ({ convId }, ack) => {
      const conv = db.data.conversations.find((c) => c.id === convId);
      if (!conv || !conv.members.includes(uid)) return ack?.({ error: 'Conversation introuvable.' });
      conv.reads = conv.reads || {}; conv.reads[uid] = Date.now();
      scheduleWrite();
      const messages = db.data.messages.filter((m) => m.convId === convId).slice(-100);
      ack?.({ messages, conv: { id: conv.id, type: conv.type, name: conv.name, members: conv.members.map(userMini), reads: conv.reads } });
      // On diffuse à tous les membres pour mettre à jour les accusés de lecture.
      for (const m of conv.members) io.to(`u:${m}`).emit('chat:list', convListFor(m));
      io.to(`u:${uid}`).emit('chat:inbox', { total: totalUnread(uid) });
    });

    socket.on('chat:typing', ({ convId }) => {
      const conv = db.data.conversations.find((c) => c.id === convId);
      if (!conv || !conv.members.includes(uid)) return;
      const name = userMini(uid).displayName;
      for (const m of conv.members) if (m !== uid) io.to(`u:${m}`).emit('chat:typing', { convId, userId: uid, name });
    });

    socket.on('chat:send', async ({ convId, text, image }) => {
      const conv = db.data.conversations.find((c) => c.id === convId);
      if (!conv || !conv.members.includes(uid)) return;
      const clean = String(text || '').trim().slice(0, 800);
      const img = (typeof image === 'string' && image.startsWith('data:image/') && image.length <= 800000) ? image : null;
      if (!clean && !img) return;
      const msg = { id: nanoid(10), convId, userId: uid, text: clean, ts: Date.now() };
      if (img) msg.image = img;
      db.data.messages.push(msg);
      conv.reads = conv.reads || {}; conv.reads[uid] = msg.ts;
      // On diffuse tout de suite (message instantané), la sauvegarde suit en fond.
      scheduleWrite();
      for (const m of conv.members) {
        io.to(`u:${m}`).emit('chat:message', { convId, message: msg });
        io.to(`u:${m}`).emit('chat:list', convListFor(m));
        io.to(`u:${m}`).emit('chat:inbox', { total: totalUnread(m) });
      }
    });

    socket.on('chat:read', async ({ convId }) => {
      const conv = db.data.conversations.find((c) => c.id === convId);
      if (!conv || !conv.members.includes(uid)) return;
      conv.reads = conv.reads || {}; conv.reads[uid] = Date.now();
      scheduleWrite();
      for (const m of conv.members) io.to(`u:${m}`).emit('chat:list', convListFor(m));
      io.to(`u:${uid}`).emit('chat:inbox', { total: totalUnread(uid) });
    });

    socket.on('chat:edit', async ({ messageId, text }) => {
      const msg = db.data.messages.find((m) => m.id === messageId);
      if (!msg || msg.userId !== uid || msg.deleted) return;
      const clean = String(text || '').trim().slice(0, 800);
      if (!clean) return;
      msg.text = clean; msg.editedTs = Date.now();
      scheduleWrite();
      const conv = db.data.conversations.find((c) => c.id === msg.convId);
      for (const m of conv.members) {
        io.to(`u:${m}`).emit('chat:message:update', { convId: msg.convId, message: msg });
        io.to(`u:${m}`).emit('chat:list', convListFor(m));
      }
    });

    socket.on('chat:delete', async ({ messageId }) => {
      const msg = db.data.messages.find((m) => m.id === messageId);
      if (!msg || msg.userId !== uid) return;
      msg.deleted = true; msg.text = '';
      scheduleWrite();
      const conv = db.data.conversations.find((c) => c.id === msg.convId);
      for (const m of conv.members) {
        io.to(`u:${m}`).emit('chat:message:update', { convId: msg.convId, message: msg });
        io.to(`u:${m}`).emit('chat:list', convListFor(m));
      }
    });

    socket.on('chat:deleteConv', async ({ convId }) => {
      const conv = db.data.conversations.find((c) => c.id === convId);
      if (!conv || !conv.members.includes(uid)) return;
      const members = conv.members.slice();
      db.data.conversations = db.data.conversations.filter((c) => c.id !== convId);
      db.data.messages = db.data.messages.filter((m) => m.convId !== convId);
      scheduleWrite();
      for (const m of members) {
        io.to(`u:${m}`).emit('chat:removed', { convId });
        io.to(`u:${m}`).emit('chat:list', convListFor(m));
        io.to(`u:${m}`).emit('chat:inbox', { total: totalUnread(m) });
      }
    });

    // Renvoie l'état complet à la demande (corrige l'affichage au retour sur le lobby).
    socket.on('lobby:refresh', () => {
      socket.emit('lobby:games', gameList());
      socket.emit('lobby:rooms', lobbyList());
      socket.emit('presence:list', presenceList());
    });

    socket.on('room:create', ({ gameKey, name, options }, ack) => {
      const game = GAMES[gameKey];
      if (!game || !game.ready) return ack?.({ error: 'Ce jeu n\'est pas encore disponible.' });
      const id = nanoid(6);
      const room = {
        id,
        name: String(name || '').trim().slice(0, 40) || `Salon de ${socket.data.user.displayName}`,
        gameKey,
        options: options || {},
        hostId: socket.data.user.id,
        ownerId: socket.data.user.id, // créatrice du salon : prioritaire pour la couronne
        players: [],
        roster: {},
        chat: [],
        game: null,
        createdAt: Date.now(),
      };
      // On crée directement la partie (plus besoin de cliquer "Lancer la partie").
      room.game = GAMES[gameKey].create(room.options);
      rooms.set(id, room);
      snapshotRooms();
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

      clearTimeout(room.deleteTimer); // on annule une éventuelle suppression différée
      socket.join(roomId);
      socket.data.roomId = roomId;
      if (!already) {
        room.players.push({
          id: socket.data.user.id,
          displayName: socket.data.user.displayName,
          gender: socket.data.user.gender,
          avatar: socket.data.user.avatar || null,
        });
      }
      ack?.({ ok: true });
      await emitRoomState(roomId);
      broadcastLobby();
    });

    socket.on('room:leave', async () => {
      await leaveRoom(socket);
    });

    // Chat du salon (événement distinct de 'chat:send' qui sert aux messages
    // privés : avant, les deux partageaient le même nom et un message privé
    // envoyé depuis un salon était aussi posté dans le chat du salon).
    socket.on('room:chat', async ({ text }) => {
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
      room.game = GAMES[room.gameKey].create(room.options);
      room.chat.push({ id: nanoid(8), userId: 'system', displayName: 'Système', text: '🎲 Nouvelle partie ! Choisissez vos équipes.', ts: Date.now() });
      ack?.({ ok: true });
      await emitRoomState(room.id);
      broadcastLobby();
    });

    // Scribbl : relais léger des traits de dessin (hors état du jeu).
    // Seule la dessinatrice du tour peut émettre ; on diffuse aux autres du salon.
    socket.on('scribbl:draw', (data) => {
      const room = rooms.get(socket.data.roomId);
      if (!room || room.gameKey !== 'scribbl' || !room.game) return;
      if (room.game.drawer !== socket.data.user.id || room.game.phase !== 'draw') return;
      socket.to(socket.data.roomId).emit('scribbl:draw', data);
    });

    // Action de jeu générique, déléguée au moteur du jeu concerné.
    // Billard : relais léger de la visée (hors état du jeu) — l'adversaire voit
    // la flèche et la puissance bouger en direct pendant le tour de l'autre.
    socket.on('pool:aim', (data) => {
      const room = rooms.get(socket.data.roomId);
      if (!room || room.gameKey !== 'pool' || !room.game) return;
      if (room.game.turn !== socket.data.user.id) return;
      const dx = Number(data?.dx), dy = Number(data?.dy);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      socket.to(room.id).emit('pool:aim', {
        dx, dy,
        power: Math.max(0, Math.min(1, Number(data?.power) || 0)),
      });
    });

    // Mini Golf : même relais de visée léger que le billard.
    socket.on('golf:aim', (data) => {
      const room = rooms.get(socket.data.roomId);
      if (!room || room.gameKey !== 'golf' || !room.game) return;
      if (room.game.turn !== socket.data.user.id) return;
      const dx = Number(data?.dx), dy = Number(data?.dy);
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      socket.to(room.id).emit('golf:aim', {
        dx, dy,
        power: Math.max(0, Math.min(1, Number(data?.power) || 0)),
        by: socket.data.user.id,
      });
    });

    socket.on('game:action', async (payload, ack) => {
      const room = rooms.get(socket.data.roomId);
      if (!room || !room.game) return ack?.({ error: 'Aucune partie en cours.' });
      try {
        // Le moteur peut avoir besoin des prénoms (ex. narration du Loup Garou).
        syncGameContext(room);
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
      removePresence(socket.data.user);
      broadcastPresence();
    });
  });

  // Horloge serveur : fait avancer les jeux à minuteur (Loup Garou, Scribbl…)
  // même si tous les onglets sont en veille. Avant, c'étaient les clients qui
  // déclenchaient les fins de minuteur — un téléphone verrouillé figeait la partie.
  let tickNo = 0;
  setInterval(async () => {
    tickNo += 1;
    for (const room of rooms.values()) {
      const def = GAMES[room.gameKey];
      if (!room.game || !def.tick) continue;
      syncGameContext(room);
      let changed = false;
      try { changed = def.tick(room.game); } catch (e) { console.error('tick', room.gameKey, e); }
      if (changed) {
        await emitRoomState(room.id);
        broadcastLobby();
      }
    }
    // Sauvegarde périodique des salons (toutes les ~10 s) pour survivre aux redémarrages.
    if (tickNo % 10 === 0 && rooms.size) snapshotRooms();
  }, 1000);

  return io;
}
