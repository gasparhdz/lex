// src/routes/finanzas/ingreso-cuota.routes.js
import { Router } from "express";
import * as ctrl from "../../controllers/finanzas/ingreso-cuota.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermiso } from "../../middlewares/rbac.js";

const r = Router();
r.use(requireAuth);

// ========================= Resúmenes =========================
// Resumen por ingreso (contra cuotas)
r.get(  "/ingreso/:ingresoId/resumen",  requirePermiso("FINANZAS", "ver"),  ctrl.resumenIngresoCuotas);

// Resumen por cuota (contra ingresos)
r.get(  "/cuota/:cuotaId/resumen",  requirePermiso("FINANZAS", "ver"),  ctrl.resumenCuota);

// ========================= CRUD Aplicaciones Ingreso ↔ Cuota =========================
r.get(  "/",  requirePermiso("FINANZAS", "ver"),  ctrl.listar);
r.get(  "/:id",  requirePermiso("FINANZAS", "ver"),  ctrl.obtener);
r.post(  "/",  requirePermiso("FINANZAS", "editar"),  ctrl.crear);
r.put("/:id", requirePermiso("FINANZAS", "editar"), ctrl.actualizar);
r.delete(  "/:id",  requirePermiso("FINANZAS", "editar"),  ctrl.borrar);

export default r;
