// src/pages/EventoForm.jsx
import { useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { useNavigate, useParams, useSearchParams, useLocation  } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePermiso } from "../auth/usePermissions";
import {
  Paper, Box, TextField, MenuItem, Button, Typography, Alert, CircularProgress,
  Autocomplete
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import api from "../api/axios";
import { getEvento, createEvento, updateEvento } from "../api/eventos";
import UploadAdjuntoButton from "../components/adjuntos/UploadAdjuntoButton";

import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
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
    out[k] = v;
  }
  return out;
}
const toDate = (v) => (v ? new Date(v) : null);

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

/* =================== Componente =================== */
export default function EventoForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const editMode = Boolean(id);
  const isView =
    Boolean(id) &&
    (new URLSearchParams(location.search).get("mode") === "view" ||
    location.state?.viewOnly === true);

  const [searchParams] = useSearchParams();
  const timezoneDefault = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Argentina/Buenos_Aires";

  // Verificaciones de permisos
  const canCrearEvento = usePermiso('EVENTOS', 'crear');
  const canEditarEvento = usePermiso('EVENTOS', 'editar');
  const canVerEvento = usePermiso('EVENTOS', 'ver');

  // Redirigir si no tiene permisos
  useEffect(() => {
    if (editMode && !canEditarEvento && !isView) {
      enqueueSnackbar('No tiene permisos para editar eventos', { variant: 'error' });
      nav(-1);
    } else if (!editMode && !canCrearEvento) {
      enqueueSnackbar('No tiene permisos para crear eventos', { variant: 'error' });
      nav(-1);
    }
    // En modo view, verificar que tenga al menos permisos de ver
    if (isView && editMode && !canVerEvento) {
      enqueueSnackbar('No tiene permisos para ver eventos', { variant: 'error' });
      nav(-1);
    }
  }, [editMode, canCrearEvento, canEditarEvento, canVerEvento, isView, nav]);

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
      clienteId: "",
      casoId: "",
      tipoId: "",
      estadoId: "",
      descripcion: "",
      observaciones: "",
      ubicacion: "",
      fechaInicio: null,
      fechaFin: null,
      // ocultos / fijos por pedido
      allDay: false,
      recordatorio: null,
      notificadoACliente: false,
      timezone: timezoneDefault,
      activo: true,
    },
  });

  // Watch para validaciones cruzadas de fechas
  const fechaInicioWatch = watch("fechaInicio");

  // Volver a donde estabas (Agenda o Eventos), con fallback seguro
  const fromQuery   = new URLSearchParams(location.search).get("from"); // ej: ?from=agenda
  const fromState   = location.state?.from;                              // ej: { state:{ from:'/agenda' } }
  const fallbackTo  = fromState
    || (fromQuery === "agenda" ? "/agenda" : fromQuery === "eventos" ? "/eventos" : "/eventos");
  const goBack = () => {
    if (window.history.length > 1) nav(-1);
    else nav(fallbackTo, { replace: true });
  };
  // Watch para filtrar casos por cliente seleccionado
  const clienteIdWatch = useWatch({ control, name: "clienteId" });
  const watchClienteId = watch('clienteId');
  const watchCasoId = watch('casoId');

  // ======= Queries =======
  const { data: evento, isLoading: evLoading, isError: evErr, error: evErrObj } = useQuery({
    queryKey: ["evento", id],
    queryFn: () => getEvento(id),
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

  const { data: tipos = [], isLoading: tiposLoading } = useQuery({
    queryKey: ["param-tipo-evento"],
    queryFn: () => fetchParams("TIPO_EVENTO"),
    staleTime: 5 * 60 * 1000,
  });

  const { data: estados = [], isLoading: estadosLoading } = useQuery({
    queryKey: ["param-estado-evento"],
    queryFn: () => fetchParams("ESTADO_EVENTO"),
    staleTime: 5 * 60 * 1000,
  });

  /* ======= Carga inicial en edición ======= */
  useEffect(() => {
    if (!evento) return;
    reset({
      clienteId:   evento.clienteId ? String(evento.clienteId) : "",
      casoId:      evento.casoId ? String(evento.casoId) : "",
      tipoId:      evento.tipoId ? String(evento.tipoId) : "",
      estadoId:    evento.estadoId ? String(evento.estadoId) : "",
      descripcion: evento.descripcion ?? "",
      observaciones: evento.observaciones ?? "",
      ubicacion:   evento.ubicacion ?? "",
      fechaInicio: toDate(evento.fechaInicio),
      fechaFin:    toDate(evento.fechaFin),
      // aunque el back pueda traer otros, se fuerzan en submit
      allDay:      false,
      recordatorio: toDate(evento.recordatorio),
      notificadoACliente: false,
      timezone:    evento.timezone || timezoneDefault,
      activo:      true,
    });
  }, [evento, reset, timezoneDefault]);

  useEffect(() => {
    if (editMode) return;
    const fi = searchParams.get("fechaInicio");
    if (fi) {
      const d = new Date(fi);
      if (!isNaN(d)) setValue("fechaInicio", d, { shouldDirty: false });
    }
  }, [editMode, searchParams, setValue]);

  /* ======= Preselección de "Pendiente" en nuevo ======= */
  useEffect(() => {
    if (editMode) return;
    if (!Array.isArray(estados) || !estados.length) return;
    const pend = estados.find(
      (e) =>
        String(e?.nombre || "").toLowerCase() === "pendiente" ||
        String(e?.codigo || "").toLowerCase() === "pendiente"
    );
    if (pend && !getValues("estadoId")) {
      setValue("estadoId", String(pend.id), { shouldDirty: false, shouldValidate: true });
    }
  }, [editMode, estados, getValues, setValue]);

  // ========= Precargar cliente/caso desde state o querystring =========
  useEffect(() => {
    if (editMode) return;

    const prefillState = location.state?.prefill || null;
    const prefillQS = {
      clienteId: searchParams.get("clienteId"),
      casoId: searchParams.get("casoId"),
    };

    const cid = prefillState?.clienteId ?? prefillQS.clienteId;
    const casoId = prefillState?.casoId ?? prefillQS.casoId;

    if (cid) setValue("clienteId", String(cid), { shouldDirty: false });
    if (casoId) setValue("casoId", String(casoId), { shouldDirty: false });
  }, [editMode, location.state, searchParams, setValue]);

  /* ======= Mutations ======= */
  const crearMut = useMutation({
    mutationFn: (payload) => createEvento(payload),
    onSuccess: (data) => {
      enqueueSnackbar("Evento creado correctamente", { variant: "success" });
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        enqueueSnackbar(data.warnings[0], { variant: "warning" });
      }
      goBack();
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "Error al crear";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const editarMut = useMutation({
    mutationFn: ({ id, body }) => updateEvento(id, body),
    onSuccess: (data) => {
      enqueueSnackbar("Evento actualizado", { variant: "success" });
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        enqueueSnackbar(data.warnings[0], { variant: "warning" });
      }
      goBack();
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "Error al actualizar";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  /* ======= Guardar ======= */
  const onSubmit = (values) => {
    if (isView) return; // en modo ver no guardamos
    // Clonar/limpiar
    const payload = limpiarPayload({ ...values });

    // Forzar flags según requerimiento
    payload.notificadoACliente = false;
    payload.activo = true;

    // Normalizar IDs numéricos
    for (const k of ["clienteId", "casoId", "tipoId", "estadoId"]) {
      if (payload[k] != null && payload[k] !== "") payload[k] = Number(payload[k]);
    }

    // Fechas → ISO
    const toIso = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null);
    if (payload.fechaInicio) payload.fechaInicio = toIso(payload.fechaInicio);
    if (payload.fechaFin) payload.fechaFin = toIso(payload.fechaFin);
    if (payload.recordatorio) payload.recordatorio = toIso(payload.recordatorio);

    if (editMode) editarMut.mutate({ id, body: payload });
    else crearMut.mutate(payload);
  };

  const loading =
    isSubmitting ||
    evLoading ||
    cliLoading ||
    casosLoading ||
    tiposLoading ||
    estadosLoading;

  const errorBlock = (evErr && evErrObj) || (cliErr && cliErrObj);

  // TextField compacto
  const TF = (props) => (
    <TextField
      fullWidth
      size="small"
      disabled={isView}
      InputProps={isView ? { readOnly: true } : undefined}
      {...props}
    />
  ) ;
  // Filtrar casos por cliente si hay uno seleccionado
  const casosFiltrados = clienteIdWatch
    ? casos.filter((c) => String(c.clienteId) === String(clienteIdWatch))
    : casos;

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
        <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
            {isView ? "Ver evento" : editMode ? "Editar evento" : "Nuevo evento"}
          </Typography>
          {loading && <CircularProgress size={18} />}
        </Box>

        {errorBlock && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {evErrObj?.message || cliErrObj?.message || "Error cargando datos"}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          {/* ===== Fila 1: Cliente – Caso ===== */}
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

            {/* Caso (autocomplete, filtrado por cliente si corresponde) */}
            <Controller
              name="casoId"
              control={control}
              render={({ field }) => {
                const valueObj =
                  casos.find((c) => String(c.id) === String(field.value)) || null;
                return (
                  <Autocomplete
                    options={casosFiltrados}
                    value={valueObj}
                    loading={casosLoading}
                    getOptionLabel={(o) => displayCaso(o)}
                    isOptionEqualToValue={(o, v) => String(o.id) === String(v.id)}
                    onChange={(_e, opt) => field.onChange(opt ? String(opt.id) : "")}
                    disabled={isView}
                    renderInput={(params) => <TF {...params} label="Caso" />}
                  />
                );
              }}
            />
          </Row>

          {/* ===== Fila 2: Tipo – Estado – Ubicación ===== */}
          <Row cols="1.2fr 1.2fr 1.6fr">
            <Controller
              name="tipoId"
              control={control}
              rules={{ required: "Seleccioná el tipo de evento" }}
              render={({ field }) => (
                <TF
                  select
                  label="Tipo de evento"
                  {...field}
                  error={!!errors.tipoId}
                  helperText={errors.tipoId?.message}
                >
                  {tipos.map((t) => (
                    <MenuItem key={t.id} value={String(t.id)}>
                      {paramLabel(t)}
                    </MenuItem>
                  ))}
                </TF>
              )}
            />

            <Controller
              name="estadoId"
              control={control}
              render={({ field }) => (
                <TF select label="Estado" {...field}>
                  <MenuItem value="">{ "(sin estado)" }</MenuItem>
                  {estados.map((e) => (
                    <MenuItem key={e.id} value={String(e.id)}>
                      {paramLabel(e)}
                    </MenuItem>
                  ))}
                </TF>
              )}
            />

            <Controller
              name="ubicacion"
              control={control}
              render={({ field }) => <TF label="Ubicación" {...field} />}
            />
          </Row>

          {/* ===== Fila 3: Fechas ===== */}
          <Row cols="1fr 1fr 1fr">
            <Controller
              name="fechaInicio"
              control={control}
              rules={{ required: "Indicá la fecha de inicio" }}
              render={({ field }) => (
                <DateTimePicker
                  label="Fecha inicio"
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  disabled={isView}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: "small",
                      InputProps: isView ? { readOnly: true } : undefined,
                      error: !!errors.fechaInicio,
                      helperText: errors.fechaInicio?.message,
                    },
                  }}
                />
              )}
            />

            <Controller
              name="fechaFin"
              control={control}
              rules={{
                validate: (fechaFin) => {
                  if (fechaFin && fechaInicioWatch && fechaFin < fechaInicioWatch) {
                    return "La fecha fin no puede ser anterior a la fecha inicio";
                  }
                  return true;
                }
              }}
              render={({ field }) => (
                <DateTimePicker
                  label="Fecha fin"
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  disabled={isView}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: "small",
                      error: !!errors.fechaFin,
                      helperText: errors.fechaFin?.message,
                    }
                  }}
                />
              )}
            />

            <Controller
              name="recordatorio"
              control={control}
              rules={{
                validate: (recordatorio) => {
                  if (recordatorio && fechaInicioWatch && recordatorio > fechaInicioWatch) {
                    return "El recordatorio no puede ser posterior a la fecha inicio";
                  }
                  return true;
                }
              }}
              render={({ field }) => (
                <DateTimePicker
                  label="Recordatorio"
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  disabled={isView}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: "small",
                      error: !!errors.recordatorio,
                      helperText: errors.recordatorio?.message,
                    }
                  }}
                />
              )}
            />
          </Row>

          {/* ===== Textos ===== */}
          <Row cols="1fr">
            <Controller
              name="descripcion"
              control={control}
              render={({ field }) => <TF label="Descripción" multiline minRows={2} {...field} />}
            />
          </Row>
          <Row cols="1fr">
            <Controller
              name="observaciones"
              control={control}
              render={({ field }) => <TF label="Observaciones" multiline minRows={3} {...field} />}
            />
          </Row>

          {/* ===== Botones ===== */}
          <Box sx={{ mt: 3, display: "flex", gap: 1, justifyContent: "space-between", alignItems: "center" }}>
            <Box>
              <UploadAdjuntoButton 
                clienteId={watchClienteId ? Number(watchClienteId) : undefined}
                casoId={watchCasoId ? Number(watchCasoId) : undefined}
                disabled={isView}
              />
            </Box>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button variant={isView ? "contained" : "outlined"} onClick={goBack} disabled={isSubmitting}>
                {isView ? "Volver" : "Cancelar"}
              </Button>
            {isView && canEditarEvento && (
              <Button
                variant="outlined"
                onClick={() => nav(`/eventos/editar/${id}`, { state: { from: location.state?.from || "/eventos" } })}
              >
                Editar
              </Button>
            )}
            {!isView && (
              <Button type="submit" variant="contained" disabled={loading}>
                {isSubmitting ? "Guardando..." : editMode ? "Guardar cambios" : "Crear evento"}
              </Button>
            )}
            </Box>
          </Box>
        </Box>
      </Paper>
    </LocalizationProvider>
  );
}
