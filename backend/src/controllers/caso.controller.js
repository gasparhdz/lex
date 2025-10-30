import prisma from "../utils/prisma.js";
import { Prisma } from "@prisma/client";

/* ========================= Helpers ========================= */
function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? "20", 10)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/* ===== helpers de búsqueda para Casos ===== */
function tokenize(search) {
  return String(search || "")
    .trim()
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function buildWhereCasos({ search, estadoId }) {
  const tokens = tokenize(search);
  const where = { deletedAt: null };

  // Filtro por estadoId (si viene)
  if (Number.isFinite(Number(estadoId))) {
    where.estadoId = Number(estadoId);
  }

  if (tokens.length === 0) return where;

  // Armar AND de tokens; cada token hace OR en varios campos (incluye cliente)
  where.AND = tokens.map((s) => ({
    OR: [
      { nroExpte: { contains: s, mode: "insensitive" } },
      { caratula: { contains: s, mode: "insensitive" } },
      { descripcion: { contains: s, mode: "insensitive" } },

      // ← búsqueda por Cliente
      { cliente: { razonSocial: { contains: s, mode: "insensitive" } } },
      { cliente: { apellido: { contains: s, mode: "insensitive" } } },
      { cliente: { nombre: { contains: s, mode: "insensitive" } } },

      // También por nombres de parámetros (opcional)
      { tipo: { nombre: { contains: s, mode: "insensitive" } } },
      { estado: { nombre: { contains: s, mode: "insensitive" } } },
      { radicacion: { nombre: { contains: s, mode: "insensitive" } } },
      { estadoRadicacion: { nombre: { contains: s, mode: "insensitive" } } },
    ],
  }));

  return where;
}


function buildOrderBy({ orderBy, order, sort }) {
  if (orderBy) {
    const dir = (order || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    switch (orderBy) {
      case "nroExpte":
      case "caratula":
      case "createdAt":
      case "fechaEstado":
        return [{ [orderBy]: dir }];
      default:
        return [{ createdAt: "desc" }];
    }
  }

  if (sort) {
    const parts = String(sort).split(",").map((x) => x.trim()).filter(Boolean);
    const allow = new Set(["nroExpte", "caratula", "createdAt", "fechaEstado"]);
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

/* ------- Normalización de DTO ------- */
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

function normalizeExpte(v) {
  if (!v) return null;
  return String(v).toUpperCase().replace(/[\s.\-/_]/g, "");
}

/** Caso: normaliza campos recibidos del front */
function mapCasoDTO(dto = {}) {
  const out = {};

  if ("clienteId" in dto) out.clienteId = intOrNull(dto.clienteId);
  if ("nroExpte" in dto) {
    out.nroExpte = strOrNull(dto.nroExpte);
    out.nroExpteNorm = normalizeExpte(dto.nroExpte);
  }
  if ("caratula" in dto) out.caratula = strOrNull(dto.caratula);
  if ("tipoId" in dto) out.tipoId = intOrNull(dto.tipoId);
  if ("descripcion" in dto) out.descripcion = strOrNull(dto.descripcion);
  if ("estadoId" in dto) out.estadoId = intOrNull(dto.estadoId);
  if ("fechaEstado" in dto) out.fechaEstado = toDateOrNull(dto.fechaEstado);
  if ("radicacionId" in dto) out.radicacionId = intOrNull(dto.radicacionId);
  if ("estadoRadicacionId" in dto) out.estadoRadicacionId = intOrNull(dto.estadoRadicacionId);
  if ("fechaEstadoRadicacion" in dto)
    out.fechaEstadoRadicacion = toDateOrNull(dto.fechaEstadoRadicacion);
  if ("activo" in dto) out.activo = Boolean(dto.activo);

  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

/* ========================= Handlers ========================= */

/**
 * GET /api/casos
 */
export async function listar(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? "20", 10)));
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // ← tomar estadoId de query
    const estadoId = req.query.estadoId ? Number(req.query.estadoId) : undefined;
    const where = buildWhereCasos({ search: req.query.search, estadoId });

    // ordenamiento básico (ajustá a tus permitidos)
    const orderByParam = (req.query.orderBy || "").toString();
    const dir = (req.query.order || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    let orderBy = [{ id: "desc" }];
    if (["nroExpte", "caratula", "createdAt", "fechaEstado"].includes(orderByParam)) {
      orderBy = [{ [orderByParam]: dir }];
    } else if (orderByParam === "cliente") {
      // Orden por cliente: primero razón social; si no hay, por Apellido y Nombre
      orderBy = [
        { cliente: { razonSocial: dir } },
        { cliente: { apellido: dir } },
        { cliente: { nombre: dir } },
        { id: "asc" }, // desempate estable
      ];
    }

    const [total, data] = await Promise.all([
      prisma.caso.count({ where }),
      prisma.caso.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          cliente: { select: { id: true, nombre: true, apellido: true, razonSocial: true } },
          tipo: { select: { id: true, nombre: true } },
          estado: { select: { id: true, nombre: true } },
          radicacion: { select: { id: true, nombre: true } },
          estadoRadicacion: { select: { id: true, nombre: true } },
        },
      }),
    ]);

    res.json({ data, page, pageSize, total });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/casos/:id
 */
export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const caso = await prisma.caso.findFirst({
      where: { id, deletedAt: null },
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true, razonSocial: true } },
        tipo: { select: { id: true, codigo: true, nombre: true } },
        estado: { select: { id: true, codigo: true, nombre: true } },
        radicacion: { select: { id: true, codigo: true, nombre: true } },
        estadoRadicacion: { select: { id: true, codigo: true, nombre: true } },
      },
    });
    if (!caso) return next({ status: 404, publicMessage: "Caso no encontrado" });
    res.json(caso);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/casos
 */
