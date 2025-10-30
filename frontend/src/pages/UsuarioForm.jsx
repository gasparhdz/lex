// src/pages/UsuarioForm.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Paper, Box, TextField, Button, Typography, Stack, FormControlLabel,
  Switch, Checkbox, FormControl, FormLabel, FormGroup, CircularProgress, MenuItem
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import { fetchUsuario, crearUsuario, actualizarUsuario, fetchRoles } from "../api/usuarios";

// Helper para filas con CSS Grid (igual que ClienteForm)
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

// TextField compacto (estable, fuera del componente)
const TF = (props) => <TextField fullWidth size="small" {...props} />;

export default function UsuarioForm() {
  const nav = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const { id } = useParams();
  const esEdicion = !!id;

  // Volver exactamente a donde estaba la lista
  const backTo = location.state?.from ?? { pathname: "/usuarios" };
  const goBack = () => nav(backTo, { replace: true });

  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    email: "",
    password: "",
    telefono: "",
    activo: true,
    mustChangePass: false,
    roles: [],
  });

  // Cargar roles
  const { data: roles = [] } = useQuery({
    queryKey: ["roles"],
    queryFn: fetchRoles,
  });

  // Cargar usuario si es edición
  const { data: usuarioData, isLoading: loadingUsuario } = useQuery({
    queryKey: ["usuario", id],
    queryFn: () => fetchUsuario(id),
    enabled: esEdicion,
  });

  // Cargar datos cuando lleguen del servidor
  useEffect(() => {
    if (usuarioData && esEdicion) {
      console.log("Usuario cargado:", usuarioData);
      setFormData({
        nombre: usuarioData.nombre || "",
        apellido: usuarioData.apellido || "",
        dni: usuarioData.dni || "",
        email: usuarioData.email || "",
        password: "",
        telefono: usuarioData.telefono || "",
        activo: usuarioData.activo ?? true,
        mustChangePass: usuarioData.mustChangePass ?? false,
        roles: usuarioData.roles?.map(ur => ur.rol.id) || [],
      });
    }
  }, [usuarioData, esEdicion]);

  const saveMut = useMutation({
    mutationFn: (data) => esEdicion ? actualizarUsuario(id, data) : crearUsuario(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["usuarios"] });
      enqueueSnackbar(`Usuario ${esEdicion ? 'actualizado' : 'creado'} correctamente`, { variant: "success" });
      nav(backTo, { replace: true });
    },
    onError: (err) => {
      const data = err?.response?.data;
      let msg = data?.publicMessage || "Error al guardar usuario";
      
      // Si hay detalles de validación, agregar los primeros errores
      if (data?.details?.fieldErrors) {
        const fieldErrors = Object.values(data.details.fieldErrors).flat();
        if (fieldErrors.length > 0) {
          msg += `: ${fieldErrors[0]}`;
        }
      }
      
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleToggleRol = (rolId) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(rolId)
        ? prev.roles.filter(id => id !== rolId)
        : [...prev.roles, rolId],
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (esEdicion && !payload.password) {
      delete payload.password; // No enviar password vacío en edición
    }
    saveMut.mutate(payload);
  };

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
          {esEdicion ? "Editar usuario" : "Nuevo usuario"}
        </Typography>
        {loadingUsuario && <CircularProgress size={18} />}
      </Box>

      <Box component="form" noValidate onSubmit={handleSubmit}>
        {/* Fila 1: Nombre y Apellido */}
        <Row cols="2fr 2fr 1fr">
          <TF
            name="nombre"
            label="Nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
          />
          <TF
            name="apellido"
            label="Apellido"
            value={formData.apellido}
            onChange={handleChange}
            required
          />
          <TF
            name="dni"
            label="DNI"
            value={formData.dni}
            onChange={handleChange}
          />
          
        </Row>

        {/* Fila 3: Password */}
        <Row cols="2fr 2fr 1fr">
          <TF
            name="email"
            label="Email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <TF
            name="password"
            label="Contraseña"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required={!esEdicion}
            helperText={esEdicion ? "Dejar vacío para mantener la actual" : "Mínimo 8 caracteres con mayúscula, minúscula, número y carácter especial"}
          />
          <TF
            name="telefono"
            label="Teléfono"
            value={formData.telefono}
            onChange={handleChange}
          />
        </Row>
        {/* Fila 5: Switches */}
        <Row cols="1fr 1fr">
          <FormControlLabel
            control={
              <Switch
                checked={formData.activo}
                onChange={(e) => setFormData(prev => ({ ...prev, activo: e.target.checked }))}
              />
            }
            label="Usuario Activo"
          />
          <FormControlLabel
            control={
              <Switch
                checked={formData.mustChangePass}
                onChange={(e) => setFormData(prev => ({ ...prev, mustChangePass: e.target.checked }))}
              />
            }
            label="Debe cambiar contraseña"
          />
        </Row>

        {/* Fila 6: Roles */}
        <Row cols="1fr">
          <FormControl component="fieldset">
            <FormLabel component="legend">Roles</FormLabel>
            <FormGroup>
              {roles.map((rol) => (
                <FormControlLabel
                  key={rol.id}
                  control={
                    <Checkbox
                      checked={formData.roles.includes(rol.id)}
                      onChange={() => handleToggleRol(rol.id)}
                    />
                  }
                  label={rol.nombre}
                />
              ))}
            </FormGroup>
          </FormControl>
        </Row>

        {/* Botones */}
        <Box sx={{ mt: 3, display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button variant="outlined" onClick={goBack} disabled={saveMut.isPending}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={saveMut.isPending || loadingUsuario}>
            {saveMut.isPending ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear usuario"}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}