import prisma from "../utils/prisma.js";
import { Prisma } from "@prisma/client";

/* ========================= Helpers ========================= */
function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? "20", 10)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function tokenize(search) {
  return String(search || "")
    .trim()
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function intOrUndef(v) {
  if (v === undefined || v === null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function strOrUndef(v) {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s === "" ? undefined : s;
}
function dateOrUndef(v) {
  if (!v && v !== 0) return undefined;
  try {
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
  } catch {
    return undefined;
  }
}

/** Normaliza body de Evento para create/update */
function mapEventoDTO(b = {}) {
  const out = {
    clienteId: intOrUndef(b.clienteId),
    casoId: intOrUndef(b.casoId),
    fechaInicio: dateOrUndef(b.fechaInicio),
    fechaFin: dateOrUndef(b.fechaFin),
    allDay: b.allDay === undefined ? undefined : Boolean(b.allDay),
    timezone: strOrUndef(b.timezone),
    tipoId: intOrUndef(b.tipoId),
    estadoId: intOrUndef(b.estadoId),
    descripcion: strOrUndef(b.descripcion),
    observaciones: strOrUndef(b.observaciones),
    recordatorio: dateOrUndef(b.recordatorio),
    notificadoACliente: b.notificadoACliente === undefined ? undefined : Boolean(b.notificadoACliente),
    ubicacion: strOrUndef(b.ubicacion),
    activo: b.activo === undefined ? undefined : Boolean(b.activo),
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

/** Filtro por rango (solapamiento si viene from y to) + otros filtros */
function buildWhereEventos({ search, from, to, tipoId, estadoId, clienteId, casoId, incluirInactivos }) {
  const tokens = tokenize(search);
  const where = { deletedAt: null, ...(incluirInactivos ? {} : { activo: true }) };

  // Rango temporal
  const dFrom = dateOrUndef(from);
  const dTo = dateOrUndef(to);
  if (dFrom && dTo) {
    // Eventos que se SOLAPAN con [from, to]
    where.AND = [
      ...(where.AND || []),
      { fechaInicio: { lt: dTo } },
      { OR: [{ fechaFin: null }, { fechaFin: { gt: dFrom } }] },
    ];
  } else if (dFrom) {
    // A partir de 'from' (inicio >= from O fin >= from)
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { fechaInicio: { gte: dFrom } },
          { fechaFin: { gte: dFrom } },
          { fechaFin: null }, // eventos sin fin (puntuales) a partir de from si inicio >= from (ya cubierto arriba)
        ],
      },
    ];
  } else if (dTo) {
    // Hasta 'to' (inicio < to)
    where.AND = [...(where.AND || []), { fechaInicio: { lt: dTo } }];
  }

  // Filtros por ids
  if (Number.isFinite(Number(tipoId))) where.tipoId = Number(tipoId);
  if (Number.isFinite(Number(estadoId))) where.estadoId = Number(estadoId);
  if (Number.isFinite(Number(clienteId))) where.clienteId = Number(clienteId);
  if (Number.isFinite(Number(casoId))) where.casoId = Number(casoId);

  // Búsqueda por texto
  if (tokens.length) {
    where.AND = [
      ...(where.AND || []),
      ...tokens.map((s) => ({
        OR: [
          { descripcion: { contains: s, mode: "insensitive" } },
          { observaciones: { contains: s, mode: "insensitive" } },
          { ubicacion: { contains: s, mode: "insensitive" } },

          { tipo: { nombre: { contains: s, mode: "insensitive" } } },
          { estado: { nombre: { contains: s, mode: "insensitive" } } },

          { cliente: { razonSocial: { contains: s, mode: "insensitive" } } },
          { cliente: { apellido: { contains: s, mode: "insensitive" } } },
          { cliente: { nombre: { contains: s, mode: "insensitive" } } },

          { caso: { caratula: { contains: s, mode: "insensitive" } } },
          { caso: { nroExpte: { contains: s, mode: "insensitive" } } },
        ],
      })),
    ];
  }

  return where;
}

function buildOrderBy({ orderBy, order, sort }) {
  // orderBy simple
  if (orderBy) {
    const dir = (order || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    switch (orderBy) {
      case "fechaInicio":
      case "createdAt":
        return [{ [orderBy]: dir }];
      default:
        return [{ fechaInicio: "asc" }];
    }
  }

  // sort compuesto: field:dir,field2:dir
  if (sort) {
    const allow = new Set(["fechaInicio", "createdAt"]);
    const orderByArr = [];
    const parts = String(sort)
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    for (const p of parts) {
      const [field, dirRaw] = p.split(":");
      if (!field || !allow.has(field)) continue;
      const dir = (dirRaw || "asc").toLowerCase() === "desc" ? "desc" : "asc";
      orderByArr.push({ [field]: dir });
    }
    if (orderByArr.length) return orderByArr;
  }

  return [{ fechaInicio: "asc" }];
}

function overlapWhere({ inicio, fin, excludeId }) {
  // [inicio, fin] solapa si: start < fin && end > inicio
  const base = {
    deletedAt: null,
    activo: true,
    fechaInicio: { lt: fin },
    OR: [{ fechaFin: null }, { fechaFin: { gt: inicio } }],
  };
  if (excludeId) base["id"] = { not: excludeId };
  return base;
}

/* ========================= Handlers ========================= */

/**
 * GET /api/eventos
 * Soporta:
 *  - from=YYYY-MM-DD, to=YYYY-MM-DD → solapamiento con rango
 *  - clienteId, casoId, tipoId, estadoId
 *  - search=texto
 *  - activo=false → incluye inactivos
 *  - page, pageSize
 *  - orderBy=fechaInicio|createdAt & order=asc|desc  (o sort=field:dir,field2:dir)
 */
export async function listar(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req);

    const where = buildWhereEventos({
      search: req.query.search,
      from: req.query.from,
      to: req.query.to,
      tipoId: req.query.tipoId,
      estadoId: req.query.estadoId,
      clienteId: req.query.clienteId,
      casoId: req.query.casoId,
      incluirInactivos: String(req.query.activo ?? "true").toLowerCase() === "false",
    });

    const orderBy = buildOrderBy({
      orderBy: req.query.orderBy,
      order: req.query.order,
      sort: req.query.sort,
    });

    const [total, data] = await Promise.all([
      prisma.evento.count({ where }),
      prisma.evento.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          tipo: { select: { id: true, nombre: true, codigo: true } },
          estado: { select: { id: true, nombre: true, codigo: true} },
          cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
          caso: { select: { id: true, nroExpte: true, caratula: true } },
        },
      }),
    ]);

    res.json({ data, page, pageSize, total });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/eventos/:id
 */
