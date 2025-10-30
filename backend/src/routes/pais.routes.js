// src/routes/pais.routes.js
import { Router } from "express";
import * as paisCtrl from "../controllers/pais.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requirePermiso } from "../middlewares/rbac.js";

const r = Router();

r.get("/", paisCtrl.listar);
r.get("/:id", paisCtrl.obtener);
r.post("/", requireAuth, requirePermiso("CONFIGURACION", "crear"), paisCtrl.crear);
r.put("/:id", requireAuth, requirePermiso("CONFIGURACION", "editar"), paisCtrl.actualizar);
r.delete("/:id", requireAuth, requirePermiso("CONFIGURACION", "eliminar"), paisCtrl.eliminar);

export default r;

