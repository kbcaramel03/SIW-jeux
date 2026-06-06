import { useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Button, Box, IconButton, Badge, Drawer, Typography } from '@mui/material';
import { Crown, Settings, LogOut, Heart, Users, X, Lock } from 'lucide-react';
import { useAuth } from './auth.jsx';
import OnlineRail, { usePresence, PresenceList } from './components/OnlineRail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Lobby from './pages/Lobby.jsx';
import Room from './pages/Room.jsx';
import Admin from './pages/Admin.jsx';
import Account from './pages/Account.jsx';

function NavBar() {
  const { user, logout } = useAuth();
  const people = usePresence();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const label = (txt) => <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{txt}</Box>;
  return (
    <>
      <AppBar position="sticky" elevation={0} sx={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', color: 'text.primary' }}>
        <Toolbar sx={{ gap: 0.5, maxWidth: 1240, mx: 'auto', width: '100%', minHeight: { xs: 54, sm: 64 } }}>
          <Link to="/" className="brand" style={{ flexGrow: 1, minWidth: 0 }}><Heart size={18} fill="#cf7b97" stroke="#cf7b97" /> Soirée Jeux</Link>

          <IconButton color="inherit" onClick={() => setOpen(true)} aria-label="En ligne">
            <Badge badgeContent={people.length} color="primary"><Users size={20} /></Badge>
          </IconButton>

          {(user.role === 'admin' || user.role === 'moderator') && (
            <Button component={Link} to="/admin" color="inherit" size="small" startIcon={<Crown size={18} />}>
              {label(user.role === 'admin' ? 'Admin' : 'Validation')}
            </Button>
          )}
          <Button component={Link} to="/compte" color="inherit" size="small" startIcon={<Settings size={18} />}>{label(user.displayName)}</Button>
          <Button onClick={logout} variant="outlined" color="primary" size="small" startIcon={<LogOut size={16} />}>{label('Déco')}</Button>
        </Toolbar>
      </AppBar>

      {/* Bulle « En ligne » / discussions (tiroir) */}
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: 290, maxWidth: '85vw', p: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><span className="online-dot" /> En ligne ({people.length})</Typography>
          <IconButton size="small" onClick={() => setOpen(false)}><X size={18} /></IconButton>
        </Box>
        <PresenceList people={people} meId={user.id} />
        <Box sx={{ mt: 3, p: 1.5, borderRadius: 2, bgcolor: 'rgba(0,0,0,0.04)', color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 1, fontSize: 14 }}>
          <Lock size={16} /> Messages privés & groupes : bientôt
        </Box>
      </Drawer>
    </>
  );
}

function Protected({ children, staffOnly }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center-screen">Chargement…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (staffOnly && !['admin', 'moderator'].includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <div className="app">
      <NavBar />
      <Box className="shell">
        {user && <OnlineRail />}
        <main className="main">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Protected><Lobby /></Protected>} />
            <Route path="/room/:id" element={<Protected><Room /></Protected>} />
            <Route path="/compte" element={<Protected><Account /></Protected>} />
            <Route path="/admin" element={<Protected staffOnly><Admin /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </Box>
    </div>
  );
}
