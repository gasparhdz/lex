// src/controllers/finanzas/finanzas-resumen.controller.js
import prisma from "../../utils/prisma.js";

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
function numOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(n) {
  return Math.round(n * 100) / 100;
}
function startOfMonth(d) {
  const x = new Date(d);
  x.setDate(1); x.setHours(0,0,0,0);
  return x;
}
function endOfMonth(d) {
  const x = new Date(d);
  x.setMonth(x.getMonth()+1, 0); x.setHours(23,59,59,999);
  return x;
}
function ymKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2, "0");
  return `${y}-${m}`;
}
async function getValorJusAt(date) {
  const d = date instanceof Date ? date : new Date(date);
  let row = await prisma.valorJUS.findFirst({
    where: { deletedAt: null, activo: true, fecha: { lte: d } },
    orderBy: { fecha: "desc" },
    select: { valor: true },
  });
  if (!row) {
    row = await prisma.valorJUS.findFirst({
      where: { deletedAt: null, activo: true },
      orderBy: { fecha: "desc" },
      select: { valor: true },
    });
  }
  return row?.valor ? Number(row.valor) : null;
}

/** Aplica filtros comunes de cliente/caso/fechas a Honorario */
function buildHonorarioWhere(q = {}) {
  const where = { deletedAt: null, activo: true };

  const clienteId = intOrNull(q.clienteId);
  if (clienteId !== undefined) where.clienteId = clienteId;

  const casoId = intOrNull(q.casoId);
  if (casoId !== undefined) where.casoId = casoId;

  const conceptoId = intOrNull(q.conceptoId);
  if (conceptoId !== undefined) where.conceptoId = conceptoId;

  const parteId = intOrNull(q.parteId);
  if (parteId !== undefined) where.parteId = parteId;

  const estadoId = intOrNull(q.estadoId);
  if (estadoId !== undefined) where.estadoId = estadoId;

  const from = toDateOrNull(q.from);
  const to = toDateOrNull(q.to);
  if (from || to) {
    where.fechaRegulacion = {};
    if (from) where.fechaRegulacion.gte = from;
    if (to) where.fechaRegulacion.lte = to;
  }

  return where;
}

/** Suma totales de honorarios (calcula JUS y $ ref por registro) */
function sumHonorarios(honorarios = []) {
  let totalJus = 0;
  let totalPesosRef = 0;
  for (const h of honorarios) {
    const jus = numOrZero(h.jus);
    const pesos = numOrZero(h.montoPesos);
    const vj = numOrZero(h.valorJusRef);
    const hJus = jus > 0 ? jus : (vj > 0 && pesos > 0 ? pesos / vj : 0);
    const hPesos = pesos > 0 ? pesos : (vj > 0 && jus > 0 ? jus * vj : 0);
    totalJus += hJus;
    totalPesosRef += hPesos;
  }
  return { totalJus, totalPesosRef };
}

/**
 * Suma cobros aplicados a honorarios a partir de la tabla pivote `ingresoHonorario`
 * Devuelve:
 *  - totalCobradoJus / totalCobradoPesos (lifetime)
 *  - enPeriodoJus / enPeriodoPesos (filtrando fechaAplicacion)
 */
