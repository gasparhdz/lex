// src/components/detalle-caso/CasoGastos.jsx
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
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

/* ===== Layout (desktop) =====
   Orden: Concepto | Importe | Cobrado | Saldo | Acciones
*/
const GRID_COLS = "300px 200px 160px 160px 110px";
const GRID_GAP = 2;

/* ===== Helpers ===== */
const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const fmtNUM = new Intl.NumberFormat("es-AR");

const getConcepto = (g) => g?.concepto?.nombre || g?.conceptoNombre || g?.concepto || "—";

const computeImporteARS = (g) => {
  const mp = Number(g?.montoARS ?? g?.montoPesos);
  if (Number.isFinite(mp)) return mp;
  const jus = Number(g?.montoJUS ?? g?.jus);
  const vj = Number(g?.valorJusRef);
  if (Number.isFinite(jus) && Number.isFinite(vj)) return jus * vj;
  return null;
};
const computeCobradoARS = (g) => Number(g?.aplicadoARS ?? g?.cobrado ?? 0);

function deriveMoney(g) {
  const montoARS = computeImporteARS(g);
  const jus = Number(g?.montoJUS ?? g?.jus);
  const isJUS = Number.isFinite(jus) && jus > 0;
  const importeLabel =
    isJUS && Number.isFinite(montoARS)
      ? `${fmtNUM.format(jus)} JUS (${fmtARS.format(montoARS)})`
      : Number.isFinite(montoARS)
      ? fmtARS.format(montoARS)
      : "—";
  const cobradoARS = computeCobradoARS(g);
  const saldoARS = Number.isFinite(montoARS) ? Math.max(montoARS - cobradoARS, 0) : null;
  return { importeLabel, cobradoARS, saldoARS };
}

/* ====== Cards de resumen ====== */
function GastosHeader({ gastos = [] }) {
  let totalARS = 0;
  let cobradoARS = 0;

  for (const g of gastos) {
    totalARS += computeImporteARS(g) || 0;
    cobradoARS += computeCobradoARS(g) || 0;
  }
  const pendienteARS = Math.max(totalARS - cobradoARS, 0);

  const cards = [
    {
      icon: <TrendingUpOutlinedIcon fontSize="small" />,
      label: "Total gastos",
      value: fmtARS.format(totalARS),
      color: "primary.main",
    },
    {
      icon: <PaidOutlinedIcon fontSize="small" />,
      label: "Cobrados",
      value: fmtARS.format(cobradoARS),
      color: "success.main",
    },
    {
      icon: <ReceiptLongOutlinedIcon fontSize="small" />,
      label: "Pendientes",
      value: fmtARS.format(pendienteARS),
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
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              {c.value}
            </Typography>
          </Box>
        </Paper>
      ))}
    </Stack>
  );
}


/* ====== Fila Desktop ====== */
function RowDesktop({ g, onEdit, onDetail }) {
  const { importeLabel, cobradoARS, saldoARS } = deriveMoney(g);

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
        "& .row-actions": { opacity: 0, transition: "opacity 150ms ease" },
        "&:hover .row-actions": { opacity: 1 },
      }}
    >
      {/* CONCEPTO */}
      <Typography
        variant="body2"
        title={getConcepto(g)}
        sx={{
          fontWeight: 600,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {getConcepto(g)}
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

      {/* ACCIONES */}
      <Box sx={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 0.25 }}>
        <Stack direction="row" spacing={0.25} className="row-actions" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <Tooltip title="Editar gasto">
              <IconButton size="small" onClick={() => onEdit(g)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Ver detalle">
            <IconButton size="small" onClick={() => onDetail && onDetail(g)}>
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

/* ====== Fila Mobile ====== */
function RowMobile({ g, onEdit, onDetail }) {
  const { importeLabel, cobradoARS, saldoARS } = deriveMoney(g);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.25,
        mb: 1,
        borderRadius: 3,
        "&:active": { transform: "scale(0.998)" },
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 0.5, minWidth: 0 }}>
        <ReceiptLongOutlinedIcon fontSize="small" color="action" />
        {/* Título ahora es el CONCEPTO */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            lineHeight: 1.2,
            wordBreak: "break-word",
            whiteSpace: "normal",
            flex: 1,
          }}
          title={getConcepto(g)}
        >
          {getConcepto(g)}
        </Typography>
        <Stack direction="row" spacing={0.25}>
          {onEdit && (
            <Tooltip title="Editar gasto">
              <IconButton size="small" onClick={() => onEdit(g)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Ver detalle">
            <IconButton size="small" onClick={() => onDetail && onDetail(g)}>
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
export default function CasoGastos({ gastos = [], onEdit, onDetail }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const safeList = Array.isArray(gastos) ? gastos : [];

  const rows = useMemo(() => {
    const list = (safeList || []).map((g, i) => ({
      ...g,
      _key: (getConcepto(g) || "").toString().toUpperCase(),
      _idx: i,
    }));
    return list.sort((a, b) =>
      a._key.localeCompare(b._key, "es", { sensitivity: "base" })
    );
  }, [safeList]);

  if (!rows.length) {
    return (
      <Alert severity="info">
        Aún no hay gastos registrados para este caso.
      </Alert>
    );
  }

  return (
    <Box>
      <GastosHeader gastos={rows} />

      <Box
        sx={{
          maxHeight: 400,
          overflowY: "auto",
          overflowX: { xs: "hidden", md: "auto" },
          borderRadius: 2,
          "&::-webkit-scrollbar": { height: 8 },
          "&::-webkit-scrollbar-thumb": (t) => ({
            backgroundColor: t.palette.action.disabled,
            borderRadius: 8,
          }),
          "&::-webkit-scrollbar-track": (t) => ({
            backgroundColor:
              t.palette.mode === "dark"
                ? t.palette.background.paper
                : t.palette.grey[200],
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
              {/* (sin título para la columna de acciones) */}
            </Box>
          )}

          {rows.map((g) =>
            isMobile ? (
              <RowMobile key={g.id ?? g._idx} g={g} onEdit={onEdit} onDetail={onDetail} />
            ) : (
              <RowDesktop key={g.id ?? g._idx} g={g} onEdit={onEdit} onDetail={onDetail} />
            )
          )}
        </Box>
      </Box>
    </Box>
  );
}
