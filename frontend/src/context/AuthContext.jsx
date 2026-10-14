import { createContext, useContext, useEffect, useState } from 'react';
import { clearToken, getToken, setToken } from '../api/client';
import { loginRequest, meRequest, registerRequest } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({children}) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      setLoading(false);

      return;
    }

    meRequest()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const data = await loginRequest(email, password);

    setToken(data.accessToken);
    setUser(data.user);
  }

  async function register(email, username, password) {
    const data = await registerRequest(email, username, password);

    setToken(data.accessToken);
    setUser(data.user);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{user, loading, login, register, logout}}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
