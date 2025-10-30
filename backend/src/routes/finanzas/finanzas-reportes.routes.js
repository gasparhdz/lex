// src/routes/finanzas/finanzas-reportes.routes.js
import { Router } from "express";
import * as ctrl from "../../controllers/finanzas/finanzas-reportes.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermiso } from "../../middlewares/rbac.js";

const r = Router();
r.use(requireAuth);

// Reportes de finanzas (solo lectura)
r.get("/cobranzas-pendientes",        requirePermiso("FINANZAS", "ver"), ctrl.cobranzasPendientes);
r.get("/ingresos-periodo",            requirePermiso("FINANZAS", "ver"), ctrl.ingresosPeriodo);
r.get("/gastos-periodo",              requirePermiso("FINANZAS", "ver"), ctrl.gastosPeriodo);
r.get("/flujo-caja",                  requirePermiso("FINANZAS", "ver"), ctrl.flujoCaja);
r.get("/honorarios-por-cliente",      requirePermiso("FINANZAS", "ver"), ctrl.honorariosPorCliente);
r.get("/gastos-pendientes-reintegro", requirePermiso("FINANZAS", "ver"), ctrl.gastosPendientesReintegro);
r.get("/vencimientos-periodo",        requirePermiso("FINANZAS", "ver"), ctrl.vencimientosPeriodo);

export default r;
