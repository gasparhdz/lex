// src/routes/valorjus.routes.js
import { Router } from "express";
import * as ctrl from "../controllers/valorjus.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requirePermiso } from "../middlewares/rbac.js";

const r = Router();
r.use(requireAuth);

r.get("/actual",  requirePermiso("FINANZAS", "ver"),      ctrl.actual);
r.get("/",        requirePermiso("FINANZAS", "ver"),      ctrl.listar);
r.get("/por-fecha", requirePermiso("FINANZAS", "ver"),      ctrl.porFecha);
r.get("/:id",     requirePermiso("FINANZAS", "ver"),      ctrl.obtener);
r.post("/",       requirePermiso("FINANZAS", "crear"),    ctrl.crear);
r.put("/:id",     requirePermiso("FINANZAS", "editar"),   ctrl.actualizar);
r.delete("/:id",  requirePermiso("FINANZAS", "eliminar"), ctrl.borrar);


export default r;
