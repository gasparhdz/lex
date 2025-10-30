// src/auth/RequireAuth.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Box, CircularProgress } from "@mui/material";

function isTokenExpired(token) {
  try {
    const parts = String(token).split(".");
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    if (!payload?.exp) return true;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true; // si no se puede parsear, lo tratamos como vencido/ inválido
  }
}

export default function RequireAuth({ children }) {
  const { ready } = useAuth(); // no confiamos en hasToken: chequeamos el exp del JWT
  const location = useLocation();

  if (!ready) {
    return (
      <Box sx={{ minHeight: "40vh", display: "grid", placeItems: "center" }}>
        <CircularProgress size={22} />
      </Box>
    );
  }

  const token = localStorage.getItem("token");
  const valid = token && !isTokenExpired(token);

  if (valid) {
    return children ? children : <Outlet />;
  }

  // limpiar por si quedó algo viejo
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  const next = encodeURIComponent(location.pathname + location.search);
  return <Navigate to={`/login?next=${next}`} replace />;
}
