// src/pages/GastoForm.jsx
import React, { useEffect, useMemo, useRef } from "react";
import { formatCurrency } from "../utils/format";
import { useForm, Controller } from "react-hook-form";
import { useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Paper, Box, TextField, MenuItem, Button, Typography, Alert, CircularProgress,
  Autocomplete, InputAdornment, Chip, Divider,
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import api from "../api/axios";
import { getGasto, createGasto, updateGasto } from "../api/finanzas/gastos";
import { usePermiso } from "../auth/usePermissions";
import UploadAdjuntoButton from "../components/adjuntos/UploadAdjuntoButton";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import es from "date-fns/locale/es";
import { NumericFormat } from "react-number-format";

/* =================== Fetchers reutilizables =================== */
async function fetchClientes() {
  const { data } = await api.get("/clientes", {
    params: { page: 1, pageSize: 500, orderBy: "displayName", order: "asc" },
  });
  return data?.data ?? [];
}
async function fetchCasos() {
  const { data } = await api.get("/casos", {
    params: { page: 1, pageSize: 500, orderBy: "createdAt", order: "desc" },
  });
  return data?.data ?? [];
}
async function fetchParamsByCat(categoriaId) {
  const { data } = await api.get("/parametros", {
    params: { categoriaId, activo: true, page: 1, pageSize: 1000, orderBy: "orden", order: "asc" },
  });
  return Array.isArray(data) ? data : (data?.data ?? []);
}

/** Valor JUS vigente a la fecha — usa tu endpoint existente */
async function fetchValorJus(fechaISO /* YYYY-MM-DD */) {
  if (!fechaISO) return { valor: 0, fecha: null };
  const { data } = await api.get("/valorjus/por-fecha", { params: { fecha: fechaISO } });
  return { valor: Number(data?.valor ?? 0), fecha: data?.fecha ?? fechaISO };
}

/* =================== Utils & helpers =================== */
const Row = ({ cols, children }) => (
  <Box
    sx={{
      display: "grid",
      gap: 2,
      gridTemplateColumns: { xs: "1fr", md: cols },
      alignItems: "start",
      mb: { xs: 1.5, md: 2.5 },
    }}
  >
    {children}
  </Box>
);

function limpiarPayload(values) {
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === "" || v === null || v === undefined) continue;
    out[k] = v;
  }
  return out;
}

