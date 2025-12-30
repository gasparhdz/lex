// src/components/detalle-caso/CasoHonorarios.jsx
import React, { useMemo } from "react";
import {
  Box,
  Stack,
  Typography,
  Chip,
  Paper,
  IconButton,
  Tooltip,
  useMediaQuery,
  Alert,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";

/* ===== Layout (desktop) =====
   Concepto | Importe | Cobrado | Saldo | Acciones
*/
const GRID_COLS = "300px 200px 160px 160px 110px";
const GRID_GAP = 2;

/* ===== Helpers ===== */
const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const fmtNUM = new Intl.NumberFormat("es-AR");

const getConcepto = (h) => h?.concepto?.nombre || h?.conceptoNombre || h?.concepto || "—";

// importe total del honorario en ARS
const computeImporteARS = (h) => {
  const mp = Number(h?.montoARS ?? h?.montoPesos);
  if (Number.isFinite(mp)) return mp;
  const jus = Number(h?.montoJUS ?? h?.jus);
  const vj = Number(h?.valorJusRef);
  if (Number.isFinite(jus) && Number.isFinite(vj)) return jus * vj;
  return null;
};

// total cobrado/aplicado en ARS
const computeCobradoARS = (h) => Number(h?.aplicadoARS ?? h?.cobrado ?? 0);

function deriveMoney(h) {
  const montoARS = computeImporteARS(h);
  const jus = Number(h?.montoJUS ?? h?.jus);
  const isJUS = Number.isFinite(jus) && jus > 0;

  const importeLabel =
    isJUS && Number.isFinite(montoARS)
      ? `${fmtNUM.format(jus)} JUS (${fmtARS.format(montoARS)})`
      : Number.isFinite(montoARS)
      ? fmtARS.format(montoARS)
      : "—";

  const cobradoARS = computeCobradoARS(h);
  const saldoARS = Number.isFinite(montoARS) ? Math.max(montoARS - cobradoARS, 0) : null;

  return { importeLabel, cobradoARS, saldoARS };
}

/* ====== Métricas superiores ====== */
function HonorariosHeader({ honorarios = [] }) {
  let totalARS = 0, sumPendientes = 0;
  for (const h of honorarios) {
    const importe = computeImporteARS(h) || 0;
    const cobrado = computeCobradoARS(h) || 0;
    totalARS += importe;
    sumPendientes += Math.max(importe - cobrado, 0);
  }

  const cards = [
    {
      icon: <TrendingUpOutlinedIcon fontSize="small" />,
      label: "Total honorarios",
      value: fmtARS.format(totalARS),
      color: "primary.main",
    },
    {
      icon: <PaidOutlinedIcon fontSize="small" />,
      label: "Pagados",
      value: fmtARS.format(totalARS - sumPendientes),
      color: "success.main",
    },
    {
      icon: <ReceiptLongOutlinedIcon fontSize="small" />,
      label: "Pendientes",
      value: fmtARS.format(sumPendientes),
      color: "warning.main",
    },
  ];

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mb: 2, flexWrap: "wrap" }}>
      {cards.map((c) => (
        <Paper
          key={c.label}
          variant="outlined"
          sx={{
            p: 1.5,
            borderRadius: 3,
            minWidth: 180,
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 1.25,
          }}
        >
          <Box sx={{ color: (t) => c.color, display: "flex", alignItems: "center" }}>{c.icon}</Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.2 }}>
              {c.label}
            </Typography>
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{c.value}</Typography>
          </Box>
        </Paper>
      ))}
    </Stack>
  );
}

