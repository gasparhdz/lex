// src/pages/TareaForm.jsx
import { useEffect, useState } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { useNavigate, useParams, useSearchParams, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { usePermiso } from "../auth/usePermissions";
import { useAuth } from "../auth/AuthContext";
import {
  Paper, Box, TextField, MenuItem, Button, Typography, Alert, CircularProgress,
  Switch, FormControlLabel, Autocomplete, Divider, Table, TableHead, TableRow,
  TableCell, TableBody, IconButton, Tooltip, useMediaQuery
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import CheckIcon from "@mui/icons-material/Check";

import { enqueueSnackbar } from "notistack";
import api from "../api/axios";
import {
  getTarea, createTarea, updateTarea, listPrioridadesTarea,
  listSubtareas, addSubtarea, updateSubtarea, deleteSubtarea,
  reorderSubtareas, toggleSubtarea
} from "../api/tareas";
import { fetchUsuarios } from "../api/usuarios";
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
const toIso = (d) => (d instanceof Date && !isNaN(d) ? d.toISOString() : null);

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
export default function TareaForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const editMode = Boolean(id);               // hay id
  const modeQS = (searchParams.get("mode") || "").toLowerCase();
  const isView = modeQS === "view" || (Boolean(id) && !/\/editar\//.test(location.pathname));   
  
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

  // Verificaciones de permisos
  const canCrearTarea = usePermiso('TAREAS', 'crear');
  const canEditarTarea = usePermiso('TAREAS', 'editar');
  const canVerTarea = usePermiso('TAREAS', 'ver');
  
  // Usuario actual
  const { user } = useAuth();

  // Redirigir si no tiene permisos
  useEffect(() => {
    if (editMode && !canEditarTarea && !isView) {
      enqueueSnackbar('No tiene permisos para editar tareas', { variant: 'error' });
      nav(-1);
    } else if (!editMode && !canCrearTarea) {
      enqueueSnackbar('No tiene permisos para crear tareas', { variant: 'error' });
      nav(-1);
    }
    // En modo view, verificar que tenga al menos permisos de ver
    if (isView && editMode && !canVerTarea) {
      enqueueSnackbar('No tiene permisos para ver tareas', { variant: 'error' });
      nav(-1);
    }
  }, [editMode, canCrearTarea, canEditarTarea, canVerTarea, isView, nav]);

  // ====== Subtareas - ALTA (local) ======
  const [localSubs, setLocalSubs] = useState([]); // [{titulo, descripcion, orden}]
  const [subForm, setSubForm] = useState({ id: null, titulo: "", descripcion: "" });
  const [editingIndex, setEditingIndex] = useState(-1); // solo para alta

  // ====== Subtareas - EDICIÓN (server) ======
  const [srvSubs, setSrvSubs] = useState([]);
  const [busyReorder, setBusyReorder] = useState(false);
  const [busyToggleId, setBusyToggleId] = useState(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = useForm({
    defaultValues: {
      titulo: "",
      descripcion: "",
      clienteId: "",
      casoId: "",
      prioridadId: "",
      fechaLimite: null,
      recordatorio: null,
      asignadoA: "",
      completada: false,
      activo: true,
    },
  });
  
  const watchClienteId = watch('clienteId');
  const watchCasoId = watch('casoId');
  const fechaLimiteWatch = watch('fechaLimite');

  // ========= Prefill / retorno =========
  const prefillState = location.state?.prefill || null; // { clienteId?, casoId? }
  const prefillQS = {
    clienteId: searchParams.get("clienteId"),
    casoId: searchParams.get("casoId"),
  };

  const fromState = location.state?.from || null;
  const fromQuery = searchParams.get("from");
  const fallbackTo = fromState || fromQuery || "/tareas";
  const goBack = () => {
    if (window.history.length > 1) nav(-1);
    else {
      if (typeof fallbackTo === "string") nav(fallbackTo, { replace: true });
      else nav(fallbackTo, { replace: true });
    }
  };

  // Watch para filtrar casos
  const clienteIdWatch = useWatch({ control, name: "clienteId" });

  // ======= Queries =======
  const { data: tarea, isLoading: taLoading, isError: taErr, error: taErrObj } = useQuery({
    queryKey: ["tarea", id],
    queryFn: () => getTarea(id),
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

  const { data: prioridades = [], isLoading: prioLoading } = useQuery({
    queryKey: ["param-prioridad-tarea"],
    queryFn: listPrioridadesTarea,
    staleTime: 5 * 60 * 1000,
  });

  const { data: usuarios = [], isLoading: usrLoading } = useQuery({
    queryKey: ["usuarios-all"],
    queryFn: () => fetchUsuarios({ page: 1, pageSize: 500, activo: true }),
    staleTime: 5 * 60 * 1000,
  });

  /* ======= Carga inicial en edición ======= */
  useEffect(() => {
    if (!tarea) return;
    const prioridadId =
      tarea.prioridadId != null
        ? String(tarea.prioridadId)
        : (tarea.prioridad?.id != null ? String(tarea.prioridad.id) : "");
    reset({
      titulo:       tarea.titulo ?? "",
      descripcion:  tarea.descripcion ?? "",
      clienteId:    tarea.clienteId ? String(tarea.clienteId) : "",
      casoId:       tarea.casoId ? String(tarea.casoId) : "",
      prioridadId,
      fechaLimite:  toDate(tarea.fechaLimite),
      recordatorio: toDate(tarea.recordatorio),
      asignadoA:    tarea.asignadoA ? String(tarea.asignadoA) : "",
      completada:   Boolean(tarea.completada),
      activo:       tarea.activo ?? true,
    });

    if (editMode) {
      const prime = Array.isArray(tarea.items) ? tarea.items : [];
      setSrvSubs(prime);
    }
  }, [tarea, reset, editMode]);

  // si es ALTA: prefill por query
  useEffect(() => {
    if (editMode) return;
    const fl = searchParams.get("fechaLimite");
    if (fl) {
      const d = new Date(fl);
      if (!isNaN(d)) setValue("fechaLimite", d, { shouldDirty: false });
    }
  }, [editMode, searchParams, setValue]);

  // ALTA: precargar cliente/caso y asignar usuario actual
  useEffect(() => {
    if (editMode) return;
    const cid = prefillState?.clienteId ?? prefillQS.clienteId;
    const casoId = prefillState?.casoId ?? prefillQS.casoId;

    if (cid) setValue("clienteId", String(cid), { shouldDirty: false });
    if (casoId) setValue("casoId", String(casoId), { shouldDirty: false });
    
    // Pre-llenar con el usuario actual si existe
    if (user?.id) {
      setValue("asignadoA", String(user.id), { shouldDirty: false });
    }
  }, [editMode, prefillState, prefillQS.clienteId, prefillQS.casoId, setValue, user]);

  /* ======= Mutations ======= */
  const crearMut = useMutation({
    mutationFn: (payload) => createTarea(payload),
    onSuccess: () => {
      enqueueSnackbar("Tarea creada correctamente", { variant: "success" });
      goBack();
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "Error al crear";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const editarMut = useMutation({
    mutationFn: ({ id, body }) => updateTarea(id, body),
    onSuccess: () => {
      enqueueSnackbar("Tarea actualizada", { variant: "success" });
      goBack();
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "Error al actualizar";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  /* ======= Guardar ======= */
  const onSubmit = (values) => {
    if (isView) return; // en “ver” no se guarda
    const payload = limpiarPayload({ ...values });

    // IDs
    for (const k of ["clienteId", "casoId", "prioridadId", "asignadoA"]) {
      if (payload[k] != null && payload[k] !== "") payload[k] = Number(payload[k]);
    }

    // Fechas → ISO
    if (payload.fechaLimite) payload.fechaLimite = toIso(payload.fechaLimite);
    if (payload.recordatorio) payload.recordatorio = toIso(payload.recordatorio);

    // activo default
    if (payload.activo == null) payload.activo = true;

    // En ALTA, enviar subtareas locales
    if (!editMode && localSubs.length) {
      payload.items = localSubs.map((s, idx) => ({
        titulo: (s.titulo || "").trim(),
        descripcion: (s.descripcion || "").trim() || null,
        orden: Number.isFinite(s.orden) ? Math.trunc(s.orden) : idx,
      })).filter((s) => s.titulo);
    }

    if (editMode) editarMut.mutate({ id, body: payload });
    else crearMut.mutate(payload);
  };

  const loading =
    isSubmitting ||
    taLoading ||
    cliLoading ||
    casosLoading ||
    prioLoading;

  const errorBlock = (taErr && taErrObj) || (cliErr && cliErrObj);

  // TextField compacto (centraliza readOnly/disabled en modo VER)
  const TF = (props) => (
    <TextField
      fullWidth
      size="small"
      {...props}
      disabled={isView || props.disabled}
      InputProps={{
        ...props.InputProps,
        readOnly: isView || props.InputProps?.readOnly,
      }}
    />
  );

  // Filtrar casos por cliente
  const casosFiltrados = clienteIdWatch
    ? (casos || []).filter((c) => String(c.clienteId) === String(clienteIdWatch))
    : (casos || []);

  /* ====================== Subtareas: acciones ====================== */
  // Alta (local)
  const addOrUpdateLocalSub = () => {
    const titulo = (subForm.titulo || "").trim();
    if (!titulo) {
      enqueueSnackbar("La subtarea requiere Título", { variant: "warning" });
      return;
    }
    const clean = {
      titulo,
      descripcion: (subForm.descripcion || "").trim() || "",
    };
    if (editingIndex >= 0) {
      const copy = [...localSubs];
      copy[editingIndex] = { ...copy[editingIndex], ...clean };
      setLocalSubs(copy);
      setEditingIndex(-1);
    } else {
      setLocalSubs((arr) => [...arr, { ...clean, orden: arr.length }]);
    }
    setSubForm({ id: null, titulo: "", descripcion: "" });
  };
  const editLocal = (idx) => {
    setEditingIndex(idx);
    setSubForm({ id: null, titulo: localSubs[idx].titulo || "", descripcion: localSubs[idx].descripcion || "" });
  };
  const deleteLocal = (idx) => {
    setLocalSubs((arr) => arr.filter((_, i) => i !== idx).map((s, i) => ({ ...s, orden: i })));
    if (editingIndex === idx) {
      setEditingIndex(-1);
      setSubForm({ id: null, titulo: "", descripcion: "" });
    }
  };
  const moveLocal = (from, to) => {
    setLocalSubs((prev) => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next.map((s, i) => ({ ...s, orden: i }));
    });
  };

  // Edición (server)
  const tareaIdNum = Number(id);
  const reloadSrv = async () => {
    if (!editMode) return;
    const rows = await listSubtareas(tareaIdNum);
    setSrvSubs(Array.isArray(rows) ? rows : []);
  };
  const addOrUpdateSrv = async () => {
    const titulo = (subForm.titulo || "").trim();
    if (!titulo) {
      enqueueSnackbar("La subtarea requiere Título", { variant: "warning" });
      return;
    }
    const body = { titulo, descripcion: (subForm.descripcion || "").trim() || null };
    if (subForm.id) {
      await updateSubtarea(tareaIdNum, subForm.id, body);
    } else {
      await addSubtarea(tareaIdNum, body);
    }
    setSubForm({ id: null, titulo: "", descripcion: "" });
    await reloadSrv();
  };
  const editSrv = (row) => setSubForm({ id: row.id, titulo: row.titulo || "", descripcion: row.descripcion || "" });
  const deleteSrv = async (row) => {
    await deleteSubtarea(tareaIdNum, row.id);
    await reloadSrv();
  };
  const moveSrv = async (fromIdx, toIdx) => {
    if (fromIdx === toIdx) return;
    setBusyReorder(true);
    try {
      const next = [...srvSubs];
      const [m] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, m);
      const orden = next.map((it, idx) => ({ id: it.id, orden: idx }));
      await reorderSubtareas(tareaIdNum, orden);
      await reloadSrv();
    } finally {
      setBusyReorder(false);
    }
  };
  const toggleSrv = async (row) => {
    setBusyToggleId(row.id);
    try {
      await toggleSubtarea(tareaIdNum, row.id);
      await reloadSrv();
    } finally {
      setBusyToggleId(null);
    }
  };

  // Fuente de datos actual
  const items = editMode ? srvSubs : localSubs;

  /* ====================== Render ====================== */
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
            {isView ? "Ver tarea" : editMode ? "Editar tarea" : "Nueva tarea"}
          </Typography>
          {loading && <CircularProgress size={18} />}
        </Box>

        {errorBlock && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {taErrObj?.message || cliErrObj?.message || "Error cargando datos"}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
          {/* ===== Cliente – Caso ===== */}
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
                const valueObj =
                  casos.find((c) => String(c.id) === String(field.value)) || null;
                return (
                  <Autocomplete
                    options={casosFiltrados}
                    value={valueObj}
                    loading={casosLoading}
                    getOptionLabel={(o) => displayCaso(o)}
                    isOptionEqualToValue={(o, v) => String(o.id) === String(v.id)}
                    onChange={isView ? undefined : (_e, opt) => field.onChange(opt ? String(opt.id) : "")}
                    disabled={isView}
                    renderInput={(params) => <TF {...params} label="Caso" />}
                  />
                );
              }}
            />
          </Row>

          {/* ===== Título – Prioridad ===== */}
          <Row cols="2fr">
            <Controller
              name="titulo"
              control={control}
              rules={isView ? undefined : { required: "Ingresá el título" }}
              render={({ field }) => (
                <TF
                  label="Título"
                  {...field}
                  error={!isView && !!errors.titulo}
                  helperText={!isView ? errors.titulo?.message : ""}
                />
              )}
            />

          </Row>

          {/* ===== Asignado a – Completada ===== */}
          <Row cols="0.8fr 1fr 1fr 1fr 0.7fr">
            
          <Controller
              name="prioridadId"
              control={control}
              render={({ field }) => (
                <TF select label="Prioridad" {...field}>
                  <MenuItem value="">{ "(sin prioridad)" }</MenuItem>
                  {prioridades.map((p) => (
                    <MenuItem key={p.id} value={String(p.id)}>
                      {paramLabel(p)}
                    </MenuItem>
                  ))}
                </TF>
              )}
            />
            <Controller
              name="asignadoA"
              control={control}
              render={({ field }) => (
                <TF select label="Asignado a" {...field}>
                  <MenuItem value="">{ "(sin asignar)" }</MenuItem>
                  {usuarios.map((u) => (
                    <MenuItem key={u.id} value={String(u.id)}>
                      {`${u.nombre} ${u.apellido}`}
                    </MenuItem>
                  ))}
                </TF>
              )}
            />

            <Controller
              name="fechaLimite"
              control={control}
              rules={{
                validate: (fechaLimite) => {
                  if (fechaLimite && fechaLimite < new Date()) {
                    return "La fecha límite no puede ser anterior a la fecha actual";
                  }
                  return true;
                }
              }}
              render={({ field }) => (
                <DateTimePicker
                  label="Fecha límite"
                  value={field.value}
                  onChange={(v) => field.onChange(v)}
                  disabled={isView}
                  slotProps={{
                    textField: { 
                      fullWidth: true, 
                      size: "small", 
                      InputProps: { readOnly: true },
                      error: !!errors.fechaLimite,
                      helperText: errors.fechaLimite?.message,
                    },
                    actionBar: { actions: [] },
                    openPickerButton: { disabled: isView },
                  }}
                />
              )}
            />

            <Controller
              name="recordatorio"
              control={control}
              rules={{
                validate: (recordatorio) => {
                  if (recordatorio && fechaLimiteWatch && recordatorio > fechaLimiteWatch) {
                    return "El recordatorio no puede ser posterior a la fecha límite";
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
                      InputProps: { readOnly: true },
                      error: !!errors.recordatorio,
                      helperText: errors.recordatorio?.message,
                    },
                    actionBar: { actions: [] },
                    openPickerButton: { disabled: isView },
                  }}
                />
              )}
            />

            <Controller
              name="completada"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  sx={{ ml: 1, mt: 0.6 }}
                  control={
                    <Switch
                      checked={Boolean(field.value)}
                      onChange={(e) => field.onChange(e.target.checked)}
                      color="secondary"
                      disabled={isView}
                    />
                  }
                  label="Completada"
                />
              )}
            />
          </Row>

          {/* ===== Descripción ===== */}
          <Row cols="1fr">
            <Controller
              name="descripcion"
              control={control}
              render={({ field }) => (
                <TF label="Descripción" multiline minRows={3} {...field} />
              )}
            />
          </Row>

          {/* ====================== SUBTAREAS ====================== */}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
            Subtareas
          </Typography>

          {/* Fila de alta/edición inline (oculta en VER) */}
          {!isView && (
            <Row cols="3fr 5fr auto">
              <TextField
                size="small"
                label="Título *"
                fullWidth
                value={subForm.titulo}
                onChange={(e) => setSubForm((f) => ({ ...f, titulo: e.target.value }))}
              />
              <TextField
                size="small"
                label="Descripción"
                fullWidth
                value={subForm.descripcion}
                onChange={(e) => setSubForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
              {editMode ? (
                <Tooltip title={subForm.id ? "Guardar cambios" : "Agregar subtarea"}>
                  <span>
                    <IconButton
                      color="primary"
                      onClick={addOrUpdateSrv}
                      disabled={busyReorder}
                      sx={{ alignSelf: "center" }}
                    >
                      {subForm.id ? <SaveIcon /> : <AddIcon />}
                    </IconButton>
                  </span>
                </Tooltip>
              ) : (
                <Tooltip title={editingIndex >= 0 ? "Guardar subtarea" : "Agregar subtarea"}>
                  <IconButton color="primary" onClick={addOrUpdateLocalSub} sx={{ alignSelf: "center" }}>
                    {editingIndex >= 0 ? <SaveIcon /> : <AddIcon />}
                  </IconButton>
                </Tooltip>
              )}
            </Row>
          )}

          {/* Listado */}
          {isDesktop ? (
            // ===== Tabla (desktop)
            <Box sx={{ overflowX: "auto", borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
              <Table size="small" sx={{ "& td, & th": (t) => ({ borderBottom: `1px solid ${t.palette.divider}` }) }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Título</TableCell>
                    <TableCell>Descripción</TableCell>
                    <TableCell align="center" sx={{ width: 100 }}>Completada</TableCell>
                    {!isView && <TableCell align="center" sx={{ width: 120 }}>Orden</TableCell>}
                    {!isView && <TableCell align="right" sx={{ width: 150 }}>Acciones</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((s, idx) => (
                    <TableRow key={s.id ?? idx} hover>
                      <TableCell>{s.titulo}</TableCell>
                      <TableCell>{s.descripcion || "-"}</TableCell>
                      <TableCell align="center">
                        {editMode && !isView ? (
                          <Tooltip title="Alternar completada">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => toggleSrv(s)}
                                disabled={busyToggleId === s.id}
                              >
                                <CheckIcon color={s.completada ? "success" : "disabled"} fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        ) : (
                          <CheckIcon color={s.completada ? "success" : "disabled"} fontSize="small" />
                        )}
                      </TableCell>

                      {!isView && (
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            disabled={idx === 0 || (editMode && busyReorder)}
                            onClick={() => (editMode ? moveSrv(idx, idx - 1) : moveLocal(idx, idx - 1))}
                            sx={{ mr: 0.5 }}
                          >
                            <ArrowUpwardIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            disabled={idx === items.length - 1 || (editMode && busyReorder)}
                            onClick={() => (editMode ? moveSrv(idx, idx + 1) : moveLocal(idx, idx + 1))}
                          >
                            <ArrowDownwardIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}

                      {!isView && (
                        <TableCell align="right">
                          <Tooltip title="Editar">
                            <IconButton
                              size="small"
                              onClick={() => (editMode ? editSrv(s) : editLocal(idx))}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => (editMode ? deleteSrv(s) : deleteLocal(idx))}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}

                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={isView ? 3 : 5}>
                        <Box sx={{ py: 3, textAlign: "center", opacity: 0.8 }}>
                          <Typography variant="body2">
                            {editMode ? "No hay subtareas cargadas." : "No agregaste subtareas aún."}
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          ) : (
            // ===== Cards (mobile)
            <Box sx={{ display: "grid", gap: 1 }}>
              {items.map((s, idx) => (
                <Box
                  key={s.id ?? idx}
                  sx={{
                    border: (t) => `1px solid ${t.palette.divider}`,
                    borderRadius: 2,
                    p: 1.2,
                    display: "grid",
                    gap: 0.5,
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{s.titulo}</Typography>
                  {!!s.descripcion && <Typography variant="body2">{s.descripcion}</Typography>
                  }
                  <Box sx={{ display: "flex", gap: 1, justifyContent: "space-between", mt: 0.5 }}>
                    <Box>
                      {editMode && !isView ? (
                        <Button size="small" onClick={() => toggleSrv(s)} disabled={busyToggleId === s.id}>
                          {s.completada ? "Completada" : "Marcar completa"}
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          {s.completada ? "Completada" : "Pendiente"}
                        </Typography>
                      )}
                    </Box>

                    {!isView && (
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        <IconButton
                          size="small"
                          disabled={idx === 0 || (editMode && busyReorder)}
                          onClick={() => (editMode ? moveSrv(idx, idx - 1) : moveLocal(idx, idx - 1))}
                        >
                          <ArrowUpwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          disabled={idx === items.length - 1 || (editMode && busyReorder)}
                          onClick={() => (editMode ? moveSrv(idx, idx + 1) : moveLocal(idx, idx + 1))}
                        >
                          <ArrowDownwardIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => (editMode ? editSrv(s) : editLocal(idx))}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" onClick={() => (editMode ? deleteSrv(s) : deleteLocal(idx))}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                </Box>
              ))}
              {items.length === 0 && (
                <Typography variant="body2" sx={{ opacity: 0.7 }}>
                  {editMode ? "No hay subtareas cargadas." : "No agregaste subtareas aún."}
                </Typography>
              )}
            </Box>
          )}

          {/* ===== Botones ===== */}
          <Box sx={{ mt: 3, display: "flex", gap: 1, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
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

            {isView && canEditarTarea && (
              <Button
                variant="outlined"
                onClick={() =>
                  nav(`/tareas/editar/${id}`, {
                    state: { from: fallbackTo },
                  })
                }
              >
                  Editar
              </Button>
            )}
            {!isView && (
              <Button type="submit" variant="contained" disabled={loading}>
                {isSubmitting ? "Guardando..." : editMode ? "Guardar cambios" : "Crear tarea"}
              </Button>
            )}
            </Box>
          </Box>
        </Box>
      </Paper>
    </LocalizationProvider>
  );
}
