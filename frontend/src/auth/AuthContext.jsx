import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api, { loginPersist, logoutClear } from "../api/axios";

const AuthContext = createContext(null);

function isTokenExpired(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload?.exp) return true;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // 👇 flag derivado: verificamos token válido (no solo presente)
  const hasToken = useMemo(() => {
    const token = localStorage.getItem("token");
    return !!token && !isTokenExpired(token);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");

    // 🔸 Si el token está vencido o malformado, limpiamos y terminamos
    if (token && isTokenExpired(token)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setReady(true);
      return;
    }

    const savedUser = localStorage.getItem("user");

    // 🔹 1) Mostrar user guardado (rápido)
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem("user");
      }
    }

    // 🔹 2) Si hay token válido → setReady(true) y refrescamos /auth/me en background
    if (token) {
      setReady(true);
      (async () => {
        try {
          const { data } = await api.get("/auth/me");
          setUser(data);
          localStorage.setItem("user", JSON.stringify(data));
        } catch (e) {
          const status = e?.response?.status;
          if (status === 401 || status === 403) {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            setUser(null);
          }
        }
      })();
      return;
    }

    // 🔹 3) Si no hay token → listo, sin login
    setReady(true);
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    const token = data.token || data.accessToken || data?.data?.token;
    if (!token) throw new Error("El backend no devolvió token");

    loginPersist(token);
    // Siempre usar /auth/me para obtener permisos actualizados desde la BD
    const me = (await api.get("/auth/me")).data;
    setUser(me);
    localStorage.setItem("user", JSON.stringify(me));
    if (!ready) setReady(true);
    return me;
  };

  const logout = () => {
    logoutClear();
    localStorage.removeItem("user");
    setUser(null);
    if (!ready) setReady(true);
  };

  return (
    <AuthContext.Provider value={{ user, ready, hasToken, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
