// src/api/eventos.js
import api from "./axios";

/** Convierte Date/string/number a ISO o null */
function isoOrNull(v) {
  if (!v && v !== 0) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Elimina undefined/null/"" para no pisar datos en update */
function clean(obj = {}) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    out[k] = v;
  });
  return out;
}

/**
 * Lista paginada/filtrada (usa la respuesta del backend tal cual: {data, page, pageSize, total})
 * params: { page, pageSize, search, from, to, tipoId, estadoId, clienteId, casoId, activo }
 */
export async function listEventos(params = {}) {
  const q = { ...params };
  if (q.from instanceof Date) q.from = q.from.toISOString();
  if (q.to instanceof Date) q.to = q.to.toISOString();
  const res = await api.get("/eventos", { params: q });
  return res.data; // { data, page, pageSize, total }
}

/**
 * Conveniencia para rango (devuelve solo el array de eventos)
 * params: { from, to, ... }
 */
export async function listEventosRango(params = {}) {
  const { data } = await listEventos(params);
  return Array.isArray(data) ? data : [];
}

/** GET /eventos/:id */
export async function getEvento(id) {
  const res = await api.get(`/eventos/${id}`);
  return res.data;
}

/** POST /eventos */
export async function createEvento(data = {}) {
  const body = clean({
    clienteId: data.clienteId,
    casoId: data.casoId,
    fechaInicio: isoOrNull(data.fechaInicio),
    fechaFin: isoOrNull(data.fechaFin),
    allDay: data.allDay,
    timezone: data.timezone,
    tipoId: data.tipoId,
    estadoId: data.estadoId,
    descripcion: data.descripcion,
    observaciones: data.observaciones,
    recordatorio: isoOrNull(data.recordatorio),
    notificadoACliente: data.notificadoACliente,
    ubicacion: data.ubicacion,
    activo: data.activo,
  });
  const res = await api.post("/eventos", body);
  return res.data; // incluye warnings si hay
}

/** PUT /eventos/:id */
export async function updateEvento(id, data = {}) {
  const body = clean({
    clienteId: data.clienteId,
    casoId: data.casoId,
    fechaInicio: isoOrNull(data.fechaInicio),
    fechaFin: isoOrNull(data.fechaFin),
    allDay: data.allDay,
    timezone: data.timezone,
    tipoId: data.tipoId,
    estadoId: data.estadoId,
    descripcion: data.descripcion,
    observaciones: data.observaciones,
    recordatorio: isoOrNull(data.recordatorio),
    notificadoACliente: data.notificadoACliente,
    ubicacion: data.ubicacion,
    activo: data.activo,
  });
  const res = await api.put(`/eventos/${id}`, body);
  return res.data; // incluye warnings si hay
}

/** DELETE /eventos/:id */
export async function deleteEvento(id) {
  const res = await api.delete(`/eventos/${id}`);
  // backend responde 204 sin body → axios.data será "" (string)
  return res.data ?? null;
}
