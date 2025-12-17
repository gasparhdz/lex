// src/components/detalle-cliente/ClienteHistorial.jsx
import { useQuery } from "@tanstack/react-query";
import { Box, Typography, Card, CardContent, Chip, Stack, Alert, CircularProgress } from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import api from "../../api/axios";
import dayjs from "dayjs";

export default function ClienteHistorial({ clienteId }) {
  const { data: historial = [], isLoading, isError, error } = useQuery({
    queryKey: ["cliente-historial", clienteId],
    queryFn: () => api.get(`/clientes/${clienteId}/historial`).then((r) => r.data),
    enabled: !!clienteId,
  });

  const formatearFecha = (fecha) => {
    return dayjs(fecha).format("DD/MM/YYYY HH:mm");
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error">
        {error?.message || "Error al cargar el historial de cambios"}
      </Alert>
    );
  }

  if (historial.length === 0) {
    return (
      <Alert severity="info">
        Aún no hay cambios registrados para este cliente.
      </Alert>
    );
  }

  return (
    <Box sx={{ maxHeight: 400, overflowY: 'auto', overflowX: 'hidden' }}>
    <Stack spacing={2}>
      {historial.map((cambio) => (
        <Card key={cambio.id} variant="outlined">
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: "primary.main",
                  color: "white",
                  borderRadius: 1,
                  p: 0.75,
                }}
              >
                <HistoryIcon fontSize="small" />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {cambio.campo}
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
                  {cambio.valorAnterior ? (
                    <>
                      <Chip
                        label={cambio.valorAnterior}
                        size="small"
                        color="default"
                        variant="outlined"
                        sx={{ textDecoration: "line-through" }}
                      />
                      <CompareArrowsIcon fontSize="small" color="action" />
                    </>
                  ) : (
                    <Chip label="Valor creado" size="small" color="success" variant="outlined" />
                  )}
                  {cambio.valorNuevo && (
                    <Chip
                      label={cambio.valorNuevo}
                      size="small"
                      color="primary"
                      variant="filled"
                    />
                  )}
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Chip label={formatearFecha(cambio.createdAt)} size="small" variant="outlined" />
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>
      ))}
    </Stack>
    </Box>
  );
}

