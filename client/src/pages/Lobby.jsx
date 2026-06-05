import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, Button, TextField, Typography, Stack, ToggleButtonGroup, ToggleButton, Alert, Chip } from '@mui/material';
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
  const [cnMode, setCnMode] = useState('versus');
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = getSocket();
    const onGames = (list) => setGames(list);
    const onRooms = (list) => setRooms(list);
    socket.on('lobby:games', onGames);
    socket.on('lobby:rooms', onRooms);
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
      <Paper elevation={1} className="lobby-section" sx={{ p: 2.5 }}>
        <Typography variant="h5" className="section-title" sx={{ mb: 2 }}><Gamepad2 size={22} /> On joue à quoi girls ?</Typography>
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
                <span className="game-meta">{g.minPlayers === g.maxPlayers ? `${g.minPlayers} joueurs` : `${g.minPlayers}–${g.maxPlayers} joueurs`}</span>
              </button>
            );
          })}
        </div>

        {selected === 'codenames' && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography color="text.secondary" sx={{ fontWeight: 600 }}>Mode :</Typography>
            <ToggleButtonGroup value={cnMode} exclusive color="primary" onChange={(_, v) => v && setCnMode(v)} size="small">
              <ToggleButton value="duet"><Users2 size={16} />&nbsp;Duo coopératif</ToggleButton>
              <ToggleButton value="versus"><Swords size={16} />&nbsp;Versus 2 équipes</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary">{cnMode === 'duet' ? '2-3 joueurs' : '4 joueurs et +'}</Typography>
          </Stack>
        )}

        {selected && (
          <Stack direction="row" spacing={1.5} sx={{ mt: 2, flexWrap: 'wrap', gap: 1.5 }}>
            <TextField size="small" sx={{ flex: 1, minWidth: 180 }} value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Nom du salon (optionnel)" />
            <Button variant="contained" onClick={createRoom} startIcon={<Plus size={18} />}>Créer le salon</Button>
          </Stack>
        )}
      </Paper>

      <Paper elevation={1} className="lobby-section" sx={{ p: 2.5 }}>
        <Typography variant="h5" className="section-title" sx={{ mb: 2 }}><DoorOpen size={22} /> Salons ouverts</Typography>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {rooms.length === 0 ? (
          <Typography color="text.secondary">Aucun salon là, sois le premier à en lancer un !</Typography>
        ) : (
          <Stack spacing={1.2}>
            {rooms.map((r) => {
              const Ic = GAME_ICONS[r.gameKey] || Gamepad2;
              return (
                <Paper key={r.id} variant="outlined" className="room-card" sx={{ p: 1.5 }}>
                  <div className="room-main">
                    <span className="ic"><Ic size={22} /></span>
                    <div>
                      <strong>{r.name}</strong>
                      <div className="room-sub">{r.gameLabel} · {r.players}/{r.maxPlayers}{r.inProgress ? ' · en cours' : ''}</div>
                    </div>
                  </div>
                  <Button variant="contained" color="secondary" size="small" onClick={() => joinRoom(r.id)}>Rejoindre</Button>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Paper>
    </div>
  );
}
