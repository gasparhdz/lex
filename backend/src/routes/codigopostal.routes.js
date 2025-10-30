// src/routes/codigopostal.routes.js
import { Router } from "express";
import * as cpCtrl from "../controllers/codigopostal.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requirePermiso } from "../middlewares/rbac.js";

const r = Router();

r.get("/", cpCtrl.listar);
r.get("/:id", cpCtrl.obtener);
r.post("/", requireAuth, requirePermiso("CONFIGURACION", "crear"), cpCtrl.crear);
r.put("/:id", requireAuth, requirePermiso("CONFIGURACION", "editar"), cpCtrl.actualizar);
r.delete("/:id", requireAuth, requirePermiso("CONFIGURACION", "eliminar"), cpCtrl.eliminar);

export default r;

