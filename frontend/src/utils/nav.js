// src/utils/nav.js

/**
 * Helpers de navegación centralizados para altas / ediciones / detalles,
 * preservando "volver a" y permitiendo prefills (clienteId, casoId, etc.).
 *
 * Uso típico:
 *   import { goToNuevo, goToEditar, goToDetalle, entityFromTab, newLabelFromTab } from "@/utils/nav";
 *
 *   // dentro de un componente con navigate y location:
 *   goToNuevo(navigate, location, "gasto", { clienteId: 123, casoId: 456 });
 *   goToEditar(navigate, location, "ingreso", 42);
 *   goToDetalle(navigate, location, "caso", 77);
 */

const routes = {
  cliente: {
    list: "/clientes",
    nuevo: "/clientes/nuevo",
    editar: (id) => `/clientes/editar/${id}`,
    detalle: (id) => `/clientes/${id}`,
  },
  caso: {
    list: "/casos",
    nuevo: "/casos/nuevo",
    editar: (id) => `/casos/editar/${id}`,
    detalle: (id) => `/casos/${id}`,
  },
  tarea: {
    list: "/tareas",
    nuevo: "/tareas/nuevo",
    editar: (id) => `/tareas/editar/${id}`,
    detalle: (id) => `/tareas/${id}`,
  },
  evento: {
    list: "/eventos",
    nuevo: "/eventos/nuevo",
    editar: (id) => `/eventos/editar/${id}`,
    detalle: (id) => `/eventos/${id}`,
  },
  honorario: {
    list: "/finanzas/honorarios",
    nuevo: "/finanzas/honorarios/nuevo",
    editar: (id) => `/finanzas/honorarios/editar/${id}`,
    detalle: (id) => `/finanzas/honorarios/${id}`,
  },
  gasto: {
    list: "/finanzas/gastos",
    nuevo: "/finanzas/gastos/nuevo",
    editar: (id) => `/finanzas/gastos/editar/${id}`,
    detalle: (id) => `/finanzas/gastos/${id}`,
  },
  ingreso: {
    list: "/finanzas/ingresos",
    nuevo: "/finanzas/ingresos/nuevo",
    editar: (id) => `/finanzas/ingresos/editar/${id}`,
    detalle: (id) => `/finanzas/ingresos/${id}`,
  },
};

/** Convierte { pathname, search, hash } en un objeto simple para guardar como "from" */
function snapshotLocation(loc) {
  if (!loc) return { pathname: "/" };
  return {
    pathname: loc.pathname,
    search: loc.search,
    hash: loc.hash,
    state: loc.state, // por si necesitás conservar algo
  };
}

/**
 * Navega a la pantalla de ALTA del módulo indicado.
 * @param {Function} navigate - hook navigate de react-router
 * @param {object} location - hook location de react-router (para backTo)
 * @param {"cliente"|"caso"|"tarea"|"evento"|"honorario"|"gasto"|"ingreso"} entity
 * @param {object} preset - datos para precargar en el form (ej. { clienteId, casoId })
 */
export function goToNuevo(navigate, location, entity, preset = {}) {
  const r = routes[entity];
  if (!r) return;
  navigate(r.nuevo, {
    state: {
      from: snapshotLocation(location),
      preset,
    },
  });
}

/**
 * Navega a la pantalla de EDICIÓN del registro indicado.
 * @param {Function} navigate
 * @param {object} location
 * @param {"cliente"|"caso"|"tarea"|"evento"|"honorario"|"gasto"|"ingreso"} entity
 * @param {number|string} id
 */
export function goToEditar(navigate, location, entity, id) {
  const r = routes[entity];
  if (!r) return;
  navigate(r.editar(id), {
    state: {
      from: snapshotLocation(location),
    },
  });
}

/**
 * Navega a la pantalla de DETALLE (si existe) del registro indicado.
 * @param {Function} navigate
 * @param {object} location
 * @param {"cliente"|"caso"|"tarea"|"evento"|"honorario"|"gasto"|"ingreso"} entity
 * @param {number|string} id
 */
export function goToDetalle(navigate, location, entity, id) {
  const r = routes[entity];
  if (!r) return;
  navigate(r.detalle(id), {
    state: {
      from: snapshotLocation(location),
    },
  });
}

/**
 * Deriva el "entity" a partir del índice de tab en ClienteDetalle.
 * 0 Casos, 1 Tareas, 2 Eventos, 3 Honorarios, 4 Gastos, 5 Ingresos
 */
export function entityFromTab(tabIndex) {
  switch (Number(tabIndex)) {
    case 0: return "caso";
    case 1: return "tarea";
    case 2: return "evento";
    case 3: return "honorario";
    case 4: return "gasto";
    case 5: return "ingreso";
    default: return null;
  }
}

/** Texto del botón "Nuevo ..." según la tab activa */
export function newLabelFromTab(tabIndex) {
  const map = {
    0: "Nuevo caso",
    1: "Nueva tarea",
    2: "Nuevo evento",
    3: "Nuevo honorario",
    4: "Nuevo gasto",
    5: "Nuevo ingreso",
  };
  return map[Number(tabIndex)] || "Nuevo";
}

/**
 * Devuelve la ruta de listado del módulo, útil si querés volver a listados fuera de ClienteDetalle.
 * @param {"cliente"|"caso"|"tarea"|"evento"|"honorario"|"gasto"|"ingreso"} entity
 */
export function listRoute(entity) {
  return routes[entity]?.list || "/";
}

/** Por si necesitás exponer el mapa de rutas completo */
export const NAV_ROUTES = routes;
