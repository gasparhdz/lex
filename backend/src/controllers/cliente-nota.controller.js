// src/controllers/cliente-nota.controller.js
import prisma from "../utils/prisma.js";

/**
 * GET /api/clientes/:clienteId/notas
 * Listar notas de un cliente
 */
export async function listar(req, res, next) {
  try {
    const clienteId = Number(req.params.clienteId);
    if (!Number.isInteger(clienteId)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    const notas = await prisma.clienteNota.findMany({
      where: { clienteId, deletedAt: null },
      orderBy: { createdAt: "desc" },
    });

    res.json(notas);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/clientes/:clienteId/notas
 * Crear nueva nota
 * body: { contenido }
 */
export async function crear(req, res, next) {
  try {
    const clienteId = Number(req.params.clienteId);
    if (!Number.isInteger(clienteId)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    const { contenido } = req.body;
    if (!contenido || !String(contenido).trim()) {
      return next({ status: 400, publicMessage: "Contenido de la nota es requerido" });
    }

    const existe = await prisma.cliente.findFirst({
      where: { id: clienteId, deletedAt: null },
      select: { id: true },
    });
    if (!existe) {
      return next({ status: 404, publicMessage: "Cliente no encontrado" });
    }

    const nueva = await prisma.clienteNota.create({
      data: {
        clienteId,
        contenido: String(contenido).trim(),
        createdBy: req.user?.id ?? null,
      },
    });

    res.status(201).json(nueva);
  } catch (e) {
    next(e);
  }
}

/**
 * PUT /api/clientes/:clienteId/notas/:notaId
 * Actualizar nota
 * body: { contenido }
 */
export async function actualizar(req, res, next) {
  try {
    const clienteId = Number(req.params.clienteId);
    const notaId = Number(req.params.notaId);
    if (!Number.isInteger(clienteId) || !Number.isInteger(notaId)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    const { contenido } = req.body;
    if (contenido !== undefined && !String(contenido).trim()) {
      return next({ status: 400, publicMessage: "Contenido de la nota es requerido" });
    }

    const existe = await prisma.clienteNota.findFirst({
      where: { id: notaId, clienteId, deletedAt: null },
      select: { id: true },
    });
    if (!existe) {
      return next({ status: 404, publicMessage: "Nota no encontrada" });
    }

    const actualizada = await prisma.clienteNota.update({
      where: { id: notaId },
      data: {
        contenido: contenido !== undefined ? String(contenido).trim() : undefined,
        updatedBy: req.user?.id ?? null,
      },
    });

    res.json(actualizada);
  } catch (e) {
    next(e);
  }
}

/**
 * DELETE /api/clientes/:clienteId/notas/:notaId
 * Eliminar nota (soft delete)
 */
export async function eliminar(req, res, next) {
  try {
    const clienteId = Number(req.params.clienteId);
    const notaId = Number(req.params.notaId);
    if (!Number.isInteger(clienteId) || !Number.isInteger(notaId)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    const existe = await prisma.clienteNota.findFirst({
      where: { id: notaId, clienteId, deletedAt: null },
      select: { id: true },
    });
    if (!existe) {
      return next({ status: 404, publicMessage: "Nota no encontrada" });
    }

    await prisma.clienteNota.update({
      where: { id: notaId },
      data: { deletedAt: new Date(), deletedBy: req.user?.id ?? null },
    });

    res.status(204).end();
  } catch (e) {
    next(e);
  }
}

