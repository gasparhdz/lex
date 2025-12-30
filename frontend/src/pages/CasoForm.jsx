// src/pages/CasoForm.jsx
import { useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Paper, Box, TextField, MenuItem, Button, Typography, Alert, CircularProgress,
  Autocomplete
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import api from "../api/axios";
import UploadAdjuntoButton from "../components/adjuntos/UploadAdjuntoButton";
import { useLocation } from "react-router-dom";
import { usePermiso } from "../auth/usePermissions";

/* =================== Fetchers =================== */
async function fetchCaso(id) {
  const { data } = await api.get(`/casos/${id}`);
  return data;
}
async function fetchClientes() {
  const { data } = await api.get("/clientes", {
    params: { page: 1, pageSize: 500, orderBy: "displayName", order: "asc" },
  });
  return data?.data ?? [];
}
async function fetchParams(categoria) {
  const { data } = await api.get("/parametros", { params: { categoria, activo: true } });
  return Array.isArray(data) ? data : data?.data ?? [];
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
    out[k] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}
const displayCliente = (c) => {
  if (!c) return "";
  if (c.razonSocial?.trim()) return c.razonSocial.trim();
  const a = (c.apellido || "").trim();
  const n = (c.nombre || "").trim();
  if (a && n) return `${a}, ${n}`;
  return a || n || `#${c.id}`;
};
const paramLabel = (p) => (p?.nombre || p?.codigo || `#${p?.id || ""}`);

/* =================== Componente =================== */
export default function CasoForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const editMode = Boolean(id);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const prefill = location.state?.prefill || location.state?.preset || null;
  const prefillQS = { clienteId: searchParams.get("clienteId") };
  const backTo = location.state?.from || "/casos";
  
  // Verificaciones de permisos
  const canCrearCaso = usePermiso('CASOS', 'crear');
  const canEditarCaso = usePermiso('CASOS', 'editar');
  
  // Redirigir si no tiene permisos
  useEffect(() => {
    if (editMode && !canEditarCaso) {
      enqueueSnackbar('No tiene permisos para editar casos', { variant: 'error' });
      nav(-1);
    } else if (!editMode && !canCrearCaso) {
      enqueueSnackbar('No tiene permisos para crear casos', { variant: 'error' });
      nav(-1);
    }
  }, [editMode, canCrearCaso, canEditarCaso, nav]);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    watch,
    formState: { isSubmitting, errors },
  } = useForm({
    defaultValues: {
      // Persisten en modelo Caso
      clienteId: "",
      tipoId: "",
      nroExpte: "",
      caratula: "",
      estadoId: "",
      radicacionId: "",
      estadoRadicacionId: "",
      descripcion: "",

      // Solo UI (no persisten)
      ramaDerechoId: "",
      localidadRadicacionId: "",
    },
  });
  
  const watchClienteId = watch('clienteId');
  const watchCasoId = editMode && id ? Number(id) : undefined;

  // ======= Watchers (para dependencias) =======
  const ramaDerechoId = useWatch({ control, name: "ramaDerechoId" });
  const localidadRadicacionId = useWatch({ control, name: "localidadRadicacionId" });

  // ======= Queries (React Query v5) =======
  const { data: caso, isLoading: casoLoading, isError: casoErr, error: casoErrObj } = useQuery({
    queryKey: ["caso", id],
    queryFn: () => fetchCaso(id),
    enabled: editMode,
  });

  const { data: clientes = [], isLoading: cliLoading, isError: cliErr, error: cliErrObj } = useQuery({
    queryKey: ["clientes-all"],
    queryFn: fetchClientes,
    staleTime: 5 * 60 * 1000,
  });

  // Parámetros (catálogos)
  const { data: ramas = [], isLoading: ramasLoading } = useQuery({
    queryKey: ["param-rama-derecho"],
    queryFn: () => fetchParams("RAMA_DERECHO"),
    staleTime: 5 * 60 * 1000,
  });

  // Tipos de caso filtrados por rama (back filtra por parentId)
  const { data: tipos = [], isLoading: tiposLoading } = useQuery({
    queryKey: ["param-tipo-caso", { parentId: ramaDerechoId || null }],
    queryFn: async ({ queryKey }) => {
      const [_k, { parentId }] = queryKey;
      const params = { categoria: "TIPO_CASO", activo: true };
      if (parentId) params.parentId = Number(parentId);
      const { data } = await api.get("/parametros", { params });
      return Array.isArray(data) ? data : data?.data ?? [];
    },
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000,
  });
  const { data: tiposTodas = [] } = useQuery({
    queryKey: ["param-tipo-caso-todas"],
    queryFn: () => fetchParams("TIPO_CASO"),
    staleTime: 5 * 60 * 1000,
  });
  const { data: estados = [], isLoading: estadosLoading } = useQuery({
    queryKey: ["param-estado-caso"],
    queryFn: () => fetchParams("ESTADO_CASO"),
    staleTime: 5 * 60 * 1000,
  });

  // Localidad radicación: categoriaId = 9
  const { data: locRadOpts = [], isLoading: locRadLoading } = useQuery({
    queryKey: ["param-localidad-radicacion", { categoriaId: 9 }],
    queryFn: async ({ queryKey }) => {
      const [_k, { categoriaId }] = queryKey;
      const { data } = await api.get("/parametros", { params: { categoriaId, activo: true } });
      return Array.isArray(data) ? data : data?.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Radicaciones por localidad: categoriaId = 8, filtradas por parentId (la localidad seleccionada)
  const { data: radicaciones = [], isLoading: radLoading } = useQuery({
    queryKey: ["param-radicaciones-por-localidad", { categoriaId: 8, parentId: localidadRadicacionId || null }],
    queryFn: async ({ queryKey }) => {
      const [_k, { categoriaId, parentId }] = queryKey;
      if (!parentId) return [];
      const { data } = await api.get("/parametros", {
        params: { categoriaId, parentId: Number(parentId), activo: true },
      });
      return Array.isArray(data) ? data : data?.data ?? [];
    },
    keepPreviousData: true,
    staleTime: 5 * 60 * 1000,
  });

  const { data: radicacionesTodas = [] } = useQuery({
    queryKey: ["param-radicaciones-todas"],
    queryFn: async () => {
      const { data } = await api.get("/parametros", { params: { categoriaId: 8, activo: true } });
      return Array.isArray(data) ? data : data?.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });
  
  const { data: estadosRad = [], isLoading: estadosRadLoading } = useQuery({
    queryKey: ["param-estado-radicacion"],
    queryFn: () => fetchParams("ESTADO_RADICACION"),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const currentTipo = getValues("tipoId");
    if (!currentTipo) return;

    const t = tiposTodas.find((x) => String(x.id) === String(currentTipo));
    if (!t) return; // todavía no cargó la lista completa → no tocar

    if (ramaDerechoId && t.parentId != null && String(t.parentId) !== String(ramaDerechoId)) {
      setValue("tipoId", "", { shouldDirty: true, shouldValidate: true });
    }
  }, [ramaDerechoId, tiposTodas, getValues, setValue]);
  
  // Si cambia la localidad y la radicación ya no corresponde, limpiar
  useEffect(() => {
    const currentRad = getValues("radicacionId");
    if (currentRad && !radicaciones.some((r) => String(r.id) === String(currentRad))) {
      setValue("radicacionId", "", { shouldDirty: true, shouldValidate: true });
    }
  }, [localidadRadicacionId, radicaciones, getValues, setValue]);

  /* ======= Mutations ======= */
  const crearMut = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post("/casos", payload);
      return data;
    },
    onSuccess: () => {
      enqueueSnackbar("Caso creado correctamente", { variant: "success" });
      nav(backTo, { replace: true });
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "Error al crear";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const editarMut = useMutation({
    mutationFn: async ({ id, body }) => {
      const { data } = await api.put(`/casos/${id}`, body);
      return data;
    },
    onSuccess: () => {
      enqueueSnackbar("Caso actualizado", { variant: "success" });
      nav(backTo, { replace: true });
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "Error al actualizar";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  /* ======= Carga inicial en edición ======= */
  useEffect(() => {
    if (!caso) return;
    reset({
      clienteId:          caso.clienteId ? String(caso.clienteId) : "",
      tipoId:             caso.tipoId ? String(caso.tipoId) : "",
      nroExpte:           caso.nroExpte ?? "",
      caratula:           caso.caratula ?? "",
      estadoId:           caso.estadoId ? String(caso.estadoId) : "",
      radicacionId:       caso.radicacionId ? String(caso.radicacionId) : "",
      estadoRadicacionId: caso.estadoRadicacionId ? String(caso.estadoRadicacionId) : "",
      descripcion:        caso.descripcion ?? "",

      // Filtros UI (no persisten): se setean luego en el useEffect siguiente
      ramaDerechoId: "",
      localidadRadicacionId: "",
    });
  }, [caso, reset]);

  // Prefill de campos dependientes cuando estás editando
useEffect(() => {
  if (!editMode || !caso) return;

  // 1) Asegurar radicación como string (por si vino numérica)
  if (caso.radicacionId) {
    setValue("radicacionId", String(caso.radicacionId), { shouldDirty: false });
  }

  // 2) Setear Rama del derecho a partir del tipo (t.parentId)
  if (!getValues("ramaDerechoId") && caso.tipoId && Array.isArray(tiposTodas) && tiposTodas.length) {
    const t = tiposTodas.find((x) => String(x.id) === String(caso.tipoId));
    if (t?.parentId != null) {
      setValue("ramaDerechoId", String(t.parentId), { shouldDirty: false });
    }
  }

  // 3) Setear Localidad de radicación a partir de la radicación (r.parentId),
  //    usando la lista COMPLETA (radicacionesTodas), no la filtrada.
  if (!getValues("localidadRadicacionId") && caso.radicacionId && radicacionesTodas.length) {
    const r = radicacionesTodas.find((x) => String(x.id) === String(caso.radicacionId));
    if (r?.parentId != null) {
      setValue("localidadRadicacionId", String(r.parentId), { shouldDirty: false });
    }
  }
}, [editMode, caso, tiposTodas, radicacionesTodas, getValues, setValue]);

// ======= Precarga desde ClienteDetalle =======
useEffect(() => {
   if (editMode) return;
   const cid = prefill?.clienteId ?? prefillQS.clienteId;
   if (cid) setValue("clienteId", String(cid), { shouldDirty: true });
 }, [editMode, prefill, prefillQS.clienteId, setValue]);

  /* ======= Guardar ======= */
  const onSubmit = (values) => {
    const payload = limpiarPayload({ ...values });

    // Campos UI que NO van al backend
    delete payload.ramaDerechoId;
    delete payload.localidadRadicacionId;

    // Normalizar IDs numéricos
    for (const k of ["clienteId", "tipoId", "estadoId", "radicacionId", "estadoRadicacionId"]) {
      if (payload[k] != null && payload[k] !== "") payload[k] = Number(payload[k]);
    }

    if (editMode) editarMut.mutate({ id, body: payload });
    else crearMut.mutate(payload);
  };

  const loading =
    isSubmitting ||
    casoLoading ||
    cliLoading ||
    ramasLoading ||
    tiposLoading ||
    estadosLoading ||
    radLoading ||
    estadosRadLoading ||
    locRadLoading;

  const errorBlock = (casoErr && casoErrObj) || (cliErr && cliErrObj);

  // TextField compacto
  const TF = (props) => <TextField fullWidth size="small" {...props} />;

  return (
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
          {editMode ? "Editar caso" : "Nuevo caso"}
        </Typography>
        {loading && <CircularProgress size={18} />}
      </Box>

      {errorBlock && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {casoErrObj?.message || cliErrObj?.message || "Error cargando datos"}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(onSubmit)}>
        {/* ===== Fila 1: Cliente – Rama del derecho – Tipo de caso ===== */}
        <Row cols="2fr 2fr 2fr">
          <Controller
            name="clienteId"
            control={control}
            rules={{ required: "Seleccioná un cliente" }}
            render={({ field }) => (
              <TF
                select
                label="Cliente"
                {...field}
                error={!!errors.clienteId}
                helperText={errors.clienteId?.message}
              >
                {clientes.map((c) => (
                  <MenuItem key={c.id} value={String(c.id)}>
                    {displayCliente(c)}
                  </MenuItem>
                ))}
              </TF>
            )}
          />

          {/* Filtro UI (no persiste) */}
          <Controller
            name="ramaDerechoId"
            control={control}
            render={({ field }) => (
              <TF select label="Rama del derecho" {...field}>
                <MenuItem value="">{"(todas)"}</MenuItem>
                {ramas.map((r) => (
                  <MenuItem key={r.id} value={String(r.id)}>
                    {paramLabel(r)}
                  </MenuItem>
                ))}
              </TF>
            )}
          />
          <Controller
            name="tipoId"
            control={control}
            rules={{ required: "Seleccioná el tipo de caso" }}
            render={({ field }) => (
              <TF
                select
                label="Tipo de caso"
                {...field}
                value={field.value ?? ""}          // <- valor seguro
                error={!!errors.tipoId}
                helperText={errors.tipoId?.message}
              >
                {ramaDerechoId && tipos.length === 0 ? (
                  <MenuItem value="" disabled>(sin tipos para esta rama)</MenuItem>
                ) : null}

                {Array.isArray(tipos)
                  ? tipos.map((t) => (
                      <MenuItem key={t.id} value={String(t.id)}>
                        {paramLabel(t)}
                      </MenuItem>
                    ))
                  : null}
              </TF>
            )}
          />
        </Row>

        {/* ===== Fila 2: Nro expediente – Carátula – Estado del caso ===== */}
        <Row cols="1.2fr 2.4fr ">
          <Controller
            name="nroExpte"
            control={control}
            render={({ field }) => (
              <TF
                label="Nro. expediente"
                {...field}
                error={!!errors.nroExpte}
                //helperText={errors.nroExpte?.message || "Opcional (ej: para ciudadanías)"}
              />
            )}
          />

          <Controller
            name="caratula"
            control={control}
            render={({ field }) => (
              <TF
                label="Carátula"
                {...field}
                error={!!errors.caratula}
               // helperText={errors.caratula?.message || "Opcional"}
              />
            )}
          />

        </Row>

        {/* ===== Fila 3: Localidad radicación – Radicación – Estado radicación ===== */}
        <Row cols="2fr 2fr 2fr 2fr">
          
          <Controller
            name="estadoId"
            control={control}
            render={({ field }) => (
              <TF select label="Estado del caso" {...field}>
                <MenuItem value="">{"(sin estado)"}</MenuItem>
                {estados.map((e) => (
                  <MenuItem key={e.id} value={String(e.id)}>
                    {paramLabel(e)}
                  </MenuItem>
                ))}
              </TF>
            )}
          />
          {/* Localidad radicación (catId 9) */}
          <Controller
            name="localidadRadicacionId"
            control={control}
            render={({ field }) => {
              const selected =
                locRadOpts.find((l) => String(l.id) === String(field.value)) || null;
              return (
                <Autocomplete
                  options={locRadOpts}
                  loading={locRadLoading}
                  value={selected}
                  getOptionLabel={(o) => paramLabel(o)}
                  isOptionEqualToValue={(o, v) => String(o.id) === String(v.id)}
                  onChange={(_e, opt) => field.onChange(opt ? String(opt.id) : "")}
                  renderInput={(params) => <TF {...params} label="Localidad radicación" />}
                />
              );
            }}
          />

          {/* Radicación (catId 8, filtrada por parentId) */}
          <Controller
            name="radicacionId"
            control={control}
            render={({ field }) => (
              <TF
                select
                label="Radicación"
                {...field}
                value={field.value ?? ""}          // <- valor seguro
              >
                {!localidadRadicacionId ? (
                  <MenuItem value="" disabled>(elegí una localidad)</MenuItem>
                ) : null}

                {localidadRadicacionId && Array.isArray(radicaciones) && radicaciones.length === 0 ? (
                  <MenuItem value="" disabled>(sin radicaciones para esta localidad)</MenuItem>
                ) : null}

                {Array.isArray(radicaciones)
                  ? radicaciones.map((r) => (
                      <MenuItem key={r.id} value={String(r.id)}>
                        {paramLabel(r)}
                      </MenuItem>
                    ))
                  : null}
              </TF>
            )}
          />


          <Controller
            name="estadoRadicacionId"
            control={control}
            render={({ field }) => (
              <TF select label="Estado radicación" {...field}>
                <MenuItem value="">{"(sin estado)"}</MenuItem>
                {estadosRad.map((er) => (
                  <MenuItem key={er.id} value={String(er.id)}>
                    {paramLabel(er)}
                  </MenuItem>
                ))}
              </TF>
            )}
          />
        </Row>

        {/* ===== Fila 4: Observaciones ===== */}
        <Row cols="1fr">
          <Controller
            name="descripcion"
            control={control}
            render={({ field }) => (
              <TF label="Observaciones" multiline minRows={3} {...field} />
            )}
          />
        </Row>

        {/* Botones */}
        <Box sx={{ mt: 3, display: "flex", gap: 1, justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <UploadAdjuntoButton 
              clienteId={watchClienteId ? Number(watchClienteId) : undefined}
              casoId={watchCasoId}
              disabled={!editMode || !id} // Solo en edición, cuando ya tiene ID
            />
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" onClick={() => nav(backTo, { replace: true })} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={
                isSubmitting ||
                casoLoading ||
                cliLoading ||
                ramasLoading ||
                tiposLoading ||
                estadosLoading ||
                radLoading ||
                estadosRadLoading ||
                locRadLoading
              }
            >
              {isSubmitting ? "Guardando..." : editMode ? "Guardar cambios" : "Crear caso"}
            </Button>
            </Box>
          </Box>
        </Box>
      </Paper>
    );
  }
