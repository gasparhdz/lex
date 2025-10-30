// src/controllers/codigopostal.controller.js
import prisma from "../utils/prisma.js";

export async function listar(req, res, next) {
  try {
    const search = String(req.query.search || "").trim();
    const where = {};
    
    if (search) {
      where.OR = [
        { codigo: { contains: search, mode: "insensitive" } },
        { localidad: { nombre: { contains: search, mode: "insensitive" } } },
      ];
    }

    const codigos = await prisma.codigoPostal.findMany({
      where,
      include: {
        localidad: {
          include: {
            provincia: {
              include: {
                pais: true,
              },
            },
          },
        },
      },
      orderBy: { codigo: "asc" },
    });

    res.json(codigos);
  } catch (e) {
    next(e);
  }
}

export async function obtener(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return next({ status: 400, publicMessage: "ID inválido" });

    const codigo = await prisma.codigoPostal.findUnique({
      where: { id },
      include: {
        localidad: {
          include: {
            provincia: {
              include: {
                pais: true,
              },
            },
          },
        },
      },
    });

    if (!codigo) return next({ status: 404, publicMessage: "Código postal no encontrado" });
    res.json(codigo);
  } catch (e) {
    next(e);
  }
}

export async function crear(req, res, next) {
  try {
    const { codigo, localidadId } = req.body;

    if (!codigo || !localidadId) {
      return next({ status: 400, publicMessage: "Código y localidad son requeridos" });
    }

    // Verificar que la localidad existe
    const localidad = await prisma.localidad.findUnique({ where: { id: Number(localidadId) } });
    if (!localidad) return next({ status: 404, publicMessage: "Localidad no encontrada" });

    const nuevo = await prisma.codigoPostal.create({
      data: {
        codigo: codigo.trim(),
        localidadId: Number(localidadId),
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

    const existe = await prisma.codigoPostal.findUnique({ where: { id } });
    if (!existe) return next({ status: 404, publicMessage: "Código postal no encontrado" });

    const { codigo, localidadId } = req.body;

    if (localidadId) {
      const localidad = await prisma.localidad.findUnique({ where: { id: Number(localidadId) } });
      if (!localidad) return next({ status: 404, publicMessage: "Localidad no encontrada" });
    }

    const actualizado = await prisma.codigoPostal.update({
      where: { id },
      data: {
        ...(codigo !== undefined ? { codigo: codigo.trim() } : {}),
        ...(localidadId !== undefined ? { localidadId: Number(localidadId) } : {}),
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

    const existe = await prisma.codigoPostal.findUnique({ where: { id } });
    if (!existe) return next({ status: 404, publicMessage: "Código postal no encontrado" });

    await prisma.codigoPostal.delete({ where: { id } });
    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

