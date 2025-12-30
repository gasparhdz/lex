// src/validators/finanzas/ingreso-cuota.schema.js
import { z } from "zod";

const id = z.coerce.number().int().positive();

const fechaOpt = z
  .coerce
  .date({ invalid_type_error: "fechaAplicacion inválida" })
  .optional();

// ─────────────────────────────────────────────────────────────
// Helpers de monto en ARS
// ─────────────────────────────────────────────────────────────
const montoARS = z
  .coerce
  .number({ invalid_type_error: "monto inválido" })
  .positive("monto debe ser > 0 (ARS)");

// Para 'actualizar': si viene null o "", lo tratamos como "no enviado" (undefined)
// así el campo es realmente opcional.
const montoARSOpt = z.preprocess(
  (v) => (v === null || v === "" ? undefined : v),
  z
    .coerce
    .number({ invalid_type_error: "monto inválido" })
    .positive("monto debe ser > 0 (ARS)")
).optional();

/**
 * Crear aplicación Ingreso ↔ PlanCuota (endpoint puntual)
 * - Requiere ingresoId (ya existe el ingreso)
 * - Monto siempre en ARS (obligatorio)
 * - fechaAplicacion opcional (el controller puede defaultear a ingreso.fechaIngreso)
 */
export const crearAplicacionCuotaSchema = z
  .object({
    ingresoId: id,
    cuotaId: id, // PlanCuota.id
    monto: montoARS,
    fechaAplicacion: fechaOpt,
  })
  .strip();

/**
 * Ítem de aplicación para el endpoint ORQUESTADOR (crear ingreso + aplicar cuotas)
 * - NO incluye ingresoId porque el ingreso aún no existe
 * - Monto en ARS obligatorio
 * - fechaAplicacion opcional
 */
export const aplicacionCuotaItemOrqSchema = z
  .object({
    cuotaId: id,
    monto: montoARS,
    fechaAplicacion: fechaOpt,
  })
  .strip();

/**
 * Listado de aplicaciones
 * - Requiere ingresoId o cuotaId
 * - Paginación opcional
 */
export const listarAplicacionesCuotaQuerySchema = z
  .object({
    ingresoId: id.optional(),
    cuotaId: id.optional(),

    ingreso_id: id.optional(),
    cuota_id: id.optional(),

    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(500).default(20),
  })
  .transform((v) => ({
    ...v,
    ingresoId: v.ingresoId ?? v.ingreso_id,
    cuotaId: v.cuotaId ?? v.cuota_id,
  }))
  .refine((v) => v.ingresoId || v.cuotaId, {
    message: "Debe indicar ingresoId o cuotaId",
    path: ["ingresoId"],
  });

/**
 * Actualizar aplicación
 * - Permitís cambiar fechaAplicacion y/o el monto (ARS)
 * - Si no viene ningún campo, se rechaza por “sin cambios”
 */
export const actualizarAplicacionCuotaSchema = z
  .object({
    monto: montoARSOpt,
    fechaAplicacion: fechaOpt,
  })
  .refine(
    (v) => v.monto != null || v.fechaAplicacion != null,
    { message: "No hay cambios para actualizar", path: ["fechaAplicacion"] }
  )
  .strip();
