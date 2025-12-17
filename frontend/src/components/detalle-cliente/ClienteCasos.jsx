import React from "react";
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
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import AddIcon from "@mui/icons-material/Add";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SectionCard from "../../components/SectionCard";

/* ===== Helpers ===== */
// Colorea el chip de estado según el nombre
const estadoChipColor = (nombre = "") => {
  const n = String(nombre).toLowerCase();
  if (/(firme|concluido|cerrado|finalizado|sentencia)/.test(n)) return "success";
  if (/(trámite|tramite|curso|andamia|en curso)/.test(n)) return "info";
  if (/(suspend|paralizado|demora)/.test(n)) return "warning";
  if (/(apel|recurso|conflicto|riesgo)/.test(n)) return "error";
  return "default";
};

function RowDesktop({ c, onRowClick, onEdit, onDetail }) {
  const estadoNombre = c?.estado?.nombre || "-";
  const tipoNombre = c?.tipo?.nombre || c?.tipoNombre || null;

  return (
    <ListItem
      disablePadding
      sx={{
        "& .row-actions": { opacity: 0, transition: "opacity 120ms ease" },
        "&:hover .row-actions": { opacity: 1 },
      }}
    >
      <ListItemButton>
        <Stack
          direction="row"
          spacing={1}
          sx={{ width: "100%", alignItems: "center", minWidth: 0 }}
        >
          {/* Icono */}
          <Box
            sx={{
              color: (t) => t.palette.text.secondary,
              display: "flex",
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <GavelOutlinedIcon fontSize="small" />
          </Box>

          {/* Tipo (si hay) */}
          {tipoNombre && (
            <Chip
              size="small"
              label={tipoNombre}
              variant="outlined"
              sx={{ height: 22, maxWidth: 160 }}
            />
          )}

          {/* Carátula */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                lineHeight: 1.15,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
              title={c.caratula || "Sin carátula"}
            >
              {c.caratula || "Sin carátula"}
            </Typography>
          </Box>

          {/* Estado */}
          <Chip
            size="small"
            label={estadoNombre}
            color={estadoChipColor(estadoNombre)}
            variant="outlined"
            sx={{ height: 22, maxWidth: 200, flexShrink: 0 }}
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
              <Tooltip title="Editar caso">
                <IconButton size="small" onClick={() => onEdit(c)}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Ver detalle">
              <IconButton
                size="small"
                onClick={() => (onDetail ? onDetail(c) : onRowClick())}
              >
                <VisibilityOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </ListItemButton>
    </ListItem>
  );
}

function RowMobile({ c, onRowClick, onEdit, onDetail }) {
  const estadoNombre = c?.estado?.nombre || "-";
  const tipoNombre = c?.tipo?.nombre || c?.tipoNombre || null;

  return (
    <ListItem disablePadding sx={{ alignItems: "stretch" }}>
      <ListItemButton sx={{ py: 1 }}>
        <Stack sx={{ width: "100%", minWidth: 0 }} spacing={0.75}>
          {/* Carátula (hasta 2 líneas) */}
          <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
            <Box
              sx={{
                color: (t) => t.palette.text.secondary,
                display: "flex",
                alignItems: "center",
                mt: 0.25,
                flexShrink: 0,
              }}
            >
              <GavelOutlinedIcon fontSize="small" />
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
              title={c.caratula || "Sin carátula"}
            >
              {c.caratula || "Sin carátula"}
            </Typography>
          </Stack>

          {/* Segunda fila: Tipo (izq) + Estado (centro) + Acciones (der) */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              {tipoNombre ? (
                <Chip
                  size="small"
                  label={tipoNombre}
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
              ) : (
                <Box />
              )}
            </Box>

            <Chip
              size="small"
              label={estadoNombre}
              color={estadoChipColor(estadoNombre)}
              variant="outlined"
              sx={{ height: 22, flexShrink: 0, whiteSpace: "nowrap" }}
            />

            {/* Acciones */}
            <Stack
              direction="row"
              spacing={0.25}
              sx={{ flexShrink: 0, ml: 0.25 }}
              onClick={(e) => e.stopPropagation()}
            >
              {onEdit && (
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => onEdit(c)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Detalle">
                <IconButton
                  size="small"
                  onClick={() => (onDetail ? onDetail(c) : onRowClick())}
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

/**
 * Props:
 * - casos: array
 * - open, onToggle: para SectionCard
 * - onItemClick(c): click en la fila (lleva a detalle si lo usás así)
 * - onEdit(c): click en botón editar por fila
 * - onDetail(c): click en botón detalle por fila (si no lo pasás, usa onItemClick)
 * - onAdd(): acción de "Nuevo caso" en el header
 * - onSeeAll(): acción de "Ver todos" en el header
 * - embedded?: si true, no envuelve con SectionCard
 */
export default function ClienteCasos({
  casos = [],
  open = true,
  onToggle,
  onItemClick,
  onEdit,
  onDetail,
  onAdd,
  onSeeAll,
  embedded = false,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const Content =
    casos.length === 0 ? (
      <Alert severity="info">
        Aún no hay casos asociados a este cliente. Puedes crear uno nuevo desde el botón "Nuevo caso".
      </Alert>
    ) : (
      <Box sx={{ maxHeight: 400, overflowY: 'auto', overflowX: 'hidden' }}>
        <List
          disablePadding
          sx={{
            "& .MuiListItemButton-root": {
              px: 1,
              borderBottom: (t) => `1px solid ${t.palette.divider}`,
              "&:last-of-type": { borderBottom: "none" },
              "&:hover": { backgroundColor: (t) => t.palette.action.hover },
            },
          }}
        >
        {casos.map((c) => {
          const handleRowClick = () => onItemClick && onItemClick(c);
          return isMobile ? (
            <RowMobile
              key={c.id}
              c={c}
              onRowClick={handleRowClick}
              onEdit={onEdit}
              onDetail={onDetail}
            />
          ) : (
            <RowDesktop
              key={c.id}
              c={c}
              onRowClick={handleRowClick}
              onEdit={onEdit}
              onDetail={onDetail}
            />
          );
        })}
      </List>
      </Box>
    );

  if (embedded) return Content;

  return (
    <SectionCard
      title={`Casos (${casos.length})`}
      expanded={open}
      onToggle={onToggle}
      actions={
        <Stack direction="row" spacing={0.5}>
          {onSeeAll && (
            <Tooltip title="Ver todos los casos">
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
            <Tooltip title="Nuevo caso">
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
