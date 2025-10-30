// src/components/detalle-caso/CasoHistorial.jsx
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import api from "../../api/axios";
import { usePermiso } from "../../auth/usePermissions";
import dayjs from "dayjs";
import HistoryIcon from "@mui/icons-material/History";

export default function CasoHistorial({ casoId }) {
  const canViewCasos = usePermiso('CASOS', 'ver');

  // Queries
  const { data: historial = [], isLoading } = useQuery({
    queryKey: ["caso-historial", casoId],
    queryFn: () => api.get(`/casos/${casoId}/historial`).then((r) => r.data),
    enabled: !!casoId && canViewCasos,
  });

  const formatearFecha = (fecha) => {
    return dayjs(fecha).format("DD/MM/YYYY HH:mm");
  };

  const formatearCampo = (campo) => {
    const campos = {
      nroExpte: "Nro. Expediente",
      nroExpteNorm: "Nro. Expediente Normalizado",
      caratula: "Carátula",
      tipoId: "Tipo",
      estadoId: "Estado",
      radicacionId: "Radicación",
      estadoRadicacionId: "Estado Radicación",
      descripcion: "Descripción",
    };
    return campos[campo] || campo;
  };

  if (!canViewCasos) {
    return null;
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (historial.length === 0) {
    return (
      <Alert severity="info">
        Aún no hay cambios registrados para este caso.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      {historial.map((item) => (
        <Card key={item.id} variant="outlined">
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <HistoryIcon sx={{ color: "primary.main", mt: 0.5 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {formatearCampo(item.campo)}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {item.valorAnterior && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Anterior:
                      </Typography>
                      <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                        {item.valorAnterior}
                      </Typography>
                    </Box>
                  )}
                  {item.valorNuevo && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Nuevo:
                      </Typography>
                      <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                        {item.valorNuevo}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Chip label={formatearFecha(item.createdAt)} size="small" variant="outlined" sx={{ mt: 1 }} />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

