// src/components/AgendaItemModal.jsx
import { useEffect, useMemo, useState } from "react";
import { usePermiso, usePermisos } from "../auth/usePermissions";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Typography,
  Stack,
  Button,
  Box,
  Divider,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ReplayIcon from "@mui/icons-material/Replay";
import LinkIcon from "@mui/icons-material/Link";
import AttachmentIcon from "@mui/icons-material/Attachment";
import EventIcon from "@mui/icons-material/Event";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import ConfirmDialog from "./ConfirmDialog";

// >>> NUEVO: API de subtareas (tareas)
import {
  listSubtareas,
  toggleSubtarea,
  completarTodasSubtareas,
} from "../api/tareas";

/**
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - item: {
 *     id, tipo: 'evento'|'tarea', titulo, descripcion,
 *     fechaInicio?, fechaFin?, todoDia?, ubicacion?,
 *     prioridad?, estado?,
 *     cliente?: object|string,
 *     clienteNombre?: string,
 *     nroExpte?: string,
 *     recordatorio?: Date|string|null,
 *     adjuntos?: [{id,nombre,url?}], enlaces?: [{label?,url}]
 *   } | null
 * - loading?: boolean
 * - onEdit?: (item) => void
 * - onDelete?: (item) => Promise<void> | void
 * - onToggleEstado?: (item) => Promise<void> | void
 */
