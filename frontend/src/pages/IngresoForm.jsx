// src/pages/IngresoForm.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate, useParams, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Paper, Box, TextField, MenuItem, Button, Typography, Alert, CircularProgress,
  Autocomplete, InputAdornment, Dialog, DialogTitle, DialogContent, DialogActions, Chip
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import "dayjs/locale/es";

import { enqueueSnackbar } from "notistack";
import api from "../api/axios";
import UploadAdjuntoButton from "../components/adjuntos/UploadAdjuntoButton";
import { usePermiso } from "../auth/usePermissions";
import {
  getIngreso,
  createIngreso,
  updateIngreso,
  updateIngresoReconciliar
} from "../api/finanzas/ingresos";
import { formatCurrency } from "../utils/format";

/* Subformularios */
import IngresoCuotaForm from "./IngresoCuotaForm";
import IngresoGastoForm from "./IngresoGastoForm";

/* APIs de aplicaciones (para edición / herramientas de apoyo) */
import {
  resumenIngresoCuotas,
  listAplicacionesCuota,
} from "../api/finanzas/ingreso-cuota";
import { crearAplicacionIngresoGasto, listAplicacionesGasto, getResumenIngresoGastos } from "../api/finanzas/ingreso-gasto";

/* ====== configuración dayjs ====== */
dayjs.locale("es");

/* ====== fetchers base ====== */
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
async function fetchParamsBy(cat) {
  try {
    const params =
      typeof cat === "number"
        ? { categoriaId: cat, activo: true, page: 1, pageSize: 1000, orderBy: "orden", order: "asc" }
        : { categoria: cat,   activo: true, page: 1, pageSize: 1000, orderBy: "orden", order: "asc" };
    const { data } = await api.get("/parametros", { params });
    return Array.isArray(data) ? data : (data?.data ?? []);
  } catch {
    return [];
  }
}
async function fetchValorJusPorFecha(fechaISO) {
  if (!fechaISO) return { valor: 0, fecha: null };
  const { data } = await api.get("/valorjus/por-fecha", { params: { fecha: fechaISO } });
  return { valor: Number(data?.valor ?? 0), fecha: data?.fecha ?? fechaISO };
}

/* ====== utils ====== */
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
  for (const [k, v] of Object.entries(values)) if (!(v === "" || v == null)) out[k] = v;
  return out;
}
const toDateAny = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === "function") {
    const d = v.toDate();
    return isNaN(d) ? null : d;
  }
  const d = new Date(v);
  return isNaN(d) ? null : d;
};
// ISO YYYY-MM-DD preservando día local
const toIsoDateOnly = (v) => {
  const d = toDateAny(v);
  if (!d) return null;
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
};

function toDayjsDateOnly(v) {
  if (!v) return null;

  // Si ya es un objeto dayjs válido, devolverlo
  if (dayjs.isDayjs(v) && v.isValid()) {
    return v;
  }

  // Si es un objeto Date válido, convertirlo a dayjs
  if (v instanceof Date && !isNaN(v.getTime())) {
    return dayjs(v);
  }

  const s = String(v).trim();

  // Si coincide con el patrón YYYY-MM-DD, usarlo directamente
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const dateOnly = s.slice(0, 10);
    const dayjsDate = dayjs(dateOnly);
    return dayjsDate.isValid() ? dayjsDate : null;
  }

  // Intentar parsear como fecha
  const date = new Date(s);
  if (isNaN(date.getTime())) {
    return null; // Fecha inválida
  }

  // Convertir a ISO string solo si la fecha es válida
  try {
    const dateOnly = date.toISOString().slice(0, 10);
    const dayjsDate = dayjs(dateOnly);
    return dayjsDate.isValid() ? dayjsDate : null;
  } catch (e) {
    return null; // Error al convertir, retornar null
  }
}

const displayCliente = (c) => {
  if (!c) return "";
  const rs = (c.razonSocial || "").trim();
  if (rs) return rs;
  const a = (c.apellido || "").trim();
  const n = (c.nombre || "").trim();
  return [a, n].filter(Boolean).join(", ") || `#${c.id}`;
};
const displayCaso = (c) => {
  if (!c) return "";
  const exp = (c.nroExpte || "").trim();
  const car = (c.caratula || "").trim();
  return [exp, car].filter(Boolean).join(" — ") || `Caso #${c.id}`;
};
const paramLabel = (p) => (p?.nombre || p?.codigo || `#${p?.id || ""}`);
const isLike = (p, kw) => {
  const s = String(kw || "").toUpperCase();
  return (p?.codigo || "").toUpperCase().includes(s) || (p?.nombre || "").toUpperCase().includes(s);
};

const CAT_MONEDA = 14;
const CAT_TIPO_NAME = 13;
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Helper para parsear montos en ARS desde diferentes formatos
// Soporta: "110000.00", "110.000,00", "$ 110.000,00", "110000", etc.
function parseARS(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  const str = String(value).trim();
  if (!str) return 0;

  // Remover símbolos de moneda y espacios
  let cleaned = str.replace(/[$€]/g, "").replace(/\s/g, "");

  // Si tiene coma y punto -> asumir formato miles "." y decimal ","
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      cleaned = cleaned.replace(",", ".");
    } else {
      cleaned = cleaned.replace(/,/g, "");
    }
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    if (!(parts.length === 2 && parts[1].length <= 2)) {
      cleaned = cleaned.replace(/\./g, "");
    }
  }

  cleaned = cleaned.replace(/[^\d.-]/g, "");
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

// Helper para extraer array de rows desde diferentes estructuras de respuesta
function extractRows(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;

  if (data.rows && Array.isArray(data.rows)) return data.rows;

  if (data.data) {
    if (Array.isArray(data.data)) return data.data;
    if (data.data.rows && Array.isArray(data.data.rows)) return data.data.rows;
    if (data.data.data && Array.isArray(data.data.data)) return data.data.data;

    // 👉 si tu backend devuelve { data: { items: [...] } } o algo similar,
    // acá es donde lo vas a ver en el DEBUG y lo agregamos.
    if (data.data.items && Array.isArray(data.data.items)) return data.data.items;
  }

  if (data.items && Array.isArray(data.items)) return data.items;

  return [];
}

