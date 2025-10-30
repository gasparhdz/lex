// src/validators/finanzas/ingreso.schema.js
import { z } from "zod";

/**
 * Helpers de coerción
 */
const posIntOptNull = z.coerce.number().int().positive().optional().nullable();

// Requerido (crear): número > 0
const montoPositive = z.coerce
  .number({ invalid_type_error: "monto debe ser numérico" })
  .positive("monto debe ser mayor a 0");

// Opcional (actualizar): si viene, también > 0
const montoPositiveOptional = z
  .coerce
  .number({ invalid_type_error: "monto debe ser numérico" })
  .positive("monto debe ser mayor a 0")
  .optional();

/**
 * Base común
 * - .strip(): elimina claves desconocidas (si mandan equivalencias calculadas, se descartan)
 */
const ingresoBase = z
  .object({
    descripcion: z.string().trim().optional().nullable(),

    // Vinculaciones (todas opcionales)
    clienteId:   posIntOptNull,
    casoId:      posIntOptNull,
    honorarioId: posIntOptNull,
    gastoId:     posIntOptNull,

    // Catálogos
    tipoId:    posIntOptNull,   // p.ej. "Pago de honorarios", "Adelanto de gastos"
    monedaId:  posIntOptNull,   // catálogo "MonedaIngreso" (PESOS/JUS según tu DB)
    estadoId:  posIntOptNull,   // catálogo "EstadoMovimiento"

    // Estado lógico
    activo: z.boolean().optional(),
  })
  .strip() // descarta cualquier otro campo que llegue (p.ej. equivalencias calculadas)
  .superRefine((val, ctx) => {
    // XOR: no permitir ambos vinculados a la vez (honorarioId y gastoId)
    if (val.honorarioId != null && val.gastoId != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No puede vincular un ingreso a Honorario y Gasto simultáneamente.",
        path: ["honorarioId"],
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No puede vincular un ingreso a Honorario y Gasto simultáneamente.",
        path: ["gastoId"],
      });
    }
  });

/**
 * Crear: requiere monto y fechaIngreso
 * - monedaId opcional (si falta, el controller puede asumir PESOS por defecto)
 */
export const crearIngresoSchema = ingresoBase.extend({
  monto:        montoPositive,
  fechaIngreso: z.coerce.date({ invalid_type_error: "fechaIngreso inválida" }),
});

/**
 * Actualizar: parcial; si viene monto, debe ser > 0; si viene fechaIngreso, debe ser válida.
 * Al cambiar monto/moneda/fecha el controller recalcula equivalencias con el snapshot de ValorJUS.
 */
export const actualizarIngresoSchema = ingresoBase.extend({
  monto:        montoPositiveOptional,
  fechaIngreso: z.coerce.date({ invalid_type_error: "fechaIngreso inválida" }).optional(),
});
