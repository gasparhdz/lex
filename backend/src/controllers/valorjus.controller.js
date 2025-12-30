// src/controllers/valorjus.controller.js
import prisma from "../utils/prisma.js";

/* ========================= Helpers ========================= */
function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? "20", 10)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
function toDateOrNull(v) {
  if (v === null) return null;
  if (!v && v !== 0) return undefined;
  try {
    let d = new Date(v);
    if (isNaN(d.getTime())) return undefined;
    
    // Normalizar fecha a medianoche en zona horaria local para evitar problemas de unicidad
    // Si es una fecha en formato YYYY-MM-DD, crear una fecha local a medianoche
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())) {
      // Formato YYYY-MM-DD: crear fecha local a medianoche
      const [year, month, day] = v.trim().split('-').map(Number);
      d = new Date(year, month - 1, day, 0, 0, 0, 0); // mes - 1 porque JS cuenta meses desde 0
    } else {
      // Para otros formatos, normalizar a medianoche local
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    }
    
    return d;
  } catch {
    return undefined;
  }
}
function numOrNull(v) {
  if (v === null) return null;
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function buildOrderBy({ orderBy, order }) {
  const dir = (order || "desc").toLowerCase() === "asc" ? "asc" : "desc";
  switch (orderBy) {
    case "createdAt":
    case "updatedAt":
      return [{ [orderBy]: dir }];
    default:
      return [{ fecha: dir }]; // default
  }
}

/* ========================= Handlers ========================= */

/** GET /api/valorjus/actual  -> { valor, fecha } (último por fecha) */
export async function actual(req, res, next) {
  try {
    const row = await prisma.valorJUS.findFirst({
      where: { deletedAt: null, activo: true },
      orderBy: { fecha: "desc" },
      select: { valor: true, fecha: true },
    });
    if (!row) return next({ status: 404, publicMessage: "No hay Valor JUS cargado" });
    res.json({ valor: Number(row.valor), fecha: row.fecha.toISOString() });
  } catch (e) { next(e); }
}

/** GET /api/valorjus  -> lista paginada */
export async function listar(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req);
    const orderBy = buildOrderBy(req.query);

    const where = { deletedAt: null };
    const from = toDateOrNull(req.query.from);
    const to = toDateOrNull(req.query.to);
    if (from || to) {
      where.fecha = {};
      if (from) where.fecha.gte = from;
      if (to) where.fecha.lte = to;
    }

    const [total, data] = await Promise.all([
      prisma.valorJUS.count({ where }),
      prisma.valorJUS.findMany({ where, orderBy, skip, take }),
    ]);

    // normalizar Decimals a number para el front
    const rows = data.map(r => ({ ...r, valor: Number(r.valor) }));
    res.json({ data: rows, total, page, pageSize });
  } catch (e) { next(e); }
}

/** GET /api/valorjus/:id */
export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const row = await prisma.valorJUS.findFirst({
      where: { id, deletedAt: null },
    });
    if (!row) return next({ status: 404, publicMessage: "Valor JUS no encontrado" });
    res.json({ ...row, valor: Number(row.valor) });
  } catch (e) { next(e); }
}

/** POST /api/valorjus  body: { valor, fecha } */
export async function crear(req, res, next) {
  try {
    const valor = numOrNull(req.body?.valor);
    const fecha = toDateOrNull(req.body?.fecha);
    if (valor === undefined || valor <= 0) {
      return next({ status: 400, publicMessage: "El campo 'valor' es requerido y debe ser > 0" });
    }
    if (!fecha) {
      return next({ status: 400, publicMessage: "El campo 'fecha' es requerido (YYYY-MM-DD)" });
    }

    const nuevo = await prisma.valorJUS.create({
      data: {
        valor,
        fecha,
        createdBy: req.user?.id ?? null,
      },
    });
    res.status(201).json({ ...nuevo, valor: Number(nuevo.valor) });
  } catch (e) {
    // Unique(fecha)
    if (e?.code === "P2002") {
      return next({ status: 400, publicMessage: "Ya existe un Valor JUS para esa fecha" });
    }
    next(e);
  }
}

/** PUT /api/valorjus/:id  body: { valor?, fecha? } */
export async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.valorJUS.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existe) return next({ status: 404, publicMessage: "Valor JUS no encontrado" });

    const valor = numOrNull(req.body?.valor);
    const fecha = toDateOrNull(req.body?.fecha);

    const upd = await prisma.valorJUS.update({
      where: { id },
      data: {
        ...(valor !== undefined ? { valor } : {}),
        ...(fecha !== undefined ? { fecha } : {}),
        updatedBy: req.user?.id ?? null,
      },
    });
    res.json({ ...upd, valor: Number(upd.valor) });
  } catch (e) {
    if (e?.code === "P2002") {
      return next({ status: 400, publicMessage: "Ya existe un Valor JUS para esa fecha" });
    }
    next(e);
  }
}

/** DELETE /api/valorjus/:id  (soft delete) */
export async function borrar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.valorJUS.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existe) return next({ status: 404, publicMessage: "Valor JUS no encontrado" });

    await prisma.valorJUS.update({
      where: { id },
      data: { activo: false, deletedAt: new Date(), deletedBy: req.user?.id ?? null },
    });
    res.status(204).end();
  } catch (e) { next(e); }
}

/** GET /api/valorjus/por-fecha?fecha=YYYY-MM-DD  -> { valor, fecha } */
export async function porFecha(req, res, next) {
  try {
    const qf = req.query?.fecha;
    const d = qf ? new Date(qf) : null;
    const whereBase = { deletedAt: null, activo: true };

    let row = d
      ? await prisma.valorJUS.findFirst({
          where: { ...whereBase, fecha: { lte: d } },
          orderBy: { fecha: "desc" },
          select: { valor: true, fecha: true },
        })
      : null;

    if (!row) {
      row = await prisma.valorJUS.findFirst({
        where: whereBase,
        orderBy: { fecha: "desc" },
        select: { valor: true, fecha: true },
      });
    }
    if (!row) return next({ status: 404, publicMessage: "No hay Valor JUS cargado" });

    res.json({ valor: Number(row.valor), fecha: row.fecha.toISOString().slice(0,10) });
  } catch (e) { next(e); }
}