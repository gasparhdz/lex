// src/controllers/finanzas/finanzas-reportes.controller.js
import prisma from "../../utils/prisma.js";
import { parsePagination, intOrNull as intOrNullUtil, round2 as round2Util } from "../../utils/dataParsers.js";

/* ========================= Helpers ========================= */
function toDateOrNull(v) {
  if (v === null) return null;
  if (!v && v !== 0) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}
function intOrNull(v) {
  return intOrNullUtil(v);
}
function num(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}
const round2 = (n) => round2Util(n);
const round4  = (n) => Math.round(n * 10000) / 10000;

/** Valor de JUS en snapshot a una fecha (último <= fecha) o último disponible si no hay previos */
async function valorJUSAt(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  let row = await prisma.valorJUS.findFirst({ where: { fecha: { lte: d } }, orderBy: { fecha: "desc" } });
  if (!row) row = await prisma.valorJUS.findFirst({ orderBy: { fecha: "desc" } });
  return row?.valor ?? null;
}

/** Montos base de un honorario: totalJus y totalPesosRef (si viene solo uno, convierte usando valorJusRef) */
function computeHonorarioMontos(h) {
  const jus = num(h.jus);
  const pesos = num(h.montoPesos);
  const vj = num(h.valorJusRef);
  const totalJus = jus > 0 ? jus : (vj > 0 && pesos > 0 ? pesos / vj : 0);
  const totalPesosRef = pesos > 0 ? pesos : (vj > 0 && jus > 0 ? jus * vj : 0);
  return { totalJus, totalPesosRef, valorJusRef: vj || null };
}

/** Ingreso -> ARS normalizado (usa snapshot guardado) */
function ingresoARS(i) {
  return num(i.montoPesosEquivalente) || round2(num(i.valorJusAlCobro) * num(i.montoJusEquivalente));
}
/** Gasto -> ARS normalizado (ARS directo o monto*cotización si USD/EUR) */
function gastoARS(g) {
  const monto = num(g.monto);
  const tc = num(g.cotizacionARS);
  return tc > 0 ? round2(monto * tc) : round2(monto);
}
function keyByDate(d, group = "day") {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return group === "month" ? `${y}-${m}` : `${y}-${m}-${day}`;
}

/* ========================= Reportes ========================= */

/**
 * GET /api/finanzas/reportes/cobranzas-pendientes?clienteId=&casoId=&from=&to=&al=
 * Lista honorarios con saldo en JUS y equivalente ARS al valor JUS de la fecha de corte (?al=)
 */
