import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import prisma from '../utils/prisma.js';

export async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return next({ status: 400, publicMessage: 'Email y contraseña requeridos' });

    const user = await prisma.usuario.findUnique({
      where: { email },
      include: {
        roles: { include: { rol: { include: { permisos: true } } } }
      }
    });
    if (!user || !user.activo) return next({ status: 401, publicMessage: 'Credenciales inválidas' });

    const ok = await argon2.verify(user.password, password);
    if (!ok) return next({ status: 401, publicMessage: 'Credenciales inválidas' });

    // armar permisos planos
    const roles = user.roles.map(r => r.rol.codigo);
    const permisos = user.roles.flatMap(r => r.rol.permisos)
      .reduce((acc, p) => {
        const i = acc.find(x => x.modulo === p.modulo);
        if (!i) acc.push({ modulo: p.modulo, ver: p.ver, crear: p.crear, editar: p.editar, eliminar: p.eliminar });
        else {
          i.ver = i.ver || p.ver; i.crear = i.crear || p.crear; i.editar = i.editar || p.editar; i.eliminar = i.eliminar || p.eliminar;
        }
        return acc;
      }, []);

    const payload = { id: user.id, email: user.email, roles, permisos };
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '3h' });

    res.json({
      accessToken,
      user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, roles, permisos }
    });
  } catch (e) { next(e); }
}

export async function me(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return next({ status: 401, publicMessage: 'No autenticado' });

    const user = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { rol: { include: { permisos: true } } } }
      }
    });

    if (!user || !user.activo) return next({ status: 401, publicMessage: 'Usuario inactivo o no encontrado' });

    // Armar permisos planos (igual que en login)
    const roles = user.roles.map(r => r.rol.codigo);
    const permisos = user.roles.flatMap(r => r.rol.permisos)
      .reduce((acc, p) => {
        const i = acc.find(x => x.modulo === p.modulo);
        if (!i) acc.push({ modulo: p.modulo, ver: p.ver, crear: p.crear, editar: p.editar, eliminar: p.eliminar });
        else {
          i.ver = i.ver || p.ver; i.crear = i.crear || p.crear; i.editar = i.editar || p.editar; i.eliminar = i.eliminar || p.eliminar;
        }
        return acc;
      }, []);

    res.json({
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      roles,
      permisos
    });
  } catch (e) { next(e); }
}