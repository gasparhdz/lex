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
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import AddIcon from "@mui/icons-material/Add";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SectionCard from "../SectionCard"; // desde /components/detalle-cliente a /components
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

// color del estado del evento
const estadoChipColor = (nombre = "") => {
  const n = String(nombre).toLowerCase();
  if (/(realizad|hecho|finaliz|asistido|concluido)/.test(n)) return "success";
  if (/(pend|program|agend|planificado)/.test(n)) return "info";
  if (/(cancel|suspend)/.test(n)) return "warning";
  if (/(reprogram|conflict|riesgo)/.test(n)) return "error";
  return "default";
};

/* ============ Rows ============ */
function RowDesktop({ e, onEdit, onDetail }) {
  const estadoNombre = e?.estado?.nombre || "-";

  return (
    <ListItem
      disablePadding
      sx={{
        "& .row-actions": { opacity: 0, transition: "opacity 120ms ease" },
        "&:hover .row-actions": { opacity: 1 },
      }}
    >
      {/* ❗️Sin onClick: solo botones */}
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
            <EventOutlinedIcon fontSize="small" />
          </Box>

          {/* Descripción + meta + acciones */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 1 }}>
              {/* Descripción */}
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
                }}
                title={e.descripcion || "Evento"}
              >
                {e.descripcion || "Evento"}
              </Typography>

              {/* Meta + Estado + Acciones */}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
                {/* Fecha */}
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <AccessTimeOutlinedIcon sx={{ fontSize: 16, opacity: 0.8 }} />
                  <Typography
                    variant="caption"
                    color={e.isPast ? "text.disabled" : "text.secondary"}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    Fecha: {e.fechaTxt}
                  </Typography>
                </Stack>

                {/* Estado */}
                <Chip
                  size="small"
                  label={estadoNombre}
                  color={estadoChipColor(estadoNombre)}
                  variant="outlined"
                  sx={{ height: 22 }}
                />

                {/* Acciones */}
                <Stack
                  direction="row"
                  spacing={0.5}
                  className="row-actions"
                  sx={{ ml: 0.5, flexShrink: 0 }}
                  onClick={(ev) => ev.stopPropagation()}
                >
                  {onEdit && (
                    <Tooltip title="Editar evento">
                      <IconButton size="small" onClick={() => onEdit(e)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Ver detalle">
                    <IconButton size="small" onClick={() => (onDetail ? onDetail(e) : null)}>
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

function RowMobile({ e, onEdit, onDetail }) {
  const estadoNombre = e?.estado?.nombre || "-";

  return (
    <ListItem disablePadding sx={{ alignItems: "stretch" }}>
      {/* ❗️Sin onClick: solo botones */}
      <ListItemButton sx={{ py: 1 }}>
        <Stack sx={{ width: "100%", minWidth: 0 }} spacing={0.75}>
          {/* 1) Descripción (hasta 2 líneas) */}
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
              <EventOutlinedIcon fontSize="small" />
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
              }}
              title={e.descripcion || "Evento"}
            >
              {e.descripcion || "Evento"}
            </Typography>
          </Stack>

          {/* 2) Meta: fecha (wrap) + estado debajo + acciones */}
          <Stack direction="row" alignItems="flex-start" spacing={1} sx={{ minWidth: 0 }}>
            {/* Fecha + Estado (ocupan todo y envuelven) */}
            <Box sx={{ display: "flex", gap: 0.5, flex: 1, minWidth: 0 }}>
              <AccessTimeOutlinedIcon sx={{ fontSize: 16, opacity: 0.8, mt: "2px", flexShrink: 0 }} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="caption"
                  color={e.isPast ? "text.disabled" : "text.secondary"}
                  sx={{
                    whiteSpace: "normal",        // <- permite multi-línea
                    wordBreak: "break-word",
                    lineHeight: 1.2,
                  }}
                  title={e.fechaTxt}
                >
                  Fecha: {e.fechaTxt}
                </Typography>

                {/* Estado debajo de la fecha */}
                <Chip
                  size="small"
                  label={estadoNombre}
                  color={estadoChipColor(estadoNombre)}
                  variant="outlined"
                  sx={{ height: 22, mt: 0.5, maxWidth: "100%" }}
                />
              </Box>
            </Box>

            {/* Acciones a la derecha */}
            <Stack
              direction="row"
              spacing={0.25}
              sx={{ flexShrink: 0, ml: 0.25 }}
              onClick={(ev) => ev.stopPropagation()}
            >
              {onEdit && (
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => onEdit(e)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Detalle">
                <IconButton size="small" onClick={() => (onDetail ? onDetail(e) : null)}>
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

/**
 * ClienteEventos
 *
 * Props:
 * - eventos: [{ id, descripcion, fechaInicio, estado?: { nombre } }]
 * - open, onToggle, onAdd, onSeeAll (opcionales)
 * - onEdit(e), onDetail(e): acciones por fila
 * - onlyUpcoming: bool (muestra sólo próximos desde hoy)
 * - embedded?: bool -> si true, NO envuelve con SectionCard (sin título/acciones)
 */
export default function ClienteEventos({
  eventos = [],
  open = true,
  onToggle,
  onEdit,
  onDetail,
  onAdd,
  onSeeAll,
  onlyUpcoming = false,
  embedded = false,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const now = dayjs();

  const items = useMemo(() => {
    return (eventos || []).map((e) => {
      const ini = e.fechaInicio ? dayjs.utc(e.fechaInicio).local() : null;
      const fin = e.fechaFin ? dayjs.utc(e.fechaFin).local() : null;

      let fechaTxt = "-";
      if (ini) {
        fechaTxt = ini.format("DD/MM/YYYY HH:mm");
        if (fin) {
          const mismoDia = ini.isSame(fin, "day");
          fechaTxt += mismoDia
            ? ` – ${fin.format("HH:mm")}`
            : ` → ${fin.format("DD/MM/YYYY HH:mm")}`;
        }
      }

      return {
        ...e,
        fechaTxt,
        isPast: !!(fin ? fin.isBefore(dayjs()) : ini && ini.isBefore(dayjs())),
      };
    });
  }, [eventos]);



  const visibles = useMemo(() => {
    const base = onlyUpcoming ? items.filter((e) => !e.isPast) : items;
    return base;
  }, [items, onlyUpcoming]);

  const Content =
    visibles.length === 0 ? (
      <Alert severity="info">
        {onlyUpcoming ? "No hay eventos próximos." : "Aún no hay eventos asociados a este cliente."}
      </Alert>
    ) : (
      <Box sx={{ maxHeight: 400, overflowY: 'auto', overflowX: 'hidden' }}>
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
          {visibles.map((e) =>
            isMobile ? (
              <RowMobile key={e.id} e={e} onEdit={onEdit} onDetail={onDetail} />
            ) : (
              <RowDesktop key={e.id} e={e} onEdit={onEdit} onDetail={onDetail} />
            )
          )}
        </List>
      </Box>
    );

  if (embedded) return Content;

  return (
    <SectionCard
      title={`Eventos${onlyUpcoming ? " próximos" : ""} (${visibles.length})`}
      expanded={open}
      onToggle={onToggle}
      actions={
        <Stack direction="row" spacing={0.5}>
          {onSeeAll && (
            <Tooltip title="Ver todos los eventos">
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
            <Tooltip title="Nuevo evento">
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
