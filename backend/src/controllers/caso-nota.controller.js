import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function listar(req, res, next) {
  try {
    const { casoId } = req.params;
    const notas = await prisma.casoNota.findMany({
      where: { casoId: Number(casoId), deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        contenido: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(notas);
  } catch (e) {
    next(e);
  }
}

export async function crear(req, res, next) {
  try {
    const { casoId } = req.params;
    const { contenido } = req.body;

    if (!contenido?.trim()) {
      return next({ status: 400, publicMessage: "El contenido es requerido" });
    }

    const nota = await prisma.casoNota.create({
      data: {
        casoId: Number(casoId),
        contenido: contenido.trim(),
        createdBy: req.user?.id,
      },
    });
    res.status(201).json(nota);
  } catch (e) {
    next(e);
  }
}

export async function actualizar(req, res, next) {
  try {
    const { casoId, notaId } = req.params;
    const { contenido } = req.body;

    if (!contenido?.trim()) {
      return next({ status: 400, publicMessage: "El contenido es requerido" });
    }

    const nota = await prisma.casoNota.update({
      where: { id: Number(notaId) },
      data: {
        contenido: contenido.trim(),
        updatedBy: req.user?.id,
      },
    });
    res.json(nota);
  } catch (e) {
    next(e);
  }
}

export async function eliminar(req, res, next) {
  try {
    const { casoId, notaId } = req.params;

    await prisma.casoNota.update({
      where: { id: Number(notaId) },
      data: {
        deletedAt: new Date(),
        deletedBy: req.user?.id,
      },
    });
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

