import { useState } from 'react';
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
    <div className="account fade-up">
      <div className="card auth-card">
        <h1 className="section-title" style={{ justifyContent: 'center' }}><Settings size={24} /> Mon compte</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', margin: '8px 0 16px' }}>
          <Avatar name={user.displayName} gender={user.gender} size={40} />
          <span><strong>{user.displayName}</strong> · {user.role === 'admin' ? 'admin' : 'membre'}</span>
        </div>
        <h3 className="section-title"><KeyRound size={18} /> Changer mon mot de passe</h3>
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
