// src/api/finanzas/ingreso-gasto.js
import api from "../axios";

/* ========================= Config ========================= */
// Backend montado así:
//   app.use('/api/finanzas/aplicaciones/gastos', ingresoGastoRoutes);
const BASE = "/finanzas/aplicaciones/gastos";

/* ========================= Helpers ========================= */
function normListResp(resp, defaults) {
  const data = resp?.data ?? resp ?? {};
  const rows = Array.isArray(data?.data) ? data.data : [];
  const total = typeof data?.total === "number" ? data.total : rows.length;

  return {
    rows,
    total: Number(total ?? 0),
    page: Number(data?.page ?? defaults.page),
    pageSize: Number(data?.pageSize ?? defaults.pageSize),
  };
}

/* ========================= Listado de aplicaciones ========================= */
/**
 * Lista aplicaciones entre Ingresos y Gastos.
 * params: { page=1, pageSize=20, ingresoId?, gastoId? }  // al menos uno
 * - page es 1-based (igual que el backend)
 * - pageSize se limita a 100 (como el schema del backend)
 */
export async function listAplicacionesIngresoGasto(params = {}) {
  const rawPage     = Number(params.page ?? 1);
  const rawPageSize = Number(params.pageSize ?? 20);

  const page     = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;     // 1-based
  const pageSize = Math.min(100, Number.isFinite(rawPageSize) ? rawPageSize : 20);

  const q = {
    page,
    pageSize,
    ingresoId: params.ingresoId || undefined,
    gastoId: params.gastoId || undefined,
  };

  const resp = await api.get(`${BASE}`, { params: q });
  return normListResp(resp, { page, pageSize });
}

/* ========================= Obtener una aplicación ========================= */
export async function getAplicacionIngresoGasto(id) {
  const { data } = await api.get(`${BASE}/${id}`);
  return data ?? null;
}

/* ========================= Crear aplicación ========================= */
/**
 * payload: { ingresoId: number, gastoId: number, monto: number, fechaAplicacion?: DateISO }
 *   - monto en ARS
 */
export async function crearAplicacionIngresoGasto(payload) {
  const { data } = await api.post(`${BASE}`, payload);
  return data ?? null;
}

/* ========================= (Opcional) Actualizar aplicación ========================= */
/**
 * payload parcial: { monto?: number, fechaAplicacion?: DateISO }
 */
export async function actualizarAplicacionIngresoGasto(id, payload) {
  const { data } = await api.put(`${BASE}/${id}`, payload);
  return data ?? null;
}

/* ========================= Borrar aplicación (soft) ========================= */
export async function deleteAplicacionIngresoGasto(id) {
  await api.delete(`${BASE}/${id}`);
  return true; // el back devuelve 204/200
}

/* ========================= Resúmenes ========================= */
/** GET /api/finanzas/aplicaciones/gastos/ingreso/:ingresoId/resumen */
export async function getResumenIngresoGastos(ingresoId) {
  const { data } = await api.get(`${BASE}/ingreso/${ingresoId}/resumen`);
  return data ?? null;
}

/** GET /api/finanzas/aplicaciones/gastos/gasto/:gastoId/resumen */
export async function getResumenGasto(gastoId) {
  const { data } = await api.get(`${BASE}/gasto/${gastoId}/resumen`);
  return data ?? null;
}

/* ===== Alias de compatibilidad (import antiguos) ===== */
export const listAplicacionesGasto   = listAplicacionesIngresoGasto;
export const getAplicacionGasto      = getAplicacionIngresoGasto;
export const createAplicacionGasto   = crearAplicacionIngresoGasto;
export const deleteAplicacionGasto   = deleteAplicacionIngresoGasto;
export const resumenIngreso          = getResumenIngresoGastos;
export const resumenGasto            = getResumenGasto;
