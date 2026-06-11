import { lazy, Suspense, useState } from 'react';
import { Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Button, Box, IconButton, Badge, Menu, MenuItem, ListItemIcon } from '@mui/material';
import { Crown, Settings, LogOut, Heart, MessageCircle, Menu as MenuIcon } from 'lucide-react';
import { useAuth } from './auth.jsx';
import OnlineRail, { Avatar } from './components/OnlineRail.jsx';
import MessagesDrawer, { useUnread } from './components/Messages.jsx';

// Pages chargées à la demande : le premier chargement de l'appli est plus léger
// (on ne télécharge pas l'admin ou les jeux pour afficher l'écran de connexion).
const Login = lazy(() => import('./pages/Login.jsx'));
const Register = lazy(() => import('./pages/Register.jsx'));
const Lobby = lazy(() => import('./pages/Lobby.jsx'));
const Room = lazy(() => import('./pages/Room.jsx'));
const Admin = lazy(() => import('./pages/Admin.jsx'));
const Account = lazy(() => import('./pages/Account.jsx'));

function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const unread = useUnread();
  const [chatOpen, setChatOpen] = useState(false);
  const [menuEl, setMenuEl] = useState(null);
  if (!user) return null;
  const staff = user.role === 'admin' || user.role === 'moderator';
  const go = (to) => { setMenuEl(null); navigate(to); };
  const doLogout = () => { setMenuEl(null); logout(); };

  return (
    <>
      <AppBar position="sticky" elevation={0} sx={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(10px)', color: 'text.primary' }}>
        <Toolbar sx={{ gap: 0.5, maxWidth: 1240, mx: 'auto', width: '100%', minHeight: { xs: 54, sm: 64 } }}>
          <Link to="/" className="brand" style={{ flexShrink: 0 }}><Heart size={18} fill="#cf7b97" stroke="#cf7b97" /> Soirée Jeux</Link>
          <Box sx={{ flexGrow: 1 }} />

          {/* Bulle Messages (toutes tailles) */}
          <IconButton color="inherit" onClick={() => setChatOpen(true)} aria-label="Messages">
            <Badge badgeContent={unread} color="error"><MessageCircle size={22} /></Badge>
          </IconButton>

          {/* Desktop : boutons avec libellés */}
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 0.5, alignItems: 'center' }}>
            {staff && <Button component={Link} to="/admin" color="inherit" size="small" startIcon={<Crown size={18} />}>{user.role === 'admin' ? 'Admin' : 'Validation'}</Button>}
            <Button component={Link} to="/compte" color="inherit" size="small" startIcon={<Avatar name={user.displayName} gender={user.gender} avatar={user.avatar} size={24} />}>{user.displayName}</Button>
            <Button onClick={logout} variant="outlined" color="primary" size="small" startIcon={<LogOut size={16} />}>Déco</Button>
          </Box>

          {/* Mobile : menu hamburger */}
          <IconButton sx={{ display: { xs: 'inline-flex', sm: 'none' } }} color="inherit" onClick={(e) => setMenuEl(e.currentTarget)} aria-label="Menu">
            <MenuIcon size={22} />
          </IconButton>
          <Menu anchorEl={menuEl} open={!!menuEl} onClose={() => setMenuEl(null)}>
            <MenuItem onClick={() => go('/compte')}><ListItemIcon><Settings size={18} /></ListItemIcon>Mon compte</MenuItem>
            {staff && <MenuItem onClick={() => go('/admin')}><ListItemIcon><Crown size={18} /></ListItemIcon>{user.role === 'admin' ? 'Admin' : 'Validation'}</MenuItem>}
            <MenuItem onClick={doLogout}><ListItemIcon><LogOut size={18} /></ListItemIcon>Déconnexion</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <MessagesDrawer open={chatOpen} onClose={() => setChatOpen(false)} meId={user.id} />
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
          <Suspense fallback={<div className="center-screen">Chargement…</div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={<Protected><Lobby /></Protected>} />
              <Route path="/room/:id" element={<Protected><Room /></Protected>} />
              <Route path="/compte" element={<Protected><Account /></Protected>} />
              <Route path="/admin" element={<Protected staffOnly><Admin /></Protected>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>
      </Box>
    </div>
  );
}
