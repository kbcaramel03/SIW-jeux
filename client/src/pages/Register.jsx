import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Register() {
  const { register } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(username, displayName, password);
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
        <div className="card auth-card">
          <h1 className="auth-title">✅ C'est envoyé !</h1>
          <p className="auth-subtitle">
            Ton inscription est en attente. Khadija doit la valider avant que tu puisses te connecter.
          </p>
          <Link to="/login" className="btn btn-primary btn-block">Retour à la connexion</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="auth-title">Créer un compte</h1>
        <p className="auth-subtitle">Ton inscription sera validée par l'admin</p>
        <form onSubmit={submit}>
          <label>Prénom affiché</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Ton prénom" autoFocus />
          <label>Identifiant (pour se connecter)</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="pseudo unique" />
          <label>Mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            {busy ? '…' : "S'inscrire"}
          </button>
        </form>
        <p className="auth-switch">
          Déjà un compte ? <Link to="/login">Connecte-toi</Link>
        </p>
      </div>
    </div>
  );
}
