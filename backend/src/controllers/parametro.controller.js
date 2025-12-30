import prisma from "../utils/prisma.js";

/**
 * GET /api/parametros
 * Soporta:
 *  - categoria=TIPO_CASO  (o cualquier código de categoría)
 *  - categoriaId=2
 *  - parentId=123 | parentId=null (raíces)
 *  - activo=true/false   (true por defecto; si false -> no filtra por activo)
 *  - search=texto        (busca en nombre/codigo)
 *
 * Ej:
 *  /api/parametros?categoria=TIPO_CASO&activo=true&parentId=5
 *  /api/parametros?categoria=RAMA_DERECHO
 *  /api/parametros?categoriaId=2&parentId=null
 */
export async function listarParametros(req, res, next) {
  try {
    const categoria   = String(req.query.categoria || "").trim();
    const categoriaId = req.query.categoriaId != null ? String(req.query.categoriaId) : undefined;
    const parentIdRaw = req.query.parentId;
    const search      = String(req.query.search || "").trim();

    // Si es una categoría virtual, manejarla por separado
    if (categoriaId && String(categoriaId).startsWith('VIRTUAL_')) {
      return await listarParametrosVirtuales(categoriaId, search, res, next);
    }

    // activo=true por defecto (si querés todo, mandá activo=false)
    const soloActivos = String(req.query.activo ?? "true").toLowerCase() !== "false";

    const where = {};

    // Activo
    if (soloActivos) where.activo = true;

    // Categoría por id o por código
    const numCatId = Number(categoriaId);
    if (Number.isFinite(numCatId)) {
      where.categoriaId = numCatId;
    } else if (categoria) {
      // forzamos mayúscula por si llegan minúsculas
      where.categoria = { codigo: categoria.toUpperCase(), activo: true };
    }

    // parentId: soporta null explícito (raíces) y numérico
    if (parentIdRaw !== undefined) {
      const val = String(parentIdRaw).trim().toLowerCase();
      if (val === "" || val === "null") {
        where.parentId = null;
      } else {
        const n = Number(parentIdRaw);
        if (Number.isFinite(n)) where.parentId = n;
      }
    }

    // Búsqueda por nombre/código
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: "insensitive" } },
        { codigo: { contains: search, mode: "insensitive" } },
      ];
    }

    const items = await prisma.parametro.findMany({
      where,
      orderBy: [
        { orden: "asc" },   // usa tu campo 'orden' primero
        { nombre: "asc" },
        { codigo: "asc" },
      ],
      // devolvemos algunos campos útiles (no rompe si el front solo usa id/nombre)
      select: {
        id: true,
        codigo: true,
        nombre: true,
        activo: true,
        parentId: true,
        categoriaId: true,
        orden: true,
        extra: true,
      },
    });

    res.json(items); // el front ya soporta array o { data: [] }
  } catch (e) {
    next(e);
  }
}

