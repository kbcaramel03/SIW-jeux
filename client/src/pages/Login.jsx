import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
      <div className="card auth-card">
        <h1 className="auth-logo">Soirée Jeux</h1>
        <p className="auth-subtitle">Connecte-toi blg, la team t'attend</p>
        <form onSubmit={submit}>
          <label>Ton identifiant</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="genre ton pseudo" autoFocus />
          <label>Ton mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            <LogIn size={18} /> {busy ? 'On y va…' : 'Go, je me connecte'}
          </button>
        </form>
        <p className="auth-switch">
          Pas encore dans la team ? <Link to="/register">Inscris-toi ici</Link>
        </p>
      </div>
    </div>
  );
}
