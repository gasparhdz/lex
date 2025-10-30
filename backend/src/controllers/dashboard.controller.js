// src/controllers/dashboard.controller.js
import prisma from "../utils/prisma.js";

/* ========================= Helpers ========================= */
function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}
function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/* ========================= Handlers ========================= */

/**
 * GET /api/dashboard/kpis
 * - Casos activos (Caso.activo)
 * - Tareas pendientes (Tarea.completada=false)
 * - Tareas vencidas (Tarea.completada=false AND fechaLimite < ahora)
 * - Honorarios pendientes del mes (aprox por suma de PlanCuota.montoPesos con vencimiento en el mes)
 * - Gastos no cobrados del mes (Gasto.monto - sum(IngresoGasto.montoAplicadoARS) en el mes)
 */
export async function obtenerKpis(_req, res, next) {
  try {
    const ahora = new Date();
    const desde = startOfMonth(ahora);
    const hasta = endOfMonth(ahora);

    // Valor JUS vigente hoy (activo, último con fecha <= hoy)
    const valorJusHoy = await prisma.valorJUS.findFirst({
      where: { activo: true, deletedAt: null, fecha: { lte: ahora } },
      orderBy: { fecha: "desc" },
      select: { valor: true },
    });
    const jusHoy = valorJusHoy ? Number(valorJusHoy.valor) : NaN;

    const [
      casosActivos,
      tareasPendientes,
      tareasVencidas,
      cuotasMes,
      gastosMes,
    ] = await Promise.all([
      prisma.caso.count({
        where: {
          deletedAt: null,
          activo: true,
          estadoId: { in: [49, 50, 51, 52, 53, 54, 55] },
        },
      }),

      prisma.tarea.count({
        where: { deletedAt: null, completada: false, activo: true },
      }),

      prisma.tarea.count({
        where: {
          deletedAt: null,
          completada: false,
          activo: true,
          fechaLimite: { lt: ahora },
        },
      }),

      prisma.planCuota.findMany({
        where: {
          deletedAt: null,
          activo: true,
          vencimiento: { gte: desde, lte: hasta },
        },
        select: {
          montoPesos: true,
          montoJus: true,
          valorJusRef: true, // fallback si no hay valor del día
          aplicaciones: {
            where: { deletedAt: null, activo: true },
            select: { montoAplicadoARS: true },
          },
        },
      }),

      prisma.gasto.findMany({
        where: {
          deletedAt: null,
          activo: true,
          fechaGasto: { gte: desde, lte: hasta },
        },
        select: {
          id: true,
          monto: true,
          aplicaciones: {
            where: { deletedAt: null, activo: true },
            select: { montoAplicadoARS: true },
          },
        },
      }),
    ]);

    // === Honorarios pendientes del mes (saldo ARS de cada cuota del mes) ===
    const honorariosPendientesMes = cuotasMes.reduce((acc, c) => {
      const aplicadoARS = (c.aplicaciones ?? []).reduce((s, a) => {
        const n = a.montoAplicadoARS ? Number(a.montoAplicadoARS) : 0;
        return s + (isFinite(n) ? n : 0);
      }, 0);

      let importeARS = 0;

      if (c.montoPesos != null) {
        const n = Number(c.montoPesos);
        importeARS = isFinite(n) ? n : 0;
      } else if (c.montoJus != null) {
        const jus = Number(c.montoJus);
        const cotizacion = isFinite(jusHoy) ? jusHoy : Number(c.valorJusRef ?? 0); // fallback
        importeARS = (isFinite(jus) && isFinite(cotizacion)) ? jus * cotizacion : 0;
      }

      const saldo = Math.max(importeARS - aplicadoARS, 0);
      return acc + (isFinite(saldo) ? saldo : 0);
    }, 0);

    const gastosNoCobradosMes = gastosMes.reduce((acc, g) => {
      const monto = g.monto ? Number(g.monto) : 0;
      const aplicado = g.aplicaciones.reduce((s, a) => {
        const n = a.montoAplicadoARS ? Number(a.montoAplicadoARS) : 0;
        return s + (isFinite(n) ? n : 0);
      }, 0);
      const saldo = Math.max(monto - aplicado, 0);
      return acc + saldo;
    }, 0);

    res.json({
      casosActivos,
      tareasPendientes,
      tareasVencidas,
      honorariosPendientesMes,
      gastosNoCobradosMes,
      periodo: { desde, hasta },
    });
  } catch (e) {
    next(e);
  }
}


/**
 * GET /api/dashboard/tareas
 * ?includeOverdue=true para incluir vencidas
 *
 * Pendientes → completada = false
 * Vencidas → fechaLimite < ahora
 *
 * Se mapea `fechaLimite` → `fechaVencimiento` (lo que espera el front).
 */
// === /api/dashboard/tareas ===
export async function listarTareasPendientes(req, res, next) {
  try {
    const includeOverdue = String(req.query.includeOverdue ?? "false") === "true";
    const ahora = new Date();

    const where = {
      deletedAt: null,
      activo: true,
      completada: false,
      ...(includeOverdue
        ? {}
        : {
            OR: [
              { fechaLimite: null },
              { fechaLimite: { gte: ahora } },
            ],
          }),
    };

    const tareas = await prisma.tarea.findMany({
      where,
      orderBy: [{ fechaLimite: "asc" }],
      take: 50,
      select: {
        id: true,
        titulo: true,
        fechaLimite: true,
        // 👇 agregado: cliente para mostrar chip
        cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        // opcional: por si querés también usar carátula como fallback
        caso: { select: { id: true, caratula: true } },
      },
    });

    const respuesta = tareas.map(t => ({
      id: t.id,
      titulo: t.titulo,
      fechaVencimiento: t.fechaLimite, // lo que espera el front
      cliente: t.cliente,              // 👈 ahora llega al front
      caso: t.caso,
    }));

    // ordenar dejando "sin fecha" al final
    respuesta.sort((a, b) => {
      if (!a.fechaVencimiento && !b.fechaVencimiento) return 0;
      if (!a.fechaVencimiento) return 1;
      if (!b.fechaVencimiento) return -1;
      return new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento);
    });

    res.json(respuesta);
  } catch (e) {
    next(e);
  }
}

// GET /api/dashboard/eventos
export async function listarEventosPendientes(_req, res, next) {
  try {
    // Buscar el estado "Pendiente" dinámicamente por código
    const estadoPendiente = await prisma.parametro.findFirst({
      where: {
        categoria: { codigo: "ESTADO_EVENTO" },
        codigo: "PENDIENTE",
        activo: true,
      },
      select: { id: true },
    });

    const where = {
      deletedAt: null,
      activo: true,
    };

    // Si encontramos el estado pendiente, filtrar por él
    if (estadoPendiente) {
      where.estadoId = estadoPendiente.id;
    } else {
      // Fallback: sin filtro de estado si no existe "PENDIENTE"
      console.warn("No se encontró el estado PENDIENTE para eventos");
    }

    const eventos = await prisma.evento.findMany({
      where,
      orderBy: [{ fechaInicio: "asc" }],
      take: 100, // Aumentado de 50 a 100
      select: {
        id: true,
        descripcion: true,
        fechaInicio: true,
        tipo: { select: { nombre: true } },
        cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
      },
    });

    res.json(eventos.map(ev => ({
      id: ev.id,
      titulo: ev.descripcion || ev.tipo?.nombre || "Evento",
      fecha: ev.fechaInicio,
      cliente: ev.cliente,
    })));
  } catch (e) { next(e); }
}
