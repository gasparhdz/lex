// src/routes/provincia.routes.js
import { Router } from "express";
import * as provinciaCtrl from "../controllers/provincia.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requirePermiso } from "../middlewares/rbac.js";

const r = Router();

r.get("/", provinciaCtrl.listar);
r.get("/:id", provinciaCtrl.obtener);
r.post("/", requireAuth, requirePermiso("CONFIGURACION", "crear"), provinciaCtrl.crear);
r.put("/:id", requireAuth, requirePermiso("CONFIGURACION", "editar"), provinciaCtrl.actualizar);
r.delete("/:id", requireAuth, requirePermiso("CONFIGURACION", "eliminar"), provinciaCtrl.eliminar);

export default r;

