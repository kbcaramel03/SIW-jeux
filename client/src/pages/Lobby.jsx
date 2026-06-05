import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '../socket.js';

export default function Lobby() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = getSocket();
    const onGames = (list) => setGames(list);
    const onRooms = (list) => setRooms(list);
    socket.on('lobby:games', onGames);
    socket.on('lobby:rooms', onRooms);
    // Au cas où on était déjà connecté, on redemande la liste.
    socket.emit('room:leave');
    return () => {
      socket.off('lobby:games', onGames);
      socket.off('lobby:rooms', onRooms);
    };
  }, []);

  function createRoom() {
    if (!selected) return;
    setError('');
    getSocket().emit('room:create', { gameKey: selected, name: roomName }, (res) => {
      if (res?.error) return setError(res.error);
      navigate(`/room/${res.roomId}`);
    });
  }

  function joinRoom(id) {
    setError('');
    getSocket().emit('room:join', { roomId: id }, (res) => {
      if (res?.error) return setError(res.error);
      navigate(`/room/${id}`);
    });
  }

  return (
    <div className="lobby">
      <section className="lobby-section">
        <h2>🎲 Lancer un jeu</h2>
        <div className="games-grid">
          {games.map((g) => (
            <button
              key={g.key}
              className={`game-tile ${selected === g.key ? 'selected' : ''} ${!g.ready ? 'disabled' : ''}`}
              disabled={!g.ready}
              onClick={() => setSelected(g.key)}
            >
              <span className="game-emoji">{g.emoji}</span>
              <span className="game-label">{g.label}</span>
              <span className="game-meta">
                {g.ready ? `${g.minPlayers}–${g.maxPlayers} joueuses` : 'bientôt'}
              </span>
            </button>
          ))}
        </div>
        {selected && (
          <div className="create-row">
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Nom du salon (optionnel)"
            />
            <button className="btn btn-primary" onClick={createRoom}>Créer le salon</button>
          </div>
        )}
      </section>

      <section className="lobby-section">
        <h2>🚪 Salons ouverts</h2>
        {error && <p className="error">{error}</p>}
        {rooms.length === 0 ? (
          <p className="muted">Aucun salon pour l'instant. Lance le premier !</p>
        ) : (
          <ul className="room-list">
            {rooms.map((r) => (
              <li key={r.id} className="room-card">
                <div>
                  <span className="room-emoji">{r.emoji}</span>
                  <strong>{r.name}</strong>
                  <div className="room-sub">
                    {r.gameLabel} · {r.players}/{r.maxPlayers} {r.inProgress && '· en cours'}
                  </div>
                </div>
                <button className="btn btn-secondary" onClick={() => joinRoom(r.id)}>Rejoindre</button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
