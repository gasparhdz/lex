// src/pages/CodigoPostalForm.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Paper, TextField, Button, Typography, MenuItem, CircularProgress } from "@mui/material";
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

export default function CodigoPostalForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const esEdicion = !!id;
  const qc = useQueryClient();
  
  const categoriaId = searchParams.get('categoriaId') || 'VIRTUAL_CODIGO_POSTAL';

  const [formData, setFormData] = useState({
    codigo: "",
    localidadId: "",
  });

  // Cargar localidades
  const { data: localidades = [] } = useQuery({
    queryKey: ["localidades"],
    queryFn: () => api.get("/localidades").then((r) => r.data),
  });

  // Cargar código postal si es edición
  const { data: cpData, isLoading } = useQuery({
    queryKey: ["codigopostal", id],
    queryFn: () => api.get(`/codigospostales/${id}`).then((r) => r.data),
    enabled: esEdicion,
  });

  // Cargar datos cuando lleguen del servidor
  useEffect(() => {
    if (cpData && esEdicion) {
      setFormData({
        codigo: cpData.codigo || "",
        localidadId: cpData.localidadId || "",
      });
    }
  }, [cpData, esEdicion]);

  const saveMut = useMutation({
    mutationFn: (data) => {
      if (esEdicion) {
        return api.put(`/codigospostales/${id}`, data).then((r) => r.data);
      }
      return api.post("/codigospostales", data).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parametros"] });
      enqueueSnackbar(
        `Código postal ${esEdicion ? "actualizado" : "creado"} correctamente`,
        { variant: "success" }
      );
      navigate(`/configuracion?categoriaId=${categoriaId}`);
    },
    onError: (err) => {
      const msg = err?.response?.data?.publicMessage || "Error al guardar código postal";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.codigo || !formData.localidadId) {
      enqueueSnackbar("El código y localidad son requeridos", { variant: "warning" });
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
          {esEdicion ? "Editar código postal" : "Nuevo código postal"}
        </Typography>
      </Box>

      <Box component="form" noValidate onSubmit={handleSubmit}>
        <Row cols="1fr 1fr">
          <TF
            name="codigo"
            label="Código"
            value={formData.codigo}
            onChange={handleChange}
            required
          />
          <TF
            name="localidadId"
            label="Localidad"
            value={formData.localidadId}
            onChange={handleChange}
            select
            required
          >
            <MenuItem value="">
              <em>Seleccione una localidad</em>
            </MenuItem>
            {localidades.map((l) => (
              <MenuItem key={l.id} value={l.id}>
                {l.nombre} - {l.provincia?.nombre}
              </MenuItem>
            ))}
          </TF>
        </Row>

        <Box sx={{ mt: 3, display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button variant="outlined" onClick={() => navigate(`/configuracion?categoriaId=${categoriaId}`)} disabled={saveMut.isPending}>
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

