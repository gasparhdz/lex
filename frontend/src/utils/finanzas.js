// src/utils/finanzas.js
// Utilidades compartidas para el módulo de finanzas

/**
 * Calcula el monto en ARS de una cuota de honorario
 * @param {Object} cuota - Cuota del plan
 * @param {Number} valorJusGlobal - Valor JUS global a usar
 * @returns {Number} Monto en ARS
 */
export function computeMontoARSCuota(cuota, valorJusGlobal) {
  const ars = Number(cuota.montoARS ?? cuota.montoPesos ?? cuota.monto ?? 0);
  if (ars > 0) return ars;
  
  const jus = Number(cuota.jus ?? cuota.montoJus ?? cuota.cantidadJus ?? 0);
  const vj = Number(cuota.valorJusRef ?? valorJusGlobal ?? 0);
  if (jus > 0 && vj > 0) return Math.round(jus * vj * 100) / 100;
  return 0;
}

/**
 * Calcula el saldo efectivo de una cuota
 * @param {Object} cuota - Cuota del plan
 * @param {Number} valorJusGlobal - Valor JUS global a usar
 * @returns {Number} Saldo en ARS
 */
export function efectivoSaldoARSCuota(cuota, valorJusGlobal) {
  const provided = cuota.saldoARS ?? cuota.saldo;
  if (Number.isFinite(Number(provided))) return Number(provided);
  
  const ars = computeMontoARSCuota(cuota, valorJusGlobal);
  const aplicado = Number(cuota.aplicadoARS ?? cuota.montoAplicadoARS ?? cuota.aplicado ?? 0) || 0;
  return Math.max(Math.round((ars - aplicado) * 100) / 100, 0);
}

/**
 * Calcula el monto total en ARS de un gasto
 * @param {Object} gasto - Gasto
 * @returns {Number} Monto total en ARS
 */
export function totalARSFromGasto(gasto) {
  const calc = Number(gasto?.calc?.montoARS);
  if (Number.isFinite(calc)) return calc;
  
  const m = Number(gasto?.monto || 0);
  const c = Number(gasto?.cotizacionARS || 0);
  return c > 0 ? +(m * c).toFixed(2) : m;
}

/**
 * Calcula el saldo pendiente en ARS de un gasto
 * @param {Object} gasto - Gasto
 * @returns {Number} Saldo en ARS
 */
export function saldoARSFromGasto(gasto) {
  if (Number.isFinite(gasto?.saldoARS)) return Number(gasto.saldoARS);
  
  const t = totalARSFromGasto(gasto);
  const apl = Number(gasto?.aplicadoARS || 0);
  return Math.max(0, +(t - apl).toFixed(2));
}

/**
 * Formatea el monto de una cuota para mostrar (JUS + equivalencia en ARS)
 * @param {Object} cuota - Cuota
 * @param {Number} valorJus - Valor JUS
 * @param {Function} formatCurrency - Función para formatear moneda
 * @returns {String} Texto formateado
 */
export function formatMontoCuota(cuota, valorJus, formatCurrency) {
  const ars = Number(cuota.montoARS || 0);
  const jus = Number(cuota.jus || 0);
  
  if (jus > 0 && valorJus) {
    const jusTxt = Number.isInteger(jus) ? String(jus) : jus.toFixed(2);
    return `${jusTxt} JUS (${formatCurrency(ars, "ARS")})`;
  }
  
  return formatCurrency(ars, "ARS");
}

/**
 * Muestra nombre de cliente de forma consistente
 * @param {Object} cliente - Cliente
 * @returns {String} Nombre formateado
 */
export function displayCliente(cliente) {
  if (!cliente) return "Sin cliente";
  if (cliente.razonSocial?.trim()) return cliente.razonSocial.trim();
  
  const a = (cliente.apellido || "").trim();
  const n = (cliente.nombre || "").trim();
  if (a && n) return `${a}, ${n}`;
  return a || n || "Sin nombre";
}

/**
 * Muestra número de expediente de forma consistente
 * @param {Object} caso - Caso
 * @returns {String} Número de expediente
 */
export function displayExpte(caso) {
  if (!caso) return "-";
  
  const n = (
    caso.nroExpte ?? caso.expte ?? caso.numeroExpediente ?? caso.numero ?? ""
  ).toString().trim();
  
  return n || (caso.id ? `#${caso.id}` : "-");
}

/**
 * Calcula el importe ARS de un honorario
 * @param {Object} honorario - Honorario
 * @returns {Number|null} Monto en ARS o null
 */
export function computeImporteARS(honorario) {
  const mp = Number(honorario?.montoPesos);
  if (Number.isFinite(mp)) return mp;
  
  const jus = Number(honorario?.jus);
  const vj  = Number(honorario?.valorJusRef);
  if (Number.isFinite(jus) && Number.isFinite(vj)) return jus * vj;
  
  return null;
}

/**
 * Obtiene la moneda de un honorario para mostrar
 * @param {Object} honorario - Honorario
 * @returns {String} Label de moneda
 */
export function monedaLabel(honorario) {
  return honorario?.moneda?.nombre || honorario?.moneda?.codigo || ((honorario.jus != null) ? "JUS" : "$");
}

