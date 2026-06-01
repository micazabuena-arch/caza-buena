import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';
import { getAdminToken, setAdminToken, clearAdminToken } from '../utils/adminAuth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data))
      .catch(() => {
        clearAdminToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password, rememberMe = false) => {
    const { data } = await api.post('/auth/login', {
      email,
      password,
      remember_me: rememberMe,
    });
    setAdminToken(data.token, rememberMe);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    clearAdminToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
