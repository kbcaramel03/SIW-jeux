import { useEffect, useMemo, useState } from 'react';
import { Paper, Button, Typography, Stack, Alert, Chip, TextField } from '@mui/material';
import { Crown, Check, X, RotateCcw, Trash2, ShieldPlus, ShieldMinus, KeyRound, Pencil, Star } from 'lucide-react';
import { apiGet, apiPost, apiDelete } from '../api.js';
import { useAuth } from '../auth.jsx';
import { Avatar } from '../components/OnlineRail.jsx';

const STATUS_LABEL = { pending: 'En attente', approved: 'Validé', rejected: 'Refusé' };
const ROLE_LABEL = { admin: 'admin', moderator: 'droit ++', member: 'membre' };

function Stat({ label, value }) {
  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.2, textAlign: 'center', minWidth: 92, flex: '1 1 auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1 }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Paper>
  );
}

export default function Admin() {
  const { user: me } = useAuth();
  const isAdmin = me?.role === 'admin';
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  async function load() {
    try {
      const { users, stats } = await apiGet('/admin/users');
      setUsers(users); setStats(stats); setError('');
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function act(fn) {
    try { await fn(); await load(); } catch (e) { setError(e.message); }
  }
  async function resetPassword(u) {
    const pw = window.prompt(`Nouveau mot de passe temporaire pour ${u.displayName} (min. 4 caractères) :`);
    if (pw == null) return;
    await act(() => apiPost(`/admin/users/${u.id}/password`, { password: pw }));
  }
  async function rename(u) {
    const name = window.prompt('Nouveau nom affiché :', u.displayName);
    if (name == null) return;
    await act(() => apiPost(`/admin/users/${u.id}/profile`, { displayName: name }));
  }

  const pending = users.filter((u) => u.status === 'pending');
  const others = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = users.filter((u) => u.status !== 'pending');
    if (!q) return base;
    return base.filter((u) => u.displayName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  }, [users, query]);

  return (
    <div className="admin fade-up">
      <Typography variant="h4" className="section-title" sx={{ mb: 1 }}><Crown size={26} color="#c2a36b" /> Panel Admin</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {isAdmin ? 'Gestion complète des comptes.' : 'Droit ++ : tu peux valider ou refuser les inscriptions.'}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {isAdmin && stats && (
        <Stack direction="row" spacing={1.2} sx={{ mb: 2.5, flexWrap: 'wrap', gap: 1.2 }}>
          <Stat label="Comptes" value={stats.total} />
          <Stat label="En attente" value={stats.pending} />
          <Stat label="Validés" value={stats.approved} />
          <Stat label="Admins / droit++" value={stats.admins} />
          <Stat label="Refusés" value={stats.rejected} />
        </Stack>
      )}

      <Paper elevation={1} sx={{ p: 2.5, mb: 2.5 }}>
        <Typography variant="h6" sx={{ mb: 1.5 }}>En attente de validation ({pending.length})</Typography>
        {pending.length === 0 ? (
          <Typography color="text.secondary">Rien à valider, t'es à jour</Typography>
        ) : (
          <Stack spacing={1.2}>
            {pending.map((u) => (
              <Paper key={u.id} variant="outlined" className="admin-row" sx={{ p: 1.3 }}>
                <Stack direction="row" spacing={1.2} alignItems="center">
                  <Avatar name={u.displayName} gender={u.gender} avatar={u.avatar} />
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

      {isAdmin && (
        <Paper elevation={1} sx={{ p: 2.5 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="h6">Tous les comptes ({others.length})</Typography>
            <TextField size="small" placeholder="Rechercher…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </Stack>
          <Stack spacing={1.2}>
            {others.map((u) => (
              <Paper key={u.id} variant="outlined" className="admin-row" sx={{ p: 1.3 }}>
                <Stack direction="row" spacing={1.2} alignItems="center" sx={{ flexWrap: 'wrap' }}>
                  <Avatar name={u.displayName} gender={u.gender} avatar={u.avatar} />
                  <span><strong>{u.displayName}</strong> <span className="muted">@{u.username}</span></span>
                  {u.founder && <Chip size="small" color="warning" icon={<Star size={13} />} label="Fondatrice" />}
                  <Chip size="small" label={ROLE_LABEL[u.role] || 'membre'} />
                  <Chip size="small" variant="outlined" label={STATUS_LABEL[u.status]} />
                </Stack>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  <Button size="small" variant="outlined" startIcon={<Pencil size={14} />} onClick={() => rename(u)}>Renommer</Button>
                  <Button size="small" variant="outlined" startIcon={<KeyRound size={14} />} onClick={() => resetPassword(u)}>Mot de passe</Button>
                  {!u.founder && u.role !== 'admin' && (
                    u.role === 'moderator' ? (
                      <Button size="small" variant="outlined" startIcon={<ShieldMinus size={14} />} onClick={() => act(() => apiPost(`/admin/users/${u.id}/role`, { role: 'member' }))}>Retirer droit ++</Button>
                    ) : (
                      <Button size="small" variant="outlined" startIcon={<ShieldPlus size={14} />} onClick={() => act(() => apiPost(`/admin/users/${u.id}/role`, { role: 'moderator' }))}>Donner droit ++</Button>
                    )
                  )}
                  {u.status === 'rejected' && (
                    <Button size="small" variant="contained" color="secondary" startIcon={<RotateCcw size={14} />} onClick={() => act(() => apiPost(`/admin/users/${u.id}/approve`))}>Réactiver</Button>
                  )}
                  <Button size="small" variant="contained" color="error" disabled={u.founder} onClick={() => act(() => apiDelete(`/admin/users/${u.id}`))}><Trash2 size={14} /></Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}
    </div>
  );
}
