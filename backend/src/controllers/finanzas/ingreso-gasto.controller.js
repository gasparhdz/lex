// src/controllers/finanzas/ingreso-gasto.controller.js
import prisma from "../../utils/prisma.js";
import {
  listarAplicacionesQuerySchema,
  crearAplicacionSchema,
  actualizarAplicacionSchema, // <- asegurar que exista en el schema
} from "../../validators/finanzas/ingreso-gasto.schema.js";

/* ========================= Helpers ========================= */
function toNum(x, d = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
}
function round2(n) {
  return Math.round(n * 100) / 100;
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

/** Calcula total ARS del ingreso (preferimos snapshot): montoPesosEquivalente o (valorJusAlCobro * montoJusEquivalente) */
function ingresoTotalARS(i) {
  return (
    toNum(i.montoPesosEquivalente) ||
    round2(toNum(i.valorJusAlCobro) * toNum(i.montoJusEquivalente))
  );
}

/** Calcula total ARS del gasto: si hay cotización, monto * cotizacionARS, si no, monto (se asume ARS) */
function gastoTotalARS(g) {
  const monto = toNum(g.monto);
  const tc = toNum(g.cotizacionARS);
  return tc > 0 ? round2(monto * tc) : round2(monto);
}

/** Suma aplicaciones activas a un ingreso en ARS */
async function sumAplicadoIngreso(ingresoId) {
  const rows = await prisma.ingresoGasto.aggregate({
    _sum: { montoAplicadoARS: true },
    where: { ingresoId, deletedAt: null, activo: true },
  });
  return toNum(rows._sum.montoAplicadoARS);
}

/** Suma aplicaciones activas a un gasto en ARS */
async function sumAplicadoGasto(gastoId) {
  const rows = await prisma.ingresoGasto.aggregate({
    _sum: { montoAplicadoARS: true },
    where: { gastoId, deletedAt: null, activo: true },
  });
  return toNum(rows._sum.montoAplicadoARS);
}

/* ========================= Resúmenes ========================= */

/** GET /api/finanzas/aplicaciones/ingreso/:ingresoId/resumen */
export async function resumenIngreso(req, res, next) {
  try {
    const ingresoId = Number(req.params.ingresoId);
    if (!Number.isInteger(ingresoId)) return next({ status: 400, publicMessage: "ID inválido" });

    const i = await prisma.ingreso.findFirst({
      where: { id: ingresoId, deletedAt: null, activo: true },
      select: {
        id: true, fechaIngreso: true, descripcion: true,
        monto: true, montoPesosEquivalente: true,
        valorJusAlCobro: true, montoJusEquivalente: true,
        clienteId: true, casoId: true,
      },
    });
    if (!i) return next({ status: 404, publicMessage: "Ingreso no encontrado" });

    const totalARS = ingresoTotalARS(i);
    const aplicadoARS = await sumAplicadoIngreso(ingresoId);
    const saldoARS = round2(totalARS - aplicadoARS);

    res.json({ ingresoId, totalARS, aplicadoARS, saldoARS, ingreso: i });
  } catch (e) {
    next(e);
  }
}

/** GET /api/finanzas/aplicaciones/gasto/:gastoId/resumen */
export async function resumenGasto(req, res, next) {
  try {
    const gastoId = Number(req.params.gastoId);
    if (!Number.isInteger(gastoId)) return next({ status: 400, publicMessage: "ID inválido" });

    const g = await prisma.gasto.findFirst({
      where: { id: gastoId, deletedAt: null, activo: true },
      select: {
        id: true, fechaGasto: true, descripcion: true,
        monto: true, monedaId: true, cotizacionARS: true,
        clienteId: true, casoId: true,
      },
    });
    if (!g) return next({ status: 404, publicMessage: "Gasto no encontrado" });

    const totalARS = gastoTotalARS(g);
    const aplicadoARS = await sumAplicadoGasto(gastoId);
    const saldoARS = round2(totalARS - aplicadoARS);

    res.json({ gastoId, totalARS, aplicadoARS, saldoARS, gasto: g });
  } catch (e) {
    next(e);
  }
}

/* ========================= CRUD Aplicaciones ========================= */

/**
 * GET /api/finanzas/aplicaciones?ingresoId= | gastoId=
 * Lista aplicaciones filtradas por uno de los lados.
 */
export async function listar(req, res, next) {
  try {
    const parsed = listarAplicacionesQuerySchema.safeParse(req.query);
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
    const gastoId   = q.gastoId   != null ? Number(q.gastoId)   : undefined;

    // (opcional) compat si te llega ingreso_id / gasto_id desde algún lado
    const ingresoIdAlt = req.query.ingreso_id != null ? Number(req.query.ingreso_id) : undefined;
    const gastoIdAlt   = req.query.gasto_id   != null ? Number(req.query.gasto_id)   : undefined;

    const finalIngresoId = Number.isFinite(ingresoId) ? ingresoId : (Number.isFinite(ingresoIdAlt) ? ingresoIdAlt : undefined);
    const finalGastoId   = Number.isFinite(gastoId)   ? gastoId   : (Number.isFinite(gastoIdAlt)   ? gastoIdAlt   : undefined);

    const where = {
      deletedAt: null,
      activo: true,
      ...(Number.isFinite(finalIngresoId) ? { ingresoId: finalIngresoId } : {}),
      ...(Number.isFinite(finalGastoId) ? { gastoId: finalGastoId } : {}),
    };

    const [total, data] = await Promise.all([
      prisma.ingresoGasto.count({ where }),
      prisma.ingresoGasto.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip, take,
        include: {
          ingreso: {
            select: {
              id: true, fechaIngreso: true, descripcion: true,
              montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true,
              clienteId: true, casoId: true,
            },
          },
          gasto: {
            select: {
              id: true, fechaGasto: true, descripcion: true,
              monto: true, monedaId: true, cotizacionARS: true,
              clienteId: true, casoId: true,
            },
          },
        },
      }),
    ]);

    res.json({ rows: data, data, page, pageSize, total });
  } catch (e) {
    next(e);
  }
}

