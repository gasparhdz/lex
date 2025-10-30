// src/controllers/localidad.controller.js
import prisma from "../utils/prisma.js";

// Helper para tokenizar búsqueda
function tokenize(q) {
  return String(q || "").trim().split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
}

export async function listar(req, res, next) {
  try {
    const tokens = tokenize(req.query.search);
    const where = {
      AND: [
        ...(tokens.length
          ? tokens.map(t => ({
              OR: [
                { nombre: { contains: t, mode: "insensitive" } },
                { codigosPostales: { some: { codigo: { contains: t } } } },
                { provincia: { nombre: { contains: t, mode: "insensitive" } } },
                { provincia: { pais: { nombre: { contains: t, mode: "insensitive" } } } },
              ],
            }))
          : []),
      ],
    };

    const data = await prisma.localidad.findMany({
      where,
      orderBy: [{ nombre: "asc" }],
      include: {
        provincia: {
          select: {
            id: true,
            nombre: true,
            pais: { select: { id: true, nombre: true, codigoIso: true } },
          },
        },
        codigosPostales: { select: { id: true, codigo: true } },
      },
    });

    res.json(data);
  } catch (e) {
    next(e);
  }
}

export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const localidad = await prisma.localidad.findUnique({
      where: { id },
      include: {
        provincia: {
          include: {
            pais: true,
          },
        },
        codigosPostales: true,
        _count: {
          select: {
            clientes: true,
          },
        },
      },
    });

    if (!localidad) return next({ status: 404, publicMessage: "Localidad no encontrada" });
    res.json(localidad);
  } catch (e) {
    next(e);
  }
}

export async function crear(req, res, next) {
  try {
    const { nombre, provinciaId } = req.body;

    if (!nombre || !provinciaId) {
      return next({ status: 400, publicMessage: "Nombre y provincia son requeridos" });
    }

    // Verificar que la provincia existe
    const provincia = await prisma.provincia.findUnique({ where: { id: Number(provinciaId) } });
    if (!provincia) return next({ status: 404, publicMessage: "Provincia no encontrada" });

    const nuevo = await prisma.localidad.create({
      data: {
        nombre: nombre.trim(),
        provinciaId: Number(provinciaId),
      },
    });

    res.status(201).json(nuevo);
  } catch (e) {
    next(e);
  }
}

export async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.localidad.findUnique({ where: { id } });
    if (!existe) return next({ status: 404, publicMessage: "Localidad no encontrada" });

    const { nombre, provinciaId } = req.body;

    if (provinciaId) {
      const provincia = await prisma.provincia.findUnique({ where: { id: Number(provinciaId) } });
      if (!provincia) return next({ status: 404, publicMessage: "Provincia no encontrada" });
    }

    const actualizado = await prisma.localidad.update({
      where: { id },
      data: {
        ...(nombre !== undefined ? { nombre: nombre.trim() } : {}),
        ...(provinciaId !== undefined ? { provinciaId: Number(provinciaId) } : {}),
      },
    });

    res.json(actualizado);
  } catch (e) {
    next(e);
  }
}

export async function eliminar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.localidad.findUnique({ 
      where: { id },
      include: { _count: { select: { clientes: true, codigosPostales: true } } }
    });
    
    if (!existe) return next({ status: 404, publicMessage: "Localidad no encontrada" });

    if (existe._count.clientes > 0) {
      return next({ status: 400, publicMessage: "No se puede eliminar una localidad que tiene clientes asociados" });
    }

    if (existe._count.codigosPostales > 0) {
      return next({ status: 400, publicMessage: "No se puede eliminar una localidad que tiene códigos postales asociados" });
    }

    await prisma.localidad.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}
