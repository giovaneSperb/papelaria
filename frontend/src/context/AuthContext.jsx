import { createContext, useContext, useEffect, useState } from "react";
import { api, tokenStore } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    api("/auth/me")
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = (data) => {
    tokenStore.set(data.access_token);
    setUser(data.user);
  };

  const login = async (email, password) =>
    handleAuth(await api("/auth/login", { method: "POST", body: { email, password } }));

  const register = async (name, email, password) =>
    handleAuth(await api("/auth/register", { method: "POST", body: { name, email, password } }));

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
