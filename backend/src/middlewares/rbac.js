export const requirePermiso = (modulo, accion) => (req, _res, next) => {
  try {
    const permisos = req.user?.permisos || [];
    const tiene = permisos.some(p => p.modulo === modulo && p[accion] === true);
    if (!tiene) {
      return next({ status: 403, name: 'Forbidden', publicMessage: 'Sin permiso' });
    }
    next();
  } catch (e) {
    next({ status: 500, publicMessage: 'Error verificando permisos', details: e?.message });
  }
};
