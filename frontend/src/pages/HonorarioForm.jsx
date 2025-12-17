// src/pages/HonorarioForm.jsx
import React, { useEffect, useMemo, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Paper, Box, TextField, MenuItem, Button, Typography, Alert, CircularProgress,
  Autocomplete, InputAdornment, FormControlLabel, Switch, Divider, Table, TableHead, TableRow, TableCell, TableBody,
  Chip
} from "@mui/material";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { enqueueSnackbar } from "notistack";
import api from "../api/axios";
import { formatCurrency } from "../utils/format";
import { usePermiso } from "../auth/usePermissions";
import UploadAdjuntoButton from "../components/adjuntos/UploadAdjuntoButton";

import {
  getHonorario,
  createHonorario,
  updateHonorario,
  getValorJusActual,
  getValorJusPorFecha,
} from "../api/finanzas/honorarios";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import es from "date-fns/locale/es";

/* =================== Fetchers =================== */
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

/* =================== Utils =================== */
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

/** Fechas (local day) */
function toPickerDateOnly(v) {
  if (!v) return null;

  // Si ya es Date:
  if (v instanceof Date) {
    if (isNaN(v)) return null;
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }

  // Si viene como string, probá primero el formato YYYY-MM-DD completo
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-").map((n) => parseInt(n, 10));
    return new Date(y, m - 1, d);
  }

  // Fallback: intentá parsear; si es inválido, devolvé null
  const d = new Date(s);
  if (isNaN(d)) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** YYYY-MM-DD local o null, sin tirar errores */