export async function cobranzasPendientes(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req);
    const clienteId = intOrNull(req.query.clienteId);
    const casoId    = intOrNull(req.query.casoId);
    const from      = toDateOrNull(req.query.from);
    const to        = toDateOrNull(req.query.to);
    const al        = toDateOrNull(req.query.al) || new Date();

    const where = { deletedAt: null, activo: true };
    if (clienteId !== undefined) where.clienteId = clienteId;
    if (casoId !== undefined) where.casoId = casoId;
    if (from || to) {
      where.fechaRegulacion = {};
      if (from) where.fechaRegulacion.gte = from;
      if (to) where.fechaRegulacion.lte = to;
    }

    const [total, rows] = await Promise.all([
      prisma.honorario.count({ where }),
      prisma.honorario.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip, take,
        include: {
          cliente:  { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
          caso:     { select: { id: true, nroExpte: true, caratula: true } },
          concepto: { select: { id: true, nombre: true, codigo: true } },
        },
      }),
    ]);

    // Cobros acumulados por honorario HASTA la fecha de corte
    const ids = rows.map(r => r.id);
    let cobros = [];
    let planes = [];
    let cuotas = [];
    
    if (ids.length) {
      // Obtener planes de pago de los honorarios
      planes = await prisma.planPago.findMany({
        where: {
          honorarioId: { in: ids },
          deletedAt: null,
          activo: true,
        },
        select: { id: true, honorarioId: true },
      });
      
      const planIds = planes.map(p => p.id);

      if (planIds.length) {
        // Obtener cuotas de los planes
        cuotas = await prisma.planCuota.findMany({
          where: {
            planId: { in: planIds },
            deletedAt: null,
            activo: true,
            vencimiento: { lte: al },
          },
          select: { id: true, planId: true },
        });

        const cuotaIds = cuotas.map(c => c.id);

        if (cuotaIds.length) {
          // Obtener aplicaciones de ingresos a cuotas
          cobros = await prisma.ingresoCuota.findMany({
            where: {
              cuotaId: { in: cuotaIds },
              deletedAt: null,
              activo: true,
              fechaAplicacion: { lte: al },
            },
            select: { cuotaId: true, montoAplicadoJUS: true },
          });
        }
      }
    }

    // Mapear aplicaciones a honorarios
    const cobrosSumMap = {};
    for (const c of cobros) {
      const cuota = cuotas.find(cu => cu.id === c.cuotaId);
      if (cuota) {
        const plan = planes.find(p => p.id === cuota.planId);
        if (plan) {
          const honorarioId = plan.honorarioId;
          cobrosSumMap[honorarioId] = (cobrosSumMap[honorarioId] || 0) + num(c.montoAplicadoJUS);
        }
      }
    }

    const vjCorte = await valorJUSAt(al);
    
    // Agrupar por cliente
    const byClienteMap = new Map();
    
    for (const h of rows) {
      const { totalJus, totalPesosRef, valorJusRef } = computeHonorarioMontos(h);
      const cobradoJus = num(cobrosSumMap[h.id]);
      const saldoJus = round2(Math.max(0, totalJus - cobradoJus));
      const saldoARSAlCorte = vjCorte ? round2(saldoJus * vjCorte) : null;
      const percCobrado = totalJus > 0 ? Math.max(0, Math.min(1, cobradoJus / totalJus)) : 0;

      const clienteKey = h.clienteId || 0;
      
      if (!byClienteMap.has(clienteKey)) {
        byClienteMap.set(clienteKey, {
          clienteId: h.clienteId,
          cliente: h.cliente,
          honorarios: [],
          totalTotalJus: 0,
          totalCobradoJus: 0,
          totalSaldoJus: 0,
          totalSaldoARS: 0,
        });
      }
      
      const entry = byClienteMap.get(clienteKey);
      entry.honorarios.push({
        id: h.id,
        concepto: h.concepto,
        caso: h.caso,
        calc: {
          totalJus: round2(totalJus),
          totalPesosRef: round2(totalPesosRef),
          valorJusRef,
          cobradoJus: round2(cobradoJus),
          saldoJus,
          saldoARSAlCorte,
          vjCorte: vjCorte ? round4(vjCorte) : null,
          percCobrado,
        },
      });
      
      entry.totalTotalJus = round2(entry.totalTotalJus + totalJus);
      entry.totalCobradoJus = round2(entry.totalCobradoJus + cobradoJus);
      entry.totalSaldoJus = round2(entry.totalSaldoJus + saldoJus);
      entry.totalSaldoARS = round2(entry.totalSaldoARS + (saldoARSAlCorte || 0));
    }
    
    const data = Array.from(byClienteMap.values());

    res.json({ data, page, pageSize, total, corte: al });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/finanzas/reportes/ingresos-periodo?from=YYYY-MM-DD&to=YYYY-MM-DD&group=day|month&clienteId=&casoId=&tipoId=&monedaId=
 * Devuelve series y totales (ARS normalizado)
 */
export async function ingresosPeriodo(req, res, next) {
  try {
    const from = toDateOrNull(req.query.from);
    const to   = toDateOrNull(req.query.to);
    const group = (String(req.query.group || "day").toLowerCase() === "month") ? "month" : "day";
    const clienteId = intOrNull(req.query.clienteId);
    const casoId    = intOrNull(req.query.casoId);
    const tipoId    = intOrNull(req.query.tipoId);
    const monedaId  = intOrNull(req.query.monedaId);

    const where = { deletedAt: null, activo: true };
    if (from || to) {
      where.fechaIngreso = {};
      if (from) where.fechaIngreso.gte = from;
      if (to) where.fechaIngreso.lte = to;
    }
    if (clienteId !== undefined) where.clienteId = clienteId;
    if (casoId !== undefined) where.casoId = casoId;
    if (tipoId !== undefined) where.tipoId = tipoId;
    if (monedaId !== undefined) where.monedaId = monedaId;

    const rows = await prisma.ingreso.findMany({
      where,
      orderBy: { fechaIngreso: "asc" },
      select: {
        id: true, fechaIngreso: true,
        montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true,
      },
    });

    const bucket = {};
    let total = 0;
    for (const r of rows) {
      const d = new Date(r.fechaIngreso);
      const k = keyByDate(d, group);
      const v = ingresoARS(r);
      total += v;
      bucket[k] = round2((bucket[k] || 0) + v);
    }

    const series = Object.entries(bucket)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ key: k, totalARS: round2(v) }));

    res.json({ group, series, totalARS: round2(total) });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/finanzas/reportes/gastos-periodo?from=&to=&group=day|month&clienteId=&casoId=&conceptoId=&monedaId=
 */
