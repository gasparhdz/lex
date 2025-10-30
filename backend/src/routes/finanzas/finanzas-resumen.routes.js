// src/routes/finanzas/finanzas-resumen.routes.js
import { Router } from "express";
import * as ctrl from "../../controllers/finanzas/finanzas-resumen.controller.js";
import { requireAuth } from "../../middlewares/auth.js";
import { requirePermiso } from "../../middlewares/rbac.js";

const r = Router();
r.use(requireAuth);

// Resumen financiero
r.get("/kpis",         requirePermiso("FINANZAS", "ver"), ctrl.kpis);
r.get("/serie",        requirePermiso("FINANZAS", "ver"), ctrl.serieIngresosGastos);
r.get("/top-deudores", requirePermiso("FINANZAS", "ver"), ctrl.topDeudores);
r.get("/top-casos",    requirePermiso("FINANZAS", "ver"), ctrl.topCasos);

export default r;
