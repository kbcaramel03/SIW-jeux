import { useRef, useState } from 'react';
import { Paper, TextField, Button, Typography, Stack, Alert, Divider } from '@mui/material';
import { Settings, KeyRound, Camera, Trash2, UserRound, IdCard } from 'lucide-react';
import { apiPost } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar } from '../components/OnlineRail.jsx';

const ROLE_LABEL = { admin: 'admin', moderator: 'droit ++', member: 'membre' };

// Redimensionne une image en petite vignette carrée (base64) pour ne pas alourdir la base.
function fileToThumb(file, size = 160) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const m = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, size, size);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function Account() {
  const { user, setUser } = useAuth();
  const fileRef = useRef(null);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [username, setUsername] = useState(user.username);
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const ok = (m) => { setMsg(m); setError(''); };
  const ko = (e) => { setError(e.message || String(e)); setMsg(''); };

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const avatar = await fileToThumb(file);
      const { user: u } = await apiPost('/auth/profile', { avatar });
      setUser(u); ok('Photo mise à jour !');
    } catch (err) { ko(err); }
    finally { if (fileRef.current) fileRef.current.value = ''; }
  }

  async function removePhoto() {
    try { const { user: u } = await apiPost('/auth/profile', { avatar: null }); setUser(u); ok('Photo retirée.'); }
    catch (err) { ko(err); }
  }

  async function saveName() {
    try { const { user: u } = await apiPost('/auth/profile', { displayName }); setUser(u); ok('Nom mis à jour !'); }
    catch (err) { ko(err); }
  }

  async function saveUsername() {
    try { const { user: u } = await apiPost('/auth/change-username', { username }); setUser(u); ok('Identifiant mis à jour !'); }
    catch (err) { ko(err); }
  }

  async function changePassword(e) {
    e.preventDefault();
    try {
      await apiPost('/auth/change-password', { currentPassword, newPassword });
      setCurrent(''); setNew(''); ok('Mot de passe changé, nickel !');
    } catch (err) { ko(err); }
  }

  return (
    <div className="auth-page fade-up">
      <Paper elevation={1} className="auth-card" sx={{ p: 3.5 }}>
        <Typography variant="h5" className="section-title" sx={{ justifyContent: 'center' }}><Settings size={24} /> Mon compte</Typography>

        {/* Photo de profil */}
        <Stack alignItems="center" spacing={1.2} sx={{ my: 2 }}>
          <Avatar name={user.displayName} gender={user.gender} avatar={user.avatar} size={84} />
          <span className="muted">{ROLE_LABEL[user.role] || 'membre'}</span>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" startIcon={<Camera size={15} />} onClick={() => fileRef.current?.click()}>Changer la photo</Button>
            {user.avatar && <Button size="small" color="error" variant="outlined" startIcon={<Trash2 size={15} />} onClick={removePhoto}>Retirer</Button>}
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>{error}</Alert>}
        {msg && <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setMsg('')}>{msg}</Alert>}

        <Divider sx={{ my: 1.5 }} />

        {/* Nom affiché */}
        <Typography variant="subtitle1" className="section-title" sx={{ mb: 1 }}><UserRound size={18} /> Nom affiché</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField size="small" fullWidth value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Button variant="contained" onClick={saveName} disabled={!displayName.trim() || displayName === user.displayName}>OK</Button>
        </Stack>

        {/* Identifiant */}
        <Typography variant="subtitle1" className="section-title" sx={{ mb: 1 }}><IdCard size={18} /> Identifiant de connexion</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField size="small" fullWidth value={username} onChange={(e) => setUsername(e.target.value)} />
          <Button variant="contained" onClick={saveUsername} disabled={!username.trim() || username === user.username}>OK</Button>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        {/* Mot de passe */}
        <Typography variant="subtitle1" className="section-title" sx={{ mb: 1 }}><KeyRound size={18} /> Changer mon mot de passe</Typography>
        <form onSubmit={changePassword}>
          <Stack spacing={2}>
            <TextField label="Mot de passe actuel" type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
            <TextField label="Nouveau mot de passe" type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
            <Button type="submit" variant="contained" fullWidth disabled={!currentPassword || !newPassword}>Mettre à jour</Button>
          </Stack>
        </form>
      </Paper>
    </div>
  );
}
