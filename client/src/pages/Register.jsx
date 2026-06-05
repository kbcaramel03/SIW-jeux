import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Paper, TextField, Button, Typography, Stack, Alert, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { Sparkles } from 'lucide-react';
import { useAuth } from '../auth.jsx';

export default function Register() {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(username, displayName, password, gender);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="auth-page">
        <Paper elevation={1} className="auth-card fade-up" sx={{ p: 3.5 }}>
          <Typography variant="h4" className="auth-logo">Trop bien !</Typography>
          <Typography color="text.secondary" sx={{ mb: 2.5, fontWeight: 600 }}>
            Ton inscription est partie. Khadija doit la valider avant que tu puisses te connecter — tiens-la au courant !
          </Typography>
          <Button component={Link} to="/login" variant="contained" fullWidth>Retour à la connexion</Button>
        </Paper>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <Paper elevation={1} className="auth-card fade-up" sx={{ p: 3.5 }}>
        <Typography variant="h4" className="auth-logo">Rejoins la team</Typography>
        <Typography color="text.secondary" sx={{ mb: 2.5, fontWeight: 600 }}>Inscris-toi girlll (ou blg), c'est validé par l'admin</Typography>
        <form onSubmit={submit}>
          <Stack spacing={2}>
            <TextField label="T'es qui ? (prénom affiché)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoFocus />
            <div>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.8, fontWeight: 600 }}>Tu es…</Typography>
              <ToggleButtonGroup value={gender} exclusive onChange={(_, v) => v && setGender(v)} fullWidth color="primary">
                <ToggleButton value="F">Une fille</ToggleButton>
                <ToggleButton value="M">Un mec</ToggleButton>
                <ToggleButton value="A">Autre</ToggleButton>
              </ToggleButtonGroup>
            </div>
            <TextField label="Ton identifiant (pour te connecter)" value={username} onChange={(e) => setUsername(e.target.value)} />
            <TextField label="Ton mot de passe" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <Alert severity="error">{error}</Alert>}
            <Button type="submit" variant="contained" size="large" fullWidth disabled={busy} startIcon={<Sparkles size={18} />}>
              {busy ? 'On t\'inscrit…' : "C'est parti"}
            </Button>
          </Stack>
        </form>
        <Typography variant="body2" sx={{ mt: 2 }}>
          Déjà dans la team ? <Link to="/login" className="link-accent">Connecte-toi</Link>
        </Typography>
      </Paper>
    </div>
  );
}
