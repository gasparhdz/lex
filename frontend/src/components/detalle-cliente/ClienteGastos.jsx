// src/components/detalle-cliente/ClienteGastos.jsx
import React, { useMemo, useCallback } from "react";
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
import { useNavigate, useLocation } from "react-router-dom";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";

/* ===== Layout (desktop) =====
   Orden: Concepto | Caso | Importe | Cobrado | Saldo | Acciones
*/
const GRID_COLS = "200px 360px 180px 110px 120px 60px";
const GRID_GAP = 2;

/* ===== Helpers ===== */
const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const fmtNUM = new Intl.NumberFormat("es-AR");

const getCaso = (g) => g?.caso?.caratula || g?.casoNombre || "—";
const getConcepto = (g) => g?.concepto?.nombre || g?.conceptoNombre || g?.concepto || "—";

// === Helpers numéricos (reemplazar) ===
const computeImporteARS = (g) => {
  // 1) Si el back ya manda monto en ARS directo
  const mp = Number(g?.montoARS ?? g?.montoPesos ?? g?.importeARS ?? g?.importe);
  if (Number.isFinite(mp)) return mp;

  // 2) Si viene en JUS + valor de referencia
  const jus = Number(g?.montoJUS ?? g?.jus);
  const vj  = Number(g?.valorJusRef ?? g?.valorJUS ?? g?.jusValor);
  if (Number.isFinite(jus) && Number.isFinite(vj)) return jus * vj;

  return 0;
};

const computeCobradoARS = (g) => {
  // 1) Campo directo desde el back (preferido)
  const direct =
    g?.aplicadoARS ?? g?.cobradoARS ?? g?.cobrado ?? g?.pagadoARS ?? g?.pagado;
  if (Number.isFinite(Number(direct))) return Number(direct);

  // 2) Sumar aplicaciones/pagos si vienen en array
  const list =
    Array.isArray(g?.aplicaciones) ? g.aplicaciones :
    Array.isArray(g?.pagos)        ? g.pagos :
    Array.isArray(g?.aplicados)    ? g.aplicados : [];

  if (list.length) {
    return list.reduce((acc, it) => {
      const val =
        it?.montoARS ?? it?.montoPesos ?? it?.importeARS ?? it?.importe ?? 0;
      const n = Number(val);
      return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
  }

  return 0;
};

function deriveMoney(g) {
  const importeARS = computeImporteARS(g);
  const cobradoARS = computeCobradoARS(g);
  const saldoARS   = Math.max(importeARS - cobradoARS, 0);

  // Etiqueta de “Importe” con JUS si corresponde
  const jus = Number(g?.montoJUS ?? g?.jus);
  const isJUS = Number.isFinite(jus) && jus > 0;
  const importeLabel = isJUS
    ? `${fmtNUM.format(jus)} JUS (${fmtARS.format(importeARS)})`
    : fmtARS.format(importeARS);

  return { importeLabel, cobradoARS, saldoARS };
}


/* ====== Cards de resumen ====== */
function GastosHeader({ gastos = [] }) {
  let totalARS = 0;
  let cobradoARS = 0;

  for (const g of gastos) {
    totalARS  += computeImporteARS(g) || 0;
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
          <Box sx={{ color: (t) => c.color, display: "flex", alignItems: "center" }}>
            {c.icon}
          </Box>
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

      {/* CASO */}
      <Typography
        variant="body2"
        title={getCaso(g)}
        sx={{
          fontWeight: 600,
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          whiteSpace: "normal",
          wordBreak: "break-word",
          lineHeight: 1.25,
          pr: 1,
        }}
      >
        {getCaso(g)}
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
        <Stack
          direction="row"
          spacing={0.25}
          className="row-actions"
          onClick={(e) => e.stopPropagation()}
        >
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
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            lineHeight: 1.2,
            wordBreak: "break-word",
            whiteSpace: "normal",
            flex: 1,
          }}
          title={getCaso(g)}
        >
          {getCaso(g)}
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

      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
        {getConcepto(g)}
      </Typography>

      <Stack direction="column" spacing={0.6}>
        <Pill>Importe: {importeLabel}</Pill>
        <Pill>Cobrado: {fmtARS.format(cobradoARS || 0)}</Pill>
        <Pill>Saldo: {saldoARS != null ? fmtARS.format(saldoARS) : "—"}</Pill>
      </Stack>
    </Paper>
  );
}

/* ====== Componente principal ====== */
export default function ClienteGastos({ gastos = [], onEdit, onDetail }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const nav = useNavigate();
  const location = useLocation();

  const safeList = Array.isArray(gastos) ? gastos : [];

  // Navegación por defecto a la vista de detalle si no se provee onDetail desde el padre
  const defaultDetail = useCallback(
    (g) => {
      if (!g) return;
      const id = g.id ?? g.gastoId;
      if (!id) return;
      const qs = new URLSearchParams({ mode: "ver" }).toString();
      nav(`/finanzas/gastos/${id}?${qs}`, {
        state: {
          from: location.pathname,
          mode: "ver",
          // Opcionalmente podés llevar estos datos para preseleccionar en el form si hiciera falta:
          clienteId: g.clienteId,
          casoId: g.casoId,
        },
        replace: false,
      });
    },
    [nav, location.pathname]
  );

  // Handler efectivo que se pasa a las filas
  const handleDetail = onDetail ?? defaultDetail;

  const rows = useMemo(() => {
    const list = (safeList || []).map((g, i) => ({
      ...g,
      _key: (getCaso(g) || "").toString().toUpperCase(),
      _idx: i,
    }));
    return list.sort((a, b) =>
      a._key.localeCompare(b._key, "es", { sensitivity: "base" })
    );
  }, [safeList]);

  if (!rows.length) {
    return <Alert severity="info">Aún no hay gastos registrados para este cliente.</Alert>;
  }

  return (
    <Box>
      <GastosHeader gastos={rows} />

      <Box
        sx={{
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
              <Box>Caso</Box>
              <Box sx={{ justifySelf: "end", whiteSpace: "nowrap" }}>Importe</Box>
              <Box sx={{ justifySelf: "end", whiteSpace: "nowrap" }}>Cobrado</Box>
              <Box sx={{ justifySelf: "end", whiteSpace: "nowrap" }}>Saldo</Box>
            </Box>
          )}

          {rows.map((g) =>
            isMobile ? (
              <RowMobile key={g.id ?? g._idx} g={g} onEdit={onEdit} onDetail={handleDetail} />
            ) : (
              <RowDesktop key={g.id ?? g._idx} g={g} onEdit={onEdit} onDetail={handleDetail} />
            )
          )}
        </Box>
      </Box>
    </Box>
  );
}
