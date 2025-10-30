// src/utils/format.js

export function formatCurrency(value, currency = "ARS") {
  if (value === null || value === undefined || isNaN(Number(value))) return "-";
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(Number(value));
  } catch {
    return Number(value).toFixed(2);
  }
}

export function toISODateString(d) {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date)) return null;
  // yyyy-mm-dd
  return date.toISOString().slice(0, 10);
}

// utils/format.js

/** Devuelve "DD-MM-YYYY" preservando día local. */
export function toDMYLocal(dateLike) {
  if (!dateLike) return "";
  const s = String(dateLike);

  // Tomamos solo la parte YYYY-MM-DD si viene así; si viene con tiempo/UTC,
  // igualamos al día (YYYY-MM-DD) y evitamos drift.
  const ymd = /^\d{4}-\d{2}-\d{2}/.test(s)
    ? s.slice(0, 10)
    : new Date(s).toISOString().slice(0, 10);

  const [y, m, d] = ymd.split("-").map(Number);
  // Construimos Date LOCAL a medianoche y formateamos
  const local = new Date(y, m - 1, d);
  const dd = String(local.getDate()).padStart(2, "0");
  const mm = String(local.getMonth() + 1).padStart(2, "0");
  const yyyy = local.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function toDMYStrict(input) {
  // Soporta: "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ssZ", Date, o falsy
  if (!input) return "—";

  // Si ya es Date, usamos getters *locales* (no toISOString)
  if (input instanceof Date && !isNaN(input)) {
    const y = input.getFullYear();
    const m = String(input.getMonth() + 1).padStart(2, "0");
    const d = String(input.getDate()).padStart(2, "0");
    return `${d}-${m}-${y}`;
  }

  // Para strings/ISO: recortamos a YYYY-MM-DD y no construimos Date
  const s = String(input);
  const ymd = s.slice(0, 10); // "YYYY-MM-DD"
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));

  if (!y || !m || !d) return "—";
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${y}`;
}

/** Para ordenar por fecha sin tocar TZ (usa YYYY-MM-DD literal si existe) */
export function ymdToLocalEpoch(input) {
  if (!input) return 0;
  const s = String(input);
  const ymd = s.slice(0, 10); // "YYYY-MM-DD"
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return 0;
  // Construimos fecha LOCAL a medianoche, sin pasar por ISO/UTC
  return new Date(y, m - 1, d).getTime();
}

export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatFecha(fecha) {
  if (!fecha) return '—';
  const d = new Date(fecha);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}