// ⇩ Fechas: preservar día local
function toPickerDateOnly(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }
  if (typeof v === "string") {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(v);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function toIsoDateOnlyLocal(d) {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return null;
  const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const off = localMidnight.getTimezoneOffset();
  const local = new Date(localMidnight.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

const displayCliente = (c) => {
  if (!c) return "";
  const rs = (c.razonSocial || "").trim();
  if (rs) return rs;
  const a = (c.apellido || "").trim();
  const n = (c.nombre || "").trim();
  if (a && n) return `${a}, ${n}`;
  return a || n || `#${c.id}`;
};
const displayCaso = (c) => {
  if (!c) return "";
  const exp = (c.nroExpte || "").trim();
  const car = (c.caratula || "").trim();
  return [exp, car].filter(Boolean).join(" — ") || `Caso #${c.id}`;
};
const paramLabel = (p) => (p?.nombre || p?.codigo || `#${p?.id || ""}`);
const isLike = (p, kw) => {
  const s = kw.toUpperCase();
  return (p?.codigo || "").toUpperCase().includes(s) || (p?.nombre || "").toUpperCase().includes(s);
};

function parseCurrencyInput(str) {
  if (str == null) return null;
  const s = String(str)
    .replace(/[^\d.,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/* =================== IDs de categorías =================== */
const CAT_CONCEPTO = 12; // (ajustar si corresponde)
const CAT_MONEDA   = 14;

/* =================== Componente =================== */
export default function GastoForm() {
  const { id } = useParams();
  const editMode = Boolean(id);
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // ===== MODO VER =====
  const pathname = location.pathname || "";
  const isEditPath = /\/finanzas\/gastos\/editar\//.test(pathname);
  const isNumericId = !!id && /^\d+$/.test(String(id));
  const isViewPath = !isEditPath && isNumericId; // .../gastos/:id numérico

  const isViewMode =
    searchParams.get("mode") === "ver" ||
    location.state?.mode === "ver" ||
    location.state?.viewMode === true ||
    isViewPath;

  // Verificaciones de permisos
  const canEditarFinanzas = usePermiso('FINANZAS', 'editar');

  const prefill = location.state?.prefill || location.state?.preset || null;
  const prefillQS = { 
    clienteId: searchParams.get("clienteId"),
    casoId: searchParams.get("casoId")
  };

  // de dónde venimos para Volver/Cancelar
  // Helper para normalizar backTo y preservar la pestaña activa
  const normalizeBackTo = React.useMemo(() => {
    const from = location.state?.from;
    
    // Si viene de un detalle (objeto con pathname)
    if (from && typeof from === 'object' && from.pathname) {
      // Si viene de /finanzas con search (tab=gastos), construir la URL completa
      if (from.pathname === '/finanzas' && from.search) {
        return from.pathname + from.search;
      }
      // Si viene de /finanzas pero sin tab, convertir a /finanzas?tab=gastos
      if (from.pathname === '/finanzas' && !from.search) {
        return "/finanzas?tab=gastos";
      }
      // Si viene de /finanzas/gastos (sin tab), convertir a /finanzas?tab=gastos
      if (from.pathname === '/finanzas/gastos' || from.pathname.includes('/finanzas/gastos')) {
        return "/finanzas?tab=gastos";
      }
      // Si tiene search, construir la URL completa
      if (from.search) {
        return from.pathname + from.search;
      }
      // Para otros casos (detalles de cliente/caso), usar el pathname
      return from.pathname || from;
    }
    
    // Si viene de una ruta de finanzas como string, convertir a formato con tab
    const fromStr = typeof from === 'string' ? from : '';
    if (fromStr.includes('/finanzas/gastos') || (fromStr === '/finanzas')) {
      return "/finanzas?tab=gastos";
    }
    
    // Si from es una string válida (ruta de detalle), usarla
    if (fromStr && (fromStr.startsWith('/clientes/') || fromStr.startsWith('/casos/'))) {
      return fromStr;
    }
    
    // Default: volver a la pestaña de gastos en Finanzas
    return "/finanzas?tab=gastos";
  }, [location.state]);
  
  const backTo = normalizeBackTo;
  
  const cameFromDetail = React.useMemo(() => {
    const from = location.state?.from || "";
    const fromPath = typeof from === 'object' ? from.pathname : from;
    return /^\/(clientes|casos)\//.test(fromPath);
  }, [location.state]);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm({
    defaultValues: {
      fechaGasto: new Date(),
      clienteId: "",
      casoId: "",
      conceptoId: "",
      monedaId: "",
      monto: "",
      descripcion: "",
    },
  });
  
  const watchClienteId = watch('clienteId');
  const watchCasoId = watch('casoId');

  /* ======= Queries ======= */
  const { data: gasto, isLoading: gastoLoading, isError: gastoErr, error: gastoErrObj } = useQuery({
    queryKey: ["gasto", id],
    queryFn: () => getGasto(id),
    enabled: editMode,
  });

  const { data: clientes = [], isLoading: cliLoading, isError: cliErr, error: cliErrObj } = useQuery({
    queryKey: ["clientes-all"],
    queryFn: fetchClientes,
    staleTime: 5 * 60 * 1000,
  });

  const { data: casos = [], isLoading: casosLoading } = useQuery({
    queryKey: ["casos-all"],
    queryFn: fetchCasos,
    staleTime: 5 * 60 * 1000,
  });

  const { data: conceptos = [] } = useQuery({
    queryKey: ["param-conceptos-gasto", CAT_CONCEPTO],
    queryFn: () => fetchParamsByCat(CAT_CONCEPTO),
    staleTime: 10 * 60 * 1000,
  });

  const { data: monedas = [] } = useQuery({
    queryKey: ["param-monedas", CAT_MONEDA],
    queryFn: () => fetchParamsByCat(CAT_MONEDA),
    staleTime: 10 * 60 * 1000,
  });

  // Valor JUS a la fecha seleccionada
  const fechaISO = toIsoDateOnlyLocal(watch("fechaGasto"));
  const { data: valorJusResp } = useQuery({
    queryKey: ["valorJus", fechaISO],
    queryFn: () => fetchValorJus(fechaISO),
    enabled: Boolean(fechaISO),
    retry: false,
    staleTime: 60 * 60 * 1000, // 1h
  });
  const valorJUS = useMemo(() => {
    const n = Number(valorJusResp?.valor);
    return Number.isFinite(n) ? n : null;
  }, [valorJusResp]);

  /* ======= Hidratación en edición ======= */
  useEffect(() => {
    if (!gasto) return;
    reset({
      fechaGasto: toPickerDateOnly(gasto.fechaGasto),
      clienteId: gasto.clienteId ? String(gasto.clienteId) : "",
      casoId: gasto.casoId ? String(gasto.casoId) : "",
      conceptoId: gasto.conceptoId ? String(gasto.conceptoId) : "",
      monedaId: gasto.monedaId ? String(gasto.monedaId) : "",
      monto: gasto.monto != null ? String(gasto.monto) : "",
      descripcion: gasto.descripcion || "",
    });
  }, [gasto, reset]);

  /* ======= Defaults en alta ======= */
  const defaultsSetRef = useRef(false);
  useEffect(() => {
    if (editMode || defaultsSetRef.current) return;
    if (!watch("monedaId") && monedas.length) {
      const ars = monedas.find((m) => isLike(m, "ARS") || isLike(m, "PESO"));
      if (ars) setValue("monedaId", String(ars.id), { shouldDirty: false });
    }
    if (!watch("conceptoId") && conceptos.length) {
      const gto = conceptos.find((c) => isLike(c, "GASTO"));
      if (gto) setValue("conceptoId", String(gto.id), { shouldDirty: false });
    }
    if (monedas.length || conceptos.length) defaultsSetRef.current = true;
  }, [editMode, monedas, conceptos, setValue, watch]);

  // ======= Precarga desde ClienteDetalle o querystring =======
  useEffect(() => {
    if (editMode) return;
    const cid = prefill?.clienteId ?? prefillQS.clienteId;
    const casoId = prefill?.casoId ?? prefillQS.casoId;
    if (cid) setValue("clienteId", String(cid), { shouldDirty: true });
    if (casoId) setValue("casoId", String(casoId), { shouldDirty: true });
  }, [editMode, prefill, prefillQS.clienteId, prefillQS.casoId, setValue]);

  /* ======= Derivados ======= */
  const clienteIdWatch = watch("clienteId");
  const monedaIdWatch = watch("monedaId");

  const monedaSel = useMemo(
    () => (monedas || []).find((m) => String(m.id) === String(monedaIdWatch)) || null,
    [monedas, monedaIdWatch]
  );
  const isARS = useMemo(() => !!monedaSel && (isLike(monedaSel, "ARS") || isLike(monedaSel, "PESO")), [monedaSel]);
  const isJUS = useMemo(() => !!monedaSel && isLike(monedaSel, "JUS"), [monedaSel]);

  /* ======= Mutations ======= */
  const crearMut = useMutation({
    mutationFn: (payload) => createGasto(payload),
    onSuccess: () => {
      enqueueSnackbar("Gasto creado correctamente", { variant: "success" });
      nav(backTo, { replace: true });
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "Error al crear";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const editarMut = useMutation({
    mutationFn: ({ id, body }) => updateGasto(id, body),
    onSuccess: () => {
      enqueueSnackbar("Gasto actualizado", { variant: "success" });
      if (cameFromDetail) {
        nav(`/finanzas/gastos/${id}?mode=ver`, { replace: true, state: { from: backTo, mode: "ver" } });
      } else {
        nav(backTo, { replace: true });
      }
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "Error al actualizar";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  /* ======= Guardar ======= */
  const onSubmit = (values) => {
    if (isViewMode) return;
    if (!values.clienteId) return enqueueSnackbar("Elegí un cliente", { variant: "warning" });
    if (!values.monto) return enqueueSnackbar("Ingresá el monto", { variant: "warning" });
    if (!values.fechaGasto) return enqueueSnackbar("Indicá la fecha del gasto", { variant: "warning" });

    const payload = limpiarPayload({ ...values });

    for (const k of ["clienteId", "casoId", "conceptoId", "monedaId"]) {
      if (payload[k] !== undefined && payload[k] !== "") payload[k] = Number(payload[k]);
    }
    if (payload.fechaGasto) payload.fechaGasto = toIsoDateOnlyLocal(payload.fechaGasto);
    if (payload.monto != null) payload.monto = Number(String(payload.monto).replace(",", "."));

    delete payload.cotizacionARS;

    if (editMode) editarMut.mutate({ id, body: payload });
    else crearMut.mutate(payload);
  };

  // ===== Handlers para Volver/Cancelar/Editar
  const handleBack = () => {
    nav(backTo || "/finanzas?tab=gastos");
  };

  const handleCancelEdit = () => {
    // Volver exactamente a la pantalla anterior (Detalle o Listado, según de dónde viniste)
    nav(backTo || "/finanzas?tab=gastos");
  };

  const handleGoEdit = () => {
    if (!id) return;
    nav(`/finanzas/gastos/editar/${id}`, {
      state: { from: backTo },
    });
  };

  /* ======= Render ======= */
  const loading = isSubmitting || gastoLoading || cliLoading || casosLoading;
  const errorBlock = (gastoErr && gastoErrObj) || (cliErr && cliErrObj);
  const TF = (props) => <TextField fullWidth size="small" {...props} />;

  const casosFiltrados = clienteIdWatch
    ? (casos || []).filter((c) => String(c.clienteId) === String(clienteIdWatch))
    : (casos || []);

  const montoNum = Number((watch("monto") ?? "").toString().replace(",", "."));
  const eqARS = isJUS ? (Number.isFinite(montoNum) ? +(montoNum * (valorJUS || 0)).toFixed(2) : 0) : null;
  const eqJUS = !isJUS ? (valorJUS > 0 && Number.isFinite(montoNum) ? +(montoNum / valorJUS).toFixed(4) : 0) : null;

  const cobradoARS = Number(gasto?.aplicadoARS ?? 0);
  const saldoARS   = Number(gasto?.saldoARS ?? 0);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Paper
        elevation={0}
        sx={{
          mt: 2,
          p: 2,
          borderRadius: 3,
          border: (t) => `1px solid ${t.palette.divider}`,
          bgcolor: (t) => (t.palette.mode === "dark" ? "background.paper" : "#fff"),
        }}
      >
        {/* Header + chips */}
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
            {isViewMode ? "Detalle de gasto" : editMode ? "Editar gasto" : "Nuevo gasto"}
          </Typography>
          {gasto && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              <Chip
                size="small"
                label={`Cobrado: ${formatCurrency(cobradoARS, "ARS")}`}
                color={cobradoARS > 0 ? "primary" : "default"}
              />
              <Chip
                size="small"
                label={`Saldo: ${formatCurrency(saldoARS, "ARS")}`}
                color={saldoARS > 0 ? "warning" : "success"}
              />
            </Box>
          )}
          {loading && <CircularProgress size={18} />}
        </Box>

        {errorBlock && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {gastoErrObj?.message || cliErrObj?.message || "Error cargando datos"}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          {/* ===== Cliente – Caso ===== */}
          <Row cols="2fr 2fr">
            <Controller
              name="clienteId"
              control={control}
              rules={{ required: "Elegí el cliente" }}
              render={({ field }) => (
                <TF
                  select
                  label="Cliente *"
                  {...field}
                  error={!!errors.clienteId}
                  helperText={errors.clienteId?.message}
                  disabled={isViewMode}
                >
                  <MenuItem value="">{ "(sin cliente)" }</MenuItem>
                  {clientes.map((c) => (
                    <MenuItem key={c.id} value={String(c.id)}>
                      {displayCliente(c)}
                    </MenuItem>
                  ))}
                </TF>
              )}
            />

            <Controller
              name="casoId"
              control={control}
              render={({ field }) => {
                const valueObj =
                  (casos || []).find((c) => String(c.id) === String(field.value)) || null;
                return (
                  <Autocomplete
                    options={casosFiltrados}
                    value={valueObj}
                    loading={casosLoading}
                    getOptionLabel={(o) => displayCaso(o)}
                    isOptionEqualToValue={(o, v) => String(o.id) === String(v.id)}
                    onChange={(_e, opt) => field.onChange(opt ? String(opt.id) : "")}
                    renderInput={(params) => <TF {...params} label="Caso" />}
                    disabled={isViewMode}
                  />
                );
              }}
            />
          </Row>

          {/* ===== Concepto – Fecha – Moneda – Monto – Valor/Equivalentes ===== */}
          <Row cols="1fr 1fr 1fr 1fr 1fr 1fr">
            <Controller
              name="conceptoId"
              control={control}
              rules={{ required: "Indicá el concepto" }}
              defaultValue=""
              render={({ field }) => (
                <TF
                  select
                  label="Concepto *"
                  {...field}
                  error={!!errors.conceptoId}
                  helperText={errors.conceptoId?.message}
                  disabled={isViewMode}
                >
                  <MenuItem value="">{ "(sin concepto)" }</MenuItem>
                  {(conceptos || []).map((p) => (
                    <MenuItem key={p.id} value={String(p.id)}>{paramLabel(p)}</MenuItem>
                  ))}
                </TF>
              )}
            />

            <Controller
              name="fechaGasto"
              control={control}
              rules={{ required: "Indicá la fecha" }}
              render={({ field }) => (
                <DatePicker
                  label="Fecha *"
                  value={field.value ? toPickerDateOnly(field.value) : null}
                  onChange={(v) => field.onChange(v)}
                  disabled={isViewMode}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: "small",
                      error: !!errors.fechaGasto,
                      helperText: errors.fechaGasto?.message,
                    },
                  }}
                />
              )}
            />

            <Controller
              name="monedaId"
              control={control}
              rules={{ required: "Elegí la moneda" }}
              render={({ field }) => (
                <TF
                  select
                  label="Moneda *"
                  {...field}
                  error={!!errors.monedaId}
                  helperText={errors.monedaId?.message}
                  onChange={(e) => {
                    const newVal = e.target.value;
                    field.onChange(newVal);
                    setTimeout(() => setValue("monto", "", { shouldDirty: true }), 0);
                  }}
                  disabled={isViewMode}
                >
                  <MenuItem value="">{ "(sin moneda)" }</MenuItem>
                  {(monedas || []).map((p) => (
                    <MenuItem key={p.id} value={String(p.id)}>{paramLabel(p)}</MenuItem>
                  ))}
                </TF>
              )}
            />

            <Controller
              name="monto"
              control={control}
              rules={{ required: "Ingresá el monto" }}
              render={({ field }) => {
                if (isJUS) {
                  return (
                    <NumericFormat
                      customInput={TextField}
                      label="Monto (JUS)"
                      size="small"
                      fullWidth
                      value={field.value ?? ""}
                      allowNegative={false}
                      decimalScale={0}
                      allowLeadingZeros={false}
                      suffix=" JUS"
                      onValueChange={(vals) => field.onChange(vals.value)}
                      onBlur={field.onBlur}
                      disabled={isViewMode}
                    />
                  );
                }
                return (
                  <NumericFormat
                    customInput={TextField}
                    label="Monto"
                    size="small"
                    fullWidth
                    value={field.value ?? ""}
                    thousandSeparator="."
                    decimalSeparator=","
                    decimalScale={2}
                    fixedDecimalScale
                    allowNegative={false}
                    prefix="$ "
                    onValueChange={(vals) => field.onChange(vals.value)}
                    onBlur={field.onBlur}
                    disabled={isViewMode}
                  />
                );
              }}
            />

            <TextField
              fullWidth
              size="small"
              label="Valor JUS (a la fecha)"
              value={valorJUS != null ? formatCurrency(valorJUS, "ARS") : ""}
              placeholder={valorJUS == null ? "—" : ""}
              InputProps={{
                readOnly: true,
                startAdornment: <InputAdornment position="start"></InputAdornment>,
              }}
              disabled={isViewMode} // gris en modo VER
            />

            {isJUS ? (
              <TextField
                fullWidth
                size="small"
                label="Equivalente $"
                value={Number.isFinite(eqARS) ? formatCurrency(eqARS, "ARS") : ""}
                InputProps={{ readOnly: true }}
                disabled={isViewMode} // gris en modo VER
              />
            ) : (
              <TextField
                fullWidth
                size="small"
                label="Equivalente JUS"
                value={Number.isFinite(eqJUS) ? eqJUS : ""}
                InputProps={{ readOnly: true }}
                disabled={isViewMode} // gris en modo VER
              />
            )}
          </Row>

          {/* ===== Descripción ===== */}
          <Row cols="4fr">
            <Controller
              name="descripcion"
              control={control}
              render={({ field }) => (
                <TextField
                  fullWidth
                  size="small"
                  label="Descripción"
                  multiline
                  minRows={1}
                  maxRows={4}
                  {...field}
                  disabled={isViewMode}
                />
              )}
            />
          </Row>

          {/* === Aplicaciones de ingresos === */}
          {editMode && gasto?.aplicaciones && gasto.aplicaciones.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
                Aplicaciones de Ingresos
              </Typography>
              <Box sx={{ display: 'grid', gap: 1 }}>
                {gasto.aplicaciones.map((apl) => (
                  <Paper key={apl.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Ingreso #{apl.ingreso?.id}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7 }}>
                          Fecha: {apl.fechaAplicacion ? new Date(apl.fechaAplicacion).toLocaleDateString("es-AR") : ""}
                        </Typography>
                      </Box>
                      <Chip 
                        label={formatCurrency(apl.montoAplicadoARS, "ARS")}
                        color="success"
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </Box>
                  </Paper>
                ))}
              </Box>
            </>
          )}

          {/* ===== Footer Buttons ===== */}
          <Box sx={{ mt: 1, display: "flex", gap: 1, justifyContent: "space-between", alignItems: "center" }}>
            {!isViewMode && (
              <Box>
                <UploadAdjuntoButton 
                  clienteId={watchClienteId ? Number(watchClienteId) : undefined}
                  casoId={watchCasoId ? Number(watchCasoId) : undefined}
                  disabled={false}
                />
              </Box>
            )}
            <Box sx={{ display: "flex", gap: 1 }}>
              {isViewMode ? (
                <>
                  <Button variant="outlined" onClick={handleBack} disabled={isSubmitting}>
                    Volver
                  </Button>
                  {canEditarFinanzas && (
                    <Button variant="contained" onClick={handleGoEdit} disabled={gastoLoading}>
                      Editar
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button variant="outlined" onClick={handleCancelEdit} disabled={isSubmitting}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="contained" disabled={loading}>
                    {isSubmitting ? "Guardando..." : editMode ? "Guardar cambios" : "Crear gasto"}
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>
    </LocalizationProvider>
  );
}
