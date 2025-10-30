// src/controllers/cliente.controller.js
import prisma from "../utils/prisma.js";
import { Prisma } from "@prisma/client";

/* ========================= Helpers ========================= */
function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? "20", 10)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

function tokenize(search) {
  return String(search || "")
    .trim()
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function buildWhere(search, tipoPersonaId, activo) {
  const where = {};
  
  // Siempre filtrar los no eliminados
  where.deletedAt = null;

  // Filtro por tipo de persona
  if (tipoPersonaId && tipoPersonaId !== "") {
    where.tipoPersonaId = Number(tipoPersonaId);
  }

  // Filtro por estado activo
  if (activo !== undefined && activo !== "") {
    const activeValue = activo === true || activo === "true" || String(activo).toLowerCase() === "true";
    where.activo = activeValue;
  }

  // Filtro por búsqueda
  const tokens = tokenize(search);
  if (tokens.length > 0) {
    where.AND = tokens.map((s) => ({
      OR: [
        { nombre: { contains: s, mode: "insensitive" } },
        { apellido: { contains: s, mode: "insensitive" } },
        { razonSocial: { contains: s, mode: "insensitive" } },
        { email: { contains: s, mode: "insensitive" } },
        { dni: { contains: s } },
        { cuit: { contains: s } },
        { telCelular: { contains: s } },
        { telFijo: { contains: s } },
        { dirCalle: { contains: s, mode: "insensitive" } },
        { codigoPostal: { contains: s } },
      ],
    }));
  }

  return where;
}

function buildOrderBy({ orderBy, order, sort }) {
  if (orderBy) {
    const dir = (order || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    switch (orderBy) {
      case "displayName":
        return [{ razonSocial: dir }, { apellido: dir }, { nombre: dir }];
      case "cuit":
      case "email":
      case "telCelular":
      case "apellido":
      case "nombre":
      case "razonSocial":
      case "createdAt":
        return [{ [orderBy]: dir }];
      default:
        return [{ apellido: "asc" }, { nombre: "asc" }];
    }
  }

  if (sort) {
    const parts = String(sort).split(",").map((x) => x.trim()).filter(Boolean);
    const allow = new Set([
      "apellido",
      "nombre",
      "razonSocial",
      "createdAt",
      "cuit",
      "email",
      "telCelular",
    ]);
    const orderByArr = [];
    for (const p of parts) {
      const [field, dirRaw] = p.split(":");
      if (!field || !allow.has(field)) continue;
      const dir = (dirRaw || "asc").toLowerCase() === "desc" ? "desc" : "asc";
      orderByArr.push({ [field]: dir });
    }
    if (orderByArr.length) return orderByArr;
  }

  return [{ apellido: "asc" }, { nombre: "asc" }];
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
function digitsOrNull(v) {
  if (v === null) return null;
  if (v === undefined) return undefined;
  const s = String(v).replace(/\D/g, "");
  return s === "" ? null : s;
}

/** Cliente: acepta alias del front y devuelve objeto listo para Prisma */
function mapClienteDTO(dto = {}) {
  const out = {};

  if ("tipoPersonaId" in dto) out.tipoPersonaId = intOrNull(dto.tipoPersonaId);

  if ("nombre" in dto) out.nombre = strOrNull(dto.nombre);
  if ("apellido" in dto) out.apellido = strOrNull(dto.apellido);
  if ("razonSocial" in dto) out.razonSocial = strOrNull(dto.razonSocial);

  if ("dni" in dto) out.dni = digitsOrNull(dto.dni);
  if ("cuit" in dto) out.cuit = digitsOrNull(dto.cuit);

  if ("fechaNacimiento" in dto)
    out.fechaNacimiento = toDateOrNull(dto.fechaNacimiento);
  // ⬇️ IMPORTANTE: mapear fechaInicioActividad (PJ)
  if ("fechaInicioActividad" in dto && !("fechaNacimiento" in dto)) {
    out.fechaNacimiento = toDateOrNull(dto.fechaInicioActividad);
  }

  if ("email" in dto) out.email = strOrNull(dto.email);
  if ("telFijo" in dto) out.telFijo = strOrNull(dto.telFijo);
  if ("telCelular" in dto) out.telCelular = strOrNull(dto.telCelular);

  if ("dirCalle" in dto) out.dirCalle = strOrNull(dto.dirCalle);
  if ("dirNro" in dto) out.dirNro = strOrNull(dto.dirNro);
  if ("dirPiso" in dto) out.dirPiso = strOrNull(dto.dirPiso);
  if ("dirDepto" in dto) out.dirDepto = strOrNull(dto.dirDepto);
  if ("codigoPostal" in dto) out.codigoPostal = strOrNull(dto.codigoPostal);

  if ("localidadId" in dto) out.localidadId = intOrNull(dto.localidadId);

  if ("observaciones" in dto) out.observaciones = strOrNull(dto.observaciones);
  if ("activo" in dto) out.activo = Boolean(dto.activo);

  // aliases front
  if ("calle" in dto) out.dirCalle = strOrNull(dto.calle);
  if ("nro" in dto) out.dirNro = strOrNull(dto.nro);
  if ("piso" in dto) out.dirPiso = strOrNull(dto.piso);
  if ("depto" in dto) out.dirDepto = strOrNull(dto.depto);
  if ("notas" in dto) out.observaciones = strOrNull(dto.notas);

  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

/** Contacto: normaliza campos del contacto */
function mapContactoDTO(dto = {}) {
  const out = {};
  if ("nombre" in dto) out.nombre = strOrNull(dto.nombre);
  if ("rol" in dto) out.rol = strOrNull(dto.rol);
  if ("email" in dto) out.email = strOrNull(dto.email);
  if ("telefono" in dto) out.telefono = strOrNull(dto.telefono);
  if ("observaciones" in dto) out.observaciones = strOrNull(dto.observaciones);
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
}

/* ========================= Handlers ========================= */

/**
 * GET /api/clientes
 */
export async function listar(req, res, next) {
  try {
    const { page, pageSize, skip, take } = parsePagination(req);
    const where = buildWhere(req.query.search, req.query.tipoPersonaId, req.query.activo);
    const orderBy = buildOrderBy({
      orderBy: req.query.orderBy,
      order: req.query.order,
      sort: req.query.sort,
    });

    const orderByParam = (req.query.orderBy || "").toString();
    const orderDir =
      (req.query.order || "asc").toLowerCase() === "desc"
        ? Prisma.sql`DESC`
        : Prisma.sql`ASC`;

    if (orderByParam === "displayName") {
      try {
        const tokens = tokenize(req.query.search);
        const tokenClauses = tokens.map((tok) => {
          const q = `%${tok}%`;
          return Prisma.sql`
            (
              c."nombre" ILIKE ${q} OR
              c."apellido" ILIKE ${q} OR
              c."razonSocial" ILIKE ${q} OR
              c."email" ILIKE ${q} OR
              c."dni"::text ILIKE ${q} OR
              c."cuit"::text ILIKE ${q} OR
              c."telCelular" ILIKE ${q}
            )
          `;
        });

        // Construir WHERE simplemente
        let whereSql = Prisma.sql`c."deletedAt" IS NULL`;
        
        if (tokenClauses.length > 0) {
          whereSql = Prisma.sql`${whereSql} AND (${Prisma.join(tokenClauses, Prisma.sql` AND `)})`;
        }
        
        if (req.query.tipoPersonaId) {
          whereSql = Prisma.sql`${whereSql} AND c."tipoPersonaId" = ${Number(req.query.tipoPersonaId)}`;
        }
        
        if (req.query.activo !== undefined && req.query.activo !== "") {
          const activoValue = req.query.activo === true || req.query.activo === "true";
          whereSql = Prisma.sql`${whereSql} AND c."activo" = ${activoValue}`;
        }

        const [countRow] = await prisma.$queryRaw`
          SELECT COUNT(*)::int AS total
          FROM "Cliente" c
          WHERE ${whereSql};
        `;
        const total = countRow?.total ?? 0;

        const data = await prisma.$queryRaw`
          SELECT
            c."id",
            c."nombre",
            c."apellido",
            c."razonSocial",
            c."dni",
            c."cuit",
            c."email",
            c."telCelular",
            c."dirCalle",
            c."dirNro",
            c."dirPiso",
            c."dirDepto",
            c."localidadId",
            c."activo",
            c."tipoPersonaId"
          FROM "Cliente" c
          WHERE ${whereSql}
          ORDER BY
            lower(COALESCE(NULLIF(c."razonSocial", ''), trim(c."apellido" || ', ' || c."nombre"))) ${orderDir},
            c."id" ASC
          OFFSET ${skip}
          LIMIT ${take};
        `;

        return res.json({ data, page, pageSize, total });
      } catch (error) {
        console.error("Error en query raw:", error);
        throw error;
      }
    }

    const [total, data] = await Promise.all([
      prisma.cliente.count({ where }),
      prisma.cliente.findMany({
        where,
        orderBy,
        skip,
        take,
        include: {
          tipoPersona: { select: { id: true, codigo: true, nombre: true } },
          localidad: {
            select: {
              id: true,
              nombre: true,
              provincia: {
                select: {
                  id: true,
                  nombre: true,
                  pais: { select: { id: true, nombre: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    res.json({ data, page, pageSize, total });
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/clientes/:id
 */
export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const cli = await prisma.cliente.findFirst({
      where: { id, deletedAt: null },
      include: {
        contactos: { where: { deletedAt: null } }, // ← sólo no eliminados
        tipoPersona: { select: { id: true, codigo: true, nombre: true } },
        localidad: {
          select: {
            id: true,
            nombre: true,
            provincia: {
              select: {
                id: true,
                nombre: true,
                pais: { select: { id: true, nombre: true } },
              },
            },
          },
        },
      },
    });
    if (!cli) return next({ status: 404, publicMessage: "Cliente no encontrado" });
    res.json(cli);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/clientes
 */
export async function crear(req, res, next) {
  try {
    const dto = mapClienteDTO(req.body);

    const tipo = await prisma.parametro.findFirst({
      where: { id: dto.tipoPersonaId, categoria: { codigo: "TIPO_PERSONA", activo: true }, activo: true },
      select: { id: true, codigo: true },
    });
    if (!tipo) return next({ status: 400, publicMessage: "tipoPersonaId inválido" });

    const esJuridica = tipo.codigo === "PERSONA_JURIDICA";
    if (esJuridica) {
      if (!dto.razonSocial) {
        return next({ status: 400, publicMessage: "razonSocial requerida para persona jurídica" });
      }
    } else {
      if (!(dto.nombre && dto.apellido)) {
        return next({ status: 400, publicMessage: "nombre y apellido requeridos para persona física" });
      }
    }

    if (!dto.dni && !dto.cuit) {
      return next({ status: 400, publicMessage: "Debe informar DNI o CUIT" });
    }

    const nuevo = await prisma.cliente.create({
      data: { ...dto, createdBy: req.user?.id ?? null },
    });
    res.status(201).json(nuevo);
  } catch (e) {
    if (e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : "campo único";
      return next({ status: 409, publicMessage: `Ya existe un registro con ese CUIT` });
    }
    next(e);
  }
}

/**
 * PUT /api/clientes/:id
 */
export async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.cliente.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existe) return next({ status: 404, publicMessage: "Cliente no encontrado" });

    // Obtener valores actuales para comparar
    const actual = await prisma.cliente.findUnique({
      where: { id },
      select: {
        nombre: true, apellido: true, razonSocial: true, dni: true, cuit: true,
        email: true, telCelular: true, dirCalle: true, dirNro: true,
        localidadId: true, observaciones: true, activo: true,
      },
    });

    const dto = mapClienteDTO(req.body);

    if ("tipoPersonaId" in dto && dto.tipoPersonaId != null) {
      const tipo = await prisma.parametro.findFirst({
        where: { id: dto.tipoPersonaId, categoria: { codigo: "TIPO_PERSONA", activo: true }, activo: true },
        select: { id: true, codigo: true },
      });
      if (!tipo) return next({ status: 400, publicMessage: "tipoPersonaId inválido" });

      const esJuridica = tipo.codigo === "PERSONA_JURIDICA";
      if (esJuridica && "razonSocial" in dto && !dto.razonSocial) {
        return next({ status: 400, publicMessage: "razonSocial requerida para persona jurídica" });
      }
      if (!esJuridica && (("nombre" in dto) || ("apellido" in dto))) {
        if (!(dto.nombre && dto.apellido)) {
          return next({ status: 400, publicMessage: "nombre y apellido requeridos para persona física" });
        }
      }
    }

    if (("dni" in dto && (dto.dni === null || dto.dni === "")) &&
        ("cuit" in dto && (dto.cuit === null || dto.cuit === ""))) {
      return next({ status: 400, publicMessage: "No puede dejar sin DNI y sin CUIT" });
    }

    const upd = await prisma.cliente.update({
      where: { id },
      data: { ...dto, updatedBy: req.user?.id ?? null },
    });

    // Registrar cambios en historial
    const cambios = [];
    const campos = {
      nombre: { label: "Nombre" },
      apellido: { label: "Apellido" },
      razonSocial: { label: "Razón social" },
      dni: { label: "DNI" },
      cuit: { label: "CUIT" },
      email: { label: "Email" },
      telCelular: { label: "Teléfono celular" },
      dirCalle: { label: "Calle" },
      dirNro: { label: "Número" },
      localidadId: { label: "Localidad" },
      observaciones: { label: "Observaciones" },
      activo: { label: "Estado" },
    };

    for (const [campo, { label }] of Object.entries(campos)) {
      const valorAnterior = actual?.[campo] ?? null;
      const valorNuevo = dto[campo] ?? (upd[campo] ?? null);

      // Para IDs, convertir a número para comparación
      if (campo === "localidadId") {
        const vAnt = valorAnterior != null ? Number(valorAnterior) : null;
        const vNue = valorNuevo != null ? Number(valorNuevo) : null;
        if (vAnt !== vNue) {
          cambios.push({ campo: label, valorAnterior: vAnt?.toString() ?? "", valorNuevo: vNue?.toString() ?? "" });
        }
      } else if (valorAnterior !== valorNuevo && (valorAnterior != null || valorNuevo != null)) {
        const vAnt = valorAnterior != null ? String(valorAnterior) : "";
        const vNue = valorNuevo != null ? String(valorNuevo) : "";
        if (vAnt !== vNue) {
          cambios.push({ campo: label, valorAnterior: vAnt, valorNuevo: vNue });
        }
      }
    }

    // Guardar cambios si hay alguno
    if (cambios.length > 0) {
      await prisma.clienteHistorial.createMany({
        data: cambios.map((c) => ({
          clienteId: id,
          campo: c.campo,
          valorAnterior: c.valorAnterior,
          valorNuevo: c.valorNuevo,
          createdBy: req.user?.id ?? null,
        })),
      });
    }

    res.json(upd);
  } catch (e) {
    if (e.code === "P2002") {
      const target = Array.isArray(e.meta?.target) ? e.meta.target.join(",") : "campo único";
      return next({ status: 409, publicMessage: `Ya existe un registro con ese ${target}` });
    }
    next(e);
  }
}

/**
 * DELETE /api/clientes/:id (soft delete)
 */
export async function borrar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.cliente.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!existe) return next({ status: 404, publicMessage: "Cliente no encontrado" });

    await prisma.cliente.update({
      where: { id },
      data: { activo: false, deletedAt: new Date(), deletedBy: req.user?.id ?? null },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

/* ==================== CONTACTOS ==================== */
/**
 * POST /api/clientes/:id/contactos
 * body: { nombre*, rol?, email?, telefono?, observaciones? }
 */
export async function crearContacto(req, res, next) {
  try {
    const clienteId = Number(req.params.id);
    if (!Number.isInteger(clienteId)) return next({ status: 400, publicMessage: "ID inválido" });

    const cli = await prisma.cliente.findFirst({ where: { id: clienteId, deletedAt: null }, select: { id: true } });
    if (!cli) return next({ status: 404, publicMessage: "Cliente no encontrado" });

    const dto = mapContactoDTO(req.body);
    if (!dto.nombre) return next({ status: 400, publicMessage: "El contacto requiere nombre" });

    const nuevo = await prisma.contactoCliente.create({
      data: { ...dto, clienteId, createdBy: req.user?.id ?? null },
    });
    res.status(201).json(nuevo);
  } catch (e) {
    next(e);
  }
}

/**
 * PUT /api/clientes/:id/contactos/:contactoId
 */
export async function actualizarContacto(req, res, next) {
  try {
    const clienteId = Number(req.params.id);
    const contactoId = Number(req.params.contactoId);
    if (!Number.isInteger(clienteId) || !Number.isInteger(contactoId)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    const existe = await prisma.contactoCliente.findFirst({
      where: { id: contactoId, clienteId, deletedAt: null },
      select: { id: true },
    });
    if (!existe) return next({ status: 404, publicMessage: "Contacto no encontrado" });

    const dto = mapContactoDTO(req.body);
    if ("nombre" in dto && !dto.nombre) {
      return next({ status: 400, publicMessage: "El contacto requiere nombre" });
    }

    const upd = await prisma.contactoCliente.update({
      where: { id: contactoId },
      data: { ...dto, updatedBy: req.user?.id ?? null },
    });
    res.json(upd);
  } catch (e) {
    next(e);
  }
}

/**
 * DELETE /api/clientes/:id/contactos/:contactoId (soft)
 */
export async function eliminarContacto(req, res, next) {
  try {
    const clienteId = Number(req.params.id);
    const contactoId = Number(req.params.contactoId);
    if (!Number.isInteger(clienteId) || !Number.isInteger(contactoId)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    const existe = await prisma.contactoCliente.findFirst({
      where: { id: contactoId, clienteId, deletedAt: null },
      select: { id: true },
    });
    if (!existe) return next({ status: 404, publicMessage: "Contacto no encontrado" });

    await prisma.contactoCliente.update({
      where: { id: contactoId },
      data: { deletedAt: new Date(), deletedBy: req.user?.id ?? null },
    });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

export async function detalleCliente(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    // ===== Helpers numéricos
    const num = (v) => {
      if (v === null || v === undefined) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    // Monto total de un honorario expresable en JUS y ARS de referencia
    const computeMontosHonorario = (h) => {
      const jus = Number(h.jus ?? 0) || 0;
      const pesos = Number(h.montoPesos ?? 0) || 0;
      const vj = Number(h.valorJusRef ?? 0) || 0;

      const totalJus = jus > 0 ? jus : vj > 0 && pesos > 0 ? pesos / vj : 0;
      const totalPesosRef = pesos > 0 ? pesos : vj > 0 && jus > 0 ? jus * vj : 0;

      return { totalJus, totalPesosRef, valorJusRef: vj || null };
    };

    // Cobrado por HONORARIO a partir de IngresoCuota (puede venir en ARS y/o JUS)
    const sumCobradoByHonorario = async (ids = []) => {
      if (!ids.length) return { ars: {}, jus: {} };

      const apps = await prisma.ingresoCuota.findMany({
        where: {
          activo: true,
          deletedAt: null,
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
      ids.forEach((hid) => {
        outARS[hid] = Number(ars.get(hid) || 0);
        outJUS[hid] = Number(jus.get(hid) || 0);
      });

      return { ars: outARS, jus: outJUS };
    };

    // **NUEVO**: Aplicado por GASTO a partir de IngresoGasto (siempre ARS)
    const sumAplicadoByGasto = async (ids = []) => {
      if (!ids.length) return {};
      const rows = await prisma.ingresoGasto.findMany({
        where: { activo: true, deletedAt: null, gastoId: { in: ids } },
        select: { gastoId: true, montoAplicadoARS: true },
      });
      const map = new Map();
      for (const r of rows) {
        const gid = r.gastoId;
        const ars = Number(r.montoAplicadoARS || 0);
        map.set(gid, (map.get(gid) || 0) + (Number.isFinite(ars) ? ars : 0));
      }
      const out = {};
      ids.forEach((gid) => (out[gid] = Number(map.get(gid) || 0)));
      return out;
    };

    // ===== Cliente (cabecera)
    const cliente = await prisma.cliente.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        tipoPersona: { select: { id: true, codigo: true, nombre: true } },
        nombre: true,
        apellido: true,
        razonSocial: true,
        cuit: true,
        dni: true,
        fechaNacimiento: true,
        email: true,
        telCelular: true,
        telFijo: true,
        dirCalle: true,
        dirNro: true,
        dirPiso: true,
        dirDepto: true,
        codigoPostal: true,
        localidad: { select: { id: true, nombre: true } },
        contactos: {
          where: { deletedAt: null },
          orderBy: { id: "asc" },
          select: {
            id: true, nombre: true, rol: true, email: true, telefono: true, observaciones: true,
          },
        },
      },
    });
    if (!cliente) return next({ status: 404, publicMessage: "Cliente no encontrado" });

    // ===== Colecciones asociadas (en paralelo)
    const [casos, tareas, eventos, honRaw, gasRaw, ingRaw] = await Promise.all([
      prisma.caso.findMany({
        where: { clienteId: id, deletedAt: null, activo: true },
        select: {
          id: true, nroExpte: true, caratula: true,
          estado: { select: { id: true, nombre: true } },
          tipo: { select: { id: true, nombre: true } },
        },
        orderBy: [{ id: "desc" }],
      }),

      prisma.tarea.findMany({
        where: { clienteId: id, deletedAt: null, activo: true },
        select: {
          id: true, titulo: true, fechaLimite: true, completada: true,
          prioridad: { select: { id: true, nombre: true, codigo: true } },
        },
        orderBy: [{ id: "desc" }],
      }),

      prisma.evento.findMany({
        where: { clienteId: id, deletedAt: null, activo: true },
        select: {
          id: true, descripcion: true, fechaInicio: true, fechaFin: true,
          estado: { select: { id: true, nombre: true } },
        },
        orderBy: [{ fechaInicio: "desc" }],
      }),

      prisma.honorario.findMany({
        where: { clienteId: id, deletedAt: null, activo: true },
        include: {
          estado:  { select: { id: true, nombre: true } },
          moneda:  { select: { id: true, codigo: true, nombre: true } },
          concepto:{ select: { id: true, nombre: true } },
          parte:   { select: { id: true, nombre: true } },
          caso:    { select: { id: true, caratula: true, nroExpte: true } },
        },
        orderBy: [{ fechaRegulacion: "desc" }, { id: "desc" }],
      }),

      prisma.gasto.findMany({
        where: { clienteId: id, deletedAt: null, activo: true },
        include: {
          concepto: { select: { id: true, nombre: true } },
          moneda:   { select: { id: true, codigo: true, nombre: true } },
          caso:     { select: { id: true, caratula: true, nroExpte: true } },
        },
        orderBy: [{ fechaGasto: "desc" }, { id: "desc" }],
      }),

      prisma.ingreso.findMany({
        where: { clienteId: id, deletedAt: null, activo: true },
        include: {
          tipo:   { select: { id: true, nombre: true } },
          estado: { select: { id: true, nombre: true } },
          moneda: { select: { id: true, codigo: true, nombre: true } },
          caso:   { select: { id: true, caratula: true, nroExpte: true } },
        },
        orderBy: [{ fechaIngreso: "desc" }, { id: "desc" }],
      }),
    ]);

    // ===== Cobrado por honorario
    const honIds = honRaw.map((h) => h.id);
    const { ars: cobradoARS, jus: cobradoJUS } = await sumCobradoByHonorario(honIds);

    // ===== Aplicado por gasto (ARS)
    const gastoIds = gasRaw.map((g) => g.id);
    const aplicadoPorGasto = await sumAplicadoByGasto(gastoIds);

    // ===== Normalizaciones

    // Honorarios
    const honorarios = honRaw.map((h) => {
      const { totalJus, totalPesosRef, valorJusRef } = computeMontosHonorario(h);
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
        caso: h.caso || null,

        // aliases
        montoJUS: h.jus,
        montoARS: h.montoPesos,
        fecha: h.fechaRegulacion,
        casoNombre: h.caso?.caratula ?? null,
        nroExpte: h.caso?.nroExpte ?? null,
        tipoNombre: h.concepto?.nombre ?? null,
        parteNombre: h.parte?.nombre ?? null,
        monedaCodigo: h.moneda?.codigo ?? null,

        // datos reales para UI
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

    // Gastos (traemos aplicadoARS real y saldo)
    const gastos = gasRaw.map((g) => {
      const aplicadoARS = Number(aplicadoPorGasto[g.id] || 0);
      const montoARS = Number(g.monto ?? 0); // en tu modelo Gasto el monto es ARS
      const saldoARS = Math.max(montoARS - aplicadoARS, 0);

      return {
        id: g.id,
        descripcion: g.descripcion,
        fechaGasto: g.fechaGasto,
        monto: g.monto,
        concepto: g.concepto || null,
        moneda: g.moneda || null,
        caso: g.caso || null,

        // aliases front-friendly
        fecha: g.fechaGasto,
        conceptoNombre: g.concepto?.nombre ?? null,
        casoNombre: g.caso?.caratula ?? null,
        nroExpte: g.caso?.nroExpte ?? null,

        // montos listos para UI
        montoARS,
        aplicadoARS,
        saldoARS,
      };
    });

    // Ingresos (importeARS calculado)
    const ingresos = ingRaw.map((i) => {
      const monCod = (i.moneda?.codigo || "").toUpperCase();
      const esARS = monCod === "ARS";
      const esJUS = monCod === "JUS";

      let importeARS = num(i.montoPesosEquivalente);
      if (importeARS == null) {
        if (esARS) {
          importeARS = num(i.monto);
        } else if (esJUS) {
          const cantJus = num(i.montoJusEquivalente ?? i.monto);
          const valJus = num(i.valorJusAlCobro);
          if (cantJus != null && valJus != null) importeARS = cantJus * valJus;
        } else {
          const montoFx = num(i.monto);
          const cotiz = num(i.cotizacionARS);
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
        caso: i.caso || null,

        // aliases
        fecha: i.fechaIngreso,
        casoNombre: i.caso?.caratula ?? null,
        nroExpte: i.caso?.nroExpte ?? null,

        // listo para front/totales
        importeARS,
        montoARS: importeARS,
      };
    });

    return res.json({ cliente, casos, tareas, eventos, honorarios, gastos, ingresos });
  } catch (e) {
    console.error("detalleCliente error:", e);
    return res
      .status(500)
      .json({
        ok: false,
        message: "Error interno al obtener detalle del cliente",
        detail: String(e?.message || e),
      });
  }
}
