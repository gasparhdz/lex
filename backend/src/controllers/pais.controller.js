// src/controllers/pais.controller.js
import prisma from "../utils/prisma.js";

export async function listar(req, res, next) {
  try {
    const search = String(req.query.search || "").trim();
    const where = {};
    
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: "insensitive" } },
        { codigoIso: { contains: search, mode: "insensitive" } },
      ];
    }

    const paises = await prisma.pais.findMany({
      where,
      orderBy: { nombre: "asc" },
    });

    res.json(paises);
  } catch (e) {
    next(e);
  }
}

export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const pais = await prisma.pais.findUnique({
      where: { id },
      include: {
        provincias: {
          select: { id: true, nombre: true },
        },
      },
    });

    if (!pais) return next({ status: 404, publicMessage: "País no encontrado" });
    res.json(pais);
  } catch (e) {
    next(e);
  }
}

export async function crear(req, res, next) {
  try {
    const { nombre, codigoIso } = req.body;

    if (!nombre) {
      return next({ status: 400, publicMessage: "El nombre es requerido" });
    }

    const nuevo = await prisma.pais.create({
      data: {
        nombre: nombre.trim(),
        codigoIso: codigoIso ? codigoIso.trim().toUpperCase() : null,
      },
    });

    res.status(201).json(nuevo);
  } catch (e) {
    if (e?.code === "P2002") {
      return next({ status: 409, publicMessage: "Ya existe un país con ese código ISO" });
    }
    next(e);
  }
}

export async function actualizar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.pais.findUnique({ where: { id } });
    if (!existe) return next({ status: 404, publicMessage: "País no encontrado" });

    const { nombre, codigoIso } = req.body;

    const actualizado = await prisma.pais.update({
      where: { id },
      data: {
        ...(nombre !== undefined ? { nombre: nombre.trim() } : {}),
        ...(codigoIso !== undefined ? { codigoIso: codigoIso ? codigoIso.trim().toUpperCase() : null } : {}),
      },
    });

    res.json(actualizado);
  } catch (e) {
    if (e?.code === "P2002") {
      return next({ status: 409, publicMessage: "Ya existe un país con ese código ISO" });
    }
    next(e);
  }
}

export async function eliminar(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const existe = await prisma.pais.findUnique({ 
      where: { id },
      include: { _count: { select: { provincias: true } } }
    });
    
    if (!existe) return next({ status: 404, publicMessage: "País no encontrado" });

    if (existe._count.provincias > 0) {
      return next({ status: 400, publicMessage: "No se puede eliminar un país que tiene provincias asociadas" });
    }

    await prisma.pais.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

