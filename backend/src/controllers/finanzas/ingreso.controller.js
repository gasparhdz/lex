// src/controllers/finanzas/ingreso.controller.js
import prisma from "../../utils/prisma.js";
import {
  crearIngresoSchema,
  actualizarIngresoSchema,
} from "../../validators/finanzas/ingreso.schema.js";

/* ========================= Helpers ========================= */
function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? "20", 10)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
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
const upper = (s) => (s ? String(s).trim().toUpperCase() : "");
const toNum = (x, d = 0) => {
  const n = Number(x);
  return Number.isFinite(n) ? n : d;
};
const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** Snapshot de ValorJUS para una fecha (o el último disponible). */
async function findValorJusSnapshot(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  let row = await prisma.valorJUS.findFirst({
    where: { fecha: { lte: d } },
    orderBy: { fecha: "desc" },
  });
  if (!row) row = await prisma.valorJUS.findFirst({ orderBy: { fecha: "desc" } });
  return row?.valor ?? null;
}

/** Lee el código/nombre de la moneda para decidir si es JUS/ARS/otra */
async function getMonedaInfo(monedaId) {
  if (!monedaId) return { code: null, name: null };
  const p = await prisma.parametro.findUnique({ where: { id: Number(monedaId) } });
  return { code: upper(p?.codigo), name: upper(p?.nombre) };
}

