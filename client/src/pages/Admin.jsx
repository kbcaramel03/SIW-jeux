import { useEffect, useState } from 'react';
import { Crown, Check, X, RotateCcw, Trash2, ShieldPlus, ShieldMinus } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../api.js';
import { Avatar } from '../components/OnlineRail.jsx';

const STATUS_LABEL = { pending: 'En attente', approved: 'Validé', rejected: 'Refusé' };

export default function Admin() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const { users } = await apiGet('/admin/users');
      setUsers(users);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  async function act(fn) {
    try { await fn(); await load(); } catch (e) { setError(e.message); }
  }

  const pending = users.filter((u) => u.status === 'pending');
  const others = users.filter((u) => u.status !== 'pending');

  return (
    <div className="admin fade-up">
      <h1><Crown size={26} color="#f59e0b" /> Panel Admin</h1>
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>En attente de validation ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="muted">Rien à valider, t'es à jour girl</p>
        ) : (
          <ul className="admin-list">
            {pending.map((u) => (
              <li key={u.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Avatar name={u.displayName} gender={u.gender} />
                  <span><strong>{u.displayName}</strong> <span className="muted">@{u.username}</span></span>
                </div>
                <div className="admin-actions">
                  <button className="btn btn-primary btn-mini" onClick={() => act(() => apiPost(`/admin/users/${u.id}/approve`))}><Check size={15} /> Valider</button>
                  <button className="btn btn-danger btn-mini" onClick={() => act(() => apiPost(`/admin/users/${u.id}/reject`))}><X size={15} /> Refuser</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Tous les comptes ({others.length})</h2>
        <ul className="admin-list">
          {others.map((u) => (
            <li key={u.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Avatar name={u.displayName} gender={u.gender} />
                <span>
                  <strong>{u.displayName}</strong> <span className="muted">@{u.username}</span>{' '}
                  <span className="tag">{u.role === 'admin' ? 'admin' : 'membre'}</span>{' '}
                  <span className="tag">{STATUS_LABEL[u.status]}</span>
                </span>
              </div>
              <div className="admin-actions">
                {u.role === 'admin' ? (
                  <button className="btn btn-ghost btn-mini" onClick={() => act(() => apiPost(`/admin/users/${u.id}/role`, { role: 'member' }))}><ShieldMinus size={14} /> Retirer admin</button>
                ) : (
                  <button className="btn btn-ghost btn-mini" onClick={() => act(() => apiPost(`/admin/users/${u.id}/role`, { role: 'admin' }))}><ShieldPlus size={14} /> Passer admin</button>
                )}
                {u.status === 'rejected' && (
                  <button className="btn btn-secondary btn-mini" onClick={() => act(() => apiPost(`/admin/users/${u.id}/approve`))}><RotateCcw size={14} /> Réactiver</button>
                )}
                <button className="btn btn-danger btn-mini" onClick={() => act(() => apiDelete(`/admin/users/${u.id}`))}><Trash2 size={14} /></button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
