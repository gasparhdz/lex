// src/api/finanzas/honorarios.js
import api from "../axios";

// --- helpers -------------------------------------------------
function cleanParams(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (v === undefined || v === null || v === "") continue;
    out[k] = v;
  }
  return out;
}

// Prefijos / recursos
const PFX = "/finanzas";
const RES_HON = "honorarios";
const RES_JUS = "valorjus/actual";

const BASE = `${PFX}/${RES_HON}`;

// Mapea sort del front → backend
function mapOrder(sortBy, sortDir) {
  // el back acepta: fechaRegulacion | createdAt | updatedAt
  if (sortBy === "fecha" || sortBy === "fechaRegulacion") {
    return { orderBy: "fechaRegulacion", order: sortDir || "desc" };
  }
  if (sortBy === "createdAt" || sortBy === "updatedAt") {
    return { orderBy: sortBy, order: sortDir || "desc" };
  }
  // para "montoPesos"/"saldo" no hay orden server-side → no enviamos nada
  return {};
}

// --- API -----------------------------------------------------

/** LISTAR */
export async function listHonorarios(params) {
  const resp = await api.get("/finanzas/honorarios", { params });
  const d = resp.data || {};
  return { rows: d.rows || d.data || [], total: d.total ?? 0 };
}

/** OBTENER UNO */
export async function getHonorario(id) {
  const { data } = await api.get(`${BASE}/${id}`);
  return data;
}

/** CREAR */
export async function createHonorario(payload) {
  const { data } = await api.post(`${BASE}`, payload);
  return data;
}

/** ACTUALIZAR */
export async function updateHonorario(id, payload) {
  const { data } = await api.put(`${BASE}/${id}`, payload);
  return data;
}

/** ELIMINAR */
export async function deleteHonorario(id) {
  const res = await api.delete(`${BASE}/${id}`);
  return res?.data ?? true; // el back devuelve 204 sin body
}

export async function getValorJusPorFecha(fechaISO) {
  const { data } = await api.get("/valorjus/por-fecha", { params: { fecha: fechaISO } });
  return data?.valor ?? data;
}
export async function getValorJusActual() {
  const { data } = await api.get("/valorjus/actual");
  return data?.valor ?? data;
}