import { useState } from 'react';
import { apiPost } from '../api.js';
import { useAuth } from '../auth.jsx';

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
      setMsg('Mot de passe modifié ✅');
      setCurrent('');
      setNew('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="account">
      <div className="card auth-card">
        <h1>⚙️ Mon compte</h1>
        <p className="muted">Connectée en tant que <strong>{user.displayName}</strong> ({user.role === 'admin' ? 'admin' : 'membre'})</p>
        <h3>Changer mon mot de passe</h3>
        <form onSubmit={submit}>
          <label>Mot de passe actuel</label>
          <input type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} />
          <label>Nouveau mot de passe</label>
          <input type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} />
          {error && <p className="error">{error}</p>}
          {msg && <p className="success">{msg}</p>}
          <button className="btn btn-primary btn-block">Mettre à jour</button>
        </form>
      </div>
    </div>
  );
}
