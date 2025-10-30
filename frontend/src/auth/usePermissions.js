// src/auth/usePermissions.js
import { useAuth } from './AuthContext';

/**
 * Hook para verificar permisos del usuario actual
 * 
 * @example
 * const canEdit = usePermiso('CLIENTES', 'editar');
 * const canView = usePermiso('CASOS', 'ver');
 */
export const usePermiso = (modulo, accion = 'ver') => {
  const { user } = useAuth();

  if (!user?.permisos) return false;

  const permiso = user.permisos.find(p => p.modulo === modulo);
  if (!permiso) return false;

  return permiso[accion] === true;
};

/**
 * Hook para verificar si el usuario tiene al menos uno de los roles especificados
 * 
 * @example
 * const isAdmin = useHasRol('ADMIN');
 */
export const useHasRol = (rolCodigo) => {
  const { user } = useAuth();

  if (!user?.roles) return false;
  
  if (Array.isArray(rolCodigo)) {
    return user.roles.some(rol => rolCodigo.includes(rol));
  }
  
  return user.roles.includes(rolCodigo);
};

/**
 * Hook para verificar múltiples permisos
 * 
 * @example
 * const { canView, canEdit, canDelete } = usePermisos('CLIENTES');
 */
export const usePermisos = (modulo) => {
  const { user } = useAuth();

  if (!user?.permisos) {
    return { canView: false, canCrear: false, canEditar: false, canEliminar: false };
  }

  const permiso = user.permisos.find(p => p.modulo === modulo);
  if (!permiso) {
    return { canView: false, canCrear: false, canEditar: false, canEliminar: false };
  }

  return {
    canView: permiso.ver === true,
    canCrear: permiso.crear === true,
    canEditar: permiso.editar === true,
    canEliminar: permiso.eliminar === true,
  };
};
