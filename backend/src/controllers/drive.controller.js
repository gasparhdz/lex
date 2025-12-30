// src/controllers/drive.controller.js
import prisma from '../utils/prisma.js';
import {
  crearCarpeta,
  buscarCarpetaPorNombre,
} from '../utils/drive.js';

/**
 * POST /api/drive/clientes/:id/create
 * Crea carpeta del cliente en Drive
 */
export async function crearCarpetaCliente(req, res, next) {
  try {
    const { id } = req.params;

    // Obtener cliente
    const cliente = await prisma.cliente.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, nombre: true, apellido: true, razonSocial: true, driveFolderId: true },
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Si ya tiene carpeta, retornar error
    if (cliente.driveFolderId) {
      return res.status(400).json({
        error: 'El cliente ya tiene una carpeta en Drive',
        driveFolderId: cliente.driveFolderId,
      });
    }

    // Nombre de la carpeta: "Apellido, Nombre" o "Razón Social"
    let nombreCarpeta;
    if (cliente.razonSocial) {
      nombreCarpeta = cliente.razonSocial;
    } else {
      const apellido = cliente.apellido || 'Sin apellido';
      const nombre = cliente.nombre || '';
      nombreCarpeta = `${apellido}, ${nombre}`.trim();
    }

    // Verificar si ya existe la carpeta
    const rootFolderId = process.env.DRIVE_ROOT_FOLDER_ID;
    if (!rootFolderId) {
      return res.status(500).json({ error: 'DRIVE_ROOT_FOLDER_ID no configurado' });
    }

    let carpetaExistente = await buscarCarpetaPorNombre(nombreCarpeta, rootFolderId);

    // Si existe, agregar sufijo (2), (3), etc.
    if (carpetaExistente) {
      let contador = 2;
      let nombreAlternativo = `${nombreCarpeta} (${contador})`;
      carpetaExistente = await buscarCarpetaPorNombre(nombreAlternativo, rootFolderId);

      while (carpetaExistente) {
        contador++;
        nombreAlternativo = `${nombreCarpeta} (${contador})`;
        carpetaExistente = await buscarCarpetaPorNombre(nombreAlternativo, rootFolderId);
      }

      nombreCarpeta = nombreAlternativo;
    }

    // Crear carpeta en Drive
    const carpeta = await crearCarpeta(nombreCarpeta, rootFolderId);

    // Guardar ID en BD
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { driveFolderId: carpeta.id },
    });

    res.json({
      success: true,
      carpeta: {
        id: carpeta.id,
        nombre: carpeta.name,
        driveFolderId: carpeta.id,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/drive/casos/:id/create
 * Crea carpeta del caso en Drive (dentro de la carpeta del cliente)
 */
export async function crearCarpetaCaso(req, res, next) {
  try {
    const { id } = req.params;

    // Obtener caso con cliente y tipo
    const caso = await prisma.caso.findUnique({
      where: { id: parseInt(id) },
      include: {
        cliente: {
          select: { id: true, nombre: true, apellido: true, razonSocial: true, driveFolderId: true },
        },
        tipo: {
          select: { id: true, nombre: true },
        },
      },
    });

    if (!caso) {
      return res.status(404).json({ error: 'Caso no encontrado' });
    }

    // Verificar que el cliente tenga carpeta
    if (!caso.cliente.driveFolderId) {
      return res.status(400).json({
        error: 'El cliente no tiene una carpeta en Drive. Cree primero la carpeta del cliente.',
      });
    }

    // Si ya tiene carpeta, retornar error
    if (caso.driveFolderId) {
      return res.status(400).json({
        error: 'El caso ya tiene una carpeta en Drive',
        driveFolderId: caso.driveFolderId,
      });
    }

    // Obtener número correlativo
    // Listar todas las carpetas del cliente para encontrar el máximo número
    const { listarArchivos } = await import('../utils/drive.js');
    const carpetas = await listarArchivos(caso.cliente.driveFolderId);

    // Filtrar solo carpetas y extraer números
    const numeros = carpetas
      .filter(f => f.mimeType === 'application/vnd.google-apps.folder')
      .map(f => {
        const match = f.name.match(/^(\d+)\s*-\s*/);
        return match ? parseInt(match[1]) : 0;
      });

    const numeroMaximo = numeros.length > 0 ? Math.max(...numeros) : 0;
    const numeroSiguiente = numeroMaximo + 1;
    const numeroFormateado = String(numeroSiguiente).padStart(2, '0');

    // Nombre de la carpeta: "NN - Carátula" o descripción o tipo
    let nombreCarpeta;
    if (caso.caratula && caso.caratula.trim()) {
      nombreCarpeta = caso.caratula.trim();
    } else if (caso.descripcion && caso.descripcion.trim()) {
      nombreCarpeta = caso.descripcion.trim();
    } else {
      nombreCarpeta = caso.tipo?.nombre || 'Caso';
    }
    const nombreCarpetaCompleto = `${numeroFormateado} - ${nombreCarpeta}`;

    // Crear carpeta en Drive
    const carpeta = await crearCarpeta(nombreCarpetaCompleto, caso.cliente.driveFolderId);

    // Guardar ID y número en BD
    await prisma.caso.update({
      where: { id: caso.id },
      data: {
        driveFolderId: carpeta.id,
        numeroDrive: numeroSiguiente,
      },
    });

    res.json({
      success: true,
      carpeta: {
        id: carpeta.id,
        nombre: carpeta.name,
        driveFolderId: carpeta.id,
        numeroDrive: numeroSiguiente,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/drive/clientes/:id/vincular
 * Vincula una carpeta existente a un cliente
 */
export async function vincularCarpetaCliente(req, res, next) {
  try {
    const { id } = req.params;
    const { driveFolderId } = req.body;

    if (!driveFolderId) {
      return res.status(400).json({ error: 'driveFolderId es requerido' });
    }

    // Verificar que el cliente existe
    const cliente = await prisma.cliente.findUnique({
      where: { id: parseInt(id) },
    });

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Actualizar cliente con el driveFolderId
    await prisma.cliente.update({
      where: { id: cliente.id },
      data: { driveFolderId },
    });

    res.json({
      success: true,
      message: 'Carpeta vinculada correctamente',
      driveFolderId,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/drive/casos/:id/vincular
 * Vincula una carpeta existente a un caso
 */
export async function vincularCarpetaCaso(req, res, next) {
  try {
    const { id } = req.params;
    const { driveFolderId, numeroDrive } = req.body;

    if (!driveFolderId) {
      return res.status(400).json({ error: 'driveFolderId es requerido' });
    }

    // Verificar que el caso existe
    const caso = await prisma.caso.findUnique({
      where: { id: parseInt(id) },
    });

    if (!caso) {
      return res.status(404).json({ error: 'Caso no encontrado' });
    }

    // Actualizar caso con el driveFolderId y número
    await prisma.caso.update({
      where: { id: caso.id },
      data: {
        driveFolderId,
        numeroDrive: numeroDrive || null,
      },
    });

    res.json({
      success: true,
      message: 'Carpeta vinculada correctamente',
      driveFolderId,
      numeroDrive: numeroDrive || null,
    });
  } catch (error) {
    next(error);
  }
}

