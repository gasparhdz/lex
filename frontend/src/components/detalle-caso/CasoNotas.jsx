// src/components/detalle-caso/CasoNotas.jsx
import { useState, forwardRef, useImperativeHandle } from "react";
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
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import { enqueueSnackbar } from "notistack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import api from "../../api/axios";
import ConfirmDialog from "../ConfirmDialog";
import dayjs from "dayjs";

const CasoNotas = forwardRef(function CasoNotas({ casoId }, ref) {
  const qc = useQueryClient();
  const [openDialogNueva, setOpenDialogNueva] = useState(false);
  const [nuevaNota, setNuevaNota] = useState("");
  const [openDialogEditar, setOpenDialogEditar] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [editandoContenido, setEditandoContenido] = useState("");
  const [confirm, setConfirm] = useState({ open: false, id: null, contenido: "" });

  // Queries
  const { data: notas = [], isLoading, refetch } = useQuery({
    queryKey: ["caso-notas", casoId],
    queryFn: () => api.get(`/casos/${casoId}/notas`).then((r) => r.data),
    enabled: !!casoId,
  });

  // Mutations
  const crearMut = useMutation({
    mutationFn: (contenido) =>
      api.post(`/casos/${casoId}/notas`, { contenido }).then((r) => r.data),
    onSuccess: () => {
      enqueueSnackbar("Nota agregada", { variant: "success" });
      setNuevaNota("");
      setOpenDialogNueva(false);
      qc.invalidateQueries({ queryKey: ["caso-notas", casoId] });
      refetch();
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || "Error al agregar nota";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const actualizarMut = useMutation({
    mutationFn: ({ notaId, contenido }) =>
      api.put(`/casos/${casoId}/notas/${notaId}`, { contenido }).then((r) => r.data),
    onSuccess: () => {
      enqueueSnackbar("Nota actualizada", { variant: "success" });
      setEditandoId(null);
      setEditandoContenido("");
      setOpenDialogEditar(false);
      qc.invalidateQueries({ queryKey: ["caso-notas", casoId] });
      refetch();
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || "Error al actualizar nota";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const eliminarMut = useMutation({
    mutationFn: (notaId) => api.delete(`/casos/${casoId}/notas/${notaId}`),
    onSuccess: () => {
      enqueueSnackbar("Nota eliminada", { variant: "success" });
      setConfirm({ open: false, id: null, contenido: "" });
      qc.invalidateQueries({ queryKey: ["caso-notas", casoId] });
      refetch();
    },
    onError: (e) => {
      const msg = e?.response?.data?.publicMessage || "Error al eliminar nota";
      enqueueSnackbar(msg, { variant: "error" });
    },
  });

  const handleAbrirDialogNueva = () => {
    setOpenDialogNueva(true);
  };

  const handleCerrarDialogNueva = () => {
    setOpenDialogNueva(false);
    setNuevaNota("");
  };

  // Exponer función para abrir dialog desde el padre
  useImperativeHandle(ref, () => ({
    abrirDialogNueva: handleAbrirDialogNueva,
  }));

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
    setOpenDialogEditar(true);
  };

  const handleCerrarDialogEditar = () => {
    setOpenDialogEditar(false);
    setEditandoId(null);
    setEditandoContenido("");
  };

  const handleGuardarEdicion = () => {
    if (!editandoContenido.trim()) {
      enqueueSnackbar("La nota no puede estar vacía", { variant: "warning" });
      return;
    }
    actualizarMut.mutate({ notaId: editandoId, contenido: editandoContenido.trim() });
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
      {/* Lista de notas */}
      {notas.length === 0 ? (
        <Alert severity="info">
          Aún no hay notas registradas para este caso.
        </Alert>
      ) : (
        <Box sx={{ maxHeight: 400, overflowY: 'auto', overflowX: 'hidden' }}>
        <Stack spacing={1.5}>
          {notas.map((nota) => (
            <Card key={nota.id} variant="outlined">
              <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: '0.875rem' }}>
                  {nota.contenido}
                </Typography>
                <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1, justifyContent: "space-between" }}>
                  <Chip label={formatearFecha(nota.createdAt)} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
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
              </CardContent>
            </Card>
          ))}
        </Stack>
        </Box>
      )}

      {/* Dialog para nueva nota */}
      <Dialog open={openDialogNueva} onClose={handleCerrarDialogNueva} maxWidth="sm" fullWidth>
        <DialogTitle>Nueva nota</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            minRows={4}
            fullWidth
            placeholder="Escribe una nota sobre este caso..."
            value={nuevaNota}
            onChange={(e) => setNuevaNota(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCerrarDialogNueva} disabled={crearMut.isLoading}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleAgregar}
            disabled={crearMut.isLoading}
            startIcon={crearMut.isLoading ? <CircularProgress size={16} /> : null}
          >
            {crearMut.isLoading ? "Guardando..." : "Agregar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog para editar nota */}
      <Dialog open={openDialogEditar} onClose={handleCerrarDialogEditar} maxWidth="sm" fullWidth>
        <DialogTitle>Editar nota</DialogTitle>
        <DialogContent>
          <TextField
            multiline
            minRows={4}
            fullWidth
            value={editandoContenido}
            onChange={(e) => setEditandoContenido(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCerrarDialogEditar} disabled={actualizarMut.isLoading}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleGuardarEdicion}
            disabled={actualizarMut.isLoading}
            startIcon={actualizarMut.isLoading ? <CircularProgress size={16} /> : null}
          >
            {actualizarMut.isLoading ? "Guardando..." : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

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
});

export default CasoNotas;

