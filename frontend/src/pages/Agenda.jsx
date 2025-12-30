// src/pages/Agenda.jsx (o donde lo tengas)
import { useMemo, useState, useCallback } from "react";
import { usePermiso, usePermisos } from "../auth/usePermissions";
import {
  Paper, Box, Stack, IconButton, ToggleButtonGroup, ToggleButton,
  CircularProgress, FormControlLabel, Switch, Typography,
  Alert, LinearProgress, Tooltip, useMediaQuery, GlobalStyles,
  Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItemButton, ListItemIcon, ListItemText, Button
} from "@mui/material";
import TodayIcon from "@mui/icons-material/Today";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import EventIcon from "@mui/icons-material/Event";
import ChecklistIcon from "@mui/icons-material/Checklist";
import DownloadIcon from "@mui/icons-material/Download";
import * as XLSX from "xlsx";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import {
  format, parse, startOfWeek as dfStartOfWeek, getDay,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  startOfDay, endOfDay, addDays, addMinutes, addHours, isValid as dfIsValid
} from "date-fns";
import es from "date-fns/locale/es";
import { useTheme, alpha } from "@mui/material/styles";
import { listEventos, listTareas } from "../api/agenda";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { esES } from "@mui/x-date-pickers/locales";
import AgendaItemModal from "../components/AgendaItemModal";
import { useNavigate } from "react-router-dom";
import { updateTarea } from "../api/tareas";
import { enqueueSnackbar } from "notistack";
import api from "../api/axios";
import { displayCliente, displayExpte } from "../utils/finanzas";

const joinNonEmpty = (...parts) => parts.filter(Boolean).join(" — ");

// ======= Localizer (date-fns + es) =======
const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => dfStartOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

// ======= Helpers =======
function calendarRange(view, currentDate) {
  const d = currentDate;
  switch (view) {
    case Views.MONTH: {
      const from = startOfWeek(startOfMonth(d), { weekStartsOn: 1 });
      const to   = endOfWeek(endOfMonth(d), { weekStartsOn: 1 });
      return { from, to };
    }
    case Views.WEEK: {
      const from = startOfWeek(d, { weekStartsOn: 1 });
      const to   = endOfWeek(d, { weekStartsOn: 1 });
      return { from, to };
    }
    case Views.DAY:
      return { from: startOfDay(d), to: endOfDay(d) };
    default: {
      const from = startOfWeek(d, { weekStartsOn: 1 });
      const to   = endOfWeek(d, { weekStartsOn: 1 });
      return { from, to };
    }
  }
}

function formatDDMM(date) {
  try {
    if (!date || !dfIsValid(new Date(date))) return "—";
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es });
  } catch {
    return "—";
  }
}

/** Aggregator para mobile:
 * Mes: 1 globo all-day por día/tipo. Semana: 1 globo por hora/tipo (y all-day arriba).
 */
function aggregateForMobileSummaries(view, events) {
  const out = [];
  const keyDay = (d) => {
    const sd = startOfDay(new Date(d));
    return `${sd.getFullYear()}-${String(sd.getMonth()+1).padStart(2,"0")}-${String(sd.getDate()).padStart(2,"0")}`;
  };
  const hourStart = (d) => { const dt = new Date(d); dt.setMinutes(0,0,0); return dt; };

  if (view === Views.MONTH) {
    const byDayKind = new Map();
    for (const ev of events) {
      const kind = ev?.resource?.kind;
      if (kind !== "evento" && kind !== "tarea") continue;
      const key = `${keyDay(ev.start)}|${kind}`;
      if (!byDayKind.has(key)) byDayKind.set(key, { date: startOfDay(ev.start), kind, items: [] });
      byDayKind.get(key).items.push(ev);
    }
    for (const { date, kind, items } of byDayKind.values()) {
      out.push({
        id: `summary-${kind}-${date.getTime()}`,
        title: `+${items.length}`,
        start: date,
        end: addHours(date, 24),
        allDay: true,
        resource: { kind: "summary", summaryOf: kind, items },
      });
    }
    return out;
  }

  if (view === Views.WEEK) {
    const bySlotKind = new Map();  // hour slots
    const byDayAllDay = new Map(); // all-day
    for (const ev of events) {
      const kind = ev?.resource?.kind;
      if (kind !== "evento" && kind !== "tarea") continue;

      if (ev.allDay) {
        const key = `${keyDay(ev.start)}|${kind}`;
        if (!byDayAllDay.has(key)) byDayAllDay.set(key, { date: startOfDay(ev.start), kind, items: [] });
        byDayAllDay.get(key).items.push(ev);
      } else {
        const key = `${keyDay(ev.start)}|${hourStart(ev.start).getHours()}|${kind}`;
        if (!bySlotKind.has(key)) bySlotKind.set(key, { start: hourStart(ev.start), kind, items: [] });
        bySlotKind.get(key).items.push(ev);
      }
    }
    for (const { date, kind, items } of byDayAllDay.values()) {
      out.push({
        id: `summary-ad-${kind}-${date.getTime()}`,
        title: `+${items.length}`,
        start: date,
        end: addHours(date, 24),
        allDay: true,
        resource: { kind: "summary", summaryOf: kind, items },
      });
    }
    for (const { start, kind, items } of bySlotKind.values()) {
      out.push({
        id: `summary-${kind}-${start.getTime()}`,
        title: `+${items.length}`,
        start,
        end: addMinutes(start, 59),
        allDay: false,
        resource: { kind: "summary", summaryOf: kind, items },
      });
    }
    return out;
  }

  return events;
}

