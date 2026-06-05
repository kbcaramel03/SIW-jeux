import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Ship, Layers, Dices, Drama, Eye, Paintbrush, Moon, Gamepad2, DoorOpen, Plus, Users2, Swords } from 'lucide-react';
import { getSocket } from '../socket.js';

const GAME_ICONS = {
  codenames: Search, bataille: Ship, uno: Layers, flip7: Dices,
  bullshit: Drama, conspiracy: Eye, scribbl: Paintbrush, loupgarou: Moon,
};

export default function Lobby() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selected, setSelected] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [cnMode, setCnMode] = useState('versus'); // mode Code Names choisi
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = getSocket();
    const onGames = (list) => setGames(list);
    const onRooms = (list) => setRooms(list);
    socket.on('lobby:games', onGames);
    socket.on('lobby:rooms', onRooms);
    // On quitte tout salon précédent ET on redemande les listes (corrige l'affichage vide au retour).
    socket.emit('room:leave');
    socket.emit('lobby:refresh');
    return () => {
      socket.off('lobby:games', onGames);
      socket.off('lobby:rooms', onRooms);
    };
  }, []);

  function createRoom() {
    if (!selected) return;
    setError('');
    const options = selected === 'codenames' ? { mode: cnMode } : {};
    getSocket().emit('room:create', { gameKey: selected, name: roomName, options }, (res) => {
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
    <div className="lobby fade-up">
      <section className="lobby-section">
        <h2 className="section-title"><Gamepad2 size={22} /> On joue à quoi ?</h2>
        <div className="games-grid">
          {games.map((g) => {
            const Ic = GAME_ICONS[g.key] || Gamepad2;
            return (
              <button
                key={g.key}
                className={`game-tile ${selected === g.key ? 'selected' : ''} ${!g.ready ? 'disabled' : ''}`}
                disabled={!g.ready}
                onClick={() => setSelected(g.key)}
              >
                {!g.ready && <span className="soon-tag">bientôt</span>}
                <span className="tile-icon"><Ic size={24} /></span>
                <span className="game-label">{g.label}</span>
                <span className="game-meta">{g.minPlayers}–{g.maxPlayers} joueurs</span>
              </button>
            );
          })}
        </div>
        {selected === 'codenames' && (
          <div className="mode-choice">
            <span className="mode-choice-label">Mode :</span>
            <button
              className={`mode-pill ${cnMode === 'duet' ? 'on' : ''}`}
              onClick={() => setCnMode('duet')}
            >
              <Users2 size={16} /> Duo coopératif <em>2-3 joueurs</em>
            </button>
            <button
              className={`mode-pill ${cnMode === 'versus' ? 'on' : ''}`}
              onClick={() => setCnMode('versus')}
            >
              <Swords size={16} /> Versus 2 équipes <em>4 joueurs et +</em>
            </button>
          </div>
        )}
        {selected && (
          <div className="create-row">
            <input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="Nom du salon (optionnel)"
            />
            <button className="btn btn-primary" onClick={createRoom}><Plus size={18} /> Créer le salon</button>
          </div>
        )}
      </section>

      <section className="lobby-section">
        <h2 className="section-title"><DoorOpen size={22} /> Salons ouverts</h2>
        {error && <p className="error">{error}</p>}
        {rooms.length === 0 ? (
          <p className="muted">Aucun salon là, sois le premier à en lancer un !</p>
        ) : (
          <ul className="room-list">
            {rooms.map((r) => {
              const Ic = GAME_ICONS[r.gameKey] || Gamepad2;
              return (
                <li key={r.id} className="room-card">
                  <div className="room-main">
                    <span className="ic"><Ic size={22} /></span>
                    <div>
                      <strong>{r.name}</strong>
                      <div className="room-sub">
                        {r.gameLabel} · {r.players}/{r.maxPlayers}{r.inProgress ? ' · en cours' : ''}
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-secondary btn-mini" onClick={() => joinRoom(r.id)}>Rejoindre</button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
