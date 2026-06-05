import { useEffect, useState } from 'react';
import { Paper, Button, Typography, Stack, Alert, Chip } from '@mui/material';
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
      <Typography variant="h4" className="section-title" sx={{ mb: 2 }}><Crown size={26} color="#c2a36b" /> Panel Admin</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper elevation={1} sx={{ p: 2.5, mb: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>En attente de validation ({pending.length})</Typography>
        {pending.length === 0 ? (
          <Typography color="text.secondary">Rien à valider, t'es à jour</Typography>
        ) : (
          <Stack spacing={1.2}>
            {pending.map((u) => (
              <Paper key={u.id} variant="outlined" className="admin-row" sx={{ p: 1.3 }}>
                <Stack direction="row" spacing={1.2} alignItems="center">
                  <Avatar name={u.displayName} gender={u.gender} />
                  <span><strong>{u.displayName}</strong> <span className="muted">@{u.username}</span></span>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Button size="small" variant="contained" startIcon={<Check size={15} />} onClick={() => act(() => apiPost(`/admin/users/${u.id}/approve`))}>Valider</Button>
                  <Button size="small" variant="contained" color="error" startIcon={<X size={15} />} onClick={() => act(() => apiPost(`/admin/users/${u.id}/reject`))}>Refuser</Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Paper>

      <Paper elevation={1} sx={{ p: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>Tous les comptes ({others.length})</Typography>
        <Stack spacing={1.2}>
          {others.map((u) => (
            <Paper key={u.id} variant="outlined" className="admin-row" sx={{ p: 1.3 }}>
              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                <Avatar name={u.displayName} gender={u.gender} />
                <span><strong>{u.displayName}</strong> <span className="muted">@{u.username}</span></span>
                <Chip size="small" label={u.role === 'admin' ? 'admin' : 'membre'} />
                <Chip size="small" variant="outlined" label={STATUS_LABEL[u.status]} />
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {u.role === 'admin' ? (
                  <Button size="small" variant="outlined" startIcon={<ShieldMinus size={14} />} onClick={() => act(() => apiPost(`/admin/users/${u.id}/role`, { role: 'member' }))}>Retirer admin</Button>
                ) : (
                  <Button size="small" variant="outlined" startIcon={<ShieldPlus size={14} />} onClick={() => act(() => apiPost(`/admin/users/${u.id}/role`, { role: 'admin' }))}>Passer admin</Button>
                )}
                {u.status === 'rejected' && (
                  <Button size="small" variant="contained" color="secondary" startIcon={<RotateCcw size={14} />} onClick={() => act(() => apiPost(`/admin/users/${u.id}/approve`))}>Réactiver</Button>
                )}
                <Button size="small" variant="contained" color="error" onClick={() => act(() => apiDelete(`/admin/users/${u.id}`))}><Trash2 size={14} /></Button>
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Paper>
    </div>
  );
}
