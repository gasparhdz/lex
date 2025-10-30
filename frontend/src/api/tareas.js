// src/api/tareas.js
import api from "./axios";

/**
 * GET /tareas/:id
 */
export async function getTarea(id) {
  const { data } = await api.get(`/tareas/${id}`);
  return data;
}

/**
 * POST /tareas
 * payload esperado:
 * {
 *   titulo, descripcion?,
 *   clienteId?, casoId?,
 *   prioridadId?,          // viene del catálogo categoriaId = 7
 *   fechaLimite?, recordatorio?,
 *   completada?,           // boolean (true/false)
 *   activo?                // boolean
 * }
 */
export async function createTarea(payload) {
  const { data } = await api.post("/tareas", payload);
  return data;
}

/**
 * PUT /tareas/:id
 * (mismo shape que create; sin "estado")
 */
export async function updateTarea(id, payload) {
  const { data } = await api.put(`/tareas/${id}`, payload);
  return data;
}

/**
 * (Opcional) DELETE /tareas/:id
 */
export async function deleteTarea(id) {
  const { data } = await api.delete(`/tareas/${id}`);
  return data;
}

/**
 * (Opcional) GET /tareas?search=&page=&pageSize=&desde=&hasta=&clienteId=&casoId=&completada=
 * Devuelve array o { data:[...] }
 */
export async function listTareas(params = {}) {
  const { data } = await api.get("/tareas", { params });
  return Array.isArray(data) ? data : (data?.data ?? []);
}

/**
 * Prioridades de Tarea (catálogo)
 * GET /parametros?categoriaId=7&activo=true
 */
export async function listPrioridadesTarea() {
  const { data } = await api.get("/parametros", {
    params: { categoriaId: 7, activo: true },
  });
  return Array.isArray(data) ? data : (data?.data ?? []);
}

/* ========================= Subtareas / Checklist ========================= */

/**
 * GET /tareas/:id/items
 * Devuelve { data: SubTarea[] } → retornamos solo el array
 */
export async function listSubtareas(tareaId) {
  const { data } = await api.get(`/tareas/${tareaId}/items`);
  return Array.isArray(data?.data) ? data.data : [];
}

/**
 * POST /tareas/:id/items
 * payload: { titulo, descripcion?, completada?, completadaAt?, orden? }
 */
export async function addSubtarea(tareaId, payload) {
  const { data } = await api.post(`/tareas/${tareaId}/items`, payload);
  return data; // SubTarea creada
}

/**
 * PUT /tareas/:id/items/:itemId
 * payload parcial (cualquier campo de SubTarea)
 */
export async function updateSubtarea(tareaId, itemId, payload) {
  const { data } = await api.put(`/tareas/${tareaId}/items/${itemId}`, payload);
  return data; // SubTarea actualizada
}

/**
 * DELETE /tareas/:id/items/:itemId
 * (soft delete en el backend)
 */
export async function deleteSubtarea(tareaId, itemId) {
  const res = await api.delete(`/tareas/${tareaId}/items/${itemId}`);
  // 204 No Content → no hay body
  return res.status === 204;
}

/**
 * POST /tareas/:id/items/reordenar
 * orden: [{ id, orden }, ...]
 */
export async function reorderSubtareas(tareaId, orden) {
  const { data } = await api.post(`/tareas/${tareaId}/items/reordenar`, { orden });
  return data; // { ok: true }
}

/**
 * POST /tareas/:id/items/:itemId/toggle
 * Alterna completada/completadaAt de una SubTarea
 */
export async function toggleSubtarea(tareaId, itemId) {
  const { data } = await api.post(`/tareas/${tareaId}/items/${itemId}/toggle`);
  return data; // SubTarea actualizada
}

/**
 * POST /tareas/:id/items/completar-todo
 * Completa todas las subtareas pendientes de la tarea
 */
export async function completarTodasSubtareas(tareaId) {
  const { data } = await api.post(`/tareas/${tareaId}/items/completar-todo`);
  return data; // { updated: number }
}

/* ========================= Toggle de Tarea ========================= */

/**
 * POST /tareas/:id/toggle
 * Alterna completada/completadaAt de la Tarea
 */
export async function toggleTarea(id) {
  const { data } = await api.post(`/tareas/${id}/toggle`);
  return data; // Tarea actualizada
}
