// src/controllers/tarea.controller.js
import prisma from "../utils/prisma.js";
import { crearSubtareaSchema, actualizarSubtareaSchema } from "../validators/subtarea.schema.js";

/* ========================= Helpers ========================= */
function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? "20", 10)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function strOrNull(v) {
  if (v === null) return null;
  if (v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function toDateOrNull(v) {
  if (v === null) return null;
  if (!v && v !== 0) return undefined;
  try {
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
  } catch {
    return undefined;
  }
}
function intOrNull(v) {
  if (v === null) return null;
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function boolOrNull(v) {
  if (v === null) return null;
  if (v === undefined || v === "") return undefined;
  const s = String(v).toLowerCase();
  if (["true", "1", "t", "yes", "y"].includes(s)) return true;
  if (["false", "0", "f", "no", "n"].includes(s)) return false;
  return undefined;
}

/** Normaliza campos recibidos del front para Tarea */
function normalizeTareaDTO(b = {}) {
  const out = {
    titulo: strOrNull(b.titulo),
    descripcion: strOrNull(b.descripcion),
    fechaLimite: toDateOrNull(b.fechaLimite),
    prioridadId: intOrNull(b.prioridadId),
    recordatorio: toDateOrNull(b.recordatorio),
    completada: b.completada === undefined ? undefined : Boolean(b.completada),
    completadaAt: toDateOrNull(b.completadaAt),
    asignadoA: intOrNull(b.asignadoA),
    clienteId: intOrNull(b.clienteId),
    casoId: intOrNull(b.casoId),
    recordatorioEnviado: b.recordatorioEnviado === undefined ? undefined : Boolean(b.recordatorioEnviado),
    activo: b.activo === undefined ? undefined : Boolean(b.activo),
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

function buildWhereTareas(q = {}) {
  const where = {
    deletedAt: null,
    activo: true,
  };

  // Filtros directos
  const completada = boolOrNull(q.completada);
  if (completada !== undefined) where.completada = completada;

  const clienteId = intOrNull(q.clienteId);
  if (clienteId !== undefined) where.clienteId = clienteId;

  const casoId = intOrNull(q.casoId);
  if (casoId !== undefined) where.casoId = casoId;

  const prioridadId = intOrNull(q.prioridadId);
  if (prioridadId !== undefined) where.prioridadId = prioridadId;

  const asignadoA = intOrNull(q.asignadoA);
  if (asignadoA !== undefined) where.asignadoA = asignadoA;

  const dueFrom = toDateOrNull(q.dueFrom);
  const dueTo = toDateOrNull(q.dueTo);
  if (dueFrom || dueTo) {
    where.fechaLimite = {};
    if (dueFrom) where.fechaLimite.gte = dueFrom;
    if (dueTo) where.fechaLimite.lte = dueTo;
  }

  // Búsqueda por texto
  const search = String(q.search || "").trim();
  if (search) {
    where.AND = (where.AND || []).concat({
      OR: [
        { titulo: { contains: search, mode: "insensitive" } },
        { descripcion: { contains: search, mode: "insensitive" } },
        { cliente: { razonSocial: { contains: search, mode: "insensitive" } } },
        { cliente: { apellido: { contains: search, mode: "insensitive" } } },
        { cliente: { nombre: { contains: search, mode: "insensitive" } } },
        { caso: { caratula: { contains: search, mode: "insensitive" } } },
        { caso: { nroExpte: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  return where;
}

function buildOrderBy({ orderBy, order, sort }) {
  // orderBy simple
  if (orderBy) {
    const dir = (order || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    switch (orderBy) {
      case "fechaLimite":
      case "createdAt":
      case "updatedAt":
      case "completada":
        return [{ [orderBy]: dir }];
      case "titulo":
        return [{ titulo: dir }];
      case "cliente":
        return [{ cliente: { apellido: dir } }];
      case "prioridad":
        return [{ prioridad: { nombre: dir } }];
      default:
        return [{ createdAt: "desc" }];
    }
  }

  // sort múltiple: field:dir,field2:dir2
  if (sort) {
    const parts = String(sort).split(",").map((x) => x.trim()).filter(Boolean);
    const allow = new Set(["fechaLimite", "createdAt", "updatedAt", "completada", "titulo", "cliente", "prioridad"]);
    const orderByArr = [];
    for (const p of parts) {
      const [field, dirRaw] = p.split(":");
      if (!field || !allow.has(field)) continue;
      const dir = (dirRaw || "asc").toLowerCase() === "desc" ? "desc" : "asc";
      if (field === "cliente") {
        orderByArr.push({ cliente: { apellido: dir } });
      } else if (field === "prioridad") {
        orderByArr.push({ prioridad: { nombre: dir } });
      } else {
        orderByArr.push({ [field]: dir });
      }
    }
    if (orderByArr.length) return orderByArr;
  }

  return [{ createdAt: "desc" }];
}

/* ========================= Handlers ========================= */

/**
 * GET /api/tareas
 */
export async function listar(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req);
    const where = buildWhereTareas(req.query);
    const orderBy = buildOrderBy(req.query);

    const [total, data] = await Promise.all([
      prisma.tarea.count({ where }),
      prisma.tarea.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          cliente:   { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
          caso:      { select: { id: true, nroExpte: true, caratula: true } },
          prioridad: { select: { id: true, nombre: true, codigo: true, orden: true } },
        },
      }),
    ]);

    res.json({ data, page, pageSize, total });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/tareas/:id
 * Incluye checklist (subtareas) ordenadas por 'orden'
 */
export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const tarea = await prisma.tarea.findFirst({
      where: { id, deletedAt: null },
      include: {
        cliente:   { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        caso:      { select: { id: true, nroExpte: true, caratula: true } },
        prioridad: { select: { id: true, nombre: true, codigo: true } },
      },
    });
    if (!tarea) return next({ status: 404, publicMessage: "Tarea no encontrada" });

    const items = await prisma.subTarea.findMany({
      where: { tareaId: id, deletedAt: null, activo: true },
      orderBy: [{ orden: "asc" }, { id: "asc" }],
    });

    res.json({ ...tarea, items });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/tareas
 */
export async function crear(req, res, next) {
  try {
    const dto = normalizeTareaDTO(req.body);
    if (!dto.titulo) {
      return next({ status: 400, publicMessage: "El título es requerido" });
    }

    // coherencia completadaAt
    if (dto.completada && !dto.completadaAt) dto.completadaAt = new Date();
    if (dto.completada === false) dto.completadaAt = null;

    const nuevo = await prisma.tarea.create({
      data: { ...dto, createdBy: req.user?.id ?? null },
    });

    // Items iniciales
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length) {
      // Validamos cada item con Zod (crearSubtareaSchema)
      const toCreate = [];
      for (let idx = 0; idx < items.length; idx++) {
        const parse = crearSubtareaSchema.safeParse(items[idx]);
        if (parse.success) {
          const it = { ...parse.data };
          if (it.completada === true && !it.completadaAt) it.completadaAt = new Date();
          it.orden = Number.isFinite(it.orden) ? Math.trunc(it.orden) : idx;
          toCreate.push({ ...it, tareaId: nuevo.id, createdBy: req.user?.id ?? null });
        }
      }
      if (toCreate.length) {
        await prisma.subTarea.createMany({ data: toCreate });
      }
    }

    const createdItems = await prisma.subTarea.findMany({
      where: { tareaId: nuevo.id, deletedAt: null, activo: true },
      orderBy: [{ orden: "asc" }, { id: "asc" }],
    });

    // warning por colisión de fecha
    const warnings = [];
    if (nuevo.fechaLimite) {
      const clash = await prisma.tarea.count({
        where: {
          id: { not: nuevo.id },
          deletedAt: null,
          activo: true,
          completada: false,
          fechaLimite: nuevo.fechaLimite,
        },
      });
      if (clash > 0) warnings.push("Hay otras tareas pendientes con la misma fecha límite.");
    }

    res.status(201).json({ ...nuevo, items: createdItems, warnings });
  } catch (e) {
    next(e);
  }
}

/**
 * PUT /api/tareas/:id
 */
export async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.tarea.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, completada: true },
    });
    if (!existe) return next({ status: 404, publicMessage: "Tarea no encontrada" });

    const dto = normalizeTareaDTO(req.body);
    if (dto.completada === true && !dto.completadaAt) dto.completadaAt = new Date();
    if (dto.completada === false) dto.completadaAt = null;

    const upd = await prisma.tarea.update({
      where: { id },
      data: { ...dto, updatedBy: req.user?.id ?? null },
    });

    const warnings = [];
    if (upd.fechaLimite && upd.completada === false) {
      const clash = await prisma.tarea.count({
        where: {
          id: { not: upd.id },
          deletedAt: null,
          activo: true,
          completada: false,
          fechaLimite: upd.fechaLimite,
        },
      });
      if (clash > 0) warnings.push("Hay otras tareas pendientes con la misma fecha límite.");
    }

    res.json({ ...upd, warnings });
  } catch (e) {
    next(e);
  }
}

/**
 * DELETE /api/tareas/:id (soft delete)
 */
export async function borrar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.tarea.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existe) return next({ status: 404, publicMessage: "Tarea no encontrada" });

    await prisma.tarea.update({
      where: { id },
      data: { activo: false, deletedAt: new Date(), deletedBy: req.user?.id ?? null },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

/* ========================= Subtareas / Checklist ========================= */

/** GET /api/tareas/:id/items */
export async function listItems(req, res, next) {
  try {
    const tareaId = Number(req.params.id);
    if (!Number.isInteger(tareaId)) return next({ status: 400, publicMessage: "ID inválido" });

    const items = await prisma.subTarea.findMany({
      where: { tareaId, deletedAt: null, activo: true },
      orderBy: [{ orden: "asc" }, { id: "asc" }],
    });
    res.json({ data: items });
  } catch (e) {
    next(e);
  }
}

/** POST /api/tareas/:id/items */
export async function agregarItem(req, res, next) {
  try {
    const tareaId = Number(req.params.id);
    if (!Number.isInteger(tareaId)) return next({ status: 400, publicMessage: "ID inválido" });

    const tarea = await prisma.tarea.findFirst({ where: { id: tareaId, deletedAt: null } });
    if (!tarea) return next({ status: 404, publicMessage: "Tarea no encontrada" });

    const parse = crearSubtareaSchema.safeParse(req.body);
    if (!parse.success) {
      return next({ status: 400, publicMessage: parse.error.errors.map(e => e.message).join(", ") });
    }
    const dto = { ...parse.data };

    if (dto.completada === true && !dto.completadaAt) dto.completadaAt = new Date();
    if (dto.completada === false) dto.completadaAt = null;

    if (typeof dto.orden !== "number") {
      const max = await prisma.subTarea.aggregate({ _max: { orden: true }, where: { tareaId, deletedAt: null, activo: true } });
      dto.orden = (max._max.orden ?? -1) + 1;
    } else {
      dto.orden = Math.trunc(dto.orden);
    }

    const item = await prisma.subTarea.create({
      data: { ...dto, tareaId, createdBy: req.user?.id ?? null },
    });
    res.status(201).json(item);
  } catch (e) {
    next(e);
  }
}

/** PUT /api/tareas/:id/items/:itemId */
export async function actualizarItem(req, res, next) {
  try {
    const tareaId = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(tareaId) || !Number.isInteger(itemId)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    const existe = await prisma.subTarea.findFirst({ where: { id: itemId, tareaId, deletedAt: null } });
    if (!existe) return next({ status: 404, publicMessage: "Item no encontrado" });

    const parse = actualizarSubtareaSchema.safeParse(req.body);
    if (!parse.success) {
      return next({ status: 400, publicMessage: parse.error.errors.map(e => e.message).join(", ") });
    }
    const dto = { ...parse.data };

    if (dto.completada === true && !dto.completadaAt) dto.completadaAt = new Date();
    if (dto.completada === false) dto.completadaAt = null;
    if (typeof dto.orden === "number") dto.orden = Math.trunc(dto.orden);

    const upd = await prisma.subTarea.update({
      where: { id: itemId },
      data: { ...dto, updatedBy: req.user?.id ?? null },
    });
    res.json(upd);
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/tareas/:id/items/:itemId */
export async function borrarItem(req, res, next) {
  try {
    const tareaId = Number(req.params.id);
    const itemId = Number(req.params.itemId);
    if (!Number.isInteger(tareaId) || !Number.isInteger(itemId)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    const existe = await prisma.subTarea.findFirst({ where: { id: itemId, tareaId, deletedAt: null } });
    if (!existe) return next({ status: 404, publicMessage: "Item no encontrado" });

    await prisma.subTarea.update({
      where: { id: itemId },
      data: { activo: false, deletedAt: new Date(), deletedBy: req.user?.id ?? null },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

/** POST /api/tareas/:id/items/reordenar */
export async function reordenarItems(req, res, next) {
  try {
    const tareaId = Number(req.params.id);
    if (!Number.isInteger(tareaId)) return next({ status: 400, publicMessage: "ID inválido" });

    const orden = Array.isArray(req.body?.orden) ? req.body.orden : [];
    if (!orden.length) return next({ status: 400, publicMessage: "Orden inválido" });

    const ids = orden.map((o) => Number(o.id)).filter(Number.isFinite);
    const rows = await prisma.subTarea.findMany({
      where: { tareaId, id: { in: ids }, deletedAt: null, activo: true },
      select: { id: true },
    });
    if (rows.length !== ids.length) return next({ status: 400, publicMessage: "Hay items que no pertenecen a la tarea o están eliminados" });

    await prisma.$transaction(
      orden.map((o) =>
        prisma.subTarea.update({
          where: { id: Number(o.id) },
          data: { orden: Math.trunc(Number(o.orden) || 0), updatedBy: req.user?.id ?? null },
        })
      )
    );

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

/** POST /api/tareas/:id/toggle */
export async function toggleCompleta(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const tarea = await prisma.tarea.findFirst({ where: { id, deletedAt: null } });
    if (!tarea) return next({ status: 404, publicMessage: "Tarea no encontrada" });

    const completada = !tarea.completada;
    const upd = await prisma.tarea.update({
      where: { id },
      data: {
        completada,
        completadaAt: completada ? new Date() : null,
        updatedBy: req.user?.id ?? null,
      },
    });

    res.json(upd);
  } catch (e) {
    next(e);
  }
}

/** POST /api/tareas/:id/items/:itemId/toggle */
export async function toggleItem(req, res, next) {
  try {
    const tareaId = Number(req.params.id);
    const itemId  = Number(req.params.itemId);
    if (!Number.isInteger(tareaId) || !Number.isInteger(itemId)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    const item = await prisma.subTarea.findFirst({ where: { id: itemId, tareaId, deletedAt: null, activo: true } });
    if (!item) return next({ status: 404, publicMessage: "Item no encontrado" });

    const completada = !item.completada;
    const upd = await prisma.subTarea.update({
      where: { id: itemId },
      data: {
        completada,
        completadaAt: completada ? new Date() : null,
        updatedBy: req.user?.id ?? null,
      },
    });
    res.json(upd);
  } catch (e) {
    next(e);
  }
}

/** POST /api/tareas/:id/items/completar-todo */
export async function completarTodo(req, res, next) {
  try {
    const tareaId = Number(req.params.id);
    if (!Number.isInteger(tareaId)) return next({ status: 400, publicMessage: "ID inválido" });

    const pending = await prisma.subTarea.findMany({
      where: { tareaId, completada: false, deletedAt: null, activo: true },
      select: { id: true },
    });

    if (!pending.length) return res.json({ updated: 0 });

    await prisma.$transaction(
      pending.map((it) =>
        prisma.subTarea.update({
          where: { id: it.id },
          data: { completada: true, completadaAt: new Date(), updatedBy: req.user?.id ?? null },
        })
      )
    );

    res.json({ updated: pending.length });
  } catch (e) {
    next(e);
  }
}