export async function gastosPeriodo(req, res, next) {
  try {
    const from = toDateOrNull(req.query.from);
    const to   = toDateOrNull(req.query.to);
    const group = (String(req.query.group || "day").toLowerCase() === "month") ? "month" : "day";
    const clienteId = intOrNull(req.query.clienteId);
    const casoId    = intOrNull(req.query.casoId);
    const conceptoId= intOrNull(req.query.conceptoId);
    const monedaId  = intOrNull(req.query.monedaId);

    const where = { deletedAt: null, activo: true };
    if (from || to) {
      where.fechaGasto = {};
      if (from) where.fechaGasto.gte = from;
      if (to) where.fechaGasto.lte = to;
    }
    if (clienteId !== undefined) where.clienteId = clienteId;
    if (casoId !== undefined) where.casoId = casoId;
    if (conceptoId !== undefined) where.conceptoId = conceptoId;
    if (monedaId !== undefined) where.monedaId = monedaId;

    const rows = await prisma.gasto.findMany({
      where,
      orderBy: { fechaGasto: "asc" },
      select: { id: true, fechaGasto: true, monto: true, cotizacionARS: true },
    });

    const bucket = {};
    let total = 0;
    for (const r of rows) {
      const d = new Date(r.fechaGasto);
      const k = keyByDate(d, group);
      const v = gastoARS(r);
      total += v;
      bucket[k] = round2((bucket[k] || 0) + v);
    }

    const series = Object.entries(bucket)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ key: k, totalARS: round2(v) }));

    res.json({ group, series, totalARS: round2(total) });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/finanzas/reportes/flujo-caja?from=&to=&group=day|month
 * Retorna { ingresosARS, gastosARS, netoARS } por bucket + totales
 */
export async function flujoCaja(req, res, next) {
  try {
    const from = toDateOrNull(req.query.from);
    const to   = toDateOrNull(req.query.to);
    const group = (String(req.query.group || "day").toLowerCase() === "month") ? "month" : "day";

    // Ingresos
    const wIng = { deletedAt: null, activo: true };
    if (from || to) {
      wIng.fechaIngreso = {};
      if (from) wIng.fechaIngreso.gte = from;
      if (to) wIng.fechaIngreso.lte = to;
    }
    const ingresos = await prisma.ingreso.findMany({
      where: wIng,
      orderBy: { fechaIngreso: "asc" },
      select: { fechaIngreso: true, montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true },
    });

    // Gastos
    const wGas = { deletedAt: null, activo: true };
    if (from || to) {
      wGas.fechaGasto = {};
      if (from) wGas.fechaGasto.gte = from;
      if (to) wGas.fechaGasto.lte = to;
    }
    const gastos = await prisma.gasto.findMany({
      where: wGas,
      orderBy: { fechaGasto: "asc" },
      select: { fechaGasto: true, monto: true, cotizacionARS: true },
    });

    const bucket = {};
    let totalIng = 0, totalGas = 0;

    for (const r of ingresos) {
      const k = keyByDate(new Date(r.fechaIngreso), group);
      const v = ingresoARS(r);
      totalIng += v;
      (bucket[k] ||= { ingresosARS: 0, gastosARS: 0 });
      bucket[k].ingresosARS = round2(bucket[k].ingresosARS + v);
    }
    for (const g of gastos) {
      const k = keyByDate(new Date(g.fechaGasto), group);
      const v = gastoARS(g);
      totalGas += v;
      (bucket[k] ||= { ingresosARS: 0, gastosARS: 0 });
      bucket[k].gastosARS = round2(bucket[k].gastosARS + v);
    }

    const series = Object.entries(bucket)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, o]) => ({ key: k, ingresosARS: o.ingresosARS, gastosARS: o.gastosARS, netoARS: round2(o.ingresosARS - o.gastosARS) }));

    res.json({
      group,
      series,
      totals: {
        ingresosARS: round2(totalIng),
        gastosARS: round2(totalGas),
        netoARS: round2(totalIng - totalGas),
      },
    });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/finanzas/reportes/honorarios-por-cliente?from=&to=&clienteId=&casoId=
 * Agrega por cliente: totalJus/cobradoJus/saldoJus y saldos ARS al valor JUS de hoy (o ?al=)
 */
