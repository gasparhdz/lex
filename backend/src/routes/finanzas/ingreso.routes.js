// src/routes/finanzas/ingreso.routes.js
import { Router } from "express";
import {
  listar, obtener, crear, actualizar, borrar,
  actualizarYReconciliar, // 👈 importar
} from "../../controllers/finanzas/ingreso.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermiso } from "../../middlewares/rbac.js";

const r = Router();
r.use(requireAuth);

r.get("/",       requirePermiso("FINANZAS", "ver"),      listar);
r.get("/:id",    requirePermiso("FINANZAS", "ver"),      obtener);
r.post("/",      requirePermiso("FINANZAS", "crear"),    crear);
r.put("/:id",    requirePermiso("FINANZAS", "editar"),   actualizar);
r.put("/:id/reconciliar", requirePermiso("FINANZAS", "editar"), actualizarYReconciliar); // 👈 nueva
r.delete("/:id", requirePermiso("FINANZAS", "eliminar"), borrar);

export default r;
