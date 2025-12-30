// src/api/finanzas/ingreso-cuota.js
import api from "../axios";

/* Normalizador (acepta {rows}, {data}, {data:{rows}}, etc.) */
function normalizeList(data) {
  const d = data ?? {};

  const rows =
    Array.isArray(d?.rows) ? d.rows
    : Array.isArray(d?.data) ? d.data
    : Array.isArray(d?.items) ? d.items
    : Array.isArray(d?.data?.rows) ? d.data.rows
    : Array.isArray(d?.data?.data) ? d.data.data
    : [];

  const total =
    typeof d?.total === "number" ? d.total
    : typeof d?.count === "number" ? d.count
    : typeof d?.data?.total === "number" ? d.data.total
    : rows.length;

  return {
    rows,
    total: Number(total ?? 0),
    page: Number(d?.page ?? d?.data?.page ?? 1),
    pageSize: Number(d?.pageSize ?? d?.data?.pageSize ?? rows.length),
    raw: d,
  };
}

/** Listar aplicaciones (por ingreso o por cuota) */
export async function listAplicacionesCuota({ ingresoId, cuotaId, page = 1, pageSize = 50 } = {}) {
  const params = {
    page,
    pageSize,
    ...(ingresoId ? { ingresoId: Number(ingresoId), ingreso_id: Number(ingresoId) } : {}),
    ...(cuotaId ? { cuotaId: Number(cuotaId), cuota_id: Number(cuotaId) } : {}),
  };

  const { data } = await api.get("/finanzas/aplicaciones/cuotas", { params });

  // ✅ devolvemos SIEMPRE { rows, total, ... }
  return normalizeList(data);
}

/** Crear una aplicación ingreso ↔ cuota (uso puntual, no el flujo orquestado) */
export async function createAplicacionCuota({ ingresoId, cuotaId, monto, fechaAplicacion } = {}) {
  const body = {
    ingresoId: Number(ingresoId),
    cuotaId: Number(cuotaId),
    monto: Number(monto),
    ...(fechaAplicacion ? { fechaAplicacion } : {}),
  };
  const { data } = await api.post("/finanzas/aplicaciones/cuotas", body);
  return data;
}

/** Actualizar aplicación */
export async function updateAplicacionCuota(id, body) {
  const { data } = await api.put(`/finanzas/aplicaciones/cuotas/${Number(id)}`, body);
  return data;
}

/** Borrar (soft delete) aplicación */
export async function deleteAplicacionCuota(id) {
  const { data } = await api.delete(`/finanzas/aplicaciones/cuotas/${Number(id)}`);
  return data;
}

/** Resumen del ingreso contra cuotas */
export async function resumenIngresoCuotas(ingresoId) {
  const { data } = await api.get(`/finanzas/aplicaciones/cuotas/ingreso/${Number(ingresoId)}/resumen`);
  return data;
}

/** Resumen de la cuota contra ingresos */
export async function resumenCuota(cuotaId) {
  const { data } = await api.get(`/finanzas/aplicaciones/cuotas/cuota/${Number(cuotaId)}/resumen`);
  return data;
}
