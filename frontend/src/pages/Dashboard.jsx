// src/pages/Dashboard.jsx
import React, { useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Divider,
  Chip,
  IconButton,
  Tooltip,
  Switch,
  FormControlLabel,
  useMediaQuery,
  CircularProgress,
  Alert,
  LinearProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { motion } from "framer-motion";
import {
  GavelOutlined,
  AssignmentTurnedInOutlined,
  ReceiptLongOutlined,
  AccountBalanceWalletOutlined,
  OpenInNew,
  NotificationsActiveOutlined,
  Refresh,
  ExpandMore,
  ExpandLess,
} from "@mui/icons-material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import "dayjs/locale/es";
dayjs.locale("es");

import {
  fetchDashboardKpis,
  fetchDashboardTareas,
  fetchDashboardEventos,
} from "../api/dashboard";
import api from "../api/axios";
import { displayCliente } from "../utils/finanzas";

/* ===== Utils ===== */
const fmtARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});
const isOverdue = (dateStr) => (dateStr ? dayjs(dateStr).isBefore(dayjs()) : false);
const monthLabel = dayjs().format("MMMM");

const Dashboard = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [incluirVencidas, setIncluirVencidas] = useState(false);
  const [refreshingKey, setRefreshingKey] = useState(0);
  const [tareasExpandidas, setTareasExpandidas] = useState(new Set());
  const [eventosExpandidos, setEventosExpandidos] = useState(new Set());

  const toggleTareaExpandida = (tareaId) => {
    setTareasExpandidas(prev => {
      const next = new Set(prev);
      if (next.has(tareaId)) {
        next.delete(tareaId);
      } else {
        next.add(tareaId);
      }
      return next;
    });
  };

  const toggleEventoExpandido = (eventoId) => {
    setEventosExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(eventoId)) {
        next.delete(eventoId);
      } else {
        next.add(eventoId);
      }
      return next;
    });
  };

  const enabled = !!localStorage.getItem("token");

  /* ===== Queries ===== */
  const {
    data: kpi,
    isLoading: loadingKpi,
    isError: errorKpi,
    error: errKpi,
    refetch: refetchKpis,
  } = useQuery({
    queryKey: ["dashboard", "kpis", refreshingKey],
    queryFn: fetchDashboardKpis,
    enabled,
    staleTime: 60_000,
  });

  const {
    data: tareas,
    isLoading: loadingTareas,
    isError: errorTareas,
    error: errTareas,
    refetch: refetchTareas,
  } = useQuery({
    queryKey: ["dashboard", "tareas", incluirVencidas, refreshingKey],
    queryFn: () => fetchDashboardTareas({ includeOverdue: incluirVencidas }),
    enabled,
    staleTime: 30_000,
    keepPreviousData: true,
  });

  const {
    data: eventos,
    isLoading: loadingEventos,
    isError: errorEventos,
    error: errEventos,
    refetch: refetchEventos,
  } = useQuery({
    queryKey: ["dashboard", "eventos", refreshingKey],
    queryFn: fetchDashboardEventos,
    enabled,
    staleTime: 30_000,
  });

  const handleRefresh = () => {
    setRefreshingKey(prev => prev + 1);
    Promise.all([refetchKpis(), refetchTareas(), refetchEventos()]);
  };

  // Toggle completada ↔ incompleta
  const toggleTarea = useMutation({
    mutationFn: (id) => api.post(`/tareas/${id}/toggle`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "tareas"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "kpis"] });
    },
  });

  // Toggle subtarea
  const toggleSubtarea = useMutation({
    mutationFn: ({ tareaId, subtareaId }) => 
      api.post(`/tareas/${tareaId}/items/${subtareaId}/toggle`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dashboard", "tareas"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "kpis"] });
    },
  });

  const anyLoading = loadingKpi || loadingTareas || loadingEventos;
  const anyError = errorKpi || errorTareas || errorEventos;
  const errorMsg =
    errKpi?.message ||
    errTareas?.message ||
    errEventos?.message ||
    "Error al cargar datos del dashboard.";

  /* ===== KPIs ===== */
  const kpis = useMemo(() => {
    if (!kpi) return [];
    return [
      {
        label: "Casos activos",
        value: kpi.casosActivos ?? 0,
        color: "primary",
        icon: <GavelOutlined fontSize="large" />,
        link: "/casos?estado=activo",
      },
      {
        label: "Tareas pendientes",
        value: `${kpi.tareasPendientes ?? 0}${
          (kpi.tareasVencidas ?? 0) > 0 ? ` (${kpi.tareasVencidas} vencidas)` : ""
        }`,
        color: "warning",
        icon: <AssignmentTurnedInOutlined fontSize="large" />,
        link: "/tareas?estado=pendiente",
      },
      {
        label: `Honorarios pendientes ${monthLabel}`,
        value: fmtARS.format(kpi.honorariosPendientesMes ?? 0),
        color: "success",
        icon: <AccountBalanceWalletOutlined fontSize="large" />,
        link: "/finanzas/honorarios?estado=pendiente&periodo=mes",
      },
      {
        label: `Gastos no cobrados ${monthLabel}`,
        value: fmtARS.format(kpi.gastosNoCobradosMes ?? 0),
        color: "error",
        icon: <ReceiptLongOutlined fontSize="large" />,
        link: "/finanzas/gastos?estado=no_cobrado&periodo=mes",
      },
    ];
  }, [kpi]);

  /* ===== Ordenar tareas y eventos ===== */
  const tareasOrdenadas = useMemo(() => {
    if (!Array.isArray(tareas)) return [];
    return [...tareas].sort((a, b) => {
      const av = a.fechaVencimiento ? dayjs(a.fechaVencimiento).valueOf() : Infinity;
      const bv = b.fechaVencimiento ? dayjs(b.fechaVencimiento).valueOf() : Infinity;
      return av - bv;
    });
  }, [tareas]);

  const eventosOrdenados = useMemo(() => {
    if (!Array.isArray(eventos)) return [];
    return [...eventos]
      //.filter((e) => !dayjs(e.fecha).isBefore(dayjs(), "day"))
      .sort((a, b) => dayjs(a.fecha).valueOf() - dayjs(b.fecha).valueOf());
  }, [eventos]);

  // Estilo del Switch en dark (según captura)
  const blueTrack = "#174a7a";
  const blueThumb = "#1e88ff";
  const switchSx =
    theme.palette.mode === "dark"
      ? {
          "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
            backgroundColor: blueTrack,
            opacity: 1,
          },
          "& .MuiSwitch-switchBase.Mui-checked .MuiSwitch-thumb": {
            backgroundColor: blueThumb,
          },
          "& .MuiSwitch-track": { backgroundColor: theme.palette.action.selected },
          "& .MuiSwitch-thumb": { backgroundColor: theme.palette.primary.dark },
        }
      : {};

  /* ===== Render ===== */
  return (
    <Box p={isMobile ? 2 : 3} width="100%">
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={1.5}>
        <Typography variant="h5" fontWeight={600}>
          Dashboard
        </Typography>
        <Tooltip title="Actualizar datos">
          <IconButton onClick={handleRefresh} disabled={anyLoading}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Stack>

      {anyLoading && <LinearProgress sx={{ mb: 2, borderRadius: 1 }} />}

      {anyError ? (
        <Alert severity="error">{errorMsg}</Alert>
      ) : !kpi && anyLoading ? (
        <Box display="flex" justifyContent="center" mt={5}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* ===== FILA 1: 4 KPIs ===== */}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                sm: "1fr 1fr",
                md: "repeat(4, 1fr)",
              },
              width: "100%",
            }}
          >
            {kpis.map((kpiCard, i) => (
              <motion.div
                key={kpiCard.label}
                style={{ width: "100%" }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <Card
                  role="button"
                  onClick={() => navigate(kpiCard.link)}
                  sx={{
                    height: "100%",
                    borderLeft: `6px solid ${theme.palette[kpiCard.color].main}`,
                    display: "flex",
                    alignItems: "center",
                    transition: "all 0.25s ease",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      boxShadow: theme.shadows[4],
                      cursor: "pointer",
                    },
                  }}
                >
                  <CardContent
                    sx={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 2,
                    }}
                  >
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {kpiCard.label}
                      </Typography>
                      <Typography variant="h6">{kpiCard.value}</Typography>
                    </Box>
                    <Box color={`${kpiCard.color}.main`}>{kpiCard.icon}</Box>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </Box>

          {/* ===== FILA 2: Tareas + Eventos ===== */}
          <Box
            sx={{
              mt: 2,
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                md: "1fr 1fr",
              },
              width: "100%",
            }}
          >

            {/* ==== TAREAS PENDIENTES ==== */}
            <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle1" fontWeight={600}>
                    Tareas pendientes
                  </Typography>
                  <FormControlLabel
                    control={
                      <Switch
                        sx={switchSx}
                        checked={incluirVencidas}
                        onChange={(e) => setIncluirVencidas(e.target.checked)}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">Mostrar vencidas</Typography>}
                  />
                </Stack>
                <Divider/>

                <Box sx={{ flexGrow: 1, overflowY: "auto", maxHeight: "calc(100vh - 350px)" }}>
                  {tareasOrdenadas.length === 0 ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      px={2}
                      py={1}
                    >
                      No hay tareas pendientes
                    </Typography>
                  ) : (
                    <Stack spacing={0.75} sx={{ py: 1 }}>
                      {tareasOrdenadas.map((t) => {
                        const vencida = !t.completada && isOverdue(t.fechaVencimiento);
                        const clienteTexto = displayCliente(t.cliente);
                        const isToggling = toggleTarea.isPending && toggleTarea.variables === t.id;
                        const fechaFmt = t.fechaVencimiento
                          ? dayjs(t.fechaVencimiento).format("DD/MM HH:mm")
                          : "Sin fecha";

                        return (
                          <Box
                            key={t.id}
                            sx={{
                              p: 1,
                              borderRadius: 1,
                              bgcolor: vencida ? theme.palette.error.light : theme.palette.background.paper,
                              border: `1px solid ${vencida ? theme.palette.error.main : theme.palette.divider}`,
                              "&:hover": {
                                boxShadow: theme.shadows[2],
                              },
                            }}
                          >
                            {/* Header: Checkbox, título, prioridad, fecha, expandir */}
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                              <Tooltip title={t.completada ? "Marcar incompleta" : "Marcar completada"}>
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={isToggling}
                                    onClick={() => toggleTarea.mutate(t.id)}
                                    sx={{ p: 0.5 }}
                                  >
                                    {t.completada ? (
                                      <Box
                                        sx={{
                                          width: 20,
                                          height: 20,
                                          borderRadius: "50%",
                                          bgcolor: theme.palette.success.main,
                                          display: "grid",
                                          placeItems: "center",
                                        }}
                                      >
                                        <CheckRoundedIcon
                                          sx={{ color: "common.white", fontSize: "14px" }}
                                        />
                                      </Box>
                                    ) : (
                                      <Box
                                        sx={{
                                          width: 20,
                                          height: 20,
                                          borderRadius: "50%",
                                          bgcolor: vencida ? theme.palette.error.main : theme.palette.action.disabledBackground,
                                          display: "grid",
                                          placeItems: "center",
                                        }}
                                      >
                                        <CloseRoundedIcon
                                          sx={{ color: "common.white", fontSize: "14px" }}
                                        />
                                      </Box>
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Typography
                                variant="body2"
                                fontWeight={500}
                                sx={{
                                  flexGrow: 1,
                                  cursor: "pointer",
                                  "&:hover": { color: theme.palette.primary.main },
                                }}
                                onClick={() => toggleTareaExpandida(t.id)}
                              >
                                {t.titulo}
                              </Typography>
                              {t.prioridad && (
                                <Chip
                                  label={t.prioridad.nombre}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: "0.7rem" }}
                                />
                              )}
                              <Typography variant="caption" color={vencida ? "error.main" : "text.secondary"}>
                                {fechaFmt}
                              </Typography>
                              <Tooltip title={tareasExpandidas.has(t.id) ? "Ocultar" : "Mostrar detalles"}>
                                <IconButton
                                  size="small"
                                  onClick={() => toggleTareaExpandida(t.id)}
                                  sx={{ p: 0.25 }}
                                >
                                  {tareasExpandidas.has(t.id) ? (
                                    <ExpandLess fontSize="small" />
                                  ) : (
                                    <ExpandMore fontSize="small" />
                                  )}
                                </IconButton>
                              </Tooltip>
                            </Stack>

                            {/* Detalles expandidos: cliente, caso, descripción, recordatorio, subtareas */}
                            {tareasExpandidas.has(t.id) && (
                              <Box sx={{ ml: 4, mt: 0.5 }}>
                                <Stack spacing={0.5}>
                                  {clienteTexto && (
                                    <Typography variant="caption" color="text.secondary">
                                      👤 Cliente: {clienteTexto}
                                    </Typography>
                                  )}
                                  {t.caso?.caratula && (
                                    <Typography variant="caption" color="text.secondary">
                                      ⚖️ Caso: {t.caso.caratula}
                                    </Typography>
                                  )}
                                  {t.descripcion && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                                      {t.descripcion}
                                    </Typography>
                                  )}
                                  {t.recordatorio && (
                                    <Typography variant="caption" color="warning.main">
                                      🔔 Recordatorio: {dayjs(t.recordatorio).format("DD/MM HH:mm")}
                                    </Typography>
                                  )}
                                  {t.items && t.items.length > 0 && (
                                    <Box sx={{ mt: 0.5 }}>
                                      <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                                        Subtareas:
                                      </Typography>
                                      <Stack spacing={0.5} divider={<Divider flexItem />}>
                                        {t.items.map((sub) => {
                                          const isSubtoggling = toggleSubtarea.isPending && 
                                            toggleSubtarea.variables?.tareaId === t.id && 
                                            toggleSubtarea.variables?.subtareaId === sub.id;
                                          return (
                                            <Stack
                                              key={sub.id}
                                              direction="row"
                                              alignItems="center"
                                              spacing={0.75}
                                              sx={{ py: 0.25 }}
                                            >
                                              <Tooltip title={sub.completada ? "Marcar incompleta" : "Marcar completada"}>
                                                <IconButton
                                                  size="small"
                                                  disabled={isSubtoggling}
                                                  onClick={() => toggleSubtarea.mutate({ tareaId: t.id, subtareaId: sub.id })}
                                                  sx={{ p: 0.25 }}
                                                >
                                                  {sub.completada ? (
                                                    <CheckRoundedIcon sx={{ color: theme.palette.success.main, fontSize: "14px" }} />
                                                  ) : (
                                                    <CloseRoundedIcon sx={{ color: theme.palette.text.disabled, fontSize: "14px" }} />
                                                  )}
                                                </IconButton>
                                              </Tooltip>
                                              <Typography
                                                variant="caption"
                                                sx={{
                                                  textDecoration: sub.completada ? "line-through" : "none",
                                                  opacity: sub.completada ? 0.5 : 1,
                                                  flexGrow: 1,
                                                }}
                                              >
                                                {sub.titulo}
                                              </Typography>
                                            </Stack>
                                          );
                                        })}
                                      </Stack>
                                    </Box>
                                  )}
                                </Stack>
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Box>
              </CardContent>
            </Card>


            {/* ==== EVENTOS PENDIENTES ==== */}
            <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Eventos pendientes
                </Typography>
                <Divider/>

                <Box sx={{ flexGrow: 1, overflowY: "auto", maxHeight: "calc(100vh - 350px)" }}>
                  {eventosOrdenados.length === 0 ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      px={2}
                      py={1}
                    >
                      No hay eventos pendientes
                    </Typography>
                  ) : (
                    <Stack spacing={0.75} sx={{ py: 1 }}>
                      {eventosOrdenados.map((ev) => {
                        const titulo = ev.titulo || "Evento";
                        const fecha = dayjs(ev.fecha);
                        const clienteNombre = ev?.cliente
                          ? ev.cliente.razonSocial ||
                            [ev.cliente.apellido, ev.cliente.nombre].filter(Boolean).join(", ")
                          : null;
                        const vencido = isOverdue(ev.fecha);
                        const fechaFmt = fecha.format("DD/MM HH:mm");

                        return (
                          <Box
                            key={ev.id}
                            sx={{
                              p: 1,
                              borderRadius: 1,
                              bgcolor: vencido ? theme.palette.error.light : theme.palette.background.paper,
                              border: `1px solid ${vencido ? theme.palette.error.main : theme.palette.divider}`,
                              "&:hover": {
                                boxShadow: theme.shadows[2],
                              },
                            }}
                          >
                            {/* Header: Título, tipo, fecha, expandir */}
                            <Stack direction="row" alignItems="center" spacing={0.75}>
                              <Typography
                                variant="body2"
                                fontWeight={500}
                                sx={{
                                  flexGrow: 1,
                                  cursor: "pointer",
                                  "&:hover": { color: theme.palette.primary.main },
                                }}
                                onClick={() => toggleEventoExpandido(ev.id)}
                              >
                                {titulo}
                              </Typography>
                              {ev.tipo && (
                                <Chip
                                  label={ev.tipo.nombre}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: "0.7rem" }}
                                />
                              )}
                              <Typography variant="caption" color={vencido ? "error.main" : "text.secondary"}>
                                {fechaFmt}
                              </Typography>
                              <Tooltip title={eventosExpandidos.has(ev.id) ? "Ocultar" : "Mostrar detalles"}>
                                <IconButton
                                  size="small"
                                  onClick={() => toggleEventoExpandido(ev.id)}
                                  sx={{ p: 0.25 }}
                                >
                                  {eventosExpandidos.has(ev.id) ? (
                                    <ExpandLess fontSize="small" />
                                  ) : (
                                    <ExpandMore fontSize="small" />
                                  )}
                                </IconButton>
                              </Tooltip>
                            </Stack>

                            {/* Detalles expandidos */}
                            {eventosExpandidos.has(ev.id) && (
                              <Box sx={{ ml: 0, mt: 0.5 }}>
                                <Stack spacing={0.5}>
                                  {clienteNombre && (
                                    <Typography variant="caption" color="text.secondary">
                                      👤 Cliente: {clienteNombre}
                                    </Typography>
                                  )}
                                  {ev.caso?.caratula && (
                                    <Typography variant="caption" color="text.secondary">
                                      ⚖️ Caso: {ev.caso.caratula}
                                    </Typography>
                                  )}
                                  {ev.observaciones && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                                      {ev.observaciones}
                                    </Typography>
                                  )}
                                  {ev.ubicacion && (
                                    <Typography variant="caption" color="text.secondary">
                                      📍 Ubicación: {ev.ubicacion}
                                    </Typography>
                                  )}
                                  {ev.recordatorio && (
                                    <Typography variant="caption" color="warning.main">
                                      🔔 Recordatorio: {dayjs(ev.recordatorio).format("DD/MM HH:mm")}
                                    </Typography>
                                  )}
                                </Stack>
                              </Box>
                            )}
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </>
      )}
    </Box>
  );
};

export default Dashboard;
