import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Users, MessageCircle, Crown } from 'lucide-react';
import { getSocket } from '../socket.js';
import Chat from '../components/Chat.jsx';
import { Avatar } from '../components/OnlineRail.jsx';
import Codenames from '../games/Codenames.jsx';
import Battleship from '../games/Battleship.jsx';

export default function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = getSocket();
    const onState = (state) => {
      if (state.id === id) setRoom(state);
    };
    socket.on('room:state', onState);
    socket.emit('room:join', { roomId: id }, (res) => {
      if (res?.error) {
        setError(res.error);
        setTimeout(() => navigate('/'), 1500);
      }
    });
    return () => {
      socket.off('room:state', onState);
      socket.emit('room:leave');
    };
  }, [id]);

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

  return (
    <div className="room fade-up">
      <div className="room-header">
        <button className="btn btn-ghost btn-mini" onClick={() => navigate('/')}><ChevronLeft size={16} /> Lobby</button>
        <h2>{room.name}</h2>
        <span className="badge">{room.gameLabel}</span>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="room-body">
        <div className="game-area">
          {room.gameKey === 'codenames' && (
            <Codenames room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
          {room.gameKey === 'bataille' && (
            <Battleship room={room} isHost={isHost} onAction={sendAction} onNewGame={newGame} />
          )}
        </div>

        <aside className="room-side">
          <div className="players-box card">
            <h3 className="section-title"><Users size={18} /> Joueurs ({room.players.length})</h3>
            <ul className="player-list">
              {room.players.map((p) => (
                <li key={p.id}>
                  <Avatar name={p.displayName} gender={p.gender} />
                  <span>{p.displayName}{p.id === room.me.id ? ' (toi)' : ''}</span>
                  {p.id === room.hostId && <Crown size={15} color="#f59e0b" />}
                </li>
              ))}
            </ul>
          </div>
          <div className="chat-box card">
            <h3 className="section-title"><MessageCircle size={18} /> Chat</h3>
            <Chat messages={room.chat} meId={room.me.id} />
          </div>
        </aside>
      </div>
    </div>
  );
}