export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const evento = await prisma.evento.findFirst({
      where: { id, deletedAt: null },
      include: {
        tipo: { select: { id: true, codigo: true, nombre: true } },
        estado: { select: { id: true, codigo: true, nombre: true } },
        cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        caso: { select: { id: true, nroExpte: true, caratula: true } },
      },
    });
    if (!evento) return next({ status: 404, publicMessage: "Evento no encontrado" });
    res.json(evento);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/eventos
 */
export async function crear(req, res, next) {
  try {
    const dto = mapEventoDTO(req.body);

    if (!(dto.tipoId && dto.fechaInicio)) {
      return next({ status: 400, publicMessage: "tipoId y fechaInicio son requeridos" });
    }
    if (dto.fechaFin && dto.fechaInicio && dto.fechaFin < dto.fechaInicio) {
      dto.fechaFin = dto.fechaInicio;
    }

    const nuevo = await prisma.evento.create({
      data: { ...dto, createdBy: req.user?.id ?? null },
    });

    // Advertencia de solapamiento (no bloquea)
    const fin = nuevo.fechaFin ?? nuevo.fechaInicio;
    const overlaps = await prisma.evento.count({
      where: overlapWhere({ inicio: nuevo.fechaInicio, fin }),
    });
    const warnings = overlaps > 1 ? ["Hay otros eventos que se solapan en ese rango."] : [];

    res.status(201).json({ ...nuevo, warnings });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : "campo único";
      return next({ status: 409, publicMessage: `Ya existe un evento con ese ${target}` });
    }
    next(e);
  }
}

/**
 * PUT /api/eventos/:id
 */
export async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.evento.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, fechaInicio: true, fechaFin: true },
    });
    if (!existe) return next({ status: 404, publicMessage: "Evento no encontrado" });

    const dto = mapEventoDTO(req.body);
    if (dto.fechaFin && dto.fechaInicio && dto.fechaFin < dto.fechaInicio) {
      dto.fechaFin = dto.fechaInicio;
    }

    const upd = await prisma.evento.update({
      where: { id },
      data: { ...dto, updatedBy: req.user?.id ?? null },
    });

    // Advertencia solapamiento post-update
    const inicio = upd.fechaInicio;
    const fin = upd.fechaFin ?? upd.fechaInicio;
    const overlaps = await prisma.evento.count({
      where: overlapWhere({ inicio, fin, excludeId: upd.id }),
    });
    const warnings = overlaps > 0 ? ["Hay otros eventos que se solapan en ese rango."] : [];

    res.json({ ...upd, warnings });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : "campo único";
      return next({ status: 409, publicMessage: `Ya existe un evento con ese ${target}` });
    }
    next(e);
  }
}

/**
 * DELETE /api/eventos/:id (soft delete)
 */
export async function borrar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.evento.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existe) return next({ status: 404, publicMessage: "Evento no encontrado" });

    await prisma.evento.update({
      where: { id },
      data: { activo: false, deletedAt: new Date(), deletedBy: req.user?.id ?? null },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}
