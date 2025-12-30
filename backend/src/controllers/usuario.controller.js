import argon2 from 'argon2';
import prisma from '../utils/prisma.js';

// Mapear datos del request
function mapUsuarioDTO(body) {
  return {
    nombre: body.nombre?.trim(),
    apellido: body.apellido?.trim(),
    dni: body.dni?.trim() || null,
    email: body.email?.trim().toLowerCase(),
    password: body.password?.trim(),
    telefono: body.telefono?.trim() || null,
    activo: body.activo !== undefined ? body.activo : true,
    mustChangePass: body.mustChangePass !== undefined ? body.mustChangePass : false,
    roles: body.roles || [],
  };
}

/**
 * GET /api/usuarios
 */
export async function listar(req, res, next) {
  try {
    const { search, activo } = req.query;
    const where = { deletedAt: null };

    if (activo !== undefined) where.activo = activo === 'true';
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { apellido: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const usuarios = await prisma.usuario.findMany({
      where,
      include: {
        roles: { include: { rol: true } },
      },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    });

    res.json(usuarios);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/usuarios/:id
 */
export async function obtener(req, res, next) {
  try {
    const { id } = req.params;

    const usuario = await prisma.usuario.findFirst({
      where: { id: parseInt(id), deletedAt: null },
      include: {
        roles: { include: { rol: true } },
      },
    });

    if (!usuario) return next({ status: 404, publicMessage: 'Usuario no encontrado' });

    res.json(usuario);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/usuarios
 */
export async function crear(req, res, next) {
  try {
    const dto = mapUsuarioDTO(req.body);

    if (!dto.nombre || !dto.apellido || !dto.email || !dto.password) {
      return next({ status: 400, publicMessage: 'Nombre, apellido, email y contraseña son requeridos' });
    }

    // Hash de contraseña
    const passwordHash = await argon2.hash(dto.password);
    delete dto.password;

    // Separar roles del resto de datos
    const roles = dto.roles || [];
    delete dto.roles;

    // Crear usuario
    const nuevo = await prisma.usuario.create({
      data: {
        ...dto,
        password: passwordHash,
        createdBy: req.user?.id,
      },
    });

    // Asignar roles si los hay
    if (roles.length > 0) {
      await prisma.usuarioRol.createMany({
        data: roles.map(rolId => ({
          usuarioId: nuevo.id,
          rolId: parseInt(rolId),
        })),
      });
    }

    // Devolver con roles
    const usuarioCompleto = await prisma.usuario.findUnique({
      where: { id: nuevo.id },
      include: {
        roles: { include: { rol: true } },
      },
    });

    res.status(201).json(usuarioCompleto);
  } catch (e) {
    if (e.code === 'P2002') {
      return next({ status: 409, publicMessage: 'Ya existe un usuario con ese email o DNI' });
    }
    next(e);
  }
}

/**
 * PUT /api/usuarios/:id
 */
export async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const dto = mapUsuarioDTO(req.body);

    const existente = await prisma.usuario.findFirst({
      where: { id: parseInt(id), deletedAt: null },
    });

    if (!existente) return next({ status: 404, publicMessage: 'Usuario no encontrado' });

    const data = {
      nombre: dto.nombre,
      apellido: dto.apellido,
      dni: dto.dni,
      email: dto.email,
      telefono: dto.telefono,
      activo: dto.activo,
      mustChangePass: dto.mustChangePass,
      updatedBy: req.user?.id,
    };

    // Si se está cambiando la contraseña
    if (dto.password) {
      data.password = await argon2.hash(dto.password);
    }

    await prisma.usuario.update({
      where: { id: parseInt(id) },
      data,
    });

    // Actualizar roles
    if (dto.roles !== undefined) {
      // Eliminar roles actuales
      await prisma.usuarioRol.deleteMany({
        where: { usuarioId: parseInt(id) },
      });

      // Agregar nuevos roles
      if (dto.roles.length > 0) {
        await prisma.usuarioRol.createMany({
          data: dto.roles.map(rolId => ({
            usuarioId: parseInt(id),
            rolId: parseInt(rolId),
          })),
        });
      }
    }

    // Devolver usuario actualizado
    const actualizado = await prisma.usuario.findUnique({
      where: { id: parseInt(id) },
      include: {
        roles: { include: { rol: true } },
      },
    });

    res.json(actualizado);
  } catch (e) {
    if (e.code === 'P2002') {
      return next({ status: 409, publicMessage: 'Ya existe un usuario con ese email o DNI' });
    }
    next(e);
  }
}

/**
 * DELETE /api/usuarios/:id
 */
export async function borrar(req, res, next) {
  try {
    const { id } = req.params;
    const userId = parseInt(id);

    const existente = await prisma.usuario.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!existente) return next({ status: 404, publicMessage: 'Usuario no encontrado' });

    // Soft delete
    await prisma.usuario.update({
      where: { id: userId },
      data: {
        activo: false,
        deletedAt: new Date(),
        deletedBy: req.user?.id,
      },
    });

    res.status(204).send();
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/usuarios/roles
 */
export async function listarRoles(req, res, next) {
  try {
    const roles = await prisma.rol.findMany({
      where: { activo: true },
      include: {
        _count: {
          select: { usuarios: true },
        },
      },
      orderBy: { nombre: 'asc' },
    });

    res.json(roles);
  } catch (e) {
    next(e);
  }
}
