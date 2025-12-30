// src/components/detalle-caso/CasoIngresos.jsx
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
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

/* ===== Layout (desktop) =====
   Concepto | Fecha pago | Importe (ARS) | Acciones
   (Sin columna "Caso" porque ya estamos en el detalle del caso)
*/
const GRID_COLS = "320px 260px 260px 100px";
const GRID_GAP = 2;

/* ===== Helpers ===== */
const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

const toText = (v, fallback = "—") => {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return v.nombre ?? v.label ?? v.titulo ?? v.descripcion ?? v.detalle ?? v.text ?? fallback;
};

const getConcepto = (i) =>
  i?.concepto?.nombre ||
  i?.conceptoNombre ||
  i?.concepto ||
  i?.tipo?.nombre ||
  i?.tipoNombre ||
  i?.tipoId?.nombre ||
  "—";

// contempla fechaIngreso como fallback
const getFechaPago = (i) => {
  const raw = i?.fechaPago ?? i?.fechaCobro ?? i?.fecha ?? i?.fechaIngreso;
  if (!raw) return null;
  const d = dayjs.utc(raw);
  return d.isValid() ? d : null;
};

const pickNum = (...vals) => {
  for (const v of vals) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const JUS_ID = 133;

/** Devuelve SIEMPRE el importe en ARS. */
const computeImporteARS = (i) => {
  const preCalc = pickNum(i?.importeARS);
  if (Number.isFinite(preCalc)) return preCalc;

  const monedaId = Number(i?.monedaId ?? i?.moneda?.id);
  const monedaCod = (i?.moneda?.codigo || "").toUpperCase();
  const esJus = monedaId === JUS_ID || monedaCod === "JUS";

  const pesosExplicitos = pickNum(i?.montoARS, i?.montoPesos);
  if (Number.isFinite(pesosExplicitos) && !esJus) return pesosExplicitos;

  const cantJus = esJus
    ? pickNum(i?.montoJUS, i?.jus, i?.monto)
    : pickNum(i?.montoJUS, i?.jus);

  if (Number.isFinite(cantJus)) {
    const valorJus = pickNum(
      i?.valorJusRef,
      i?.valorJus,
      i?.valorJusAlCobro,
      i?.valorJusVigente,
      i?.cotizacion?.valor,
      i?.cotizacionJus?.valor,
      i?.caso?.valorJusRef
    );
    if (Number.isFinite(valorJus)) return cantJus * valorJus;
    return null;
  }

  const montoGenerico = pickNum(i?.monto);
  if (Number.isFinite(montoGenerico) && !esJus) return montoGenerico;

  return null;
};

function deriveIngreso(i) {
  const fecha = getFechaPago(i);
  const fechaTxt = fecha ? fecha.format("DD/MM/YYYY") : "—";
  const montoARS = computeImporteARS(i);
  const importeLabel = Number.isFinite(montoARS) ? fmtARS.format(montoARS) : "—";
  return { fecha, fechaTxt, montoARS, importeLabel };
}

/* ====== Cards de resumen ====== */
function IngresosHeader({ ingresos = [] }) {
  const hoy = dayjs().utc();
  const ym = { y: hoy.year(), m: hoy.month() };
  const prev = hoy.subtract(1, "month");
  const ymPrev = { y: prev.year(), m: prev.month() };

  let total = 0, actual = 0, anterior = 0;

  for (const i of ingresos) {
    const { montoARS, fecha } = deriveIngreso(i);
    if (!Number.isFinite(montoARS)) continue;
    total += montoARS;
    if (fecha) {
      const y = fecha.year(), m = fecha.month();
      if (y === ym.y && m === ym.m) actual += montoARS;
      else if (y === ymPrev.y && m === ymPrev.m) anterior += montoARS;
    }
  }

  const cards = [
    { icon: <TrendingUpOutlinedIcon fontSize="small" />, label: "Total ingresos", value: fmtARS.format(total), color: "primary.main" },
    { icon: <PaidOutlinedIcon fontSize="small" />, label: "Este mes", value: fmtARS.format(actual), color: "success.main" },
    { icon: <ReceiptLongOutlinedIcon fontSize="small" />, label: "Mes anterior", value: fmtARS.format(anterior), color: "warning.main" },
  ];

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ mb: 2, flexWrap: "wrap" }}>
      {cards.map((c) => (
        <Paper
          key={c.label}
          variant="outlined"
          sx={{ p: 1.5, borderRadius: 3, minWidth: 180, flex: 1, display: "flex", alignItems: "center", gap: 1.25 }}
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

/* ====== Fila Desktop ====== */
function RowDesktop({ i, onEdit, onDetail }) {
  const { fechaTxt, importeLabel } = deriveIngreso(i);

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
        title={getConcepto(i)}
        sx={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {getConcepto(i)}
      </Typography>

      {/* FECHA */}
      <Typography variant="body2" sx={{ justifySelf: "end", whiteSpace: "nowrap" }} title={fechaTxt}>
        {fechaTxt}
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

      {/* ACCIONES */}
      <Box sx={{ justifySelf: "end", display: "flex", alignItems: "center", gap: 0.25 }}>
        <Stack direction="row" spacing={0.25} className="row-actions" onClick={(e) => e.stopPropagation()}>
          {onEdit && (
            <Tooltip title="Editar ingreso">
              <IconButton size="small" onClick={() => onEdit(i)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Ver detalle">
            <IconButton size="small" onClick={() => onDetail && onDetail(i)}>
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  );
}

/* ====== Pill (mobile) ====== */
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
function RowMobile({ i, onEdit, onDetail }) {
  const { fechaTxt, importeLabel } = deriveIngreso(i);

  return (
    <Paper variant="outlined" sx={{ p: 1.25, mb: 1, borderRadius: 3, "&:active": { transform: "scale(0.998)" } }}>
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
          title={getConcepto(i)}
        >
          {getConcepto(i)}
        </Typography>
        <Stack direction="row" spacing={0.25}>
          {onEdit && (
            <Tooltip title="Editar ingreso">
              <IconButton size="small" onClick={() => onEdit(i)}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Ver detalle">
            <IconButton size="small" onClick={() => onDetail && onDetail(i)}>
              <VisibilityOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }} title={fechaTxt}>
          {fechaTxt}
        </Typography>
        <Chip size="small" label={importeLabel} variant="outlined" sx={{ height: 22, maxWidth: "60%", whiteSpace: "nowrap" }} />
      </Box>

      {/* Info adicional en “píldoras” si quisieras agregar más adelante */}
      <Stack direction="column" spacing={0.6}>
        <Pill>Importe: {importeLabel}</Pill>
      </Stack>
    </Paper>
  );
}

/* ====== Componente principal ====== */
export default function CasoIngresos({ ingresos = [], onEdit, onDetail }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const rows = useMemo(() => {
    const list = (Array.isArray(ingresos) ? ingresos : []).map((i, idx) => ({
      ...i,
      _idx: idx,
    }));
    // En detalle de caso no ordenamos por “caso”, así que los dejamos tal cual o por fecha desc si preferís
    return list.sort((a, b) => {
      const fa = getFechaPago(a)?.valueOf() ?? 0;
      const fb = getFechaPago(b)?.valueOf() ?? 0;
      return fb - fa; // más recientes primero
    });
  }, [ingresos]);

  if (!rows.length) {
    return <Alert severity="info">Aún no hay ingresos registrados para este caso.</Alert>;
  }

  return (
    <Box>
      <IngresosHeader ingresos={rows} />

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
          scrollbarColor: (t) =>
            `${t.palette.action.disabled} ${t.palette.mode === "dark" ? t.palette.background.paper : t.palette.grey[200]}`,
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
              <Box sx={{ justifySelf: "end", whiteSpace: "nowrap" }}>Fecha pago</Box>
              <Box sx={{ justifySelf: "end", whiteSpace: "nowrap" }}>Importe</Box>
            </Box>
          )}

          {rows.map((i) =>
            isMobile ? (
              <RowMobile key={i.id ?? i._idx} i={i} onEdit={onEdit} onDetail={onDetail} />
            ) : (
              <RowDesktop key={i.id ?? i._idx} i={i} onEdit={onEdit} onDetail={onDetail} />
            )
          )}
        </Box>
      </Box>
    </Box>
  );
}
