import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Paper, Button, TextField, Typography, Stack, ToggleButtonGroup, ToggleButton, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Grid3x3, Ship, Dices, Drama, Eye, Brush, Moon, Gamepad2, DoorOpen, Plus, Users2, Swords, Fish, Skull, SpellCheck, Bot } from 'lucide-react';
import { GiChessPawn, GiCardRandom, GiEightBall, GiArcheryTarget } from 'react-icons/gi';
import { getSocket } from '../socket.js';

// Icône + couleurs propres à chaque jeu (plus représentatif et convivial).
const GAME_STYLE = {
  codenames: { Icon: Grid3x3, bg: '#efe6fb', fg: '#8a76a6' },
  bataille: { Icon: Ship, bg: '#dcebf7', fg: '#2b7fd4' },
  uno: { uno: true, bg: '#fdeaea', fg: '#e4433a' },
  flip7: { Icon: GiCardRandom, bg: '#e3f4ea', fg: '#2e8c47' },
  bullshit: { Icon: Drama, bg: '#f8e7f0', fg: '#cf7b97' },
  conspiracy: { Icon: Eye, bg: '#efeadb', fg: '#9a8a55' },
  scribbl: { Icon: Brush, bg: '#e4eefb', fg: '#5b8def' },
  loupgarou: { Icon: Moon, bg: '#e8e5f4', fg: '#6b5ca8' },
  echecs: { Icon: GiChessPawn, bg: '#ece7e0', fg: '#5a4a3a' },
  ludo: { Icon: Dices, bg: '#e6f2e8', fg: '#3a8c5a' },
  gofish: { Icon: Fish, bg: '#dbeef7', fg: '#2b7fd4' },
  pouilleux: { Icon: Skull, bg: '#e3f0d9', fg: '#5a8c3a' },
  guessme: { mark: '??', bg: '#f4e7fb', fg: '#8a55bf' },
  pool: { Icon: GiEightBall, bg: '#ddefe4', fg: '#20714a' },
  archery: { Icon: GiArcheryTarget, bg: '#fdeee2', fg: '#d4502e' },
  petitbac: { Icon: SpellCheck, bg: '#fbf0dc', fg: '#b5822a' },
};
const DEFAULT_STYLE = { Icon: Gamepad2, bg: '#eee', fg: '#888' };

function UnoMini({ small }) {
  return (
    <span className={`tile-uno ${small ? 'sm' : ''}`}>
      <i style={{ background: '#e4433a' }} />
      <i style={{ background: '#edb015' }} />
      <i style={{ background: '#2b7fd4' }} />
    </span>
  );
}

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
            const st = GAME_STYLE[g.key] || DEFAULT_STYLE;
            return (
              <button
                key={g.key}
                className={`game-tile ${selected === g.key ? 'selected' : ''} ${!g.ready ? 'disabled' : ''}`}
                disabled={!g.ready}
                onClick={() => setSelected(g.key)}
              >
                {!g.ready && <span className="soon-tag">bientôt</span>}
                <span className="tile-icon" style={{ background: st.bg, color: st.fg }}>
                  {st.uno ? <UnoMini /> : st.mark ? <span className="tile-mark">{st.mark}</span> : <st.Icon size={26} />}
                </span>
                <span className="game-label">{g.label}</span>
                <span className="game-meta">{g.minPlayers === g.maxPlayers ? `${g.minPlayers} joueurs` : `${g.minPlayers}–${g.maxPlayers} joueurs`}</span>
              </button>
            );
          })}
        </div>

      </Paper>

      <Paper elevation={1} className="lobby-section" sx={{ p: 2.5 }}>
        <Typography variant="h5" className="section-title" sx={{ mb: 2 }}><DoorOpen size={22} /> Salons ouverts</Typography>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        {rooms.length === 0 ? (
          <Typography color="text.secondary">Aucun salon là, sois le premier à en lancer un !</Typography>
        ) : (
          <Stack spacing={1.2}>
            {rooms.map((r) => {
              const st = GAME_STYLE[r.gameKey] || DEFAULT_STYLE;
              return (
                <Paper key={r.id} variant="outlined" className="room-card" sx={{ p: 1.5 }}>
                  <div className="room-main">
                    <span className="ic" style={{ color: st.fg }}>{st.uno ? <UnoMini small /> : st.mark ? <span className="tile-mark sm">{st.mark}</span> : <st.Icon size={22} />}</span>
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

      {/* Création de salon en pop-up : tap sur un jeu → on nomme et on crée, sans scroll */}
      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {(() => { const st = GAME_STYLE[selected] || DEFAULT_STYLE; return (
            <span className="ic" style={{ color: st.fg }}>{st.uno ? <UnoMini small /> : st.mark ? <span className="tile-mark sm">{st.mark}</span> : <st.Icon size={20} />}</span>
          ); })()}
          Créer un salon — {games.find((g) => g.key === selected)?.label}
        </DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
          <TextField autoFocus fullWidth size="small" sx={{ mt: 1 }} value={roomName}
            onChange={(e) => setRoomName(e.target.value)} placeholder="Nom du salon (optionnel)" />
          {selected === 'codenames' && (
            <Stack spacing={1} sx={{ mt: 2 }}>
              <Typography color="text.secondary" sx={{ fontWeight: 600, fontSize: 14 }}>Mode :</Typography>
              <ToggleButtonGroup value={cnMode} exclusive color="primary" onChange={(_, v) => v && setCnMode(v)} size="small" fullWidth>
                <ToggleButton value="duet"><Users2 size={16} />&nbsp;Duo coop</ToggleButton>
                <ToggleButton value="versus"><Swords size={16} />&nbsp;Versus</ToggleButton>
                <ToggleButton value="ia"><Bot size={16} />&nbsp;Duo IA</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSelected(null)}>Annuler</Button>
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={createRoom}>Créer le salon</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
