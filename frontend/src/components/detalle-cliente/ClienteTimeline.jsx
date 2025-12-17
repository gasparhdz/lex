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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
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

  const formatearTituloHistorial = (h) => {
    return formatearCampo(h.campo);
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
        titulo: formatearTituloHistorial(h),
        subtitulo: h.valorAnterior ? `${h.valorAnterior} → ${h.valorNuevo}` : h.valorNuevo,
        icon: <History fontSize="small" />,
        color: "info",
      });
    });

    // Agregar eventos
    eventos.forEach((e) => {
      items.push({
        id: `event-${e.id}`,
        tipo: "evento",
        fecha: dayjs(e.fecha).toDate(),
        titulo: `Evento: ${e.titulo || "sin título"}`,
        subtitulo: e.descripcion,
        icon: <EventOutlined fontSize="small" />,
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
        titulo: t.completada ? `Tarea completada: ${t.titulo || "sin título"}` : `Tarea creada: ${t.titulo || "sin título"}`,
        subtitulo: t.descripcion,
        icon: <AssignmentOutlined fontSize="small" />,
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
        titulo: `Caso creado: ${c.nroExpte || 'sin expediente'}`,
        subtitulo: c.caratula,
        icon: <Gavel fontSize="small" />,
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
        titulo: "Nota agregada",
        subtitulo: n.contenido,
        icon: <Notes fontSize="small" />,
        color: "default",
      });
    });

    // Ordenar por fecha descendente (más recientes primero)
    return items.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  }, [historial, eventos, tareas, casos, notas]);

  // Mostrar todos los items
  const displayItems = timelineItems;

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
      <TableContainer sx={{ maxHeight: 200, overflowY: 'auto', overflowX: 'hidden' }}>
        <Table size="small">
          <TableBody>
            {displayItems.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell sx={{ width: 32, py: 0.5, px: 1 }}>
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
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
                </TableCell>
                <TableCell sx={{ py: 0.5, px: 1 }}>
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                      {item.titulo}
                    </Typography>
                    {item.subtitulo && (
                      <Typography variant="caption" color="text.secondary" sx={{ 
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '0.7rem'
                      }}>
                        {item.subtitulo}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right" sx={{ py: 0.5, px: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatearFechaRelativa(item.fecha)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

