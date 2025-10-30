// src/api/finanzas/ingreso-cuota.js
import api from "../axios";

/** Listar aplicaciones (por ingreso o por cuota) */
export async function listAplicacionesCuota({ ingresoId, cuotaId, page = 1, pageSize = 50 } = {}) {
  const { data } = await api.get("/finanzas/aplicaciones/cuotas", {
    params: {
      page,
      pageSize,
      ...(ingresoId ? { ingresoId: Number(ingresoId) } : {}),
      ...(cuotaId ? { cuotaId: Number(cuotaId) } : {}),
    },
  });
  return data; // { rows, data, total, ... }
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
  return data; // { totalARS, aplicadoARS, saldoARS, ... }
}

/** Resumen de la cuota contra ingresos */
export async function resumenCuota(cuotaId) {
  const { data } = await api.get(`/finanzas/aplicaciones/cuotas/cuota/${Number(cuotaId)}/resumen`);
  return data; // { totalARS, aplicadoARS, saldoARS, ... }
}
