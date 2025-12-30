// src/pages/CasoDetalle.jsx
import React, { useMemo, useState, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import { usePermisos, usePermiso } from "../auth/usePermissions";
import { Box, Paper, Typography, CircularProgress, Alert, Button, Avatar, Chip, Stack, Grid, Tooltip, Tabs, Tab, Divider,
} from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import AddIcon from "@mui/icons-material/Add";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);

// Reuso de componentes del detalle de caso
import CasoTareas from "../components/detalle-caso/CasoTareas";
import CasoEventos from "../components/detalle-caso/CasoEventos";
import CasoHonorarios from "../components/detalle-caso/CasoHonorarios";
import CasoIngresos from "../components/detalle-caso/CasoIngresos";
import CasoGastos from "../components/detalle-caso/CasoGastos";
import CasoNotas from "../components/detalle-caso/CasoNotas";
import CasoTimeline from "../components/detalle-caso/CasoTimeline";
import CasoAdjuntos from "../components/detalle-caso/CasoAdjuntos";

/* ============== Fetcher ============== */
async function fetchDetalleCaso({ queryKey }) {
  const [_key, id] = queryKey;
  const { data } = await api.get(`/casos/${id}/detalle`);
  return data; // { caso, tareas, eventos, honorarios, gastos, ingresos }
}

/* ============== Helpers ============== */
const initialsFrom = (text = "") =>
  text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0]?.toUpperCase())
    .join("");

