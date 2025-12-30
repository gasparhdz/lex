import { Router } from "express";
import * as ctrl from "../controllers/evento.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requirePermiso } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";
import { crearEventoSchema, actualizarEventoSchema } from "../validators/evento.schema.js";

const r = Router();
r.use(requireAuth);

// Eventos
r.get("/",       requirePermiso("EVENTOS", "ver"),     ctrl.listar);
r.get("/:id",    requirePermiso("EVENTOS", "ver"),     ctrl.obtener);
r.post("/",      requirePermiso("EVENTOS", "crear"),   validate(crearEventoSchema),      ctrl.crear);
r.put("/:id",    requirePermiso("EVENTOS", "editar"),  validate(actualizarEventoSchema), ctrl.actualizar);
r.delete("/:id", requirePermiso("EVENTOS", "eliminar"), ctrl.borrar);

export default r;
