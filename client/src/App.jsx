import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
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
      <Link to="/" className="brand">🎮 Soirée Jeux</Link>
      <nav>
        {user.role === 'admin' && <Link to="/admin" className="nav-link">👑 Admin</Link>}
        <Link to="/compte" className="nav-link">⚙️ {user.displayName}</Link>
        <button className="btn btn-ghost" onClick={logout}>Déconnexion</button>
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
  return (
    <div className="app">
      <NavBar />
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
  );
}
