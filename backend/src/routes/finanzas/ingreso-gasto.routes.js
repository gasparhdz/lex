// src/routes/finanzas/ingreso-gasto.routes.js
import { Router } from "express";
import * as ctrl from "../../controllers/finanzas/ingreso-gasto.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermiso } from "../../middlewares/rbac.js";

const r = Router();
r.use(requireAuth);

// ========================= Resúmenes =========================
r.get(  "/ingreso/:ingresoId/resumen",  requirePermiso("FINANZAS", "ver"),  ctrl.resumenIngreso);
r.get(  "/gasto/:gastoId/resumen",  requirePermiso("FINANZAS", "ver"),  ctrl.resumenGasto);

// ========================= CRUD Aplicaciones Ingreso ↔ Gasto =========================
r.get(  "/",  requirePermiso("FINANZAS", "ver"),  ctrl.listar);
r.get(  "/:id",  requirePermiso("FINANZAS", "ver"),  ctrl.obtener);
r.post(  "/",  requirePermiso("FINANZAS", "editar"),  ctrl.crear);
r.put(  "/:id",  requirePermiso("FINANZAS", "editar"),  ctrl.actualizar );
r.delete(  "/:id",  requirePermiso("FINANZAS", "editar"),  ctrl.borrar);

export default r;
