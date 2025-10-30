import express from 'express';
import { enviarRecordatorios } from '../controllers/recordatorio.controller.js';
import { getWhatsAppStatus } from '../utils/whatsapp.js';
import { requireAuth } from '../middlewares/auth.js';

const router = express.Router();

// Endpoint público para el cron job (se llama automáticamente)
// Nota: En producción deberías proteger esto con un API key
router.post('/enviar-automatico', enviarRecordatorios);

// Endpoint protegido para ejecución manual desde el frontend
router.post('/enviar', requireAuth, enviarRecordatorios);

// Endpoint para verificar estado de WhatsApp
router.get('/whatsapp-status', requireAuth, (req, res) => {
  try {
    const status = getWhatsAppStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

