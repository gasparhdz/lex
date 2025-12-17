// src/controllers/finanzas/plan-pago.controller.js
import prisma from "../../utils/prisma.js";
import {
  crearPlanSchema,
  actualizarPlanSchema,
  crearCuotaSchema,
  actualizarCuotaSchema,
  generarCuotasSchema,
} from "../../validators/finanzas/plan-pago.schema.js";

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
function boolOrNull(v) {
  if (v === null) return null;
  if (v === undefined || v === "") return undefined;
  const s = String(v).toLowerCase();
  if (["true", "1", "t", "yes", "y"].includes(s)) return true;
  if (["false", "0", "f", "no", "n"].includes(s)) return false;
  return undefined;
}

const upper = (s) => (s ? String(s).trim().toUpperCase() : "");

/** Busca snapshot de ValorJUS para una fecha (o el último disponible si no hay para esa fecha) */
async function findValorJusSnapshot(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  let row = await prisma.valorJUS.findFirst({
    where: { deletedAt: null, activo: true, fecha: { lte: d } },
    orderBy: { fecha: "desc" },
  });
  if (!row) row = await prisma.valorJUS.findFirst({
    where: { deletedAt: null, activo: true },
    orderBy: { fecha: "desc" },
  });
  return row?.valor ?? null;
}

/** Suma de montos de cuotas (JUS / Pesos) y contadores por estado */
function aggCuotas(cuotas = []) {
  let totalJus = 0, totalPesos = 0;
  let pendientes = 0, pagadas = 0, vencidas = 0, condonadas = 0;
  const hoy = new Date();

  for (const c of cuotas) {
    totalJus += Number(c.montoJus ?? 0);
    totalPesos += Number(c.montoPesos ?? 0);

    const code = upper(c.estado?.codigo || c.estadoCodigo || "");
    if (code === "PAGADA") pagadas++;
    else if (code === "CONDONADA") condonadas++;
    else if (code === "PENDIENTE") {
      // si está vencida por fecha
      if (c.vencimiento && new Date(c.vencimiento) < hoy) vencidas++;
      else pendientes++;
    } else {
      // si no hay estado, inferimos por fecha
      if (c.vencimiento && new Date(c.vencimiento) < hoy) vencidas++;
      else pendientes++;
    }
  }
  return { totalJus, totalPesos, pendientes, pagadas, vencidas, condonadas };
}

