// frontend/src/components/adjuntos/UploadAdjuntoButton.jsx
import { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import { CloudUpload as CloudUploadIcon } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { uploadAdjunto } from '../../api/adjuntos';

// ⚠️ ADJUNTOS DESHABILITADOS TEMPORALMENTE
const ADJUNTOS_ENABLED = false;

export default function UploadAdjuntoButton({ clienteId, casoId, onUploadSuccess, disabled }) {
  // Si los adjuntos están deshabilitados, no renderizar nada
  if (!ADJUNTOS_ENABLED) {
    return null;
  }

  const { enqueueSnackbar } = useSnackbar();
  const [uploading, setUploading] = useState(false);

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

    // Determinar scope
    let scope, scopeId;
    if (casoId) {
      scope = 'CASO';
      scopeId = casoId;
    } else if (clienteId) {
      scope = 'CLIENTE';
      scopeId = clienteId;
    } else {
      enqueueSnackbar('Debe seleccionar un cliente o caso', { variant: 'error' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('scope', scope);
      formData.append('scopeId', scopeId);

      await uploadAdjunto(formData);
      
      enqueueSnackbar('Archivo subido correctamente', { variant: 'success' });
      
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error) {
      enqueueSnackbar(error.response?.data?.error || 'Error al subir archivo', { variant: 'error' });
    } finally {
      setUploading(false);
      event.target.value = ''; // Reset input
    }
  };

  const isDisabled = uploading || disabled || (!clienteId && !casoId);

  return (
    <>
      <input
        accept=".pdf,.jpg,.jpeg,.png,.docx,.xlsx,.zip"
        style={{ display: 'none' }}
        id="upload-adjunto-button"
        type="file"
        onChange={handleUpload}
        disabled={isDisabled}
      />
      <label htmlFor="upload-adjunto-button">
        <Button
          variant="outlined"
          component="span"
          startIcon={uploading ? <CircularProgress size={16} /> : <CloudUploadIcon />}
          disabled={isDisabled}
          sx={{ whiteSpace: 'nowrap' }}
        >
          {uploading ? 'Subiendo...' : 'Adjuntar archivo'}
        </Button>
      </label>
    </>
  );
}

