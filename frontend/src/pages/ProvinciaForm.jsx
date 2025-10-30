// src/pages/ProvinciaForm.jsx
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

export default function ProvinciaForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const esEdicion = !!id;
  const qc = useQueryClient();
  
  const categoriaId = searchParams.get('categoriaId') || 'VIRTUAL_PROVINCIA';

  const [formData, setFormData] = useState({
    nombre: "",
    paisId: "",
  });

  // Cargar países
  const { data: paises = [] } = useQuery({
    queryKey: ["paises"],
    queryFn: () => api.get("/paises").then((r) => r.data),
  });

  // Cargar provincia si es edición
  const { data: provinciaData, isLoading } = useQuery({
    queryKey: ["provincia", id],
    queryFn: () => api.get(`/provincias/${id}`).then((r) => r.data),
    enabled: esEdicion,
  });

  // Cargar datos cuando lleguen del servidor
  useEffect(() => {
    if (provinciaData && esEdicion) {
      setFormData({
        nombre: provinciaData.nombre || "",
        paisId: provinciaData.paisId || "",
      });
    }
  }, [provinciaData, esEdicion]);

  const saveMut = useMutation({
    mutationFn: (data) => {
      if (esEdicion) {
        return api.put(`/provincias/${id}`, data).then((r) => r.data);
      }
      return api.post("/provincias", data).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parametros"] });
      enqueueSnackbar(
        `Provincia ${esEdicion ? "actualizada" : "creada"} correctamente`,
        { variant: "success" }
      );
      navigate(`/configuracion?categoriaId=${categoriaId}`);
    },
    onError: (err) => {
      const msg = err?.response?.data?.publicMessage || "Error al guardar provincia";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nombre || !formData.paisId) {
      enqueueSnackbar("El nombre y país son requeridos", { variant: "warning" });
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
          {esEdicion ? "Editar provincia" : "Nueva provincia"}
        </Typography>
      </Box>

      <Box component="form" noValidate onSubmit={handleSubmit}>
        <Row cols="1fr 1fr">
          <TF
            name="nombre"
            label="Nombre"
            value={formData.nombre}
            onChange={handleChange}
            required
          />
          <TF
            name="paisId"
            label="País"
            value={formData.paisId}
            onChange={handleChange}
            select
            required
          >
            <MenuItem value="">
              <em>Seleccione un país</em>
            </MenuItem>
            {paises.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.nombre}
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