/* ====== Fila Desktop (sin estado) ====== */
function RowDesktop({ h, onEdit, onDetail }) {
  const { importeLabel, cobradoARS, saldoARS } = deriveMoney(h);

  return (
    <Box
      sx={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: GRID_COLS,
        columnGap: GRID_GAP,
        alignItems: "center",
        px: 1,
        py: 1,
        width: "max-content",
        minWidth: "100%",
        "&:hover": { backgroundColor: (t) => t.palette.action.hover },
        "&::after": (t) => ({
          content: '""',
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          borderBottom: `1px solid ${t.palette.divider}`,
        }),
        "& .row-actions": { opacity: 0, transition: "opacity 120ms ease" },
        "&:hover .row-actions": { opacity: 1 },
      }}
    >
      {/* CONCEPTO */}
      <Typography
        variant="body2"
        title={getConcepto(h)}
        sx={{
          fontWeight: 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {getConcepto(h)}
      </Typography>

      {/* IMPORTE */}
      <Typography
        variant="body2"
        title={importeLabel}
        sx={{
          justifySelf: "end",
          whiteSpace: "nowrap",
          fontFeatureSettings: "'tnum' on, 'lnum' on",
          fontVariantNumeric: "tabular-nums lining-nums",
        }}
      >
        {importeLabel}
      </Typography>

      {/* COBRADO */}
      <Typography
        variant="body2"
        sx={{
          justifySelf: "end",
          whiteSpace: "nowrap",
          fontFeatureSettings: "'tnum' on, 'lnum' on",
          fontVariantNumeric: "tabular-nums lining-nums",
        }}
      >
        {fmtARS.format(cobradoARS || 0)}
      </Typography>

      {/* SALDO */}
      {saldoARS != null ? (
        <Chip
          size="small"
          label={fmtARS.format(saldoARS)}
          color={Number(saldoARS) > 0 ? "warning" : "success"}
          variant="outlined"
          sx={{ height: 22, justifySelf: "end", maxWidth: "100%" }}
        />
      ) : (
        <Typography variant="body2" sx={{ justifySelf: "end", whiteSpace: "nowrap" }}>
          —
        </Typography>
      )}

      {/* ACCIONES (sin columna de Estado) */}
      <Box sx={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 0.25 }}>
        <Stack direction="row" spacing={0.25} className="row-actions" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <Tooltip title="Editar honorario">
              <IconButton size="small" onClick={() => onEdit(h)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Ver detalle">
            <IconButton size="small" onClick={() => (onDetail ? onDetail(h) : null)}>
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );
}

/* ====== Píldora (mobile) ====== */
function Pill({ children }) {
  return (
    <Box
      sx={(t) => ({
        border: `1px solid ${t.palette.divider}`,
        borderRadius: 999,
        px: 1,
        py: 0.5,
        width: "100%",
        fontSize: 14,
        lineHeight: 1.2,
        backgroundColor: t.palette.action.hover,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "normal",
      })}
    >
      {children}
    </Box>
  );
}

/* ====== Fila Mobile (sin estado) ====== */
function RowMobile({ h, onEdit, onDetail }) {
  const { importeLabel, cobradoARS, saldoARS } = deriveMoney(h);

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.25, mb: 1, borderRadius: 3, "&:active": { transform: "scale(0.998)" } }}
    >
      {/* Título: Concepto */}
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 0.5, minWidth: 0 }}>
        <ReceiptLongOutlinedIcon fontSize="small" color="action" />
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            lineHeight: 1.2,
            wordBreak: "break-word",
            whiteSpace: "normal",
            minWidth: 0,
            flex: 1,
          }}
          title={getConcepto(h)}
        >
          {getConcepto(h)}
        </Typography>

        {/* Acciones */}
        <Stack direction="row" spacing={0.25} sx={{ flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <Tooltip title="Editar">
              <IconButton size="small" onClick={() => onEdit(h)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Detalle">
            <IconButton size="small" onClick={() => (onDetail ? onDetail(h) : null)}>
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Stack direction="column" spacing={0.6}>
        <Pill>Importe: {importeLabel}</Pill>
        <Pill>Cobrado: {fmtARS.format(cobradoARS || 0)}</Pill>
        <Pill>Saldo: {saldoARS != null ? fmtARS.format(saldoARS) : "—"}</Pill>
      </Stack>
    </Paper>
  );
}

/* ====== Componente principal ====== */
export default function CasoHonorarios({ honorarios = [], onEdit, onDetail }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const safeList = Array.isArray(honorarios) ? honorarios : [];

  if (!safeList.length) {
    return <Alert severity="info">Aún no hay honorarios registrados para este caso.</Alert>;
  }

  return (
    <Box>
      <HonorariosHeader honorarios={safeList} />

      <Box
        sx={{
          maxHeight: 400,
          overflowY: "auto",
          overflowX: { xs: "hidden", md: "auto" },
          borderRadius: 2,
          "&::-webkit-scrollbar": { height: 8 },
          "&::-webkit-scrollbar-thumb": (t) => ({ backgroundColor: t.palette.action.disabled, borderRadius: 8 }),
          "&::-webkit-scrollbar-track": (t) => ({
            backgroundColor: t.palette.mode === "dark" ? t.palette.background.paper : t.palette.grey[200],
            borderRadius: 8,
          }),
        }}
      >
        <Box sx={{ width: { xs: "100%", md: "max-content" }, minWidth: "100%" }}>
          {!isMobile && (
            <Box
              sx={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: GRID_COLS,
                columnGap: GRID_GAP,
                px: 1,
                py: 0.75,
                color: "text.secondary",
                fontSize: 12,
                textTransform: "uppercase",
                letterSpacing: 0.4,
                alignItems: "center",
                "&::after": (t) => ({
                  content: '""',
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderBottom: `1px solid ${t.palette.divider}`,
                }),
              }}
            >
              <Box>Concepto</Box>
              <Box sx={{ justifySelf: "end", whiteSpace: "nowrap" }}>Importe</Box>
              <Box sx={{ justifySelf: "end", whiteSpace: "nowrap" }}>Cobrado</Box>
              <Box sx={{ justifySelf: "end", whiteSpace: "nowrap" }}>Saldo</Box>
            </Box>
          )}

          {safeList.map((h, idx) =>
            isMobile ? (
              <RowMobile key={h.id ?? idx} h={h} onEdit={onEdit} onDetail={onDetail} />
            ) : (
              <RowDesktop key={h.id ?? idx} h={h} onEdit={onEdit} onDetail={onDetail} />
            )
          )}
        </Box>
      </Box>
    </Box>
  );
}
