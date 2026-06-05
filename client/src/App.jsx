import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AppBar, Toolbar, Button, Box } from '@mui/material';
import { Crown, Settings, LogOut, Heart } from 'lucide-react';
import { useAuth } from './auth.jsx';
import OnlineRail from './components/OnlineRail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Lobby from './pages/Lobby.jsx';
import Room from './pages/Room.jsx';
import Admin from './pages/Admin.jsx';
import Account from './pages/Account.jsx';

function NavBar() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <AppBar position="sticky" elevation={0} sx={{ background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(10px)', color: 'text.primary' }}>
      <Toolbar sx={{ gap: 1, maxWidth: 1240, mx: 'auto', width: '100%' }}>
        <Link to="/" className="brand" style={{ flexGrow: 1 }}><Heart size={20} fill="#cf7b97" stroke="#cf7b97" /> Soirée Jeux</Link>
        {user.role === 'admin' && (
          <Button component={Link} to="/admin" color="inherit" startIcon={<Crown size={18} />}>Admin</Button>
        )}
        <Button component={Link} to="/compte" color="inherit" startIcon={<Settings size={18} />}>{user.displayName}</Button>
        <Button onClick={logout} variant="outlined" color="primary" size="small" startIcon={<LogOut size={16} />}>Déco</Button>
      </Toolbar>
    </AppBar>
  );
}

function Protected({ children, adminOnly }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="center-screen">Chargement…</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
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
            <Route path="/admin" element={<Protected adminOnly><Admin /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </Box>
    </div>
  );
}
