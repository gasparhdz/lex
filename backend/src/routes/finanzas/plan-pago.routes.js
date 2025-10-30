// src/routes/finanzas/plan-pago.routes.js
import { Router } from "express";
import * as ctrl from "../../controllers/finanzas/plan-pago.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermiso } from "../../middlewares/rbac.js";

const r = Router();
r.use(requireAuth);

// 🔹 Planes
r.get("/",        requirePermiso("HONORARIOS", "ver"),      ctrl.listarPlanes);
r.get("/:id",     requirePermiso("HONORARIOS", "ver"),      ctrl.obtenerPlan);
r.post("/",       requirePermiso("HONORARIOS", "crear"),    ctrl.crearPlan);
r.put("/:id",     requirePermiso("HONORARIOS", "editar"),   ctrl.actualizarPlan);
r.delete("/:id",  requirePermiso("HONORARIOS", "eliminar"), ctrl.borrarPlan);

// 🔹 Cuotas
r.get("/:id/cuotas",             requirePermiso("HONORARIOS", "ver"),      ctrl.listCuotas);
r.post("/:id/cuotas",            requirePermiso("HONORARIOS", "editar"),   ctrl.crearCuota);
r.put("/:id/cuotas/:cuotaId",    requirePermiso("HONORARIOS", "editar"),   ctrl.actualizarCuota);
r.delete("/:id/cuotas/:cuotaId", requirePermiso("HONORARIOS", "eliminar"), ctrl.borrarCuota);

// 🔹 Generación masiva de cuotas
r.post("/:id/cuotas/generar",    requirePermiso("HONORARIOS", "editar"),   ctrl.generarCuotas);

export default r;