function TabPanel({ value, index, children }) {
  return (
    <div role="tabpanel" hidden={value !== index} aria-labelledby={`tab-${index}`}>
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

const TAB_INFO = [
  { singular: "Tarea",     to: (id) => `/tareas/nuevo?casoId=${id}` },
  { singular: "Evento",    to: (id) => `/eventos/nuevo?casoId=${id}` },
  { singular: "Honorario", to: (id) => `/finanzas/honorarios/nuevo?casoId=${id}` },
  { singular: "Gasto",     to: (id) => `/finanzas/gastos/nuevo?casoId=${id}` },
  { singular: "Ingreso",   to: (id) => `/finanzas/ingresos/nuevo?casoId=${id}` },
  null, // Notas - no tiene botón crear
  null, // Timeline - no tiene botón crear
];

// Feature flag para habilitar/deshabilitar la funcionalidad de adjuntos
const ADJUNTOS_ENABLED = true;

export default function CasoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Verificaciones de permisos
  const canViewTareas = usePermiso('TAREAS', 'ver');
  const canViewEventos = usePermiso('EVENTOS', 'ver');
  const canViewFinanzas = usePermiso('FINANZAS', 'ver');
  const { canCrear: canCrearTarea } = usePermisos('TAREAS');
  const { canCrear: canCrearEvento } = usePermisos('EVENTOS');
  const { canCrear: canCrearFinanzas } = usePermisos('FINANZAS');
  const canEditarCaso = usePermiso('CASOS', 'editar');
  const canEditarTarea = usePermiso('TAREAS', 'editar');
  const canEditarEvento = usePermiso('EVENTOS', 'editar');
  const canEditarFinanzas = usePermiso('FINANZAS', 'editar');

  const backTo = location.state?.from ?? { pathname: "/casos" };
  const goBack = () => navigate(backTo, { replace: true });

  const initialTab = Number(sessionStorage.getItem("casoTab") || 0);
  const [tab, setTab] = useState(initialTab);
  
  // Ref para controlar el dialog de notas
  const notasRef = useRef(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["caso-detalle", id],
    queryFn: fetchDetalleCaso,
    enabled: !!id,
  });

  const {
    caso = {},
    tareas = [],
    eventos = [],
    honorarios = [],
    gastos = [],
    ingresos = [],
  } = data || {};

  const titulo   = caso?.caratula?.trim() || "Caso";
  const nroExpte = caso?.nroExpte || "-";

  // (opcional) Totales
  const totIngresosARS = useMemo(
    () =>
      ingresos.reduce(
        (acc, i) => acc + (Number(i.importeARS ?? i.montoARS ?? 0) || 0),
        0
      ),
    [ingresos]
  );
  const totGastosARS = useMemo(
    () => gastos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0),
    [gastos]
  );
  const saldoARS = totIngresosARS - totGastosARS;

  if (isLoading) {
    return <CircularProgress sx={{ display: "block", mx: "auto", mt: 4 }} />;
  }
  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error?.message || "Error al cargar el caso."}
      </Alert>
    );
  }

  const iconColor = (t) =>
    t.palette.mode === "dark" ? t.palette.primary.light : t.palette.primary.main;

  const clienteNombre =
    caso?.cliente?.razonSocial ||
    [caso?.cliente?.apellido, caso?.cliente?.nombre].filter(Boolean).join(", ") ||
    null;

  const activeTabInfo = TAB_INFO[tab];

  return (
    <Box sx={{ p: { xs: 1, sm: 2 }, maxWidth: 1300, mx: "auto" }}>
      {/* Header */}
      <Paper
        variant="outlined"
        sx={{
          mb: 3,
          borderRadius: 4,
          overflow: "hidden",
          border: (t) => `1px solid ${t.palette.divider}`,
          boxShadow: (t) =>
            t.palette.mode === "dark" ? "none" : "0 4px 24px rgba(0,0,0,.06)",
        }}
      >
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            py: 2,
            backgroundImage: (t) =>
              t.palette.mode === "dark"
                ? `linear-gradient(180deg, ${t.palette.background.paper} 0%, ${t.palette.background.default} 100%)`
                : `linear-gradient(180deg, #fafafa 0%, #fff 100%)`,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            {/* Avatar + título + chip de expediente */}
            <Stack direction="row" spacing={2} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <Avatar
                sx={{
                  width: { xs: 44, sm: 56 },
                  height: { xs: 44, sm: 56 },
                  bgcolor: (t) => iconColor(t),
                  color: "white",
                  fontWeight: 700,
                  fontSize: { xs: 16, sm: 20 },
                  flexShrink: 0,
                }}
              >
                {initialsFrom(titulo)}
              </Avatar>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 800,
                    letterSpacing: 0.2,
                    lineHeight: 1.2,
                    mb: 0.75,
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                  }}
                >
                  {titulo}
                </Typography>

                <Chip
                  size="small"
                  icon={<DescriptionOutlinedIcon />}
                  label={`Expte: ${nroExpte}`}
                  sx={{
                    "& .MuiChip-icon": { fontSize: 18 },
                    maxWidth: "100%",
                    "& .MuiChip-label": {
                      display: "block",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    },
                  }}
                />
              </Box>
            </Stack>

            {/* Botón Editar */}
            {canEditarCaso && (
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  mt: { xs: 1, sm: 0 },
                  alignSelf: { xs: "flex-start", sm: "auto" },
                  flexWrap: { xs: "wrap", sm: "nowrap" },
                  gap: 1,
                }}
              >
                <Tooltip title="Editar caso">
                  <span>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={!caso?.id}
                      onClick={() =>
                        navigate(`/casos/editar/${caso.id}`, {
                          state: {
                            from: { pathname: location.pathname, search: location.search },
                          },
                        })
                      }
                    >
                      Editar
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            )}
          </Stack>
        </Box>

        {/* Datos (todas filas, sin chips) */}
        <Box sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
          <Grid container spacing={1.5}>
            {/* Cliente */}
            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <GavelOutlinedIcon sx={{ fontSize: 18, color: (t) => iconColor(t) }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    Cliente
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={clienteNombre || "-"}
                  >
                    {clienteNombre || "-"}
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            {/* Tipo */}
            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <GavelOutlinedIcon sx={{ fontSize: 18, color: (t) => iconColor(t) }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    Tipo
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {caso?.tipo?.nombre || "-"}
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            {/* Estado */}
            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <CalendarMonthOutlinedIcon sx={{ fontSize: 18, color: (t) => iconColor(t) }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    Estado
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {caso?.estado?.nombre || "-"}
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            {/* Último cambio de estado */}
            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <CalendarMonthOutlinedIcon sx={{ fontSize: 18, color: (t) => iconColor(t) }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Último cambio de estado
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {caso?.fechaEstado ? dayjs.utc(caso.fechaEstado).local().format("DD/MM/YYYY") : "-"}
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            {/* Radicación */}
            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <PlaceOutlinedIcon sx={{ fontSize: 18, color: (t) => iconColor(t) }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    Radicación
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {caso?.radicacion?.nombre || "-"}
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            {/* Estado de radicación */}
            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <PlaceOutlinedIcon sx={{ fontSize: 18, color: (t) => iconColor(t) }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    Estado de radicación
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {caso?.estadoRadicacion?.nombre || "-"}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </Paper>

      {/* Tabs + botón crear */}
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 4,
          overflow: "hidden",
          border: (t) => `1px solid ${t.palette.divider}`,
          boxShadow: (t) =>
            t.palette.mode === "dark" ? "none" : "0 4px 24px rgba(0,0,0,.06)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, pt: 1 }}>
          <Tabs
            value={tab}
            onChange={(_, v) => {
              setTab(v);
              sessionStorage.setItem("casoTab", v);
            }}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{
              flex: 1,
              "& .MuiTabs-flexContainer": { gap: 0.5 },
              "& .MuiTab-root": {
                textTransform: "none",
                minHeight: 44,
                borderRadius: 999,
                "&.Mui-selected": {
                  color: (t) =>
                    t.palette.mode === "dark"
                      ? t.palette.common.white
                      : t.palette.text.primary,
                },
              },
              "& .MuiTabs-indicator": {
                height: 2.5,
                borderRadius: 2,
                backgroundColor: (t) =>
                  t.palette.mode === "dark"
                    ? t.palette.common.white
                    : t.palette.primary.main,
              },
            }}
          >
            {canViewTareas && <Tab label={`Tareas (${tareas.length})`} id="tab-0" />}
            {canViewEventos && <Tab label={`Eventos (${eventos.length})`} id="tab-1" />}
            {canViewFinanzas && <Tab label={`Honorarios (${honorarios.length})`} id="tab-2" />}
            {canViewFinanzas && <Tab label={`Gastos (${gastos.length})`} id="tab-3" />}
            {canViewFinanzas && <Tab label={`Ingresos (${ingresos.length})`} id="tab-4" />}
            <Tab label="Notas" id="tab-5" />
            <Tab label="Timeline" id="tab-6" />
            {ADJUNTOS_ENABLED && <Tab label="Adjuntos" id="tab-7" />}
          </Tabs>

          {((tab === 0 && canCrearTarea) || (tab === 1 && canCrearEvento) || ((tab === 2 || tab === 3 || tab === 4) && canCrearFinanzas)) && (
            <Tooltip title={activeTabInfo ? `Crear ${activeTabInfo.singular}` : ""}>
              <span>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  sx={{ whiteSpace: "nowrap" }}
                  onClick={() => {
                    const routes = [
                      (cid) => `/tareas/nuevo?casoId=${cid}`,
                      (cid) => `/eventos/nuevo?casoId=${cid}`,
                      (cid) => `/finanzas/honorarios/nuevo?casoId=${cid}`,
                      (cid) => `/finanzas/gastos/nuevo?casoId=${cid}`,
                      (cid) => `/finanzas/ingresos/nuevo?casoId=${cid}`,
                    ];
                    const to = routes[tab]?.(Number(id));
                    if (!to) return;
                    navigate(to, {
                      state: {
                        prefill: { casoId: Number(id), clienteId: caso?.cliente?.id ?? undefined },
                        from: { pathname: location.pathname, search: location.search },
                      },
                    });
                  }}
                >
                  {activeTabInfo?.singular || "Nuevo"}
                </Button>
              </span>
            </Tooltip>
          )}
          {tab === 5 && (
            <Button
              variant="contained"
              size="small"
              onClick={() => notasRef.current?.abrirDialogNueva()}
            >
              + Nota
            </Button>
          )}
        </Box>

        <Divider />

        <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: 2 }}>
          {canViewTareas && (
            <TabPanel value={tab} index={0}>
              <CasoTareas
                tareas={tareas}
                embedded
                onDetail={(t) =>
                  navigate(`/tareas/editar/${t.id}?mode=view`, {
                    state: {
                      viewOnly: true,
                      from: { pathname: location.pathname, search: location.search },
                    },
                  })
                }
                onEdit={canEditarTarea ? (t) =>
                  navigate(`/tareas/editar/${t.id}`, {
                    state: { from: { pathname: location.pathname, search: location.search } },
                  })
                : undefined}
              />
            </TabPanel>
          )}

          {canViewEventos && (
            <TabPanel value={tab} index={1}>
              <CasoEventos
                eventos={eventos}
                embedded
                onDetail={(e) =>
                  navigate(`/eventos/editar/${e.id}?mode=view`, {
                    state: {
                      viewOnly: true,
                      from: { pathname: location.pathname, search: location.search },
                    },
                  })
                }
                onEdit={canEditarEvento ? (e) =>
                  navigate(`/eventos/editar/${e.id}`, {
                    state: { from: { pathname: location.pathname, search: location.search } },
                  })
                : undefined}
              />
            </TabPanel>
          )}

          {canViewFinanzas && (
            <>
              <TabPanel value={tab} index={2}>
                <CasoHonorarios
                  honorarios={honorarios}
                  embedded
                  onDetail={(h) => 
                    navigate(`/finanzas/honorarios/${h.id}`, { 
                    state:{ from:{ pathname: location.pathname, search: location.search }}})}
                  onEdit={canEditarFinanzas ? (h) =>
                    navigate(`/finanzas/honorarios/editar/${h.id}`, {
                      state: { from: { pathname: location.pathname, search: location.search } },
                    })
                  : undefined}
                />
              </TabPanel>

              <TabPanel value={tab} index={3}>
                <CasoGastos
                  gastos={gastos}
                  embedded
                  onDetail={(g) =>
                    navigate(`/finanzas/gastos/${g.id}`, {
                      state: { from: { pathname: location.pathname, search: location.search } },
                    })
                  }
                  onEdit={canEditarFinanzas ? (g) =>
                    navigate(`/finanzas/gastos/editar/${g.id}`, {
                      state: { from: { pathname: location.pathname, search: location.search } },
                    })
                  : undefined}
                />
              </TabPanel>

              <TabPanel value={tab} index={4}>
                <CasoIngresos
                  ingresos={ingresos}
                  embedded
                  onDetail={(i) =>
                    navigate(`/finanzas/ingresos/${i.id}`, {
                      state: { from: { pathname: location.pathname, search: location.search } },
                    })
                  }
                  onEdit={canEditarFinanzas ? (i) =>
                    navigate(`/finanzas/ingresos/editar/${i.id}`, {
                      state: { from: { pathname: location.pathname, search: location.search } },
                    })
                  : undefined}
                />
              </TabPanel>
            </>
          )}

          <TabPanel value={tab} index={5}>
            <CasoNotas ref={notasRef} casoId={Number(id)} />
          </TabPanel>

          <TabPanel value={tab} index={6}>
            <CasoTimeline 
              casoId={Number(id)} 
              caso={caso}
              tareas={tareas}
              eventos={eventos}
            />
          </TabPanel>

          {ADJUNTOS_ENABLED && (
            <TabPanel value={tab} index={7}>
              <CasoAdjuntos casoId={Number(id)} />
            </TabPanel>
          )}
        </Box>
      </Paper>
      {/* Footer acciones */}
      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
        <Button variant="contained" onClick={goBack}>
          Volver
        </Button>
      </Box>
    </Box>
  );
}