export async function honorariosPorCliente(req, res, next) {
  try {
    const from      = toDateOrNull(req.query.from);
    const to        = toDateOrNull(req.query.to);
    const al        = toDateOrNull(req.query.al) || new Date();
    const clienteId = intOrNull(req.query.clienteId);
    const casoId    = intOrNull(req.query.casoId);

    const where = { deletedAt: null, activo: true };
    if (from || to) {
      where.fechaRegulacion = {};
      if (from) where.fechaRegulacion.gte = from;
      if (to) where.fechaRegulacion.lte = to;
    }
    if (clienteId !== undefined) where.clienteId = clienteId;
    if (casoId !== undefined) where.casoId = casoId;

    const honorarios = await prisma.honorario.findMany({
      where,
      select: {
        id: true, clienteId: true, casoId: true, jus: true, montoPesos: true, valorJusRef: true,
        cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
      },
    });

    const ids = honorarios.map(h => h.id);
    let cobros = [];
    if (ids.length) {
      cobros = await prisma.ingreso.findMany({
        where: { honorarioId: { in: ids }, deletedAt: null, activo: true, fechaIngreso: { lte: al } },
        select: { honorarioId: true, montoJusEquivalente: true },
      });
    }
    const cobrosSumMap = {};
    for (const c of cobros) {
      cobrosSumMap[c.honorarioId] = (cobrosSumMap[c.honorarioId] || 0) + num(c.montoJusEquivalente);
    }

    const vj = await valorJUSAt(al);
    const agg = new Map(); // key: clienteId

    for (const h of honorarios) {
      const { totalJus } = computeHonorarioMontos(h);
      const cobradoJus = num(cobrosSumMap[h.id]);
      const saldoJus = Math.max(0, totalJus - cobradoJus);

      const k = String(h.clienteId);
      const entry = agg.get(k) || {
        clienteId: h.clienteId,
        cliente: h.cliente,
        totalJus: 0,
        cobradoJus: 0,
        saldoJus: 0,
      };
      entry.totalJus  = round2(entry.totalJus + totalJus);
      entry.cobradoJus= round2(entry.cobradoJus + cobradoJus);
      entry.saldoJus  = round2(entry.saldoJus + saldoJus);
      agg.set(k, entry);
    }

    const data = Array.from(agg.values()).map((r) => ({
      ...r,
      saldoARSAlCorte: vj ? round2(r.saldoJus * vj) : null,
      percCobrado: r.totalJus > 0 ? Math.max(0, Math.min(1, r.cobradoJus / r.totalJus)) : 0,
    })).sort((a, b) => b.saldoJus - a.saldoJus);

    res.json({ al, valorJUS: vj, data });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/finanzas/reportes/gastos-pendientes-reintegro?clienteId=&casoId=&from=&to=
 * Devuelve gastos con saldo (no totalmente aplicados contra ingresos) y su saldo en ARS.
 */
export async function gastosPendientesReintegro(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req);
    const clienteId = intOrNull(req.query.clienteId);
    const casoId    = intOrNull(req.query.casoId);
    const from      = toDateOrNull(req.query.from);
    const to        = toDateOrNull(req.query.to);

    const where = { deletedAt: null, activo: true };
    if (clienteId !== undefined) where.clienteId = clienteId;
    if (casoId !== undefined) where.casoId = casoId;
    if (from || to) {
      where.fechaGasto = {};
      if (from) where.fechaGasto.gte = from;
      if (to) where.fechaGasto.lte = to;
    }

    const [total, rows] = await Promise.all([
      prisma.gasto.count({ where }),
      prisma.gasto.findMany({
        where,
        orderBy: { fechaGasto: "desc" },
        skip, take,
        include: {
          cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
          caso:    { select: { id: true, nroExpte: true, caratula: true } },
        },
      }),
    ]);

    // Montos aplicados por gasto
    const ids = rows.map(g => g.id);
    let apps = [];
    if (ids.length) {
      apps = await prisma.ingresoGasto.groupBy({
        by: ["gastoId"],
        where: { gastoId: { in: ids }, deletedAt: null, activo: true },
        _sum: { montoAplicadoARS: true },
      });
    }
    const appMap = {};
    for (const a of apps) appMap[a.gastoId] = num(a._sum.montoAplicadoARS);

    const data = rows.map((g) => {
      const total = gastoARS(g);
      const aplicado = num(appMap[g.id]);
      const saldo = round2(Math.max(0, total - aplicado));
      return {
        ...g,
        calc: { totalARS: total, aplicadoARS: aplicado, saldoARS: saldo },
      };
    });

    // El total real es el de TODOS los gastos (no solo pendientes)
    const actualTotal = data.length;

    res.json({ data, page, pageSize, total: actualTotal });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/finanzas/reportes/vencimientos-periodo?mes=&anio=
 * Devuelve las cuotas que vencen en el mes/anio especificado (o mes actual si no se especifica)
 */
export async function vencimientosPeriodo(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req);
    const mes = intOrNull(req.query.mes) || new Date().getMonth() + 1;
    const anio = intOrNull(req.query.anio) || new Date().getFullYear();

    // Primer día y último día del mes
    const startDate = new Date(anio, mes - 1, 1);
    const endDate = new Date(anio, mes, 0, 23, 59, 59);

    // Obtener cuotas vencidas en el período que NO estén pagadas completamente
    const where = {
      deletedAt: null,
      activo: true,
      vencimiento: { gte: startDate, lte: endDate },
    };

    const [total, cuotas] = await Promise.all([
      prisma.planCuota.count({ where }),
      prisma.planCuota.findMany({
        where,
        orderBy: { vencimiento: "asc" },
        skip,
        take,
        include: {
          plan: {
            include: {
              honorario: {
                include: {
                  cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
                  caso: { select: { id: true, nroExpte: true, caratula: true } },
                },
              },
            },
          },
          estado: { select: { id: true, codigo: true, nombre: true } },
        },
      }),
    ]);

    // Obtener aplicaciones de ingresos para calcular lo pagado
    const cuotaIds = cuotas.map(c => c.id);
    let apps = [];
    if (cuotaIds.length) {
      apps = await prisma.ingresoCuota.findMany({
        where: { cuotaId: { in: cuotaIds }, deletedAt: null, activo: true },
        select: { cuotaId: true, montoAplicadoARS: true },
      });
    }

    const appMap = {};
    for (const a of apps) {
      appMap[a.cuotaId] = (appMap[a.cuotaId] || 0) + num(a.montoAplicadoARS);
    }

    // Calcular montos para cada cuota
    const data = [];
    for (const c of cuotas) {
      // Calcular monto total en ARS
      const montoJus = num(c.montoJus);
      const montoPesos = num(c.montoPesos);
      
      let valorJusRef = num(c.valorJusRef);
      // Si no hay snapshot en la cuota, obtener el valor JUS de la fecha de vencimiento
      if (!valorJusRef || valorJusRef === 0) {
        const vjAtFecha = await valorJUSAt(c.vencimiento);
        valorJusRef = vjAtFecha || 1; // Si tampoco hay valor JUS, usar 1 como fallback
      }
      
      // Si montoPesos > 0, usarlo. Sino, calcular desde JUS con valorJusRef
      const montoTotal = montoPesos > 0 ? montoPesos : (montoJus * valorJusRef);
      
      const pagado = num(appMap[c.id]);
      const saldo = round2(Math.max(0, montoTotal - pagado));
      const percPagado = montoTotal > 0 ? Math.round((pagado / montoTotal) * 100) : 0;
      
      data.push({
        ...c,
        calc: { montoTotal: round2(montoTotal), pagado, saldo, percPagado, pagadoARS: pagado },
      });
    }

    res.json({ data, page, pageSize, total, mes, anio });
  } catch (e) {
    next(e);
  }
}
