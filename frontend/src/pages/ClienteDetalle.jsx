// src/pages/ClienteDetalle.jsx
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../api/axios";
import { usePermiso, usePermisos } from "../auth/usePermissions";

import {
  Box,
  Paper,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Avatar,
  Chip,
  Stack,
  Grid,
  Tooltip,
  Tabs,
  Tab,
  Divider,
  Collapse,
  IconButton,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import AddIcon from "@mui/icons-material/Add";

import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
import { goToNuevo, entityFromTab, newLabelFromTab } from "../utils/nav";
// Subcomponentes
import ClienteCasos from "../components/detalle-cliente/ClienteCasos";
import ClienteTareas from "../components/detalle-cliente/ClienteTareas";
import ClienteEventos from "../components/detalle-cliente/ClienteEventos";
import ClienteHonorarios from "../components/detalle-cliente/ClienteHonorarios";
import ClienteIngresos from "../components/detalle-cliente/ClienteIngresos";
import ClienteGastos from "../components/detalle-cliente/ClienteGastos";
import ClienteNotas from "../components/detalle-cliente/ClienteNotas";
import ClienteTimeline from "../components/detalle-cliente/ClienteTimeline";
import ClienteAdjuntos from "../components/detalle-cliente/ClienteAdjuntos";

/* ============== Fetcher ============== */
async function fetchDetalleCliente({ queryKey }) {
  const [_key, id] = queryKey;
  const { data } = await api.get(`/clientes/${id}/detalle`);
  // { cliente, casos, tareas, eventos, honorarios, gastos, ingresos }
  return data;
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

// Mapeo de pestañas → rutas de alta y label singular
const TAB_INFO = [
  { singular: "Caso",       to: (id) => `/casos/nuevo?clienteId=${id}` },
  { singular: "Tarea",      to: (id) => `/tareas/nuevo?clienteId=${id}` },
  { singular: "Evento",     to: (id) => `/eventos/nuevo?clienteId=${id}` },
  { singular: "Honorario",  to: (id) => `/finanzas/honorarios/nuevo?clienteId=${id}` },
  { singular: "Gasto",      to: (id) => `/finanzas/gastos/nuevo?clienteId=${id}` },
  { singular: "Ingreso",    to: (id) => `/finanzas/ingresos/nuevo?clienteId=${id}` },
  null, // Notas - no tiene botón "Nuevo"
  null, // Timeline - no tiene botón "Nuevo"
];

export default function ClienteDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // Verificaciones de permisos
  const canViewCasos = usePermiso('CASOS', 'ver');
  const canViewTareas = usePermiso('TAREAS', 'ver');
  const canViewEventos = usePermiso('EVENTOS', 'ver');
  const canViewFinanzas = usePermiso('FINANZAS', 'ver');
  const { canCrear: canCrearCaso } = usePermisos('CASOS');
  const { canCrear: canCrearTarea } = usePermisos('TAREAS');
  const { canCrear: canCrearEvento } = usePermisos('EVENTOS');
  const { canCrear: canCrearFinanzas } = usePermisos('FINANZAS');
  const canEditarCliente = usePermiso('CLIENTES', 'editar');
  const canEditarCaso = usePermiso('CASOS', 'editar');
  const canEditarTarea = usePermiso('TAREAS', 'editar');
  const canEditarEvento = usePermiso('EVENTOS', 'editar');
  const canEditarFinanzas = usePermiso('FINANZAS', 'editar');

  const backTo = location.state?.from ?? { pathname: "/clientes" };
  const goBack = () => navigate(backTo, { replace: true });

  const initialTab = Number(sessionStorage.getItem("clienteTab") || 0);
  const [tab, setTab] = useState(initialTab);
  const [openContactos, setOpenContactos] = useState(true);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["cliente-detalle", id],
    queryFn: fetchDetalleCliente,
    enabled: !!id,
  });

  const {
    cliente = {},
    casos = [],
    tareas = [],
    eventos = [],
    honorarios = [],
    gastos = [],
    ingresos = [],
  } = data || {};

  const saldo = useMemo(() => {
    const totIng = ingresos.reduce((acc, i) => acc + (Number(i.monto) || 0), 0);
    const totGas = gastos.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
    return totIng - totGas;
  }, [ingresos, gastos]);

  const tareasVencidas = useMemo(() => {
    const hoy = dayjs().startOf("day");
    return tareas.filter((t) => {
      const f = t.fechaLimite ? dayjs.utc(t.fechaLimite).startOf("day") : null;
      return f && f.isBefore(hoy) && !t.completada;
    }).length;
  }, [tareas]);

  if (isLoading) {
    return <CircularProgress sx={{ display: "block", mx: "auto", mt: 4 }} />;
  }
  if (isError) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error?.message || "Error al cargar el cliente."}
      </Alert>
    );
  }

  const tipoCodigo = (cliente?.tipoPersona?.codigo || "").toUpperCase();
  const isFisica = tipoCodigo === "PERSONA_FISICA";

  const titulo = isFisica
    ? [cliente?.apellido?.trim(), cliente?.nombre?.trim()].filter(Boolean).join(", ") || "Cliente"
    : cliente?.razonSocial?.trim() || "Cliente";

  const fechaLabel = isFisica ? "Fecha nac.:" : "Inicio activ.:";
  const fechaValor = cliente?.fechaNacimiento
    ? dayjs.utc(cliente.fechaNacimiento).format("DD/MM/YYYY")
    : "-";

  const direccion =
    [
      cliente?.dirCalle,
      cliente?.dirNro,
      cliente?.dirPiso ? `Piso ${cliente.dirPiso}` : null,
      cliente?.dirDepto ? `Dto ${cliente.dirDepto}` : null,
    ]
      .filter(Boolean)
      .join(" ") || "-";

  const iconColor = (t) =>
    t.palette.mode === "dark" ? t.palette.primary.light : t.palette.primary.main;

  const currency = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

  const activeTabInfo = TAB_INFO[tab];
  const handleNuevo = () => {
    if (!activeTabInfo || !cliente?.id) return;
    navigate(activeTabInfo.to(cliente.id));
  };

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
          {/* Header responsive: en xs apilado; en sm+ en fila */}
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
          >
            {/* Bloque Avatar + Título + Chips */}
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
                    mb: 0.5,
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                  }}
                >
                  {titulo}
                </Typography>

                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    size="small"
                    icon={isFisica ? <PersonRoundedIcon /> : <BusinessRoundedIcon />}
                    label={isFisica ? "Persona física" : "Persona jurídica"}
                    sx={{ "& .MuiChip-icon": { fontSize: 18 } }}
                  />
                  {cliente?.localidad?.nombre && (
                    <Chip
                      size="small"
                      icon={<PlaceOutlinedIcon />}
                      label={cliente.localidad.nombre}
                      variant="outlined"
                      sx={{ "& .MuiChip-icon": { fontSize: 18 } }}
                    />
                  )}
                </Stack>
              </Box>
            </Stack>

            {/* Botones (en xs pasan abajo) */}
            {canEditarCliente && (
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
                <Tooltip title="Editar cliente">
                  <span>
                    <Button
                      variant="outlined"
                      size="small"
                      disabled={!cliente?.id}
                      onClick={() =>
                        navigate(`/clientes/editar/${cliente.id}`, {
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
                {/* Sacamos el "Nuevo caso" del header para evitar duplicar con el botón de las tabs */}
              </Stack>
            )}
          </Stack>
        </Box>

        {/* Datos */}
        <Box sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <BadgeOutlinedIcon sx={{ fontSize: 18, color: (t) => iconColor(t) }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    CUIT
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontFeatureSettings: "'tnum' on, 'lnum' on",
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      fontWeight: 600,
                    }}
                  >
                    {cliente?.cuit || "-"}
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <CalendarMonthOutlinedIcon sx={{ fontSize: 18, color: (t) => iconColor(t) }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {fechaLabel}
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {fechaValor}
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <EmailOutlinedIcon sx={{ fontSize: 18, color: (t) => iconColor(t) }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: "break-word" }}>
                    {cliente?.email || "-"}
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <LocalPhoneOutlinedIcon sx={{ fontSize: 18, color: (t) => iconColor(t) }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Teléfono
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {cliente?.telCelular || cliente?.telFijo || "-"}
                  </Typography>
                </Box>
              </Stack>
            </Grid>

            <Grid item xs={12} md={8}>
              <Stack direction="row" spacing={1.25} alignItems="flex-start">
                <PlaceOutlinedIcon sx={{ mt: 0.2, fontSize: 18, color: (t) => iconColor(t) }} />
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary">
                    Dirección
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {direccion}
                  </Typography>
                </Box>
              </Stack>
            </Grid>
                   </Grid>

          {/* Contactos del cliente (colapsable) */}
          {Array.isArray(cliente.contactos) && cliente.contactos.length > 0 && (
            <>
              <Divider sx={{ mx: { xs: 2, sm: 3 } }} />

              <Box sx={{ px: { xs: 2, sm: 3 }, pt: 0.5, pb: openContactos ? 0 : 0.5 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="subtitle1" fontWeight={600}>
                    Contactos ({cliente.contactos.length})
                  </Typography>

                  <IconButton
                    size="small"
                    onClick={() => setOpenContactos((v) => !v)}
                    aria-label={openContactos ? "Contraer contactos" : "Expandir contactos"}
                    sx={{
                      transform: `rotate(${openContactos ? 180 : 0}deg)`,
                      transition: "transform .2s ease",
                    }}
                  >
                    <ExpandMoreIcon />
                  </IconButton>
                </Stack>
              </Box>

              <Collapse in={openContactos} timeout="auto" unmountOnExit>
                <Box sx={{ px: { xs: 2, sm: 3 }, py: 1.5 }}>
                  <Stack spacing={1.5}>
                    {cliente.contactos.map((c) => (
                      <Paper
                        key={c.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: 1,
                        }}
                      >
                        <Box>
                          <Typography variant="body1" fontWeight={600}>
                            {c.nombre}
                          </Typography>
                          {c.rol && (
                            <Typography variant="body2" color="text.secondary">
                              {c.rol}
                            </Typography>
                          )}
                        </Box>

                        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                          {c.email && (
                            <Chip
                              icon={<EmailOutlinedIcon sx={{ fontSize: 18 }} />}
                              label={c.email}
                              size="small"
                              variant="outlined"
                            />
                          )}
                          {c.telefono && (
                            <Chip
                              icon={<LocalPhoneOutlinedIcon sx={{ fontSize: 18 }} />}
                              label={c.telefono}
                              size="small"
                              variant="outlined"
                            />
                          )}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                </Box>
              </Collapse>
            </>
          )}
        </Box>
      </Paper>

      {/* Tabs Módulos + botón “Nuevo …” a la derecha */}
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
              sessionStorage.setItem("clienteTab", v);
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
              }
            }}
          >
            {canViewCasos && <Tab label={`Casos (${casos.length})`} id="tab-0" />}
            {canViewTareas && <Tab label={`Tareas (${tareas.length})`} id="tab-1" />}
            {canViewEventos && <Tab label={`Eventos (${eventos.length})`} id="tab-2" />}
            {canViewFinanzas && <Tab label={`Honorarios (${honorarios.length})`} id="tab-3" />}
            {canViewFinanzas && <Tab label={`Gastos (${gastos.length})`} id="tab-4" />}
            {canViewFinanzas && <Tab label={`Ingresos (${ingresos.length})`} id="tab-5" />}
            {canViewCasos && <Tab label="Notas" id="tab-6" />}
            {canViewCasos && <Tab label="Timeline" id="tab-7" />}
            {canViewCasos && <Tab label="Adjuntos" id="tab-8" />}
          </Tabs>

          {((tab === 0 && canCrearCaso) || (tab === 1 && canCrearTarea) || (tab === 2 && canCrearEvento) || ((tab === 3 || tab === 4 || tab === 5) && canCrearFinanzas) && tab < 6) && (
            <Tooltip title={activeTabInfo ? `Crear ${activeTabInfo.singular}` : ""}>
              <span>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  sx={{ whiteSpace: "nowrap" }}
                  onClick={() => {
                    const routes = [
                      (cid) => `/casos/nuevo?clienteId=${cid}`,
                      (cid) => `/tareas/nuevo?clienteId=${cid}`,
                      (cid) => `/eventos/nuevo?clienteId=${cid}`,       
                      (cid) => `/finanzas/honorarios/nuevo?clienteId=${cid}`,
                      (cid) => `/finanzas/gastos/nuevo?clienteId=${cid}`,
                      (cid) => `/finanzas/ingresos/nuevo?clienteId=${cid}`,
                      null, // Notas
                      null, // Historial
                    ];
                    const to = routes[tab]?.(Number(id));
                    if (!to) return;
                    navigate(to, {
                      state: {
                        prefill: { clienteId: Number(id) },                 // <- TareaForm/CasoForm leen esto
                        from: { pathname: location.pathname, search: location.search }, // <- para volver a la misma pestaña
                      },
                    });
                  }}
                >
                  {activeTabInfo?.singular || "Nuevo"}
                </Button>
              </span>
            </Tooltip>
          )}
        </Box>

        <Divider />

        <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: 2 }}>
          <TabPanel value={tab} index={0}>
            <ClienteCasos
              casos={casos}
              embedded
              // ✅ solo los botones hacen algo, el click en la fila no navega
              onDetail={(c) =>
                navigate(`/casos/${c.id}`, {
                  state: { from: { pathname: location.pathname, search: location.search } },
                })
              }
              onEdit={canEditarCaso ? (c) =>
                navigate(`/casos/editar/${c.id}`, {
                  state: { from: { pathname: location.pathname, search: location.search } },
                })
              : undefined}
            />
          </TabPanel>

          <TabPanel value={tab} index={1}>
            <ClienteTareas
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

          <TabPanel value={tab} index={2}>
            <ClienteEventos
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

          <TabPanel value={tab} index={3}>
            <ClienteHonorarios
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

          <TabPanel value={tab} index={4}>
            <ClienteGastos
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

          <TabPanel value={tab} index={5}>
            <ClienteIngresos
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

              <TabPanel value={tab} index={6}>
                <ClienteNotas clienteId={Number(id)} />
              </TabPanel>

              <TabPanel value={tab} index={7}>
                <ClienteTimeline 
                  clienteId={Number(id)}
                  cliente={cliente}
                  casos={casos}
                  tareas={tareas}
                  eventos={eventos}
                />
              </TabPanel>

              <TabPanel value={tab} index={8}>
                <ClienteAdjuntos clienteId={Number(id)} />
              </TabPanel>
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
