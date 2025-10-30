// src/routes/localidad.routes.js
import { Router } from "express";
import * as localidadCtrl from "../controllers/localidad.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requirePermiso } from "../middlewares/rbac.js";

const r = Router();

r.get("/", localidadCtrl.listar);
r.get("/:id", localidadCtrl.obtener);
r.post("/", requireAuth, requirePermiso("CONFIGURACION", "crear"), localidadCtrl.crear);
r.put("/:id", requireAuth, requirePermiso("CONFIGURACION", "editar"), localidadCtrl.actualizar);
r.delete("/:id", requireAuth, requirePermiso("CONFIGURACION", "eliminar"), localidadCtrl.eliminar);

export default r;
