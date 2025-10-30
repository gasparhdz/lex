// src/components/detalle-caso/CasoTareas.jsx
import React, { useMemo } from "react";
import {
  List,
  ListItem,
  ListItemButton,
  Typography,
  Chip,
  Stack,
  Box,
  Tooltip,
  IconButton,
  useMediaQuery,
  Alert,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import AddIcon from "@mui/icons-material/Add";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SectionCard from "../SectionCard"; // <- ruta correcta desde detalle-caso
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

/** Color del chip “estado” según completada/vencida */
const estadoChipColor = ({ completada, vencida }) => {
  if (completada) return "success";
  if (vencida) return "error";
  return "info";
};

/** Rank de prioridad para ordenar */
const prioridadRank = (nombre = "", codigo = "") => {
  const n = `${nombre} ${codigo}`.toLowerCase();
  if (/(alta|high|urgent|urgente)/.test(n)) return 0;
  if (/(media|mid|normal)/.test(n)) return 1;
  if (/(baja|low)/.test(n)) return 2;
  return 3;
};

/** Color visual del chip de prioridad */
const prioridadColor = (nombre = "", codigo = "") => {
  const r = prioridadRank(nombre, codigo);
  if (r === 0) return "error";
  if (r === 1) return "warning";
  return "default";
};

/* ===================== ROWS ===================== */
function RowDesktop({ t, onEdit, onDetail }) {
  const estadoColor = estadoChipColor({ completada: t.completada, vencida: t.vencida });

  return (
    <ListItem
      disablePadding
      sx={{
        "& .row-actions": { opacity: 0, transition: "opacity 120ms ease" },
        "&:hover .row-actions": { opacity: 1 },
      }}
    >
      {/* ❗️Sin onClick: la navegación va solo por botones */}
      <ListItemButton>
        <Stack direction="row" spacing={1} sx={{ width: "100%", alignItems: "center" }}>
          {/* Ícono */}
          <Box
            sx={{
              color: (th) => th.palette.text.secondary,
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <AssignmentTurnedInOutlinedIcon fontSize="small" />
          </Box>

          {/* Título + meta + acciones a la derecha */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ gap: 1 }}
            >
              {/* Título */}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.2,
                  minWidth: 0,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  textDecoration: t.completada ? "line-through" : "none",
                  opacity: t.completada ? 0.7 : 1,
                }}
                title={t.titulo || "Tarea"}
              >
                {t.titulo || "Tarea"}
              </Typography>

              {/* Meta + Acciones */}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <AccessTimeOutlinedIcon sx={{ fontSize: 16, opacity: 0.8 }} />
                  <Typography
                    variant="caption"
                    color={
                      t.completada
                        ? "text.secondary"
                        : t.vencida
                        ? "error.main"
                        : "text.secondary"
                    }
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    Vence: {t.fechaTxt}
                  </Typography>
                </Stack>

                {t.prioridadNombre && (
                  <Chip
                    size="small"
                    label={t.prioridadNombre}
                    color={prioridadColor(t.prioridadNombre, t.prioridadCodigo)}
                    variant="outlined"
                    sx={{ height: 22 }}
                  />
                )}

                <Chip
                  size="small"
                  label={t.completada ? "Completada" : t.vencida ? "Vencida" : "Pendiente"}
                  color={estadoColor}
                  variant={t.vencida ? "filled" : "outlined"}
                  sx={{ height: 22 }}
                />

                {/* Acciones */}
                <Stack
                  direction="row"
                  spacing={0.5}
                  className="row-actions"
                  sx={{ ml: 0.5, flexShrink: 0 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {onEdit && (
                    <Tooltip title="Editar tarea">
                      <IconButton size="small" onClick={() => onEdit(t)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Ver detalle">
                    <IconButton size="small" onClick={() => (onDetail ? onDetail(t) : null)}>
                      <VisibilityOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </ListItemButton>
    </ListItem>
  );
}

function RowMobile({ t, onEdit, onDetail }) {
  const estadoColor = estadoChipColor({ completada: t.completada, vencida: t.vencida });

  return (
    <ListItem disablePadding sx={{ alignItems: "stretch" }}>
      {/* ❗️Sin onClick: solo botones */}
      <ListItemButton sx={{ py: 1, alignItems: "flex-start" }}>
        <Stack sx={{ width: "100%", minWidth: 0 }} spacing={0.75}>
          {/* 1) Título (hasta 2 líneas) */}
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                color: (th) => th.palette.text.secondary,
                display: "flex",
                alignItems: "center",
                mt: 0.25,
                flexShrink: 0,
              }}
            >
              <AssignmentTurnedInOutlinedIcon fontSize="small" />
            </Box>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                lineHeight: 1.2,
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                whiteSpace: "normal",
                wordBreak: "break-word",
                minWidth: 0,
                flex: 1,
                textDecoration: t.completada ? "line-through" : "none",
                opacity: t.completada ? 0.7 : 1,
              }}
              title={t.titulo || "Tarea"}
            >
              {t.titulo || "Tarea"}
            </Typography>
          </Stack>

          {/* 2) Izq: Fecha | Der: Estado */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
              <AccessTimeOutlinedIcon sx={{ fontSize: 16, opacity: 0.8 }} />
              <Typography
                variant="caption"
                color={
                  t.completada ? "text.secondary" : t.vencida ? "error.main" : "text.secondary"
                }
                sx={{ whiteSpace: "nowrap" }}
              >
                Vence: {t.fechaTxt}
              </Typography>
            </Stack>

            <Chip
              size="small"
              label={t.completada ? "Completada" : t.vencida ? "Vencida" : "Pendiente"}
              color={estadoColor}
              variant={t.vencida ? "filled" : "outlined"}
              sx={{ height: 22, flexShrink: 0, maxWidth: "55%", whiteSpace: "nowrap" }}
            />
          </Stack>

          {/* 3) Izq: Prioridad (si hay) | Der: Acciones */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {t.prioridadNombre && (
                <Chip
                  size="small"
                  label={t.prioridadNombre}
                  color={prioridadColor(t.prioridadNombre, t.prioridadCodigo)}
                  variant="outlined"
                  sx={{
                    height: 22,
                    maxWidth: "100%",
                    "& .MuiChip-label": {
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  }}
                />
              )}
            </Box>

            <Stack
              direction="row"
              spacing={0.25}
              sx={{ flexShrink: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              {onEdit && (
                <Tooltip title="Editar">
                  <IconButton size="small" sx={{ p: 0.5 }} onClick={() => onEdit(t)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Detalle">
                <IconButton
                  size="small"
                  sx={{ p: 0.5 }}
                  onClick={() => (onDetail ? onDetail(t) : null)}
                >
                  <VisibilityOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>
        </Stack>
      </ListItemButton>
    </ListItem>
  );
}

/* ================== COMPONENTE PRINCIPAL ================== */
export default function CasoTareas({
  tareas = [],
  open = true,
  onToggle,
  onItemClick, // compatibilidad
  onEdit,
  onDetail,
  onAdd,
  onSeeAll,
  onlyOverdue = false,
  embedded = false,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const now = dayjs();

  const items = useMemo(() => {
    return (tareas || []).map((t) => {
      const raw = t.fechaLimite;
      const hasTime =
        !!raw &&
        /T\d{2}:\d{2}:\d{2}/.test(String(raw)) &&
        !/T00:00:00(\.000)?Z?$/.test(String(raw));

      const fLocal = raw ? dayjs.utc(raw).local() : null;
      const vencRef = fLocal ? (hasTime ? fLocal : fLocal.endOf("day")) : null;

      const vencida = !!(vencRef && !t.completada && vencRef.isBefore(now));
      const fechaTxt = fLocal ? fLocal.format(hasTime ? "DD/MM/YYYY HH:mm" : "DD/MM/YYYY") : "-";

      const prioridadNombre = t?.prioridad?.nombre || "";
      const prioridadCodigo = t?.prioridad?.codigo || "";
      const ts = vencRef ? vencRef.valueOf() : Number.POSITIVE_INFINITY;
      const pr = prioridadRank(prioridadNombre, prioridadCodigo);

      return { ...t, vencida, fechaTxt, prioridadNombre, prioridadCodigo, _ts: ts, _pr: pr };
    });
  }, [tareas, now]);
  
  // Orden: incompletas primero, luego fecha asc, prioridad, título.
  const visibles = useMemo(() => {
    const base = onlyOverdue ? items.filter((i) => i.vencida && !i.completada) : items.slice();
    base.sort((a, b) => {
      const gA = a.completada ? 1 : 0;
      const gB = b.completada ? 1 : 0;
      if (gA !== gB) return gA - gB;
      if (a._ts !== b._ts) return a._ts - b._ts;
      if (a._pr !== b._pr) return a._pr - b._pr;
      return (a.titulo || "").localeCompare(b.titulo || "", "es", { sensitivity: "base" });
    });
    return base;
  }, [items, onlyOverdue]);

  const Content =
    visibles.length === 0 ? (
      <Alert severity="info">
        {onlyOverdue ? "No hay tareas vencidas." : "Aún no hay tareas registradas para este caso."}
      </Alert>
    ) : (
      <List
        disablePadding
        sx={{
          "& .MuiListItemButton-root": {
            py: 0.6,
            px: 1,
            borderBottom: (t) => `1px solid ${t.palette.divider}`,
            "&:last-of-type": { borderBottom: "none" },
            "&:hover": { backgroundColor: (t) => t.palette.action.hover },
          },
        }}
      >
        {visibles.map((t) =>
          isMobile ? (
            <RowMobile key={t.id} t={t} onEdit={onEdit} onDetail={onDetail} />
          ) : (
            <RowDesktop key={t.id} t={t} onEdit={onEdit} onDetail={onDetail} />
          )
        )}
      </List>
    );

  if (embedded) return Content;

  return (
    <SectionCard
      title={`Tareas${onlyOverdue ? " vencidas" : ""} (${visibles.length})`}
      expanded={open}
      onToggle={onToggle}
      actions={
        <Stack direction="row" spacing={0.5}>
          {onSeeAll && (
            <Tooltip title="Ver todas las tareas">
              <span>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeeAll();
                  }}
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
          {onAdd && (
            <Tooltip title="Nueva tarea">
              <span>
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd();
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </Stack>
      }
      sx={{ mb: 2 }}
    >
      {Content}
    </SectionCard>
  );
}
