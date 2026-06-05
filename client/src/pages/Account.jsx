import { useState } from 'react';
import { Paper, TextField, Button, Typography, Stack, Alert } from '@mui/material';
import { Settings, KeyRound } from 'lucide-react';
import { apiPost } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar } from '../components/OnlineRail.jsx';

export default function Account() {
  const { user } = useAuth();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setMsg('');
    setError('');
    try {
      await apiPost('/auth/change-password', { currentPassword, newPassword });
      setMsg('Mot de passe changé, nickel !');
      setCurrent('');
      setNew('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page fade-up">
      <Paper elevation={1} className="auth-card" sx={{ p: 3.5 }}>
        <Typography variant="h5" className="section-title" sx={{ justifyContent: 'center' }}><Settings size={24} /> Mon compte</Typography>
        <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="center" sx={{ my: 2 }}>
          <Avatar name={user.displayName} gender={user.gender} size={40} />
          <span><strong>{user.displayName}</strong> · {user.role === 'admin' ? 'admin' : 'membre'}</span>
        </Stack>
        <Typography variant="subtitle1" className="section-title" sx={{ mb: 1 }}><KeyRound size={18} /> Changer mon mot de passe</Typography>
        <form onSubmit={submit}>
          <Stack spacing={2}>
            <TextField label="Mot de passe actuel" type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
            <TextField label="Nouveau mot de passe" type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
            {error && <Alert severity="error">{error}</Alert>}
            {msg && <Alert severity="success">{msg}</Alert>}
            <Button type="submit" variant="contained" fullWidth>Mettre à jour</Button>
          </Stack>
        </form>
      </Paper>
    </div>
  );
}
