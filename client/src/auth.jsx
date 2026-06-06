// Contexte d'authentification : garde le joueur connecté et expose login/logout.
import { createContext, useContext, useEffect, useState } from 'react';
import { apiGet, apiPost, setToken } from './api.js';
import { reconnectSocket, closeSocket } from './socket.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Au chargement, on essaie de récupérer la session existante.
  useEffect(() => {
    apiGet('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(username, password) {
    const { token, user } = await apiPost('/auth/login', { username, password });
    setToken(token);
    reconnectSocket(); // la socket doit se reconnecter avec le nouveau jeton
    setUser(user);
    return user;
  }

  async function register(username, displayName, password, gender) {
    return apiPost('/auth/register', { username, displayName, password, gender });
  }

  function logout() {
    setToken(null);
    closeSocket();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
