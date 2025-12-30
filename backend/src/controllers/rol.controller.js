import prisma from '../utils/prisma.js';

/**
 * GET /api/roles
 */
export async function listar(req, res, next) {
  try {
    const roles = await prisma.rol.findMany({
      include: {
        _count: {
          select: { usuarios: true, permisos: true }
        }
      },
      orderBy: { nombre: 'asc' }
    });

    res.json(roles);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/roles/:id
 */
export async function obtener(req, res, next) {
  try {
    const { id } = req.params;
    
    const rol = await prisma.rol.findUnique({
      where: { id: parseInt(id) },
      include: {
        permisos: true,
        _count: { select: { usuarios: true } }
      }
    });

    if (!rol) return next({ status: 404, publicMessage: 'Rol no encontrado' });

    res.json(rol);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/roles
 */
export async function crear(req, res, next) {
  try {
    const { codigo, nombre, activo = true, permisos } = req.body;

    if (!codigo || !nombre) {
      return next({ status: 400, publicMessage: 'Código y nombre son requeridos' });
    }

    const nuevo = await prisma.rol.create({
      data: {
        codigo: codigo.toUpperCase(),
        nombre,
        activo
      }
    });

    // Crear permisos si se proporcionan
    if (permisos && Array.isArray(permisos) && permisos.length > 0) {
      try {
        await prisma.permiso.createMany({
          data: permisos.map(p => ({
            rolId: nuevo.id,
            modulo: p.modulo,
            ver: p.ver || false,
            crear: p.crear || false,
            editar: p.editar || false,
            eliminar: p.eliminar || false,
          }))
        });
      } catch (permError) {
        // Si falla la creación de permisos, log pero continúa
        console.error('Error creando permisos:', permError);
      }
    }

    const rolCompleto = await prisma.rol.findUnique({
      where: { id: nuevo.id },
      include: {
        permisos: true,
        _count: { select: { usuarios: true } }
      }
    });

    res.status(201).json(rolCompleto);
  } catch (e) {
    if (e.code === 'P2002') {
      const uniqueField = e.meta?.target?.[0] || 'campo';
      return next({ status: 409, publicMessage: `Ya existe un rol con ese ${uniqueField}` });
    }
    next(e);
  }
}

/**
 * PUT /api/roles/:id
 */
export async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const { nombre, activo, permisos } = req.body;

    const existente = await prisma.rol.findUnique({ where: { id: parseInt(id) } });
    if (!existente) return next({ status: 404, publicMessage: 'Rol no encontrado' });

    // Actualizar nombre y activo si se proporcionan
    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (activo !== undefined) updateData.activo = activo;

    if (Object.keys(updateData).length > 0) {
      await prisma.rol.update({
        where: { id: parseInt(id) },
        data: updateData
      });
    }

    // Actualizar permisos si se proporcionan
    if (permisos !== undefined && Array.isArray(permisos)) {
      // Eliminar permisos existentes
      await prisma.permiso.deleteMany({ where: { rolId: parseInt(id) } });

      // Crear nuevos permisos
      if (permisos.length > 0) {
        await prisma.permiso.createMany({
          data: permisos.map(p => ({
            rolId: parseInt(id),
            modulo: p.modulo,
            ver: p.ver || false,
            crear: p.crear || false,
            editar: p.editar || false,
            eliminar: p.eliminar || false,
          }))
        });
      }
    }

    const rolActualizado = await prisma.rol.findUnique({
      where: { id: parseInt(id) },
      include: {
        permisos: true,
        _count: { select: { usuarios: true } }
      }
    });

    res.json(rolActualizado);
  } catch (e) {
    next(e);
  }
}

/**
 * DELETE /api/roles/:id
 */
export async function eliminar(req, res, next) {
  try {
    const { id } = req.params;

    const existente = await prisma.rol.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: { select: { usuarios: true } }
      }
      });

    if (!existente) return next({ status: 404, publicMessage: 'Rol no encontrado' });

    // Verificar que no tiene usuarios asignados
    if (existente._count.usuarios > 0) {
      return next({ status: 400, publicMessage: 'No se puede eliminar un rol con usuarios asignados' });
    }

    // Eliminar permisos del rol
    await prisma.permiso.deleteMany({ where: { rolId: parseInt(id) } });

    // Eliminar el rol
    await prisma.rol.delete({ where: { id: parseInt(id) } });

    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

