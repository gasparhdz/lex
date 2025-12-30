import api from "./axios";

// helper para no mandar null/undefined/"" en params
function cleanParams(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

/**
 * GET /api/agenda/eventos
 * Backend acepta:
 *  - from, to (ISO string)
 *  - clienteId, casoId, tipoId, estadoId (opcionales)
 * Devuelve: { data, page, pageSize, total } (en listar), pero acá retornamos solo el array.
 */
export async function listEventos({
  from,
  to,
  clienteId,
  casoId,
  tipoId,
  estadoId,
} = {}) {
  const params = cleanParams({ from, to, clienteId, casoId, tipoId, estadoId });
  const { data } = await api.get("/agenda/eventos", { params });
  // el controller devuelve { data: [...], page, pageSize, total }
  return Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
}

/**
 * GET /api/agenda/tareas
 * Backend (tarea.controller) acepta:
 *  - page, pageSize
 *  - search, completada, clienteId, casoId, prioridadId, asignadoA
 *  - dueFrom, dueTo (ISO)  ← ojo con los nombres
 *
 * En el front usamos "desde" y "hasta": los mapeamos a dueFrom/dueTo acá.
 * Devuelve: { data, page, pageSize, total }
 */
export async function listTareas({
  page = 1,
  pageSize = 50,
  search,
  completada,
  clienteId,
  casoId,
  prioridadId,
  asignadoA,
  desde,
  hasta,
} = {}) {
  const params = cleanParams({
    page,
    pageSize,
    search,
    completada,   // true/false
    clienteId,
    casoId,
    prioridadId,
    asignadoA,
  });

  // Mapear alias del front → backend
  if (desde) params.dueFrom = desde;
  if (hasta) params.dueTo = hasta;

  const { data } = await api.get("/agenda/tareas", { params });
  // el controller devuelve { data, page, pageSize, total }
  return data;
}