function toIsoDateOnlyLocal(d) {
  if (!d) return null;

  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return null;

  const onlyDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const tzOffsetMin = onlyDate.getTimezoneOffset(); // minutos
  const local = new Date(onlyDate.getTime() - tzOffsetMin * 60000);
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

// Convertir periodicidad a días (igual que backend)
const periodicidadToDays = (codeOrName, diasPersonalizados) => {
  const c = String(codeOrName || "").toUpperCase();
  if (c.includes("SEMANAL")) return 7;
  if (c.includes("QUINCENAL")) return 15;
  if (c.includes("MENSUAL")) return 30;
  if (c.includes("PERSONALIZADA")) return Math.max(1, Number(diasPersonalizados || 0));
  return 30; // default
};

/* =================== IDs =================== */
const CAT_CONCEPTO     = 10;
const CAT_PARTE        = 11;
const CAT_MONEDA       = 14;
const CAT_ESTADO       = 16;
const CAT_PERIODICIDAD = 18;
const CAT_POLITICA_JUS = 20;

const ID_POLI_FECHA_REG = 168;
const ID_POLI_ACTUAL    = 169;

function estadoChipColor(nombre = "") {
  const s = String(nombre).toUpperCase();
  if (s.includes("PEND"))   return "warning";
  if (s.includes("PARC"))   return "info";
  if (s.includes("PAGA"))   return "success";
  if (s.includes("VENC"))   return "error";
  if (s.includes("ANUL"))   return "default";
  return "default";
}

function CuotasGrid({ plan, isJus, formatCurrency }) {
  const cuotas = Array.isArray(plan?.cuotas) ? plan.cuotas : [];
  return (
    <Box sx={{ overflow: "auto", borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}`, boxShadow: 1 }}>
      <Table size="small" stickyHeader sx={{ "& td, & th": { borderBottom: (t) => `1px solid ${t.palette.divider}`, lineHeight: 1.6, padding: '12px 16px', fontSize: '0.875rem' } }}>
        <TableHead>
          <TableRow sx={{ "& th": { bgcolor: (t) => (t.palette.mode === "dark" ? "background.default" : "#f5f5f5"), fontWeight: 600, fontSize: '0.875rem' } }}>
            <TableCell sx={{ width: 90 }}>Nro. Cuota</TableCell>
            <TableCell sx={{ width: 160 }}>Vencimiento</TableCell>
            <TableCell sx={{ width: 180 }} align="right">Monto</TableCell>
            <TableCell sx={{ width: 140 }} align="right">Cant. Pagos</TableCell>
            <TableCell sx={{ width: 140 }}>Fecha Pagos</TableCell>
            <TableCell sx={{ width: 140 }} align="right">Saldo</TableCell>
            <TableCell sx={{ width: 140 }}>Estado</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody sx={{ "& tr:nth-of-type(odd)": { backgroundColor: (t) => (t.palette.mode === "dark" ? "transparent" : "#fafafa") } }}>
          {cuotas.map((c) => {
            const venc = c.vencimiento ? new Date(c.vencimiento).toLocaleDateString("es-AR") : "-";
            const monto = isJus ? `${parseInt(c.montoJus || 0, 10)} JUS` : (c.montoPesos != null ? formatCurrency(Number(c.montoPesos), "ARS") : "");
            
            // Valores calculados por el backend
            const aplicadoARS = Number(c.aplicadoARS || 0);
            const aplicadoJUS = Number(c.aplicadoJUS || 0);
            const saldoARS = Number(c.saldoARS || 0);
            const saldoJUS = Number(c.saldoJUS || 0);
            
            const cobrado = isJus 
              ? `${aplicadoJUS.toFixed(2)} JUS` 
              : formatCurrency(aplicadoARS, "ARS");
            
            const saldo = isJus
              ? `${saldoJUS.toFixed(2)} JUS`
              : formatCurrency(saldoARS, "ARS");
            
            const estadoNombre = c?.estado?.nombre || "—";
            const pagos = Array.isArray(c.aplicaciones) ? c.aplicaciones : [];
            const pagosCount = pagos.length;
            const fechasPagas = pagos.map(a => 
              new Date(a.fechaAplicacion).toLocaleDateString("es-AR")
            );
            
            return (
              <TableRow key={c.id ?? `${c.planId}-${c.numero}`}>
                <TableCell>{c.numero}</TableCell>
                <TableCell>{venc}</TableCell>
                <TableCell align="right">{monto}</TableCell>
                <TableCell align="right">
                  {pagosCount > 0 ? (
                    <Chip 
                      size="small" 
                      label={pagosCount} 
                      variant="outlined" 
                      color="primary"
                      sx={{ fontWeight: 600, fontSize: 'inherit' }}
                    />
                  ) : (
                    <Typography variant="body2" sx={{ fontSize: 'inherit', opacity: 0.4 }}>0</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {fechasPagas.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                      {fechasPagas.map((fecha, i) => (
                        <Typography key={i} variant="body2" sx={{ fontSize: 'inherit', color: 'text.primary' }}>
                          {fecha}
                        </Typography>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ fontSize: 'inherit', opacity: 0.4, fontStyle: 'italic' }}>—</Typography>
                  )}
                </TableCell>
                <TableCell align="right">{saldo}</TableCell>
                <TableCell>
                  <Chip 
                    size="small" 
                    label={estadoNombre} 
                    color={estadoChipColor(estadoNombre)} 
                    variant={estadoChipColor(estadoNombre) === "default" ? "outlined" : "filled"} 
                  />
                </TableCell>
                <TableCell />
              </TableRow>
            );
          })}
          {cuotas.length === 0 && (
            <TableRow>
              <TableCell colSpan={8}>
                <Box sx={{ py: 4, textAlign: "center", opacity: 0.8 }}>
                  <Typography variant="body2">Este plan no tiene cuotas para mostrar.</Typography>
                </Box>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Box>
  );
}

/* =================== Componente =================== */
export default function HonorarioForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();

  // --- MODO ---
  const search = new URLSearchParams(location.search);
  const queryMode = (search.get("mode") || "").toLowerCase();

  const isCreate = !id;
  const isEdit   = !!id && /\/editar\//.test(location.pathname);
  const isView   = !!id && !isEdit || queryMode === "view";

  // Verificaciones de permisos
  const canEditarFinanzas = usePermiso('FINANZAS', 'editar');

  // Helper para normalizar backTo y preservar la pestaña activa
  const normalizeBackTo = useMemo(() => {
    const from = location.state?.from;
    
    // Si viene de un detalle (objeto con pathname), usarlo tal cual
    if (from && typeof from === 'object' && from.pathname) {
      return from;
    }
    
    // Si viene de una ruta de finanzas, convertir a formato con tab
    const fromStr = typeof from === 'string' ? from : '';
    if (fromStr.includes('/finanzas/honorarios') || (fromStr.includes('/finanzas') && !fromStr.includes('?'))) {
      return "/finanzas?tab=honorarios";
    }
    
    // Si from es una string válida (ruta de detalle), usarla
    if (fromStr && (fromStr.startsWith('/clientes/') || fromStr.startsWith('/casos/'))) {
      return fromStr;
    }
    
    // Default: volver a la pestaña de honorarios en Finanzas
    return "/finanzas?tab=honorarios";
  }, [location.state]);
  
  const backTo = normalizeBackTo;

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm({
    defaultValues: {
      fechaRegulacion: new Date(),
      clienteId: "",
      casoId: "",
      conceptoId: "",
      parteId: "",
      monedaId: "",
      estadoId: "",
      jus: "",
      montoPesos: "",
      politicaJusId: "",
      plan: {
        crear: true, // Obligatorio crear plan al crear honorario
        cantCuotas: "1",
        fechaPrimera: "",
        periodicidadId: "",
        diasPersonalizados: "",
        montoPorCuota: "",
        politicaJusId: "",
      },
    },
  });
  
  const watchClienteId = watch('clienteId');
  const watchCasoId = watch('casoId');

  /* ======= Queries base ======= */
  const { data: honorario, isLoading: honLoading, isError: honErr, error: honErrObj } = useQuery({
    queryKey: ["honorario", id],
    queryFn: () => getHonorario(id),
    enabled: !!id, // ver o editar
  });

  // Verificar si hay plan con cuotas pagas
  const planConPagos = useMemo(() => {
    if (!honorario?.planes?.[0]) return null;
    const plan = honorario.planes[0];
    const cuotas = plan.cuotas || [];
    const pagas = cuotas.filter(c => {
      // El backend calcula y agrega: aplicadoARS, aplicadoJUS, saldoARS, saldoJUS, isPagada
      const aplicadoARS = Number(c.aplicadoARS || 0);
      const aplicadoJUS = Number(c.aplicadoJUS || 0);
      const tienePagos = aplicadoARS > 0 || aplicadoJUS > 0;
      const esPaga = c.isPagada === true;
      return tienePagos || esPaga;
    });
    return {
      planId: plan.id,
      totalCuotas: cuotas.length,
      cuotasPagas: pagas.length,
      tieneCuotasPagas: pagas.length > 0
    };
  }, [honorario]);

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

  const { data: partes = [] }    = useQuery({ queryKey: ["param-partes", CAT_PARTE],    queryFn: () => fetchParamsByCat(CAT_PARTE),    staleTime: 10 * 60 * 1000 });
  const { data: conceptos = [] } = useQuery({ queryKey: ["param-conceptos", CAT_CONCEPTO], queryFn: () => fetchParamsByCat(CAT_CONCEPTO), staleTime: 10 * 60 * 1000 });
  const { data: monedas = [] }   = useQuery({ queryKey: ["param-monedas", CAT_MONEDA],   queryFn: () => fetchParamsByCat(CAT_MONEDA),   staleTime: 10 * 60 * 1000 });
  const { data: estados = [] }   = useQuery({ queryKey: ["param-estados", CAT_ESTADO],   queryFn: () => fetchParamsByCat(CAT_ESTADO),   staleTime: 10 * 60 * 1000 });
  const { data: periodicidades = [] } = useQuery({ queryKey: ["param-periodicidad", CAT_PERIODICIDAD], queryFn: () => fetchParamsByCat(CAT_PERIODICIDAD), staleTime: 10 * 60 * 1000 });
  const { data: politicasJus = [] }   = useQuery({ queryKey: ["param-politicas-jus", CAT_POLITICA_JUS], queryFn: () => fetchParamsByCat(CAT_POLITICA_JUS), staleTime: 10 * 60 * 1000 });

  // JUS actual
  const { data: valorJusHoy } = useQuery({
    queryKey: ["valor-jus-actual"],
    queryFn: getValorJusActual,
    staleTime: 10 * 60 * 1000,
  });
  const valorJusNum = useMemo(() => {
    const n = Number(valorJusHoy?.valor ?? valorJusHoy);
    return Number.isFinite(n) ? n : null;
  }, [valorJusHoy]);

  /* ======= Defaults en alta ======= */
  const defaultsSetRef = useRef(false);
  const watchField = watch; // alias breve

  useEffect(() => {
    if (!isCreate || defaultsSetRef.current) return;

    if (!watchField("parteId") && partes.length) {
      const d = partes.find(p => isLike(p, "CLIENTE"));
      if (d) setValue("parteId", String(d.id), { shouldDirty: false });
    }
    if (!watchField("monedaId") && monedas.length) {
      const d = monedas.find(p => isLike(p, "JUS"));
      if (d) setValue("monedaId", String(d.id), { shouldDirty: false });
    }
    if (!watchField("estadoId") && estados.length) {
      const d = estados.find(p => isLike(p, "PENDIENTE"));
      if (d) setValue("estadoId", String(d.id), { shouldDirty: false });
    }
    if (!watchField("plan.periodicidadId") && periodicidades.length) {
      const mensual = periodicidades.find(p => isLike(p, "MENSUAL"));
      if (mensual) setValue("plan.periodicidadId", String(mensual.id), { shouldDirty: false });
    }
    // Default de política JUS en el plan: FECHA_REGULACION (id 168)
    if (!watchField("plan.politicaJusId") && politicasJus.length) {
      const poli =
        politicasJus.find(p => String(p.id) === String(ID_POLI_FECHA_REG)) ||
        politicasJus.find(p => isLike(p, "REGULACION"));
      if (poli) setValue("plan.politicaJusId", String(poli.id), { shouldDirty: false });
    }

    if (partes.length || monedas.length || estados.length || periodicidades.length || politicasJus.length) {
      defaultsSetRef.current = true;
    }
  }, [isCreate, partes, monedas, estados, periodicidades, politicasJus, setValue, watchField]);

  /* ======= Derivados/watch ======= */
  const clienteIdWatch = watch("clienteId");
  const monedaIdWatch  = watch("monedaId");
  const jusWatch       = watch("jus");
  const montoPesosWatch = watch("montoPesos");
  const politicaJusWatch = watch("plan.politicaJusId");
  const fechaRegulacionWatch = watch("fechaRegulacion");

  const monedaSel = useMemo(
    () => monedas.find((m) => String(m.id) === String(monedaIdWatch)) || null,
    [monedas, monedaIdWatch]
  );
  const isJUS = useMemo(() => !!monedaSel && isLike(monedaSel, "JUS"), [monedaSel]);

  /* ======= Valor JUS de la fecha de regulación (siempre para el honorario) ======= */
  const { data: valorJusPorFechaReg } = useQuery({
    queryKey: ["valor-jus-por-fecha-regulacion", fechaRegulacionWatch],
    queryFn: async () => {
      const fechaISO = fechaRegulacionWatch
        ? toIsoDateOnlyLocal(fechaRegulacionWatch)
        : new Date().toISOString().slice(0, 10);
      return await getValorJusPorFecha(fechaISO);
    },
    enabled: Boolean(fechaRegulacionWatch && isJUS),
    staleTime: 5 * 60 * 1000,
  });

  /* ======= Valor JUS según política (solo para el plan) ======= */
  const { data: valorJusSel } = useQuery({
    queryKey: ["valor-jus-segun-politica", politicaJusWatch, fechaRegulacionWatch],
    queryFn: async () => {
      if (String(politicaJusWatch) === String(ID_POLI_ACTUAL)) {
        return await getValorJusActual();
      }
      const fechaISO = fechaRegulacionWatch
        ? toIsoDateOnlyLocal(fechaRegulacionWatch)
        : new Date().toISOString().slice(0, 10);
      return await getValorJusPorFecha(fechaISO);
    },
    enabled: Boolean(politicaJusWatch && isJUS),
    staleTime: 5 * 60 * 1000,
  });

  // Valor JUS para el honorario: siempre de la fecha de regulación
  const valorJusNumber = useMemo(() => {
    // Si es edición, usar el valor guardado del honorario
    if (honorario?.valorJusRef != null && Number.isFinite(Number(honorario.valorJusRef))) {
      return Number(honorario.valorJusRef);
    }
    // Si es creación/edición, usar el valor de la fecha de regulación
    const vReg = valorJusPorFechaReg?.valor ?? valorJusPorFechaReg;
    if (vReg != null && Number.isFinite(Number(vReg))) {
      return Number(vReg);
    }
    // Fallback al valor actual
    if (valorJusNum != null && Number.isFinite(Number(valorJusNum))) return Number(valorJusNum);
    return null;
  }, [valorJusPorFechaReg, honorario, valorJusNum]);

  const importeCalculado = useMemo(() => {
    const cant = parseInt(String(jusWatch || "0"), 10);
    const vj = Number(valorJusNumber || 0);
    if (!isJUS || !cant || !vj) return "";
    return (cant * vj).toFixed(2);
  }, [isJUS, jusWatch, valorJusNumber]);

  /* ======= Hidratación en edición/visualización ======= */
  useEffect(() => {
    if (!honorario) return;
    reset({
      fechaRegulacion: toPickerDateOnly(honorario.fechaRegulacion),
      clienteId: honorario.clienteId ? String(honorario.clienteId) : "",
      casoId: honorario.casoId ? String(honorario.casoId) : "",
      conceptoId: honorario.conceptoId ? String(honorario.conceptoId) : "",
      parteId: honorario.parteId ? String(honorario.parteId) : "",
      monedaId: honorario.monedaId ? String(honorario.monedaId) : "",
      estadoId: honorario.estadoId ? String(honorario.estadoId) : "",
      jus: honorario.jus != null ? String(honorario.jus) : "",
      montoPesos: honorario.montoPesos != null ? String(honorario.montoPesos) : "",
      politicaJusId: honorario.politicaJusId ? String(honorario.politicaJusId) : "",
      plan: { crear: false, periodicidadId: "", diasPersonalizados: "", cantCuotas: "", fechaPrimera: "", montoPorCuota: "", politicaJusId: "" },
    });
  }, [honorario, reset]);

  // ========= Precargar cliente/caso en alta =========
  useEffect(() => {
    if (!isCreate) return;

    const prefillState = location.state?.prefill || null;
    const searchParams = new URLSearchParams(location.search);

    const prefillQS = {
      clienteId: searchParams.get("clienteId"),
      casoId: searchParams.get("casoId"),
    };

    const cid = prefillState?.clienteId ?? prefillQS.clienteId;
    const casoId = prefillState?.casoId ?? prefillQS.casoId;

    if (cid) setValue("clienteId", String(cid), { shouldDirty: false });
    if (casoId) setValue("casoId", String(casoId), { shouldDirty: false });
  }, [isCreate, location.state, location.search, setValue]);


  /* ======= Mutations ======= */
  const crearMut = useMutation({
    mutationFn: (payload) => createHonorario(payload),
    onSuccess: () => {
      enqueueSnackbar("Honorario creado correctamente", { variant: "success" });
      nav(backTo, { replace: true });
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "Error al crear";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const editarMut = useMutation({
    mutationFn: ({ id, body }) => updateHonorario(id, body),
    onSuccess: () => {
      enqueueSnackbar("Honorario actualizado", { variant: "success" });
      nav(backTo, { replace: true });
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "Error al actualizar";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  /* ======= Guardar ======= */
  const onSubmit = (values) => {
    if (isView) return; // seguridad: en modo ver no guarda

    if (isJUS) {
      if (!values.jus) {
        enqueueSnackbar("Ingresá la Cantidad de JUS", { variant: "warning" });
        return;
      }
    } else {
      if (!values.montoPesos) {
        enqueueSnackbar("Ingresá el Importe", { variant: "warning" });
        return;
      }
    }

    const payload = limpiarPayload({ ...values });

    // numéricos
    for (const k of ["clienteId", "casoId", "conceptoId", "parteId", "monedaId", "estadoId", "politicaJusId"]) {
      if (payload[k] !== undefined && payload[k] !== "") payload[k] = Number(payload[k]);
    }

    // fecha
    if (payload.fechaRegulacion) payload.fechaRegulacion = toIsoDateOnlyLocal(payload.fechaRegulacion);

    if (isJUS) {
      payload.jus = parseInt(payload.jus, 10);

      let jusRef = honorario?.valorJusRef != null ? Number(honorario.valorJusRef) : null;

      if (jusRef == null) {
        if (valorJusNumber != null && Number.isFinite(Number(valorJusNumber))) {
          jusRef = Number(valorJusNumber);
        }
      }

      if (jusRef != null) {
        payload.valorJusRef = jusRef;
        payload.montoPesos = Number((payload.jus * jusRef).toFixed(2));
      }
         } else {
       payload.montoPesos = Number(payload.montoPesos);
       delete payload.jus;
     }

    // Plan: obligatorio en creación, opcional en edición
    if (isCreate) {
      // En creación, siempre crear el plan (obligatorio)
      const p = values.plan || {};
      const periodicidadIdNum = p.periodicidadId ? Number(p.periodicidadId) : null;
      
      // Si no se especificó periodicidad, usar MENSUAL por defecto
      let periodicidadFinal = periodicidadIdNum;
      if (!periodicidadFinal) {
        const mensual = (periodicidades || []).find(pp => isLike(pp, "MENSUAL"));
        periodicidadFinal = mensual ? mensual.id : null;
        if (!periodicidadFinal) {
          enqueueSnackbar("Elegí la periodicidad", { variant: "warning" });
          return;
        }
      }
      
      const paramSel = (periodicidades || []).find(pp => String(pp.id) === String(periodicidadFinal));
      const esPers = paramSel ? isLike(paramSel, "PERSONALIZADA") : false;

      // Calcular monto por cuota si no se especificó
      const cantCuotas = Number(p.cantCuotas || 1);
      let montoPorCuota = p.montoPorCuota ? Number(p.montoPorCuota) : null;
      if (!montoPorCuota || montoPorCuota <= 0) {
        // Calcular automáticamente según el total del honorario
        if (isJUS) {
          montoPorCuota = Number(jusWatch) / cantCuotas;
        } else {
          montoPorCuota = Number(montoPesosWatch) / cantCuotas;
        }
      }

             // Validar política JUS si es obligatoria
       if (isJUS && !p.politicaJusId) {
         enqueueSnackbar("Elegí la política de JUS para el plan", { variant: "warning" });
         return;
       }

       payload.plan = {
         crear: true,
         cantidad: cantCuotas,
         fechaPrimera: p.fechaPrimera || toIsoDateOnlyLocal(new Date()),
         periodicidadId: periodicidadFinal,
         ...(esPers ? { periodicidadDias: Number(p.diasPersonalizados || 30) } : {}),
         ...(isJUS
           ? { montoCuotaJus: montoPorCuota }
           : { montoCuotaPesos: montoPorCuota }),
         ...(isJUS && p.politicaJusId ? { politicaJusId: Number(p.politicaJusId) } : {}),
       };
    } else if (values?.plan?.crear) {
      // En edición, solo crear plan si se marca el switch
      const p = values.plan;
      const periodicidadIdNum = p.periodicidadId ? Number(p.periodicidadId) : null;
      if (!periodicidadIdNum) {
        enqueueSnackbar("Elegí la periodicidad", { variant: "warning" });
        return;
      }
      const paramSel = (periodicidades || []).find(pp => String(pp.id) === String(periodicidadIdNum));
      const esPers = paramSel ? isLike(paramSel, "PERSONALIZADA") : false;

      // Validar política JUS si es obligatoria
      if (isJUS && !p.politicaJusId) {
        enqueueSnackbar("Elegí la política de JUS para el plan", { variant: "warning" });
        return;
      }

      payload.plan = {
        crear: true,
        cantidad: Number(p.cantCuotas || 1),
        fechaPrimera: p.fechaPrimera || toIsoDateOnlyLocal(new Date()),
        periodicidadId: periodicidadIdNum,
        ...(esPers ? { periodicidadDias: Number(p.diasPersonalizados || 0) } : {}),
        ...(isJUS
          ? { montoCuotaJus: p.montoPorCuota ? Number(p.montoPorCuota) : null }
          : { montoCuotaPesos: p.montoPorCuota ? Number(p.montoPorCuota) : null }),
        ...(isJUS && p.politicaJusId ? { politicaJusId: Number(p.politicaJusId) } : {}),
      };
    } else {
      delete payload.plan;
    }

    if (isEdit) editarMut.mutate({ id, body: payload });
    else crearMut.mutate(payload);
  };

  /* ======= Render ======= */
  const loading = isSubmitting || honLoading || cliLoading || casosLoading;
  const errorBlock = (honErr && honErrObj) || (cliErr && cliErrObj);

  const ro = isView; // read-only flag

  const TF = (props) => (
    <TextField
      fullWidth
      size="small"
      {...props}
      disabled={ro || props.disabled}
      InputProps={{
        ...props.InputProps,
        readOnly: ro && !props.select, // select usa disabled
      }}
    />
  );

  const casosFiltrados = clienteIdWatch
    ? (casos || []).filter((c) => String(c.clienteId) === String(clienteIdWatch))
    : (casos || []);

  const planCrearWatch = watch("plan.crear");
  const periodicidadIdWatch = watch("plan.periodicidadId");
  const paramPeriodicidadSel = useMemo(
    () => (periodicidades || []).find(p => String(p.id) === String(periodicidadIdWatch)) || null,
    [periodicidades, periodicidadIdWatch]
  );
  const esPersonalizada = useMemo(
    () => !!paramPeriodicidadSel && isLike(paramPeriodicidadSel, "PERSONALIZADA"),
    [paramPeriodicidadSel]
  );

  const poliSel = useMemo(
    () => (politicasJus || []).find(p => String(p.id) === String(politicaJusWatch)) || null,
    [politicasJus, politicaJusWatch]
  );

  const title = isCreate ? "Nuevo honorario" : (isEdit ? "Editar honorario" : "Detalle de honorario");

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Paper elevation={0} sx={{ mt: 2, p: 2, borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}`, bgcolor: (t) => (t.palette.mode === "dark" ? "background.paper" : "#fff") }}>
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
            {title}
          </Typography>
          {loading && <CircularProgress size={18} />}
        </Box>

        {errorBlock && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {honErrObj?.message || cliErrObj?.message || "Error cargando datos"}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          {/* === Cliente – Caso === */}
          <Row cols="2fr 2fr">
            <Controller
              name="clienteId"
              control={control}
              render={({ field }) => (
                <TF select label="Cliente" {...field}>
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
                const valueObj = (casos || []).find((c) => String(c.id) === String(field.value)) || null;
                return (
                  <Autocomplete
                    options={casosFiltrados}
                    value={valueObj}
                    loading={casosLoading}
                    getOptionLabel={(o) => displayCaso(o)}
                    isOptionEqualToValue={(o, v) => String(o.id) === String(v.id)}
                    onChange={(_e, opt) => field.onChange(opt ? String(opt.id) : "")}
                    renderInput={(params) => <TF {...params} label="Caso" />}
                    disabled={ro}
                  />
                );
              }}
            />
          </Row>

          {/* === Parte – Concepto – Fecha – Estado === */}
          <Row cols="1fr 1fr 1fr 1fr">
            <Controller
              name="parteId"
              control={control}
              rules={!ro ? { required: "Indicá la Parte" } : undefined}
              render={({ field }) => (
                <TF select label="Parte *" {...field} error={!!errors.parteId} helperText={errors.parteId?.message}>
                  <MenuItem value="">{ "(sin parte)" }</MenuItem>
                  {partes.map((p) => (<MenuItem key={p.id} value={String(p.id)}>{paramLabel(p)}</MenuItem>))}
                </TF>
              )}
            />
            <Controller
              name="conceptoId"
              control={control}
              rules={!ro ? { required: "Indicá el Concepto" } : undefined}
              render={({ field }) => (
                <TF select label="Concepto *" {...field} error={!!errors.conceptoId} helperText={errors.conceptoId?.message}>
                  <MenuItem value="">{ "(sin concepto)" }</MenuItem>
                  {conceptos.map((p) => (<MenuItem key={p.id} value={String(p.id)}>{paramLabel(p)}</MenuItem>))}
                </TF>
              )}
            />
            <Controller
              name="fechaRegulacion"
              control={control}
              rules={!ro ? { required: "Indicá la fecha de regulación" } : undefined}
              render={({ field }) => (
                <DatePicker
                  label="Fecha de regulación *"
                  value={field.value ? toPickerDateOnly(field.value) : null}
                  onChange={(v) => field.onChange(v)}
                  disabled={ro}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: "small",
                      error: !!errors.fechaRegulacion,
                      helperText: errors.fechaRegulacion?.message,
                      InputProps: { readOnly: ro },
                    },
                    actionBar: { actions: [] },
                  }}
                />
              )}
            />
            <Controller
              name="estadoId"
              control={control}
              rules={!ro ? { required: "Elegí el estado" } : undefined}
              render={({ field }) => (
                <TF select label="Estado *" {...field} error={!!errors.estadoId} helperText={errors.estadoId?.message}>
                  <MenuItem value="">{ "(sin estado)" }</MenuItem>
                  {estados.map((p) => (<MenuItem key={p.id} value={String(p.id)}>{paramLabel(p)}</MenuItem>))}
                </TF>
              )}
            />
          </Row>

          {/* === Moneda + Montos + Valor JUS === */}
          <Row cols="1fr 1fr 1fr 1fr">
            <Controller
              name="monedaId"
              control={control}
              rules={!ro ? { required: "Elegí la moneda" } : undefined}
              render={({ field }) => (
                <TF
                  select label="Moneda *" {...field}
                  error={!!errors.monedaId}
                  helperText={errors.monedaId?.message}
                  onChange={(e) => {
                    if (ro) return;
                    const newVal = e.target.value;
                    const wasJus = isJUS;
                    field.onChange(newVal);
                    setTimeout(() => {
                      const nowIsJus = isLike((monedas.find(m => String(m.id) === String(newVal)) || {}), "JUS");
                      if (wasJus !== nowIsJus) {
                        if (nowIsJus) setValue("montoPesos", "", { shouldDirty: true });
                        else setValue("jus", "", { shouldDirty: true });
                      }
                    }, 0);
                  }}
                >
                  <MenuItem value="">{ "(sin moneda)" }</MenuItem>
                  {monedas.map((p) => (<MenuItem key={p.id} value={String(p.id)}>{paramLabel(p)}</MenuItem>))}
                </TF>
              )}
            />

            {!isJUS ? (
              // Cuando NO es JUS: Importe primero
              <Controller
                name="montoPesos"
                control={control}
                render={({ field }) => (
                  <TextField
                    fullWidth size="small" label="Importe"
                    type="number"
                    inputProps={{ step: "0.01", readOnly: ro }}
                    value={field.value}
                    onChange={(e) => { if (ro) return; field.onChange(e.target.value); }}
                    disabled={ro}
                    onBlur={() => {
                      if (ro) return;
                      if (field.value === "" || field.value == null) return;
                      const n = Number(field.value);
                      if (Number.isFinite(n)) field.onChange(n.toFixed(2));
                    }}
                  />
                )}
              />
            ) : (
              // Cuando es JUS: Cantidad de JUS primero
              <Controller
                name="jus"
                control={control}
                render={({ field }) => (
                  <TextField
                    fullWidth size="small" label="Cantidad de JUS"
                    type="text" inputProps={{ inputMode: "numeric", pattern: "\\d*", readOnly: ro }}
                    value={field.value ?? ""}
                    onChange={(e) => { if (ro) return; const v = e.target.value; if (/^\d*$/.test(v)) field.onChange(v); }}
                    disabled={ro}
                  />
                )}
              />
            )}

            {!isJUS ? (
              // Cuando NO es JUS: Cantidad de JUS (deshabilitado)
              <Controller
                name="jus"
                control={control}
                render={({ field }) => (
                  <TextField
                    fullWidth size="small" label="Cantidad de JUS"
                    type="text" inputProps={{ inputMode: "numeric", pattern: "\\d*", readOnly: true }}
                    value=""
                    disabled
                  />
                )}
              />
            ) : (
              // Cuando es JUS: Valor JUS
              <TextField
                size="small"
                label="Valor JUS"
                value={valorJusNumber != null ? formatCurrency(valorJusNumber, "ARS") : ""}
                InputProps={{ readOnly: true }}
                disabled
                fullWidth
              />
            )}

            {!isJUS ? (
              // Cuando NO es JUS: Valor JUS (deshabilitado)
              <TextField
                size="small"
                label="Valor JUS"
                value=""
                InputProps={{ readOnly: true }}
                disabled
                fullWidth
              />
            ) : (
              // Cuando es JUS: Importe (calculado)
              <Controller
                name="montoPesos"
                control={control}
                render={({ field }) => (
                  <TextField
                    fullWidth size="small" label="Importe"
                    type="text"
                    inputProps={{ readOnly: true }}
                    value={importeCalculado ? formatCurrency(Number(importeCalculado), "ARS") : ""}
                    disabled
                  />
                )}
              />
            )}
          </Row>

          {/* === Grilla de cuotas (si el back las trae) === */}
          {!!id && honorario?.planes && (
            <>
              <Divider sx={{ my: 2 }} />
              
              {/* Planes cerrados (con cuotas pagas) */}
              {honorario.planes.filter(p => !p.activo).length > 0 && (
                <Accordion 
                  defaultExpanded={false} 
                  sx={{ 
                    mb: 2, 
                    borderRadius: 3,
                    boxShadow: 1,
                    '&:before': { display: 'none' },
                    '&.Mui-expanded': { margin: '0 0 16px 0' }
                  }}
                >
                  <AccordionSummary 
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ borderRadius: 3, px: 2 }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      Planes Anteriores (Cerrados)
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {honorario.planes.filter(p => !p.activo).map((plan) => {
                        const cuotasPagas = plan.cuotas?.filter(c => {
                          const aplicadoARS = Number(c.aplicadoARS || 0);
                          const aplicadoJUS = Number(c.aplicadoJUS || 0);
                          const tienePagos = aplicadoARS > 0 || aplicadoJUS > 0;
                          const esPaga = c.isPagada === true;
                          return tienePagos || esPaga;
                        }) || [];
                        if (cuotasPagas.length === 0) return null;
                        
                        return (
                          <CuotasGrid
                            key={plan.id}
                            plan={{ ...plan, cuotas: cuotasPagas }}
                            isJus={Number(honorario?.jus || 0) > 0}
                            formatCurrency={formatCurrency}
                          />
                        );
                      })}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              )}
              
              {/* Plan activo */}
              {honorario.planes.filter(p => p.activo).length > 0 && (
                <Accordion 
                  defaultExpanded={true}
                  sx={{ 
                    borderRadius: 3,
                    boxShadow: 1,
                    '&:before': { display: 'none' },
                    '&.Mui-expanded': { margin: 0 }
                  }}
                >
                  <AccordionSummary 
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ borderRadius: 3, px: 2 }}
                  >
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Plan Activo
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ pt: 0 }}>
                    {honorario.planes.filter(p => p.activo).map((plan) => (
                      <CuotasGrid
                        key={plan.id}
                        plan={plan}
                        isJus={Number(honorario?.jus || 0) > 0}
                        formatCurrency={formatCurrency}
                      />
                    ))}
                  </AccordionDetails>
                </Accordion>
              )}
            </>
          )}

          <Divider sx={{ my: 2 }} />

          {/* === Plan de pago (opcional) === */}
          {!ro && (
            <>
              {/* Advertencia si hay plan con pagos */}
              {isEdit && planConPagos?.tieneCuotasPagas && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Este honorario tiene {planConPagos.cuotasPagas} de {planConPagos.totalCuotas} cuotas con pagos registrados.
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                    Al crear un nuevo plan, las cuotas pagas se preservarán y se creará un plan nuevo para el saldo pendiente.
                  </Typography>
                </Alert>
              )}

              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  {isCreate 
                    ? "Convenio de pago" 
                    : (isEdit && planConPagos?.tieneCuotasPagas ? "Crear plan nuevo" : "Plan de pago")}
                </Typography>
                {isCreate ? (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    
                  </Typography>
                ) : (
                  <Controller
                    name="plan.crear"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        label={isEdit && planConPagos?.tieneCuotasPagas ? "Crear plan nuevo" : "Crear plan ahora"}
                        control={<Switch checked={Boolean(field.value)} onChange={(e)=>field.onChange(e.target.checked)} />}
                      />
                    )}
                  />
                )}
              </Box>

              {(watch("plan.crear") || isCreate) && (
                <>
                  <Row cols={esPersonalizada ? (isJUS ? "1fr 1fr 1fr 1fr 1fr 1fr" : "1fr 1fr 1fr 1fr 1fr") : (isJUS ? "1fr 1fr 1fr 1fr 1fr" : "1fr 1fr 1fr 1fr")}>
                    <Controller name="plan.cantCuotas" control={control}
                      render={({ field }) => (
                        <TextField 
                          label="Cantidad de cuotas" 
                          type="number" 
                          size="small" 
                          fullWidth 
                          {...field}
                          onChange={(e) => {
                            field.onChange(e);
                            // Auto-calcular monto por cuota
                            const cant = Number(e.target.value) || 0;
                            
                            // Calcular saldo pendiente
                            let saldoPendiente = 0;
                            if (isEdit && honorario) {
                              if (isJUS) {
                                saldoPendiente = Number(honorario.calc?.saldoJus || honorario.jus || 0);
                              } else {
                                const total = Number(montoPesosWatch || 0);
                                const cobrado = Number(honorario.calc?.cobradoARS || honorario.cobrado || 0);
                                saldoPendiente = Math.max(total - cobrado, 0);
                              }
                            } else {
                              saldoPendiente = isJUS ? Number(jusWatch) : Number(montoPesosWatch);
                            }
                            
                            if (cant > 0 && saldoPendiente > 0) {
                              const porCuota = saldoPendiente / cant;
                              setValue("plan.montoPorCuota", isJUS ? Math.round(porCuota) : porCuota.toFixed(2));
                            }
                          }}
                        />
                      )} 
                    />
                    <Controller name="plan.fechaPrimera" control={control}
                      render={({ field }) => (
                        <TextField label="Primera cuota" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} {...field} />
                      )} />
                    <Controller name="plan.periodicidadId" control={control}
                      render={({ field }) => (
                        <TextField select label="Periodicidad" size="small" fullWidth {...field}>
                          {(periodicidades || []).map((p) => (<MenuItem key={p.id} value={String(p.id)}>{paramLabel(p)}</MenuItem>))}
                        </TextField>
                      )} />
                    {esPersonalizada && (
                      <Controller name="plan.diasPersonalizados" control={control}
                        render={({ field }) => (<TextField label="Cada (días)" type="number" size="small" fullWidth {...field} />)} />
                    )}
                    {isJUS && (
                      <Controller
                        name="plan.politicaJusId"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            select size="small" fullWidth
                            label="Valor JUS"
                            {...field}
                            disabled={ro}
                            error={isCreate && !field.value && isJUS}
                            helperText={isCreate && !field.value && isJUS ? "Requerido para planes en JUS" : ""}
                          >
                            {(politicasJus || []).map(p => (
                              <MenuItem key={p.id} value={String(p.id)}>
                                {p.nombre || p.codigo}
                              </MenuItem>
                            ))}
                          </TextField>
                        )}
                      />
                    )}
                    <Controller name="plan.montoPorCuota" control={control}
                      render={({ field }) => {
                        // Calcular monto por cuota automáticamente
                        const cant = Number(watch("plan.cantCuotas") || 0);
                        let saldoPendiente = 0;
                        
                        if (isEdit && honorario) {
                          if (isJUS) {
                            saldoPendiente = Number(honorario.calc?.saldoJus || honorario.jus || 0);
                          } else {
                            const total = Number(montoPesosWatch || 0);
                            const cobrado = Number(honorario.calc?.cobradoARS || honorario.cobrado || 0);
                            saldoPendiente = Math.max(total - cobrado, 0);
                          }
                        } else {
                          saldoPendiente = isJUS ? Number(jusWatch) : Number(montoPesosWatch);
                        }
                        
                          const montoCalculado = cant > 0 && saldoPendiente > 0
                            ? (isJUS ? Math.round(saldoPendiente / cant) : (saldoPendiente / cant).toFixed(2))
                            : "";
                        
                        // Actualizar el valor en el form cuando cambia
                        if (montoCalculado !== field.value) {
                          setValue("plan.montoPorCuota", montoCalculado);
                        }
                        
                        return (
                          <TextField
                            label="Monto por cuota"
                            size="small" 
                            fullWidth
                            value={montoCalculado}
                            InputProps={{
                              readOnly: true,
                              endAdornment: (
                                <InputAdornment position="end">
                                  {isJUS ? "JUS" : "$"}
                                </InputAdornment>
                              ),
                            }}
                            helperText="Calculado automáticamente"
                          />
                        );
                      }} 
                    />
                  </Row>

                  {/* Preview de cuotas */}
                  {watch("plan.cantCuotas") > 0 && watch("plan.fechaPrimera") && watch("plan.montoPorCuota") && (
                    <Box sx={{ mt: 2, p: 2, bgcolor: (t) => (t.palette.mode === "dark" ? "background.default" : "grey.50"), borderRadius: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Vista previa de cuotas</Typography>
                      <Box sx={{ display: "grid", gap: 1 }}>
                        {Array.from({ length: Number(watch("plan.cantCuotas")) || 0 }).map((_, i) => {
                          const fechaPrimera = watch("plan.fechaPrimera");
                          const periodicidadDias = watch("plan.periodicidadId") 
                            ? (esPersonalizada ? watch("plan.diasPersonalizados") : 
                                periodicidadToDays(paramPeriodicidadSel, watch("plan.diasPersonalizados"))) 
                            : 30;
                          
                          const fechaVenc = fechaPrimera ? new Date(fechaPrimera) : new Date();
                          fechaVenc.setDate(fechaVenc.getDate() + (i * periodicidadDias));

                          return (
                            <Box key={i} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 0.5 }}>
                              <Typography variant="body2">
                                Cuota {i + 1} - Vencimiento: {fechaVenc.toLocaleDateString("es-AR")}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {(() => {
                                  const cant = Number(watch("plan.cantCuotas") || 0);
                                  let saldoPendiente = 0;
                                  if (isEdit && honorario) {
                                    if (isJUS) {
                                      saldoPendiente = Number(honorario.calc?.saldoJus || honorario.jus || 0);
                                    } else {
                                      const total = Number(montoPesosWatch || 0);
                                      const cobrado = Number(honorario.calc?.cobradoARS || honorario.cobrado || 0);
                                      saldoPendiente = Math.max(total - cobrado, 0);
                                    }
                                  } else {
                                    saldoPendiente = isJUS ? Number(jusWatch) : Number(montoPesosWatch);
                                  }
                                  const monto = cant > 0 && saldoPendiente > 0 ? (saldoPendiente / cant) : 0;
                                  return isJUS ? `${Math.round(monto)} JUS` : formatCurrency(monto, "ARS");
                                })()}
                              </Typography>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  )}
                </>
              )}
            </>
          )}

          {/* === Botones === */}
          <Box sx={{ mt: 3, display: "flex", gap: 1, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
            <Box>
              <UploadAdjuntoButton 
                clienteId={watchClienteId ? Number(watchClienteId) : undefined}
                casoId={watchCasoId ? Number(watchCasoId) : undefined}
                disabled={ro}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant={ro ? "contained" : "outlined"}
                onClick={() => {
                if (isEdit) {
                  if (location.state?.cameFromView) {
                    // Si venías desde la vista de detalle, volver a modo VER
                    nav(`/finanzas/honorarios/${id}?mode=view`, {
                      replace: true,
                      state: { from: backTo },
                    });
                  } else {
                    // Si entraste desde la lista de Finanzas, volver a la lista
                    nav(backTo, { replace: true });
                  }
                } else {
                  // En alta o modo ver, comportamiento normal
                  nav(backTo);
                }
              }}
              disabled={isSubmitting}
            >
              {ro ? "Volver" : "Cancelar"}
            </Button>

            {ro && canEditarFinanzas && (
              <Button
                variant="outlined"
                onClick={() =>
                  nav(`/finanzas/honorarios/editar/${id}`, {
                    state: { from: backTo, cameFromView: true }, // 👈 señalamos que viene desde "Ver"
                  })
                }
              >
                Editar
              </Button>
            )}
            {!ro && (
              <Button type="submit" variant="contained" disabled={loading}>
                {isSubmitting ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear honorario"}
              </Button>
            )}
            </Box>
          </Box>


        </Box>
      </Paper>
    </LocalizationProvider>
  );
}