// ========== mapping de colores pedido ==========
// TAREAS -> verde (success); EVENTOS -> azul (secondary)
function buildCalendarEvents({ eventos = [], tareas = [], showEventos, showTareas }) {
  const evs = showEventos
    ? eventos.map((e) => {
        const start  = new Date(e.fechaInicio);
        const end    = e.fechaFin ? new Date(e.fechaFin) : addMinutes(new Date(e.fechaInicio), 15);
        const tipo   = e?.tipo?.nombre || e?.tipo?.codigo || "Evento";
        const descripcion = e.descripcion?.trim() ? e.descripcion.trim() : "";
        const caso    = e?.caso?.caratula || "";
        const expte   = e?.caso?.nroExpte || "";

        return {
          id: `ev-${e.id}`,
          title: descripcion || tipo,
          start,
          end,
          allDay: Boolean(e.allDay),
          resource: {
            kind: "evento",
            raw: e,
            meta: { tipo, descripcion, caso, expte, colorKey: "secondary" }, // azul
          },
        };
      })
    : [];

  const taskEvs = showTareas
    ? tareas
        .map((t) => {
          const baseStart = t.fechaLimite ? new Date(t.fechaLimite) : (t.recordatorio ? new Date(t.recordatorio) : null);
          if (!baseStart) return null;
          const start = baseStart;
          const end   = addMinutes(start, 60);
          const descripcion = t.titulo || "Tarea";

          return {
            id: `ta-${t.id}`,
            title: descripcion,
            start,
            end,
            allDay: false,
            resource: {
              kind: "tarea",
              raw: t,
              meta: { descripcion, colorKey: "success" }, // VERDE
            },
          };
        })
        .filter(Boolean)
    : [];

  return [...evs, ...taskEvs];
}

// ======= Renderer =======
function CustomEvent({ event, view, isMobile }) {
  const { resource } = event || {};
  if (!resource) return null;

  // Globos resumen (mobile)
  if (resource.kind === "summary" && isMobile && (view === Views.WEEK || view === Views.MONTH)) {
    return <Typography variant="caption" sx={{ fontWeight: 800 }}>{event.title}</Typography>;
  }

  // Desktop + Mobile (Día)
  if (isMobile && (view === Views.WEEK || view === Views.MONTH)) return null;

  const isEvento = resource.kind === "evento";
  const m = resource.meta || {};
  const tipo = m.tipo || "Evento";
  const desc = m.descripcion || "";
  const caso = m.caso || "";
  const expte = m.expte || "";
  const isMonth  = view === Views.MONTH;
  const isWeek   = view === Views.WEEK;
  const isDay    = view === Views.DAY;

  let line1 = "", line2 = null;
  if (isDay) {
    line1 = isEvento ? joinNonEmpty(tipo, desc, joinNonEmpty(caso, expte)) : desc;
  } else if (isWeek) {
    if (isEvento) { line1 = joinNonEmpty(tipo, desc); const extra = joinNonEmpty(caso, expte); line2 = extra || null; }
    else { line1 = desc; }
  } else if (isMonth) {
    line1 = isEvento ? joinNonEmpty(tipo, desc) : desc;
  }

  const Icon = isEvento ? EventIcon : ChecklistIcon;

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ overflow: "hidden" }}>
      <Icon fontSize="inherit" />
      <Stack sx={{ minWidth: 0, lineHeight: 1.1 }}>
        {!!line1 && (
          <Typography variant="caption" noWrap sx={{ fontWeight: 800 }}>
            {line1}
          </Typography>
        )}
        {!!line2 && (
          <Typography variant="caption" noWrap sx={{ opacity: 0.9 }}>
            {line2}
          </Typography>
        )}
      </Stack>
    </Stack>
  );
}

/* ===== Helpers para extraer datos de evento/tarea ===== */
function _pickClienteAny(src) {
  const paths = [
    (s) => s?.caso?.cliente,
    (s) => s?.cliente,
    (s) => s?.case?.client,
    (s) => s?.clienteObj,
    (s) => s?.persona,
    (s) => s?.titular,
    (s) => s?.contacto,
    (s) => s?.actor,
    (s) => s?.demandado,
    (s) => s?.party,
  ];
  for (const fn of paths) {
    const cand = fn(src);
    if (cand) {
      const label = displayCliente(cand);
      if (label) return label;
    }
  }
  const textFields = ["clienteNombre", "nombreCliente", "cliente_name", "clientName"];
  for (const k of textFields) {
    if (src?.[k]) return displayCliente(src[k]);
  }
  if (src?.caso?.clienteNombre) return displayCliente(src.caso.clienteNombre);
  if (src?.caso?.nombreCliente) return displayCliente(src.caso.nombreCliente);

  const idKeys = ["clienteId", "idCliente", "clientId", "id_client", "fkClienteId"];
  for (const k of idKeys) {
    const v = src?.[k];
    if (v != null && String(v).trim?.() !== "") return `ID ${v}`;
  }
  const casoClienteId = src?.caso?.clienteId ?? src?.case?.clientId;
  if (casoClienteId != null) return `ID ${casoClienteId}`;

  return "";
}