/** Normaliza body Plan */
function normalizePlanDTO(b = {}) {
  const out = {
    honorarioId: intOrNull(b.honorarioId),
    clienteId: intOrNull(b.clienteId),
    casoId: intOrNull(b.casoId),
    descripcion: strOrNull(b.descripcion),
    fechaInicio: toDateOrNull(b.fechaInicio),
    periodicidadId: intOrNull(b.periodicidadId),
    politicaJusId: intOrNull(b.politicaJusId),
    montoCuotaJus: numOrNull(b.montoCuotaJus),
    montoCuotaPesos: numOrNull(b.montoCuotaPesos),
    valorJusRef: numOrNull(b.valorJusRef),
    activo: b.activo === undefined ? undefined : Boolean(b.activo),
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

/** Normaliza body Cuota */
function normalizeCuotaDTO(b = {}) {
  const out = {
    planId: intOrNull(b.planId),
    numero: intOrNull(b.numero),
    vencimiento: toDateOrNull(b.vencimiento),
    montoJus: numOrNull(b.montoJus),
    montoPesos: numOrNull(b.montoPesos),
    valorJusRef: numOrNull(b.valorJusRef),
    estadoId: intOrNull(b.estadoId),
    observacion: strOrNull(b.observacion),
    activo: b.activo === undefined ? undefined : Boolean(b.activo),
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

/** WHERE dinámico para listar planes */
function buildWherePlanes(q = {}) {
  const where = { deletedAt: null, activo: true };
  const honorarioId = intOrNull(q.honorarioId);
  if (honorarioId !== undefined) where.honorarioId = honorarioId;

  const clienteId = intOrNull(q.clienteId);
  if (clienteId !== undefined) where.clienteId = clienteId;

  const casoId = intOrNull(q.casoId);
  if (casoId !== undefined) where.casoId = casoId;

  const from = toDateOrNull(q.from);
  const to = toDateOrNull(q.to);
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = from;
    if (to) where.createdAt.lte = to;
  }

  const search = String(q.search || "").trim();
  if (search) {
    where.AND = (where.AND || []).concat({
      OR: [
        { descripcion: { contains: search, mode: "insensitive" } },
        { honorario: { caso: { caratula: { contains: search, mode: "insensitive" } } } },
        { honorario: { caso: { nroExpte: { contains: search, mode: "insensitive" } } } },
        { honorario: { cliente: { razonSocial: { contains: search, mode: "insensitive" } } } },
        { honorario: { cliente: { apellido: { contains: search, mode: "insensitive" } } } },
        { honorario: { cliente: { nombre: { contains: search, mode: "insensitive" } } } },
      ],
    });
  }
  return where;
}
function buildOrderBy({ orderBy, order, sort }) {
  if (orderBy) {
    const dir = (order || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    switch (orderBy) {
      case "createdAt":
      case "updatedAt":
      case "fechaInicio":
        return [{ [orderBy]: dir }];
      default:
        return [{ createdAt: "desc" }];
    }
  }
  if (sort) {
    const parts = String(sort).split(",").map((x) => x.trim()).filter(Boolean);
    const allow = new Set(["createdAt", "updatedAt", "fechaInicio"]);
    const orderByArr = [];
    for (const p of parts) {
      const [field, dirRaw] = p.split(":");
      if (!field || !allow.has(field)) continue;
      const dir = (dirRaw || "asc").toLowerCase() === "desc" ? "desc" : "asc";
      orderByArr.push({ [field]: dir });
    }
    if (orderByArr.length) return orderByArr;
  }
  return [{ createdAt: "desc" }];
}

/** Suma cuotas por planId (para listar sin traer todas) */
async function aggCuotasByPlan(planIds = []) {
  if (!planIds.length) return {};
  const rows = await prisma.planCuota.groupBy({
    by: ["planId"],
    where: { planId: { in: planIds }, deletedAt: null, activo: true },
    _sum: { montoJus: true, montoPesos: true },
  });
  const out = {};
  rows.forEach((r) => {
    out[r.planId] = {
      totalJus: Number(r._sum.montoJus || 0),
      totalPesos: Number(r._sum.montoPesos || 0),
    };
  });
  return out;
}

/** Lee Parametro periodicidad y devuelve una función “addNext(date)” */
function makePeriodAdder(parametro) {
  const code = upper(parametro?.codigo || parametro?.nombre || "");
  const addDays = (d, days) => {
    const nd = new Date(d);
    nd.setDate(nd.getDate() + days);
    return nd;
  };
  const addMonths = (d, months) => {
    const nd = new Date(d);
    const day = nd.getDate();
    nd.setMonth(nd.getMonth() + months);
    // auto-ajuste de JS para fin de mes, lo dejamos así.
    // Si quisieras “último día de mes”, se puede reforzar acá.
    return nd;
  };

  if (["D", "DIA", "DIARIO"].includes(code)) return (d) => addDays(d, 1);
  if (["W", "SEMANA", "SEMANAL"].includes(code)) return (d) => addDays(d, 7);
  if (["Q", "QUINCENAL", "QUINCENA"].includes(code)) return (d) => addDays(d, 15);
  if (["BIMENSUAL", "2M"].includes(code)) return (d) => addMonths(d, 2);
  if (["TRIMESTRAL", "3M"].includes(code)) return (d) => addMonths(d, 3);
  if (["CUATRIMESTRAL", "4M"].includes(code)) return (d) => addMonths(d, 4);
  if (["SEMESTRAL", "6M"].includes(code)) return (d) => addMonths(d, 6);
  if (["ANUAL", "12M", "Y"].includes(code)) return (d) => addMonths(d, 12);
  // Default mensual
  return (d) => addMonths(d, 1);
}

/* ========================= Planes: handlers ========================= */

/** GET /api/planes */
export async function listarPlanes(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req);
    const where = buildWherePlanes(req.query);
    const orderBy = buildOrderBy(req.query);

    const [total, data] = await Promise.all([
      prisma.planPago.count({ where }),
      prisma.planPago.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          honorario: {
            select: {
              id: true, jus: true, montoPesos: true, valorJusRef: true, fechaRegulacion: true,
              cliente: { select: { id: true, nombre: true, apellido: true, razonSocial: true } },
              caso: { select: { id: true, nroExpte: true, caratula: true } },
            },
          },
          periodicidad: { select: { id: true, codigo: true, nombre: true } },
        },
      }),
    ]);

    const ids = data.map((p) => p.id);
    const sums = await aggCuotasByPlan(ids);

    const enriched = data.map((p) => ({
      ...p,
      agg: { totalJus: sums[p.id]?.totalJus || 0, totalPesos: sums[p.id]?.totalPesos || 0 },
    }));

    res.json({ data: enriched, page, pageSize, total });
  } catch (e) {
    next(e);
  }
}

