// src/controllers/finanzas/ingreso-cuota.controller.js
import prisma from "../../utils/prisma.js";
import {
  listarAplicacionesCuotaQuerySchema,
  crearAplicacionCuotaSchema,
  actualizarAplicacionCuotaSchema,
} from "../../validators/finanzas/ingreso-cuota.schema.js";

// 👇 NUEVO: import del recompute del honorario (exportalo en honorario.controller)
let recomputeHonorarioEstadoSaldo = null;
try {
  const mod = await import("./honorario.controller.js");
  recomputeHonorarioEstadoSaldo = mod?.recomputeHonorarioEstadoSaldo ?? null;
} catch {
  recomputeHonorarioEstadoSaldo = null;
}

/* ========================= Helpers ========================= */
function toNum(x, d = 0) {
  if (x === null || x === undefined) return d;
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}
function round2(n) {
  return Math.round(toNum(n, 0) * 100) / 100;
}
function round6(n) {
  return Math.round(toNum(n, 0) * 1000000) / 1000000;
}

/** Helper para extraer mensajes de error de Zod de forma robusta */
function getZodErrorMessages(zodError) {
  if (!zodError) return "Error de validación";
  const issues = zodError?.issues || zodError?.errors || [];
  if (Array.isArray(issues) && issues.length > 0) {
    return issues.map(e => e?.message || String(e)).join(", ");
  }
  return zodError?.message || "Error de validación";
}

/** Total ARS del ingreso (preferimos snapshot guardado) */
function ingresoTotalARS(i) {
  return (
    toNum(i.montoPesosEquivalente) ||
    round2(toNum(i.valorJusAlCobro) * toNum(i.montoJusEquivalente))
  );
}

/** Total ARS de la cuota (montoPesos o montoJus * valorJusRef) */
function cuotaTotalARS(c) {
  const pes = toNum(c.montoPesos);
  if (pes > 0) return round2(pes);
  const jus = toNum(c.montoJus);
  const vj  = toNum(c.valorJusRef);
  return jus > 0 && vj > 0 ? round2(jus * vj) : 0;
}

/** Sumas aplicadas */
async function sumAplicadoDesdeIngreso(ingresoId) {
  const rows = await prisma.ingresoCuota.aggregate({
    _sum: { montoAplicadoARS: true },
    where: { ingresoId: Number(ingresoId), deletedAt: null, activo: true },
  });
  return toNum(rows._sum.montoAplicadoARS);
}
async function sumAplicadoEnCuota(cuotaId) {
  const rows = await prisma.ingresoCuota.aggregate({
    _sum: { montoAplicadoARS: true },
    where: { cuotaId: Number(cuotaId), deletedAt: null, activo: true },
  });
  return toNum(rows._sum.montoAplicadoARS);
}

/** Snapshot JUS por fecha */
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

function esCuotaJUS(c) {
  const jus = toNum(c.montoJus);
  const pes = toNum(c.montoPesos);
  return jus > 0 && pes <= 0;
}

/* ===== Estados de cuota ===== */
const EST = {
  PENDIENTE: "PENDIENTE",
  PARCIAL:   "PARCIAL",
  PAGADA:    "PAGADA",
  VENCIDA:   "VENCIDA",
  CONDONADA: "CONDONADA",
};