function _pickExpteAny(src) {
  const direct = [
    "nroExpte","nro_expte","expte","expediente","nroExpediente",
    "numeroExpediente","expedienteNumero","nro_expediente"
  ];
  for (const k of direct) {
    const v = src?.[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  const cont = src?.caso || src?.expediente || src?.carpeta || null;
  if (cont) {
    return displayExpte(cont);
  }
  const casoId = src?.casoId ?? src?.caso?.id ?? src?.caseId ?? src?.case?.id;
  if (casoId != null) return `Caso #${casoId}`;

  return "";
}

// === Normalizador de evento del Calendar → props para AgendaItemModal
function toModalItemFromCalendar(evt) {
  const r = evt && evt.resource ? evt.resource : {};
  if (!r || (r.kind !== "evento" && r.kind !== "tarea")) return null;

  if (r.kind === "evento") {
    const e = r.raw || {};

    const clienteObj = e.cliente ?? e?.caso?.cliente ?? null;
    const clienteLabel = clienteObj ? displayCliente(clienteObj) : (_pickClienteAny(e) || "");

    const expteStr =
      (e?.caso ? displayExpte(e.caso) : "") ||
      _pickExpteAny(e) ||
      r.meta?.expte ||
      r.meta?.nroExpte ||
      "";

    return {
      id: e.id,
      tipo: "evento",
      titulo: (r.meta?.tipo || e.tipo?.nombre || e.tipo?.codigo || "Evento"),
      cliente: clienteObj || clienteLabel,
      clienteNombre: clienteLabel,
      nroExpte: expteStr,
      descripcion: e.descripcion || "",
      estado: e.estado ?? null,
      ubicacion: e.ubicacion || e.lugar || "",
      fechaInicio: e.fechaInicio || null,
      fechaFin: e.fechaFin || null,
      recordatorio: e.recordatorio || null,
      todoDia: Boolean(e.allDay),
      tipoEvento: e.tipo?.nombre || e.tipo?.codigo || r.meta?.tipo || "",
      categoria: e.tipo ? { id: e.tipo.id, nombre: e.tipo.nombre || e.tipo.codigo } : null,
      adjuntos: Array.isArray(e.adjuntos) ? e.adjuntos : [],
      enlaces: [],
    };
  }

  // ----- Tarea -----
  const t = r.raw || {};
  let estadoStr = "";
  if (typeof t.estado === "string") estadoStr = t.estado;
  else if (t.estado && (t.estado.nombre || t.estado.codigo)) estadoStr = t.estado.nombre || t.estado.codigo;

  const estadoLower = (estadoStr || "").toLowerCase();
  const completada = Object.prototype.hasOwnProperty.call(t, "completada")
    ? Boolean(t.completada)
    : estadoLower === "finalizado" || estadoLower === "completada" || estadoLower === "completado";

  const clienteObj = t.cliente ?? t?.caso?.cliente ?? null;
  const clienteLabel = clienteObj ? displayCliente(clienteObj) : (_pickClienteAny(t) || "");

  const expteStr =
    (t?.caso ? displayExpte(t.caso) : "") ||
    _pickExpteAny(t) ||
    r.meta?.expte ||
    r.meta?.nroExpte ||
    "";

  return {
    id: t.id,
    tipo: "tarea",
    titulo: t.titulo || r.meta?.descripcion || "Tarea",
    cliente: clienteObj || clienteLabel,
    clienteNombre: clienteLabel,
    nroExpte: expteStr,
    descripcion: t.descripcion || "",
    completada,
    fechaLimite: t.fechaLimite || null,
    recordatorio: t.recordatorio || null,
    prioridad: t.prioridad ?? null,
    completadaAt: t.completadaAt || t.fechaCompletada || null,
    estado: t.estado != null ? t.estado : (estadoStr || "pendiente"),
    categoria: t.categoria ? { id: t.categoria.id, nombre: t.categoria.nombre } : null,
    adjuntos: Array.isArray(t.adjuntos) ? t.adjuntos : [],
    enlaces: [],
  };
}

/* ===== Diálogo para resúmenes (mobile) ===== */
function MobileSummaryDialog({ open, onClose, label, items, onPick }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" PaperProps={{ sx:{ borderRadius: 3 } }}>
      <DialogTitle>{label}</DialogTitle>
      <DialogContent dividers>
        <List disablePadding>
          {items.map((e, i) => {
            const isEv = e?.resource?.kind === "evento";
            const startTxt = formatDDMM(e.start);
            const endTxt = e.end ? ` — ${formatDDMM(e.end)}` : "";
            return (
              <ListItemButton key={e.id || i} onClick={() => onPick(e)}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {isEv ? <EventIcon /> : <ChecklistIcon />}
                </ListItemIcon>
                <ListItemText
                  primary={e.title}
                  secondary={`${startTxt}${endTxt}`}
                />
              </ListItemButton>
            );
          })}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

/* ===== Diálogo "Nuevo" (mobile) ===== */
function NewItemDialog({ open, onClose, onCreate, canCrearEvento, canCrearTarea }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" PaperProps={{ sx:{ borderRadius: 3 } }}>
      <DialogTitle>Nuevo</DialogTitle>
      <DialogContent dividers>
        <List disablePadding>
          {canCrearEvento && (
            <ListItemButton onClick={() => onCreate("evento")}>
              <ListItemIcon sx={{ minWidth: 36 }}><EventIcon /></ListItemIcon>
              <ListItemText primary="Evento" />
            </ListItemButton>
          )}
          {canCrearTarea && (
            <ListItemButton onClick={() => onCreate("tarea")}>
              <ListItemIcon sx={{ minWidth: 36 }}><ChecklistIcon /></ListItemIcon>
              <ListItemText primary="Tarea" />
            </ListItemButton>
          )}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
      </DialogActions>
    </Dialog>
  );
}

// ======= Componente =======
export default function Agenda() {
  const theme = useTheme();
  const nav = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  
  // Verificaciones de permisos
  const canViewEventos = usePermiso('EVENTOS', 'ver');
  const canViewTareas = usePermiso('TAREAS', 'ver');
  const { canCrear: canCrearEvento } = usePermisos('EVENTOS');
  const { canCrear: canCrearTarea } = usePermisos('TAREAS');
  
  const [view, setView] = useState(Views.MONTH);
  const [date, setDate] = useState(new Date());
  const [showEventos, setShowEventos] = useState(canViewEventos);
  const [showTareas, setShowTareas] = useState(canViewTareas);
  const [openPicker, setOpenPicker] = useState(false);

  // Modal estado
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Diálogo de resumen (mobile)
  theme.palette
  const [sumOpen, setSumOpen] = useState(false);
  const [sumItems, setSumItems] = useState([]);
  const [sumLabel, setSumLabel] = useState("");

  // Diálogo "Nuevo" (mobile)
  const [newOpen, setNewOpen] = useState(false);
  const [selectedSlotDate, setSelectedSlotDate] = useState(null);

  const queryClient = useQueryClient();

  const { from, to } = useMemo(() => calendarRange(view, date), [view, date]);

  // Prefill de fecha para formularios
  const defaultStart = useMemo(() => {
    const d = new Date(date);
    d.setHours(9, 0, 0, 0);
    return d;
  }, [date]);

  // Crear navegación
  const handleCreate = useCallback((kind, fechaInicio) => {
    const qs = new URLSearchParams();
    const fecha = fechaInicio || defaultStart;
    if (kind === "evento") {
      qs.set("fechaInicio", fecha.toISOString());
      nav(`/eventos/nuevo?${qs.toString()}`, { state: { from: "/agenda" } });
    } else {
      qs.set("fechaLimite", fecha.toISOString());
      nav(`/tareas/nuevo?${qs.toString()}`, { state: { from: "/agenda" } });
    }
  }, [defaultStart, nav]);

  // Eventos
  const {
    data: eventos = [],
    isLoading: evLoading,
    isFetching: evFetching,
    isError: evError,
    error: evErrObj,
  } = useQuery({
    queryKey: ["eventos", { from: from.toISOString(), to: to.toISOString(), showEventos }],
    queryFn: async ({ queryKey }) => {
      const [_k, { from, to, showEventos }] = queryKey;
      if (!showEventos) return [];
      return listEventos({ from, to });
    },
    keepPreviousData: true,
    staleTime: 60_000,
  });

  // Tareas
  const {
    data: tareasResp,
    isLoading: taLoading,
    isFetching: taFetching,
    isError: taError,
    error: taErrObj,
  } = useQuery({
    queryKey: ["tareas", { desde: from.toISOString(), hasta: to.toISOString(), showTareas }],
    queryFn: async ({ queryKey }) => {
      const [_k, { desde, hasta, showTareas }] = queryKey;
      if (!showTareas) return { data: [] };
      return listTareas({ desde, hasta, page: 1, pageSize: 500 });
    },
    keepPreviousData: true,
    staleTime: 60_000,
  });

  const tareas = useMemo(
    () => (Array.isArray(tareasResp?.data) ? tareasResp.data : []),
    [tareasResp]
  );

  const baseEvents = useMemo(
    () => buildCalendarEvents({ eventos, tareas, showEventos, showTareas }),
    [eventos, tareas, showEventos, showTareas]
  );

  const rbcEvents = useMemo(() => {
    if (isMobile && (view === Views.WEEK || view === Views.MONTH)) {
      return aggregateForMobileSummaries(view, baseEvents);
    }
    return baseEvents;
  }, [baseEvents, isMobile, view]);

  // Navegación
  const handleNavigate = useCallback(
    (action) => {
      if (action === "TODAY") setOpenPicker(true);
      else if (action === "PREV") {
        if (view === Views.MONTH) setDate(addDays(startOfMonth(date), -1));
        else if (view === Views.WEEK) setDate(addDays(date, -7));
        else setDate(addDays(date, -1));
      } else if (action === "NEXT") {
        if (view === Views.MONTH) setDate(addDays(endOfMonth(date), 1));
        else if (view === Views.WEEK) setDate(addDays(date, 7));
        else setDate(addDays(date, 1));
      }
    },
    [date, view]
  );

  const handlePickFromSummary = useCallback((ev) => {
    const item = toModalItemFromCalendar(ev);
    if (!item) return;
    setSumOpen(false);
    setSelectedItem(item);
    setOpenDetail(true);
  }, []);

  // Click en evento/tarea → abrir modal
  const onSelectEvent = useCallback((evt) => {
    const resource = evt?.resource;
    if (!resource) return;

    // Globos resumen (mobile)
    if (resource.kind === "summary") {
      const label = resource.summaryOf === "evento" ? "Eventos" : "Tareas";
      setSumLabel(`${label} (${resource.items.length})`);
      setSumItems(resource.items);
      setSumOpen(true);
      return;
    }

    const item = toModalItemFromCalendar(evt);
    if (!item) return;
    setSelectedItem(item);
    setOpenDetail(true);
  }, []);

  const eventPropGetter = useCallback(
  (event) => {
    // Globos de resumen (mobile)
    if (event?.resource?.kind === "summary") {
      const isEventos = event?.resource?.summaryOf === "evento";
      const bg = isEventos ? theme.palette.secondary.main : theme.palette.success.main;
      const bd = isEventos ? theme.palette.secondary.dark : theme.palette.success.dark;
      const fg = theme.palette.getContrastText(bg);
      return {
        style: {
          backgroundColor: bg,
          color: fg,
          border: `1px solid ${bd}`,
          borderRadius: 999,
          minHeight: 24,
          minWidth: 30,
          padding: "0 8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: "0.8rem",
          lineHeight: 1,
          boxShadow: "none",
        },
      };
    }

    // Eventos normales
    const isTarea = event?.resource?.kind === "tarea";
    const bg = isTarea ? theme.palette.success.main : theme.palette.secondary.main;
    const bd = isTarea ? theme.palette.success.dark : theme.palette.secondary.dark;

    return {
      style: {
        padding: "1px 4px",
        lineHeight: 1.2,
        fontSize: "0.72rem",
        minHeight: 18,
        borderRadius: 6,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        gap: 4,
        cursor: "pointer",
        backgroundColor: bg,
        border: `1px solid ${bd}`,
        color: theme.palette.getContrastText(bg),
      },
    };
  },
  [theme]
);


  const loading = evLoading || taLoading;
  const fetching = evFetching || taFetching;
  const isError = evError || taError;
  const errorMsg =
    evErrObj?.message ||
    taErrObj?.message ||
    "Ocurrió un error al cargar la agenda.";

  // ====== Header pieces ======
  const Switches = (
    <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ flexWrap: "wrap" }}>
      {canViewEventos && (
        <Tooltip title="Mostrar/Ocultar eventos">
          <FormControlLabel
            control={
              <Switch
                checked={showEventos}
                onChange={(e) => setShowEventos(e.target.checked)}
                color="secondary"
                sx={(t) => ({
                  "& .MuiSwitch-track": { backgroundColor: t.palette.mode === "dark" ? t.palette.grey[700] : undefined },
                  "& .Mui-checked + .MuiSwitch-track": { backgroundColor: t.palette.mode === "dark" ? t.palette.secondary.dark : undefined },
                })}
              />
            }
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <EventIcon fontSize="small" /> <span>Eventos</span>
              </Stack>
            }
          />
        </Tooltip>
      )}

      {canViewTareas && (
        <Tooltip title="Mostrar/Ocultar tareas">
          <FormControlLabel
            control={
              <Switch
                checked={showTareas}
                onChange={(e) => setShowTareas(e.target.checked)}
                color="secondary"
                sx={(t) => ({
                  "& .MuiSwitch-track": { backgroundColor: t.palette.mode === "dark" ? t.palette.grey[700] : undefined },
                  "& .Mui-checked + .MuiSwitch-track": { backgroundColor: t.palette.mode === "dark" ? t.palette.secondary.dark : undefined },
                })}
              />
            }
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <ChecklistIcon fontSize="small" /> <span>Tareas</span>
              </Stack>
            }
          />
        </Tooltip>
      )}
    </Stack>
  );

  // Exportar a Excel
  const handleExportExcel = useCallback(() => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet de Eventos
      if (showEventos && eventos.length > 0) {
        const eventosData = eventos.map((e) => ({
          Tipo: e.tipo?.nombre || e.tipo?.codigo || "",
          Descripción: e.descripcion || "",
          "Fecha Inicio": e.fechaInicio ? format(new Date(e.fechaInicio), "dd/MM/yyyy HH:mm", { locale: es }) : "",
          "Fecha Fin": e.fechaFin ? format(new Date(e.fechaFin), "dd/MM/yyyy HH:mm", { locale: es }) : "",
          TodoDía: e.allDay ? "Sí" : "No",
          Ubicación: e.ubicacion || "",
          Cliente: e.cliente ? displayCliente(e.cliente) : "",
          Expediente: e.caso ? displayExpte(e.caso) : "",
          Estado: e.estado?.nombre || "",
        }));
        const ws1 = XLSX.utils.json_to_sheet(eventosData);
        XLSX.utils.book_append_sheet(wb, ws1, "Eventos");
      }

      // Sheet de Tareas
      if (showTareas && tareas.length > 0) {
        const tareasData = tareas.map((t) => ({
          Título: t.titulo || "",
          Descripción: t.descripcion || "",
          "Fecha Límite": t.fechaLimite ? format(new Date(t.fechaLimite), "dd/MM/yyyy", { locale: es }) : "",
          Recordatorio: t.recordatorio ? format(new Date(t.recordatorio), "dd/MM/yyyy HH:mm", { locale: es }) : "",
          Prioridad: t.prioridad?.nombre || "",
          Estado: t.estado?.nombre || "",
          Completada: t.completada ? "Sí" : "No",
          "Fecha Completada": t.completadaAt ? format(new Date(t.completadaAt), "dd/MM/yyyy", { locale: es }) : "",
          Cliente: t.cliente ? displayCliente(t.cliente) : "",
          Expediente: t.caso ? displayExpte(t.caso) : "",
        }));
        const ws2 = XLSX.utils.json_to_sheet(tareasData);
        XLSX.utils.book_append_sheet(wb, ws2, "Tareas");
      }

      if (wb.SheetNames.length === 0) {
        enqueueSnackbar("No hay datos para exportar", { variant: "warning" });
        return;
      }

      XLSX.writeFile(wb, `Agenda_${format(new Date(), "yyyyMMdd")}.xlsx`);
      enqueueSnackbar("Exportación exitosa", { variant: "success" });
    } catch (e) {
      console.error("Error al exportar:", e);
      enqueueSnackbar("Error al exportar a Excel", { variant: "error" });
    }
  }, [eventos, tareas, showEventos, showTareas, enqueueSnackbar]);

  const ExportButton = (
    <Tooltip title="Exportar a Excel">
      <IconButton onClick={handleExportExcel} color="secondary">
        <DownloadIcon />
      </IconButton>
    </Tooltip>
  );

  const Buttons = (
    <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ flexWrap: "wrap" }}>
      {ExportButton}
      
      <LocalizationProvider
        dateAdapter={AdapterDateFns}
        adapterLocale={es}
        localeText={esES.components.MuiLocalizationProvider.defaultProps.localeText}
      >
        <Tooltip title="Elegir fecha">
          <IconButton onClick={() => setOpenPicker(true)}>
            <TodayIcon />
          </IconButton>
        </Tooltip>

        <DatePicker
          open={openPicker}
          onClose={() => setOpenPicker(false)}
          value={date}
          onChange={(newDate) => { if (newDate) setDate(newDate); }}
          desktopModeMediaQuery="all"
          openTo="day"
          views={["year", "month", "day"]}
          slotProps={{
            actionBar: {
              actions: ["today", "cancel", "accept"],
              sx: (theme) => ({
                "& .MuiButton-root": {
                  textTransform: "none",
                  fontWeight: 600,
                  ...(theme.palette.mode === "dark" && { color: "#fff" }),
                },
              }),
            },
            textField: { style: { display: "none" } },
            layout: { sx: { p: 1 } },
          }}
        />
      </LocalizationProvider>

      <Tooltip title="Anterior">
        <IconButton onClick={() => handleNavigate("PREV")}><ChevronLeftIcon /></IconButton>
      </Tooltip>
      <Tooltip title="Siguiente">
        <IconButton onClick={() => handleNavigate("NEXT")}><ChevronRightIcon /></IconButton>
      </Tooltip>

      <ToggleButtonGroup size="small" exclusive value={view} onChange={(_e, v) => v && setView(v)}>
        <ToggleButton value={Views.MONTH}>Mes</ToggleButton>
        <ToggleButton value={Views.WEEK}>Semana</ToggleButton>
        <ToggleButton value={Views.DAY}>Día</ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );

  // Acciones de creación (desktop: 2 botones / mobile: 1 "Nuevo" con diálogo)
  const CreateButtons = (
    isMobile ? (
      (canCrearEvento || canCrearTarea) ? (
        <Button
          variant="contained"
          onClick={() => setNewOpen(true)}
          sx={{ mt: { xs: 1, sm: 0 } }}
        >
          Nuevo
        </Button>
      ) : null
    ) : (
      <Stack direction="row" spacing={1}>
        {canCrearEvento && (
          <Button
            variant="contained"
            startIcon={<EventIcon />}
            onClick={() => handleCreate("evento")}
          >
            Nuevo evento
          </Button>
        )}
        {canCrearTarea && (
          <Button
            variant="contained"
            color="success"
            startIcon={<ChecklistIcon />}
            onClick={() => handleCreate("tarea")}
          >
            Nueva tarea
          </Button>
        )}
      </Stack>
    )
  );

  const DateLabel = (
    <Typography variant={isMobile ? "subtitle2" : "subtitle1"} sx={{ fontWeight: 600, textAlign: "center" }}>
      {format(from, "d LLL", { locale: es })} – {format(to, "d LLL yyyy", { locale: es })}
    </Typography>
  );

  return (
    <Paper
      elevation={0}
      sx={{
        mt: 2,
        p: 2,
        borderRadius: 3,
        border: (t) => `1px solid ${alpha(t.palette.text.primary, 0.1)}`,
        bgcolor: (t) => (t.palette.mode === "dark" ? "background.paper" : "#fff"),
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        minHeight: 480,
      }}
    >
      {/* Estilo tipo Google Calendar + ajustes pedidos */}
      <GlobalStyles
        styles={(t) => {
          const grid = alpha(t.palette.text.primary, t.palette.mode === "dark" ? 0.22 : 0.14);
          const subGrid = alpha(t.palette.text.primary, t.palette.mode === "dark" ? 0.16 : 0.1);
          const todayBg = alpha(t.palette.secondary.main, t.palette.mode === "dark" ? 0.22 : 0.12);
          const offRangeBg = t.palette.mode === "dark" ? alpha(t.palette.common.white, 0.04) : alpha(t.palette.common.black, 0.04);
          return {
            ".rbc-calendar": { backgroundColor: t.palette.background.default, borderRadius: 12 },
            ".rbc-header": {
              fontSize: 13, fontWeight: 700, letterSpacing: ".02em", color: t.palette.text.secondary,
              borderBottom: `1px solid ${grid}`, padding: "8px 6px", textTransform: "capitalize",
            },
            ".rbc-month-view, .rbc-time-view": { border: `1px solid ${grid}`, borderRadius: 12, overflow: "hidden" },
            ".rbc-today": { backgroundColor: todayBg },
            ".rbc-off-range-bg, .rbc-off-range": { backgroundColor: offRangeBg, color: t.palette.text.disabled },

            ".rbc-month-view .rbc-date-cell": { textAlign: "center", padding: "6px 0 0" },
            ".rbc-month-view .rbc-date-cell > a, .rbc-month-view .rbc-date-cell > button": {
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28, borderRadius: 14, fontWeight: 700, color: t.palette.text.secondary,
            },
            ".rbc-month-view .rbc-day-bg.rbc-today .rbc-date-cell > a, .rbc-month-view .rbc-day-bg.rbc-today .rbc-date-cell > button": {
              backgroundColor: t.palette.secondary.main, color: t.palette.getContrastText(t.palette.secondary.main),
            },

            ".rbc-month-row + .rbc-month-row, .rbc-day-bg + .rbc-day-bg": {
              borderTop: `1px solid ${subGrid}`, borderLeft: `1px solid ${subGrid}`,
            },

            ".rbc-time-content": { borderTop: `1px solid ${grid}` },
            ".rbc-time-content > * > .rbc-day-slot .rbc-time-slot": { borderTop: `1px solid ${subGrid}` },

            ".rbc-time-gutter, .rbc-timeslot-group": { borderColor: subGrid },
            ".rbc-time-gutter .rbc-timeslot-group": { borderRight: `1px solid ${grid}` },
            ".rbc-time-gutter .rbc-time-slot": { 
              color: t.palette.text.secondary, 
              fontSize: 12,
            },

            // Ocultar la fila "All Day" si está vacía o siempre
            ".rbc-allday-cell": { display: "none !important" },

            ".rbc-event": {
              borderRadius: 8, 
              padding: "4px 8px",
              minHeight: "24px",
              boxShadow: t.palette.mode === "dark" ? "inset 0 0 0 1px rgba(255,255,255,.06)" : "inset 0 0 0 1px rgba(0,0,0,.06)",
              transition: "transform .08s ease, box-shadow .12s ease, opacity .12s ease",
            },
            ".rbc-event:hover": {
              transform: "translateY(-1px)",
              boxShadow: t.palette.mode === "dark" ? "0 2px 10px rgba(0,0,0,.5)" : "0 2px 10px rgba(0,0,0,.15)",
              opacity: 0.95,
              zIndex: 10,
            },
            ".rbc-event-label": { 
              opacity: 0.85, 
              fontWeight: 700, 
              marginRight: 6,
              fontSize: "0.75rem",
            },
            ".rbc-event-content": { 
              fontWeight: 700,
              fontSize: "0.875rem",
              lineHeight: 1.3,
            },
            ".rbc-show-more": {
              backgroundColor: alpha(t.palette.secondary.main, 0.08),
              border: `1px solid ${alpha(t.palette.secondary.main, 0.25)}`,
              color: t.palette.secondary.main, 
              borderRadius: 999, 
              padding: "1px 6px", 
              fontWeight: 800,
              fontSize: "0.75rem",
            },
          };
        }}
      />

      {/* Header responsive */}
      {isMobile ? (
        <Stack spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 0.5 }}>
          {Switches}
          {Buttons}
          {DateLabel}
          {CreateButtons}
        </Stack>
      ) : (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
          <Box sx={{ display: "flex", alignItems: "center" }}>{Switches}</Box>
          <Box sx={{ display: "flex", alignItems: "center" }}>{DateLabel}</Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {Buttons}
            {CreateButtons}
          </Stack>
        </Stack>
      )}

      {(fetching || loading) && <LinearProgress sx={{ borderRadius: 1 }} />}

      {isError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {errorMsg}
        </Alert>
      )}

      <Box sx={{ position: "relative", flex: 1, minHeight: 400, mt: 0.5 }}>
        {loading && (
          <Stack
            alignItems="center"
            justifyContent="center"
            sx={{
              position: "absolute",
              inset: 0,
              bgcolor: (t) => t.palette.action.disabledBackground,
              zIndex: 2,
              borderRadius: 2,
            }}
          >
            <CircularProgress />
          </Stack>
        )}

        <Calendar
          localizer={localizer}
          culture="es"
          events={rbcEvents}
          startAccessor="start"
          endAccessor="end"
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          view={view}
          date={date}
          onView={(v) => setView(v)}
          onNavigate={(d) => setDate(d)}
          onRangeChange={() => {}}
          selectable
          onSelectEvent={onSelectEvent}
          onSelectSlot={(slotInfo) => {
            // Abrir modal para crear evento/tarea al hacer click en un slot vacío
            if (!slotInfo.slots.length) return;
            
            // Obtener la fecha/hora del slot seleccionado
            const slotStart = slotInfo.slots[0];
            
            // Guardar la fecha y abrir el dialog de selección
            setSelectedSlotDate(slotStart);
            setNewOpen(true);
          }}
          popup
          toolbar={false}
          scrollToTime={new Date(0, 0, 0, 8, 0, 0)}
          dayLayoutAlgorithm={view === Views.DAY ? "no-overlap" : "overlap"}
          step={60}
          timeslots={1}
          style={{ height: "75vh", minHeight: 500, borderRadius: 8, padding: 4 }}
          eventPropGetter={eventPropGetter}
          components={{
            event: (props) =>
              props?.event?.resource
                ? <CustomEvent {...props} view={view} isMobile={isMobile} />
                : null,
          }}
          messages={{
            today: "Hoy",
            previous: "Anterior",
            next: "Siguiente",
            month: "Mes",
            week: "Semana",
            day: "Día",
            agenda: "Agenda",
            date: "Fecha",
            time: "Hora",
            event: "Evento",
            noEventsInRange: "Sin eventos en este rango.",
            showMore: (total) => `+${total} más`,
          }}
        />
      </Box>

      {/* Diálogo de resumen (mobile) */}
      <MobileSummaryDialog
        open={sumOpen}
        onClose={() => setSumOpen(false)}
        label={sumLabel}
        items={sumItems}
        onPick={handlePickFromSummary}
      />

      {/* Diálogo NUEVO (mobile y desktop click en slot) */}
      <NewItemDialog
        open={newOpen}
        onClose={() => {
          setNewOpen(false);
          setSelectedSlotDate(null);
        }}
        onCreate={(kind) => {
          setNewOpen(false);
          handleCreate(kind, selectedSlotDate);
          setSelectedSlotDate(null);
        }}
        canCrearEvento={canCrearEvento}
        canCrearTarea={canCrearTarea}
      />

      {/* Modal de detalle */}
      {openDetail && selectedItem && (
        <AgendaItemModal
          open={openDetail}
          onClose={() => setOpenDetail(false)}
          item={selectedItem}
          loading={false}
          onEdit={(item) => {
            setOpenDetail(false);
            if (item.tipo === "evento") nav(`/eventos/editar/${item.id}`, { state: { from: "/agenda" } });
            else nav(`/tareas/editar/${item.id}`, { state: { from: "/agenda" } });
          }}
          onDelete={async (item) => {
            try {
              if (item.tipo === "evento") {
                await api.delete(`/eventos/${item.id}`);
              } else {
                await api.delete(`/tareas/${item.id}`);
              }
              enqueueSnackbar(`${item.tipo === "evento" ? "Evento" : "Tarea"} eliminado/a`, { variant: "success" });
              setOpenDetail(false);
              queryClient.invalidateQueries({ queryKey: ["eventos"] });
              queryClient.invalidateQueries({ queryKey: ["tareas"] });
            } catch (e) {
              const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "No se pudo eliminar";
              enqueueSnackbar(msg, { variant: "error" });
            }
          }}
          onToggleEstado={async (item) => {
            try {
              await updateTarea(Number(item.id), {
                completada: true,
                completadaAt: new Date().toISOString(),
              });
              enqueueSnackbar("Tarea marcada como completada", { variant: "success" });
              setOpenDetail(false);
              // Refrescar la grilla
              queryClient.invalidateQueries({ queryKey: ["tareas"] });
            } catch (e) {
              const msg =
                e?.response?.data?.publicMessage ||
                e?.response?.data?.message ||
                "No se pudo completar la tarea";
              enqueueSnackbar(msg, { variant: "error" });
            }
          }}

        />
      )}
    </Paper>
  );
}