/** GET /api/planes/:id (con cuotas ordenadas y agregados) */
export async function obtenerPlan(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const plan = await prisma.planPago.findFirst({
      where: { id, deletedAt: null },
      include: {
        honorario: {
          select: {
            id: true, jus: true, montoPesos: true, valorJusRef: true, fechaRegulacion: true,
            cliente: { select: { id: true, nombre: true, apellido: true, razonSocial: true } },
            caso: { select: { id: true, nroExpte: true, caratula: true } },
          },
        },
        periodicidad: { select: { id: true, codigo: true, nombre: true } },
      },
    });
    if (!plan) return next({ status: 404, publicMessage: "Plan no encontrado" });

    const cuotas = await prisma.planCuota.findMany({
      where: { planId: id, deletedAt: null, activo: true },
      orderBy: [{ numero: "asc" }, { vencimiento: "asc" }, { id: "asc" }],
      include: {
        estado: { select: { id: true, codigo: true, nombre: true } },
      },
    });

    const agg = aggCuotas(cuotas);
    res.json({ ...plan, cuotas, agg });
  } catch (e) {
    next(e);
  }
}

/** POST /api/planes */
export async function crearPlan(req, res, next) {
  try {
    const parse = crearPlanSchema.safeParse(req.body);
    if (!parse.success) {
      return next({ status: 400, publicMessage: parse.error.errors.map((e) => e.message).join(", ") });
    }
    const dto = normalizePlanDTO(parse.data);

    // Defaults: clienteId/casoId desde honorario si no vinieron
    const h = await prisma.honorario.findFirst({
      where: { id: dto.honorarioId, deletedAt: null },
      select: { id: true, clienteId: true, casoId: true, valorJusRef: true },
    });
    if (!h) return next({ status: 404, publicMessage: "Honorario asociado no existe" });
    if (!dto.clienteId && h.clienteId) dto.clienteId = h.clienteId;
    if (!dto.casoId && h.casoId) dto.casoId = h.casoId;

    // valorJusRef: si la cuota base está en JUS y no vino snapshot, tomarlo según política del plan
    const hasJus = dto.montoCuotaJus != null && Number(dto.montoCuotaJus) > 0;
    if (hasJus && (dto.valorJusRef == null)) {
      const poli = Number(dto.politicaJusId || 168); // default: FECHA_REGULACION
      let vj = null;
      if (poli === 169) {
        // AL_COBRO (169): usar el valor actual
        const row = await prisma.valorJUS.findFirst({
          where: { deletedAt: null, activo: true },
          orderBy: { fecha: "desc" },
          select: { valor: true },
        });
        vj = row?.valor ?? null;
      } else {
        // FECHA_REGULACION (168): usar la fecha de inicio del plan
        vj = await findValorJusSnapshot(dto.fechaInicio || new Date());
      }
      if (vj) dto.valorJusRef = vj;
    }

    const nuevo = await prisma.planPago.create({
      data: { ...dto, createdBy: req.user?.id ?? null },
      include: {
        honorario: {
          select: {
            id: true, jus: true, montoPesos: true, valorJusRef: true, fechaRegulacion: true,
            cliente: { select: { id: true, nombre: true, apellido: true, razonSocial: true } },
            caso: { select: { id: true, nroExpte: true, caratula: true } },
          },
        },
        periodicidad: { select: { id: true, codigo: true, nombre: true } },
      },
    });

    res.status(201).json(nuevo);
  } catch (e) {
    next(e);
  }
}