async function sumCobrosAplicadosHonorarios(honorarioIds = [], { from, to } = {}) {
  if (!honorarioIds.length) {
    return { totalCobradoJus: 0, totalCobradoPesos: 0, enPeriodoJus: 0, enPeriodoPesos: 0 };
  }

  // Helper para sumar JUS con fallback ARS/vj
  const sumJus = (rows) => rows.reduce((acc, r) => {
    const ars = numOrZero(r._sum?.montoAplicadoARS);
    const jus = numOrZero(r._sum?.montoAplicadoJUS);
    const vj  = numOrZero(r._avg?.valorJusAlAplic); // ojo: promedio; para precisión exacta haría sum manual fila a fila
    // Preferimos JUS si está. Si no, convertimos ARS usando vj medio (aprox) — si querés precisión exacta, cambiamos a findMany + reduce.
    const jusEff = jus > 0 ? jus : (vj > 0 ? ars / vj : 0);
    return acc + jusEff;
  }, 0);

  // LIFETIME
  const lifetime = await prisma.ingresoHonorario.groupBy({
    by: ["honorarioId"],
    where: { deletedAt: null, activo: true, honorarioId: { in: honorarioIds } },
    _sum: { montoAplicadoARS: true, montoAplicadoJUS: true },
    _avg: { valorJusAlAplic: true },
  });
  const totalCobradoPesos = lifetime.reduce((a, r) => a + numOrZero(r._sum?.montoAplicadoARS), 0);
  const totalCobradoJus = sumJus(lifetime);

  // PERÍODO por fechaAplicacion
  const f = toDateOrNull(from), t = toDateOrNull(to);
  let wherePeriod = { deletedAt: null, activo: true, honorarioId: { in: honorarioIds } };
  if (f || t) {
    wherePeriod = { ...wherePeriod, fechaAplicacion: {} };
    if (f) wherePeriod.fechaAplicacion.gte = f;
    if (t) wherePeriod.fechaAplicacion.lte = t;
  }
  const period = await prisma.ingresoHonorario.groupBy({
    by: ["honorarioId"],
    where: wherePeriod,
    _sum: { montoAplicadoARS: true, montoAplicadoJUS: true },
    _avg: { valorJusAlAplic: true },
  });
  const enPeriodoPesos = period.reduce((a, r) => a + numOrZero(r._sum?.montoAplicadoARS), 0);
  const enPeriodoJus = sumJus(period);

  return { totalCobradoJus, totalCobradoPesos, enPeriodoJus, enPeriodoPesos };
}

/* ========================= Endpoints ========================= */

/**
 * GET /api/finanzas/resumen/kpis?from=&to=&clienteId=&casoId=&estadoId=&refDate=
 * - Totales de honorarios (JUS y $ ref)
 * - Cobrado lifetime (JUS y $ equivalentes aplicados)
 * - Cobrado en período (JUS y $ equivalentes aplicados)
 * - Saldo actual (JUS) y conversión a ARS con JUS de refDate (si hay)
 */
