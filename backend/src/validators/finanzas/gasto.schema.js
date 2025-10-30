// src/validators/finanzas/gasto.schema.js
import { z } from "zod";

/* ============== Helpers: normalizar empty string ============== */
const emptyToNull = (v) => (v === "" ? null : v);
const emptyToUndef = (v) => (v === "" ? undefined : v);

/* IDs opcionales (acepta "", null, number>0) */
const posIntOptNull = z.preprocess(
  emptyToNull,
  z.coerce.number().int().positive().optional().nullable()
);

/* Números opcionales (update): si viene "", lo ignoro; si viene valor, debe ser > 0 */
const positiveNumOpt = z.preprocess(
  emptyToUndef,
  z.coerce.number({ invalid_type_error: "debe ser numérico" }).positive("debe ser mayor a 0")
).optional();

/* Fechas opcionales en base: "" => undefined, si viene valor debe ser válida */
const dateOpt = z.preprocess(
  emptyToUndef,
  z.coerce.date({ invalid_type_error: "fecha inválida" })
).optional();

/* ============== Base común ============== */
/**
 * Coincide con el modelo:
 *  - NO incluye cobrado / fechaCobro
 *  - SÍ incluye cotizacionARS (opcional)
 *  - .strip() ignora claves extra
 */
const gastoBase = z
  .object({
    descripcion: z.string().trim().max(500).optional().nullable(),

    // Relaciones
    clienteId:  posIntOptNull,
    casoId:     posIntOptNull,
    conceptoId: posIntOptNull,
    monedaId:   posIntOptNull, // Parametro(categoria="Moneda")

    // Valores
    monto:      positiveNumOpt,
    fechaGasto: dateOpt,

    // Snapshot de tipo de cambio cuando moneda != ARS
    cotizacionARS: z.preprocess(
      emptyToNull,
      z.coerce
        .number({ invalid_type_error: "cotizacionARS debe ser numérica" })
        .positive("cotizacionARS debe ser mayor a 0")
        .optional()
        .nullable()
    ),

    // Estado lógico
    activo: z.boolean().optional(),
  })
  .strip();

/* ============== Crear ============== */
/**
 * Requeridos:
 *  - clienteId
 *  - monto > 0
 *  - fechaGasto
 *  - monedaId/cotizacionARS son opcionales (la lógica ARS vs. no ARS la resuelve el controller)
 */
export const crearGastoSchema = gastoBase.extend({
  clienteId: z.preprocess(
    emptyToNull,
    z.coerce.number().int().positive({ message: "clienteId es requerido" })
  ),
  conceptoId: z.preprocess(
    emptyToNull,
    z.coerce.number().int().positive({ message: "conceptoId es requerido" })
  ),
  monedaId: z.preprocess(
    emptyToNull,
    z.coerce.number().int().positive({ message: "monedaId es requerido" })
  ),
  monto: z.preprocess(
    emptyToNull,
    z.coerce.number({ invalid_type_error: "monto debe ser numérico" }).positive("monto debe ser mayor a 0")
  ),
  fechaGasto: z.preprocess(
    emptyToNull,
    z.coerce.date({ invalid_type_error: "fechaGasto inválida" })
  ),
});

/* ============== Actualizar ============== */
/** Parcial. Si vienen monto/cotizacionARS deben validar. */
export const actualizarGastoSchema = gastoBase;
