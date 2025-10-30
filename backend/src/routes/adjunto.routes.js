// src/routes/adjunto.routes.js
import express from 'express';
import multer from 'multer';
import {
  uploadAdjunto,
  listarAdjuntos,
  indexarAdjuntos,
  eliminarAdjunto,
} from '../controllers/adjunto.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import {
  uploadAdjuntoSchema,
  listarAdjuntosSchema,
  indexarAdjuntosSchema,
} from '../validators/adjunto.schema.js';
import { validate } from '../middlewares/validate.js';

const router = express.Router();

// Configurar multer para manejar archivos en memoria
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
  },
});

// Middleware para validar body en upload (sin el file)
const validateUploadBody = (req, res, next) => {
  const { scope, scopeId } = req.body;
  const result = uploadAdjuntoSchema.validate({ scope, scopeId });
  if (result.error) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: result.error.details.map((detail) => ({
        path: detail.path,
        message: detail.message,
      })),
    });
  }
  req.body = result.value;
  next();
};

router.post('/upload', requireAuth, upload.single('file'), validateUploadBody, uploadAdjunto);
router.get('/', requireAuth, validate(listarAdjuntosSchema, 'query'), listarAdjuntos);
router.get('/indexar', requireAuth, validate(indexarAdjuntosSchema, 'query'), indexarAdjuntos);
router.delete('/:id', requireAuth, eliminarAdjunto);

export default router;

