import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Box, Button, Container, TextField, Typography, Paper } from "@mui/material";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const isDev = import.meta?.env?.DEV;

  const [email, setEmail] = useState(isDev ? "admin@lex.local" : "");
  const [password, setPassword] = useState(isDev ? "Admin1234!" : "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr("");

    try {
      await login(email, password);

      const next = params.get("next") || "/";
      nav(next, { replace: true });
    } catch (e) {
      setErr(e?.response?.data?.publicMessage || e?.response?.data?.message || "Error de login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="xs" sx={{ mt: 10 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Ingresar</Typography>

        <Box component="form" onSubmit={onSubmit}>
          <TextField
            fullWidth
            label="Email"
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />

          <TextField
            fullWidth
            label="Contraseña"
            type="password"
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {err && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {err}
            </Typography>
          )}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 2 }}
            disabled={loading}
          >
            {loading ? "Ingresando..." : "Entrar"}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
