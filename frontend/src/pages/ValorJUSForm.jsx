// src/pages/ValorJUSForm.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermiso } from "../auth/usePermissions";
import { Box, Paper, TextField, Button, Typography, Stack, CircularProgress, Chip } from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { esES } from "@mui/x-date-pickers/locales";
import { enqueueSnackbar } from "notistack";
import api from "../api/axios";
import { formatCurrency } from "../utils/format";
import dayjs from "dayjs";

// Helper para filas con CSS Grid (igual que otros forms)
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

// TextField compacto
const TF = (props) => <TextField fullWidth size="small" {...props} />;

export default function ValorJUSForm() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  
  const categoriaId = searchParams.get("categoriaId") || "VIRTUAL_VALOR_JUS";
  const { id } = useParams();
  const esEdicion = !!id;

  // Verificaciones de permisos
  const canCrear = usePermiso('CONFIGURACION', 'crear');
  const canEditar = usePermiso('CONFIGURACION', 'editar');

  // Redirigir si no tiene permisos
  useEffect(() => {
    if (esEdicion && !canEditar) {
      enqueueSnackbar('No tiene permisos para editar valores JUS', { variant: 'error' });
      nav(-1);
    } else if (!esEdicion && !canCrear) {
      enqueueSnackbar('No tiene permisos para crear valores JUS', { variant: 'error' });
      nav(-1);
    }
  }, [esEdicion, canCrear, canEditar, nav]);

  const [formData, setFormData] = useState({
    fecha: null,
    valor: "",
  });

  // Cargar valor JUS si es edición
  const { data: valorJUSData, isLoading } = useQuery({
    queryKey: ["valorjus", id],
    queryFn: () => api.get(`/valorjus/${id}`).then((r) => r.data),
    enabled: esEdicion,
  });

  // Verificar si ya existe un valor JUS para la fecha seleccionada (solo en modo creación)
  const fechaISO = formData.fecha && dayjs.isDayjs(formData.fecha) && formData.fecha.isValid()
    ? formData.fecha.format('YYYY-MM-DD')
    : null;

  const { data: valorExistente } = useQuery({
    queryKey: ["valorjus-existe", fechaISO],
    queryFn: async () => {
      if (!fechaISO) return null;
      // Buscar valores JUS para esa fecha exacta
      const { data } = await api.get("/valorjus", {
        params: {
          from: fechaISO,
          to: fechaISO,
          page: 1,
          pageSize: 1,
        },
      });
      const rows = data?.data || [];
      return rows.find((v) => v.fecha === fechaISO) || null;
    },
    enabled: !esEdicion && !!fechaISO,
    staleTime: 10_000,
  });

  // Cargar datos cuando lleguen del servidor
  useEffect(() => {
    if (valorJUSData && esEdicion) {
      setFormData({
        fecha: valorJUSData.fecha ? dayjs(valorJUSData.fecha) : null,
        valor: String(valorJUSData.valor || ""),
      });
    }
  }, [valorJUSData, esEdicion]);

  const saveMut = useMutation({
    mutationFn: (data) => {
      // Validar valor: debe ser un número válido y > 0
      const valorStr = String(data.valor || "").trim();
      if (!valorStr) {
        throw new Error("El campo 'valor' es requerido");
      }
      const valorNum = Number(valorStr);
      if (!Number.isFinite(valorNum) || valorNum <= 0) {
        throw new Error("El campo 'valor' debe ser un número mayor a 0");
      }

      // Validar fecha: debe ser un objeto dayjs válido
      if (!data.fecha || !dayjs.isDayjs(data.fecha) || !data.fecha.isValid()) {
        throw new Error("El campo 'fecha' es requerido y debe ser válido");
      }
      const fechaISO = data.fecha.format('YYYY-MM-DD');
      if (!fechaISO || fechaISO === 'Invalid Date') {
        throw new Error("La fecha no es válida");
      }

      const payload = {
        valor: valorNum,
        fecha: fechaISO,
      };
      
      // Debug: ver qué se está enviando
      console.log("Payload enviado:", payload);
      
      if (esEdicion) {
        return api.put(`/valorjus/${id}`, payload).then((r) => r.data);
      }
      return api.post("/valorjus", payload).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parametros"] });
      qc.invalidateQueries({ queryKey: ["valor-jus-actual"] });
      enqueueSnackbar(
        `Valor JUS ${esEdicion ? "actualizado" : "creado"} correctamente`,
        { variant: "success" }
      );
      nav(`/configuracion?tab=0&categoriaId=${categoriaId}`);
    },
    onError: (err) => {
      // Si es un error de validación del frontend (throw new Error), usar el mensaje directo
      if (err?.message && !err?.response) {
        enqueueSnackbar(err.message, { variant: "error" });
        return;
      }
      // Si es un error del backend, usar publicMessage
      const msg = err?.response?.data?.publicMessage || err?.message || "Error al guardar";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validar que el valor no esté vacío
    const valorStr = String(formData.valor || "").trim();
    if (!valorStr) {
      enqueueSnackbar("Completá el campo Valor JUS", { variant: "warning" });
      return;
    }
    
    // Validar que el valor sea un número válido y > 0
    const valorNum = Number(valorStr);
    if (!Number.isFinite(valorNum) || valorNum <= 0) {
      enqueueSnackbar("El valor debe ser un número mayor a 0", { variant: "warning" });
      return;
    }
    
    // Validar que la fecha esté presente y sea válida
    if (!formData.fecha) {
      enqueueSnackbar("Completá el campo Fecha", { variant: "warning" });
      return;
    }
    
    if (!dayjs.isDayjs(formData.fecha) || !formData.fecha.isValid()) {
      enqueueSnackbar("La fecha no es válida", { variant: "warning" });
      return;
    }
    
    // En modo creación: verificar si ya existe un valor JUS para esa fecha
    if (!esEdicion && valorExistente) {
      enqueueSnackbar(
        `Ya existe un Valor JUS para la fecha ${fechaISO}. Por favor, editá el valor existente (ID: ${valorExistente.id}) o elegí otra fecha.`,
        { variant: "error", autoHideDuration: 8000 }
      );
      return;
    }
    
    saveMut.mutate(formData);
  };

  // Validar valor
  const valorNum = Number(formData.valor);
  const isValidValor = !isNaN(valorNum) && valorNum > 0;
  const valorFormateado = isValidValor ? formatCurrency(valorNum, 'ARS') : '';

  if (isLoading && esEdicion) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        mt: 2,
        p: { xs: 2, md: 3 },
        borderRadius: 3,
        border: (t) => `1px solid ${t.palette.divider}`,
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>
        {esEdicion ? "Editar" : "Nuevo"} Valor JUS
      </Typography>

      <Box component="form" onSubmit={handleSubmit}>
        <LocalizationProvider
          dateAdapter={AdapterDayjs}
          adapterLocale="es"
          localeText={esES.components.MuiLocalizationProvider.defaultProps.localeText}
        >
          <Row cols="1fr 1fr">
            <Box>
              <DatePicker
                label="Vigente Desde"
                value={formData.fecha}
                onChange={(newValue) => handleChange("fecha", newValue)}
                slotProps={{
                  textField: {
                    size: 'small',
                    fullWidth: true,
                    required: true,
                    error: !esEdicion && !!valorExistente,
                    helperText: !esEdicion && valorExistente
                      ? `Ya existe un Valor JUS para esta fecha (ID: ${valorExistente.id}, Valor: ${formatCurrency(valorExistente.valor, "ARS")})`
                      : "",
                  },
                }}
              />
              {!esEdicion && valorExistente && (
                <Chip
                  label={`Valor existente: ${formatCurrency(valorExistente.valor, "ARS")} - Editar ID: ${valorExistente.id}`}
                  size="small"
                  color="warning"
                  sx={{ mt: 1 }}
                  onClick={() => nav(`/configuracion/valorjus/editar/${valorExistente.id}?categoriaId=${categoriaId}`)}
                  style={{ cursor: 'pointer' }}
                />
              )}
            </Box>

            <Box>
              <TF
                label="Valor JUS"
                type="number"
                value={formData.valor}
                onChange={(e) => handleChange("valor", e.target.value)}
                required
                error={formData.valor && !isValidValor}
                helperText={formData.valor && !isValidValor ? "El valor debe ser mayor a 0" : ""}
              />
              {isValidValor && (
                <Chip
                  label={`Valor: ${valorFormateado}`}
                  size="small"
                  color="success"
                  sx={{ mt: 1 }}
                />
              )}
            </Box>
          </Row>
        </LocalizationProvider>

        <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ mt: 3 }}>
          <Button
            type="button"
            variant="outlined"
            onClick={() => nav(`/configuracion?tab=0&categoriaId=${categoriaId}`)}
            disabled={saveMut.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saveMut.isPending || !isValidValor || !formData.fecha || (!esEdicion && !!valorExistente)}
          >
            {saveMut.isPending ? "Guardando..." : esEdicion ? "Actualizar" : "Crear"}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}

