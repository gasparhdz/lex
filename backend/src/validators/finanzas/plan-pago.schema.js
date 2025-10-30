// src/validators/finanzas/plan-pago.schema.js
import { z } from "zod";

/* ===================== PLAN DE PAGO ===================== */

const planBase = z
  .object({
    // Claves de relación
    honorarioId: z.coerce.number().int().positive().optional(), // requerido en "crear"
    clienteId: z.coerce.number().int().positive().optional().nullable(),
    casoId: z.coerce.number().int().positive().optional().nullable(),

    // Datos del plan
    descripcion: z.string().trim().optional().nullable(),
    fechaInicio: z.coerce.date().optional().nullable(),

    // Parametro(categoria="PeriodicidadPlan")
    periodicidadId: z.coerce.number().int().positive().optional().nullable(),

    // Monto de la cuota “base” del plan (una de ambas)
    montoCuotaJus: z.coerce.number().positive().optional().nullable(),
    montoCuotaPesos: z.coerce.number().positive().optional().nullable(),
    valorJusRef: z.coerce.number().positive().optional().nullable(), // snapshot al crear el plan

    // Estado lógico
    activo: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    // Exigir al menos uno de los montos para el plan (JUS o Pesos)
    const hasJus = val.montoCuotaJus != null && Number(val.montoCuotaJus) > 0;
    const hasPes = val.montoCuotaPesos != null && Number(val.montoCuotaPesos) > 0;
    if (!hasJus && !hasPes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe indicar el monto de cuota en JUS o en Pesos.",
        path: ["montoCuotaJus"],
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe indicar el monto de cuota en JUS o en Pesos.",
        path: ["montoCuotaPesos"],
      });
    }
  });

// Crear: honorarioId es obligatorio
export const crearPlanSchema = planBase.extend({
  honorarioId: z.coerce.number().int().positive({ message: "honorarioId es requerido" }),
});

// Actualizar: todo opcional (pero mantiene la regla de “al menos uno”)
export const actualizarPlanSchema = planBase;

/* ===================== CUOTAS ===================== */

const cuotaBase = z
  .object({
    // Claves
    planId: z.coerce.number().int().positive().optional(), // requerido en "crear" si la ruta no lo provee
    numero: z.coerce.number().int().min(1).optional().nullable(), // si no viene, el back lo calcula

    // Datos de la cuota
    vencimiento: z.coerce.date({ required_error: "vencimiento es requerido" }),
    montoJus: z.coerce.number().positive().optional().nullable(),
    montoPesos: z.coerce.number().positive().optional().nullable(),
    valorJusRef: z.coerce.number().positive().optional().nullable(),

    // Parametro(categoria="EstadoCuota": pendiente, pagada, parcial, vencida, condonada)
    estadoId: z.coerce.number().int().positive().optional().nullable(),
    observacion: z.string().trim().optional().nullable(),

    // Estado lógico
    activo: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    // Exigir al menos un importe (JUS o Pesos)
    const hasJus = val.montoJus != null && Number(val.montoJus) > 0;
    const hasPes = val.montoPesos != null && Number(val.montoPesos) > 0;
    if (!hasJus && !hasPes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La cuota debe tener monto en JUS o en Pesos.",
        path: ["montoJus"],
      });
    }
  });

export const crearCuotaSchema = cuotaBase;

// Actualizar: permitir parcial; si se envían montos, sigue aplicando la regla “al menos uno”
export const actualizarCuotaSchema = cuotaBase.partial({
  vencimiento: true,
  montoJus: true,
  montoPesos: true,
  valorJusRef: true,
  numero: true,
  estadoId: true,
  observacion: true,
});

/* ========== Generación masiva de cuotas (opcional) ========== */
/**
 * Para endpoint “generar cuotas” del plan: permite indicar cantidad y, opcionalmente,
 * primer vencimiento / periodicidad / montos si querés overridear los del plan.
 */
export const generarCuotasSchema = z
  .object({
    cantidad: z.coerce.number().int().min(1, "cantidad mínima 1").max(240, "máximo 240"),
    primerVencimiento: z.coerce.date().optional().nullable(),
    periodicidadId: z.coerce.number().int().positive().optional().nullable(),

    montoJus: z.coerce.number().positive().optional().nullable(),
    montoPesos: z.coerce.number().positive().optional().nullable(),
    valorJusRef: z.coerce.number().positive().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    // Si vienen montos override, validar > 0 (si no vienen, se usan los del plan)
    if (val.montoJus != null && !(Number(val.montoJus) > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "montoJus debe ser > 0", path: ["montoJus"] });
    }
    if (val.montoPesos != null && !(Number(val.montoPesos) > 0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "montoPesos debe ser > 0", path: ["montoPesos"] });
    }
  });
