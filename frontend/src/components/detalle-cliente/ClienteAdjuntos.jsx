// src/components/detalle-cliente/ClienteAdjuntos.jsx
import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Sync as SyncIcon,
  Visibility as VisibilityIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Folder as FolderIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { uploadAdjunto, listarAdjuntos, indexarAdjuntos, eliminarAdjunto, crearCarpetaCliente, vincularCarpetaCliente } from '../../api/adjuntos';
import { formatBytes, formatFecha } from '../../utils/format';
import api from '../../api/axios';

// ⚠️ ADJUNTOS DESHABILITADOS TEMPORALMENTE
const ADJUNTOS_ENABLED = false;

export default function ClienteAdjuntos({ clienteId }) {
  // Si los adjuntos están deshabilitados, no renderizar nada
  if (!ADJUNTOS_ENABLED) {
    return null;
  }
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [linkingFolder, setLinkingFolder] = useState(false);
  const [openLinkDialog, setOpenLinkDialog] = useState(false);
  const [linkFolderId, setLinkFolderId] = useState('');

  // Query de cliente para obtener driveFolderId
  const { data: clienteData } = useQuery({
    queryKey: ['cliente', clienteId],
    queryFn: async () => {
      const response = await api.get(`/clientes/${clienteId}`);
      return response.data;
    },
    enabled: !!clienteId,
    select: (data) => data?.data || data,
  });

  const hasDriveFolder = !!clienteData?.driveFolderId;

  // Query de adjuntos
  const { data: adjuntos, isLoading, error } = useQuery({
    queryKey: ['adjuntos', 'CLIENTE', clienteId],
    queryFn: async () => {
      const response = await listarAdjuntos('CLIENTE', clienteId);
      return response.data;
    },
    enabled: !!clienteId,
  });

  // Sincronizar automáticamente al cargar si hay carpeta de Drive
  useEffect(() => {
    if (hasDriveFolder && !isLoading && clienteData) {
      const syncFiles = async () => {
        try {
          const response = await indexarAdjuntos('CLIENTE', clienteId);
          queryClient.invalidateQueries({ queryKey: ['adjuntos', 'CLIENTE', clienteId] });
        } catch (error) {
          console.warn('Error al sincronizar archivos:', error.message);
          // No mostramos error al usuario en la sincronización automática
        }
      };
      syncFiles();
    }
  }, [hasDriveFolder, clienteData?.driveFolderId]); // Solo se ejecuta cuando cambia el driveFolderId

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo
    const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip'];
    
    if (!tiposPermitidos.includes(file.type)) {
      enqueueSnackbar('Tipo de archivo no permitido. Solo PDF, JPG, PNG, DOCX, XLSX, ZIP', { variant: 'error' });
      return;
    }

    // Validar tamaño (50 MB)
    if (file.size > 50 * 1024 * 1024) {
      enqueueSnackbar('El archivo excede el tamaño máximo de 50 MB', { variant: 'error' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('scope', 'CLIENTE');
      formData.append('scopeId', clienteId);

      await uploadAdjunto(formData);
      
      enqueueSnackbar('Archivo subido correctamente', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['adjuntos', 'CLIENTE', clienteId] });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.error || 'Error al subir archivo', { variant: 'error' });
    } finally {
      setUploading(false);
      event.target.value = ''; // Reset input
    }
  };

  const handleIndexar = async () => {
    setIndexing(true);
    try {
      const response = await indexarAdjuntos('CLIENTE', clienteId);
      
      enqueueSnackbar('Sincronizado correctamente', { variant: 'success' });
      
      queryClient.invalidateQueries({ queryKey: ['adjuntos', 'CLIENTE', clienteId] });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.error || 'Error al sincronizar archivos', { variant: 'error' });
    } finally {
      setIndexing(false);
    }
  };

  const handleEliminar = async (adjuntoId) => {
    if (!confirm('¿Estás seguro de eliminar este archivo?')) return;

    try {
      await eliminarAdjunto(adjuntoId);
      enqueueSnackbar('Archivo eliminado correctamente', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['adjuntos', 'CLIENTE', clienteId] });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.error || 'Error al eliminar archivo', { variant: 'error' });
    }
  };

  const handleCrearCarpeta = async () => {
    setCreatingFolder(true);
    try {
      await crearCarpetaCliente(clienteId);
      enqueueSnackbar('Carpeta creada correctamente en Drive', { variant: 'success' });
      queryClient.invalidateQueries({ queryKey: ['cliente', clienteId] });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.error || 'Error al crear carpeta', { variant: 'error' });
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleVincularCarpeta = async () => {
    if (!linkFolderId.trim()) {
      enqueueSnackbar('Ingresá el ID de la carpeta', { variant: 'warning' });
      return;
    }

    setLinkingFolder(true);
    try {
      await vincularCarpetaCliente(clienteId, linkFolderId.trim());
      enqueueSnackbar('Carpeta vinculada correctamente', { variant: 'success' });
      setOpenLinkDialog(false);
      setLinkFolderId('');
      queryClient.invalidateQueries({ queryKey: ['cliente', clienteId] });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.error || 'Error al vincular carpeta', { variant: 'error' });
    } finally {
      setLinkingFolder(false);
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">Error al cargar adjuntos</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {!hasDriveFolder && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="body2">
              El cliente no tiene una carpeta en Drive. Creá una nueva o vinculá una existente.
            </Typography>
            <Box display="flex" gap={1} ml={2}>
              <Button
                variant="outlined"
                size="small"
                startIcon={creatingFolder ? <CircularProgress size={16} /> : <FolderIcon />}
                onClick={handleCrearCarpeta}
                disabled={creatingFolder}
              >
                Crear carpeta
              </Button>
              <Button
                variant="outlined"
                size="small"
                startIcon={<LinkIcon />}
                onClick={() => setOpenLinkDialog(true)}
              >
                Vincular carpeta
              </Button>
            </Box>
          </Box>
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Archivos adjuntos</Typography>
            <Box display="flex" gap={1}>
            <input
              accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.zip"
              style={{ display: 'none' }}
              id="upload-file-client"
              type="file"
              onChange={handleUpload}
              disabled={uploading || !hasDriveFolder}
            />
            <label htmlFor="upload-file-client">
              <Button
                variant="outlined"
                component="span"
                startIcon={uploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                disabled={uploading || !hasDriveFolder}
              >
                {uploading ? 'Subiendo...' : 'Subir archivo'}
              </Button>
            </label>
            <Button
              variant="outlined"
              startIcon={indexing ? <CircularProgress size={16} /> : <SyncIcon />}
              onClick={handleIndexar}
              disabled={indexing || !hasDriveFolder}
            >
              {indexing ? 'Sincronizando...' : 'Sincronizar'}
            </Button>
          </Box>
        </Box>

        {isLoading ? (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        ) : !adjuntos || adjuntos.length === 0 ? (
          <Alert severity="info">No hay archivos adjuntos. Sube un archivo o actualiza desde Drive.</Alert>
        ) : (
          <TableContainer sx={{ maxHeight: 400, overflowY: 'auto', overflowX: 'hidden' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Tamaño</TableCell>
                  <TableCell>Subido por</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {adjuntos.map((adjunto) => (
                  <TableRow key={adjunto.id}>
                    <TableCell>{adjunto.nombre}</TableCell>
                    <TableCell>
                      <Chip label={getFileTypeLabel(adjunto.mime)} size="small" />
                    </TableCell>
                    <TableCell>{formatBytes(adjunto.sizeBytes)}</TableCell>
                    <TableCell>
                      {adjunto.subidoPor
                        ? `${adjunto.subidoPor.nombre} ${adjunto.subidoPor.apellido}`
                        : '—'}
                    </TableCell>
                    <TableCell>{formatFecha(adjunto.creadoEn)}</TableCell>
                    <TableCell align="right">
                      <Tooltip title="Ver">
                        <IconButton
                          size="small"
                          onClick={() => window.open(adjunto.driveWebView, '_blank')}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {adjunto.driveWebContent && (
                        <Tooltip title="Descargar">
                          <IconButton
                            size="small"
                            onClick={() => window.open(adjunto.driveWebContent, '_blank')}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleEliminar(adjunto.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>

    <Dialog open={openLinkDialog} onClose={() => !linkingFolder && setOpenLinkDialog(false)}>
      <DialogTitle>Vincular carpeta existente</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="ID de la carpeta en Drive"
          fullWidth
          variant="outlined"
          value={linkFolderId}
          onChange={(e) => setLinkFolderId(e.target.value)}
          helperText="Ingresá el ID de la carpeta que querés vincular"
          disabled={linkingFolder}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setOpenLinkDialog(false)} disabled={linkingFolder}>
          Cancelar
        </Button>
        <Button
          onClick={handleVincularCarpeta}
          variant="contained"
          disabled={linkingFolder || !linkFolderId.trim()}
        >
          {linkingFolder ? 'Vinculando...' : 'Vincular'}
        </Button>
      </DialogActions>
    </Dialog>

    {uploading && (
      <Box sx={{ mt: 2 }}>
        <LinearProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
          Subiendo archivo...
        </Typography>
      </Box>
    )}
    </>
  );
}

function getFileTypeLabel(mime) {
  const types = {
    'application/pdf': 'PDF',
    'image/jpeg': 'JPG',
    'image/jpg': 'JPG',
    'image/png': 'PNG',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
    'application/zip': 'ZIP',
  };
  return types[mime] || 'Archivo';
}