export async function crear(req, res, next) {
  try {
    const dto = mapCasoDTO(req.body);

    if (!(dto.clienteId && dto.nroExpte && dto.caratula && dto.tipoId)) {
      return next({ status: 400, publicMessage: "clienteId, nroExpte, caratula y tipoId son requeridos" });
    }

    const nuevo = await prisma.caso.create({
      data: { ...dto, createdBy: req.user?.id ?? null },
    });
    res.status(201).json(nuevo);
  } catch (e) {
    if (e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : "campo único";
      return next({ status: 409, publicMessage: `Ya existe un caso con ese ${target}` });
    }
    next(e);
  }
}

/**
 * PUT /api/casos/:id
 */
export async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.caso.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existe) return next({ status: 404, publicMessage: "Caso no encontrado" });

    // Obtener caso actual
    const casoActual = await prisma.caso.findUnique({
      where: { id },
      select: {
        nroExpte: true,
        nroExpteNorm: true,
        caratula: true,
        tipoId: true,
        estadoId: true,
        radicacionId: true,
        estadoRadicacionId: true,
        descripcion: true,
      }
    });

    const dto = mapCasoDTO(req.body);

    const upd = await prisma.caso.update({
      where: { id },
      data: { ...dto, updatedBy: req.user?.id ?? null },
    });

    // Registrar cambios en el historial
    const historialChanges = [];
    const camposRelevantes = [
      { campo: 'nroExpte', old: casoActual.nroExpte, new: dto.nroExpte },
      { campo: 'nroExpteNorm', old: casoActual.nroExpteNorm, new: dto.nroExpteNorm },
      { campo: 'caratula', old: casoActual.caratula, new: dto.caratula },
      { campo: 'tipoId', old: casoActual.tipoId, new: dto.tipoId },
      { campo: 'estadoId', old: casoActual.estadoId, new: dto.estadoId },
      { campo: 'radicacionId', old: casoActual.radicacionId, new: dto.radicacionId },
      { campo: 'estadoRadicacionId', old: casoActual.estadoRadicacionId, new: dto.estadoRadicacionId },
      { campo: 'descripcion', old: casoActual.descripcion, new: dto.descripcion },
    ];

    for (const { campo, old, new: newVal } of camposRelevantes) {
      const oldStr = old?.toString() ?? '';
      const newStr = newVal?.toString() ?? '';
      if (oldStr !== newStr) {
        historialChanges.push({
          casoId: id,
          campo,
          valorAnterior: oldStr || null,
          valorNuevo: newStr || null,
          createdBy: req.user?.id,
        });
      }
    }

    if (historialChanges.length > 0) {
      await prisma.casoHistorial.createMany({
        data: historialChanges,
      });
    }

    res.json(upd);
  } catch (e) {
    if (e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : "campo único";
      return next({ status: 409, publicMessage: `Ya existe un caso con ese ${target}` });
    }
    next(e);
  }
}

/**
 * DELETE /api/casos/:id (soft delete)
 */
