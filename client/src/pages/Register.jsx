import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Check } from 'lucide-react';
import { useAuth } from '../auth.jsx';

const GENDERS = [
  { val: 'F', label: 'Une fille' },
  { val: 'M', label: 'Un mec' },
  { val: 'A', label: 'Autre' },
];

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
        <div className="card auth-card">
          <h1 className="auth-logo">Trop bien !</h1>
          <p className="auth-subtitle">
            Ton inscription est partie. Khadija doit la valider avant que tu puisses te connecter — tiens-la au courant girl !
          </p>
          <Link to="/login" className="btn btn-primary btn-block">Retour à la connexion</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <h1 className="auth-logo">Rejoins la team</h1>
        <p className="auth-subtitle">Inscris-toi girlll (ou blg), c'est validé par l'admin</p>
        <form onSubmit={submit}>
          <label>T'es qui ? (prénom affiché)</label>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="ton prénom" autoFocus />

          <label>Tu es…</label>
          <div className="gender-row">
            {GENDERS.map((g) => (
              <button type="button" key={g.val}
                className={`gender-opt ${gender === g.val ? 'on' : ''}`}
                onClick={() => setGender(g.val)}>
                {gender === g.val && <Check size={15} />}
                {g.label}
              </button>
            ))}
          </div>

          <label>Ton identifiant (pour te connecter)</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="pseudo unique" />
          <label>Ton mot de passe</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary btn-block" disabled={busy}>
            <Sparkles size={18} /> {busy ? 'On t\'inscrit…' : "C'est parti"}
          </button>
        </form>
        <p className="auth-switch">
          Déjà dans la team ? <Link to="/login">Connecte-toi</Link>
        </p>
      </div>
    </div>
  );
}