/** PUT /api/planes/:id */
export async function actualizarPlan(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.planPago.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existe) return next({ status: 404, publicMessage: "Plan no encontrado" });

    const parse = actualizarPlanSchema.safeParse(req.body);
    if (!parse.success) {
      return next({ status: 400, publicMessage: parse.error.errors.map((e) => e.message).join(", ") });
    }
    const dto = normalizePlanDTO(parse.data);

    // Si ahora pasan montoCuotaJus y no hay valorJusRef, tratar de setear snapshot
    const setsJus = Object.prototype.hasOwnProperty.call(dto, "montoCuotaJus") && dto.montoCuotaJus != null && Number(dto.montoCuotaJus) > 0;
    if (setsJus && (dto.valorJusRef == null)) {
      const planPrev = await prisma.planPago.findUnique({ where: { id }, select: { fechaInicio: true } });
      const vj = await findValorJusSnapshot(dto.fechaInicio || planPrev?.fechaInicio || new Date());
      if (vj) dto.valorJusRef = vj;
    }

    const upd = await prisma.planPago.update({
      where: { id },
      data: { ...dto, updatedBy: req.user?.id ?? null },
      include: {
        honorario: {
          select: {
            id: true, jus: true, montoPesos: true, valorJusRef: true, fechaRegulacion: true,
            cliente: { select: { id: true, nombre: true, apellido: true, razonSocial: true } },
            caso: { select: { id: true, nroExpte: true, caratula: true } },
          },
        },
        periodicidad: { select: { id: true, codigo: true, nombre: true } },
      },
    });

    res.json(upd);
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/planes/:id (soft delete) */
export async function borrarPlan(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.planPago.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existe) return next({ status: 404, publicMessage: "Plan no encontrado" });

    await prisma.planPago.update({
      where: { id },
      data: { activo: false, deletedAt: new Date(), deletedBy: req.user?.id ?? null },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

/* ========================= Cuotas: handlers ========================= */

/** GET /api/planes/:id/cuotas */
export async function listCuotas(req, res, next) {
  try {
    const planId = Number(req.params.id);
    if (!Number.isInteger(planId)) return next({ status: 400, publicMessage: "ID inválido" });

    const cuotas = await prisma.planCuota.findMany({
      where: { planId, deletedAt: null, activo: true },
      orderBy: [{ numero: "asc" }, { vencimiento: "asc" }, { id: "asc" }],
      include: { estado: { select: { id: true, codigo: true, nombre: true } } },
    });
    res.json({ data: cuotas });
  } catch (e) {
    next(e);
  }
}

/** POST /api/planes/:id/cuotas */
export async function crearCuota(req, res, next) {
  try {
    const planId = Number(req.params.id);
    if (!Number.isInteger(planId)) return next({ status: 400, publicMessage: "ID inválido" });

          const plan = await prisma.planPago.findFirst({ 
        where: { id: planId, deletedAt: null },
        select: { id: true, valorJusRef: true, politicaJusId: true }
      });
      if (!plan) return next({ status: 404, publicMessage: "Plan no encontrado" });

      const parse = crearCuotaSchema.safeParse({ ...req.body, planId });
      if (!parse.success) {
        return next({ status: 400, publicMessage: parse.error.errors.map((e) => e.message).join(", ") });
      }

      const dto = normalizeCuotaDTO(parse.data);

      // número incremental si no vino
      if (dto.numero == null) {
        const max = await prisma.planCuota.aggregate({ _max: { numero: true }, where: { planId, deletedAt: null, activo: true } });
        dto.numero = (max._max.numero ?? 0) + 1;
      }

      // valorJusRef si monto en JUS y no vino
      // Si la política es AL_COBRO (169), valorJusRef debe ser null hasta que se cobre
      const hasJus = dto.montoJus != null && Number(dto.montoJus) > 0;
      const poli = Number(plan.politicaJusId || 168); // default: FECHA_REGULACION
      if (hasJus && (dto.valorJusRef == null)) {
        if (poli === 169) {
          // AL_COBRO (169): no asignar valorJusRef (se asignará al aplicar un ingreso)
          dto.valorJusRef = null;
        } else {
          // FECHA_REGULACION (168): usar el valor del plan o calcular según vencimiento
          const vj = plan.valorJusRef || (await findValorJusSnapshot(dto.vencimiento || new Date()));
          if (vj) dto.valorJusRef = vj;
        }
      }

    const created = await prisma.planCuota.create({
      data: { ...dto, planId, createdBy: req.user?.id ?? null },
      include: { estado: { select: { id: true, codigo: true, nombre: true } } },
    });

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
}

/** PUT /api/planes/:id/cuotas/:cuotaId */
export async function actualizarCuota(req, res, next) {
  try {
    const planId = Number(req.params.id);
    const cuotaId = Number(req.params.cuotaId);
    if (!Number.isInteger(planId) || !Number.isInteger(cuotaId)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    const existe = await prisma.planCuota.findFirst({ where: { id: cuotaId, planId, deletedAt: null }, select: { id: true } });
    if (!existe) return next({ status: 404, publicMessage: "Cuota no encontrada" });

    const parse = actualizarCuotaSchema.safeParse(req.body);
    if (!parse.success) {
      return next({ status: 400, publicMessage: parse.error.errors.map((e) => e.message).join(", ") });
    }
    const dto = normalizeCuotaDTO(parse.data);

          if (dto.numero != null) dto.numero = Math.max(1, Math.trunc(dto.numero));

      // valorJusRef si ahora pasan montoJus y no vino snapshot
      // Si la política es AL_COBRO (169), valorJusRef debe ser null hasta que se cobre
      const setsJus = Object.prototype.hasOwnProperty.call(dto, "montoJus") && dto.montoJus != null && Number(dto.montoJus) > 0;
      if (setsJus && (dto.valorJusRef == null)) {
        const plan = await prisma.planPago.findUnique({ 
          where: { id: planId }, 
          select: { valorJusRef: true, politicaJusId: true } 
        });
        const poli = Number(plan?.politicaJusId || 168); // default: FECHA_REGULACION
        if (poli === 169) {
          // AL_COBRO (169): no asignar valorJusRef (se asignará al aplicar un ingreso)
          dto.valorJusRef = null;
        } else {
          // FECHA_REGULACION (168): usar el valor del plan o calcular según vencimiento
          const vj = plan?.valorJusRef || (await findValorJusSnapshot(dto.vencimiento || new Date()));
          if (vj) dto.valorJusRef = vj;
        }
      }

    const upd = await prisma.planCuota.update({
      where: { id: cuotaId },
      data: { ...dto, updatedBy: req.user?.id ?? null },
      include: { estado: { select: { id: true, codigo: true, nombre: true } } },
    });
    res.json(upd);
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/planes/:id/cuotas/:cuotaId (soft delete) */
export async function borrarCuota(req, res, next) {
  try {
    const planId = Number(req.params.id);
    const cuotaId = Number(req.params.cuotaId);
    if (!Number.isInteger(planId) || !Number.isInteger(cuotaId)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    const existe = await prisma.planCuota.findFirst({ where: { id: cuotaId, planId, deletedAt: null }, select: { id: true } });
    if (!existe) return next({ status: 404, publicMessage: "Cuota no encontrada" });

    await prisma.planCuota.update({
      where: { id: cuotaId },
      data: { activo: false, deletedAt: new Date(), deletedBy: req.user?.id ?? null },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

/** POST /api/planes/:id/cuotas/generar  (bulk) */
export async function generarCuotas(req, res, next) {
  try {
    const planId = Number(req.params.id);
    if (!Number.isInteger(planId)) return next({ status: 400, publicMessage: "ID inválido" });

    const plan = await prisma.planPago.findFirst({
      where: { id: planId, deletedAt: null },
      include: { 
        periodicidad: true,
        politicaJus: true,
      },
    });
    if (!plan) return next({ status: 404, publicMessage: "Plan no encontrado" });

    const parse = generarCuotasSchema.safeParse(req.body);
    if (!parse.success) {
      return next({ status: 400, publicMessage: parse.error.errors.map((e) => e.message).join(", ") });
    }
    const body = parse.data;

    // periodicidad (override si viene periodicidadId)
    let periodicidad = plan.periodicidad;
    if (body.periodicidadId) {
      periodicidad = await prisma.parametro.findFirst({ where: { id: Number(body.periodicidadId) } });
    }
    const addNext = makePeriodAdder(periodicidad);

    // primer vencimiento
    let current = body.primerVencimiento
      ? new Date(body.primerVencimiento)
      : (plan.fechaInicio ? new Date(plan.fechaInicio) : new Date());

    // montos: si vienen en body, override; sino usar los del plan
    const montoJus = body.montoJus != null ? Number(body.montoJus) : Number(plan.montoCuotaJus ?? 0);
    const montoPes = body.montoPesos != null ? Number(body.montoPesos) : Number(plan.montoCuotaPesos ?? 0);
    if (!(montoJus > 0 || montoPes > 0)) {
      return next({ status: 400, publicMessage: "No hay montos válidos (ni en el plan ni en la solicitud)." });
    }

    // Política JUS del plan
    const poli = Number(plan.politicaJusId || 168); // default: FECHA_REGULACION

    // numeración incremental
    const max = await prisma.planCuota.aggregate({
      _max: { numero: true },
      where: { planId, deletedAt: null, activo: true },
    });
    let nextNum = (max._max.numero ?? 0) + 1;

    const toCreate = [];
    for (let i = 0; i < Number(body.cantidad); i++) {
              // valorJusRef: según política
        let vj = null;
        if (montoJus > 0) {
          if (body.valorJusRef != null) {
            // Si viene explícito en body, usarlo
            vj = Number(body.valorJusRef);
          } else {
            // Si no, calcular según política
            if (poli === 169) {
              // AL_COBRO (169): valorJusRef debe ser null hasta que se cobre (se asigna al aplicar un ingreso)
              vj = null;
            } else {
              // FECHA_REGULACION (168): usar el valor del plan (constante, fecha de regulación)
              vj = plan.valorJusRef;
            }
          }
        }

      toCreate.push({
        planId,
        numero: nextNum++,
        vencimiento: current,
        montoJus: montoJus > 0 ? montoJus : null,
        montoPesos: montoPes > 0 ? montoPes : null,
        valorJusRef: vj,
        createdBy: req.user?.id ?? null,
      });
      current = addNext(current);
    }

    if (!toCreate.length) return res.json({ created: 0 });

    await prisma.planCuota.createMany({ data: toCreate });
    const creadas = await prisma.planCuota.findMany({
      where: { planId, numero: { gte: toCreate[0].numero } },
      orderBy: [{ numero: "asc" }],
      include: { estado: { select: { id: true, codigo: true, nombre: true } } },
    });

    res.status(201).json({ created: toCreate.length, cuotas: creadas });
  } catch (e) {
    next(e);
  }
}