export default function AgendaItemModal({
  open,
  onClose,
  item,
  loading = false,
  onEdit,
  onDelete,
  onToggleEstado,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [busy, setBusy] = useState(false);

  // Verificaciones de permisos
  const canEditarEvento = usePermiso('EVENTOS', 'editar');
  const canEliminarEvento = usePermiso('EVENTOS', 'eliminar');
  const canEditarTarea = usePermiso('TAREAS', 'editar');
  const canEliminarTarea = usePermiso('TAREAS', 'eliminar');
  const canEditar = item?.tipo === 'evento' ? canEditarEvento : canEditarTarea;
  const canEliminar = item?.tipo === 'evento' ? canEliminarEvento : canEliminarTarea;

  // confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState("");

  useEffect(() => setBusy(loading), [loading]);

  const isEvento = item?.tipo === "evento";
  const isTarea = item?.tipo === "tarea";

  // ===== Subtareas (cuando es Tarea) =====
  const [subLoading, setSubLoading] = useState(false);
  const [subItems, setSubItems] = useState([]); // {id, titulo, descripcion, completada, ...}
  const [subBusyId, setSubBusyId] = useState(null);

  // Cargar subtareas al abrir el modal o cambiar de item
  useEffect(() => {
    let alive = true;
    async function load() {
      if (!open || !isTarea || !item?.id) {
        if (alive) setSubItems([]);
        return;
      }
      setSubLoading(true);
      try {
        const rows = await listSubtareas(item.id);
        if (alive) setSubItems(Array.isArray(rows) ? rows : []);
      } finally {
        if (alive) setSubLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [open, isTarea, item?.id]);

  const pendingCount = useMemo(
    () => subItems.filter((s) => !s.completada).length,
    [subItems]
  );

  const handleToggleSub = async (sub) => {
    if (!item?.id || !sub?.id) return;
    setSubBusyId(sub.id);
    try {
      await toggleSubtarea(item.id, sub.id);
      const rows = await listSubtareas(item.id);
      setSubItems(Array.isArray(rows) ? rows : []);
    } finally {
      setSubBusyId(null);
    }
  };

  const handleCompletarTodas = async () => {
    if (!item?.id) return;
    setSubLoading(true);
    try {
      await completarTodasSubtareas(item.id);
      const rows = await listSubtareas(item.id);
      setSubItems(Array.isArray(rows) ? rows : []);
    } finally {
      setSubLoading(false);
    }
  };

  // Acciones
  const handleEdit = () => onEdit?.(item);

  const askDelete = () => {
    const entidad = isEvento ? "el evento" : "la tarea";
    const ref =
      (isEvento ? (item?.nroExpte || item?.titulo) : (item?.titulo || item?.nroExpte)) ||
      `#${item?.id ?? ""}`;
    setConfirmMsg(`¿Seguro que querés eliminar ${entidad} “${ref}”? Esta acción no se puede deshacer.`);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!onDelete) return setConfirmOpen(false);
    setBusy(true);
    try {
      await onDelete(item);
      setConfirmOpen(false);
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async () => {
    if (!onToggleEstado) return;
    setBusy(true);
    try {
      await onToggleEstado(item);
    } finally {
      setBusy(false);
    }
  };

  const TitleIcon = isEvento ? EventIcon : TaskAltIcon;
  const showAdjuntos = Array.isArray(item?.adjuntos) && item.adjuntos.length > 0;
  const showEnlaces = Array.isArray(item?.enlaces) && item.enlaces.length > 0;

  const modalTitle = isEvento
    ? (item?.tipoEvento || item?.tipo || "Evento")
    : (item?.titulo || "Tarea");

  // Cliente visible según reglas
  const clienteVisible =
    displayCliente(item?.cliente) ||
    (typeof item?.clienteNombre === "string" ? item.clienteNombre : "");

  return (
    <>
      <Dialog
        open={!!open}
        onClose={onClose}
        fullWidth
        maxWidth="sm"
        aria-labelledby="agenda-item-title"
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle id="agenda-item-title" sx={{ pr: 7, py: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.2} maxWidth="100%">
            <TitleIcon fontSize="small" />
            <Typography
              variant={isMobile ? "subtitle1" : "h6"}
              component="div"
              sx={{ fontWeight: 700 }}
              noWrap
              title={modalTitle}
            >
              {modalTitle}
            </Typography>
          </Stack>
          <IconButton aria-label="Cerrar" onClick={onClose} sx={{ position: "absolute", right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 1.5 }}>
          {/* ====== EVENTOS ====== */}
          {isEvento && (
            <Stack spacing={1.25}>
              <InfoRowAlways label="Cliente." value={clienteVisible} />
              <InfoRowAlways label="Expte." value={item?.nroExpte} />
              <InfoRowAlways label="Descripcion." value={item?.descripcion} multiline />
              <InfoRowAlways label="Estado." value={labelEstado(item?.estado)} />
              <InfoRowAlways label="Ubicacion." value={item?.ubicacion} />
              <InfoRowAlways label="Fecha Inicio." value={formatDateTime(item?.fechaInicio, !!item?.todoDia)} />
              <InfoRowAlways label="Fecha fin." value={formatDateTime(item?.fechaFin, !!item?.todoDia)} />
              <InfoRowAlways label="Fecha recordatorio." value={formatDateTime(item?.recordatorio)} />
            </Stack>
          )}

          {/* ====== TAREAS ====== */}
          {isTarea && (
            <>
              <Stack spacing={1.25}>
                <InfoRowAlways label="Cliente." value={clienteVisible} />
                <InfoRowAlways label="Expte." value={item?.nroExpte} />
                <InfoRowAlways label="Descripcion." value={item?.descripcion} multiline />
                <InfoRowAlways label="Completada." value={formatBool(item?.completada)} />
                <InfoRowAlways label="Fecha limite." value={formatDateTime(item?.fechaLimite)} />
                <InfoRowAlways label="Fecha recordatorio." value={formatDateTime(item?.recordatorio)} />
              </Stack>

              {/* Subtareas */}
              <Box mt={2} />
              <Divider />
              <Box mt={2} />

              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Subtareas {subLoading ? "…" : `(${subItems.length})`}
                </Typography>
                {!!pendingCount && (
                  <Button size="small" variant="text" onClick={handleCompletarTodas} disabled={subLoading}>
                    Completar todas ({pendingCount})
                  </Button>
                )}
              </Stack>

              {/* Desktop listado / Mobile cards */}
              <Box sx={{ display: "grid", gap: isDesktop ? 0 : 1 }}>
                {subItems.length === 0 && !subLoading && (
                  <Typography variant="body2" sx={{ opacity: 0.7 }}>
                    No hay subtareas.
                  </Typography>
                )}

                {subItems.map((s, idx) =>
                  isDesktop ? (
                    // ===== Listado (desktop)
                    <Box
                      key={s.id}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "auto 2fr 3fr",
                        alignItems: "center",
                        gap: 1,
                        py: 1,
                        borderBottom: (t) => `1px solid ${t.palette.divider}`,
                      }}
                    >
                      <Box sx={{ px: 0.5 }}>
                        <input
                          type="checkbox"
                          checked={!!s.completada}
                          disabled={subLoading || subBusyId === s.id}
                          onChange={() => handleToggleSub(s)}
                        />
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          textDecoration: s.completada ? "line-through" : "none",
                          color: s.completada ? "text.disabled" : "text.primary",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={s.titulo}
                      >
                        {s.titulo}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "text.secondary",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={s.descripcion || ""}
                      >
                        {s.descripcion || "—"}
                      </Typography>
                    </Box>
                  ) : (
                    // ===== Cards (mobile)
                    <Box
                      key={s.id}
                      sx={{
                        border: (t) => `1px solid ${t.palette.divider}`,
                        borderRadius: 2,
                        p: 1.2,
                        display: "grid",
                        gap: 0.75,
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <input
                          type="checkbox"
                          checked={!!s.completada}
                          disabled={subLoading || subBusyId === s.id}
                          onChange={() => handleToggleSub(s)}
                        />
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, textDecoration: s.completada ? "line-through" : "none" }}
                        >
                          {s.titulo}
                        </Typography>
                      </Stack>
                      {!!s.descripcion && (
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          {s.descripcion}
                        </Typography>
                      )}
                    </Box>
                  )
                )}
              </Box>
            </>
          )}

          {/* Enlaces */}
          {showEnlaces && (
            <>
              <Box mt={2} />
              <Divider />
              <Box mt={2} />
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>
                Enlaces
              </Typography>
              <Stack direction="column" spacing={0.75}>
                {item.enlaces.map((e, idx) => (
                  <Stack key={idx} direction="row" spacing={1} alignItems="center">
                    <LinkIcon fontSize="small" />
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => window.open(e.url, "_blank", "noopener")}
                      sx={{ textTransform: "none" }}
                    >
                      {e.label || e.url}
                    </Button>
                  </Stack>
                ))}
              </Stack>
            </>
          )}

          {/* Adjuntos */}
          {showAdjuntos && (
            <>
              <Box mt={2} />
              <Divider />
              <Box mt={2} />
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>
                Adjuntos
              </Typography>
              <Stack direction="column" spacing={0.75}>
                {item.adjuntos.map((a) => (
                  <Stack key={a.id} direction="row" spacing={1} alignItems="center">
                    <AttachmentIcon fontSize="small" />
                    {a.url ? (
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => window.open(a.url, "_blank", "noopener")}
                        sx={{ textTransform: "none" }}
                      >
                        {a.nombre || `Adjunto ${a.id}`}
                      </Button>
                    ) : (
                      <Typography variant="body2">
                        {a.nombre || `Adjunto ${a.id}`}
                      </Typography>
                    )}
                  </Stack>
                ))}
              </Stack>
            </>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: 2,
            py: 1.5,
            gap: 1,
            flexWrap: "wrap",
            justifyContent: isMobile ? "space-between" : "flex-end",
          }}
        >
          {isTarea && (
            <Tooltip
              title={
                item?.completada || safeLower(item?.estado) === "finalizado"
                  ? "La tarea ya está completada"
                  : "Marcar como realizada"
              }
            >
              <span>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<CheckCircleIcon />}
                  color="success"
                  onClick={handleToggle}
                  disabled={busy || item?.completada || safeLower(item?.estado) === "finalizado"}
                >
                  {item?.completada || safeLower(item?.estado) === "finalizado"
                    ? "Completada"
                    : "Completar"}
                </Button>
              </span>
            </Tooltip>
          )}

          <Box flex={1} />

          {canEditar && (
            <Tooltip title="Editar">
              <span>
                <Button
                  size="small"
                  variant="outlined"
                  color="info"
                  startIcon={<EditIcon />}
                  onClick={handleEdit}
                  disabled={busy}
                  sx={{ fontWeight: 700 }}
                >
                  Editar
                </Button>
              </span>
            </Tooltip>
          )}

          {canEliminar && (
            <Tooltip title="Eliminar">
              <span>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={askDelete}
                  disabled={busy}
                >
                  Eliminar
                </Button>
              </span>
            </Tooltip>
          )}

          <Button size="small" variant="contained" onClick={onClose}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmación de eliminación */}
      <ConfirmDialog
        open={confirmOpen}
        title={isEvento ? "Eliminar evento" : "Eliminar tarea"}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        cancelText="Cancelar"
        confirmText="Eliminar"
        confirmColor="error"
        description={confirmMsg}
      >
        <Typography sx={{ mt: 0.5 }}>{confirmMsg}</Typography>
      </ConfirmDialog>
    </>
  );
}

