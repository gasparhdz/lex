import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function obtener(req, res, next) {
  try {
    const { casoId } = req.params;
    const historial = await prisma.casoHistorial.findMany({
      where: { casoId: Number(casoId) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        campo: true,
        valorAnterior: true,
        valorNuevo: true,
        createdAt: true,
      },
    });
    res.json(historial);
  } catch (e) {
    next(e);
  }
}