// Cache en memoria del ID de categoría EstadoCuota
let _estadoCuotaCatId = null;
async function resolveEstadoCuotaCategoriaId(tx) {
  if (_estadoCuotaCatId) return _estadoCuotaCatId;
  const candidatos = [
    { codigo: "ESTADO_CUOTA" },
    { codigo: "ESTADO CUOTA" },
    { codigo: "EstadoCuota" },
    { nombre: "Estado de Cuota" },
    { nombre: "Estado Cuota" },
  ];
  for (const c of candidatos) {
    const cat = await tx.categoria.findFirst({
      where: {
        ...(c.codigo ? { codigo: c.codigo } : {}),
        ...(c.nombre ? { nombre: c.nombre } : {}),
      },
      select: { id: true },
    });
    if (cat?.id) {
      _estadoCuotaCatId = cat.id;
      return _estadoCuotaCatId;
    }
  }
  const fallback = await tx.categoria.findFirst({
    where: {
      OR: [
        { codigo: { contains: "CUOTA", mode: "insensitive" } },
        { nombre: { contains: "CUOTA", mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  if (fallback?.id) {
    _estadoCuotaCatId = fallback.id;
    return _estadoCuotaCatId;
  }
  return null;
}

async function getEstadosMap(tx) {
  const catId = await resolveEstadoCuotaCategoriaId(tx);
  if (!catId) return {};
  const rows = await tx.parametro.findMany({
    where: { categoriaId: catId, activo: true },
    select: { id: true, codigo: true, nombre: true },
  });
  const map = {};
  for (const r of rows) {
    if (r.codigo) map[String(r.codigo).trim().toUpperCase()] = r.id;
    if (r.nombre) map[String(r.nombre).trim().toUpperCase()] = r.id;
  }
  return map;
}

/**
 * Recalcula y actualiza el estadoId de una PlanCuota según lo aplicado.
 * Exportamos para reuso desde ingreso.controller (orquestador).
 */
export async function recalcularEstadoCuota(tx, cuotaId) {
  const cuota = await tx.planCuota.findFirst({
    where: { id: Number(cuotaId), deletedAt: null, activo: true },
    select: { id: true, montoJus: true, montoPesos: true, vencimiento: true, estadoId: true },
  });
  if (!cuota) return;

  const agg = await tx.ingresoCuota.aggregate({
    _sum: { montoAplicadoARS: true, montoAplicadoJUS: true },
    where: { cuotaId: Number(cuotaId), deletedAt: null, activo: true },
  });
  const aplARS = toNum(agg._sum.montoAplicadoARS);
  const aplJUS = toNum(agg._sum.montoAplicadoJUS);

  const epsilonARS = 0.01;
  const epsilonJUS = 1e-6;

  let pagada = false;
  if (toNum(cuota.montoJus) > 0) {
    const totalJUS = toNum(cuota.montoJus);
    pagada = aplJUS >= (totalJUS - epsilonJUS);
  } else {
    const totalARS = toNum(cuota.montoPesos);
    pagada = aplARS >= (totalARS - epsilonARS);
  }

  let estadoKey;
  if (pagada) {
    estadoKey = EST.PAGADA;
  } else if (cuota.vencimiento && new Date(cuota.vencimiento) < new Date()) {
    estadoKey = EST.VENCIDA;
  } else if (aplARS > 0 || aplJUS > 0) {
    estadoKey = EST.PARCIAL;
  } else {
    estadoKey = EST.PENDIENTE;
  }

  const map = await getEstadosMap(tx);
  const nuevoEstadoId =
    map[estadoKey] ??
    (estadoKey === EST.PARCIAL ? map[EST.PENDIENTE] : null);

  if (nuevoEstadoId && nuevoEstadoId !== cuota.estadoId) {
    await tx.planCuota.update({
      where: { id: Number(cuotaId) },
      data: { estadoId: nuevoEstadoId },
    });
  }
}

/* ========================= Resúmenes ========================= */

/** GET /api/finanzas/aplicaciones/cuotas/ingreso/:ingresoId/resumen */
export async function resumenIngresoCuotas(req, res, next) {
  try {
    const ingresoId = Number(req.params.ingresoId);
    if (!Number.isInteger(ingresoId)) return next({ status: 400, publicMessage: "ID inválido" });

    const i = await prisma.ingreso.findFirst({
      where: { id: ingresoId, deletedAt: null, activo: true },
      select: {
        id: true, fechaIngreso: true,
        montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true,
      },
    });
    if (!i) return next({ status: 404, publicMessage: "Ingreso no encontrado" });

    const totalARS = ingresoTotalARS(i);
    const aplicadoARS = await sumAplicadoDesdeIngreso(ingresoId);
    const saldoARS = round2(totalARS - aplicadoARS);

    res.json({ ingresoId, totalARS, aplicadoARS, saldoARS, ingreso: i });
  } catch (e) {
    console.error("[ingreso-cuota] error en resumenIngresoCuotas:", e);
    next(e);
  }
}

/** GET /api/finanzas/aplicaciones/cuotas/cuota/:cuotaId/resumen */
export async function resumenCuota(req, res, next) {
  try {
    const cuotaId = Number(req.params.cuotaId);
    if (!Number.isInteger(cuotaId)) return next({ status: 400, publicMessage: "ID inválido" });

    const c = await prisma.planCuota.findFirst({
      where: { id: cuotaId, deletedAt: null, activo: true },
      select: { id: true, numero: true, vencimiento: true, montoJus: true, montoPesos: true, valorJusRef: true, planId: true },
    });
    if (!c) return next({ status: 404, publicMessage: "Cuota no encontrada" });

    const totalARS = cuotaTotalARS(c);
    const aplicadoARS = await sumAplicadoEnCuota(cuotaId);
    const saldoARS = round2(totalARS - aplicadoARS);

    res.json({ cuotaId, totalARS, aplicadoARS, saldoARS, cuota: c });
  } catch (e) {
    console.error("[ingreso-cuota] error en resumenCuota:", e);
    next(e);
  }
}

/* ========================= CRUD Aplicaciones ========================= */

/**
 * GET /api/finanzas/aplicaciones/cuotas?ingresoId= | cuotaId= & page=&pageSize=
 */
export async function listar(req, res, next) {
  try {
    const parsed = listarAplicacionesCuotaQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return next({
        status: 400,
        publicMessage: getZodErrorMessages(parsed.error) || "Parámetros de consulta inválidos",
      });
    }
    const q = parsed.data;

    const page = Math.max(1, Number(q.page ?? 1));
    const pageSize = Math.min(500, Math.max(1, Number(q.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const ingresoId = q.ingresoId != null ? Number(q.ingresoId) : undefined;
    const cuotaId   = q.cuotaId   != null ? Number(q.cuotaId)   : undefined;

    const where = {
      deletedAt: null,
      activo: true,
      ...(Number.isFinite(ingresoId) ? { ingresoId } : {}),
      ...(Number.isFinite(cuotaId) ? { cuotaId } : {}),
    };

    const [total, dataDb] = await Promise.all([
      prisma.ingresoCuota.count({ where }),
      prisma.ingresoCuota.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          ingreso: {
            select: {
              id: true, fechaIngreso: true, descripcion: true,
              montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true,
              clienteId: true, casoId: true,
            },
          },
          cuota: {
            select: {
              id: true, numero: true, vencimiento: true,
              montoJus: true, montoPesos: true, valorJusRef: true,
              planId: true,
            },
          },
        },
      }),
    ]);

    let honorByPlanId = {};
    try {
      const planIds = Array.from(new Set(dataDb.map(r => r?.cuota?.planId).filter(Boolean)));
      if (planIds.length && prisma.planPago) {
        const planes = await prisma.planPago.findMany({
          where: { id: { in: planIds } },
          select: { id: true, honorarioId: true },
        });
        honorByPlanId = Object.fromEntries(planes.map(p => [p.id, p.honorarioId]));
      }
    } catch (e) {
      console.warn("[ingreso-cuota] listar: mapeo honorario opcional fallido:", e?.message || e);
    }

    const rows = dataDb.map(r => ({
      ...r,
      monto: toNum(r.montoAplicadoARS),
      honorarioId: honorByPlanId?.[r?.cuota?.planId] ?? null,
      cuota: { ...r.cuota, honorarioId: honorByPlanId?.[r?.cuota?.planId] ?? null },
    }));

    res.json({ rows, data: rows, page, pageSize, total });
  } catch (e) {
    console.error("[ingreso-cuota] error en listar:", e);
    next(e);
  }
}

/** GET /api/finanzas/aplicaciones/cuotas/:id */
export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const row = await prisma.ingresoCuota.findFirst({
      where: { id, deletedAt: null },
      include: {
        ingreso: {
          select: {
            id: true, fechaIngreso: true, descripcion: true,
            montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true,
          },
        },
        cuota: {
          select: { id: true, numero: true, vencimiento: true, montoJus: true, montoPesos: true, valorJusRef: true, planId: true },
        },
      },
    });
    if (!row) return next({ status: 404, publicMessage: "Aplicación no encontrada" });

    res.json(row);
  } catch (e) {
    console.error("[ingreso-cuota] error en obtener:", e);
    next(e);
  }
}

/**
 * POST /api/finanzas/aplicaciones/cuotas
 * body: { ingresoId, cuotaId, monto }  // monto en ARS
 */
export async function crear(req, res, next) {
  try {
    const parsed = crearAplicacionCuotaSchema.safeParse(req.body);
    if (!parsed.success) {
      return next({ status: 400, publicMessage: getZodErrorMessages(parsed.error) });
    }
    const { ingresoId, cuotaId, monto } = parsed.data;
    const createdBy = req.user?.id ?? null;

    const result = await prisma.$transaction(async (tx) => {
      // Ingreso
      const ingreso = await tx.ingreso.findFirst({
        where: { id: Number(ingresoId), deletedAt: null, activo: true },
        select: {
          id: true, fechaIngreso: true,
          montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true,
        },
      });
      if (!ingreso) throw { status: 404, publicMessage: "Ingreso no encontrado" };

      const ingresoTotal = ingresoTotalARS(ingreso);
      const ingresoAplicado = toNum(
        (await tx.ingresoCuota.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { ingresoId: Number(ingresoId), deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );
      const ingresoSaldoARS = round2(ingresoTotal - ingresoAplicado);

              // Fecha y snapshot JUS
        const fechaAplicacion = ingreso.fechaIngreso ?? new Date();
        const vjIngreso = toNum(ingreso.valorJusAlCobro) || (await findValorJusSnapshot(fechaAplicacion));

        // Cuota con plan (para obtener política JUS)
        const cuota = await tx.planCuota.findFirst({
          where: { id: Number(cuotaId), deletedAt: null, activo: true },
          select: { 
            id: true, 
            montoJus: true, 
            montoPesos: true, 
            valorJusRef: true, 
            vencimiento: true, 
            planId: true,
            plan: {
              select: {
                politicaJusId: true,
              },
            },
          },
        });
        if (!cuota) throw { status: 404, publicMessage: "Cuota no encontrada" };

        // Determinar el valor JUS a usar para los cálculos:
        // - Si la cuota ya tiene valorJusRef, usarlo (para cuotas ya pagadas parcialmente)
        // - Si no tiene valorJusRef y es política AL_COBRO, usar el valor JUS del ingreso y asignarlo a la cuota
        // - Si no tiene valorJusRef y es política FECHA_REGULACION, usar el valor JUS del ingreso (pero no asignarlo, debería estar ya asignado)
        let vjParaCalculos = toNum(cuota.valorJusRef);
        const poli = Number(cuota.plan?.politicaJusId || 168); // default: FECHA_REGULACION
        const esALCobro = poli === 169;

        if (esCuotaJUS(cuota)) {
          if (!vjParaCalculos && esALCobro && vjIngreso > 0) {
            // Política AL_COBRO: asignar valorJusRef de la cuota con el valor JUS del ingreso
            await tx.planCuota.update({
              where: { id: Number(cuotaId) },
              data: { valorJusRef: vjIngreso },
            });
            vjParaCalculos = vjIngreso;
          } else if (!vjParaCalculos) {
            // Si no tiene valorJusRef y no es AL_COBRO, usar el valor JUS del ingreso para cálculos
            vjParaCalculos = vjIngreso;
          }
          // Si ya tiene valorJusRef, lo usamos (no lo cambiamos)
        }

        let maxCuotaAplicableARS;
        if (esCuotaJUS(cuota)) {
          const totalJUS = toNum(cuota.montoJus);
          const aplicadoJUS = toNum(
            (await tx.ingresoCuota.aggregate({
              _sum: { montoAplicadoJUS: true },
              where: { cuotaId: Number(cuotaId), deletedAt: null, activo: true },
            }))._sum.montoAplicadoJUS
          );
          // ✅ NO redondear saldoJUS aquí - mantener precisión hasta multiplicar por vj
          const saldoJUS = totalJUS - aplicadoJUS;
          if (!(vjParaCalculos > 0)) {
            throw { status: 400, publicMessage: "No se pudo obtener el valor JUS para la fecha de aplicación" };
          }
          // ✅ Redondear solo al final, después de multiplicar
          maxCuotaAplicableARS = round2(Math.max(0, saldoJUS) * vjParaCalculos);
        } else {
          const totalARS = cuotaTotalARS(cuota);
          const aplicadoARS = toNum(
            (await tx.ingresoCuota.aggregate({
              _sum: { montoAplicadoARS: true },
              where: { cuotaId: Number(cuotaId), deletedAt: null, activo: true },
            }))._sum.montoAplicadoARS
          );
          maxCuotaAplicableARS = round2(totalARS - aplicadoARS);
        }

      const maxAplicable = Math.max(0, Math.min(ingresoSaldoARS, maxCuotaAplicableARS));
      if (toNum(monto) > maxAplicable) {
        throw { status: 400, publicMessage: `Monto supera el disponible. Máximo aplicable ARS ${maxAplicable.toFixed(2)}` };
      }

              // Usar vjParaCalculos si es cuota JUS, sino usar vjIngreso
        const vjParaAplic = esCuotaJUS(cuota) && vjParaCalculos > 0 ? vjParaCalculos : vjIngreso;

        // ✅ Calcular montoAplicadoJUS ANTES de redondear montoAplicadoARS para mantener precisión
        const montoNum = toNum(monto);
        const montoAplicadoARSFinal = round2(montoNum);
        const montoAplicadoJUSFinal = vjParaAplic ? round6(montoNum / vjParaAplic) : null;

        const app = await tx.ingresoCuota.create({
          data: {
            ingresoId: Number(ingresoId),
            cuotaId: Number(cuotaId),
            fechaAplicacion,
            montoAplicadoARS: montoAplicadoARSFinal,
            valorJusAlAplic: vjParaAplic || null,
            montoAplicadoJUS: montoAplicadoJUSFinal,
            createdBy,
          },
        });

      await recalcularEstadoCuota(tx, Number(cuotaId));

      // 👇 NUEVO: obtener honorarioId para recomputar luego
      const plan = await tx.planCuota.findUnique({
        where: { id: Number(cuotaId) },
        select: { plan: { select: { honorarioId: true } } },
      });
      const honorarioId = plan?.plan?.honorarioId ?? null;

      // Resúmenes post
      const nuevoAplicadoIngreso = toNum(
        (await tx.ingresoCuota.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { ingresoId: Number(ingresoId), deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );
      const nuevoSaldoIngreso = round2(ingresoTotal - nuevoAplicadoIngreso);

              const nuevoAplicadoCuota = toNum(
          (await tx.ingresoCuota.aggregate({
            _sum: { montoAplicadoARS: true },
            where: { cuotaId: Number(cuotaId), deletedAt: null, activo: true },
          }))._sum.montoAplicadoARS
        );
        // Para el resumen, usar vjParaCalculos si la cuota fue actualizada, sino usar el valor actualizado de la cuota
        const vjParaResumen = esCuotaJUS(cuota) ? (vjParaCalculos > 0 ? vjParaCalculos : toNum(cuota.valorJusRef)) : null;
        const cuotaTotalARSForResumen = esCuotaJUS(cuota) && vjParaResumen
          ? round2(toNum(cuota.montoJus) * vjParaResumen)
          : cuotaTotalARS(cuota);
        const nuevoSaldoCuota = round2(cuotaTotalARSForResumen - nuevoAplicadoCuota);

      return {
        app,
        honorarioId, // << NUEVO
        resumen: {
          ingreso: { ingresoId: Number(ingresoId), totalARS: ingresoTotal, aplicadoARS: nuevoAplicadoIngreso, saldoARS: nuevoSaldoIngreso },
          cuota:   { cuotaId: Number(cuotaId),   totalARS: cuotaTotalARSForResumen,   aplicadoARS: nuevoAplicadoCuota,   saldoARS: nuevoSaldoCuota },
        },
      };
    });

    // 👇 NUEVO: recomputar estado del HONORARIO después de la tx
if (result.honorarioId && recomputeHonorarioEstadoSaldo) {
  await recomputeHonorarioEstadoSaldo(result.honorarioId);
}

    res.status(201).json(result);
  } catch (e) {
    console.error("[ingreso-cuota] error en crear:", e);
    if (e?.status) return next(e);
    next(e);
  }
}

/**
 * PUT /api/finanzas/aplicaciones/cuotas/:id
 */
export async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const parsed = actualizarAplicacionCuotaSchema.safeParse(req.body);
    if (!parsed.success) {
      return next({ status: 400, publicMessage: getZodErrorMessages(parsed.error) });
    }
    const { monto, fechaAplicacion } = parsed.data;
    const updatedBy = req.user?.id ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const app = await tx.ingresoCuota.findFirst({
        where: { id, deletedAt: null, activo: true },
        select: { id: true, ingresoId: true, cuotaId: true, montoAplicadoARS: true, fechaAplicacion: true, valorJusAlAplic: true, montoAplicadoJUS: true },
      });
      if (!app) throw { status: 404, publicMessage: "Aplicación no encontrada" };

      const ingreso = await tx.ingreso.findFirst({
        where: { id: app.ingresoId, deletedAt: null, activo: true },
        select: { id: true, fechaIngreso: true, montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true },
      });
      if (!ingreso) throw { status: 404, publicMessage: "Ingreso no encontrado" };

              // Cuota con plan (para obtener política JUS)
        const cuota = await tx.planCuota.findFirst({
          where: { id: app.cuotaId, deletedAt: null, activo: true },
          select: { 
            id: true, 
            montoJus: true, 
            montoPesos: true, 
            valorJusRef: true, 
            vencimiento: true, 
            planId: true,
            plan: {
              select: {
                politicaJusId: true,
              },
            },
          },
        });
        if (!cuota) throw { status: 404, publicMessage: "Cuota no encontrada" };

        const ingresoTotal = ingresoTotalARS(ingreso);

        const aplicadoIngresoSinEsta = toNum(
          (await tx.ingresoCuota.aggregate({
            _sum: { montoAplicadoARS: true },
            where: { ingresoId: app.ingresoId, deletedAt: null, activo: true, NOT: { id } },
          }))._sum.montoAplicadoARS
        );
        const saldoIngresoARS = round2(ingresoTotal - aplicadoIngresoSinEsta);

        const fechaNueva = fechaAplicacion ?? app.fechaAplicacion ?? ingreso.fechaIngreso ?? new Date();
        const vjIngreso = toNum(ingreso.valorJusAlCobro) || (await findValorJusSnapshot(fechaNueva));
        
        // Determinar el valor JUS a usar para los cálculos:
        // - Si la cuota ya tiene valorJusRef, usarlo (para cuotas ya pagadas parcialmente)
        // - Si no tiene valorJusRef, usar el valor JUS del ingreso
        let vjParaCalculos = toNum(cuota.valorJusRef);
        if (!vjParaCalculos && esCuotaJUS(cuota)) {
          vjParaCalculos = vjIngreso;
        }

        // Para valorJusAlAplic de la aplicación: usar el valor guardado si no cambió la fecha, sino recalcular
        let vjParaAplic = app.valorJusAlAplic;
        if (fechaAplicacion != null || monto != null || !vjParaAplic) {
          // Si la cuota tiene valorJusRef, usarlo; sino usar el del ingreso
          vjParaAplic = vjParaCalculos > 0 ? vjParaCalculos : vjIngreso;
        }

        let maxCuotaAplicableARS;
        if (esCuotaJUS(cuota)) {
          const totalJUS = toNum(cuota.montoJus);
          const aplicadoJUSsinEsta = toNum(
            (await tx.ingresoCuota.aggregate({
              _sum: { montoAplicadoJUS: true },
              where: { cuotaId: app.cuotaId, deletedAt: null, activo: true, NOT: { id } },
            }))._sum.montoAplicadoJUS
          );
          // ✅ NO redondear saldoJUS aquí - mantener precisión hasta multiplicar por vj
          const saldoJUS = totalJUS - aplicadoJUSsinEsta;
          if (!(vjParaCalculos > 0)) throw { status: 400, publicMessage: "No se pudo obtener el valor JUS para la fecha de aplicación" };
          // ✅ Redondear solo al final, después de multiplicar
          maxCuotaAplicableARS = round2(Math.max(0, saldoJUS) * vjParaCalculos);
        } else {
          const totalARS = cuotaTotalARS(cuota);
          const aplicadoARSsinEsta = toNum(
            (await tx.ingresoCuota.aggregate({
              _sum: { montoAplicadoARS: true },
              where: { cuotaId: app.cuotaId, deletedAt: null, activo: true, NOT: { id } },
            }))._sum.montoAplicadoARS
          );
          maxCuotaAplicableARS = round2(totalARS - aplicadoARSsinEsta);
        }

      const nuevoMontoARS = monto ?? app.montoAplicadoARS;
      const maxAplicable = Math.max(0, Math.min(saldoIngresoARS, maxCuotaAplicableARS));
      if (monto != null && toNum(nuevoMontoARS) > maxAplicable) {
        throw { status: 400, publicMessage: `Monto supera el disponible. Máximo aplicable ARS ${maxAplicable.toFixed(2)}` };
      }

              // ✅ Calcular montoAplicadoJUS ANTES de redondear montoAplicadoARS para mantener precisión
              const montoParaJUS = monto != null ? toNum(nuevoMontoARS) : toNum(app.montoAplicadoARS);
              const montoAplicadoARSFinal = monto != null ? round2(nuevoMontoARS) : undefined;
              const montoAplicadoJUSFinal = vjParaAplic ? round6(montoParaJUS / vjParaAplic) : null;
              
              const dataUpdate = {
          ...(monto != null ? { montoAplicadoARS: montoAplicadoARSFinal } : {}),
          ...(fechaAplicacion != null ? { fechaAplicacion: fechaNueva } : {}),
          ...(vjParaAplic ? {
            valorJusAlAplic: vjParaAplic,
            montoAplicadoJUS: montoAplicadoJUSFinal,
          } : {
            valorJusAlAplic: null,
            montoAplicadoJUS: null,
          }),
          updatedBy,
        };

      const upd = await tx.ingresoCuota.update({ where: { id }, data: dataUpdate });

      const aplicadoIngreso = toNum(
        (await tx.ingresoCuota.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { ingresoId: app.ingresoId, deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );

      const aplicadoCuotaARS = toNum(
        (await tx.ingresoCuota.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { cuotaId: app.cuotaId, deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );

              const vjParaResumen = esCuotaJUS(cuota) ? (vjParaCalculos > 0 ? vjParaCalculos : toNum(cuota.valorJusRef)) : null;
        const cuotaTotalARSForResumen = esCuotaJUS(cuota) && vjParaResumen
          ? round2(toNum(cuota.montoJus) * vjParaResumen)
          : cuotaTotalARS(cuota);

      await recalcularEstadoCuota(tx, app.cuotaId);

      // 👇 NUEVO: honorarioId para recomputar luego
      const plan = await tx.planCuota.findUnique({
        where: { id: app.cuotaId },
        select: { plan: { select: { honorarioId: true } } },
      });
      const honorarioId = plan?.plan?.honorarioId ?? null;

      return {
        app: upd,
        honorarioId, // << NUEVO
        resumen: {
          ingreso: {
            ingresoId: app.ingresoId,
            totalARS: ingresoTotal,
            aplicadoARS: aplicadoIngreso,
            saldoARS: round2(ingresoTotal - aplicadoIngreso),
          },
          cuota: {
            cuotaId: app.cuotaId,
            totalARS: cuotaTotalARSForResumen,
            aplicadoARS: aplicadoCuotaARS,
            saldoARS: round2(cuotaTotalARSForResumen - aplicadoCuotaARS),
          },
        },
      };
    });

    // 👇 NUEVO
if (result.honorarioId && recomputeHonorarioEstadoSaldo) {
  await recomputeHonorarioEstadoSaldo(result.honorarioId);
}

    res.json(result);
  } catch (e) {
    console.error("[ingreso-cuota] error en actualizar:", e);
    if (e?.status) return next(e);
    next(e);
  }
}

/** DELETE /api/finanzas/aplicaciones/cuotas/:id  (soft delete) */
export async function borrar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const deletedBy = req.user?.id ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const existe = await tx.ingresoCuota.findFirst({
        where: { id, deletedAt: null, activo: true },
        select: { id: true, ingresoId: true, cuotaId: true, montoAplicadoARS: true },
      });
      if (!existe) throw { status: 404, publicMessage: "Aplicación no encontrada" };

      await tx.ingresoCuota.update({
        where: { id },
        data: { activo: false, deletedAt: new Date(), deletedBy },
      });

      await recalcularEstadoCuota(tx, existe.cuotaId);

      // 👇 NUEVO: honorarioId para recomputar luego
      const plan = await tx.planCuota.findUnique({
        where: { id: existe.cuotaId },
        select: { plan: { select: { honorarioId: true } } },
      });
      const honorarioId = plan?.plan?.honorarioId ?? null;

      // Resúmenes
      const ingreso = await tx.ingreso.findFirst({
        where: { id: existe.ingresoId, deletedAt: null, activo: true },
        select: { id: true, montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true },
      });
      const ingresoTotal = ingreso ? ingresoTotalARS(ingreso) : 0;
      const ingresoAplicado = toNum(
        (await tx.ingresoCuota.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { ingresoId: existe.ingresoId, deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );
      const ingresoSaldo = round2(ingresoTotal - ingresoAplicado);

      const cuota = await tx.planCuota.findFirst({
        where: { id: existe.cuotaId, deletedAt: null, activo: true },
        select: { id: true, montoJus: true, montoPesos: true, valorJusRef: true },
      });
      const cuotaTotal = cuota ? cuotaTotalARS(cuota) : 0;
      const cuotaAplicado = toNum(
        (await tx.ingresoCuota.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { cuotaId: existe.cuotaId, deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );
      const cuotaSaldo = round2(cuotaTotal - cuotaAplicado);

      return {
        ok: true,
        honorarioId, // << NUEVO
        resumen: {
          ingreso: { ingresoId: existe.ingresoId, totalARS: ingresoTotal, aplicadoARS: ingresoAplicado, saldoARS: ingresoSaldo },
          cuota:   { cuotaId: existe.cuotaId,   totalARS: cuotaTotal,   aplicadoARS: cuotaAplicado,   saldoARS: cuotaSaldo   },
        },
      };
    });

    // 👇 NUEVO
if (result.honorarioId && recomputeHonorarioEstadoSaldo) {
  await recomputeHonorarioEstadoSaldo(result.honorarioId);
}

    res.json(result);
  } catch (e) {
    console.error("[ingreso-cuota] error en borrar:", e);
    if (e?.status) return next(e);
    next(e);
  }
}
