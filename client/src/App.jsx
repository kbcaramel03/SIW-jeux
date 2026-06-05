import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
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
    <header className="navbar">
      <Link to="/" className="brand"><Heart size={20} fill="#ff5fa2" stroke="#ff5fa2" /> Soirée Jeux</Link>
      <nav>
        {user.role === 'admin' && (
          <Link to="/admin" className="nav-link"><Crown size={18} /> Admin</Link>
        )}
        <Link to="/compte" className="nav-link"><Settings size={18} /> {user.displayName}</Link>
        <button className="btn btn-ghost btn-mini" onClick={logout}><LogOut size={16} /> Déco</button>
      </nav>
    </header>
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
      <div className="shell">
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
      </div>
    </div>
  );
}
