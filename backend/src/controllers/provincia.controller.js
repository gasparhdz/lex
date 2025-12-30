// src/controllers/provincia.controller.js
import prisma from "../utils/prisma.js";

export async function listar(req, res, next) {
  try {
    const search = String(req.query.search || "").trim();
    const where = {};
    
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: "insensitive" } },
        { pais: { nombre: { contains: search, mode: "insensitive" } } },
      ];
    }

    const provincias = await prisma.provincia.findMany({
      where,
      include: {
        pais: {
          select: { id: true, nombre: true, codigoIso: true },
        },
      },
      orderBy: [{ pais: { nombre: "asc" } }, { nombre: "asc" }],
    });

    res.json(provincias);
  } catch (e) {
    next(e);
  }
}

export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const provincia = await prisma.provincia.findUnique({
      where: { id },
      include: {
        pais: true,
        localidades: {
          select: { id: true, nombre: true },
        },
      },
    });

    if (!provincia) return next({ status: 404, publicMessage: "Provincia no encontrada" });
    res.json(provincia);
  } catch (e) {
    next(e);
  }
}

export async function crear(req, res, next) {
  try {
    const { nombre, paisId } = req.body;

    if (!nombre || !paisId) {
      return next({ status: 400, publicMessage: "Nombre y país son requeridos" });
    }

    // Verificar que el país existe
    const pais = await prisma.pais.findUnique({ where: { id: Number(paisId) } });
    if (!pais) return next({ status: 404, publicMessage: "País no encontrado" });

    const nuevo = await prisma.provincia.create({
      data: {
        nombre: nombre.trim(),
        paisId: Number(paisId),
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

    const existe = await prisma.provincia.findUnique({ where: { id } });
    if (!existe) return next({ status: 404, publicMessage: "Provincia no encontrada" });

    const { nombre, paisId } = req.body;

    if (paisId) {
      const pais = await prisma.pais.findUnique({ where: { id: Number(paisId) } });
      if (!pais) return next({ status: 404, publicMessage: "País no encontrado" });
    }

    const actualizado = await prisma.provincia.update({
      where: { id },
      data: {
        ...(nombre !== undefined ? { nombre: nombre.trim() } : {}),
        ...(paisId !== undefined ? { paisId: Number(paisId) } : {}),
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

    const existe = await prisma.provincia.findUnique({ 
      where: { id },
      include: { _count: { select: { localidades: true } } }
    });
    
    if (!existe) return next({ status: 404, publicMessage: "Provincia no encontrada" });

    if (existe._count.localidades > 0) {
      return next({ status: 400, publicMessage: "No se puede eliminar una provincia que tiene localidades asociadas" });
    }

    await prisma.provincia.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

