// src/components/detalle-cliente/ClienteNotas.jsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Chip,
  Card,
  CardContent,
  Stack,
  Divider,
  Alert,
  CircularProgress,
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CloseIcon from "@mui/icons-material/Close";
import NotesIcon from "@mui/icons-material/Notes";
import api from "../../api/axios";
import ConfirmDialog from "../ConfirmDialog";
import dayjs from "dayjs";

export default function ClienteNotas({ clienteId }) {
  const qc = useQueryClient();
  const [nuevaNota, setNuevaNota] = useState("");
  const [editandoId, setEditandoId] = useState(null);
  const [editandoContenido, setEditandoContenido] = useState("");
  const [confirm, setConfirm] = useState({ open: false, id: null, contenido: "" });

  // Queries
  const { data: notas = [], isLoading, refetch } = useQuery({
    queryKey: ["cliente-notas", clienteId],
    queryFn: () => api.get(`/clientes/${clienteId}/notas`).then((r) => r.data),
    enabled: !!clienteId,
  });

  // Mutations
  const crearMut = useMutation({
    mutationFn: (contenido) =>
      api.post(`/clientes/${clienteId}/notas`, { contenido }).then((r) => r.data),
    onSuccess: () => {
      enqueueSnackbar("Nota agregada", { variant: "success" });
      setNuevaNota("");
      qc.invalidateQueries({ queryKey: ["cliente-notas", clienteId] });
      refetch();
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || "Error al agregar nota";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const actualizarMut = useMutation({
    mutationFn: ({ notaId, contenido }) =>
      api.put(`/clientes/${clienteId}/notas/${notaId}`, { contenido }).then((r) => r.data),
    onSuccess: () => {
      enqueueSnackbar("Nota actualizada", { variant: "success" });
      setEditandoId(null);
      setEditandoContenido("");
      qc.invalidateQueries({ queryKey: ["cliente-notas", clienteId] });
      refetch();
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || "Error al actualizar nota";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const eliminarMut = useMutation({
    mutationFn: (notaId) => api.delete(`/clientes/${clienteId}/notas/${notaId}`),
    onSuccess: () => {
      enqueueSnackbar("Nota eliminada", { variant: "success" });
      setConfirm({ open: false, id: null, contenido: "" });
      qc.invalidateQueries({ queryKey: ["cliente-notas", clienteId] });
      refetch();
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || "Error al eliminar nota";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const handleAgregar = () => {
    if (!nuevaNota.trim()) {
      enqueueSnackbar("La nota no puede estar vacía", { variant: "warning" });
      return;
    }
    crearMut.mutate(nuevaNota.trim());
  };

  const handleEditar = (nota) => {
    setEditandoId(nota.id);
    setEditandoContenido(nota.contenido);
  };

  const handleGuardarEdicion = () => {
    if (!editandoContenido.trim()) {
      enqueueSnackbar("La nota no puede estar vacía", { variant: "warning" });
      return;
    }
    actualizarMut.mutate({ notaId: editandoId, contenido: editandoContenido.trim() });
  };

  const handleCancelarEdicion = () => {
    setEditandoId(null);
    setEditandoContenido("");
  };

  const handleConfirmEliminar = () => {
    eliminarMut.mutate(confirm.id);
  };

  const formatearFecha = (fecha) => {
    return dayjs(fecha).format("DD/MM/YYYY HH:mm");
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Agregar nueva nota */}
      <Card variant="outlined" sx={{ mb: 3, bgcolor: "action.hover" }}>
        <CardContent>
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
            <NotesIcon sx={{ mt: 1, color: "primary.main" }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Nueva nota
              </Typography>
              <TextField
                multiline
                minRows={2}
                fullWidth
                size="small"
                placeholder="Escribe una nota sobre este cliente..."
                value={nuevaNota}
                onChange={(e) => setNuevaNota(e.target.value)}
              />
              <Box sx={{ mt: 2, display: "flex", gap: 1, justifyContent: "flex-end" }}>
                <Button variant="outlined" size="small" onClick={() => setNuevaNota("")} disabled={crearMut.isLoading}>
                  Cancelar
                </Button>
                <Button variant="contained" size="small" onClick={handleAgregar} disabled={crearMut.isLoading}>
                  {crearMut.isLoading ? "Guardando..." : "Agregar"}
                </Button>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Lista de notas */}
      {notas.length === 0 ? (
        <Alert severity="info">
          Aún no hay notas registradas para este cliente. Agrega una usando el formulario de arriba.
        </Alert>
      ) : (
        <Stack spacing={2}>
          {notas.map((nota) => (
            <Card key={nota.id} variant="outlined">
              <CardContent>
                {editandoId === nota.id ? (
                  <>
                    <TextField
                      multiline
                      minRows={2}
                      fullWidth
                      value={editandoContenido}
                      onChange={(e) => setEditandoContenido(e.target.value)}
                    />
                    <Box sx={{ mt: 2, display: "flex", gap: 1, justifyContent: "flex-end" }}>
                      <IconButton size="small" onClick={handleCancelarEdicion}>
                        <CloseIcon />
                      </IconButton>
                      <IconButton size="small" color="primary" onClick={handleGuardarEdicion} disabled={actualizarMut.isLoading}>
                        <SaveIcon />
                      </IconButton>
                    </Box>
                  </>
                ) : (
                  <>
                    <Typography variant="body1" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      {nota.contenido}
                    </Typography>
                    <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1, justifyContent: "space-between" }}>
                      <Chip label={formatearFecha(nota.createdAt)} size="small" variant="outlined" />
                      <Box>
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => handleEditar(nota)} disabled={actualizarMut.isLoading}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => setConfirm({ open: true, id: nota.id, contenido: nota.contenido })}
                            disabled={eliminarMut.isLoading}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

      <ConfirmDialog
        open={confirm.open}
        title="Eliminar nota"
        description={`¿Está seguro que desea eliminar esta nota? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        confirmColor="error"
        onClose={() => setConfirm({ open: false, id: null, contenido: "" })}
        onConfirm={handleConfirmEliminar}
        loading={eliminarMut.isLoading}
      />
    </Box>
  );
}