export async function borrar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.caso.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existe) return next({ status: 404, publicMessage: "Caso no encontrado" });

    await prisma.caso.update({
      where: { id },
      data: { activo: false, deletedAt: new Date(), deletedBy: req.user?.id ?? null },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

export async function detalleCaso(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    // --- helpers locales ---
    const num = (v) => {
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const computeMontos = (h) => {
      const jus = Number(h.jus ?? 0) || 0;
      const pesos = Number(h.montoPesos ?? 0) || 0;
      const vj = Number(h.valorJusRef ?? 0) || 0;
      const totalJus = jus > 0 ? jus : (vj > 0 && pesos > 0 ? pesos / vj : 0);
      const totalPesosRef = pesos > 0 ? pesos : (vj > 0 && jus > 0 ? jus * vj : 0);
      return { totalJus, totalPesosRef, valorJusRef: vj || null };
    };
    const sumCobradoByHonorario = async (ids = []) => {
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
    };

    // >>> NUEVO: sumatoria de montos aplicados a GASTOS (en ARS) usando IngresoGasto
    const sumAplicadoByGasto = async (ids = []) => {
      if (!ids.length) return {};
      const apps = await prisma.ingresoGasto.findMany({
        where: {
          deletedAt: null,
          activo: true,
          gastoId: { in: ids },
        },
        select: {
          gastoId: true,
          montoAplicadoARS: true, // siempre en ARS
        },
      });
      const map = new Map();
      for (const a of apps) {
        const gid = a.gastoId;
        const val = Number(a.montoAplicadoARS || 0);
        map.set(gid, (map.get(gid) || 0) + (Number.isFinite(val) ? val : 0));
      }
      const out = {};
      ids.forEach(gid => { out[gid] = Number(map.get(gid) || 0); });
      return out;
    };

    // ===== Caso (datos base)
    const caso = await prisma.caso.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        nroExpte: true,
        nroExpteNorm: true,
        caratula: true,
        descripcion: true,
        fechaEstado: true,
        fechaEstadoRadicacion: true,
        activo: true,

        cliente: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            razonSocial: true,
            tipoPersona: { select: { id: true, codigo: true, nombre: true } },
          },
        },
        tipo:        { select: { id: true, nombre: true, codigo: true } },
        estado:      { select: { id: true, nombre: true, codigo: true } },
        radicacion:  { select: { id: true, nombre: true, codigo: true } },
        estadoRadicacion: { select: { id: true, nombre: true, codigo: true } },
      },
    });
    if (!caso) return next({ status: 404, publicMessage: "Caso no encontrado" });

    // ===== Colecciones asociadas (filtradas por casoId)
    const [tareasRaw, eventosRaw, honRaw, gasRaw, ingRaw] = await Promise.all([
      prisma.tarea.findMany({
        where: { casoId: id, deletedAt: null, activo: true },
        select: {
          id: true,
          titulo: true,
          fechaLimite: true,
          completada: true,
          prioridad: { select: { id: true, nombre: true, codigo: true } },
          cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        },
        orderBy: [{ id: "desc" }],
      }),

      prisma.evento.findMany({
        where: { casoId: id, deletedAt: null, activo: true },
        select: {
          id: true,
          descripcion: true,
          fechaInicio: true,
          fechaFin: true,
          estado: { select: { id: true, nombre: true } },
          cliente: { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
          tipo: { select: { id: true, nombre: true } },
        },
        orderBy: [{ fechaInicio: "desc" }],
      }),

      prisma.honorario.findMany({
        where: { casoId: id, deletedAt: null, activo: true },
        include: {
          estado:   { select: { id: true, nombre: true } },
          moneda:   { select: { id: true, codigo: true, nombre: true } },
          concepto: { select: { id: true, nombre: true } },
          parte:    { select: { id: true, nombre: true } },
          cliente:  { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        },
        orderBy: [{ fechaRegulacion: "desc" }, { id: "desc" }],
      }),

      prisma.gasto.findMany({
        where: { casoId: id, deletedAt: null, activo: true },
        include: {
          concepto: { select: { id: true, nombre: true} },
          moneda:   { select: { id: true, codigo: true, nombre: true } },
          cliente:  { select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        },
        orderBy: [{ fechaGasto: "desc" }, { id: "desc" }],
      }),

      prisma.ingreso.findMany({
        where: { casoId: id, deletedAt: null, activo: true },
        include: {
          tipo:   { select: { id: true, nombre: true } },
          estado: { select: { id: true, nombre: true } },
          moneda: { select: { id: true, codigo: true, nombre: true } },
          cliente:{ select: { id: true, apellido: true, nombre: true, razonSocial: true } },
        },
        orderBy: [{ fechaIngreso: "desc" }, { id: "desc" }],
      }),
    ]);

    // === Sumas de cobros por honorario (para "cobrado" y % pagado)
    const honIds = honRaw.map(h => h.id);
    const { ars: cobradoARS, jus: cobradoJUS } = await sumCobradoByHonorario(honIds);

    // >>> NUEVO: sumas aplicadas por gasto (ARS) usando IngresoGasto
    const gastoIds = gasRaw.map(g => g.id);
    const aplicadoPorGasto = await sumAplicadoByGasto(gastoIds); // { [gastoId]: aplicadoARS }

    // ===== Normalizaciones
    const honorarios = honRaw.map(h => {
      const { totalJus, totalPesosRef, valorJusRef } = computeMontos(h);
      const cobArs = Number(cobradoARS[h.id] || 0);
      const cobJus = Number(cobradoJUS[h.id] || 0);
      const saldoJus = Math.max(totalJus - cobJus, 0);

      return {
        id: h.id,
        jus: h.jus,
        montoPesos: h.montoPesos,
        fechaRegulacion: h.fechaRegulacion,
        estado: h.estado || null,
        moneda: h.moneda || null,
        concepto: h.concepto || null,
        parte: h.parte || null,
        cliente: h.cliente || null,

        // aliases
        montoJUS: h.jus,
        montoARS: h.montoPesos,
        fecha: h.fechaRegulacion,
        casoNombre: caso.caratula,
        nroExpte: caso.nroExpte,
        tipoNombre: h.concepto?.nombre ?? null,
        parteNombre: h.parte?.nombre ?? null,
        monedaCodigo: h.moneda?.codigo ?? null,

        // >>> datos reales para UI
        cobrado: cobArs, // ARS cobrados
        calc: {
          totalJus,
          totalPesosRef,
          valorJusRef,
          cobradoJus: cobJus,
          saldoJus,
          percCobrado: totalJus > 0 ? Math.max(0, Math.min(1, cobJus / totalJus)) : 0,
        },
      };
    });

    const gastos = gasRaw.map(g => {
      const montoARS = Number(g.monto ?? 0); // Decimal → Number
      const aplicadoARS = Number(aplicadoPorGasto[g.id] || 0);
      const saldoARS = Math.max(montoARS - aplicadoARS, 0);

      return {
        id: g.id,
        descripcion: g.descripcion,
        fechaGasto: g.fechaGasto,
        monto: g.monto,
        concepto: g.concepto || null,
        moneda: g.moneda || null,
        cliente: g.cliente || null,

        // aliases
        fecha: g.fechaGasto,
        conceptoNombre: g.concepto?.nombre ?? null,
        casoNombre: caso.caratula,
        nroExpte: caso.nroExpte,
        montoARS,

        // >>> datos reales para UI (alineado con ClienteGastos)
        aplicadoARS,
        saldoARS,
      };
    });

    const ingresos = ingRaw.map(i => {
      const monCod = (i.moneda?.codigo || "").toUpperCase();
      const esARS  = monCod === "ARS";
      const esJUS  = monCod === "JUS";

      // 1) preferir snapshot ya convertido a ARS
      let importeARS = num(i.montoPesosEquivalente);

      // 2) si no hay snapshot, calcular según moneda
      if (importeARS == null) {
        if (esARS) {
          importeARS = num(i.monto);
        } else if (esJUS) {
          const cantJus = num(i.montoJusEquivalente ?? i.monto);
          const valJus  = num(i.valorJusAlCobro);
          if (cantJus != null && valJus != null) importeARS = cantJus * valJus;
        } else {
          const montoFx = num(i.monto);
          const cotiz   = num(i.cotizacionARS);
          if (montoFx != null && cotiz != null) importeARS = montoFx * cotiz;
        }
      }

      return {
        id: i.id,
        descripcion: i.descripcion,
        fechaIngreso: i.fechaIngreso,

        // escalares
        monto: i.monto ?? null,
        monedaId: i.monedaId ?? null,
        cotizacionARS: i.cotizacionARS ?? null,
        valorJusAlCobro: i.valorJusAlCobro ?? null,
        montoJusEquivalente: i.montoJusEquivalente ?? null,
        montoPesosEquivalente: i.montoPesosEquivalente ?? null,

        // relaciones
        tipo: i.tipo || null,
        estado: i.estado || null,
        moneda: i.moneda || null,
        cliente: i.cliente || null,

        // aliases front
        fecha: i.fechaIngreso,
        casoNombre: caso.caratula,
        nroExpte: caso.nroExpte,

        // listo para el front / totales
        importeARS: importeARS,
        montoARS: importeARS,
      };
    });

    const tareas = tareasRaw;
    const eventos = eventosRaw;

    return res.json({
      caso,
      tareas,
      eventos,
      honorarios,
      gastos,
      ingresos,
    });
  } catch (e) {
    console.error("detalleCaso error:", e);
    return res
      .status(500)
      .json({ ok: false, message: "Error interno al obtener detalle del caso", detail: String(e?.message || e) });
  }
}
