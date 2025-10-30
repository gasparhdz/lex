import { Router } from "express";
import * as ctrl from "../controllers/tarea.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requirePermiso } from "../middlewares/rbac.js";

const r = Router();
r.use(requireAuth);

r.get("/",        requirePermiso("TAREAS", "ver"),      ctrl.listar);
r.get("/:id",     requirePermiso("TAREAS", "ver"),      ctrl.obtener);
r.post("/",       requirePermiso("TAREAS", "crear"),    ctrl.crear);
r.put("/:id",     requirePermiso("TAREAS", "editar"),   ctrl.actualizar);
r.delete("/:id",  requirePermiso("TAREAS", "eliminar"), ctrl.borrar);
r.get("/:id/items",                requirePermiso("TAREAS", "ver"),    ctrl.listItems);
r.post("/:id/items",               requirePermiso("TAREAS", "editar"), ctrl.agregarItem);
r.put("/:id/items/:itemId",        requirePermiso("TAREAS", "editar"), ctrl.actualizarItem);
r.delete("/:id/items/:itemId",     requirePermiso("TAREAS", "editar"), ctrl.borrarItem);
r.post("/:id/items/reordenar",     requirePermiso("TAREAS", "editar"), ctrl.reordenarItems);
r.post("/:id/items/:itemId/toggle", requirePermiso("TAREAS", "editar"), ctrl.toggleItem);
r.post("/:id/items/completar-todo", requirePermiso("TAREAS", "editar"), ctrl.completarTodo);
r.post("/:id/toggle",              requirePermiso("TAREAS", "editar"), ctrl.toggleCompleta);

export default r;
