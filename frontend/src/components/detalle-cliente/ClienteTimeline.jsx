// src/components/detalle-cliente/ClienteTimeline.jsx
import { useMemo } from "react";
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
import {
  AssignmentOutlined,
  EventOutlined,
  History,
  Notes,
  Gavel,
} from "@mui/icons-material";

export default function ClienteTimeline({ clienteId, cliente, casos, tareas, eventos }) {
  const canViewClientes = usePermiso('CLIENTES', 'ver');

  // Query para historial
  const { data: historial = [], isLoading: loadingHistorial } = useQuery({
    queryKey: ["cliente-historial", clienteId],
    queryFn: () => api.get(`/clientes/${clienteId}/historial`).then((r) => r.data),
    enabled: !!clienteId && canViewClientes,
  });

  // Query para notas
  const { data: notas = [], isLoading: loadingNotas } = useQuery({
    queryKey: ["cliente-notas", clienteId],
    queryFn: () => api.get(`/clientes/${clienteId}/notas`).then((r) => r.data),
    enabled: !!clienteId && canViewClientes,
  });

  const formatearFecha = (fecha) => {
    return dayjs(fecha).format("DD/MM/YYYY HH:mm");
  };

  const formatearFechaRelativa = (fecha) => {
    const now = dayjs();
    const diff = now.diff(dayjs(fecha), 'day');
    
    if (diff === 0) return "Hoy";
    if (diff === 1) return "Ayer";
    if (diff < 7) return `Hace ${diff} días`;
    if (diff < 30) return `Hace ${Math.floor(diff / 7)} semanas`;
    return dayjs(fecha).format("DD/MM/YYYY");
  };

  const formatearCampo = (campo) => {
    const campos = {
      nombre: "Nombre",
      apellido: "Apellido",
      razonSocial: "Razón Social",
      dni: "DNI",
      cuit: "CUIT",
      email: "Email",
      telCelular: "Teléfono",
      dirCalle: "Calle",
      dirNro: "Número",
      localidadId: "Localidad",
      observaciones: "Observaciones",
      activo: "Estado",
    };
    return campos[campo] || campo;
  };

  // Combinar y ordenar todos los items cronológicamente
  const timelineItems = useMemo(() => {
    const items = [];

    // Agregar historial de cambios
    historial.forEach((h) => {
      items.push({
        id: `hist-${h.id}`,
        tipo: "cambio",
        fecha: dayjs(h.createdAt).toDate(),
        titulo: `Cambio en ${formatearCampo(h.campo)}`,
        subtitulo: h.valorAnterior ? `${h.valorAnterior} → ${h.valorNuevo}` : h.valorNuevo,
        icon: <History />,
        color: "info",
      });
    });

    // Agregar eventos
    eventos.forEach((e) => {
      items.push({
        id: `event-${e.id}`,
        tipo: "evento",
        fecha: dayjs(e.fecha).toDate(),
        titulo: e.titulo || "Evento sin título",
        subtitulo: e.descripcion,
        icon: <EventOutlined />,
        color: "primary",
        original: e,
      });
    });

    // Agregar tareas
    tareas.forEach((t) => {
      items.push({
        id: `tarea-${t.id}`,
        tipo: "tarea",
        fecha: dayjs(t.fechaCreacion).toDate(),
        titulo: t.titulo || "Tarea sin título",
        subtitulo: t.descripcion,
        icon: <AssignmentOutlined />,
        color: t.completada ? "success" : "warning",
        original: t,
      });
    });

    // Agregar casos
    casos.forEach((c) => {
      items.push({
        id: `caso-${c.id}`,
        tipo: "caso",
        fecha: dayjs(c.createdAt || new Date()).toDate(),
        titulo: `Caso: ${c.nroExpte}`,
        subtitulo: c.caratula,
        icon: <Gavel />,
        color: "primary",
        original: c,
      });
    });

    // Agregar notas
    notas.forEach((n) => {
      items.push({
        id: `nota-${n.id}`,
        tipo: "nota",
        fecha: dayjs(n.createdAt).toDate(),
        titulo: "Nota",
        subtitulo: n.contenido,
        icon: <Notes />,
        color: "default",
      });
    });

    // Ordenar por fecha descendente (más recientes primero)
    return items.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }, [historial, eventos, tareas, casos, notas]);

  if (!canViewClientes) {
    return null;
  }

  if (loadingHistorial || loadingNotas) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (timelineItems.length === 0) {
    return (
      <Alert severity="info">
        Aún no hay actividad registrada para este cliente.
      </Alert>
    );
  }

  return (
    <Box>
      {timelineItems.map((item) => (
        <Card key={item.id} variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Stack direction="row" spacing={2} alignItems="flex-start">
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: (t) => {
                    if (item.color === "success") return t.palette.success.main;
                    if (item.color === "warning") return t.palette.warning.main;
                    if (item.color === "primary") return t.palette.primary.main;
                    if (item.color === "info") return t.palette.info.main;
                    return t.palette.action.disabled;
                  },
                  color: "white",
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {item.titulo}
                  </Typography>
                  <Chip label={formatearFechaRelativa(item.fecha)} size="small" variant="outlined" />
                </Box>
                {item.subtitulo && (
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {item.subtitulo}
                  </Typography>
                )}
                <Chip 
                  label={formatearFecha(item.fecha)} 
                  size="small" 
                  variant="outlined" 
                  sx={{ mt: 1 }}
                />
              </Box>
            </Stack>
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}

