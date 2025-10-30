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
   Orden: Concepto | Caso | Importe | Cobrado | Saldo | Estado
   - Scroll horizontal SOLO en la tabla (desktop)
*/
const GRID_COLS = "200px 360px 180px 110px 120px 60px";
const GRID_GAP = 2;

/* ===== Helpers ===== */
const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const fmtNUM = new Intl.NumberFormat("es-AR");

const toText = (v, fallback = "—") => {
  if (v == null) return fallback;
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return (v.nombre ?? v.label ?? v.titulo ?? v.descripcion ?? v.detalle ?? v.text ?? fallback);
};

const isPaid = (n = "") => /pagad|pagado|cobrad|cancelad/.test(n.toLowerCase());
const isPending = (n = "") => /pendient/.test(n.toLowerCase());
const isPartial = (n = "") => /parcial/.test(n.toLowerCase());
const isCanceled = (n = "") => /anulad|cancelad/.test(n.toLowerCase());

const estadoChipColor = (nombre = "") => {
  const n = nombre.toLowerCase();
  if (isPaid(n)) return "success";
  if (isPartial(n)) return "warning";
  if (isCanceled(n)) return "default";
  return "info";
};

const getCaso = (h) => h?.caso?.caratula || h?.casoNombre || "—";
const getConcepto = (h) => h?.concepto?.nombre || h?.conceptoNombre || h?.concepto || "—";
const getEstadoTxt = (h) => toText(h?.estado, "-");

const computeImporteARS = (h) => {
  const mp = Number(h?.montoARS ?? h?.montoPesos);
  if (Number.isFinite(mp)) return mp;
  const jus = Number(h?.montoJUS ?? h?.jus);
  const vj = Number(h?.valorJusRef);
  if (Number.isFinite(jus) && Number.isFinite(vj)) return jus * vj;
  return null;
};
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

function HonorariosHeader({ honorarios = [] }) {
  let totalARS = 0, sumCobrados = 0, sumPendientes = 0;

  for (const h of honorarios) {
    const importe = computeImporteARS(h) || 0;          // total del honorario en ARS (ref)
    const cobrado = computeCobradoARS(h) || 0;          // realmente cobrado en ARS
    totalARS += importe;
    sumCobrados += cobrado;
    sumPendientes += Math.max(importe - cobrado, 0);    // saldo real en ARS
  }

  const cards = [
    { icon: <TrendingUpOutlinedIcon fontSize="small" />, label: "Total honorarios", value: fmtARS.format(totalARS), color: "primary.main" },
    { icon: <PaidOutlinedIcon fontSize="small" />, label: "Cobrados", value: fmtARS.format(sumCobrados), color: "success.main" },
    { icon: <ReceiptLongOutlinedIcon fontSize="small" />, label: "Pendientes", value: fmtARS.format(sumPendientes), color: "warning.main" },
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
function RowDesktop({ h, onEdit, onDetail }) {
  const estado = getEstadoTxt(h);
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
        // Acciones al hover
        "& .row-actions": { opacity: 0, transition: "opacity 120ms ease" },
        "&:hover .row-actions": { opacity: 1 },
      }}
    >
      {/* CONCEPTO */}
      <Typography
        variant="body2"
        title={getConcepto(h)}
        sx={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
      >
        {getConcepto(h)}
      </Typography>

      {/* CASO */}
      <Typography
        variant="body2"
        title={getCaso(h)}
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
        {getCaso(h)}
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

      {/* ESTADO + ACCIONES */}
      <Box
        sx={{
          justifySelf: "end",
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          "& .row-actions": { opacity: 0, transition: "opacity 150ms ease" },
          "&:hover .row-actions": { opacity: 1 },
        }}
      >
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

/* ====== Píldora (para mobile) ====== */
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

/* ====== Fila Mobile (mejorada) ====== */
function RowMobile({ h, onEdit, onDetail }) {
  const estado = getEstadoTxt(h);
  const { importeLabel, cobradoARS, saldoARS } = deriveMoney(h);

  return (
    <Paper
      variant="outlined"
      sx={{ p: 1.25, mb: 1, borderRadius: 3, "&:active": { transform: "scale(0.998)" } }}
    >
      {/* Título: Caso */}
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
          title={getCaso(h)}
        >
          {getCaso(h)}
        </Typography>

        {/* Acciones (mobile) */}
        <Stack
          direction="row"
          spacing={0.25}
          sx={{ flexShrink: 0, ml: 0.5 }}
          onClick={(e) => e.stopPropagation()}
        >
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

      {/* Concepto (izq) + Estado (der) */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75, minWidth: 0 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={getConcepto(h)}
        >
          {getConcepto(h)}
        </Typography>
        <Chip
          size="small"
          label={estado}
          color={estadoChipColor(estado)}
          variant="outlined"
          sx={{ height: 22, maxWidth: "50%", whiteSpace: "nowrap" }}
        />
      </Box>

      {/* Importe / Cobrado / Saldo en columna */}
      <Stack direction="column" spacing={0.6}>
        <Pill>Importe: {importeLabel}</Pill>
        <Pill>Cobrado: {fmtARS.format(cobradoARS || 0)}</Pill>
        <Pill>Saldo: {saldoARS != null ? fmtARS.format(saldoARS) : "—"}</Pill>
      </Stack>
    </Paper>
  );
}

/* ====== Componente principal ====== */
export default function ClienteHonorarios({
  honorarios = [],
  onEdit,
  onDetail,
}) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const safeList = Array.isArray(honorarios) ? honorarios : [];

  const rows = useMemo(() => {
    const list = (safeList || []).map((h, i) => ({
      ...h,
      _key: (getCaso(h) || "").toString().toUpperCase(),
      _idx: i,
    }));
    return list.sort((a, b) => a._key.localeCompare(b._key, "es", { sensitivity: "base" }));
  }, [safeList]);

  if (!rows.length) {
    return <Alert severity="info">Aún no hay honorarios registrados para este cliente.</Alert>;
  }

  return (
    <Box>
      <HonorariosHeader honorarios={rows} />

      {/* ===== Tabla: desktop con scroll horizontal; mobile sin scroll lateral ===== */}
      <Box
        sx={{
          overflowX: { xs: "hidden", md: "auto" }, // mobile sin scroll lateral
          borderRadius: 2,
          "&::-webkit-scrollbar": { height: 8 },
          "&::-webkit-scrollbar-thumb": (t) => ({ backgroundColor: t.palette.action.disabled, borderRadius: 8 }),
          "&::-webkit-scrollbar-track": (t) => ({
            backgroundColor: t.palette.mode === "dark" ? t.palette.background.paper : t.palette.grey[200],
            borderRadius: 8,
          }),
          scrollbarColor: (t) =>
            `${t.palette.action.disabled} ${
              t.palette.mode === "dark" ? t.palette.background.paper : t.palette.grey[200]
            }`,
        }}
      >
        <Box sx={{ width: { xs: "100%", md: "max-content" }, minWidth: "100%" }}>
          {/* Header solo en desktop */}
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

          {/* Filas */}
          {rows.map((h) =>
            isMobile ? (
              <RowMobile key={h.id ?? h._idx} h={h} onEdit={onEdit} onDetail={onDetail} />
            ) : (
              <RowDesktop key={h.id ?? h._idx} h={h} onEdit={onEdit} onDetail={onDetail} />
            )
          )}
        </Box>
      </Box>
    </Box>
  );
}
