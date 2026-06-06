import { useRef, useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Paper, TextField, Button, Typography, Stack, Alert, Divider, Dialog, DialogContent, DialogActions, Slider } from '@mui/material';
import { Settings, KeyRound, Camera, Trash2, UserRound, IdCard, ZoomIn } from 'lucide-react';
import { apiPost } from '../api.js';
import { useAuth } from '../auth.jsx';
import { reconnectSocket } from '../socket.js';
import { Avatar } from '../components/OnlineRail.jsx';

const ROLE_LABEL = { admin: 'admin', moderator: 'droit ++', member: 'membre' };

// Découpe la zone choisie et la réduit en vignette carrée (base64).
function getCroppedThumb(src, area, size = 200) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = src;
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

  // Recadrage
  const [cropSrc, setCropSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState(null);
  const onCropComplete = useCallback((_, px) => setAreaPixels(px), []);

  const ok = (m) => { setMsg(m); setError(''); };
  const ko = (e) => { setError(e.message || String(e)); setMsg(''); };
  // Reconnecte le socket pour rafraîchir la présence (photo/nom visibles « En ligne »).
  const refreshPresence = () => reconnectSocket();

  function pickPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCrop({ x: 0, y: 0 }); setZoom(1);
    setCropSrc(URL.createObjectURL(file));
    if (fileRef.current) fileRef.current.value = '';
  }

  async function confirmCrop() {
    try {
      const avatar = await getCroppedThumb(cropSrc, areaPixels);
      const { user: u } = await apiPost('/auth/profile', { avatar });
      setUser(u); setCropSrc(null); refreshPresence(); ok('Photo mise à jour !');
    } catch (err) { ko(err); }
  }

  async function removePhoto() {
    try { const { user: u } = await apiPost('/auth/profile', { avatar: null }); setUser(u); refreshPresence(); ok('Photo retirée.'); }
    catch (err) { ko(err); }
  }
  async function saveName() {
    try { const { user: u } = await apiPost('/auth/profile', { displayName }); setUser(u); refreshPresence(); ok('Nom mis à jour !'); }
    catch (err) { ko(err); }
  }
  async function saveUsername() {
    try { const { user: u } = await apiPost('/auth/change-username', { username }); setUser(u); refreshPresence(); ok('Identifiant mis à jour !'); }
    catch (err) { ko(err); }
  }
  async function changePassword(e) {
    e.preventDefault();
    try { await apiPost('/auth/change-password', { currentPassword, newPassword }); setCurrent(''); setNew(''); ok('Mot de passe changé, nickel !'); }
    catch (err) { ko(err); }
  }

  return (
    <div className="auth-page fade-up">
      <Paper elevation={1} className="auth-card" sx={{ p: 3.5 }}>
        <Typography variant="h5" className="section-title" sx={{ justifyContent: 'center' }}><Settings size={24} /> Mon compte</Typography>

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

        <Typography variant="subtitle1" className="section-title" sx={{ mb: 1 }}><UserRound size={18} /> Nom affiché</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField size="small" fullWidth value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          <Button variant="contained" onClick={saveName} disabled={!displayName.trim() || displayName === user.displayName}>OK</Button>
        </Stack>

        <Typography variant="subtitle1" className="section-title" sx={{ mb: 1 }}><IdCard size={18} /> Identifiant de connexion</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField size="small" fullWidth value={username} onChange={(e) => setUsername(e.target.value)} />
          <Button variant="contained" onClick={saveUsername} disabled={!username.trim() || username === user.username}>OK</Button>
        </Stack>

        <Divider sx={{ my: 1.5 }} />

        <Typography variant="subtitle1" className="section-title" sx={{ mb: 1 }}><KeyRound size={18} /> Changer mon mot de passe</Typography>
        <form onSubmit={changePassword}>
          <Stack spacing={2}>
            <TextField label="Mot de passe actuel" type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
            <TextField label="Nouveau mot de passe" type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
            <Button type="submit" variant="contained" fullWidth disabled={!currentPassword || !newPassword}>Mettre à jour</Button>
          </Stack>
        </form>
      </Paper>

      {/* Recadrage de la photo */}
      <Dialog open={!!cropSrc} onClose={() => setCropSrc(null)} maxWidth="xs" fullWidth>
        <DialogContent sx={{ p: 0 }}>
          <div style={{ position: 'relative', width: '100%', height: 320, background: '#2a2230' }}>
            {cropSrc && (
              <Cropper image={cropSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false}
                onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
            )}
          </div>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.5, pt: 2 }}>
            <ZoomIn size={18} />
            <Slider min={1} max={3} step={0.05} value={zoom} onChange={(_, v) => setZoom(v)} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, pb: 2 }}>
          <Button onClick={() => setCropSrc(null)}>Annuler</Button>
          <Button variant="contained" onClick={confirmCrop} disabled={!areaPixels}>Valider</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
