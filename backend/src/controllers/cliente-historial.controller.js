// src/controllers/cliente-historial.controller.js
import prisma from "../utils/prisma.js";

/**
 * GET /api/clientes/:clienteId/historial
 * Obtener historial de cambios de un cliente
 */
export async function obtener(req, res, next) {
  try {
    const clienteId = Number(req.params.clienteId);
    if (!Number.isInteger(clienteId)) {
      return next({ status: 400, publicMessage: "ID inválido" });
    }

    const historial = await prisma.clienteHistorial.findMany({
      where: { clienteId },
      orderBy: { createdAt: "desc" },
    });

    res.json(historial);
  } catch (e) {
    next(e);
  }
}