export async function kpis(req, res, next) {
  try {
    const whereH = buildHonorarioWhere(req.query);
    const refDate = toDateOrNull(req.query.refDate) || new Date();

    const honorarios = await prisma.honorario.findMany({
      where: whereH,
      select: { id: true, jus: true, montoPesos: true, valorJusRef: true },
    });

    const { totalJus, totalPesosRef } = sumHonorarios(honorarios);

    const ids = honorarios.map(h => h.id);
    const { totalCobradoJus, totalCobradoPesos, enPeriodoJus, enPeriodoPesos } =
      await sumCobrosAplicadosHonorarios(ids, { from: req.query.from, to: req.query.to });

    const saldoJus = totalJus - totalCobradoJus;

    const vjRef = await getValorJusAt(refDate);
    const conv = (vjRef && vjRef > 0) ? vjRef : null;

    res.json({
      period: {
        from: toDateOrNull(req.query.from) || null,
        to: toDateOrNull(req.query.to) || null,
        refDate,
        valorJusRefDate: conv,
      },
      honorarios: {
        totalJus,
        totalPesosRef,
      },
      cobrado: {
        totalCobradoJus,
        totalCobradoPesos,
        enPeriodoJus,
        enPeriodoPesos,
      },
      saldo: {
        saldoJus,
        saldoArsARef: conv ? round2(saldoJus * conv) : null,
      },
      equivalenciasARef: conv ? {
        honorariosArsARef: round2(totalJus * conv),
        cobradoArsARef:    round2(totalCobradoJus * conv),
      } : null,
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/finanzas/resumen/serie?from=&to=&clienteId=&casoId=
 * Serie mensual de Ingresos ARS y Gastos ARS, y neto.
 * - Ingresos: usa montoPesosEquivalente (snapshot). Si falta, 0.
 * - Gastos: si cotizacionARS existe => monto * cotizacionARS; si no => monto (ARS).
 */
export async function serieIngresosGastos(req, res, next) {
  try {
    const now = new Date();
    const to = toDateOrNull(req.query.to) || endOfMonth(now);
    const from = toDateOrNull(req.query.from) || startOfMonth(new Date(now.getFullYear(), now.getMonth() - 11, 1));

    // Filtros opcionales
    const clienteId = intOrNull(req.query.clienteId);
    const casoId = intOrNull(req.query.casoId);

    // Ingresos en período
    const ingresos = await prisma.ingreso.findMany({
      where: {
        deletedAt: null, activo: true,
        fechaIngreso: { gte: from, lte: to },
        ...(clienteId !== undefined ? { clienteId } : {}),
        ...(casoId !== undefined ? { casoId } : {}),
      },
      select: { fechaIngreso: true, montoPesosEquivalente: true },
    });

    // Gastos en período
    const gastos = await prisma.gasto.findMany({
      where: {
        deletedAt: null, activo: true,
        fechaGasto: { gte: from, lte: to },
        ...(clienteId !== undefined ? { clienteId } : {}),
        ...(casoId !== undefined ? { casoId } : {}),
      },
      select: { fechaGasto: true, monto: true, cotizacionARS: true },
    });

    // Armar buckets mes a mes
    const buckets = {};
    const iter = new Date(startOfMonth(from));
    while (iter <= to) {
      buckets[ymKey(iter)] = { ingresosARS: 0, gastosARS: 0 };
      iter.setMonth(iter.getMonth() + 1);
    }

    for (const r of ingresos) {
      const d = new Date(r.fechaIngreso);
      const key = ymKey(d);
      if (!buckets[key]) buckets[key] = { ingresosARS: 0, gastosARS: 0 };
      const ars = numOrZero(r.montoPesosEquivalente);
      buckets[key].ingresosARS += ars;
    }

    for (const g of gastos) {
      const d = new Date(g.fechaGasto);
      const key = ymKey(d);
      if (!buckets[key]) buckets[key] = { ingresosARS: 0, gastosARS: 0 };
      const monto = numOrZero(g.monto);
      const tc = numOrZero(g.cotizacionARS);
      const ars = tc > 0 ? monto * tc : monto;
      buckets[key].gastosARS += ars;
    }

    const data = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, v]) => ({
        periodo,
        ingresosARS: round2(v.ingresosARS),
        gastosARS: round2(v.gastosARS),
        netoARS: round2(v.ingresosARS - v.gastosARS),
      }));

    res.json({ from, to, data });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/finanzas/resumen/top-deudores?limit=5
 * Top N clientes por saldo de honorarios (saldo actual en JUS).
 */
export async function topDeudores(req, res, next) {
  try {
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit ?? "5", 10)));
    const whereH = buildHonorarioWhere(req.query);

    const honorarios = await prisma.honorario.findMany({
      where: whereH,
      select: { id: true, clienteId: true, jus: true, montoPesos: true, valorJusRef: true },
    });
    if (!honorarios.length) return res.json({ data: [] });

    const { totalJusByCliente, idsByCliente } = (() => {
      const map = new Map(); // clienteId -> sumJus
      const idx = new Map(); // clienteId -> [honorarioIds]
      for (const h of honorarios) {
        const jus = numOrZero(h.jus);
        const pesos = numOrZero(h.montoPesos);
        const vj = numOrZero(h.valorJusRef);
        const hJus = jus > 0 ? jus : (vj > 0 && pesos > 0 ? pesos / vj : 0);
        map.set(h.clienteId, (map.get(h.clienteId) || 0) + hJus);
        idx.set(h.clienteId, (idx.get(h.clienteId) || []).concat(h.id));
      }
      return { totalJusByCliente: map, idsByCliente: idx };
    })();

    // Cobrado por honorario desde aplicaciones
    const apps = await prisma.ingresoHonorario.findMany({
      where: { deletedAt: null, activo: true, honorarioId: { in: honorarios.map(h => h.id) } },
      select: { honorarioId: true, montoAplicadoJUS: true, montoAplicadoARS: true, valorJusAlAplic: true },
    });

    const cobradoByHonorario = new Map();
    for (const a of apps) {
      const jus = a.montoAplicadoJUS != null
        ? numOrZero(a.montoAplicadoJUS)
        : (numOrZero(a.valorJusAlAplic) > 0 ? numOrZero(a.montoAplicadoARS) / numOrZero(a.valorJusAlAplic) : 0);
      cobradoByHonorario.set(a.honorarioId, numOrZero(cobradoByHonorario.get(a.honorarioId)) + jus);
    }

    const rows = [];
    for (const [clienteId, totalJus] of totalJusByCliente.entries()) {
      const ids = idsByCliente.get(clienteId) || [];
      const cobrado = ids.reduce((a,id) => a + numOrZero(cobradoByHonorario.get(id)), 0);
      rows.push({ clienteId, totalJus, cobradoJus: cobrado, saldoJus: totalJus - cobrado });
    }

    rows.sort((a,b) => b.saldoJus - a.saldoJus);
    const top = rows.slice(0, limit);
    const cliIds = top.map(r => r.clienteId);

    const clientes = await prisma.cliente.findMany({
      where: { id: { in: cliIds } },
      select: { id: true, apellido: true, nombre: true, razonSocial: true },
    });
    const byId = new Map(clientes.map(c => [c.id, c]));
    const displayNombre = (c) => {
      if (!c) return "";
      const rs = (c.razonSocial || "").trim();
      if (rs) return rs;
      const a = (c.apellido || "").trim();
      const n = (c.nombre || "").trim();
      return [a, n].filter(Boolean).join(" ") || `ID ${c.id}`;
    };

    res.json({
      data: top.map(r => ({
        clienteId: r.clienteId,
        cliente: displayNombre(byId.get(r.clienteId)),
        totalJus: round2(r.totalJus),
        cobradoJus: round2(r.cobradoJus),
        saldoJus: round2(r.saldoJus),
      })),
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/finanzas/resumen/top-casos?limit=5
 * Top N casos por saldo de honorarios (saldo actual en JUS).
 */
export async function topCasos(req, res, next) {
  try {
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit ?? "5", 10)));
    const whereH = buildHonorarioWhere(req.query);

    const honorarios = await prisma.honorario.findMany({
      where: whereH,
      select: { id: true, casoId: true, jus: true, montoPesos: true, valorJusRef: true },
    });
    if (!honorarios.length) return res.json({ data: [] });

    const { totalJusByCaso, idsByCaso } = (() => {
      const map = new Map(); // casoId -> sumJus
      const idx = new Map(); // casoId -> [honorarioIds]
      for (const h of honorarios) {
        const jus = numOrZero(h.jus);
        const pesos = numOrZero(h.montoPesos);
        const vj = numOrZero(h.valorJusRef);
        const hJus = jus > 0 ? jus : (vj > 0 && pesos > 0 ? pesos / vj : 0);
        const key = h.casoId ?? 0; // 0 = sin caso
        map.set(key, (map.get(key) || 0) + hJus);
        idx.set(key, (idx.get(key) || []).concat(h.id));
      }
      return { totalJusByCaso: map, idsByCaso: idx };
    })();

    // Cobrado por honorario desde aplicaciones
    const apps = await prisma.ingresoHonorario.findMany({
      where: { deletedAt: null, activo: true, honorarioId: { in: honorarios.map(h => h.id) } },
      select: { honorarioId: true, montoAplicadoJUS: true, montoAplicadoARS: true, valorJusAlAplic: true },
    });

    const cobradoByHonorario = new Map();
    for (const a of apps) {
      const jus = a.montoAplicadoJUS != null
        ? numOrZero(a.montoAplicadoJUS)
        : (numOrZero(a.valorJusAlAplic) > 0 ? numOrZero(a.montoAplicadoARS) / numOrZero(a.valorJusAlAplic) : 0);
      cobradoByHonorario.set(a.honorarioId, numOrZero(cobradoByHonorario.get(a.honorarioId)) + jus);
    }

    const rows = [];
    for (const [casoId, totalJus] of totalJusByCaso.entries()) {
      const ids = idsByCaso.get(casoId) || [];
      const cobrado = ids.reduce((a,id) => a + numOrZero(cobradoByHonorario.get(id)), 0);
      rows.push({ casoId: casoId || null, totalJus, cobradoJus: cobrado, saldoJus: totalJus - cobrado });
    }

    rows.sort((a,b) => b.saldoJus - a.saldoJus);
    const top = rows.slice(0, limit);

    const caseIds = top.map(r => r.casoId).filter(Boolean);
    const casos = await prisma.caso.findMany({
      where: { id: { in: caseIds } },
      select: { id: true, nroExpte: true, caratula: true },
    });
    const byId = new Map(casos.map(c => [c.id, c]));

    res.json({
      data: top.map(r => ({
        casoId: r.casoId,
        caso: r.casoId ? byId.get(r.casoId) : { id: null, nroExpte: null, caratula: "(sin caso)" },
        totalJus: round2(r.totalJus),
        cobradoJus: round2(r.cobradoJus),
        saldoJus: round2(r.saldoJus),
      })),
    });
  } catch (e) {
    next(e);
  }
}
