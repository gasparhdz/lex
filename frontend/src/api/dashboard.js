import api from "./axios";

/* ============================================================
   DASHBOARD API
   ============================================================ */

/**
 * Obtiene KPIs generales del dashboard
 * GET /dashboard/kpis
 * 
 * Ejemplo de respuesta:
 * {
 *   casosActivos: 27,
 *   tareasPendientes: 14,
 *   honorariosPendientesMes: 450000,
 *   gastosNoCobradosMes: 120000,
 *   periodo: "2025-10"
 * }
 */
export async function fetchDashboardKpis() {
  const { data } = await api.get("/dashboard/kpis");
  return data;
}

/**
 * Lista tareas pendientes (puede incluir vencidas si se indica)
 * GET /dashboard/tareas?includeOverdue=true|false
 * 
 * Ejemplo de respuesta:
 * [
 *   { id: 1, titulo: "Presentar demanda", fechaVencimiento: "2025-10-16", caso: { id: 5, caratula: "..." } },
 *   ...
 * ]
 */
export async function fetchDashboardTareas(params = {}) {
  const query = {};
  if (typeof params.includeOverdue === "boolean") {
    query.includeOverdue = params.includeOverdue;
  }
  const { data } = await api.get("/dashboard/tareas", { params: query });
  return data;
}

/**
 * Lista de eventos próximos desde hoy en adelante
 * GET /dashboard/eventos
 * 
 * Ejemplo de respuesta:
 * [
 *   { id: 3, titulo: "Audiencia Caso López", fecha: "2025-10-17", caso: { id: 5, caratula: "..." } },
 *   ...
 * ]
 */
export async function fetchDashboardEventos() {
  const { data } = await api.get("/dashboard/eventos");
  return data;
}
