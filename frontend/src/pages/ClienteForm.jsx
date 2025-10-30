// src/pages/ClienteForm.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@mui/material/styles";
import { useForm, Controller, useWatch } from "react-hook-form";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermiso } from "../auth/usePermissions";
import {
  Paper, Box, TextField, MenuItem, Button, Typography, Alert, CircularProgress,
  Autocomplete, Divider, Table, TableHead, TableRow, TableCell, TableBody,
  IconButton, Tooltip
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";

import { enqueueSnackbar } from "notistack";
import api from "../api/axios";
import UploadAdjuntoButton from "../components/adjuntos/UploadAdjuntoButton";

/* =================== Fetchers =================== */
async function fetchTiposPersona() {
  const { data } = await api.get("/parametros", {
    params: { categoria: "TIPO_PERSONA", activo: true, page: 1, pageSize: 1000, orderBy: "orden", order: "asc" },
  });
  return Array.isArray(data) ? data : data?.data ?? [];
}
async function fetchCliente(id) {
  const { data } = await api.get(`/clientes/${id}`);
  return data;
}
async function fetchLocalidades({ queryKey }) {
  const [_k, { search }] = queryKey;
  const { data } = await api.get("/localidades", { params: { search } });
  return data?.data ?? [];
}

/* =================== Utils =================== */
function limpiarPayload(values) {
  const out = {};
  for (const [k, v] of Object.entries(values)) {
    if (v === "" || v === null || v === undefined) continue;
    out[k] = typeof v === "string" ? v.trim() : v;
  }
  return out;
}
function toDateInput(d) {
  if (!d) return "";
  try { return String(d).slice(0, 10); } catch { return ""; }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s()+\-]{6,20}$/; // dígitos/espacios/+/-/( )
const TODAY = new Date().toISOString().slice(0, 10);
const MIN_DATE = "1900-01-01";

// —— helpers de CUIT/DNI ——
function formatCUIT(value) {
  const d = String(value || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return d.replace(/(\d{2})(\d{0,8})/, "$1-$2");
  return d.replace(/(\d{2})(\d{8})(\d{1})/, "$1-$2-$3");
}
function cuitDigits(v) {
  return String(v || "").replace(/\D/g, "").slice(0, 11);
}
function cuitIsValid(v) {
  const d = cuitDigits(v);
  if (d.length !== 11) return false;
  const nums = d.split("").map(Number);
  const weights = [5,4,3,2,7,6,5,4,3,2];
  const sum = weights.reduce((acc, w, i) => acc + w * nums[i], 0);
  let dv = 11 - (sum % 11);
  if (dv === 11) dv = 0;
  if (dv === 10) dv = 9;
  return dv === nums[10];
}
function dniFromCuit(v) {
  const d = cuitDigits(v);
  if (d.length !== 11) return "";
  return d.slice(2, 10); // 8 del medio
}

// 👉 Helper de filas con CSS Grid
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
// Etiqueta visible para cada localidad
const locLabel = (loc) => {
  if (!loc) return "";
  const cp = loc.codigosPostales?.[0]?.codigo ? ` (${loc.codigosPostales[0].codigo})` : "";
  return `${loc.nombre}${cp}`;
};

// TextField compacto (estable, fuera del componente)
const TF = (props) => <TextField fullWidth size="small" {...props} />;

/* =================== Componente =================== */
export default function ClienteForm() {
  const { id } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  // 👇 Volver exactamente a donde estaba la lista (incluye ?page, ?search, etc.)
  const backTo = location.state?.from ?? { pathname: "/clientes" };
  const goBack = () => nav(backTo, { replace: true });

  const qc = useQueryClient();
  const editMode = Boolean(id);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  
  // Verificaciones de permisos
  const canCrearCliente = usePermiso('CLIENTES', 'crear');
  const canEditarCliente = usePermiso('CLIENTES', 'editar');
  
  // Redirigir si no tiene permisos
  useEffect(() => {
    if (editMode && !canEditarCliente) {
      enqueueSnackbar('No tiene permisos para editar clientes', { variant: 'error' });
      nav(-1);
    } else if (!editMode && !canCrearCliente) {
      enqueueSnackbar('No tiene permisos para crear clientes', { variant: 'error' });
      nav(-1);
    }
  }, [editMode, canCrearCliente, canEditarCliente, nav]);

  const { data: tiposPersona = [], isLoading: tpLoading, isError: tpError, error: tpErr } =
    useQuery({ queryKey: ["tiposPersona"], queryFn: fetchTiposPersona, staleTime: 60*60*1000, refetchOnWindowFocus: false });

  const { data: cli, isLoading: cliLoading, isError: cliError, error: cliErr } = useQuery({
    queryKey: ["cliente", id],
    queryFn: () => fetchCliente(id),
    enabled: editMode,
  });

  // Localidades
  const { data: localidades = [], isLoading: locLoading } = useQuery({
    queryKey: ["localidades", { search: "" }],
    queryFn: fetchLocalidades,
    staleTime: 5 * 60 * 1000,
  });

  // ---------------- Contactos (UI & mutations) ----------------
  const [localContactos, setLocalContactos] = useState([]);
  const [contactForm, setContactForm] = useState({ id: null, nombre: "", rol: "", email: "", telefono: "", observaciones: "" });
  const [editingIndex, setEditingIndex] = useState(-1); // -1 = agregando nuevo

  const crearContactoMut = useMutation({
    mutationFn: async ({ clienteId, body }) => {
      const { data } = await api.post(`/clientes/${clienteId}/contactos`, body);
      return data; // contacto creado
    },
    onSuccess: (nuevo) => {
      enqueueSnackbar("Contacto agregado", { variant: "success" });
      if (editMode) {
        qc.setQueryData(["cliente", id], (prev) =>
          prev ? { ...prev, contactos: [...(prev.contactos ?? []), nuevo] } : prev
        );
      }
      setContactForm({ id: null, nombre: "", rol: "", email: "", telefono: "", observaciones: "" });
      setEditingIndex(-1);
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "No se pudo agregar el contacto";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });
  const actualizarContactoMut = useMutation({
    mutationFn: async ({ clienteId, contactoId, body }) => {
      const { data } = await api.put(`/clientes/${clienteId}/contactos/${contactoId}`, body);
      return data; // contacto actualizado
    },
    onSuccess: (upd) => {
      enqueueSnackbar("Contacto actualizado", { variant: "success" });
      if (editMode) {
        qc.setQueryData(["cliente", id], (prev) =>
          prev
            ? {
                ...prev,
                contactos: (prev.contactos ?? []).map((c) => (c.id === upd.id ? { ...c, ...upd } : c)),
              }
            : prev
        );
      }
      setContactForm({ id: null, nombre: "", rol: "", email: "", telefono: "", observaciones: "" });
      setEditingIndex(-1);
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "No se pudo actualizar el contacto";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });
  const eliminarContactoMut = useMutation({
    mutationFn: async ({ clienteId, contactoId }) => {
      await api.delete(`/clientes/${clienteId}/contactos/${contactoId}`);
      return contactoId;
    },
    onSuccess: (deletedId) => {
      enqueueSnackbar("Contacto eliminado", { variant: "success" });
      if (editMode) {
        qc.setQueryData(["cliente", id], (prev) =>
          prev ? { ...prev, contactos: (prev.contactos ?? []).filter((c) => c.id !== deletedId) } : prev
        );
      }
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "No se pudo eliminar el contacto";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const addOrUpdateLocalContacto = () => {
    if (!contactForm.nombre?.trim()) {
      enqueueSnackbar("El contacto requiere al menos el Nombre", { variant: "warning" });
      return;
    }
    const clean = {
      nombre: contactForm.nombre.trim(),
      rol: contactForm.rol?.trim() || null,
      email: contactForm.email?.trim() || null,
      telefono: contactForm.telefono?.trim() || null,
      observaciones: contactForm.observaciones?.trim() || null,
    };
    if (editingIndex >= 0) {
      const copy = [...localContactos];
      copy[editingIndex] = clean;
      setLocalContactos(copy);
    } else {
      setLocalContactos((arr) => [...arr, clean]);
    }
    setContactForm({ id: null, nombre: "", rol: "", email: "", telefono: "", observaciones: "" });
    setEditingIndex(-1);
  };

  const editLocal = (idx) => {
    setEditingIndex(idx);
    setContactForm({ id: null, ...localContactos[idx] });
  };
  const deleteLocal = (idx) => {
    setLocalContactos((arr) => arr.filter((_, i) => i !== idx));
    if (editingIndex === idx) {
      setContactForm({ id: null, nombre: "", rol: "", email: "", telefono: "", observaciones: "" });
      setEditingIndex(-1);
    }
  };

  // ---------------- RHF (cliente) ----------------
  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isSubmitting, errors, isDirty },
  } = useForm({
    defaultValues: {
      tipoPersonaId: "",
      // Física
      nombre: "",
      apellido: "",
      dni: "", // se completa desde CUIT si PF (no se muestra)
      fechaNacimiento: "",
      // Jurídica
      razonSocial: "",
      fechaInicioActividad: "",
      // Comunes
      cuit: "",
      email: "",
      telCelular: "",
      calle: "",
      nro: "",
      piso: "",
      depto: "",
      codigoPostal: "",
      localidadId: "",
      notas: "",
    },
  });
  
  const watchClienteId = watch ? watch('id') : undefined; // El cliente actual (si es edición)

  const tipoPersonaId = useWatch({ control, name: "tipoPersonaId" });
  const cuitWatch = useWatch({ control, name: "cuit" });

  // PF default en alta
  useEffect(() => {
    if (editMode) return;
    if (!tiposPersona?.length) return;
    if (String(tipoPersonaId || "") !== "") return;

    const fisica =
      tiposPersona.find(t => String(t.id) === "139") ||
      tiposPersona.find(t => String(t.codigo || "").toUpperCase().includes("FISICA"));
    if (fisica) setValue("tipoPersonaId", String(fisica.id), { shouldDirty: false });
  }, [editMode, tiposPersona, tipoPersonaId, setValue]);

  // Carga inicial en edición (no sobreescribir si el usuario ya editó)
  const hydratedRef = useRef(false);
  const lastTipoRef = useRef(null); // <- recordamos el último tipo aplicado
  useEffect(() => {
    if (!cli) return;
    if (hydratedRef.current && isDirty) return; // evita pisar ediciones locales
    reset({
      tipoPersonaId: cli.tipoPersonaId != null ? String(cli.tipoPersonaId) : "",
      nombre: cli.nombre ?? "",
      apellido: cli.apellido ?? "",
      dni: cli.dni ?? "",
      fechaNacimiento: toDateInput(cli.fechaNacimiento),
      razonSocial: cli.razonSocial ?? "",
      // ✅ fix: usar fechaInicioActividad del cliente, no fechaNacimiento
      fechaInicioActividad: toDateInput(cli.fechaNacimiento),
      cuit: cli.cuit ?? "",
      email: cli.email ?? "",
      telCelular: cli.telCelular ?? "",
      calle: cli.dirCalle ?? "",
      nro: cli.dirNro ?? "",
      piso: cli.dirPiso ?? "",
      depto: cli.dirDepto ?? "",
      codigoPostal: cli.codigoPostal ?? "",
      localidadId: cli.localidadId ?? "",
      notas: cli.observaciones ?? "",
    });
    hydratedRef.current = true;
    // fijamos el último tipo para que el limpiador no se dispare tras hidratar
    lastTipoRef.current = cli.tipoPersonaId != null ? String(cli.tipoPersonaId) : "";
  }, [cli, reset, isDirty]);

  // Lookup del tipo seleccionado
  const selTipo = useMemo(
    () => tiposPersona.find((t) => String(t.id) === String(tipoPersonaId)),
    [tiposPersona, tipoPersonaId]
  );

  // *** CLAVE: determinar si es Jurídica sin depender de IDs mágicos ni del timing de tiposPersona ***
  const esJuridica = useMemo(() => {
    // 1) Si ya tengo el tipo seleccionado, uso su código
    if (selTipo?.codigo) {
      return String(selTipo.codigo).toUpperCase().includes("JURIDICA");
    }
    // 2) Si todavía no cargaron los tipos, pero ya tengo el cliente, uso su tipo/campos
    if (cli?.tipoPersona?.codigo) {
      return String(cli.tipoPersona.codigo).toUpperCase().includes("JURIDICA");
    }
    // 3) Fallback: si estoy editando y viene razón social sin nombre/apellido, asumo PJ
    if (editMode) {
      return Boolean(cli?.razonSocial && !cli?.nombre && !cli?.apellido);
    }
    return false;
  }, [selTipo, cli, editMode]);

  // Limpiar campos del otro tipo SOLO cuando el usuario cambie realmente el tipo
  useEffect(() => {
    if (!hydratedRef.current) return; // aún no cargamos el form
    const curr = String(tipoPersonaId || "");
    if (lastTipoRef.current === curr) return; // no hubo cambio real
    // actualizamos el last antes de limpiar para evitar bucles
    lastTipoRef.current = curr;

    if (curr === "") return;
    if (esJuridica) {
      setValue("nombre", "", { shouldDirty: true });
      setValue("apellido", "", { shouldDirty: true });
      setValue("dni", "", { shouldDirty: true });
      setValue("fechaNacimiento", "", { shouldDirty: true });
    } else {
      setValue("razonSocial", "", { shouldDirty: true });
      setValue("fechaInicioActividad", "", { shouldDirty: true });
    }
  }, [tipoPersonaId, esJuridica, setValue]);

  // Autocompletar DNI desde CUIT (solo PF con CUIT válido)
  useEffect(() => {
    const d = cuitDigits(cuitWatch);
    if (!esJuridica && d.length === 11 && cuitIsValid(d)) {
      const dniCalc = dniFromCuit(d);
      if (dniCalc) setValue("dni", dniCalc, { shouldDirty: true });
    }
  }, [cuitWatch, esJuridica, setValue]);

  /* =============== Mutaciones cliente =============== */
  const crearMut = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post("/clientes", payload);
      return data;
    },
    onSuccess: async (nuevo) => {
      if (localContactos.length) {
        try {
          await Promise.all(localContactos.map((c) => api.post(`/clientes/${nuevo.id}/contactos`, c)));
        } catch {
          enqueueSnackbar("El cliente se creó, pero algunos contactos no pudieron guardarse.", { variant: "warning" });
        }
      }
      enqueueSnackbar("Cliente creado correctamente", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      nav(backTo, { replace: true }); // 👈 vuelve a la lista como estaba
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "Error al crear";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const editarMut = useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.put(`/clientes/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      enqueueSnackbar("Cliente actualizado", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["cliente", id] });
      nav(backTo, { replace: true }); // 👈 vuelve a la lista como estaba
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || e?.response?.data?.message || "Error al actualizar";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const onSubmit = (values) => {
    const payload = {
      ...values,
      tipoPersonaId: values.tipoPersonaId ? Number(values.tipoPersonaId) : undefined,
    };

    // Reglas por tipo
    if (esJuridica) {
      if (!payload.razonSocial?.trim()) {
        enqueueSnackbar("Razón social requerida para persona jurídica", { variant: "warning" });
        return;
      }
    } else {
      if (!(payload.nombre?.trim() && payload.apellido?.trim())) {
        enqueueSnackbar("Nombre y Apellido requeridos para persona física", { variant: "warning" });
        return;
      }
    }

    // CUIT obligatorio + válido
    const c = cuitDigits(payload.cuit);
    if (!c) {
      enqueueSnackbar("CUIT es obligatorio.", { variant: "warning" });
      return;
    }
    if (c.length !== 11 || !cuitIsValid(c)) {
      enqueueSnackbar("CUIT inválido (verificá el dígito).", { variant: "warning" });
      return;
    }
    payload.cuit = c;

    // Autocompletar DNI en PF si no vino de antes
    if (!esJuridica && !payload.dni) {
      payload.dni = dniFromCuit(c);
    }

    // Normalizaciones varias
    if (payload.dni) payload.dni = String(payload.dni).replace(/\D/g, "");
    if (payload.nro) payload.nro = String(payload.nro).replace(/\D/g, "");
    if (!payload.localidadId || String(payload.localidadId).trim() === "") {
      delete payload.localidadId;
    }

    const body = limpiarPayload(payload);
    if (editMode) editarMut.mutate(body);
    else crearMut.mutate(body);
  };

  const loading = tpLoading || (editMode && cliLoading);
  const errorBlock = (tpError && tpErr) || (cliError && cliErr);

  // ---------------- Render ----------------
  return (
    <Paper elevation={0} sx={{ mt: 2, p: 2, borderRadius: 3, border: (t) => `1px solid ${t.palette.divider}`, bgcolor: (t) => (t.palette.mode === "dark" ? "background.paper" : "#fff") }}>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
          {editMode ? "Editar cliente" : "Nuevo cliente"}
        </Typography>
        {loading && <CircularProgress size={18} />}
      </Box>

      {errorBlock && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {tpErr?.message || cliErr?.message || "Error cargando datos"}
        </Alert>
      )}

      <Box component="form" noValidate onSubmit={handleSubmit(onSubmit)}>
        {/* ================= PERSONA JURÍDICA ================= */}
        {esJuridica ? (
          <>
            {/* Fila 1 */}
            <Row cols="2fr 4fr 2fr 2fr">
              <Controller
                name="tipoPersonaId"
                control={control}
                rules={{ required: "Seleccioná el tipo de persona" }}
                disabled={editMode}
                render={({ field }) => (
                  <TF select label="Tipo de persona" {...field} error={!!errors.tipoPersonaId} helperText={errors.tipoPersonaId?.message}>
                    {tiposPersona.map((t) => (
                      <MenuItem key={t.id} value={String(t.id)}>
                        {t.nombre || t.codigo}
                      </MenuItem>
                    ))}
                  </TF>
                )}
              />
              <Controller
                name="razonSocial"
                control={control}
                rules={{ required: "Razón social requerida" }}
                render={({ field }) => (
                  <TF label="Razón social" {...field} error={!!errors.razonSocial} helperText={errors.razonSocial?.message} />
                )}
              />
              <Controller
                name="cuit"
                control={control}
                rules={{
                  required: "CUIT requerido",
                  validate: (v) => {
                    const d = cuitDigits(v);
                    if (d.length !== 11) return "CUIT debe tener 11 dígitos";
                    return cuitIsValid(d) || "CUIT inválido";
                  },
                }}
                render={({ field }) => (
                  <TF
                    label="CUIT"
                    {...field}
                    onChange={(e) => field.onChange(formatCUIT(e.target.value))}
                    placeholder="30xxxxxxxxx"
                    inputProps={{ inputMode: "numeric" }}
                    error={!!errors.cuit}
                    helperText={errors.cuit?.message}
                  />
                )}
              />
              <Controller
                name="fechaInicioActividad"
                control={control}
                render={({ field }) => (
                  <TF type="date" label="Fecha inicio actividad" {...field} InputLabelProps={{ shrink: true }} inputProps={{ min: MIN_DATE, max: TODAY }} />
                )}
              />
            </Row>

            {/* Fila 2 */}
            <Row cols="3fr 2fr 3fr 1fr 1fr 1fr 2fr">
              <Controller name="email" control={control} rules={{ validate: (v) => !v || EMAIL_RE.test(v) || "Email inválido",}}
               render={({ field }) => <TF type="email" label="Email" {...field} error={!!errors.email} helperText={errors.email?.message}/>} />
              <Controller name="telCelular" control={control} rules={{ validate: (v) => !v || PHONE_RE.test(v) || "Teléfono inválido",}}
               render={({ field }) => <TF label="Tel. Celular" {...field} error={!!errors.telCelular} helperText={errors.telCelular?.message} />} />
              <Controller name="calle" control={control} render={({ field }) => <TF label="Calle" {...field} />} />
              <Controller name="nro" control={control} render={({ field }) => <TF label="Nro" {...field} onChange={(e)=>field.onChange(e.target.value.replace(/\D/g,""))} />} />
              <Controller name="piso" control={control} render={({ field }) => <TF label="Piso" {...field} />} />
              <Controller name="depto" control={control} render={({ field }) => <TF label="Depto" {...field} />} />
              <Controller
                name="localidadId"
                control={control}
                render={({ field }) => {
                  const selected = localidades.find(l => String(l.id) === String(field.value)) || null;
                  return (
                    <Autocomplete
                      options={localidades}
                      loading={locLoading}
                      value={selected}
                      getOptionLabel={locLabel}
                      isOptionEqualToValue={(o, v) => String(o.id) === String(v.id)}
                      onChange={(_e, opt) => {
                        field.onChange(opt ? String(opt.id) : "");
                        const cp = opt?.codigosPostales?.[0]?.codigo || "";
                        setValue("codigoPostal", cp, { shouldDirty: true });
                      }}
                      renderInput={(params) => (
                        <TF {...params} label="Localidad" />
                      )}
                    />
                  );
                }}
              />
            </Row>

            {/* Fila 3 */}
            <Row cols="1fr">
              <Controller name="notas" control={control} render={({ field }) => <TF label="Entrevista inicial" multiline minRows={3} {...field} />} />
            </Row>
          </>
        ) : (
          /* ================= PERSONA FÍSICA ================= */
          <>
            {/* Fila 1 (DNI oculto y auto) */}
            <Row cols="2fr 2fr 2fr 2fr 2fr">
              <Controller
                name="tipoPersonaId"
                control={control}
                rules={{ required: "Seleccioná el tipo de persona" }}
                disabled={editMode}
                render={({ field }) => (
                  <TF select label="Tipo de persona" {...field} error={!!errors.tipoPersonaId} helperText={errors.tipoPersonaId?.message}>
                    {tiposPersona.map((t) => (
                      <MenuItem key={t.id} value={String(t.id)}>
                        {t.nombre || t.codigo}
                      </MenuItem>
                    ))}
                  </TF>
                )}
              />
              <Controller name="nombre" control={control} rules={{ required: "Nombre requerido" }}
                render={({ field }) => <TF label="Nombre" {...field} error={!!errors.nombre} helperText={errors.nombre?.message} />} />
              <Controller name="apellido" control={control} rules={{ required: "Apellido requerido" }}
                render={({ field }) => <TF label="Apellido" {...field} error={!!errors.apellido} helperText={errors.apellido?.message} />} />
              <Controller
                name="cuit"
                control={control}
                rules={{
                  required: "CUIT requerido",
                  validate: (v) => {
                    const d = cuitDigits(v);
                    if (d.length !== 11) return "CUIT debe tener 11 dígitos";
                    return cuitIsValid(d) || "CUIT inválido";
                  },
                }}
                render={({ field }) => (
                  <TF
                    label="CUIT"
                    {...field}
                    onChange={(e) => field.onChange(formatCUIT(e.target.value))}
                    placeholder="20xxxxxxxxx"
                    inputProps={{ inputMode: "numeric" }}
                    error={!!errors.cuit}
                    helperText={errors.cuit?.message}
                  />
                )}
              />
              <Controller name="fechaNacimiento" control={control}
                render={({ field }) => <TF type="date" label="Fecha nacimiento" {...field} InputLabelProps={{ shrink: true }} inputProps={{ min: MIN_DATE, max: TODAY }} />} />
            </Row>

            {/* Fila 2 */}
            <Row cols="3fr 1.5fr 3fr 0.75fr 0.75fr 0.75fr 3fr">
              <Controller name="email" control={control} rules={{validate: (v) => !v || EMAIL_RE.test(v) || "Email inválido", }} render={({ field }) => <TF type="email" label="Email" {...field} error={!!errors.email} helperText={errors.email?.message} />} />
              <Controller name="telCelular" control={control} rules={{validate: (v) => !v || PHONE_RE.test(v) || "Teléfono inválido", }} render={({ field }) => <TF label="Tel. Celular" {...field} error={!!errors.telCelular} helperText={errors.telCelular?.message} />} />
              <Controller name="calle" control={control} render={({ field }) => <TF label="Calle" {...field} />} />
              <Controller name="nro" control={control} render={({ field }) => <TF label="Nro" {...field} onChange={(e)=>field.onChange(e.target.value.replace(/\D/g,""))} />} />
              <Controller name="piso" control={control} render={({ field }) => <TF label="Piso" {...field} />} />
              <Controller name="depto" control={control} render={({ field }) => <TF label="Depto" {...field} />} />
              <Controller
                name="localidadId"
                control={control}
                render={({ field }) => {
                  const selected = localidades.find(l => String(l.id) === String(field.value)) || null;
                  return (
                    <Autocomplete
                      options={localidades}
                      loading={locLoading}
                      value={selected}
                      getOptionLabel={locLabel}
                      isOptionEqualToValue={(o, v) => String(o.id) === String(v.id)}
                      onChange={(_e, opt) => {
                        field.onChange(opt ? String(opt.id) : "");
                        const cp = opt?.codigosPostales?.[0]?.codigo || "";
                        setValue("codigoPostal", cp, { shouldDirty: true });
                      }}
                      renderInput={(params) => (
                        <TF {...params} label="Localidad" />
                      )}
                    />
                  );
                }}
              />
            </Row>

            {/* Fila 3 */}
            <Row cols="1fr">
              <Controller name="notas" control={control} render={({ field }) => <TF label="Entrevista inicial" multiline minRows={3} {...field} />} />
            </Row>
          </>
        )}

        {/* ====================== CONTACTOS ====================== */}
        <Divider sx={{ my: 2 }} />
        <Typography id="contactos" variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Contactos
        </Typography>

        {/* Fila de alta/edición inline */}
        <Row cols="2fr 1.3fr 2fr 1.5fr 3fr auto">
          <TextField size="small" label="Nombre *" fullWidth value={contactForm.nombre} onChange={(e) => setContactForm((f) => ({ ...f, nombre: e.target.value }))} />
          <TextField size="small" label="Rol" fullWidth value={contactForm.rol} onChange={(e) => setContactForm((f) => ({ ...f, rol: e.target.value }))} />
          <TextField size="small" type="email" label="Email" fullWidth value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} />
          <TextField size="small" label="Teléfono" fullWidth value={contactForm.telefono} onChange={(e) => setContactForm((f) => ({ ...f, telefono: e.target.value }))} />
          <TextField size="small" label="Observaciones" fullWidth value={contactForm.observaciones} onChange={(e) => setContactForm((f) => ({ ...f, observaciones: e.target.value }))} />

          {/* Botón agregar/guardar */}
          {editMode ? (
            contactForm.id ? (
              <Tooltip title="Guardar cambios">
                <span>
                  <IconButton
                    color={isDark ? "inherit" : "primary"}
                    onClick={() => {
                      const body = limpiarPayload(contactForm);
                      delete body.id;
                      if (!contactForm.nombre?.trim()) {
                        enqueueSnackbar("El contacto requiere Nombre", { variant: "warning" });
                        return;
                      }
                      actualizarContactoMut.mutate({ clienteId: id, contactoId: contactForm.id, body });
                    }}
                    disabled={actualizarContactoMut.isLoading}
                    sx={{ alignSelf: "center" }}
                  >
                    <SaveIcon />
                  </IconButton>
                </span>
              </Tooltip>
            ) : (
              <Tooltip title="Agregar contacto">
                <span>
                  <IconButton
                    color={isDark ? "inherit" : "primary"}
                    onClick={() => {
                      if (!contactForm.nombre?.trim()) {
                        enqueueSnackbar("El contacto requiere Nombre", { variant: "warning" });
                        return;
                      }
                      const body = limpiarPayload(contactForm);
                      crearContactoMut.mutate({ clienteId: id, body });
                    }}
                    disabled={crearContactoMut.isLoading}
                    sx={{ alignSelf: "center" }}
                  >
                    <AddIcon />
                  </IconButton>
                </span>
              </Tooltip>
            )
          ) : (
            <>
              {editingIndex >= 0 ? (
                <Tooltip title="Guardar contacto">
                  <IconButton color={isDark ? "inherit" : "primary"} onClick={addOrUpdateLocalContacto} sx={{ alignSelf: "center" }}>
                    <SaveIcon />
                  </IconButton>
                </Tooltip>
              ) : (
                <Tooltip title="Agregar contacto">
                  <IconButton color={isDark ? "inherit" : "primary"} onClick={addOrUpdateLocalContacto} sx={{ alignSelf: "center" }}>
                    <AddIcon />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Row>

        {/* Tabla de contactos */}
        <Box sx={{ overflowX: "auto", borderRadius: 2, border: (t) => `1px solid ${t.palette.divider}` }}>
          <Table size="small" sx={{ "& td, & th": (t) => ({ borderBottom: `1px solid ${t.palette.divider}` }) }}>
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Rol</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Teléfono</TableCell>
                <TableCell>Observaciones</TableCell>
                <TableCell align="right" sx={{ width: 120 }}>Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(editMode ? (cli?.contactos ?? []) : localContactos).map((c, idx) => (
                <TableRow key={c.id ?? idx} hover>
                  <TableCell>{c.nombre}</TableCell>
                  <TableCell>{c.rol || "-"}</TableCell>
                  <TableCell>{c.email || "-"}</TableCell>
                  <TableCell>{c.telefono || "-"}</TableCell>
                  <TableCell>{c.observaciones || "-"}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setContactForm({
                            id: editMode ? c.id : null,
                            nombre: c.nombre || "",
                            rol: c.rol || "",
                            email: c.email || "",
                            telefono: c.telefono || "",
                            observaciones: c.observaciones || "",
                          });
                          setEditingIndex(editMode ? -1 : idx);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Eliminar">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          if (editMode) {
                            eliminarContactoMut.mutate({ clienteId: id, contactoId: c.id });
                          } else {
                            deleteLocal(idx);
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}

              {/* Mensaje vacío */}
              {((editMode ? (cli?.contactos ?? []) : localContactos).length === 0) && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Box sx={{ py: 3, textAlign: "center", opacity: 0.8 }}>
                      <Typography variant="body2">No hay contactos cargados.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>

        {/* Botones */}
        <Box sx={{ mt: 3, display: "flex", gap: 1, justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <UploadAdjuntoButton 
              clienteId={watchClienteId ? Number(watchClienteId) : (editMode && id ? Number(id) : undefined)}
              disabled={!editMode || !id} // Solo en edición, cuando ya tiene ID
            />
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" onClick={goBack} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" variant="contained" disabled={isSubmitting || tpLoading || (editMode && cliLoading)}>
              {isSubmitting ? "Guardando..." : editMode ? "Guardar cambios" : "Crear cliente"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
