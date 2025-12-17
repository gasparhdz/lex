// src/controllers/finanzas/honorario.controller.js
import prisma from "../../utils/prisma.js";
import { crearHonorarioSchema, actualizarHonorarioSchema } from "../../validators/finanzas/honorario.schema.js";

/* ========================= Constantes ========================= */
const CAT_ESTADO_HONORARIO = 16;
const CAT_PERIODICIDAD = 18;   // categoría PERIODICIDAD
const CAT_ESTADO_CUOTA = 19;   // categoría ESTADO_CUOTA (PENDIENTE, PAGADA, VENCIDA, etc.)

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

/** Snapshot Valor JUS */
async function findValorJusSnapshot(fecha) {
  const d = fecha ? new Date(fecha) : null;
  let row = d
    ? await prisma.valorJUS.findFirst({
        where: { deletedAt: null, activo: true, fecha: { lte: d } },
        orderBy: { fecha: "desc" },
      })
    : null;
  if (!row)
    row = await prisma.valorJUS.findFirst({
      where: { deletedAt: null, activo: true },
      orderBy: { fecha: "desc" },
    });
  return row?.valor ?? null;
}

/** Normaliza honorario */
function normalizeHonorarioDTO(b = {}) {
  const out = {
    clienteId: intOrNull(b.clienteId),
    casoId: intOrNull(b.casoId),
    conceptoId: intOrNull(b.conceptoId),
    parteId: intOrNull(b.parteId),
    monedaId: intOrNull(b.monedaId),
    jus: numOrNull(b.jus),
    montoPesos: numOrNull(b.montoPesos),
    valorJusRef: numOrNull(b.valorJusRef),
    fechaRegulacion: toDateOrNull(b.fechaRegulacion),
    estadoId: intOrNull(b.estadoId),
    activo: b.activo === undefined ? undefined : Boolean(b.activo),
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

/** WHERE listar */
function buildWhereHonorarios(q = {}) {
  const where = { deletedAt: null, activo: true };
  const clienteId = intOrNull(q.clienteId); if (clienteId !== undefined) where.clienteId = clienteId;
  const casoId = intOrNull(q.casoId);       if (casoId !== undefined) where.casoId = casoId;
  const conceptoId = intOrNull(q.conceptoId); if (conceptoId !== undefined) where.conceptoId = conceptoId;
  const parteId = intOrNull(q.parteId);     if (parteId !== undefined) where.parteId = parteId;
  const estadoId = intOrNull(q.estadoId);   if (estadoId !== undefined) where.estadoId = estadoId;

  const from = toDateOrNull(q.from);
  const to = toDateOrNull(q.to);
  if (from || to) {
    where.fechaRegulacion = {};
    if (from) where.fechaRegulacion.gte = from;
    if (to) where.fechaRegulacion.lte = to;
  }

  const search = String(q.search || "").trim();
  if (search) {
    where.AND = (where.AND || []).concat({
      OR: [
        { caso: { caratula: { contains: search, mode: "insensitive" } } },
        { caso: { nroExpte: { contains: search, mode: "insensitive" } } },
        { cliente: { razonSocial: { contains: search, mode: "insensitive" } } },
        { cliente: { apellido: { contains: search, mode: "insensitive" } } },
        { cliente: { nombre: { contains: search, mode: "insensitive" } } },
        { concepto: { nombre: { contains: search, mode: "insensitive" } } },
        { parte: { nombre: { contains: search, mode: "insensitive" } } },
      ],
    });
  }
  return where;
}
function buildOrderBy({ orderBy, order, sort }) {
  if (orderBy === "fecha") orderBy = "fechaRegulacion";
  if (orderBy) {
    const dir = (order || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    switch (orderBy) {
      case "fechaRegulacion":
      case "createdAt":
      case "updatedAt":
        return [{ [orderBy]: dir }];
      default:
        return [{ createdAt: "desc" }];
    }
  }
  if (sort) {
    const parts = String(sort).split(",").map((x) => x.trim()).filter(Boolean);
    const allow = new Set(["fechaRegulacion", "createdAt", "updatedAt"]);
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

/** Cálculos */
function computeMontos(h) {
  const jus = Number(h.jus ?? 0) || 0;
  const pesos = Number(h.montoPesos ?? 0) || 0;
  const vj = Number(h.valorJusRef ?? 0) || 0;
  const totalJus = jus > 0 ? jus : (vj > 0 && pesos > 0 ? pesos / vj : 0);
  const totalPesosRef = pesos > 0 ? pesos : (vj > 0 && jus > 0 ? jus * vj : 0);
  return { totalJus, totalPesosRef, valorJusRef: vj || null };
}

/** Cobrado ARS y JUS por honorario via IngresoCuota (mapas) */
async function sumCobradoByHonorario(ids = []) {
  if (!ids.length) return { ars: {}, jus: {} };

  const apps = await prisma.ingresoCuota.findMany({
    where: {
      deletedAt: null,
      activo: true,
      cuota: { plan: { honorarioId: { in: ids } } },
    },
    select: {
      montoAplicadoARS: true,
      montoAplicadoJUS: true,
      valorJusAlAplic: true,
      cuota: { select: { plan: { select: { honorarioId: true } } } },
    },
  });

  const ars = new Map();
  const jus = new Map();

  for (const a of apps) {
    const hid = a?.cuota?.plan?.honorarioId;
    if (!hid) continue;

    const arsVal = Number(a.montoAplicadoARS || 0);

    let jusVal = Number(a.montoAplicadoJUS);
    if (!Number.isFinite(jusVal)) {
      const vj = Number(a.valorJusAlAplic || 0);
      jusVal = vj > 0 ? arsVal / vj : 0;
    }

    ars.set(hid, (ars.get(hid) || 0) + arsVal);
    jus.set(hid, (jus.get(hid) || 0) + jusVal);
  }

  const outARS = {}, outJUS = {};
  ids.forEach(id => {
    outARS[id] = Number(ars.get(id) || 0);
    outJUS[id] = Number(jus.get(id) || 0);
  });

  return { ars: outARS, jus: outJUS };
}

/** SOLO JUS por honorario (mapa id -> total JUS cobrado) */
async function sumCobradoJusByHonorario(ids = []) {
  if (!ids.length) return {};
  const apps = await prisma.ingresoCuota.findMany({
    where: {
      deletedAt: null,
      activo: true,
      cuota: { plan: { honorarioId: { in: ids } } },
    },
    select: {
      montoAplicadoARS: true,
      montoAplicadoJUS: true,
      valorJusAlAplic: true,
      cuota: { select: { plan: { select: { honorarioId: true } } } },
    },
  });

  const map = new Map();
  for (const a of apps) {
    const hid = a?.cuota?.plan?.honorarioId;
    if (!hid) continue;

    let jusVal = Number(a.montoAplicadoJUS);
    if (!Number.isFinite(jusVal)) {
      const arsVal = Number(a.montoAplicadoARS || 0);
      const vj = Number(a.valorJusAlAplic || 0);
      jusVal = vj > 0 ? arsVal / vj : 0;
    }
    map.set(hid, (map.get(hid) || 0) + (Number(jusVal) || 0));
  }
  const out = {};
  ids.forEach(id => { out[id] = Number(map.get(id) || 0); });
  return out;
}

async function findEstadoParametroId(tx, nombre) {
  const row = await tx.parametro.findFirst({
    where: { categoriaId: CAT_ESTADO_CUOTA, nombre: { equals: nombre, mode: "insensitive" }, activo: true },
    select: { id: true },
  });
  return row?.id ?? null;
}

// Usa nombre/código de la periodicidad
function periodicidadToDays(codeOrName, diasPersonalizados) {
  const c = String(codeOrName || "").toUpperCase();
  if (c.includes("SEMANAL")) return 7;
  if (c.includes("QUINCENAL")) return 15;
  if (c.includes("MENSUAL")) return 30;
  if (c.includes("PERSONALIZADA")) return Math.max(1, Number(diasPersonalizados || 0));
  // default
  return 30;
}
function addDays(d, days) { const x = new Date(d); x.setDate(x.getDate() + Number(days || 0)); return x; }
function splitAmount(n, total, decimals = 2) {
  if (!n || n <= 0) return [];
  const base = Math.floor((total / n) * Math.pow(10, decimals)) / Math.pow(10, decimals);
  const arr = Array(n).fill(base);
  const diff = +(total - base * n).toFixed(decimals);
  arr[n - 1] = +(arr[n - 1] + diff).toFixed(decimals);
  return arr;
}

/** ========= Recompute estado del HONORARIO según saldo =========
 *  Usa la categoría del estado actual para encontrar PENDIENTE / PARCIAL / PAGADO
 */
// REEMPLAZA por completo la función actual
export async function recomputeHonorarioEstadoSaldo(honorarioId) {
  const h = await prisma.honorario.findUnique({
    where: { id: honorarioId },
    select: { id: true, jus: true, montoPesos: true, valorJusRef: true, estadoId: true },
  });
  if (!h) return;

  const { totalJus, totalPesosRef } = computeMontos(h);

  // Cobrado en JUS/ARS
  const mapJus = await sumCobradoJusByHonorario([honorarioId]);
  const { ars: mapArs } = await sumCobradoByHonorario([honorarioId]);
  const cobradoJus = Number(mapJus[honorarioId] || 0);
  const cobradoARS = Number(mapArs[honorarioId] || 0);

  // Decisión por JUS (si hay), si no por ARS
  const EPS_JU = 1e-4;
  const EPS_AR = 0.05;
// calculo ambos saldos
  const saldoJus = (totalJus > 0) ? Math.max(0, totalJus - cobradoJus) : null;
  const saldoArs = (totalPesosRef > 0) ? Math.max(0, totalPesosRef - cobradoARS) : null;

  // pagado si alguna unidad está dentro de tolerancia
  const isCobrado =
    (saldoJus != null && saldoJus <= EPS_JU) ||
    (saldoArs != null && saldoArs <= EPS_AR);

  // parcial si no está cobrado y hubo movimiento en alguna unidad
  const isParcial =
    !isCobrado && (
      (cobradoJus != null && cobradoJus > EPS_JU) ||
      (cobradoARS != null && cobradoARS > EPS_AR)
    );

  // Buscar IDs de PENDIENTE / PARCIAL / COBRADO en categoría 16
  const estados = await prisma.parametro.findMany({
    where: {
      categoriaId: CAT_ESTADO_HONORARIO,
      activo: true,
      codigo: { in: ["PENDIENTE", "PARCIAL", "COBRADO"] },
    },
    select: { id: true, codigo: true },
  });

  const idPend = estados.find(e => e.codigo?.toUpperCase() === "PENDIENTE")?.id ?? null;
  const idParc = estados.find(e => e.codigo?.toUpperCase() === "PARCIAL")?.id ?? null;
  const idCobr = estados.find(e => e.codigo?.toUpperCase() === "COBRADO")?.id ?? null;

  let nuevoEstadoId = h.estadoId ?? idPend ?? idParc ?? idCobr;
  if (isCobrado && idCobr) nuevoEstadoId = idCobr;
  else if (isParcial && idParc) nuevoEstadoId = idParc;
  else if (!isParcial && !isCobrado && idPend) nuevoEstadoId = idPend;

  if (nuevoEstadoId && nuevoEstadoId !== h.estadoId) {
    await prisma.honorario.update({
      where: { id: honorarioId },
      data: { estadoId: nuevoEstadoId },
    });
  }
}



/* ========================= Handlers ========================= */

// GET /api/finanzas/honorarios
export async function listar(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req);

    // where robusto: incluye true y null, excluye solo false
    const where = buildWhereHonorarios(req.query);
    if (!("activo" in where)) {
      where.activo = { not: false };
    }

    const orderBy = buildOrderBy(req.query);

    const [total, data] = await Promise.all([
      prisma.honorario.count({ where }),
      prisma.honorario.findMany({
        where, orderBy, skip, take,
        include: {
          cliente:  { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
          caso:     { select: { id: true, nroExpte: true, caratula: true } },
          concepto: { select: { id: true, nombre: true, codigo: true } },
          parte:    { select: { id: true, nombre: true, codigo: true } },
          estado:   { select: { id: true, nombre: true, codigo: true } },
          moneda:   { select: { id: true, nombre: true, codigo: true } },
        },
      }),
    ]);

    const ids = data.map(h => h.id);

    // suma cobros en ARS y JUS
    const { ars: cobradoARS, jus: cobradoJUS } = await sumCobradoByHonorario(ids);

    const rows = data.map(h => {
      const { totalJus, totalPesosRef, valorJusRef } = computeMontos(h);
      const cobJus = Number(cobradoJUS[h.id] || 0);
      const cobArs = Number(cobradoARS[h.id] || 0);
      const saldoJus = Math.max(totalJus - cobJus, 0);
      const percCobrado = totalJus > 0 ? Math.max(0, Math.min(1, cobJus / totalJus)) : 0;

      // “cobrado” en ARS: así lo toma tu UI
      return {
        ...h,
        cobrado: cobArs,
        calc: { totalJus, totalPesosRef, valorJusRef, cobradoJus: cobJus, saldoJus, percCobrado },
      };
    });

    res.json({ rows, data: rows, page, pageSize, total });
  } catch (e) {
    console.error("HONORARIOS.listar ->", { message: e.message, code: e.code, meta: e.meta });
    next(e);
  }
}

// GET /api/finanzas/honorarios/:id
export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    const h = await prisma.honorario.findFirst({
      where: { id, deletedAt: null },
      include: {
        cliente:  { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        caso:     { select: { id: true, nroExpte: true, caratula: true } },
        concepto: { select: { id: true, nombre: true, codigo: true } },
        parte:    { select: { id: true, nombre: true, codigo: true } },
        estado:   { select: { id: true, nombre: true, codigo: true } },
        moneda:   { select: { id: true, nombre: true, codigo: true } },
        // planes+cuotas: activos + inactivos (para ver historial de pagos en edición)
        planes: {
          where: { deletedAt: null },
          include: {
            periodicidad: { select: { id: true, nombre: true, codigo: true } },
            cuotas: {
              where: { deletedAt: null },
              orderBy: { numero: "asc" },
              include: {
                estado: { select: { id: true, nombre: true, codigo: true } },
                aplicaciones: {                 
                  where: { deletedAt: null, activo: true },
                  select: { 
                    id: true,
                    fechaAplicacion: true,
                    montoAplicadoARS: true,
                    montoAplicadoJUS: true,
                  },
                  orderBy: { fechaAplicacion: "desc" },
                },
              },
            },
          },
        },
      },
    });

    if (!h) return next({ status: 404, publicMessage: "Honorario no encontrado" });

    // === agrupar todas las cuotas del honorario ===
    const cuotaIds = h.planes.flatMap(p => p.cuotas.map(c => c.id));
    let sumMap = {};
    if (cuotaIds.length) {
      const sums = await prisma.ingresoCuota.groupBy({
        by: ["cuotaId"],
        where: { cuotaId: { in: cuotaIds }, deletedAt: null, activo: true },
        _sum: { montoAplicadoARS: true, montoAplicadoJUS: true },
      });
      sumMap = Object.fromEntries(
        sums.map(r => [r.cuotaId, {
          aplARS: Number(r._sum.montoAplicadoARS || 0),
          aplJUS: Number(r._sum.montoAplicadoJUS || 0),
        }])
      );
    }

    const EPS_AR = 0.01;
    const EPS_JU = 1e-6;

    // Valor JUS de referencia “actual” (para mostrar $ de cuotas en JUS)
    const vjRow = await prisma.valorJUS.findFirst({ orderBy: { fecha: "desc" } });
    const valorJusHoy = Number(vjRow?.valor || 0);

    // Enriquecemos cada cuota con aplicado/saldo/flag pagada
    const planes = h.planes.map(pl => ({
      ...pl,
      cuotas: pl.cuotas.map(c => {
        const apl = sumMap[c.id] || { aplARS: 0, aplJUS: 0 };
        const isJUS = Number(c.montoJus || 0) > 0 && !(Number(c.montoPesos || 0) > 0);

        let aplicadoARS = apl.aplARS;
        let aplicadoJUS = apl.aplJUS;

        // Saldos en ambas unidades
        let saldoARS = 0, saldoJUS = 0, pagada = false;

        if (isJUS) {
          const totalJUS = Number(c.montoJus || 0);
          saldoJUS = Math.max(totalJUS - aplicadoJUS, 0);
          // para mostrar $ en la grilla: equivalencia con valorJusHoy
          saldoARS = valorJusHoy > 0 ? +(saldoJUS * valorJusHoy).toFixed(2) : null;

          // coherencia si aplicaciones viejas no guardaron JUS
          if (!aplicadoJUS && valorJusHoy > 0 && aplicadoARS > 0) {
            aplicadoJUS = +(aplicadoARS / valorJusHoy).toFixed(6);
          }

          pagada = aplicadoJUS >= (totalJUS - EPS_JU);
        } else {
          const totalARS = Number(c.montoPesos || 0);
          saldoARS = +(Math.max(totalARS - aplicadoARS, 0)).toFixed(2);
          pagada = aplicadoARS >= (totalARS - EPS_AR);
          saldoJUS = 0;
        }

        return {
          ...c,
          aplicadoARS,
          aplicadoJUS,
          saldoARS,
          saldoJUS,
          isPagada: pagada,
          valorJusHoy: valorJusHoy || null,
        };
      }),
    }));

    // Cálculos globales del honorario
    const jus = Number(h.jus || 0) || 0;
    const pesos = Number(h.montoPesos || 0) || 0;
    const vjRef = Number(h.valorJusRef || 0) || 0;
    const totalJus = jus > 0 ? jus : (vjRef > 0 && pesos > 0 ? pesos / vjRef : 0);
    const totalPesosRef = pesos > 0 ? pesos : (vjRef > 0 && jus > 0 ? jus * vjRef : 0);

    const totApps = Object.values(sumMap);
    const cobradoJus = totApps.reduce((a, r) => a + Number(r.aplJUS || 0), 0);
    const saldoJus = Math.max(totalJus - cobradoJus, 0);
    const percCobrado = totalJus > 0 ? Math.max(0, Math.min(1, cobradoJus / totalJus)) : 0;

    res.json({
      ...h,
      planes,
      calc: { totalJus, totalPesosRef, valorJusRef: vjRef || null, cobradoJus, saldoJus, percCobrado },
    });
  } catch (e) {
    console.error("HONORARIOS.obtener ->", { message: e.message, code: e.code, meta: e.meta });
    next(e);
  }
}

// POST /api/finanzas/honorarios
export async function crear(req, res, next) {
  try {
    const parsed = crearHonorarioSchema.safeParse(req.body);
    if (!parsed.success) {
      return next({ status: 400, publicMessage: parsed.error.errors.map(e => e.message).join(", ") });
    }
    const dto = normalizeHonorarioDTO(parsed.data);

    if (!dto.conceptoId) return next({ status: 400, publicMessage: "conceptoId es requerido" });
    if (!dto.parteId) return next({ status: 400, publicMessage: "parteId es requerido" });
    if (!dto.fechaRegulacion) return next({ status: 400, publicMessage: "fechaRegulacion es requerida" });

    const hasJus = typeof dto.jus === "number" && dto.jus > 0;
    const hasPesos = typeof dto.montoPesos === "number" && dto.montoPesos > 0;
    if (!hasJus && !hasPesos) {
      return next({ status: 400, publicMessage: "Debe informar jus o montoPesos" });
    }

    // Valor JUS ref: siempre usar la fecha de regulación para el Honorario
    let warnings = [];
    if ((hasJus ^ hasPesos) && (dto.valorJusRef == null)) {
      const vj = await findValorJusSnapshot(dto.fechaRegulacion);
      if (vj) dto.valorJusRef = vj;
      else warnings.push("No se encontró Valor JUS para la fecha de regulación; se guardará sin referencia.");
    }
    const userId = req.user?.id ?? null;

    const result = await prisma.$transaction(async (tx) => {
      // 1) Honorario
      const nuevo = await tx.honorario.create({
        data: { ...dto, createdBy: userId },
        include: {
          cliente:  { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
          caso:     { select: { id: true, nroExpte: true, caratula: true } },
          concepto: { select: { id: true, nombre: true, codigo: true } },
          parte:    { select: { id: true, nombre: true, codigo: true } },
          estado:   { select: { id: true, nombre: true, codigo: true } },
          moneda:   { select: { id: true, nombre: true, codigo: true } },
        },
      });

      // === Buscar estado default "PENDIENTE" para cuotas (1 sola vez) ===
      const estadoPendCuota = await tx.parametro.findFirst({
        where: {
          categoriaId: CAT_ESTADO_CUOTA,
          nombre: { equals: "PENDIENTE", mode: "insensitive" },
          activo: true,
        },
        select: { id: true },
      });
      const estadoCuotaId = estadoPendCuota?.id ?? null;

      // Helper para crear plan y cuotas
      const createPlanWithCuotas = async ({
        periodicidadId,
        periodicidadDias,
        cantidad,
        fechaPrimera,
        diasPersonalizados,
        montoCuotaJus,
        montoCuotaPesos,
        politicaJusId,
        cuotas, // si vienen explícitas
      }) => {
        // 2) Plan
        let periodicidadRow = null;
        if (periodicidadId) {
          periodicidadRow = await tx.parametro.findFirst({
            where: { id: Number(periodicidadId), categoriaId: CAT_PERIODICIDAD, activo: true },
            select: { id: true, codigo: true, nombre: true },
          });
          if (!periodicidadRow) throw { status: 400, publicMessage: "periodicidadId inválido" };
        }

        // Calcular valorJusRef según política del honorario
        // Para el plan, siempre se usa la fecha de regulación como referencia base
        const hasJus = montoCuotaJus != null && Number(montoCuotaJus) > 0;
        let planValorJusRef = null;
        if (hasJus) {
          // Usar la fecha de regulación del honorario como base
          planValorJusRef = await findValorJusSnapshot(dto.fechaRegulacion);
        }

        const plan = await tx.planPago.create({
          data: {
            honorarioId: nuevo.id,
            clienteId: nuevo.clienteId ?? null,
            casoId: nuevo.casoId ?? null,
            descripcion: null,
            fechaInicio: fechaPrimera ? new Date(fechaPrimera) : (dto.fechaRegulacion ?? new Date()),
            periodicidadId: periodicidadRow?.id ?? null,
            politicaJusId: intOrNull(politicaJusId),
            montoCuotaJus: numOrNull(montoCuotaJus) ?? null,
            montoCuotaPesos: numOrNull(montoCuotaPesos) ?? null,
            valorJusRef: planValorJusRef,
            createdBy: userId,
          },
        });

        // 3) Cuotas: explícitas o generadas
        let rows = [];
        if (Array.isArray(cuotas) && cuotas.length) {
          rows = cuotas.map((q, i) => ({
            planId: plan.id,
            numero: Number(q.numero ?? i + 1),
            vencimiento: toDateOrNull(q.vencimiento) ?? new Date(),
            montoJus: numOrNull(q.montoJus) ?? null,
            montoPesos: numOrNull(q.montoPesos) ?? null,
            valorJusRef: null,
            estadoId: estadoCuotaId,      // ← default
            createdBy: userId,
          }));
        } else {
          const n = Number(cantidad || 1);
          const start = fechaPrimera ? new Date(fechaPrimera) : (dto.fechaRegulacion ?? new Date());

          // step días desde periodicidadId o periodicidadDias
          let stepDays = Number(periodicidadDias || 0);
          if (!stepDays && periodicidadRow) {
            // acepta nombre o código
            stepDays = periodicidadToDays(periodicidadRow.nombre || periodicidadRow.codigo, diasPersonalizados);
          }
          if (!stepDays) stepDays = 30; // default mensual

          const isJus = Number(nuevo.jus || 0) > 0;
          let montos = [];
          if (isJus) {
            if (montoCuotaJus && Number(montoCuotaJus) > 0) montos = Array(n).fill(Number(montoCuotaJus));
            else {
              const { totalJus } = computeMontos(nuevo);
              montos = splitAmount(n, Number(totalJus || 0), 4);
            }
          } else {
            if (montoCuotaPesos && Number(montoCuotaPesos) > 0) montos = Array(n).fill(Number(montoCuotaPesos));
            else {
              const { totalPesosRef } = computeMontos(nuevo);
              montos = splitAmount(n, Number(totalPesosRef || 0), 2);
            }
          }

          for (let i = 0; i < n; i++) {
            const venc = addDays(start, stepDays * i);
            let vj = null;
            if (isJus) {
              const poli = Number(politicaJusId || 168);
              if (poli === 169) {
                // AL_COBRO (169): valor según fecha de vencimiento de la cuota (dinámico)
                vj = await findValorJusSnapshot(venc);
              } else {
                // FECHA_REGULACION (168): usar el valor del plan (constante, fecha de regulación)
                vj = planValorJusRef;
              }
            }
            rows.push({
              planId: plan.id,
              numero: i + 1,
              vencimiento: venc,
              montoJus: isJus ? Number(montos[i]) : null,
              montoPesos: isJus ? null : Number(montos[i]),
              valorJusRef: vj,
              estadoId: estadoCuotaId,  // ← default
              createdBy: userId,
            });
          }
        }

        if (rows.length) {
          await tx.planCuota.createMany({ data: rows });
        }
        return plan;
      };

      const planIn = req.body?.plan;

      // Caso A: viene plan.crear === true
      if (planIn?.crear === true) {
        await createPlanWithCuotas({
          periodicidadId: planIn.periodicidadId,
          periodicidadDias: planIn.periodicidadDias,
          cantidad: planIn.cantidad,
          fechaPrimera: planIn.fechaPrimera,
          diasPersonalizados: planIn.diasPersonalizados,
          montoCuotaJus: planIn.montoCuotaJus,
          montoCuotaPesos: planIn.montoCuotaPesos,
          politicaJusId: planIn.politicaJusId,
          cuotas: planIn.cuotas,
        });
      } else {
        // Caso B: NO vino plan -> crear plan AUTO con 1 cuota
        const isJus = Number(nuevo.jus || 0) > 0;
        const { totalJus, totalPesosRef } = computeMontos(nuevo);
        await createPlanWithCuotas({
          periodicidadDias: 30,
          cantidad: 1,
          fechaPrimera: dto.fechaRegulacion ?? new Date(),
          montoCuotaJus: isJus ? Number(totalJus || 0) : null,
          montoCuotaPesos: !isJus ? Number(totalPesosRef || 0) : null,
          politicaJusId: null, // Default sin política
        });
      }

      return { nuevo };
    });

    // Recalcular y actualizar estado en DB
    await recomputeHonorarioEstadoSaldo(result.nuevo.id);

    const { totalJus, totalPesosRef, valorJusRef } = computeMontos(result.nuevo);
    res.status(201).json({ ...result.nuevo, calc: { totalJus, totalPesosRef, valorJusRef }, warnings });
  } catch (e) {
    console.error("HONORARIOS.crear ->", e);
    next(e);
  }
}

// PUT /api/finanzas/honorarios/:id
export async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.honorario.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existe) return next({ status: 404, publicMessage: "Honorario no encontrado" });

    const parsed = actualizarHonorarioSchema.safeParse(req.body);
    if (!parsed.success) {
      return next({ status: 400, publicMessage: parsed.error.errors.map(e => e.message).join(", ") });
    }
    const dto = normalizeHonorarioDTO(parsed.data);

    const willUnsetJus = Object.prototype.hasOwnProperty.call(dto, "jus") && (dto.jus == null || dto.jus === 0);
    const willUnsetPesos = Object.prototype.hasOwnProperty.call(dto, "montoPesos") && (dto.montoPesos == null || dto.montoPesos === 0);
    if (willUnsetJus && willUnsetPesos) {
      const prev = await prisma.honorario.findUnique({ where: { id }, select: { jus: true, montoPesos: true } });
      const prevHasJus = Number(prev?.jus || 0) > 0;
      const prevHasPesos = Number(prev?.montoPesos || 0) > 0;
      if (!prevHasJus && !prevHasPesos) {
        return next({ status: 400, publicMessage: "El honorario debe tener jus o montoPesos" });
      }
    }

    const upd = await prisma.honorario.update({
      where: { id },
      data: { ...dto, updatedBy: req.user?.id ?? null },
      include: {
        cliente:  { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        caso:     { select: { id: true, nroExpte: true, caratula: true } },
        concepto: { select: { id: true, nombre: true, codigo: true } },
        parte:    { select: { id: true, nombre: true, codigo: true } },
        estado:   { select: { id: true, nombre: true, codigo: true } },
        moneda:   { select: { id: true, nombre: true, codigo: true } },
      },
    });

    const planIn = req.body?.plan;
    if (planIn?.crear === true) {
      await prisma.$transaction(async (tx) => {
        // 1) CERRAR TODOS los planes activos (no solo el primero)
        const planesActivos = await tx.planPago.findMany({
          where: { honorarioId: id, deletedAt: null, activo: true },
          include: {
            cuotas: {
              where: { deletedAt: null },
              include: {
                estado: { select: { id: true, nombre: true, codigo: true } },
                aplicaciones: { select: { id: true } },
              },
              orderBy: { numero: "asc" },
            },
          },
        });

        // 2) Estados
        const estadoPendId = await findEstadoParametroId(tx, "PENDIENTE");
        const estadoAnuladaId = await findEstadoParametroId(tx, "ANULADA");

        // 3) Cerrar todos los planes activos y anular cuotas no pagas
        for (const planActual of planesActivos) {
          await tx.planPago.update({
            where: { id: planActual.id },
            data: { activo: false, updatedBy: req.user?.id ?? null },
          });

          // Anular SOLO cuotas no pagas (sin ingresos aplicados y estado != PAGA)
          for (const c of planActual.cuotas) {
            const tienePagos = Array.isArray(c.aplicaciones) && c.aplicaciones.length > 0;
            const esPaga = String(c.estado?.nombre || "").toUpperCase().includes("PAGA");
            if (!tienePagos && !esPaga) {
              await tx.planCuota.update({
                where: { id: c.id },
                data: { estadoId: estadoAnuladaId ?? c.estadoId, updatedBy: req.user?.id ?? null },
              });
            }
          }
        }

        // 4) Calcular SALDO pendiente del honorario
        const { totalJus } = computeMontos(upd);
        const cobrosMap = await sumCobradoJusByHonorario([id]);
        const cobradoJus = Number(cobrosMap[id] || 0);
        const saldoJus = Math.max(0, (totalJus || 0) - (cobradoJus || 0));

        // Si no hay saldo, no generamos plan nuevo
        if (saldoJus <= 0) {
          return; // nada más que hacer; ya se cerró el viejo
        }

        // 5) Periodicidad (cat 18)
        let periodicidadRow = null;
        if (planIn.periodicidadId) {
          periodicidadRow = await tx.parametro.findFirst({
            where: { id: Number(planIn.periodicidadId), categoriaId: CAT_PERIODICIDAD, activo: true },
            select: { id: true, nombre: true, codigo: true },
          });
          if (!periodicidadRow) {
            throw { status: 400, publicMessage: "periodicidadId inválido" };
          }
        }

        // 6) Crear plan nuevo por saldo
        const planNuevo = await tx.planPago.create({
          data: {
            honorarioId: id,
            clienteId: upd.clienteId ?? null,
            casoId: upd.casoId ?? null,
            descripcion: null,
            fechaInicio: planIn.fechaPrimera ? new Date(planIn.fechaPrimera) : (upd.fechaRegulacion ?? new Date()),
            periodicidadId: periodicidadRow?.id ?? null,
            // si el honorario está en JUS, usamos montoCuotaJus; si está en ARS, usamos montoCuotaPesos
            montoCuotaJus: (Number(upd.jus || 0) > 0) ? (numOrNull(planIn.montoCuotaJus) ?? null) : null,
            montoCuotaPesos: (Number(upd.jus || 0) > 0) ? null : (numOrNull(planIn.montoCuotaPesos) ?? null),
            valorJusRef: null,
            createdBy: req.user?.id ?? null,
          },
        });

        // 7) Generar cuotas del nuevo plan
        const n = Number(planIn.cantidad || 1);
        const start = planIn.fechaPrimera ? new Date(planIn.fechaPrimera) : (upd.fechaRegulacion ?? new Date());
        let stepDays = Number(planIn.periodicidadDias || 0);
        if (!stepDays && periodicidadRow) {
          stepDays = periodicidadToDays(periodicidadRow.nombre || periodicidadRow.codigo, planIn.diasPersonalizados);
        }
        if (!stepDays) stepDays = 30;

        const honorarioEsJus = Number(upd.jus || 0) > 0;

        let montos = [];
        if (honorarioEsJus) {
          if (planIn.montoCuotaJus && Number(planIn.montoCuotaJus) > 0) {
            montos = Array(n).fill(Number(planIn.montoCuotaJus));
          } else {
            montos = splitAmount(n, Number(saldoJus), 4);
          }
        } else {
          const { totalPesosRef } = computeMontos(upd); // total de referencia en ARS
          const valorJusRef = Number(upd.valorJusRef || 0);
          const saldoArs = valorJusRef > 0 ? +(saldoJus * valorJusRef).toFixed(2) : Number(totalPesosRef || 0);
          if (planIn.montoCuotaPesos && Number(planIn.montoCuotaPesos) > 0) {
            montos = Array(n).fill(Number(planIn.montoCuotaPesos));
          } else {
            montos = splitAmount(n, saldoArs, 2);
          }
        }

        const cuotas = [];
        for (let i = 0; i < n; i++) {
          const venc = addDays(start, stepDays * i);
          cuotas.push({
            planId: planNuevo.id,
            numero: i + 1,
            vencimiento: venc,
            montoJus: honorarioEsJus ? Number(montos[i]) : null,
            montoPesos: honorarioEsJus ? null : Number(montos[i]),
            valorJusRef: null,
            estadoId: estadoPendId, // nuevas arrancan PENDIENTE
            createdBy: req.user?.id ?? null,
          });
        }
        if (cuotas.length) {
          await tx.planCuota.createMany({ data: cuotas });
        }
      });
    }

    // Recalcular y actualizar estado en DB
    await recomputeHonorarioEstadoSaldo(id);

    const { totalJus, totalPesosRef, valorJusRef } = computeMontos(upd);
    const cobrosMap = await sumCobradoJusByHonorario([id]);
    const cobradoJus = Number(cobrosMap[id] || 0);
    const saldoJus = totalJus - cobradoJus;
    const percCobrado = totalJus > 0 ? Math.max(0, Math.min(1, cobradoJus / totalJus)) : 0;

    res.json({ ...upd, calc: { totalJus, totalPesosRef, valorJusRef, cobradoJus, saldoJus, percCobrado } });
  } catch (e) {
    console.error("HONORARIOS.actualizar ->", e);
    next(e);
  }
}

// DELETE /api/finanzas/honorarios/:id
export async function borrar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.honorario.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existe) return next({ status: 404, publicMessage: "Honorario no encontrado" });

    await prisma.honorario.update({
      where: { id },
      data: { activo: false, deletedAt: new Date(), deletedBy: req.user?.id ?? null },
    });
    res.status(204).end();
  } catch (e) {
    console.error("HONORARIOS.borrar ->", e);
    next(e);
  }
}