// Helper para categorías virtuales (tablas)
async function listarParametrosVirtuales(virtualId, search, res, next) {
  try {
    const where = {};
    
    // Búsqueda por nombre
    if (search) {
      where.nombre = { contains: search, mode: "insensitive" };
    }

    let items = [];

    switch (virtualId) {
      case 'VIRTUAL_PAIS':
        items = await prisma.pais.findMany({ where, orderBy: { nombre: 'asc' } });
        items = items.map(p => ({ id: p.id, codigo: p.codigoIso || '', nombre: p.nombre, activo: true, orden: 0 }));
        break;

      case 'VIRTUAL_PROVINCIA':
        items = await prisma.provincia.findMany({ 
          where, 
          orderBy: { nombre: 'asc' },
          include: { pais: true }
        });
        items = items.map(p => ({ 
          id: p.id, 
          codigo: '', 
          nombre: p.nombre, 
          activo: true, 
          orden: 0,
          extra: { pais: p.pais.nombre }
        }));
        break;

      case 'VIRTUAL_LOCALIDAD':
        items = await prisma.localidad.findMany({ 
          where, 
          orderBy: { nombre: 'asc' },
          include: { provincia: { include: { pais: true } } }
        });
        items = items.map(l => ({ 
          id: l.id, 
          codigo: '', 
          nombre: l.nombre, 
          activo: true, 
          orden: 0,
          extra: { provincia: l.provincia.nombre, pais: l.provincia.pais.nombre }
        }));
        break;

      case 'VIRTUAL_CODIGO_POSTAL':
        items = await prisma.codigoPostal.findMany({ 
          where: search ? { codigo: { contains: search } } : {},
          orderBy: { codigo: 'asc' },
          include: { localidad: { include: { provincia: { include: { pais: true } } } } }
        });
        items = items.map(cp => ({ 
          id: cp.id, 
          codigo: cp.codigo, 
          nombre: cp.codigo, 
          activo: true, 
          orden: 0,
          extra: { 
            localidad: cp.localidad.nombre, 
            provincia: cp.localidad.provincia.nombre, 
            pais: cp.localidad.provincia.pais.nombre 
          }
        }));
        break;

      case 'VIRTUAL_VALOR_JUS':
        const valorJus = await prisma.valorJUS.findMany({ 
          where: { ...where, activo: true, deletedAt: null },
          orderBy: { fecha: 'desc' }
        });
        items = valorJus.map(v => ({ 
          id: v.id, 
          codigo: '', 
          nombre: `${Number(v.valor)}`, 
          activo: v.activo, 
          orden: 0,
          extra: { valor: Number(v.valor), fecha: v.fecha.toISOString() }
        }));
        break;

      default:
        return res.json([]);
    }

    res.json(items);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/parametros/tipo-persona  (azúcar sintáctica)
 */
export function listarTipoPersona(req, res, next) {
  req.query.categoria = "TIPO_PERSONA";
  return listarParametros(req, res, next);
}

/**
 * GET /api/parametros/categorias
 * Devuelve categorías reales + categorías virtuales (tablas de parámetros)
 */
export async function listarCategorias(req, res, next) {
  try {
    const categoriasReales = await prisma.categoria.findMany({
      include: {
        _count: {
          select: { parametros: true }
        }
      },
      orderBy: { codigo: 'asc' }
    });

    // Categorías virtuales: tablas que actúan como parámetros
    const categoriasVirtuales = [
      { id: 'VIRTUAL_PAIS', codigo: 'PAIS', nombre: 'País', virtual: true },
      { id: 'VIRTUAL_PROVINCIA', codigo: 'PROVINCIA', nombre: 'Provincia', virtual: true },
      { id: 'VIRTUAL_LOCALIDAD', codigo: 'LOCALIDAD', nombre: 'Localidad', virtual: true },
      { id: 'VIRTUAL_CODIGO_POSTAL', codigo: 'CODIGO_POSTAL', nombre: 'Código Postal', virtual: true },
      { id: 'VIRTUAL_VALOR_JUS', codigo: 'VALOR_JUS', nombre: 'Valor JUS', virtual: true },
    ];

    const todasCategorias = [...categoriasReales, ...categoriasVirtuales];
    
    // Ordenar alfabéticamente por nombre
    todasCategorias.sort((a, b) => a.nombre.localeCompare(b.nombre));
    
    res.json(todasCategorias);
  } catch (e) {
    next(e);
  }
}

/**
 * GET /api/parametros/:id
 */
export async function obtenerParametro(req, res, next) {
  try {
    const { id } = req.params;
    const parametro = await prisma.parametro.findUnique({
      where: { id: parseInt(id) },
      include: { categoria: true, parent: true }
    });
    
    if (!parametro) return next({ status: 404, publicMessage: 'Parámetro no encontrado' });
    
    res.json(parametro);
  } catch (e) {
    next(e);
  }
}

/**
 * POST /api/parametros
 */
export async function crearParametro(req, res, next) {
  try {
    const { categoriaId, codigo, nombre, orden = 0, activo = true, parentId, extra } = req.body;

    // Validar que la categoría existe
    const categoria = await prisma.categoria.findUnique({ where: { id: Number(categoriaId) } });
    if (!categoria) return next({ status: 404, publicMessage: 'Categoría no encontrada' });

    const nuevo = await prisma.parametro.create({
      data: {
        categoriaId: Number(categoriaId),
        codigo: codigo.toUpperCase(),
        nombre,
        orden: parseInt(orden),
        activo,
        parentId: parentId ? Number(parentId) : null,
        extra: extra || null,
      },
      include: { categoria: true }
    });

    res.status(201).json(nuevo);
  } catch (e) {
    if (e.code === 'P2002') {
      return next({ status: 409, publicMessage: 'Ya existe un parámetro con ese código en esta categoría' });
    }
    next(e);
  }
}

/**
 * PUT /api/parametros/:id
 */
export async function actualizarParametro(req, res, next) {
  try {
    const { id } = req.params;
    const { codigo, nombre, orden, activo, parentId, extra } = req.body;

    const existente = await prisma.parametro.findUnique({ where: { id: parseInt(id) } });
    if (!existente) return next({ status: 404, publicMessage: 'Parámetro no encontrado' });

    const actualizado = await prisma.parametro.update({
      where: { id: parseInt(id) },
      data: {
        codigo: codigo?.toUpperCase(),
        nombre,
        orden: orden !== undefined ? parseInt(orden) : undefined,
        activo,
        parentId,
        extra,
      },
      include: { categoria: true }
    });

    res.json(actualizado);
  } catch (e) {
    if (e.code === 'P2002') {
      return next({ status: 409, publicMessage: 'Ya existe un parámetro con ese código en esta categoría' });
    }
    next(e);
  }
}

/**
 * DELETE /api/parametros/:id
 */
export async function eliminarParametro(req, res, next) {
  try {
    const { id } = req.params;
    
    const existente = await prisma.parametro.findUnique({ where: { id: parseInt(id) } });
    if (!existente) return next({ status: 404, publicMessage: 'Parámetro no encontrado' });

    // Verificar que no tiene hijos
    const hijos = await prisma.parametro.count({ where: { parentId: parseInt(id) } });
    if (hijos > 0) {
      return next({ status: 400, publicMessage: 'No se puede eliminar un parámetro que tiene sub-parámetros' });
    }

    await prisma.parametro.delete({ where: { id: parseInt(id) } });
    
    res.status(204).send();
  } catch (e) {
    next(e);
  }
}