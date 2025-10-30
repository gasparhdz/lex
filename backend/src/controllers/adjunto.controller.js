// src/controllers/adjunto.controller.js
import prisma from '../utils/prisma.js';
import {
  subirArchivo,
  listarArchivos,
  eliminarArchivo,
  obtenerArchivo,
} from '../utils/drive.js';

/**
 * POST /api/adjuntos/upload
 * Sube un archivo a Drive y lo indexa en BD
 */
export async function uploadAdjunto(req, res, next) {
  try {
    const { scope, scopeId } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
    }

    if (!scope || !scopeId) {
      return res.status(400).json({ error: 'scope y scopeId son requeridos' });
    }

    if (scope !== 'CLIENTE' && scope !== 'CASO') {
      return res.status(400).json({ error: 'scope debe ser CLIENTE o CASO' });
    }

    // Obtener usuario actual
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Validar tipos permitidos
    const tiposPermitidos = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
    ];

    if (!tiposPermitidos.includes(file.mimetype)) {
      return res.status(400).json({
        error: 'Tipo de archivo no permitido',
        permitidos: ['PDF', 'JPG', 'PNG', 'DOCX', 'XLSX', 'ZIP'],
      });
    }

    // Validar tamaño (50 MB)
    const maxSize = 50 * 1024 * 1024; // 50 MB
    if (file.size > maxSize) {
      return res.status(400).json({ error: 'El archivo excede el tamaño máximo de 50 MB' });
    }

    // Obtener folderId según el scope
    let folderId;

    if (scope === 'CLIENTE') {
      const cliente = await prisma.cliente.findUnique({
        where: { id: parseInt(scopeId) },
        select: { id: true, driveFolderId: true },
      });

      if (!cliente) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
      }

      if (!cliente.driveFolderId) {
        return res.status(400).json({
          error: 'El cliente no tiene una carpeta en Drive. Cree primero la carpeta del cliente.',
        });
      }

      folderId = cliente.driveFolderId;
    } else if (scope === 'CASO') {
      const caso = await prisma.caso.findUnique({
        where: { id: parseInt(scopeId) },
        select: { id: true, driveFolderId: true },
      });

      if (!caso) {
        return res.status(404).json({ error: 'Caso no encontrado' });
      }

      if (!caso.driveFolderId) {
        return res.status(400).json({
          error: 'El caso no tiene una carpeta en Drive. Cree primero la carpeta del caso.',
        });
      }

      folderId = caso.driveFolderId;
    }

    // Subir archivo a Drive
    const driveFile = await subirArchivo(
      file.buffer,
      file.originalname,
      file.mimetype,
      folderId
    );

    // Guardar en BD
    const adjunto = await prisma.adjunto.create({
      data: {
        scope,
        scopeId: parseInt(scopeId),
        nombre: file.originalname,
        mime: file.mimetype,
        sizeBytes: file.size,
        driveFileId: driveFile.id,
        driveFolderId: folderId,
        driveWebView: driveFile.webViewLink,
        driveWebContent: driveFile.webContentLink,
        subidoPorId: userId,
      },
      include: {
        subidoPor: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
    });

    res.json({
      success: true,
      adjunto,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/adjuntos
 * Lista adjuntos filtrados por scope y scopeId
 */
export async function listarAdjuntos(req, res, next) {
  try {
    const { scope, scopeId } = req.query;

    if (!scope || !scopeId) {
      return res.status(400).json({ error: 'scope y scopeId son requeridos' });
    }

    const adjuntos = await prisma.adjunto.findMany({
      where: {
        scope,
        scopeId: parseInt(scopeId),
        eliminadoEn: null,
      },
      include: {
        subidoPor: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
      orderBy: { creadoEn: 'desc' },
    });

    res.json(adjuntos);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/adjuntos/indexar
 * Sincroniza archivos existentes en Drive con la BD
 */
export async function indexarAdjuntos(req, res, next) {
  try {
    const { scope, scopeId } = req.query;

    if (!scope || !scopeId) {
      return res.status(400).json({ error: 'scope y scopeId son requeridos' });
    }

    // Obtener folderId según el scope
    let folderId;

    if (scope === 'CLIENTE') {
      const cliente = await prisma.cliente.findUnique({
        where: { id: parseInt(scopeId) },
        select: { id: true, driveFolderId: true },
      });

      if (!cliente || !cliente.driveFolderId) {
        return res.status(404).json({ error: 'Cliente no encontrado o sin carpeta' });
      }

      folderId = cliente.driveFolderId;
    } else if (scope === 'CASO') {
      const caso = await prisma.caso.findUnique({
        where: { id: parseInt(scopeId) },
        select: { id: true, driveFolderId: true },
      });

      if (!caso || !caso.driveFolderId) {
        return res.status(404).json({ error: 'Caso no encontrado o sin carpeta' });
      }

      folderId = caso.driveFolderId;
    }

    // Listar archivos en Drive
    const archivos = await listarArchivos(folderId);

    // Filtrar solo archivos (no carpetas)
    const archivosDrive = archivos.filter(
      archivo => archivo.mimeType !== 'application/vnd.google-apps.folder'
    );

    // Obtener IDs de archivos en Drive
    const archivosDriveIds = archivosDrive.map(a => a.id);

    // Obtener usuario actual
    const userId = req.user?.id;

    // Procesar cada archivo
    const adjuntosCreados = [];
    for (const archivo of archivosDrive) {
      // Verificar si ya existe en BD
      const existe = await prisma.adjunto.findUnique({
        where: { driveFileId: archivo.id },
      });

      if (!existe) {
        // Crear en BD
        const adjunto = await prisma.adjunto.create({
          data: {
            scope,
            scopeId: parseInt(scopeId),
            nombre: archivo.name,
            mime: archivo.mimeType,
            sizeBytes: archivo.size ? parseInt(archivo.size) : null,
            driveFileId: archivo.id,
            driveFolderId: folderId,
            driveWebView: archivo.webViewLink,
            driveWebContent: archivo.webContentLink,
            subidoPorId: userId || null,
          },
        });

        adjuntosCreados.push(adjunto);
      }
    }

    // Eliminar adjuntos que ya no existen en Drive (soft delete)
    const adjuntosParaEliminar = await prisma.adjunto.findMany({
      where: {
        scope,
        scopeId: parseInt(scopeId),
        eliminadoEn: null,
        driveFileId: {
          notIn: archivosDriveIds,
        },
      },
    });

    let adjuntosEliminados = 0;
    for (const adjunto of adjuntosParaEliminar) {
      await prisma.adjunto.update({
        where: { id: adjunto.id },
        data: { eliminadoEn: new Date() },
      });
      adjuntosEliminados++;
    }

    // Retornar lista completa actualizada
    const adjuntos = await prisma.adjunto.findMany({
      where: {
        scope,
        scopeId: parseInt(scopeId),
        eliminadoEn: null,
      },
      include: {
        subidoPor: {
          select: { id: true, nombre: true, apellido: true },
        },
      },
      orderBy: { creadoEn: 'desc' },
    });

    res.json({
      success: true,
      adjuntosCreados: adjuntosCreados.length,
      adjuntosEliminados,
      total: adjuntos.length,
      adjuntos,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/adjuntos/:id
 * Elimina un adjunto (baja lógica + mover a papelera en Drive)
 */
export async function eliminarAdjunto(req, res, next) {
  try {
    const { id } = req.params;

    // Obtener adjunto
    const adjunto = await prisma.adjunto.findUnique({
      where: { id: parseInt(id) },
    });

    if (!adjunto) {
      return res.status(404).json({ error: 'Adjunto no encontrado' });
    }

    // Mover a papelera en Drive
    try {
      await eliminarArchivo(adjunto.driveFileId);
    } catch (error) {
      console.warn('Error al eliminar archivo en Drive:', error.message);
      // Continuar aunque falle Drive
    }

    // Marcar como eliminado en BD
    await prisma.adjunto.update({
      where: { id: adjunto.id },
      data: { eliminadoEn: new Date() },
    });

    res.json({
      success: true,
      message: 'Adjunto eliminado correctamente',
    });
  } catch (error) {
    next(error);
  }
}