/** GET /api/finanzas/aplicaciones/:id */
export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const row = await prisma.ingresoGasto.findFirst({
      where: { id, deletedAt: null },
      include: {
        ingreso: {
          select: {
            id: true, fechaIngreso: true, descripcion: true,
            montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true,
          },
        },
        gasto: {
          select: {
            id: true, fechaGasto: true, descripcion: true,
            monto: true, monedaId: true, cotizacionARS: true,
          },
        },
      },
    });
    if (!row) return next({ status: 404, publicMessage: "Aplicación no encontrada" });

    res.json(row);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/finanzas/aplicaciones
 * body: { ingresoId, gastoId, monto }  // monto en ARS
 * Valida contra saldos de ambos lados y crea en transacción.
 */
export async function crear(req, res, next) {
  try {
    const parsed = crearAplicacionSchema.safeParse(req.body);
    if (!parsed.success) {
      return next({
        status: 400,
        publicMessage: getZodErrorMessages(parsed.error),
      });
    }
    const { ingresoId, gastoId, monto } = parsed.data;

    const createdBy = req.user?.id ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const ingreso = await tx.ingreso.findFirst({
        where: { id: ingresoId, deletedAt: null, activo: true },
        select: {
          id: true, fechaIngreso: true,
          montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true,
        },
      });
      if (!ingreso) throw { status: 404, publicMessage: "Ingreso no encontrado" };
      const ingresoTotal = ingresoTotalARS(ingreso);
      const ingresoAplicado = toNum(
        (await tx.ingresoGasto.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { ingresoId, deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );
      const ingresoSaldo = round2(ingresoTotal - ingresoAplicado);

      const gasto = await tx.gasto.findFirst({
        where: { id: gastoId, deletedAt: null, activo: true },
        select: { id: true, monto: true, cotizacionARS: true },
      });
      if (!gasto) throw { status: 404, publicMessage: "Gasto no encontrado" };
      const gastoTotal = gastoTotalARS(gasto);
      const gastoAplicado = toNum(
        (await tx.ingresoGasto.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { gastoId, deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );
      const gastoSaldo = round2(gastoTotal - gastoAplicado);

      const maxAplicable = Math.max(0, Math.min(ingresoSaldo, gastoSaldo));
      if (monto > maxAplicable) {
        throw {
          status: 400,
          publicMessage: `Monto supera el disponible. Máximo aplicable ARS ${maxAplicable.toFixed(2)}`,
        };
      }

      const app = await tx.ingresoGasto.create({
        data: {
          ingresoId,
          gastoId,
          fechaAplicacion: ingreso.fechaIngreso ?? new Date(),
          montoAplicadoARS: round2(monto),
          createdBy,
        },
      });

      // Recalcular resúmenes post-creación
      const nuevoAplicadoIngreso = toNum(
        (await tx.ingresoGasto.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { ingresoId, deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );
      const nuevoSaldoIngreso = round2(ingresoTotal - nuevoAplicadoIngreso);

      const nuevoAplicadoGasto = toNum(
        (await tx.ingresoGasto.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { gastoId, deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );
      const nuevoSaldoGasto = round2(gastoTotal - nuevoAplicadoGasto);

      return {
        app,
        resumen: {
          ingreso: { ingresoId, totalARS: ingresoTotal, aplicadoARS: nuevoAplicadoIngreso, saldoARS: nuevoSaldoIngreso },
          gasto:   { gastoId,   totalARS: gastoTotal,   aplicadoARS: nuevoAplicadoGasto,   saldoARS: nuevoSaldoGasto   },
        },
      };
    });

    res.status(201).json(result);
  } catch (e) {
    if (e?.status) return next(e);
    next(e);
  }
}

/**
 * PUT /api/finanzas/aplicaciones/:id
 * body: { monto?, fechaAplicacion? }  // monto en ARS
 * Revalida contra saldos y actualiza en transacción.
 */
export async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const parsed = actualizarAplicacionSchema.safeParse(req.body);
    if (!parsed.success) {
      return next({
        status: 400,
        publicMessage: getZodErrorMessages(parsed.error),
      });
    }
    const { monto, fechaAplicacion } = parsed.data;

    const updatedBy = req.user?.id ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const appPrev = await tx.ingresoGasto.findFirst({
        where: { id, deletedAt: null, activo: true },
        select: { id: true, ingresoId: true, gastoId: true, montoAplicadoARS: true, fechaAplicacion: true },
      });
      if (!appPrev) throw { status: 404, publicMessage: "Aplicación no encontrada" };

      // Leer ingreso/gasto para recálculo de saldos (excluyendo la propia app)
      const ingreso = await tx.ingreso.findFirst({
        where: { id: appPrev.ingresoId, deletedAt: null, activo: true },
        select: {
          id: true, fechaIngreso: true,
          montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true,
        },
      });
      if (!ingreso) throw { status: 404, publicMessage: "Ingreso no encontrado" };

      const gasto = await tx.gasto.findFirst({
        where: { id: appPrev.gastoId, deletedAt: null, activo: true },
        select: { id: true, monto: true, cotizacionARS: true },
      });
      if (!gasto) throw { status: 404, publicMessage: "Gasto no encontrado" };

      const ingresoTotal = ingresoTotalARS(ingreso);
      const gastoTotal = gastoTotalARS(gasto);

      const aplicadoIngresoSinEsta = toNum(
        (await tx.ingresoGasto.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { ingresoId: ingreso.id, deletedAt: null, activo: true, NOT: { id } },
        }))._sum.montoAplicadoARS
      );
      const aplicadoGastoSinEsta = toNum(
        (await tx.ingresoGasto.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { gastoId: gasto.id, deletedAt: null, activo: true, NOT: { id } },
        }))._sum.montoAplicadoARS
      );

      const saldoIngresoDisponible = round2(ingresoTotal - aplicadoIngresoSinEsta);
      const saldoGastoDisponible = round2(gastoTotal - aplicadoGastoSinEsta);

      const nuevoMonto = monto != null ? round2(monto) : appPrev.montoAplicadoARS;

      const maxAplicable = Math.max(0, Math.min(saldoIngresoDisponible, saldoGastoDisponible));
      if (nuevoMonto > maxAplicable) {
        throw {
          status: 400,
          publicMessage: `Monto supera el disponible. Máximo aplicable ARS ${maxAplicable.toFixed(2)}`,
        };
      }

      const appUpd = await tx.ingresoGasto.update({
        where: { id },
        data: {
          montoAplicadoARS: nuevoMonto,
          ...(fechaAplicacion ? { fechaAplicacion } : {}),
          updatedBy,
        },
      });

      // Resúmenes post-actualización
      const aplicadoIngreso = toNum(
        (await tx.ingresoGasto.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { ingresoId: ingreso.id, deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );
      const saldoIngreso = round2(ingresoTotal - aplicadoIngreso);

      const aplicadoGasto = toNum(
        (await tx.ingresoGasto.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { gastoId: gasto.id, deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );
      const saldoGasto = round2(gastoTotal - aplicadoGasto);

      return {
        app: appUpd,
        resumen: {
          ingreso: { ingresoId: ingreso.id, totalARS: ingresoTotal, aplicadoARS: aplicadoIngreso, saldoARS: saldoIngreso },
          gasto:   { gastoId: gasto.id,     totalARS: gastoTotal,   aplicadoARS: aplicadoGasto,   saldoARS: saldoGasto   },
        },
      };
    });

    res.json(result);
  } catch (e) {
    if (e?.status) return next(e);
    next(e);
  }
}

/**
 * DELETE /api/finanzas/aplicaciones/:id  (soft delete)
 * Devuelve resúmenes actualizados de ingreso y gasto involucrados.
 */
export async function borrar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const deletedBy = req.user?.id ?? null;

    const result = await prisma.$transaction(async (tx) => {
      const existe = await tx.ingresoGasto.findFirst({
        where: { id, deletedAt: null, activo: true },
        select: { id: true, ingresoId: true, gastoId: true, montoAplicadoARS: true },
      });
      if (!existe) throw { status: 404, publicMessage: "Aplicación no encontrada" };

      await tx.ingresoGasto.update({
        where: { id },
        data: { activo: false, deletedAt: new Date(), deletedBy },
      });

      // Recalcular resúmenes
      const ingreso = await tx.ingreso.findFirst({
        where: { id: existe.ingresoId, deletedAt: null, activo: true },
        select: { id: true, montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true },
      });
      const ingresoTotal = ingreso ? ingresoTotalARS(ingreso) : 0;
      const ingresoAplicado = toNum(
        (await tx.ingresoGasto.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { ingresoId: existe.ingresoId, deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );
      const ingresoSaldo = round2(ingresoTotal - ingresoAplicado);

      const gasto = await tx.gasto.findFirst({
        where: { id: existe.gastoId, deletedAt: null, activo: true },
        select: { id: true, monto: true, cotizacionARS: true },
      });
      const gastoTotal = gasto ? gastoTotalARS(gasto) : 0;
      const gastoAplicado = toNum(
        (await tx.ingresoGasto.aggregate({
          _sum: { montoAplicadoARS: true },
          where: { gastoId: existe.gastoId, deletedAt: null, activo: true },
        }))._sum.montoAplicadoARS
      );
      const gastoSaldo = round2(gastoTotal - gastoAplicado);

      return {
        ok: true,
        resumen: {
          ingreso: { ingresoId: existe.ingresoId, totalARS: ingresoTotal, aplicadoARS: ingresoAplicado, saldoARS: ingresoSaldo },
          gasto:   { gastoId: existe.gastoId,   totalARS: gastoTotal,   aplicadoARS: gastoAplicado,   saldoARS: gastoSaldo   },
        },
      };
    });

    res.json(result);
  } catch (e) {
    if (e?.status) return next(e);
    next(e);
  }
}
