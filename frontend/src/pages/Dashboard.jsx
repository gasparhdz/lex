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
  List,
  ListItem,
  ListItemText,
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

                <List dense sx={{ flexGrow: 1 }}>
                  {tareasOrdenadas.map((t, idx) => {
                    const vencida = !t.completada && isOverdue(t.fechaVencimiento);
                    const clienteTexto = displayCliente(t.cliente);
                    const isToggling = toggleTarea.isPending && toggleTarea.variables === t.id;
                    const fechaFmt = t.fechaVencimiento
                      ? dayjs(t.fechaVencimiento).format("DD/MM/YYYY HH:mm")
                      : "Sin fecha";

                    return (
                      <React.Fragment key={t.id}>
                        <ListItem
                          alignItems="flex-start"
                          sx={{
                            "& .MuiListItemSecondaryAction-root": { right: 8 },
                          }}
                          secondaryAction={
                            <Stack
                              direction="row"
                              spacing={1.2}
                              alignItems="center"
                              sx={{ width: 140, justifyContent: "flex-end" }}
                            >
                              {/* Botón toggle completada */}
                              <Tooltip
                                title={
                                  t.completada
                                    ? "Marcar como pendiente"
                                    : "Marcar como completada"
                                }
                              >
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
                                          width: 24,
                                          height: 24,
                                          borderRadius: "50%",
                                          bgcolor: theme.palette.success.main,
                                          display: "grid",
                                          placeItems: "center",
                                        }}
                                      >
                                        <CheckRoundedIcon
                                          sx={{ color: "common.white" }}
                                          fontSize="small"
                                        />
                                      </Box>
                                    ) : (
                                      <Box
                                        sx={{
                                          width: 24,
                                          height: 24,
                                          borderRadius: "50%",
                                          bgcolor: theme.palette.error.main,
                                          display: "grid",
                                          placeItems: "center",
                                        }}
                                      >
                                        <CloseRoundedIcon
                                          sx={{ color: "common.white" }}
                                          fontSize="small"
                                        />
                                      </Box>
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>

                              {/* Ver detalle */}
                              <Tooltip title="Ver detalle">
                                <IconButton
                                  size="small"
                                  onClick={() => navigate(`/tareas/${t.id}`)}
                                >
                                  <OpenInNew fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          }
                        >
                          <ListItemText
                            disableTypography
                            primary={
                              <Tooltip title={t.titulo} arrow>
                                <Typography
                                  variant="body1"
                                  fontWeight={600}
                                  noWrap
                                  sx={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    display: "block",
                                    cursor: "default",
                                    pr: 10,
                                  }}
                                >
                                  {t.titulo}
                                </Typography>
                              </Tooltip>
                            }
                            secondary={
                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={1}
                                useFlexGap
                                flexWrap="wrap"
                              >
                                {clienteTexto && (
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={clienteTexto}
                                    sx={{
                                      maxWidth: 260,
                                      "& .MuiChip-label": {
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      },
                                    }}
                                  />
                                )}
                                <Chip
                                  size="small"
                                  label={fechaFmt}
                                  color={vencida ? "error" : "default"}
                                  variant={vencida ? "filled" : "outlined"}
                                />
                              </Stack>
                            }
                          />
                        </ListItem>

                        {/* Separador entre items */}
                        {idx !== tareasOrdenadas.length - 1 && (
                          <Divider component="li" sx={{ opacity: 0.4 }} />
                        )}
                      </React.Fragment>
                    );
                  })}

                  {tareasOrdenadas.length === 0 && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      px={2}
                      py={0.5}
                    >
                      No hay tareas para mostrar con el filtro actual.
                    </Typography>
                  )}
                </List>
              </CardContent>
            </Card>


            {/* ==== EVENTOS PENDIENTES ==== */}
            <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <CardContent sx={{ flexGrow: 1, display: "flex", flexDirection: "column" }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Eventos pendientes
                </Typography>
                <Divider/>

                <List dense sx={{ flexGrow: 1 }}>
                  {eventosOrdenados.map((ev, idx) => {
                    const titulo = ev.titulo || "Evento";
                    const fecha = dayjs(ev.fecha);
                    const clienteNombre = ev?.cliente
                      ? ev.cliente.razonSocial ||
                        [ev.cliente.apellido, ev.cliente.nombre].filter(Boolean).join(", ")
                      : null;

                    const vencido = isOverdue(ev.fecha);

                    return (
                      <React.Fragment key={ev.id}>
                        <ListItem
                          sx={{ alignItems: "flex-start" }}
                          secondaryAction={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Tooltip title="Ver evento">
                                <IconButton
                                  size="small"
                                  onClick={() => navigate(`/eventos/${ev.id}`)}
                                >
                                  <OpenInNew fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          }
                        >
                          <ListItemText
                            disableTypography
                            primary={
                              <Tooltip title={titulo} arrow>
                                <Typography
                                  variant="body1"
                                  fontWeight={600}
                                  noWrap
                                  sx={{
                                    maxWidth: { xs: "100%", sm: "calc(100% - 140px)" },
                                  }}
                                >
                                  {titulo}
                                </Typography>
                              </Tooltip>
                            }
                            secondary={
                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={1}
                                useFlexGap
                                flexWrap="wrap"
                              >
                                {clienteNombre && (
                                  <Chip
                                    size="small"
                                    variant="outlined"
                                    label={clienteNombre}
                                    sx={{
                                      maxWidth: 260,
                                      "& .MuiChip-label": {
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                      },
                                    }}
                                  />
                                )}
                                <Chip
                                  size="small"
                                  label={fecha.format("DD/MM/YYYY HH:mm")}
                                  color={vencido ? "error" : "default"}
                                  variant={vencido ? "filled" : "outlined"}
                                />
                              </Stack>
                            }
                          />
                        </ListItem>

                        {idx < eventosOrdenados.length - 1 && (
                          <Divider component="li" sx={{ opacity: 0.4 }} />
                        )}
                      </React.Fragment>
                    );
                  })}

                  {eventosOrdenados.length === 0 && (
                    <Typography variant="body2" color="text.secondary" px={2} py={0.5}>
                      No hay eventos pendientes.
                    </Typography>
                  )}
                </List>
              </CardContent>
            </Card>
          </Box>
        </>
      )}
    </Box>
  );
};

export default Dashboard;
