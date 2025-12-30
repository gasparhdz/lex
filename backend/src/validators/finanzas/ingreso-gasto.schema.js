// src/validators/finanzas/ingreso-gasto.schema.js
import { z } from "zod";

const id = z.coerce.number().int().positive();

const fechaOpt = z
  .coerce
  .date({ invalid_type_error: "fechaAplicacion inválida" })
  .optional();

/**
 * Crear aplicación Ingreso↔Gasto
 * - Monto siempre en ARS
 * - fechaAplicacion opcional (el controller puede defaultear a ingreso.fechaIngreso)
 */
export const crearAplicacionSchema = z
  .object({
    ingresoId: id,
    gastoId: id,
    monto: z.coerce.number().positive("monto debe ser > 0 (ARS)"),
    fechaAplicacion: fechaOpt,
  })
  .strip();

/**
 * Listado de aplicaciones
 * - Requiere ingresoId o gastoId
 * - Paginación opcional
 */
export const listarAplicacionesQuerySchema = z
  .object({
    // camelCase (ideal)
    ingresoId: id.optional(),
    gastoId: id.optional(),

    // snake_case (por si el front/serializer lo manda así)
    ingreso_id: id.optional(),
    gasto_id: id.optional(),

    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(500).optional(),
  })
  .transform((v) => ({
    ...v,
    ingresoId: v.ingresoId ?? v.ingreso_id,
    gastoId: v.gastoId ?? v.gasto_id,
  }))
  .refine((v) => v.ingresoId || v.gastoId, {
    message: "Debe indicar ingresoId o gastoId",
    path: ["ingresoId"],
  });

/**
 * Actualizar aplicación
 * - Permitís cambiar fechaAplicacion y/o el monto (ARS)
 * - Si no viene ningún campo, se rechaza por “sin cambios”
 */
export const actualizarAplicacionSchema = z
  .object({
    monto: z.coerce.number().positive("monto debe ser > 0 (ARS)").optional(),
    fechaAplicacion: fechaOpt,
  })
  .refine(
    (v) => v.monto != null || v.fechaAplicacion != null,
    { message: "No hay cambios para actualizar", path: ["fechaAplicacion"] }
  )
  .strip();
