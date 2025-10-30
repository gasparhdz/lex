// src/routes/finanzas/gasto.routes.js
import { Router } from "express";
import * as ctrl from "../../controllers/finanzas/gasto.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermiso } from "../../middlewares/rbac.js";

const r = Router();
r.use(requireAuth);

// Gastos
r.get("/",        requirePermiso("FINANZAS", "ver"),      ctrl.listar);
r.get("/:id",     requirePermiso("FINANZAS", "ver"),      ctrl.obtener);
r.post("/",       requirePermiso("FINANZAS", "crear"),    ctrl.crear);
r.put("/:id",     requirePermiso("FINANZAS", "editar"),   ctrl.actualizar);
r.delete("/:id",  requirePermiso("FINANZAS", "eliminar"), ctrl.borrar);

export default r;
