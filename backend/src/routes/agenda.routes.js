import { Router } from "express";
import * as ev from "../controllers/evento.controller.js";
import * as ta from "../controllers/tarea.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requirePermiso } from "../middlewares/rbac.js";
import { validate } from "../middlewares/validate.js";

// Validators
import { crearEventoSchema, actualizarEventoSchema } from "../validators/evento.schema.js";
import { crearTareaSchema, actualizarTareaSchema } from "../validators/tarea.schema.js";
import { crearSubtareaSchema, actualizarSubtareaSchema } from "../validators/subtarea.schema.js";

const r = Router();
r.use(requireAuth);

/* ===================== Eventos ===================== */
r.get("/eventos",        requirePermiso("EVENTOS", "ver"),     ev.listar);
r.get("/eventos/:id",    requirePermiso("EVENTOS", "ver"),     ev.obtener);
r.post("/eventos",       requirePermiso("EVENTOS", "crear"),   validate(crearEventoSchema),      ev.crear);
r.put("/eventos/:id",    requirePermiso("EVENTOS", "editar"),  validate(actualizarEventoSchema), ev.actualizar);
r.delete("/eventos/:id", requirePermiso("EVENTOS", "eliminar"), ev.borrar);

/* ====================== Tareas ====================== */
r.get("/tareas",         requirePermiso("TAREAS", "ver"),     ta.listar);
r.get("/tareas/:id",     requirePermiso("TAREAS", "ver"),     ta.obtener);
r.post("/tareas",        requirePermiso("TAREAS", "crear"),   validate(crearTareaSchema),       ta.crear);
r.put("/tareas/:id",     requirePermiso("TAREAS", "editar"),  validate(actualizarTareaSchema),  ta.actualizar);
r.delete("/tareas/:id",  requirePermiso("TAREAS", "eliminar"), ta.borrar);

/* =========== Subtareas / Checklist de Tarea =========== */
// Ojo: el controller usa `:id` para la tarea, no `:tareaId`
r.post("/tareas/:id/items",                 requirePermiso("TAREAS", "editar"), validate(crearSubtareaSchema),      ta.agregarItem);
r.put("/tareas/:id/items/:itemId",          requirePermiso("TAREAS", "editar"), validate(actualizarSubtareaSchema), ta.actualizarItem);
r.delete("/tareas/:id/items/:itemId",       requirePermiso("TAREAS", "editar"), ta.borrarItem);
r.post("/tareas/:id/items/reordenar",       requirePermiso("TAREAS", "editar"), ta.reordenarItems);

/* ================== Toggle completar ================== */
r.post("/tareas/:id/toggle",                requirePermiso("TAREAS", "editar"), ta.toggleCompleta);

export default r;