/* ========================= Helpers ========================= */

// Muestra razón social si existe; si no, Apellido + Nombre.
function displayCliente(cli) {
  if (!cli) return "";
  if (typeof cli === "string") return cli.trim();

  const razon =
    cli.razonSocial ??
    cli.razon_social ??
    cli.razon ??
    cli.nombreFantasia ??
    cli.nombre_fantasia;
  if (razon && String(razon).trim()) return String(razon).trim();

  const apellido = cli.apellido ?? cli.lastName ?? "";
  const nombre = cli.nombre ?? cli.firstName ?? "";
  const fisica = [apellido, nombre].filter(Boolean).join(" ").trim();
  if (fisica) return fisica;

  const full =
    cli.apellidoNombre ?? cli.nombreCompleto ?? cli.fullName ?? cli.displayName ?? "";
  if (full && String(full).trim()) return String(full).trim();

  if (cli.id != null) return `ID ${cli.id}`;
  return "";
}

function normalizeText(v) {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const guess = v.nombre || v.codigo || v.estado || v.valor || v.value || "";
  return typeof guess === "string" ? guess.trim() : "";
}
function safeLower(v) { return normalizeText(v).toLowerCase(); }
function capitalize(v) {
  const s = normalizeText(v);
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function labelEstado(val) {
  const key = safeLower(val);
  switch (key) {
    case "pendiente":   return "Pendiente";
    case "en_proceso":  return "En proceso";
    case "finalizado":  return "Finalizado";
    case "cancelado":   return "Cancelado";
    default:            return capitalize(key);
  }
}

function formatDateTime(value, allDay = false) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  if (allDay) {
    return new Intl.DateTimeFormat("es-AR", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  }
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function InfoRowAlways({ label, value, multiline = false }) {
  const str = (() => {
    if (value == null) return "—";
    if (typeof value === "string") return value.trim() || "—";
    return String(value);
  })();

  return (
    <Stack direction="row" spacing={1} alignItems="flex-start">
      <Typography variant="body2" sx={{ minWidth: 140, color: "text.secondary" }}>
        {label}
      </Typography>
      {multiline ? (
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{str}</Typography>
      ) : (
        <Typography variant="body2">{str}</Typography>
      )}
    </Stack>
  );
}

function formatBool(v) {
  if (v == null) return "";
  return v ? "Sí" : "No";
}
