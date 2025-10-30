import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Container, TextField, Typography, Paper } from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import api, { setAuthToken } from "../api/axios";

async function handleLogin() {
  try {
    const { data } = await api.post("/auth/login", {
      email,
      password,
    });

    // el backend devuelve { token: "..." }
    localStorage.setItem("token", data.token);
    setAuthToken(data.token);   // <-- clave

    // redirigir al dashboard
    navigate("/clientes");
  } catch (err) {
    console.error(err);
  }
}


export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@lex.local");
  const [password, setPassword] = useState("Admin1234!");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr("");
    try {
      await login(email, password);
      nav("/");
    } catch (e) {
      setErr(e?.response?.data?.message || "Error de login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 10 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Ingresar</Typography>
        <Box component="form" onSubmit={onSubmit}>
          <TextField fullWidth label="Email" margin="normal" value={email} onChange={e=>setEmail(e.target.value)} />
          <TextField fullWidth label="Contraseña" type="password" margin="normal" value={password} onChange={e=>setPassword(e.target.value)} />
          {err && <Typography color="error" variant="body2">{err}</Typography>}
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 2 }} disabled={loading}>
            {loading ? "Ingresando..." : "Entrar"}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
