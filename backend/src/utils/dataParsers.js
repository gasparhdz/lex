// src/utils/dataParsers.js
// Utilidades compartidas para parseo de datos

/**
 * Convierte un valor a entero o null
 */
export function intOrNull(v) {
  if (v === null) return null;
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Convierte un valor a número decimal o null
 */
export function numOrNull(v) {
  if (v === null) return null;
  if (v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Convierte un valor a string o null
 */
export function strOrNull(v) {
  if (v === null) return null;
  if (v === undefined) return undefined;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/**
 * Convierte un valor a fecha o null
 */
export function toDateOrNull(v) {
  if (v === null) return null;
  if (!v && v !== 0) return undefined;
  try {
    const d = new Date(v);
    return isNaN(d.getTime()) ? undefined : d;
  } catch {
    return undefined;
  }
}

/**
 * Redondea un número a 2 decimales
 */
export function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Parsea paginación desde request query
 */
export function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page ?? "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize ?? "20", 10)));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Convierte un valor de query a boolean
 */
export function boolFromQuery(v) {
  if (v === undefined) return undefined;
  const s = String(v).trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

