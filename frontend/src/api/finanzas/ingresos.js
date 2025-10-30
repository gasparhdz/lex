// src/api/finanzas/ingresos.js
import api from "../axios";

/* ========================= Config ========================= */
const BASE = "/finanzas/ingresos";

/* ========================= Helpers ========================= */
function normListResp(resp, defaults) {
  const data = resp?.data ?? resp ?? {};
  const rows =
    Array.isArray(data?.data) ? data.data :
    Array.isArray(data) ? data :
    [];
  const total = typeof data?.total === "number" ? data.total : rows.length;

  return {
    rows,
    total: Number(total ?? 0),
    page: Number(data?.page ?? defaults.page),
    pageSize: Number(data?.pageSize ?? defaults.pageSize),
  };
}

/* ========================= Listado ========================= */
export async function listIngresos(params = {}) {
  const {
    page = 0,
    pageSize = 10,
    search,
    orderBy = "fechaIngreso", // permitido: fechaIngreso | createdAt | updatedAt
    order = "desc",
    ...filters // clienteId, casoId, tipoId, monedaId, estadoId, from, to, etc.
  } = params;

  const q = {
    page: (Number(page) || 0) + 1, // backend 1-based
    pageSize,
    search: search || undefined,
    orderBy,
    order,
    ...filters,
  };

  const resp = await api.get(`${BASE}`, { params: q });
  return normListResp(resp, { page: 1, pageSize });
}

/* ========================= Obtener uno ========================= */
export async function getIngreso(id) {
  const { data } = await api.get(`${BASE}/${Number(id)}`);
  return data ?? null;
}

/* ========================= Crear ========================= */
export async function createIngreso(payload) {
  const { data } = await api.post(`${BASE}`, payload);
  return data ?? null;
}

/**
 * Crear ingreso + (opcional) aplicar cuotas en el mismo request.
 * Enviar payload:
 * {
 *   ...campos del ingreso,
 *   aplicacionesCuotas: [{ cuotaId: number, monto: number }, ...] // montos en ARS
 * }
 * Usa el MISMO endpoint POST /finanzas/ingresos; el backend detecta y orquesta.
 */
export async function createIngresoConAplicaciones(payload) {
  const { data } = await api.post(`${BASE}`, payload);
  return data ?? null;
}

/* ========================= Actualizar ========================= */
export async function updateIngreso(id, payload) {
  const { data } = await api.put(`${BASE}/${Number(id)}`, payload);
  return data ?? null;
}

/**
 * Reconciliar un ingreso al editarlo:
 * - Actualiza los campos del ingreso (monto, moneda, fecha, etc.)
 * - Soft-deleta aplicaciones que ya no están seleccionadas
 * - Reaplica automáticamente a las cuotas seleccionadas, pudiendo ajustar PARCIAL si no alcanza
 *
 * payload esperado:
 * {
 *   ...camposDelIngresoOpcionales,
 *   selectedCuotaIds: number[],          // cuotas marcadas en la UI
 *   forceReaplicarParcial?: boolean,     // si true, permite pagar PARCIAL automáticamente
 *   confirmarAjuste?: boolean            // si true, confirma el ajuste cuando el total baja
 * }
 *
 * Endpoint: PUT /finanzas/ingresos/:id/reconciliar
 */
export async function updateIngresoReconciliar(id, payload) {
  const { data } = await api.put(`${BASE}/${Number(id)}/reconciliar`, payload);
  return data ?? null;
}

/* ========================= Borrar (soft delete) ========================= */
export async function deleteIngreso(id) {
  await api.delete(`${BASE}/${Number(id)}`);
  return true; // el back devuelve 204
}
