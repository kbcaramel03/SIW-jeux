import { useEffect, useState } from 'react';
import { apiGet, apiPost, apiDelete } from '../api.js';

const STATUS_LABEL = { pending: '⏳ En attente', approved: '✅ Validée', rejected: '🚫 Refusée' };

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

  useEffect(() => {
    load();
  }, []);

  async function act(fn) {
    try {
      await fn();
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const pending = users.filter((u) => u.status === 'pending');
  const others = users.filter((u) => u.status !== 'pending');

  return (
    <div className="admin">
      <h1>👑 Panel Admin</h1>
      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>Inscriptions en attente ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="muted">Rien à valider pour l'instant 🎉</p>
        ) : (
          <ul className="admin-list">
            {pending.map((u) => (
              <li key={u.id}>
                <div>
                  <strong>{u.displayName}</strong> <span className="muted">@{u.username}</span>
                </div>
                <div className="admin-actions">
                  <button className="btn btn-primary btn-mini" onClick={() => act(() => apiPost(`/admin/users/${u.id}/approve`))}>Valider</button>
                  <button className="btn btn-danger btn-mini" onClick={() => act(() => apiPost(`/admin/users/${u.id}/reject`))}>Refuser</button>
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
              <div>
                <strong>{u.displayName}</strong> <span className="muted">@{u.username}</span>
                {' '}<span className="tag">{u.role === 'admin' ? '👑 admin' : 'membre'}</span>
                {' '}<span className="tag">{STATUS_LABEL[u.status]}</span>
              </div>
              <div className="admin-actions">
                {u.role === 'admin' ? (
                  <button className="btn btn-ghost btn-mini" onClick={() => act(() => apiPost(`/admin/users/${u.id}/role`, { role: 'member' }))}>Retirer admin</button>
                ) : (
                  <button className="btn btn-ghost btn-mini" onClick={() => act(() => apiPost(`/admin/users/${u.id}/role`, { role: 'admin' }))}>Passer admin</button>
                )}
                {u.status === 'rejected' && (
                  <button className="btn btn-secondary btn-mini" onClick={() => act(() => apiPost(`/admin/users/${u.id}/approve`))}>Réactiver</button>
                )}
                <button className="btn btn-danger btn-mini" onClick={() => act(() => apiDelete(`/admin/users/${u.id}`))}>Supprimer</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