/** Normalizador del DTO de Ingreso (lo que persiste) */
function normalizeIngresoDTO(b = {}) {
  const out = {
    descripcion: strOrNull(b.descripcion),
    clienteId: intOrNull(b.clienteId),
    casoId: intOrNull(b.casoId),
    tipoId: intOrNull(b.tipoId),
    monedaId: intOrNull(b.monedaId),
    estadoId: intOrNull(b.estadoId),
    monto: numOrNull(b.monto),
    cotizacionARS: numOrNull(b.cotizacionARS),
    fechaIngreso: toDateOrNull(b.fechaIngreso),
    activo: b.activo === undefined ? undefined : Boolean(b.activo),
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

/** Aplica reglas de equivalencias:
 *  - valorJusAlCobro = snapshot( fechaIngreso )
 *  - Si moneda JUS:  jusEq = monto,  arsEq = monto * JUS
 *  - Si moneda ARS:  arsEq = monto (o monto*cotiz si “otra” moneda), jusEq = arsEq / JUS
 *  - Si moneda “otra” y viene cotizacionARS: arsEq = monto * cotiz
 */
async function computeEquivalencias({ monto, monedaId, cotizacionARS, fechaIngreso }) {
  const { code, name } = await getMonedaInfo(monedaId);
  const isJUS = (code === "JUS") || (name === "JUS");
  const isARS = (code === "ARS") || (name?.includes("PESO") ?? false);

  const vj = await findValorJusSnapshot(fechaIngreso);
  const valorJusAlCobro = vj || null;

  let montoPesosEquivalente = null;
  let montoJusEquivalente = null;

  const m = Number(monto || 0);
  const cotiz = Number(cotizacionARS || 0);

  if (isJUS) {
    montoJusEquivalente = m;
    if (valorJusAlCobro) montoPesosEquivalente = Number(m * Number(valorJusAlCobro));
  } else if (isARS) {
    montoPesosEquivalente = m;
    if (valorJusAlCobro && valorJusAlCobro > 0) {
      montoJusEquivalente = Number(m / Number(valorJusAlCobro));
    }
  } else {
    if (cotiz && cotiz > 0) {
      montoPesosEquivalente = Number(m * cotiz);
      if (valorJusAlCobro && valorJusAlCobro > 0) {
        montoJusEquivalente = Number(montoPesosEquivalente / Number(valorJusAlCobro));
      }
    }
  }

  return { valorJusAlCobro, montoJusEquivalente, montoPesosEquivalente };
}

/** Si viene honorarioId o gastoId, completa clienteId/casoId desde allí si faltan. */
async function hydrateFromLinkedEntities(baseDto, { honorarioId, gastoId }) {
  const out = { ...baseDto };

  if (honorarioId) {
    const h = await prisma.honorario.findFirst({
      where: { id: Number(honorarioId), deletedAt: null },
      select: { clienteId: true, casoId: true },
    });
    if (!h) throw { status: 404, publicMessage: "Honorario vinculado no existe" };
    if (!out.clienteId && h.clienteId) out.clienteId = h.clienteId;
    if (!out.casoId && h.casoId) out.casoId = h.casoId;
  }

  if (gastoId) {
    const g = await prisma.gasto.findFirst({
      where: { id: Number(gastoId), deletedAt: null },
      select: { clienteId: true, casoId: true },
    });
    if (!g) throw { status: 404, publicMessage: "Gasto vinculado no existe" };
    if (!out.clienteId && g.clienteId) out.clienteId = g.clienteId;
    if (!out.casoId && g.casoId) out.casoId = g.casoId;
  }

  return out;
}

/* ===== Helpers ingreso↔cuota (orquestador) ===== */
function ingresoTotalARS(i) {
  return (
    toNum(i.montoPesosEquivalente) ||
    round2(toNum(i.valorJusAlCobro) * toNum(i.montoJusEquivalente))
  );
}
function esCuotaJUS(c) {
  const jus = toNum(c.montoJus);
  const pes = toNum(c.montoPesos);
  return jus > 0 && pes <= 0;
}
function cuotaTotalARS(c) {
  const pes = toNum(c.montoPesos);
  if (pes > 0) return round2(pes);
  const jus = toNum(c.montoJus);
  const vj  = toNum(c.valorJusRef);
  return jus > 0 && vj > 0 ? round2(jus * vj) : 0;
}
async function sumAplicadoEnCuota(tx, cuotaId, excludeId) {
  const rows = await tx.ingresoCuota.aggregate({
    _sum: { montoAplicadoARS: true, montoAplicadoJUS: true },
    where: {
      cuotaId,
      deletedAt: null,
      activo: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  return {
    ars: toNum(rows._sum.montoAplicadoARS),
    jus: toNum(rows._sum.montoAplicadoJUS),
  };
}
const EST = { PENDIENTE:"PENDIENTE", PARCIAL:"PARCIAL", PAGADA:"PAGADA", VENCIDA:"VENCIDA", CONDONADA:"CONDONADA" };
const EST_CAT_ID = 19;
async function getEstadosMap(tx) {
  const rows = await tx.parametro.findMany({
    where: { categoriaId: EST_CAT_ID, activo: true },
    select: { id: true, codigo: true, nombre: true },
  });
  const map = {};
  for (const r of rows) {
    if (r.codigo) map[String(r.codigo).trim().toUpperCase()] = r.id;
    if (r.nombre) map[String(r.nombre).trim().toUpperCase()] = r.id;
  }
  return map;
}
async function recalcularEstadoCuota(tx, cuotaId) {
  const cuota = await tx.planCuota.findFirst({
    where: { id: cuotaId, deletedAt: null, activo: true },
    select: { id: true, montoJus: true, montoPesos: true, vencimiento: true, estadoId: true },
  });
  if (!cuota) return;
  const agg = await tx.ingresoCuota.aggregate({
    _sum: { montoAplicadoARS: true, montoAplicadoJUS: true },
    where: { cuotaId, deletedAt: null, activo: true },
  });
  const aplARS = Number(agg._sum.montoAplicadoARS || 0);
  const aplJUS = Number(agg._sum.montoAplicadoJUS || 0);

  const epsilonARS = 0.01;
  const epsilonJUS = 1e-6;

  let pagada = false;
  if (Number(cuota.montoJus) > 0) {
    const totalJUS = Number(cuota.montoJus);
    pagada = aplJUS >= (totalJUS - epsilonJUS);
  } else {
    const totalARS = Number(cuota.montoPesos) || 0;
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

  try {
    const map = await getEstadosMap(tx);
    const nuevoEstadoId = map[estadoKey] ?? (estadoKey === EST.PARCIAL ? map[EST.PENDIENTE] : null);
    if (nuevoEstadoId && nuevoEstadoId !== cuota.estadoId) {
      await tx.planCuota.update({ where: { id: cuotaId }, data: { estadoId: nuevoEstadoId } });
    }
  } catch {}
}

/* ========================= Listado / lectura ========================= */

function buildWhere(req) {
  const q = req.query || {};
  const where = { deletedAt: null, activo: true };

  const clienteId = intOrNull(q.clienteId);
  if (clienteId !== undefined) where.clienteId = clienteId;

  const casoId = intOrNull(q.casoId);
  if (casoId !== undefined) where.casoId = casoId;

  const tipoId = intOrNull(q.tipoId);
  if (tipoId !== undefined) where.tipoId = tipoId;

  const monedaId = intOrNull(q.monedaId);
  if (monedaId !== undefined) where.monedaId = monedaId;

  const from = toDateOrNull(q.from);
  const to = toDateOrNull(q.to);
  if (from || to) {
    where.fechaIngreso = {};
    if (from) where.fechaIngreso.gte = from;
    if (to) where.fechaIngreso.lte = to;
  }

  const search = String(q.search || "").trim();
  if (search) {
    where.AND = (where.AND || []).concat({
      OR: [
        { descripcion: { contains: search, mode: "insensitive" } },
        { cliente: { razonSocial: { contains: search, mode: "insensitive" } } },
        { cliente: { apellido: { contains: search, mode: "insensitive" } } },
        { cliente: { nombre: { contains: search, mode: "insensitive" } } },
        { caso: { caratula: { contains: search, mode: "insensitive" } } },
        { caso: { nroExpte: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  return where;
}

function buildOrderBy({ orderBy, order, sort }) {
  if (orderBy) {
    const dir = (order || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    switch (orderBy) {
      case "fechaIngreso":
      case "createdAt":
      case "updatedAt":
        return [{ [orderBy]: dir }];
      default:
        return [{ fechaIngreso: "desc" }];
    }
  }
  if (sort) {
    const parts = String(sort).split(",").map((x) => x.trim()).filter(Boolean);
    const allow = new Set(["fechaIngreso", "createdAt", "updatedAt"]);
    const orderByArr = [];
    for (const p of parts) {
      const [field, dirRaw] = p.split(":");
      if (!field || !allow.has(field)) continue;
      const dir = (dirRaw || "asc").toLowerCase() === "desc" ? "desc" : "asc";
      orderByArr.push({ [field]: dir });
    }
    if (orderByArr.length) return orderByArr;
  }
  return [{ fechaIngreso: "desc" }];
}

/** GET /api/finanzas/ingresos */
export async function listar(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req);
    const where = buildWhere(req);
    const orderBy = buildOrderBy(req.query);

    const [total, data] = await Promise.all([
      prisma.ingreso.count({ where }),
      prisma.ingreso.findMany({
        where, orderBy, skip, take,
        include: {
          cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
          caso: { select: { id: true, nroExpte: true, caratula: true } },
          tipo: { select: { id: true, codigo: true, nombre: true } },
          moneda: { select: { id: true, codigo: true, nombre: true } },
          estado: { select: { id: true, codigo: true, nombre: true} },
        },
      }),
    ]);

    res.json({ data, page, pageSize, total });
  } catch (e) {
    next(e);
  }
}

/** GET /api/finanzas/ingresos/:id */
export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const row = await prisma.ingreso.findFirst({
      where: { id, deletedAt: null },
      include: {
        cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        caso: { select: { id: true, nroExpte: true, caratula: true } },
        tipo: { select: { id: true, codigo: true, nombre: true } },
        moneda: { select: { id: true, codigo: true, nombre: true } },
        estado: { select: { id: true, codigo: true, nombre: true } },
      },
    });
    if (!row) return next({ status: 404, publicMessage: "Ingreso no encontrado" });

    // Calcular total aplicado
    const [totalCuotas, totalGastos] = await Promise.all([
      prisma.ingresoCuota.aggregate({
        where: { ingresoId: id, deletedAt: null, activo: true },
        _sum: { montoAplicadoARS: true },
      }),
      prisma.ingresoGasto.aggregate({
        where: { ingresoId: id, deletedAt: null, activo: true },
        _sum: { montoAplicadoARS: true },
      }),
    ]);

    const aplicadoARS = toNum(totalCuotas._sum.montoAplicadoARS || 0) + toNum(totalGastos._sum.montoAplicadoARS || 0);
    const totalARS = ingresoTotalARS(row);
    const saldoARS = round2(totalARS - aplicadoARS);
    const porcentaje = totalARS > 0 ? round2((aplicadoARS / totalARS) * 100) : 0;

    res.json({
      ...row,
      aplicadoARS,
      totalARS,
      saldoARS,
      porcentajeAplicado: porcentaje,
    });
  } catch (e) {
    next(e);
  }
}

/* ========================= Crear / actualizar / borrar ========================= */

/** POST /api/finanzas/ingresos
 *  Soporta opcionalmente:
 *   - honorarioId / gastoId (como ya hacía)
 *   - aplicacionesCuotas: [{ cuotaId, monto }]  // montos en ARS
 */
export async function crear(req, res, next) {
  try {
    const parsed = crearIngresoSchema.safeParse(req.body);
    if (!parsed.success) {
      return next({ status: 400, publicMessage: parsed.error.errors.map(e => e.message).join(", ") });
    }

    const honorarioId = intOrNull(req.body.honorarioId);
    const gastoId = intOrNull(req.body.gastoId);
    const aplicacionesCuotas = Array.isArray(req.body.aplicacionesCuotas) ? req.body.aplicacionesCuotas : [];

    const baseDto = normalizeIngresoDTO(parsed.data);
    const dto = await hydrateFromLinkedEntities(baseDto, { honorarioId, gastoId });

    const created = await prisma.$transaction(async (tx) => {
      // Equivalencias (usa fechaIngreso del DTO)
      const eq = await computeEquivalencias(dto);

      // Crear ingreso
      const createdRow = await tx.ingreso.create({
        data: {
          ...dto,
          ...eq,
          createdBy: req.user?.id ?? null,
        },
        include: {
          cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
          caso: { select: { id: true, nroExpte: true, caratula: true } },
          tipo: { select: { id: true, codigo: true, nombre: true } },
          moneda: { select: { id: true, codigo: true, nombre: true } },
          estado: { select: { id: true, codigo: true, nombre: true } },
        },
      });

      // Vínculos existentes (honorario/gasto): conservamos comportamiento previo
      if (honorarioId) {
        await tx.ingresoHonorario.create({
          data: {
            ingresoId: createdRow.id,
            honorarioId,
            fechaAplicacion: createdRow.fechaIngreso,
            montoAplicadoARS: createdRow.montoPesosEquivalente ?? 0,
            valorJusAlAplic: createdRow.valorJusAlCobro,
            montoAplicadoJUS: createdRow.montoJusEquivalente ?? null,
            createdBy: req.user?.id ?? null,
          },
        });
      } else if (gastoId) {
        await tx.ingresoGasto.create({
          data: {
            ingresoId: createdRow.id,
            gastoId,
            fechaAplicacion: createdRow.fechaIngreso,
            montoAplicadoARS: createdRow.montoPesosEquivalente ?? 0,
            createdBy: req.user?.id ?? null,
          },
        });
      }

      // ===== Orquestador de aplicaciones a cuotas (opcional) =====
      if (aplicacionesCuotas.length) {
        const fechaAplic = createdRow.fechaIngreso ?? new Date();
        const vj = toNum(createdRow.valorJusAlCobro) || (await findValorJusSnapshot(fechaAplic));
        const ingresoTotal = ingresoTotalARS(createdRow);

        // saldo dinámico controlado por lo efectivamente creado acá
        let aplicadoHastaAhoraARS = 0;

        // set para recalcular estados al final
        const touchedCuotaIds = new Set();

        for (const it of aplicacionesCuotas) {
          const cuotaId = Number(it?.cuotaId);
          const reqMontoARS = round2(Number(it?.monto || 0));
          if (!Number.isFinite(cuotaId) || cuotaId <= 0 || !(reqMontoARS > 0)) continue;

          // cuota
          const cuota = await tx.planCuota.findFirst({
            where: { id: cuotaId, deletedAt: null, activo: true },
            select: { id: true, montoJus: true, montoPesos: true, valorJusRef: true, vencimiento: true },
          });
          if (!cuota) continue;

          // saldo cuota
          let maxCuotaAplicableARS;
          if (esCuotaJUS(cuota)) {
            const totalJUS = toNum(cuota.montoJus);
            const agg = await sumAplicadoEnCuota(tx, cuotaId);
            const saldoJUS = round2(totalJUS - toNum(agg.jus));
            if (!(vj > 0)) throw { status: 400, publicMessage: "No se pudo obtener el valor JUS para la fecha de aplicación" };
            maxCuotaAplicableARS = round2(Math.max(0, saldoJUS) * vj);
          } else {
            const totalARS = cuotaTotalARS(cuota);
            const agg = await sumAplicadoEnCuota(tx, cuotaId);
            maxCuotaAplicableARS = round2(totalARS - toNum(agg.ars));
          }

          // saldo ingreso
          const saldoIngresoARS = round2(ingresoTotal - aplicadoHastaAhoraARS);
          const montoFinal = Math.min(reqMontoARS, maxCuotaAplicableARS, saldoIngresoARS);

          if (montoFinal > 0.009) {
            const createdApp = await tx.ingresoCuota.create({
              data: {
                ingresoId: createdRow.id,
                cuotaId,
                fechaAplicacion: fechaAplic,
                montoAplicadoARS: round2(montoFinal),
                valorJusAlAplic: vj || null,
                montoAplicadoJUS: vj ? round2(montoFinal / vj) : null,
                createdBy: req.user?.id ?? null,
              },
            });
            aplicadoHastaAhoraARS = round2(aplicadoHastaAhoraARS + createdApp.montoAplicadoARS);
            touchedCuotaIds.add(cuotaId);
          }
        }

        // actualizar estados de cuotas tocadas
        for (const cid of touchedCuotaIds) {
          await recalcularEstadoCuota(tx, cid);
        }
      }

      return createdRow;
    });

    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
}

/** PUT /api/finanzas/ingresos/:id */
export async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const exists = await prisma.ingreso.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!exists) return next({ status: 404, publicMessage: "Ingreso no encontrado" });

    const parsed = actualizarIngresoSchema.safeParse(req.body);
    if (!parsed.success) {
      return next({ status: 400, publicMessage: parsed.error.errors.map(e => e.message).join(", ") });
    }

    const baseDto = normalizeIngresoDTO(parsed.data);

    // Recalcular equivalencias si cambian monto / moneda / fecha / cotización
    const needsEq =
      baseDto.monto != null ||
      baseDto.monedaId != null ||
      baseDto.fechaIngreso != null ||
      baseDto.cotizacionARS != null;

    let data = { ...baseDto, updatedBy: req.user?.id ?? null };

    if (needsEq) {
      const prev = await prisma.ingreso.findUnique({
        where: { id },
        select: { monto: true, monedaId: true, cotizacionARS: true, fechaIngreso: true },
      });
      const comp = {
        monto: data.monto ?? prev.monto,
        monedaId: data.monedaId ?? prev.monedaId,
        cotizacionARS: data.cotizacionARS ?? prev.cotizacionARS,
        fechaIngreso: data.fechaIngreso ?? prev.fechaIngreso,
      };
      const eq = await computeEquivalencias(comp);
      data = { ...data, ...eq };
    }

    const upd = await prisma.ingreso.update({
      where: { id },
      data,
      include: {
        cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        caso: { select: { id: true, nroExpte: true, caratula: true } },
        tipo: { select: { id: true, codigo: true, nombre: true } },
        moneda: { select: { id: true, codigo: true, nombre: true } },
        estado: { select: { id: true, codigo: true, nombre: true } },
      },
    });

    res.json(upd);
  } catch (e) {
    next(e);
  }
}

/** DELETE /api/finanzas/ingresos/:id (soft delete) */
// DELETE /api/finanzas/ingresos/:id (soft delete)
export async function borrar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const exists = await prisma.ingreso.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!exists) return next({ status: 404, publicMessage: "Ingreso no encontrado" });

    await prisma.$transaction(async (tx) => {
      // 1) Soft delete del ingreso
      await tx.ingreso.update({
        where: { id },
        data: { activo: false, deletedAt: new Date(), deletedBy: req.user?.id ?? null },
      });

      // 2) Soft delete de todas las aplicaciones a cuotas de este ingreso
      const apps = await tx.ingresoCuota.findMany({
        where: { ingresoId: id, deletedAt: null, activo: true },
        select: { id: true, cuotaId: true },
      });

      if (apps.length) {
        await tx.ingresoCuota.updateMany({
          where: { id: { in: apps.map(a => a.id) } },
          data: { activo: false, deletedAt: new Date(), deletedBy: req.user?.id ?? null },
        });

        // 3) Recalcular estado de cuotas afectadas
        const cuotaIds = [...new Set(apps.map(a => a.cuotaId))];
        for (const cid of cuotaIds) {
          await recalcularEstadoCuota(tx, Number(cid));
        }
      }
    });

    res.status(204).end();
  } catch (e) {
    next(e);
  }
}


// PUT /api/finanzas/ingresos/:id/reconciliar
// src/controllers/finanzas/ingreso.controller.js
export async function actualizarYReconciliar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const { selectedCuotaIds = [], ...body } = req.body || {};
    if (!Array.isArray(selectedCuotaIds)) {
      return next({ status: 400, publicMessage: "selectedCuotaIds debe ser un array" });
    }

    const exists = await prisma.ingreso.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!exists) return next({ status: 404, publicMessage: "Ingreso no encontrado" });

    const parsed = actualizarIngresoSchema.safeParse(body);
    if (!parsed.success) {
      return next({ status: 400, publicMessage: parsed.error.errors.map(e => e.message).join(", ") });
    }

    const baseDto = normalizeIngresoDTO(parsed.data);

    const updated = await prisma.$transaction(async (tx) => {
      // 1) Recalcular equivalencias si cambian campos sensibles
      const needsEq =
        baseDto.monto != null || baseDto.monedaId != null ||
        baseDto.fechaIngreso != null || baseDto.cotizacionARS != null;

      let data = { ...baseDto, updatedBy: req.user?.id ?? null };

      if (needsEq) {
        const prev = await tx.ingreso.findUnique({
          where: { id },
          select: { monto: true, monedaId: true, cotizacionARS: true, fechaIngreso: true },
        });
        const comp = {
          monto:        data.monto        ?? prev.monto,
          monedaId:     data.monedaId     ?? prev.monedaId,
          cotizacionARS:data.cotizacionARS?? prev.cotizacionARS,
          fechaIngreso: data.fechaIngreso ?? prev.fechaIngreso,
        };
        const eq = await computeEquivalencias(comp);
        data = { ...data, ...eq };
      }

      // 2) Actualizar header del ingreso
      const ingresoUpd = await tx.ingreso.update({
        where: { id },
        data,
        select: {
          id: true, fechaIngreso: true,
          montoPesosEquivalente: true, valorJusAlCobro: true, montoJusEquivalente: true
        },
      });

      // === CAMBIO CLAVE ===
      // 3) Desactivar TODAS las aplicaciones activas del ingreso (vamos a reconstruir)
      const appsActivas = await tx.ingresoCuota.findMany({
        where: { ingresoId: id, deletedAt: null, activo: true },
        select: { id: true, cuotaId: true },
      });

      if (appsActivas.length) {
        await tx.ingresoCuota.updateMany({
          where: { id: { in: appsActivas.map(a => a.id) } },
          data: { activo: false, deletedAt: new Date(), deletedBy: req.user?.id ?? null },
        });
      }

      // 4) Reconstruir solo sobre las cuotas seleccionadas, aplicando parcial si hace falta
      const keepSet = new Set(selectedCuotaIds.map(Number).filter(n => Number.isFinite(n) && n > 0));

      const vj = toNum(ingresoUpd.valorJusAlCobro) || (await findValorJusSnapshot(ingresoUpd.fechaIngreso));
      const ingresoTotal = ingresoTotalARS(ingresoUpd);
      let aplicadoSesion = 0;

      // Ordenar por vencimiento/numero
      const cuotas = keepSet.size
        ? await tx.planCuota.findMany({
            where: { id: { in: [...keepSet] }, deletedAt: null, activo: true },
            select: { id: true, numero: true, vencimiento: true, montoJus: true, montoPesos: true, valorJusRef: true },
          })
        : [];
      const ordered = cuotas
        .map(c => ({ ...c, vto: c.vencimiento ? new Date(c.vencimiento).getTime() : 0, num: Number(c.numero || 0) }))
        .sort((a, b) => (a.vto !== b.vto ? a.vto - b.vto : a.num - b.num));

      const touched = new Set();

      const esCuotaJUS = (c) => (toNum(c.montoJus) > 0) && !(toNum(c.montoPesos) > 0);
      const cuotaTotalARS = (c) => {
        const pes = toNum(c.montoPesos);
        if (pes > 0) return round2(pes);
        const jus = toNum(c.montoJus);
        const v   = toNum(c.valorJusRef);
        return jus > 0 && v > 0 ? round2(jus * v) : 0;
      };
      const sumAplicadoEnCuota = async (cuotaId) => {
        const agg = await tx.ingresoCuota.aggregate({
          _sum: { montoAplicadoARS: true, montoAplicadoJUS: true },
          where: { cuotaId, deletedAt: null, activo: true },
        });
        return { ars: toNum(agg._sum.montoAplicadoARS), jus: toNum(agg._sum.montoAplicadoJUS) };
      };

      for (const c of ordered) {
        const saldoIngreso = round2(ingresoTotal - aplicadoSesion);
        if (saldoIngreso <= 0.009) break;

        // Saldo actual de la cuota (considerando otras aplicaciones de otros ingresos)
        let maxCuotaARS;
        if (esCuotaJUS(c)) {
          const totalJUS = toNum(c.montoJus);
          const agg = await sumAplicadoEnCuota(c.id);
          const saldoJUS = round2(totalJUS - agg.jus);
          if (!(vj > 0)) throw { status: 400, publicMessage: "No se pudo obtener el valor JUS" };
          maxCuotaARS = round2(Math.max(0, saldoJUS) * vj);
        } else {
          const totalARS = cuotaTotalARS(c);
          const agg = await sumAplicadoEnCuota(c.id);
          maxCuotaARS = round2(totalARS - agg.ars);
        }

        const aplicar = Math.min(maxCuotaARS, saldoIngreso);
        if (aplicar > 0.009) {
          await tx.ingresoCuota.create({
            data: {
              ingresoId: id,
              cuotaId: c.id,
              fechaAplicacion: ingresoUpd.fechaIngreso,
              montoAplicadoARS: round2(aplicar),
              valorJusAlAplic: vj || null,
              montoAplicadoJUS: vj ? round2(aplicar / vj) : null,
              createdBy: req.user?.id ?? null,
            },
          });
          aplicadoSesion = round2(aplicadoSesion + aplicar);
          touched.add(c.id);
        }
      }

      // 5) Recalcular estado de todas las cuotas tocadas originalmente y las reconstruidas
      const recalcularIds = new Set([...touched, ...appsActivas.map(a => a.cuotaId)]);
      for (const cid of recalcularIds) {
        await recalcularEstadoCuota(tx, Number(cid));
      }

      // Devolver ingreso actualizado
      return await tx.ingreso.findUnique({
        where: { id },
        include: {
          cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
          caso:    { select: { id: true, nroExpte: true, caratula: true } },
          tipo:    { select: { id: true, codigo: true, nombre: true } },
          moneda:  { select: { id: true, codigo: true, nombre: true } },
          estado:  { select: { id: true, codigo: true, nombre: true } },
        },
      });
    });

    res.json(updated);
  } catch (e) {
    next(e?.status ? e : { status: 500, publicMessage: e?.publicMessage || "Error al reconciliar ingreso" });
  } 
}

