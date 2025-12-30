// src/routes/caso.routes.js
import { Router } from "express";
import * as ctrl from "../controllers/caso.controller.js";
import * as notaCtrl from "../controllers/caso-nota.controller.js";
import * as historialCtrl from "../controllers/caso-historial.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requirePermiso } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import { crearCasoSchema, actualizarCasoSchema } from "../validators/caso.schema.js";

const r = Router();
r.use(requireAuth);

// Casos
r.get("/",       requirePermiso("CASOS", "ver"),    ctrl.listar);
r.get('/:id/detalle', requirePermiso('CASOS','ver'), ctrl.detalleCaso);
r.get("/:id",    requirePermiso("CASOS", "ver"),    ctrl.obtener);
r.post("/",      requirePermiso("CASOS", "crear"),  validate(crearCasoSchema),    ctrl.crear);
r.put("/:id",    requirePermiso("CASOS", "editar"), validate(actualizarCasoSchema), ctrl.actualizar);
r.delete("/:id", requirePermiso("CASOS", "eliminar"), ctrl.borrar);

// Notas del caso
r.get('/:casoId/notas', requirePermiso('CASOS', 'ver'), notaCtrl.listar);
r.post('/:casoId/notas', requirePermiso('CASOS', 'editar'), notaCtrl.crear);
r.put('/:casoId/notas/:notaId', requirePermiso('CASOS', 'editar'), notaCtrl.actualizar);
r.delete('/:casoId/notas/:notaId', requirePermiso('CASOS', 'editar'), notaCtrl.eliminar);

// Historial del caso
r.get('/:casoId/historial', requirePermiso('CASOS', 'ver'), historialCtrl.obtener);

export default r;
