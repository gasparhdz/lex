// src/pages/ParametroForm.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePermiso } from "../auth/usePermissions";
import {
  Box, Paper, TextField, Button, Typography, Stack, FormControlLabel,
  Switch, MenuItem, CircularProgress, Alert, Chip
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import api from "../api/axios";

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

export default function ParametroForm() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  
  const categoriaId = searchParams.get("categoriaId");
  const { id } = useParams();
  const esEdicion = !!id;

  // Verificaciones de permisos
  const canCrear = usePermiso('CONFIGURACION', 'crear');
  const canEditar = usePermiso('CONFIGURACION', 'editar');

  // Redirigir si no tiene permisos
  useEffect(() => {
    if (esEdicion && !canEditar) {
      enqueueSnackbar('No tiene permisos para editar parámetros', { variant: 'error' });
      nav(-1);
    } else if (!esEdicion && !canCrear) {
      enqueueSnackbar('No tiene permisos para crear parámetros', { variant: 'error' });
      nav(-1);
    }
  }, [esEdicion, canCrear, canEditar, nav]);

  const [formData, setFormData] = useState({
    codigo: "",
    nombre: "",
    orden: 0,
    activo: true,
  });

  // Cargar categorías
  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: () => api.get("/parametros/categorias").then((r) => r.data),
  });

  // Cargar parámetro si es edición
  const { data: parametroData, isLoading: loadingParametro } = useQuery({
    queryKey: ["parametro", id],
    queryFn: () => api.get(`/parametros/${id}`).then((r) => r.data),
    enabled: esEdicion,
  });

  // Cargar datos cuando lleguen del servidor
  useEffect(() => {
    if (parametroData && esEdicion) {
      setFormData({
        codigo: parametroData.codigo || "",
        nombre: parametroData.nombre || "",
        orden: parametroData.orden || 0,
        activo: parametroData.activo ?? true,
      });
    }
  }, [parametroData, esEdicion]);

  const saveMut = useMutation({
    mutationFn: (data) => {
      const payload = { ...data, categoriaId: categoriaId || data.categoriaId };
      if (esEdicion) {
        return api.put(`/parametros/${id}`, payload).then((r) => r.data);
      }
      return api.post("/parametros", payload).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parametros"] });
      enqueueSnackbar(
        `Parámetro ${esEdicion ? "actualizado" : "creado"} correctamente`,
        { variant: "success" }
      );
      nav(`/configuracion?categoriaId=${categoriaId}`);
    },
    onError: (err) => {
      const msg = err?.response?.data?.publicMessage || "Error al guardar parámetro";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.codigo || !formData.nombre) {
      enqueueSnackbar("Código y nombre son requeridos", { variant: "warning" });
      return;
    }
    if (!categoriaId && !esEdicion) {
      enqueueSnackbar("Debe seleccionar una categoría", { variant: "warning" });
      return;
    }
    saveMut.mutate(formData);
  };

  const categoriaSeleccionada = categorias.find((c) => String(c.id) === String(categoriaId));

  if (loadingParametro) {
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
        p: { xs: 1.5, md: 2 },
        borderRadius: 3,
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: (t) => (t.palette.mode === "dark" ? "background.paper" : "#fff"),
      }}
    >
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, flexGrow: 1 }}>
          {esEdicion ? "Editar parámetro" : "Nuevo parámetro"}
        </Typography>
        {categoriaSeleccionada && (
          <Chip label={categoriaSeleccionada.nombre} color="primary" size="small" />
        )}
      </Box>

      <Box component="form" noValidate onSubmit={handleSubmit}>
        {/* Fila 1: Código y Nombre */}
        <Row cols="1fr 2fr">
          <TF
            name="codigo"
            label="Código"
            value={formData.codigo}
            onChange={handleChange}
            required
            onBlur={(e) => {
              setFormData((prev) => ({ ...prev, codigo: prev.codigo.toUpperCase() }));
            }}
          />
          <TF
            name="nombre"
            label="Nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
          />
        </Row>

        {/* Fila 2: Orden y Activo */}
        <Row cols="1fr 1fr">
          <TF
            name="orden"
            label="Orden"
            type="number"
            value={formData.orden}
            onChange={handleChange}
            helperText="Posición en la lista (menor = primero)"
          />
          <Box sx={{ display: "flex", alignItems: "center", pt: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.activo}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, activo: e.target.checked }))
                  }
                />
              }
              label="Parámetro Activo"
            />
          </Box>
        </Row>

        {/* Botones */}
        <Box sx={{ mt: 3, display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button
            variant="outlined"
            onClick={() => nav(`/configuracion?categoriaId=${categoriaId}`)}
            disabled={saveMut.isPending}
          >
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={saveMut.isPending}>
            {saveMut.isPending ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear"}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}

