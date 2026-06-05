import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Paper, TextField, Button, Typography, Stack, Alert } from '@mui/material';
import { LogIn } from 'lucide-react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <Paper elevation={1} className="auth-card fade-up" sx={{ p: 3.5 }}>
        <Typography variant="h4" className="auth-logo">Soirée Jeux</Typography>
        <Typography color="text.secondary" sx={{ mb: 2.5, fontWeight: 600 }}>Connecte-toi blg, la team t'attend</Typography>
        <form onSubmit={submit}>
          <Stack spacing={2}>
            <TextField label="Ton identifiant" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
            <TextField label="Ton mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" fullWidth disabled={busy} startIcon={<LogIn size={18} />}>
              {busy ? 'On y va…' : 'Go, je me connecte'}
            </Button>
          </Stack>
        </form>
        <Typography variant="body2" sx={{ mt: 2 }}>
          Pas encore dans la team ? <Link to="/register" className="link-accent">Inscris-toi ici</Link>
        </Typography>
      </Paper>
    </div>
  );
}
