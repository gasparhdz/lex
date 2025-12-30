// src/routes/drive.routes.js
import express from 'express';
import {
  crearCarpetaCliente,
  crearCarpetaCaso,
  vincularCarpetaCliente,
  vincularCarpetaCaso,
} from '../controllers/drive.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import {
  vincularCarpetaClienteSchema,
  vincularCarpetaCasoSchema,
} from '../validators/adjunto.schema.js';
import { validate } from '../middlewares/validate.js';

const router = express.Router();

router.post('/clientes/:id/create', requireAuth, crearCarpetaCliente);
router.put('/clientes/:id/vincular', requireAuth, validate(vincularCarpetaClienteSchema), vincularCarpetaCliente);
router.post('/casos/:id/create', requireAuth, crearCarpetaCaso);
router.put('/casos/:id/vincular', requireAuth, validate(vincularCarpetaCasoSchema), vincularCarpetaCaso);

export default router;