/* ================= Componente ================= */
export default function IngresoForm() {
  const { id } = useParams();
  const editMode = Boolean(id);
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const theme = useTheme();

  // ===== MODO VER =====
  const pathname = location.pathname || "";
  const isEditPath = /\/finanzas\/ingresos\/editar\//.test(pathname);
  const isNumericId = !!id && /^\d+$/.test(String(id));
  const isViewPath = !isEditPath && isNumericId; // .../ingresos/:id numérico

  const isViewMode =
    searchParams.get("mode") === "ver" ||
    location.state?.mode === "ver" ||
    location.state?.viewMode === true ||
    isViewPath;

  // Verificaciones de permisos
  const canEditarFinanzas = usePermiso('FINANZAS', 'editar');

  // de dónde venimos (ClienteDetalle / CasoDetalle o módulo Finanzas)
  const normalizeBackTo = useMemo(() => {
    const from = location.state?.from;

    if (from && typeof from === 'object' && from.pathname) {
      if (from.pathname === '/finanzas' && from.search) return from.pathname + from.search;
      if (from.pathname === '/finanzas' && !from.search) return "/finanzas?tab=ingresos";
      if (from.pathname === '/finanzas/ingresos' || from.pathname.includes('/finanzas/ingresos')) return "/finanzas?tab=ingresos";
      if (from.search) return from.pathname + from.search;
      return from.pathname || from;
    }

    const fromStr = typeof from === 'string' ? from : '';
    if (fromStr.includes('/finanzas/ingresos') || (fromStr === '/finanzas')) return "/finanzas?tab=ingresos";
    if (fromStr && (fromStr.startsWith('/clientes/') || fromStr.startsWith('/casos/'))) return fromStr;

    return "/finanzas?tab=ingresos";
  }, [location.state]);

  const backTo = normalizeBackTo;

  const cameFromDetail = useMemo(() => {
    const from = location.state?.from || "";
    const fromPath = typeof from === 'object' ? from.pathname : from;
    return /^\/(clientes|casos)\//.test(fromPath);
  }, [location.state]);

  const prefill = location.state?.prefill || location.state?.preset || null;
  const prefillQS = {
    clienteId: searchParams.get("clienteId"),
    casoId: searchParams.get("casoId"),
  };

  const qc = useQueryClient();
  const defaultsSetRef = useRef(false);
  const [aplicGastos, setAplicGastos] = useState([]); // alta
  const savingRef = useRef(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm({
    defaultValues: {
      fechaIngreso: dayjs(),
      clienteId: "",
      casoId: "",
      descripcion: "",
      montoStr: "",
      monedaId: "",
      tipoId: "",
    },
  });

  const watchClienteId = watch('clienteId');
  const watchCasoId = watch('casoId');

  /* watch */
  const clienteIdVal = watch("clienteId");
  const casoIdVal = watch("casoId");
  const tipoIdVal = watch("tipoId");
  const monedaIdVal = watch("monedaId");
  const montoStrVal = watch("montoStr");

  /* data base */
  const { data: ingreso, isLoading: ingLoading, isError: ingErr, error: ingErrObj } = useQuery({
    queryKey: ["ingreso", id],
    queryFn: () => getIngreso(id),
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

  const { data: monedas = [] } = useQuery({
    queryKey: ["param-monedas", CAT_MONEDA],
    queryFn: () => fetchParamsBy(CAT_MONEDA),
    staleTime: 10 * 60 * 1000,
  });

  const { data: tipos = [] } = useQuery({
    queryKey: ["param-ingreso-tipos"],
    queryFn: () => fetchParamsBy(CAT_TIPO_NAME),
    staleTime: 10 * 60 * 1000,
  });

  const fechaISO = useMemo(() => {
    const v = watch("fechaIngreso");
    const d = v ? toDateAny(v) : null;
    if (!d) return null;
    const off = d.getTimezoneOffset();
    const local = new Date(d.getTime() - off * 60000);
    return local.toISOString().slice(0, 10);
  }, [watch("fechaIngreso")]);

  const { data: valorJusResp } = useQuery({
    queryKey: ["valorJus", fechaISO],
    queryFn: () => fetchValorJusPorFecha(fechaISO),
    enabled: Boolean(fechaISO),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  /* 🔹 Resumen y (fallback) detalle de apps previas para el ingreso */
  const { data: resumenEdit, isLoading: resumenLoading } = useQuery({
    queryKey: ["resumen-ingreso-cuotas", id],
    queryFn: () => resumenIngresoCuotas(Number(id)),
    enabled: editMode && !!id,
    staleTime: 15_000,
  });

  const { data: appsPrevias, isLoading: appsPreviasLoading } = useQuery({
    queryKey: ["apps-previas-ingreso", id],
    queryFn: () => listAplicacionesCuota({ ingresoId: Number(id), page: 1, pageSize: 500 }),
    enabled: editMode && !!id,
    staleTime: 15_000,
  });

  // 👇 aplicaciones de GASTO previas (para precargar)
  const { data: appsGastoPrevias } = useQuery({
    queryKey: ["apps-gasto-previas-ingreso", id],
    queryFn: () => listAplicacionesGasto({ ingresoId: Number(id), pageSize: 500 }),
    enabled: editMode && !!id,
    staleTime: 15_000,
  });

  /* 🔹 Resumen de gastos (fallback) */
  const { data: resumenGastosEdit } = useQuery({
    queryKey: ["resumen-ingreso-gastos", id],
    queryFn: () => getResumenIngresoGastos(Number(id)),
    enabled: editMode && !!id,
    staleTime: 15_000,
  });


  /* En edición: usar snapshot guardado */
  const valorJusNum = useMemo(() => {
    const vEdit = Number(ingreso?.valorJusAlCobro ?? ingreso?.valorJus ?? 0);
    if (editMode && Number.isFinite(vEdit) && vEdit > 0) return vEdit;
    const v = Number(valorJusResp?.valor ?? 0);
    return Number.isFinite(v) && v > 0 ? v : null;
  }, [editMode, ingreso, valorJusResp]);

  /* precarga edición */
  const initialStateRef = useRef({
    appsHonNew: null,
    appsGas: null,
    formValues: null,
  });

  useEffect(() => {
    if (!ingreso) return;
    const initialFormValues = {
      fechaIngreso: ingreso.fechaIngreso ? toDayjsDateOnly(ingreso.fechaIngreso) : dayjs(),
      clienteId: ingreso.clienteId ? String(ingreso.clienteId) : "",
      casoId: ingreso.casoId ? String(ingreso.casoId) : "",
      descripcion: ingreso.descripcion ?? "",
      montoStr: ingreso.monto != null ? String(ingreso.monto) : "",
      monedaId: ingreso.monedaId ? String(ingreso.monedaId) : "",
      tipoId: ingreso.tipoId ? String(ingreso.tipoId) : "",
    };
    reset(initialFormValues);
    initialStateRef.current.formValues = initialFormValues;
  }, [ingreso, reset]);

  /* defaults */
  useEffect(() => {
    if (editMode || defaultsSetRef.current) return;
    if (!monedaIdVal && monedas.length) {
      const d = monedas.find((m) => isLike(m, "PESOS") || isLike(m, "ARS"));
      if (d) setValue("monedaId", String(d.id), { shouldDirty: false });
      defaultsSetRef.current = true;
    }
  }, [editMode, monedaIdVal, monedas, setValue]);

  // ======= Precarga desde ClienteDetalle o querystring =======
  useEffect(() => {
    if (editMode) return;
    const cid = prefill?.clienteId ?? prefillQS.clienteId;
    const casoId = prefill?.casoId ?? prefillQS.casoId;
    if (cid) setValue("clienteId", String(cid), { shouldDirty: true });
    if (casoId) setValue("casoId", String(casoId), { shouldDirty: true });
  }, [editMode, prefill, prefillQS.clienteId, prefillQS.casoId, setValue]);

  /* equivalencias UI */
  const monedaObj = useMemo(
    () => monedas.find((x) => String(x.id) === String(monedaIdVal)),
    [monedas, monedaIdVal]
  );
  const isJUS = !!monedaObj && isLike(monedaObj, "JUS");
  const isUSDorEUR = !!monedaObj && (isLike(monedaObj, "DOLAR") || isLike(monedaObj, "EURO"));

  const equivPreview = useMemo(() => {
    if (isUSDorEUR) return null;
    const n = Number(String(montoStrVal || "").replace(/\./g, "").replace(",", "."));
    const vj = Number(valorJusNum || 0);
    if (!Number.isFinite(n) || !vj) return null;
    return isJUS ? { label: "Equivalente ARS", value: n * vj } : { label: "Equivalente JUS", value: n / vj };
  }, [montoStrVal, valorJusNum, isJUS, isUSDorEUR]);

  function sanitizeMontoInput(raw, integersOnly) {
    if (raw == null) return "";
    let v = String(raw).replace(/\s/g, "");
    if (integersOnly) return v.replace(/[^\d]/g, "");
    v = v.replace(/[^0-9.,]/g, "");
    const firstComma = v.indexOf(",");
    const firstDot = v.indexOf(".");
    const firstSepIdx = Math.min(
      firstComma === -1 ? Infinity : firstComma,
      firstDot === -1 ? Infinity : firstDot
    );
    if (firstSepIdx !== Infinity) {
      const sep = v[firstSepIdx];
      const before = v.slice(0, firstSepIdx + 1);
      const after = v.slice(firstSepIdx + 1).replace(/[.,]/g, "");
      v = before + after;
      if (firstSepIdx === 0) v = "0" + sep + after;
    }
    return v;
  }

  /* submit base */
  const qcInvalidate = () => qc.invalidateQueries({ queryKey: ["ingresos"] });

  const crearMut = useMutation({
    mutationFn: (payload) => createIngreso(payload),
    onSuccess: qcInvalidate,
    retry: 0,
  });
  const editarMut = useMutation({
    mutationFn: ({ id, body }) => updateIngreso(id, body),
    onSuccess: () => {
      enqueueSnackbar("Ingreso actualizado", { variant: "success" });
      if (cameFromDetail) {
        nav(`/finanzas/ingresos/${id}?mode=ver`, {
          replace: true,
          state: { from: backTo, mode: "ver" },
        });
      } else {
        nav(backTo, { replace: true });
      }
    },
    retry: 0,
  });

  /* estado UI y selección */
  const [appsHonNew, setAppsHonNew] = useState([]);
  const [appsGas, setAppsGas] = useState([]);
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [gastosTouched, setGastosTouched] = useState(false);
  const prevAppsGasRef = useRef(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInfo, setConfirmInfo] = useState(null);

  const cuotasSelCount = useMemo(() => {
    let acc = 0;
    for (const item of appsHonNew || []) {
      acc += Object.values(item?.selectedCuotas || {}).filter(Boolean).length;
      acc += Object.values(item?.selectedNumMap || {}).filter(Boolean).length;
    }
    return acc;
  }, [appsHonNew]);
  const gastosSelCount = (appsGas || []).length;

  const tipoSel = useMemo(
    () => tipos.find((t) => String(t.id) === String(tipoIdVal)) || null,
    [tipos, tipoIdVal]
  );
  const tipoCodigo = (tipoSel?.codigo || "").toUpperCase();
  const uiMode = useMemo(() => {
    switch (tipoCodigo) {
      case "PAGO_POR_CONSULTA":
      case "ADELANTO_DE_GASTOS":
        return "simple";
      case "REINTEGRO_DE_GASTO":
        return "gastosOnly";
      case "HONORARIOS":
        return "honOnly";
      default:
        return "bothSections";
    }
  }, [tipoCodigo]);

  /* -------- Totales visuales -------- */
  const ingresoARS = useMemo(() => {
    const raw = String(montoStrVal || "").replace(/\./g, "").replace(",", ".");
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 0;
    if (isJUS) {
      const vj = Number(valorJusNum || 0);
      return vj > 0 ? round2(n * vj) : 0;
    }
    return round2(n);
  }, [montoStrVal, isJUS, valorJusNum]);

  const totalSelHonARS = useMemo(() => {
    if (selectionTouched) {
      if (appsHonNew && appsHonNew.length > 0) {
        let acc = 0;
        for (const item of appsHonNew) {
          const sel = item?.selectedCuotas || {};
          const appliedById = item?.appliedHereById || {};
          const cuotasResolved = item?.cuotasResolved || [];
          const selKeys = Object.keys(sel || {}).filter((k) => sel[k]);

          if (cuotasResolved.length > 0) {
            for (const c of cuotasResolved) {
              const cid = String(c.id);
              if (sel[cid]) acc += Number(appliedById[cid] || 0);
            }
          } else {
            // ✅ NO depende de expandir: usa lo precargado
            for (const cid of selKeys) {
              acc += Number(appliedById[cid] || 0);
            }
          }

        }
        return Math.round(acc * 100) / 100;
      }
      return 0;
    }

    // ✅ Primero intentar desde appsPrevias (detalle)
    const rows = extractRows(appsPrevias);
    if (rows && rows.length > 0) {
      const sum = rows.reduce((acc, it) => {
        const montoRaw = it?.montoAplicadoARS ?? it?.monto ?? 0;
        const monto = parseARS(montoRaw);
        return acc + monto;
      }, 0);
      return Math.round(sum * 100) / 100;
    }

    // ✅ Fallback: usar resumenEdit.aplicadoARS si appsPrevias no está disponible
    if (resumenEdit?.aplicadoARS != null) {
      const aplicado = parseARS(resumenEdit.aplicadoARS);
      return Math.round(aplicado * 100) / 100;
    }

    return 0;
  }, [selectionTouched, appsPrevias, appsHonNew, resumenEdit]);

  const totalSelGasARS = useMemo(() => {
    // ✅ Normalizar appsGas a array
    let arr = appsGas;
    if (typeof appsGas === 'string') {
      try { arr = JSON.parse(appsGas); } catch { arr = []; }
    }
    if (!Array.isArray(arr)) arr = [];

    // ✅ Obtener rows de appsGastoPrevias para usar como referencia
    const rowsPrevias = extractRows(appsGastoPrevias);
    
    // ✅ Crear un mapa de gastoId -> monto desde appsGastoPrevias
    const montoByGastoId = new Map();
    if (rowsPrevias && rowsPrevias.length > 0) {
      rowsPrevias.forEach((r) => {
        const idG = r?.gastoId ?? r?.gasto?.id ?? r?.id;
        if (idG) {
          const montoRaw = r?.montoAplicadoARS ?? r?.monto ?? 0;
          const monto = parseARS(montoRaw);
          montoByGastoId.set(Number(idG), monto);
        }
      });
    }

    // ✅ Si appsGas tiene datos, calcular sumando montos (si monto es 0, usar el de appsGastoPrevias si existe)
    if (arr && arr.length > 0) {
      const sum = arr.reduce((s, it) => {
        const gastoId = Number(it?.gastoId);
        const montoRaw = it?.monto || it?.montoAplicadoARS || it?.montoAplicado || 0;
        let monto = parseARS(montoRaw);
        
        // ✅ Si el monto es 0 pero existe en appsGastoPrevias, usar ese valor (gasto precargado pero no modificado)
        if (monto === 0 && gastoId && montoByGastoId.has(gastoId)) {
          monto = montoByGastoId.get(gastoId);
        }
        
        return s + monto;
      }, 0);
      return Math.round(sum * 100) / 100;
    }

    // ✅ Si no hay appsGas, intentar desde appsGastoPrevias (detalle)
    if (rowsPrevias && rowsPrevias.length > 0) {
      const sum = rowsPrevias.reduce((acc, r) => {
        const montoRaw = r?.montoAplicadoARS ?? r?.monto ?? 0;
        const monto = parseARS(montoRaw);
        return acc + monto;
      }, 0);
      return Math.round(sum * 100) / 100;
    }

    // ✅ Fallback: usar resumenGastosEdit.aplicadoARS si appsGastoPrevias no está disponible
    if (resumenGastosEdit?.aplicadoARS != null) {
      const aplicado = parseARS(resumenGastosEdit.aplicadoARS);
      return Math.round(aplicado * 100) / 100;
    }

    return 0;
  }, [selectionTouched, appsGastoPrevias, appsGas, resumenGastosEdit]);

  const seleccionadoARS = useMemo(() => {
    return totalSelHonARS + totalSelGasARS;
  }, [totalSelHonARS, totalSelGasARS]);

  const gastosAplicadosAEsteIngreso = useMemo(() => {
    if (!editMode) return [];
    const rows = extractRows(appsGastoPrevias);
    return rows
      .map((r) => {
        const idG = r?.gastoId ?? r?.gasto?.id ?? r?.id;
        return idG ? Number(idG) : null;
      })
      .filter(Boolean);
  }, [editMode, appsGastoPrevias]);

  // ✅ precarga selección de gastos en EDICIÓN (arreglado parseARS + extractRows)
  useEffect(() => {
    if (!editMode || gastosTouched) return;
    if (appsGastoPrevias && appsGas.length === 0) {
      const rows = extractRows(appsGastoPrevias);

      const mapped = rows
        .map((r) => {
          const idG = r?.gastoId ?? r?.gasto?.id ?? r?.id;
          const monto = parseARS(r?.montoAplicadoARS ?? r?.monto ?? 0);
          if (!idG || !Number.isFinite(monto) || monto <= 0) return null;
          return { gastoId: Number(idG), monto: monto.toFixed(2) };
        })
        .filter(Boolean);

      if (mapped.length > 0) {
        setAplicGastos(mapped);
        setAppsGas(mapped);
        prevAppsGasRef.current = mapped;
        if (initialStateRef.current.appsGas === null) {
          initialStateRef.current.appsGas = JSON.parse(JSON.stringify(mapped));
        }
      } else {
        if (initialStateRef.current.appsGas === null) initialStateRef.current.appsGas = [];
      }
    } else if (!appsGastoPrevias && appsGas.length === 0) {
      if (initialStateRef.current.appsGas === null) initialStateRef.current.appsGas = [];
    }
  }, [editMode, appsGastoPrevias, gastosTouched, appsGas.length]);

  // ✅ precarga selección de CUOTAS en EDICIÓN (desde appsPrevias)
  const precargaCuotasHechaRef = useRef(false);
  useEffect(() => {
    if (!editMode) return;
    if (selectionTouched) {
      precargaCuotasHechaRef.current = true;
      return; // si el usuario ya tocó, no pisar
    }
    if (precargaCuotasHechaRef.current) return; // si ya se precargó, no volver a hacerlo
    if (!appsPrevias) return;

    const rows = extractRows(appsPrevias);
    if (!rows || rows.length === 0) {
      if (initialStateRef.current.appsHonNew === null) initialStateRef.current.appsHonNew = [];
      precargaCuotasHechaRef.current = true;
      return;
    }

    // Agrupar por honorarioId si viene; fallback: por planId (cuota.planId)
    const groupKey = (r) => String(r?.honorarioId ?? r?.cuota?.honorarioId ?? "0");

    
    const grouped = {};
    for (const r of rows) {
      const k = groupKey(r);
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push(r);
    }

    // Armar estructura mínima compatible con tu IngresoCuotaForm
    // (selectedCuotas + appliedHereById)
    const next = Object.entries(grouped).map(([k, arr]) => {
      const selectedCuotas = {};
      const appliedHereById = {};

      for (const r of arr) {
        const cuotaId = Number(r?.cuotaId ?? r?.cuota?.id);
        if (!Number.isFinite(cuotaId) || cuotaId <= 0) continue;

        selectedCuotas[String(cuotaId)] = true;

        const montoRaw = r?.montoAplicadoARS ?? r?.monto ?? 0;
        appliedHereById[String(cuotaId)] = parseARS(montoRaw);
      }

      return {
        // 🔸 importante: IngresoCuotaForm seguramente usa honorarioId
        honorarioId: Number(k) > 0 ? Number(k) : null,

        // lo que el form usa para renderizar selección y monto
        selectedCuotas,
        appliedHereById,

        // placeholders (el form los completa cuando carga las cuotas)
        cuotasResolved: [],
        selectedNumMap: {},
      };
    });

    if (next.length > 0) {
      setAppsHonNew(next);

      // guardar estado inicial para cancelar
      if (initialStateRef.current.appsHonNew === null) {
        initialStateRef.current.appsHonNew = JSON.parse(JSON.stringify(next));
      }
    } else {
      if (initialStateRef.current.appsHonNew === null) initialStateRef.current.appsHonNew = [];
    }
    precargaCuotasHechaRef.current = true;
  }, [editMode, appsPrevias, selectionTouched]); // ✅ Dependencias consistentes


  useEffect(() => {
    if (editMode && !selectionTouched && initialStateRef.current.appsHonNew === null) {
      if (appsHonNew) initialStateRef.current.appsHonNew = JSON.parse(JSON.stringify(appsHonNew));
      else initialStateRef.current.appsHonNew = [];
    }
  }, [editMode, appsHonNew, selectionTouched]);

  const handleBack = () => { nav(backTo || "/finanzas?tab=ingresos"); };
  const handleCancelEdit = () => {
    if (editMode && initialStateRef.current) {
      if (initialStateRef.current.formValues) reset(initialStateRef.current.formValues);

      if (initialStateRef.current.appsHonNew !== null) setAppsHonNew(JSON.parse(JSON.stringify(initialStateRef.current.appsHonNew)));
      else setAppsHonNew([]);

      if (initialStateRef.current.appsGas !== null) {
        const restoredGas = JSON.parse(JSON.stringify(initialStateRef.current.appsGas));
        setAppsGas(restoredGas);
        setAplicGastos(restoredGas);
        prevAppsGasRef.current = restoredGas;
      } else {
        setAppsGas([]);
        setAplicGastos([]);
        prevAppsGasRef.current = null;
      }

      setSelectionTouched(false);
      setGastosTouched(false);
      precargaCuotasHechaRef.current = false; // Resetear flag de precarga
    }
    nav(backTo || "/finanzas?tab=ingresos");
  };

  const handleGoEdit = () => {
    if (!id) return;
    nav(`/finanzas/ingresos/editar/${id}`, { state: { from: backTo } });
  };

  const doReconciliar = async (payload, selectedCuotaIds) => {
    const body = { ...payload, selectedCuotaIds };
    await updateIngresoReconciliar(Number(id), body);
    enqueueSnackbar("Ingreso actualizado", { variant: "success" });
    qc.invalidateQueries();
    if (cameFromDetail) {
      nav(`/finanzas/ingresos/${id}?mode=ver`, { replace: true, state: { from: backTo, mode: "ver" } });
    } else {
      nav(backTo, { replace: true });
    }
  };

  const collectSelectedCuotaIds = (appsHonList) => {
    const ids = [];
    for (const item of appsHonList || []) {
      const sel = item?.selectedCuotas || {};
      for (const c of item?.cuotasResolved || []) {
        if (sel[String(c.id)]) ids.push(Number(c.id));
      }
    }
    return Array.from(new Set(ids.filter(Boolean)));
  };

  const onSubmit = async (values) => {
    if (isViewMode) return;
    if (savingRef.current) return;
    savingRef.current = true;

    try {
      if (!values.montoStr?.toString().trim()) {
        enqueueSnackbar("Ingresá el monto", { variant: "warning" });
        return;
      }
      if (editMode && (appsPreviasLoading || resumenLoading)) {
        enqueueSnackbar("Cargando selección y resumen… Probá de nuevo en un segundo.", { variant: "info" });
        return;
      }

      const raw = values.montoStr?.toString() ?? "";
      const monedaLocal = (monedas || []).find((x) => String(x.id) === String(values.monedaId));
      const isJUSLocal =
        !!monedaLocal && String(monedaLocal.nombre || monedaLocal.codigo || "").toUpperCase().includes("JUS");

      let montoNumber;
      if (isJUSLocal) {
        if (!/^\d+$/.test(raw)) {
          enqueueSnackbar("En JUS solo se permiten enteros", { variant: "warning" });
          return;
        }
        montoNumber = Number(raw);
      } else {
        const normalized = raw.replace(/\./g, "").replace(",", ".");
        montoNumber = Number(normalized);
        if (!Number.isFinite(montoNumber) || montoNumber <= 0) {
          enqueueSnackbar("Monto inválido", { variant: "warning" });
          return;
        }
      }

      const payload = limpiarPayload({ ...values });
      for (const k of ["clienteId", "casoId", "monedaId", "tipoId"]) {
        if (payload[k] != null && payload[k] !== "") payload[k] = Number(payload[k]);
      }
      if (payload.fechaIngreso) payload.fechaIngreso = toIsoDateOnly(payload.fechaIngreso);
      payload.monto = montoNumber;
      delete payload.montoStr;

      const totalSeleccionado = totalSelHonARS + totalSelGasARS;
      if (totalSeleccionado > ingresoARS) {
        const diff = totalSeleccionado - ingresoARS;
        enqueueSnackbar(
          `La selección excede el importe en ${formatCurrency(diff, "ARS")}. Revisá las cantidades.`,
          { variant: "error" }
        );
        return;
      }

      if (!editMode) {
        const nuevo = await crearMut.mutateAsync(payload);
        const ingresoId = nuevo?.id;

        if (uiMode === "gastosOnly" || uiMode === "bothSections") {
          const gastosToCreate = (aplicGastos || []).map((a) => ({
            ingresoId,
            gastoId: a.gastoId,
            monto: Number(String(a.monto).replace(",", ".")),
          }));
          if (gastosToCreate.length) {
            for (const g of gastosToCreate) {
              await crearAplicacionIngresoGasto(g);
            }
          }
        }

        if (uiMode === "honOnly" || uiMode === "bothSections") {
          const selectedCuotaIds = collectSelectedCuotaIds(appsHonNew);
          if (selectedCuotaIds.length) {
            await updateIngresoReconciliar(ingresoId, { selectedCuotaIds });
          }
        }

        enqueueSnackbar("Ingreso creado", { variant: "success" });
        qc.invalidateQueries();
        nav(backTo, { replace: true });
        return;
      }

      const selectedCuotaIds = collectSelectedCuotaIds(appsHonNew);

      let aplicacionesGastos = undefined;

      const gastosIniciales = initialStateRef.current?.appsGas || [];
      const normalizeGastos = (arr) => {
        if (!Array.isArray(arr)) return [];
        return arr
          .map((a) => ({
            gastoId: Number(a.gastoId || a.gasto?.id || a.id || 0),
            monto: Number(String(a.monto || a.montoAplicadoARS || a.montoAplicado || 0).replace(/,/g, ".")),
          }))
          .filter((a) => a.gastoId > 0 && a.monto > 0)
          .sort((a, b) => a.gastoId - b.gastoId);
      };
      const gastosInicialesNorm = normalizeGastos(gastosIniciales);
      const gastosActualesNorm = normalizeGastos(appsGas);
      const gastosCambiaron = JSON.stringify(gastosInicialesNorm) !== JSON.stringify(gastosActualesNorm);

      if (appsGas && appsGas.length > 0) {
        aplicacionesGastos = (appsGas || []).map((a) => {
          const gastoId = Number(a.gastoId || a.gasto?.id || a.id || 0);
          const montoRaw = a.monto || a.montoAplicadoARS || a.montoAplicado || 0;
          const monto = Number(String(montoRaw).replace(/,/g, "."));
          return { gastoId, monto };
        }).filter((a) => {
          return Number.isFinite(a.gastoId) && a.gastoId > 0 && Number.isFinite(a.monto) && a.monto > 0;
        });
      } else if (gastosCambiaron && gastosIniciales.length > 0) {
        aplicacionesGastos = [];
      } else if (gastosTouched) {
        aplicacionesGastos = [];
      }

      const bodyToSend = {
        ...payload,
        selectedCuotaIds,
      };

      if (aplicacionesGastos !== undefined) {
        bodyToSend.aplicacionesGastos = aplicacionesGastos;
      }

      await updateIngresoReconciliar(Number(id), bodyToSend);
      enqueueSnackbar("Ingreso actualizado", { variant: "success" });
      qc.invalidateQueries();
      nav(backTo, { replace: true });
    } catch (e) {
      enqueueSnackbar(
        e?.response?.data?.publicMessage || e?.response?.data?.message || e?.message || "Error al guardar",
        { variant: "error" }
      );
    } finally {
      savingRef.current = false;
    }
  };

  const loading = isSubmitting || ingLoading || cliLoading || casosLoading;
  const errorBlock = (ingErr && ingErrObj) || (cliErr && cliErrObj);

  const equivLabel = equivPreview?.label || "Equivalencia";
  const equivValue = equivPreview
    ? (isJUS ? formatCurrency(equivPreview.value, "ARS") : `${equivPreview.value.toFixed(4)} JUS`)
    : "";

  const needsClientMsg = (content) =>
    (isViewMode || clienteIdVal)
      ? content
      : <Typography variant="body2" color="text.secondary">Seleccioná un cliente para ver detalles.</Typography>;

  const renderSections = () => {
    if (uiMode === "simple") return null;

    if (uiMode === "gastosOnly") {
      return (
        <Box sx={{ mt: 2 }}>
          {needsClientMsg(
            <IngresoGastoForm
              noFrame
              clienteId={clienteIdVal}
              casoId={casoIdVal}
              ingresoDisponibleARS={editMode ? Math.max(ingresoARS - totalSelHonARS - totalSelGasARS, 0) : Math.max(ingresoARS - totalSelHonARS, 0)}
              value={appsGas}
              onChange={(next) => {
                const nextArray = Array.isArray(next) ? [...next] : [];
                setAppsGas(nextArray);
                setAplicGastos(nextArray);

                const prev = prevAppsGasRef.current;
                const normalize = (arr) => {
                  if (!Array.isArray(arr)) return [];
                  return arr
                    .map((a) => ({
                      gastoId: Number(a.gastoId),
                      monto: Number(String(a.monto || 0).replace(/,/g, ".")),
                    }))
                    .filter((a) => a.gastoId > 0 && a.monto > 0)
                    .sort((a, b) => a.gastoId - b.gastoId);
                };
                const prevNorm = normalize(prev || []);
                const nextNorm = normalize(nextArray || []);
                const changed = JSON.stringify(prevNorm) !== JSON.stringify(nextNorm);
                if (changed && prev !== null) {
                  setSelectionTouched(true);
                  setGastosTouched(true);
                  prevAppsGasRef.current = nextArray;
                } else if (!prev && nextArray && nextArray.length > 0) {
                  prevAppsGasRef.current = nextArray;
                }
              }}
              viewOnly={isViewMode}
              editMode={editMode}
              gastosAplicadosAEsteIngreso={gastosAplicadosAEsteIngreso}
            />
          )}
        </Box>
      );
    }

    if (uiMode === "honOnly") {
      return (
        <Box sx={{ mt: 2 }}>
          {needsClientMsg(
            <IngresoCuotaForm
              noFrame
              key={`cuotas-${clienteIdVal}-${casoIdVal || "nc"}`}
              clienteId={clienteIdVal}
              casoId={casoIdVal}
              valorJusNum={valorJusNum}
              ingresoId={editMode ? Number(id) : undefined}
              restanteARS={Math.max(ingresoARS - totalSelHonARS - totalSelGasARS, 0)}
              ingresoARS={ingresoARS}
              totalSelGasARS={totalSelGasARS}
              value={appsHonNew}
              onChange={(next) => {
                if (editMode && !selectionTouched && initialStateRef.current.appsHonNew === null && next && next.length > 0) {
                  initialStateRef.current.appsHonNew = JSON.parse(JSON.stringify(next));
                }
                setAppsHonNew(Array.isArray(next) ? [...next] : []);
              }}
              onUserEdit={() => setSelectionTouched(true)}
              viewOnly={isViewMode}
            />
          )}
        </Box>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        <Box
          sx={{
            border: (t) => `1px solid ${t.palette.divider}`,
            borderRadius: 2,
            overflow: "hidden",
            mb: 1.5,
          }}
        >
          <Accordion disableGutters elevation={0} square sx={{ boxShadow: "none", "&::before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600 }}>
                Honorarios {cuotasSelCount ? `· ${cuotasSelCount} seleccionadas` : ""}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              {needsClientMsg(
                <IngresoCuotaForm
                  noFrame
                  key={`cuotas-${clienteIdVal}-${casoIdVal || "nc"}`}
                  clienteId={clienteIdVal}
                  casoId={casoIdVal}
                  valorJusNum={valorJusNum}
                  ingresoId={editMode ? Number(id) : undefined}
                  restanteARS={Math.max(ingresoARS - totalSelHonARS - totalSelGasARS, 0)}
                  ingresoARS={ingresoARS}
                  totalSelGasARS={totalSelGasARS}
                  value={appsHonNew}
                  onChange={(next) => {
                    if (editMode && !selectionTouched && initialStateRef.current.appsHonNew === null && next && next.length > 0) {
                      initialStateRef.current.appsHonNew = JSON.parse(JSON.stringify(next));
                    }
                    setAppsHonNew(Array.isArray(next) ? [...next] : []);
                  }}
                  onUserEdit={() => setSelectionTouched(true)}
                  viewOnly={isViewMode}
                />
              )}
            </AccordionDetails>
          </Accordion>
        </Box>

        <Box
          sx={{
            border: (t) => `1px solid ${t.palette.divider}`,
            borderRadius: 2,
            overflow: "hidden",
            mb: 1.5,
          }}
        >
          <Accordion disableGutters elevation={0} square sx={{ boxShadow: "none", "&::before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography sx={{ fontWeight: 600 }}>
                Gastos {gastosSelCount ? `· ${gastosSelCount} seleccionados` : ""}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              {needsClientMsg(
                <IngresoGastoForm
                  noFrame
                  clienteId={clienteIdVal}
                  casoId={casoIdVal}
                  ingresoDisponibleARS={editMode ? Math.max(ingresoARS - totalSelHonARS - totalSelGasARS, 0) : Math.max(ingresoARS - totalSelHonARS, 0)}
                  value={appsGas}
                  onChange={(next) => {
                    const nextArray = Array.isArray(next) ? [...next] : [];
                    setAppsGas(nextArray);
                    setAplicGastos(nextArray);

                    const prev = prevAppsGasRef.current;
                    const normalize = (arr) => {
                      if (!Array.isArray(arr)) return [];
                      return arr
                        .map((a) => ({
                          gastoId: Number(a.gastoId),
                          monto: Number(String(a.monto || 0).replace(/,/g, ".")),
                        }))
                        .filter((a) => a.gastoId > 0 && a.monto > 0)
                        .sort((a, b) => a.gastoId - b.gastoId);
                    };
                    const prevNorm = normalize(prev || []);
                    const nextNorm = normalize(nextArray || []);
                    const changed = JSON.stringify(prevNorm) !== JSON.stringify(nextNorm);
                    if (changed && prev !== null) {
                      setSelectionTouched(true);
                      setGastosTouched(true);
                      prevAppsGasRef.current = nextArray;
                    } else if (!prev && nextArray && nextArray.length > 0) {
                      prevAppsGasRef.current = nextArray;
                    } else if (!prev) {
                      if (next && next.length > 0) prevAppsGasRef.current = next;
                    }
                  }}
                  viewOnly={isViewMode}
                  editMode={editMode}
                  gastosAplicadosAEsteIngreso={gastosAplicadosAEsteIngreso}
                />
              )}
            </AccordionDetails>
          </Accordion>
        </Box>
      </Box>
    );
  };

  const showResumen = uiMode !== "simple";

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
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
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
            {isViewMode ? "Detalle de ingreso" : editMode ? "Editar ingreso" : "Nuevo ingreso"}
          </Typography>
          {loading && <CircularProgress size={18} />}
        </Box>

        {errorBlock && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {(ingErrObj?.message || cliErrObj?.message) ?? "Error cargando datos"}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          {/* Campos base */}
          <Row cols="2fr 2fr">
            <Controller
              name="clienteId"
              control={control}
              render={({ field }) => (
                <TextField fullWidth size="small" select label="Cliente" {...field} disabled={isViewMode}>
                  <MenuItem value="">{ "(sin cliente)" }</MenuItem>
                  {clientes.map((c) => (
                    <MenuItem key={c.id} value={String(c.id)}>
                      {displayCliente(c)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="casoId"
              control={control}
              render={({ field }) => {
                const valueObj = casos.find((c) => String(c.id) === String(field.value)) || null;
                const filtered = clienteIdVal
                  ? casos.filter((c) => String(c.clienteId) === String(clienteIdVal))
                  : casos;
                return (
                  <Autocomplete
                    options={filtered}
                    value={valueObj}
                    loading={casosLoading}
                    getOptionLabel={(o) => displayCaso(o)}
                    isOptionEqualToValue={(o, v) => String(o.id) === String(v.id)}
                    onChange={(_e, opt) => field.onChange(opt ? String(opt.id) : "")}
                    renderInput={(params) => <TextField fullWidth size="small" {...params} label="Caso" />}
                    disablePortal
                    disabled={isViewMode}
                  />
                );
              }}
            />
          </Row>

          <Row cols="1fr 0.9fr 0.7fr 1fr 1fr 1fr">
            <Controller
              name="tipoId"
              control={control}
              render={({ field }) => (
                <TextField
                  fullWidth size="small" select label="Concepto" {...field}
                  disabled={isViewMode}
                >
                  <MenuItem value="">{ "(sin concepto)" }</MenuItem>
                  {tipos.map((p) => (
                    <MenuItem key={p.id} value={String(p.id)}>
                      {paramLabel(p)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="fechaIngreso"
              control={control}
              rules={{ required: "Indicá la fecha" }}
              render={({ field }) => (
                <DatePicker
                  label="Fecha de ingreso *"
                  value={field.value ? toDayjsDateOnly(field.value) : null}
                  onChange={(v) => field.onChange(v)}
                  disabled={isViewMode}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: "small",
                      error: !!errors.fechaIngreso,
                      helperText: errors.fechaIngreso?.message,
                    },
                  }}
                />
              )}
            />

            <Controller
              name="monedaId"
              control={control}
              render={({ field }) => (
                <TextField
                  fullWidth size="small" select label="Moneda" {...field}
                  helperText={monedas.length ? "" : "Si no elegís, se asume PESOS"}
                  disabled={isViewMode}
                >
                  <MenuItem value="">{ "(sin moneda)" }</MenuItem>
                  {monedas.map((p) => (
                    <MenuItem key={p.id} value={String(p.id)}>
                      {paramLabel(p)}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="montoStr"
              control={control}
              rules={{ required: "Ingresá el monto" }}
              render={({ field }) => (
                <TextField
                  fullWidth
                  size="small"
                  label={isJUS ? "Cantidad (JUS) *" : "Monto *"}
                  type="text"
                  inputProps={{
                    inputMode: isJUS ? "numeric" : "decimal",
                    pattern: isJUS ? "[0-9]*" : "[0-9.,]*",
                    autoComplete: "off",
                  }}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(sanitizeMontoInput(e.target.value, isJUS))}
                  error={!!errors.montoStr}
                  helperText={errors.montoStr?.message}
                  InputProps={
                    isJUS ? undefined : { startAdornment: <InputAdornment position="start">$</InputAdornment> }
                  }
                  disabled={isViewMode}
                />
              )}
            />

            <TextField
              size="small"
              label={editMode ? "Valor JUS (al cobro)" : "Valor JUS (a la fecha de ingreso)"}
              value={valorJusNum != null ? formatCurrency(valorJusNum, "ARS") : ""}
              InputProps={{ readOnly: true }}
              fullWidth
              disabled
            />

            <TextField
              size="small"
              label={equivLabel}
              value={equivValue}
              InputProps={{ readOnly: true }}
              fullWidth
              disabled
            />
          </Row>

          <Row cols="4fr">
            <Controller
              name="descripcion"
              control={control}
              render={({ field }) => (
                <TextField
                  fullWidth
                  size="small"
                  label="Descripción"
                  placeholder="Comentario opcional (recibo, referencia, etc.)"
                  {...field}
                  disabled={isViewMode}
                />
              )}
            />
          </Row>

          {renderSections()}

          {showResumen && (
            <Box
              sx={{
                mt: 1.5,
                mb: 2,
                p: 1.5,
                borderRadius: 2,
                border: (t) => `1px solid ${t.palette.divider}`,
                bgcolor: (t) => (t.palette.mode === "dark" ? "background.default" : "grey.50"),
                display: "grid",
                gap: 1.5,
                gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
                alignItems: "center",
                opacity: isViewMode ? 0.85 : 1,
              }}
            >
              <Box>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Importe del ingreso (ARS)
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {editMode && ingreso ? formatCurrency(ingreso.totalARS || ingresoARS, "ARS") : formatCurrency(ingresoARS, "ARS")}
                </Typography>
              </Box>

              <Box sx={{ borderLeft: seleccionadoARS > ingresoARS ? `3px solid ${theme.palette.error.main}` : "none", pl: seleccionadoARS > ingresoARS ? 1.5 : 0 }}>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {editMode && !selectionTouched
                    ? `Ya aplicado (cuotas + gastos)`
                    : "Seleccionado (cuotas + gastos)"}
                  {seleccionadoARS > ingresoARS && " - ⚠️ Excede el importe"}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    color: seleccionadoARS > ingresoARS ? theme.palette.error.main : undefined
                  }}
                >
                  {formatCurrency(seleccionadoARS, "ARS")}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  Disponible
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {formatCurrency(Math.max(ingresoARS - seleccionadoARS, 0), "ARS")}
                </Typography>
              </Box>
            </Box>
          )}

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
                    <Button variant="contained" onClick={handleGoEdit} disabled={ingLoading}>
                      Editar
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button variant="outlined" onClick={handleCancelEdit} disabled={isSubmitting}>
                    Cancelar
                  </Button>
                  <Button type="submit" variant="contained" disabled={isSubmitting || ingLoading || cliLoading || casosLoading}>
                    {isSubmitting ? "Guardando..." : editMode ? "Guardar cambios" : "Crear ingreso"}
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </Box>
      </Paper>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirmar ajuste parcial</DialogTitle>
        <DialogContent dividers>
          {confirmInfo ? (
            <Box sx={{ display: "grid", gap: 1 }}>
              <Typography>
                La selección de cuotas supera el importe del ingreso.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Podés continuar para aplicar el ajuste automáticamente o Cancelar para revisar la selección.
              </Typography>
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                setConfirmOpen(false);
                await doReconciliar(confirmInfo.payload, confirmInfo.selectedCuotaIds);
              } catch (e) {
                enqueueSnackbar(
                  e?.response?.data?.publicMessage || e?.response?.data?.message || e?.message || "Error al guardar",
                  { variant: "error" }
                );
              } finally {
                setConfirmInfo(null);
              }
            }}
          >
            Ajustar y guardar
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
}
