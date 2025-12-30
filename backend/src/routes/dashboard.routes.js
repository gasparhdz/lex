import { Router } from "express";
import * as db from "../controllers/dashboard.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requirePermiso } from "../middlewares/rbac.js";

const r = Router();
r.use(requireAuth);

// Dashboard es accesible para todos los usuarios autenticados
r.get("/kpis",    db.obtenerKpis);
r.get("/tareas",  db.listarTareasPendientes);
r.get("/eventos", db.listarEventosPendientes);

export default r;
