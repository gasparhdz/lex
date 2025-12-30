// src/routes/parametro.routes.js
import { Router } from "express";
import { 
  listarParametros, 
  listarCategorias,
  obtenerParametro,
  crearParametro,
  actualizarParametro,
  eliminarParametro
} from "../controllers/parametro.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requirePermiso } from "../middlewares/rbac.js";

const r = Router();

// Categorías
r.get("/categorias", requireAuth, requirePermiso("CONFIGURACION", "ver"), listarCategorias);

// Parámetros - Listado (sin autenticación porque lo usan otros módulos)
r.get("/", listarParametros);

// Azúcar sintáctica ya existente
import { listarTipoPersona } from "../controllers/parametro.controller.js";
r.get("/tipo-persona", listarTipoPersona);

// (Opcionales útiles, dejan el mismo controlador y facilitan el front)
r.get("/rama-derecho", (req, res, next) => {
  req.query.categoria = "RAMA_DERECHO";
  return listarParametros(req, res, next);
});
r.get("/tipo-caso", (req, res, next) => {
  req.query.categoria = "TIPO_CASO";
  return listarParametros(req, res, next);
});
r.get("/estado-caso", (req, res, next) => {
  req.query.categoria = "ESTADO_CASO";
  return listarParametros(req, res, next);
});
r.get("/radicacion-caso", (req, res, next) => {
  req.query.categoria = "RADICACION_CASO";
  return listarParametros(req, res, next);
});
r.get("/estado-radicacion", (req, res, next) => {
  req.query.categoria = "ESTADO_RADICACION";
  return listarParametros(req, res, next);
});

// CRUD de parámetros (requiere autenticación)
r.get("/:id", requireAuth, requirePermiso("CONFIGURACION", "ver"), obtenerParametro);
r.post("/", requireAuth, requirePermiso("CONFIGURACION", "crear"), crearParametro);
r.put("/:id", requireAuth, requirePermiso("CONFIGURACION", "editar"), actualizarParametro);
r.delete("/:id", requireAuth, requirePermiso("CONFIGURACION", "eliminar"), eliminarParametro);

export default r;
