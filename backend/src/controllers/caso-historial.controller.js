import prisma from "../utils/prisma.js";

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
    
    // Resolver IDs a nombres de parámetros
    const historialResuelto = await Promise.all(
      historial.map(async (item) => {
        // Si el campo es un ID de parámetro, resolver nombres
        if (['tipoId', 'estadoId', 'radicacionId', 'estadoRadicacionId'].includes(item.campo)) {
          let valorAnteriorNombre = item.valorAnterior;
          let valorNuevoNombre = item.valorNuevo;
          
          if (item.valorAnterior) {
            const paramAnterior = await prisma.parametro.findUnique({
              where: { id: parseInt(item.valorAnterior) },
              select: { nombre: true },
            });
            valorAnteriorNombre = paramAnterior?.nombre || item.valorAnterior;
          }
          
          if (item.valorNuevo) {
            const paramNuevo = await prisma.parametro.findUnique({
              where: { id: parseInt(item.valorNuevo) },
              select: { nombre: true },
            });
            valorNuevoNombre = paramNuevo?.nombre || item.valorNuevo;
          }
          
          return {
            ...item,
            valorAnterior: valorAnteriorNombre,
            valorNuevo: valorNuevoNombre,
          };
        }
        
        return item;
      })
    );
    
    res.json(historialResuelto);
  } catch (e) {
    next(e);
  }
}

