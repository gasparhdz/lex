// src/pages/RolForm.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Paper, TextField, Button, Typography, Switch, FormControlLabel, Checkbox, FormGroup, Chip, CircularProgress } from "@mui/material";
import { enqueueSnackbar } from "notistack";
import api from "../api/axios";

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

const TF = (props) => <TextField fullWidth size="small" {...props} />;

const MODULOS = [
  'DASHBOARD',
  'CLIENTES',
  'CASOS',
  'AGENDA',
  'TAREAS',
  'EVENTOS',
  'FINANZAS',
  'ADJUNTOS',
  'USUARIOS',
  'CONFIGURACION',
];

export default function RolForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const esEdicion = !!id;
  const qc = useQueryClient();

  const [formData, setFormData] = useState({
    codigo: "",
    nombre: "",
    activo: true,
  });

  const [permisos, setPermisos] = useState({});

  // Inicializar permisos
  useEffect(() => {
    const initialPermisos = {};
    MODULOS.forEach(modulo => {
      initialPermisos[modulo] = { ver: false, crear: false, editar: false, eliminar: false };
    });
    setPermisos(initialPermisos);
  }, []);

  // Cargar rol si es edición
  const { data: rolData, isLoading } = useQuery({
    queryKey: ["rol", id],
    queryFn: () => api.get(`/usuarios/roles/${id}`).then((r) => r.data),
    enabled: esEdicion,
  });

  // Cargar datos cuando lleguen del servidor
  useEffect(() => {
    if (rolData && esEdicion) {
      setFormData({
        codigo: rolData.codigo || "",
        nombre: rolData.nombre || "",
        activo: rolData.activo ?? true,
      });

      // Cargar permisos existentes
      const permisosData = {};
      MODULOS.forEach(modulo => {
        permisosData[modulo] = { ver: false, crear: false, editar: false, eliminar: false };
      });

      if (rolData.permisos && Array.isArray(rolData.permisos)) {
        rolData.permisos.forEach(permiso => {
          if (permisosData[permiso.modulo]) {
            permisosData[permiso.modulo] = {
              ver: permiso.ver || false,
              crear: permiso.crear || false,
              editar: permiso.editar || false,
              eliminar: permiso.eliminar || false,
            };
          }
        });
      }

      setPermisos(permisosData);
    }
  }, [rolData, esEdicion]);

  const saveMut = useMutation({
    mutationFn: (data) => {
      const permisosArray = Object.entries(permisos)
        .map(([modulo, acc] = entry) => ({
          modulo,
          ver: acc.ver,
          crear: acc.crear,
          editar: acc.editar,
          eliminar: acc.eliminar,
        }))
        .filter(p => p.ver || p.crear || p.editar || p.eliminar); // Solo incluir si tiene algún permiso

      const payload = { ...data, permisos: permisosArray };

      if (esEdicion) {
        return api.put(`/usuarios/roles/${id}`, payload).then((r) => r.data);
      }
      return api.post("/usuarios/roles", payload).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      enqueueSnackbar(
        `Rol ${esEdicion ? "actualizado" : "creado"} correctamente`,
        { variant: "success" }
      );
      navigate("/configuracion?tab=1");
    },
    onError: (err) => {
      const msg = err?.response?.data?.publicMessage || "Error al guardar rol";
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

  const handlePermisoChange = (modulo, accion) => {
    setPermisos(prev => ({
      ...prev,
      [modulo]: {
        ...prev[modulo],
        [accion]: !prev[modulo][accion],
      },
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.codigo || !formData.nombre) {
      enqueueSnackbar("Código y nombre son requeridos", { variant: "warning" });
      return;
    }
    saveMut.mutate(formData);
  };

  if (isLoading) {
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
      }}
    >
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {esEdicion ? "Editar rol" : "Nuevo rol"}
        </Typography>
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
            disabled={esEdicion}
            helperText={esEdicion ? "No se puede modificar" : "Solo letras y números"}
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

        {/* Fila 2: Activo */}
        <Box sx={{ mb: 2.5 }}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.activo}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, activo: e.target.checked }))
                }
              />
            }
            label="Rol Activo"
          />
        </Box>

        {/* Permisos */}
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Permisos por Módulo
        </Typography>

        <Box sx={{ mb: 3 }}>
          {MODULOS.map(modulo => (
            <Box key={modulo} sx={{ mb: 2, p: 2, border: (t) => `1px solid ${t.palette.divider}`, borderRadius: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                {modulo}
              </Typography>
              <FormGroup row>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={permisos[modulo]?.ver || false}
                      onChange={() => handlePermisoChange(modulo, 'ver')}
                      size="small"
                    />
                  }
                  label="Ver"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={permisos[modulo]?.crear || false}
                      onChange={() => handlePermisoChange(modulo, 'crear')}
                      size="small"
                    />
                  }
                  label="Crear"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={permisos[modulo]?.editar || false}
                      onChange={() => handlePermisoChange(modulo, 'editar')}
                      size="small"
                    />
                  }
                  label="Editar"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={permisos[modulo]?.eliminar || false}
                      onChange={() => handlePermisoChange(modulo, 'eliminar')}
                      size="small"
                    />
                  }
                  label="Eliminar"
                />
              </FormGroup>
            </Box>
          ))}
        </Box>

        {/* Botones */}
        <Box sx={{ mt: 3, display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button variant="outlined" onClick={() => navigate("/configuracion?tab=1")} disabled={saveMut.isPending}>
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

