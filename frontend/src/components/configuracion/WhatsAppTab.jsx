// src/components/configuracion/WhatsAppTab.jsx
import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getWhatsAppStatus } from '../../api/whatsapp';
import { QRCode } from 'react-qr-code';

export default function WhatsAppTab() {
  const [refreshInterval, setRefreshInterval] = useState(2000); // Actualizar cada 2 segundos

  const { data: statusData, isLoading, error } = useQuery({
    queryKey: ['whatsapp-status'],
    queryFn: async () => {
      const response = await getWhatsAppStatus();
      return response.data;
    },
    refetchInterval: refreshInterval, // Polling cada 2 segundos
    refetchIntervalInBackground: true,
  });

  // Parar el polling cuando esté conectado
  useEffect(() => {
    if (statusData?.isReady && statusData?.isConnected) {
      setRefreshInterval(0); // Parar polling
    } else if (statusData?.qr) {
      setRefreshInterval(2000); // Seguir polling si hay QR
    }
  }, [statusData]);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error al obtener el estado de WhatsApp: {error.message}
      </Alert>
    );
  }

  const { isReady, isConnected, isInitialized, qr, reconnectAttempts } = statusData || {};

  // Estado: Conectado y listo
  if (isReady && isConnected) {
    return (
      <Box>
        <Alert severity="success" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            ✅ WhatsApp conectado correctamente
          </Typography>
          <Typography variant="body2">
            Los recordatorios se enviarán por WhatsApp y por email automáticamente.
          </Typography>
        </Alert>

        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Estado de la conexión
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Estado:</strong> Conectado y listo
              </Typography>
              <Typography variant="body2" color="text.secondary">
                <strong>Inicializado:</strong> {isInitialized ? 'Sí' : 'No'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Estado: Necesita QR
  if (qr) {
    return (
      <Box>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            📱 Escanea el código QR con WhatsApp
          </Typography>
          <Typography variant="body2">
            Abrí WhatsApp en tu teléfono → Configuración → Dispositivos vinculados → Vincular un dispositivo
          </Typography>
        </Alert>

        <Card>
          <CardContent>
            <Box display="flex" flexDirection="column" alignItems="center" gap={3}>
              <Box
                sx={{
                  p: 2,
                  border: '2px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: 'background.paper',
                }}
              >
                <QRCode
                  value={qr}
                  size={256}
                />
              </Box>

              <Typography variant="body2" color="text.secondary" textAlign="center">
                El código QR se actualizará automáticamente cada 20 segundos.
                <br />
                Una vez escaneado, la sesión se guardará y no necesitarás volver a escanear.
              </Typography>

              {isInitialized && (
                <Alert severity="info" sx={{ width: '100%' }}>
                  Esperando conexión... El sistema se actualizará automáticamente cuando escanees el QR.
                </Alert>
              )}
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Estado: Inicializando o desconectado
  if (isInitialized && !isReady && !isConnected) {
    return (
      <Box>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            🔄 Inicializando WhatsApp...
          </Typography>
          <Typography variant="body2">
            Esperando código QR. El sistema se actualizará automáticamente.
          </Typography>
        </Alert>

        {reconnectAttempts > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Reintentos de conexión: {reconnectAttempts}
          </Alert>
        )}

        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <Box textAlign="center">
            <CircularProgress size={60} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Esperando código QR...
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  }

  // Estado: No inicializado
  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          WhatsApp no inicializado
        </Typography>
        <Typography variant="body2">
          El backend está intentando inicializar WhatsApp. Esperá un momento...
        </Typography>
      </Alert>

      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    </Box>
  );
}

