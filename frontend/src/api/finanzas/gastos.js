// src/api/finanzas/gastos.js
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
const RES = "gastos";
const BASE = `${PFX}/${RES}`;

// Mapea sort del front → backend
// El back acepta orderBy: fechaGasto | monto | createdAt | updatedAt
function mapOrder(sortBy, sortDir) {
  let orderBy;
  if (sortBy === "fecha" || sortBy === "fechaGasto") orderBy = "fechaGasto";
  if (sortBy === "monto") orderBy = "monto";
  if (sortBy === "createdAt" || sortBy === "updatedAt") orderBy = sortBy;

  if (!orderBy) return {};
  return { orderBy, order: sortDir || "desc" };
}

/** LISTAR */
export async function listGastos(params = {}) {
  const { sortBy, sortDir, ...rest } = params || {};
  const query = cleanParams({
    ...rest,
    ...mapOrder(sortBy, sortDir),
  });

  const { data } = await api.get(BASE, { params: query });
  // back: { data, total, page, pageSize }; normalizamos a { rows, total }
  return { rows: data?.rows || data?.data || [], total: data?.total ?? 0, meta: data };
}

/** OBTENER UNO */
export async function getGasto(id) {
  const { data } = await api.get(`${BASE}/${id}`);
  return data; // el back devuelve el gasto + calc (montoARS/flags) si corresponde
}

/** CREAR */
export async function createGasto(payload) {
  const { data } = await api.post(BASE, payload);
  return data; // devuelve el gasto creado + calc + warnings
}

/** ACTUALIZAR */
export async function updateGasto(id, payload) {
  const { data } = await api.put(`${BASE}/${id}`, payload);
  return data; // devuelve el gasto actualizado + calc
}

/** ELIMINAR (soft-delete) */
export async function deleteGasto(id) {
  const res = await api.delete(`${BASE}/${id}`);
  return res?.data ?? true; // el back responde 204 sin body
}
