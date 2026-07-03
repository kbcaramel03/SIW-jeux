import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Paper, Button, Chip, Typography, Alert, Fab, Drawer, IconButton } from '@mui/material';
import { ChevronLeft, Users, MessageCircle, Crown, X, WifiOff } from 'lucide-react';
import { getSocket } from '../socket.js';
import Chat from '../components/Chat.jsx';
import { Avatar } from '../components/OnlineRail.jsx';

// Chaque jeu est chargé à la demande : on ne télécharge que celui auquel on joue.
const Codenames = lazy(() => import('../games/Codenames.jsx'));
const Battleship = lazy(() => import('../games/Battleship.jsx'));
const Uno = lazy(() => import('../games/Uno.jsx'));
const Flip7 = lazy(() => import('../games/Flip7.jsx'));
const Bullshit = lazy(() => import('../games/Bullshit.jsx'));
const Conspiracy = lazy(() => import('../games/Conspiracy.jsx'));
const LoupGarou = lazy(() => import('../games/LoupGarou.jsx'));
const Scribbl = lazy(() => import('../games/Scribbl.jsx'));
const Ludo = lazy(() => import('../games/Ludo.jsx'));
const Echecs = lazy(() => import('../games/Echecs.jsx'));
const GoFish = lazy(() => import('../games/GoFish.jsx'));
const Pouilleux = lazy(() => import('../games/Pouilleux.jsx'));
const GuessMe = lazy(() => import('../games/GuessMe.jsx'));
const Pool = lazy(() => import('../games/Pool.jsx'));

export default function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const join = () => socket.emit('room:join', { roomId: id }, (res) => {
      if (res?.error) {
        setError(res.error);
        setTimeout(() => navigate('/'), 1500);
      }
    });
    const onState = (state) => {
      if (state.id === id) setRoom(state);
    };
    // Après une coupure (wifi, veille mobile), la socket se reconnecte toute
    // seule mais n'est plus dans le salon : on le rejoint à chaque connexion.
    const onConnect = () => { setOffline(false); join(); };
    const onDisconnect = () => setOffline(true);
    socket.on('room:state', onState);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    setOffline(!socket.connected);
    join();
    return () => {
      socket.off('room:state', onState);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.emit('room:leave');
    };
  }, [id]);

  // Les erreurs d'action s'effacent toutes seules (pas de bannière qui traîne).
  useEffect(() => {
    if (!error || !room) return undefined;
    const t = setTimeout(() => setError(''), 4000);
    return () => clearTimeout(t);
  }, [error, room]);

  function sendAction(payload) {
    return new Promise((resolve) => {
      getSocket().emit('game:action', payload, (res) => {
        if (res?.error) setError(res.error);
        else setError('');
        resolve(res);
      });
    });
  }

  function newGame() {
    getSocket().emit('game:new', (res) => {
      if (res?.error) setError(res.error);
    });
  }

  if (error && !room) return <div className="center-screen">{error}</div>;
  if (!room) return <div className="center-screen">Connexion au salon…</div>;

  const isHost = room.hostId === room.me.id;

  const sidePanel = (
    <>
      <Paper elevation={1} className="players-box" sx={{ p: 2 }}>
        <h3 className="section-title"><Users size={18} /> Joueurs ({room.players.filter((p) => p.connected !== false).length})</h3>
        <ul className="player-list">
          {room.players.map((p) => (
            <li key={p.id} className={p.connected === false ? 'away' : ''}>
              <Avatar name={p.displayName} gender={p.gender} avatar={p.avatar} />
              <span>{p.displayName}{p.id === room.me.id ? ' (toi)' : ''}</span>
              {p.id === room.hostId && <Crown size={15} color="#c2a36b" />}
              {p.connected === false && <span className="away-tag"><WifiOff size={12} /> absent·e</span>}
            </li>
          ))}
        </ul>
      </Paper>
      <Paper elevation={1} className="chat-box" sx={{ p: 2 }}>
        <h3 className="section-title"><MessageCircle size={18} /> Chat</h3>
        <Chat messages={room.chat} meId={room.me.id} />
      </Paper>
    </>
  );

  return (
    <>
    <div className="room fade-up">
      <div className="room-header">
        <Button variant="outlined" size="small" onClick={() => navigate('/')} startIcon={<ChevronLeft size={16} />}>Lobby</Button>
        <Typography variant="h5" sx={{ flex: 1 }}>{room.name}</Typography>
        <Chip color="primary" label={room.gameLabel} />
      </div>

      {offline && <Alert severity="warning" icon={<WifiOff size={18} />} sx={{ mb: 1.5 }}>Connexion perdue — reconnexion en cours…</Alert>}
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      <div className="room-body">
        <div className="game-area">
          <Suspense fallback={<div className="center-screen">Chargement du jeu…</div>}>
          {room.gameKey === 'codenames' && (
            <Codenames room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'bataille' && (
            <Battleship room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'uno' && (
            <Uno room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'flip7' && (
            <Flip7 room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'bullshit' && (
            <Bullshit room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'conspiracy' && (
            <Conspiracy room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'loupgarou' && (
            <LoupGarou room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'scribbl' && (
            <Scribbl room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'ludo' && (
            <Ludo room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'echecs' && (
            <Echecs room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'gofish' && (
            <GoFish room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'pouilleux' && (
            <Pouilleux room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'guessme' && (
            <GuessMe room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'pool' && (
            <Pool room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          </Suspense>
        </div>

        <aside className="room-side">{sidePanel}</aside>
      </div>
    </div>

      {/* Mobile : chat du salon en bulle flottante */}
      <Fab color="primary" className="room-fab" sx={{ position: 'fixed', right: 16, bottom: 16, zIndex: 40 }} onClick={() => setChatOpen(true)} aria-label="Chat du salon">
        <MessageCircle size={24} />
      </Fab>
      <Drawer anchor="right" open={chatOpen} onClose={() => setChatOpen(false)} PaperProps={{ sx: { width: 320, maxWidth: '92vw', p: 1.5 } }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <IconButton size="small" onClick={() => setChatOpen(false)}><X size={18} /></IconButton>
        </div>
        {sidePanel}
      </Drawer>
    </>
  );
}
