// src/controllers/finanzas/gasto.controller.js
import prisma from "../../utils/prisma.js";
import { crearGastoSchema, actualizarGastoSchema } from "../../validators/finanzas/gasto.schema.js";

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
function numOrNull(v) {
  if (v === null) return null;
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
const round2 = (n) => Math.round(Number(n) * 100) / 100;

function boolFromQuery(v) {
  if (v === undefined) return undefined;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/** ¿La moneda es ARS? (por código/nombre del parámetro) */
async function isMonedaARS(monedaId) {
  if (!monedaId) return true; // si no hay, asumimos ARS por defecto
  const p = await prisma.parametro.findUnique({
    where: { id: Number(monedaId) },
    select: { codigo: true, nombre: true },
  });
  const code = (p?.codigo || "").toUpperCase();
  const name = (p?.nombre || "").toUpperCase();
  if (!code && !name) return true;
  return code === "ARS" || code.includes("PESO") || name.includes("PESO");
}

/** Busca el parámetro de Moneda 'ARS' (o 'PESOS') para default */
async function findMonedaARSId() {
  const p = await prisma.parametro.findFirst({
    where: {
      OR: [
        { codigo: { equals: "ARS", mode: "insensitive" } },
        { codigo: { equals: "PESOS", mode: "insensitive" } },
        { nombre: { contains: "PESO", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return p?.id ?? null;
}

/** Normaliza DTO para Gasto */
function normalizeGastoDTO(b = {}) {
  const out = {
    clienteId: intOrNull(b.clienteId),
    casoId: intOrNull(b.casoId),
    conceptoId: intOrNull(b.conceptoId),
    descripcion: strOrNull(b.descripcion),
    fechaGasto: toDateOrNull(b.fechaGasto),
    monto: numOrNull(b.monto),
    monedaId: intOrNull(b.monedaId),
    cotizacionARS: numOrNull(b.cotizacionARS),
    activo: b.activo === undefined ? undefined : Boolean(b.activo),
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

/** WHERE listar */
function buildWhereGastos(q = {}) {
  const where = { deletedAt: null };
  // filtros directos
  const clienteId = intOrNull(q.clienteId); if (clienteId !== undefined) where.clienteId = clienteId;
  const casoId = intOrNull(q.casoId);       if (casoId !== undefined) where.casoId = casoId;
  const conceptoId = intOrNull(q.conceptoId); if (conceptoId !== undefined) where.conceptoId = conceptoId;
  // fecha
  const from = toDateOrNull(q.from);
  const to   = toDateOrNull(q.to);
  if (from || to) {
    where.fechaGasto = {};
    if (from) where.fechaGasto.gte = from;
    if (to)   where.fechaGasto.lte = to;
  }
  // búsqueda libre básica (carátula/cliente/concepto) — ajustá si querés más campos
  const search = String(q.search || "").trim();
  if (search) {
    where.AND = (where.AND || []).concat({
      OR: [
        { caso: { caratula: { contains: search, mode: "insensitive" } } },
        { caso: { nroExpte:  { contains: search, mode: "insensitive" } } },
        { cliente:  { razonSocial: { contains: search, mode: "insensitive" } } },
        { cliente:  { apellido:    { contains: search, mode: "insensitive" } } },
        { cliente:  { nombre:      { contains: search, mode: "insensitive" } } },
        { concepto: { nombre:      { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  // por defecto: incluir true y null; excluir sólo false (como en honorarios)
  if (!("activo" in where)) where.activo = { not: false };
  return where;
}

function buildOrderBy({ orderBy, order, sort }) {
  if (orderBy) {
    const dir = (order || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    switch (orderBy) {
      case "fechaGasto":
      case "createdAt":
      case "updatedAt":
        return [{ [orderBy]: dir }];
      default:
        return [{ fechaGasto: "desc" }];
    }
  }
  if (sort) {
    const parts = String(sort).split(",").map(s => s.trim()).filter(Boolean);
    const allow = new Set(["fechaGasto","createdAt","updatedAt"]);
    const arr = [];
    for (const p of parts) {
      const [field, d] = p.split(":");
      if (!field || !allow.has(field)) continue;
      arr.push({ [field]: (d || "desc").toLowerCase() === "asc" ? "asc" : "desc" });
    }
    if (arr.length) return arr;
  }
  return [{ fechaGasto: "desc" }];
}

/** Equivalencia a ARS para una fila */
function computeMontoARSRow(g) {
  const esARS = !g.monedaId ? true : undefined; // se corrige abajo si hay moneda cargada
  const cotz = Number(g.cotizacionARS || 0) || null;
  const monto = Number(g.monto || 0);
  const montoARS = cotz ? round2(monto * cotz) : round2(monto); // si no hay cotz asumimos ARS
  return { esARS: esARS ?? undefined, cotizacionARS: cotz, montoARS };
}

/** Suma aplicaciones activas por gasto (ARS) */
async function sumAplicadoPorGastoMap(gastoIds = []) {
  if (!Array.isArray(gastoIds) || gastoIds.length === 0) return {};
  const rows = await prisma.ingresoGasto.groupBy({
    by: ["gastoId"],
    where: { gastoId: { in: gastoIds }, deletedAt: null, activo: true },
    _sum: { montoAplicadoARS: true },
  });
  return Object.fromEntries(rows.map(r => [r.gastoId, Number(r._sum.montoAplicadoARS || 0)]));
}
async function sumAplicadoPorGasto(gastoId) {
  const rows = await prisma.ingresoGasto.aggregate({
    _sum: { montoAplicadoARS: true },
    where: { gastoId, deletedAt: null, activo: true },
  });
  return Number(rows._sum.montoAplicadoARS || 0);
}

/* ========================= Handlers ========================= */

/** GET /api/finanzas/gastos */
export async function listar(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req);
    const where = buildWhereGastos(req.query);
    const orderBy = buildOrderBy(req.query);
    const soloPend = boolFromQuery(req.query.soloPendientes);

    const [total, rows] = await Promise.all([
      prisma.gasto.count({ where }),
      prisma.gasto.findMany({
        where, orderBy, skip, take,
        include: {
          cliente:  { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
          caso:     { select: { id: true, nroExpte: true, caratula: true } },
          concepto: { select: { id: true, nombre: true, codigo: true } },
          moneda:   { select: { id: true, nombre: true, codigo: true } },
        },
      }),
    ]);

    const ids = rows.map(g => g.id);
    const aplicadoMap = await sumAplicadoPorGastoMap(ids);

    let data = rows.map(g => {
      const calc = computeMontoARSRow(g);
      const aplicadoARS = Number(aplicadoMap[g.id] || 0);
      const saldoARS = round2((calc.montoARS || 0) - aplicadoARS);
      return { ...g, calc, aplicadoARS, saldoARS };
    });

    if (soloPend === true) {
      data = data.filter(r => r.saldoARS > 0.009);
    }

    res.json({ data, page, pageSize, total });
  } catch (e) {
    next(e);
  }
}

/** GET /api/finanzas/gastos/:id */
export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const row = await prisma.gasto.findFirst({
      where: { id, deletedAt: null },
      include: {
        cliente:  { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        caso:     { select: { id: true, nroExpte: true, caratula: true } },
        concepto: { select: { id: true, nombre: true, codigo: true } },
        moneda:   { select: { id: true, nombre: true, codigo: true } },
        aplicaciones: {
          where: { deletedAt: null, activo: true },
          select: {
            id: true,
            fechaAplicacion: true,
            montoAplicadoARS: true,
            ingreso: {
              select: {
                id: true,
                fechaIngreso: true,
                monto: true,
              },
            },
          },
          orderBy: { fechaAplicacion: "desc" },
        },
      },
    });
    if (!row) return next({ status: 404, publicMessage: "Gasto no encontrado" });

    const calc = computeMontoARSRow(row);
    const aplicadoARS = await sumAplicadoPorGasto(id);
    const saldoARS = round2((calc.montoARS || 0) - aplicadoARS);

    res.json({ ...row, calc, aplicadoARS, saldoARS });
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/finanzas/gastos
 * Reglas:
 *  - clienteId, monto>0, fechaGasto: requeridos por Zod
 *  - monedaId: si no viene, default ARS
 *  - si moneda != ARS y no envían cotizacionARS -> se guarda null y devolvemos warning
 */
export async function crear(req, res, next) {
  try {
    const parsed = crearGastoSchema.safeParse(req.body);
    if (!parsed.success) {
      return next({ status: 400, publicMessage: parsed.error.errors.map(e => e.message).join(", ") });
    }

    const base = normalizeGastoDTO(parsed.data);

    // Moneda default ARS si no viene
    if (!base.monedaId) {
      const arsId = await findMonedaARSId();
      if (arsId) base.monedaId = arsId;
    }

    const esARS = await isMonedaARS(base.monedaId);
    const warnings = [];

    // cotización: usar 1 para ARS (en DB guardamos cotización solo si !ARS)
    let cotizacionARS = null;
    if (!esARS) {
      cotizacionARS = typeof base.cotizacionARS === "number" && base.cotizacionARS > 0 ? base.cotizacionARS : null;
      if (!cotizacionARS) warnings.push("No se informó cotización a ARS para este gasto en moneda extranjera.");
    }

    const nuevo = await prisma.gasto.create({
      data: {
        ...base,
        cotizacionARS, // null si ARS o si no vino para moneda extranjera
        createdBy: req.user?.id ?? null,
      },
      include: {
        cliente:  { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        caso:     { select: { id: true, nroExpte: true, caratula: true } },
        concepto: { select: { id: true, nombre: true, codigo: true } },
        moneda:   { select: { id: true, nombre: true, codigo: true } },
      },
    });

    const calc = computeMontoARSRow(nuevo);
    // recién creado → aplicado=0
    res.status(201).json({ ...nuevo, calc, aplicadoARS: 0, saldoARS: calc.montoARS ?? 0, warnings });
  } catch (e) {
    next(e);
  }
}

/**
 * PUT /api/finanzas/gastos/:id
 * Si cambian monto/monedaId/cotizacionARS, recalculamos equivalencia para la respuesta (no persiste nada extra).
 * En DB:
 *  - Si moneda es ARS ⇒ guardamos cotizacionARS = null
 *  - Si moneda != ARS ⇒ guardamos cotizacionARS > 0 (o null si no mandan)
 */
export async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.gasto.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, monedaId: true },
    });
    if (!existe) return next({ status: 404, publicMessage: "Gasto no encontrado" });

    const parsed = actualizarGastoSchema.safeParse(req.body);
    if (!parsed.success) {
      return next({ status: 400, publicMessage: parsed.error.errors.map(e => e.message).join(", ") });
    }

    const dto = normalizeGastoDTO(parsed.data);

    // normalizar moneda + cotización
    const esARS = await isMonedaARS(dto.monedaId ?? existe.monedaId);
    if (esARS) {
      dto.cotizacionARS = null;
    } else if (dto.cotizacionARS != null && !(dto.cotizacionARS > 0)) {
      dto.cotizacionARS = null;
    }

    const upd = await prisma.gasto.update({
      where: { id },
      data: { ...dto, updatedBy: req.user?.id ?? null },
      include: {
        cliente:  { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        caso:     { select: { id: true, nroExpte: true, caratula: true } },
        concepto: { select: { id: true, nombre: true, codigo: true } },
        moneda:   { select: { id: true, nombre: true, codigo: true } },
      },
    });

    const calc = computeMontoARSRow(upd);
    const aplicadoARS = await sumAplicadoPorGasto(id);
    const saldoARS = round2((calc.montoARS || 0) - aplicadoARS);

    res.json({ ...upd, calc, aplicadoARS, saldoARS });
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/finanzas/gastos/:id */
export async function borrar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.gasto.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existe) return next({ status: 404, publicMessage: "Gasto no encontrado" });

    await prisma.gasto.update({
      where: { id },
      data: { activo: false, deletedAt: new Date(), deletedBy: req.user?.id ?? null },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}
