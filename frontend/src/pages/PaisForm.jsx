// src/pages/PaisForm.jsx
import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Paper, TextField, Button, Typography, CircularProgress } from "@mui/material";
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

export default function PaisForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const esEdicion = !!id;
  const qc = useQueryClient();
  
  const categoriaId = searchParams.get('categoriaId') || 'VIRTUAL_PAIS';

  const [formData, setFormData] = useState({
    nombre: "",
    codigoIso: "",
  });

  // Cargar país si es edición
  const { data: paisData, isLoading } = useQuery({
    queryKey: ["pais", id],
    queryFn: () => api.get(`/paises/${id}`).then((r) => r.data),
    enabled: esEdicion,
  });

  // Cargar datos cuando lleguen del servidor
  useEffect(() => {
    if (paisData && esEdicion) {
      setFormData({
        nombre: paisData.nombre || "",
        codigoIso: paisData.codigoIso || "",
      });
    }
  }, [paisData, esEdicion]);

  const saveMut = useMutation({
    mutationFn: (data) => {
      if (esEdicion) {
        return api.put(`/paises/${id}`, data).then((r) => r.data);
      }
      return api.post("/paises", data).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["parametros"] });
      enqueueSnackbar(
        `País ${esEdicion ? "actualizado" : "creado"} correctamente`,
        { variant: "success" }
      );
      navigate(`/configuracion?categoriaId=${categoriaId}`);
    },
    onError: (err) => {
      const msg = err?.response?.data?.publicMessage || "Error al guardar país";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.nombre) {
      enqueueSnackbar("El nombre es requerido", { variant: "warning" });
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
          {esEdicion ? "Editar país" : "Nuevo país"}
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
            name="codigoIso"
            label="Código ISO"
            value={formData.codigoIso}
            onChange={(e) => {
              setFormData((prev) => ({ ...prev, codigoIso: e.target.value.toUpperCase() }));
            }}
            helperText="Ejemplo: AR, US, BR"
          />
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

