// src/validators/finanzas/honorario.schema.js
import { z } from "zod";

// >0 para crear
const posNum = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number({ invalid_type_error: "Debe ser numérico" }).positive("Debe ser mayor a cero")
).nullable().optional();

const nonNegNum = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number({ invalid_type_error: "Debe ser numérico" }).min(0, "No puede ser negativo")
).nullable().optional();

const honorarioBase = z.object({
  clienteId: z.coerce.number().int().positive().optional().nullable(),
  casoId:    z.coerce.number().int().positive().optional().nullable(),
  conceptoId: z.coerce.number().int().positive({ message: "conceptoId es requerido" }),
  parteId:    z.coerce.number().int().positive({ message: "parteId es requerido" }),
  estadoId:   z.coerce.number().int().positive().optional().nullable(),

  // 🔧 MONEDA OPCIONAL EN BASE (se exige solo en "crear")
  monedaId:   z.coerce.number().int().positive().optional().nullable(),

  politicaJusId: z.coerce.number().int().positive().optional().nullable(),

  jus:         posNum,
  montoPesos:  posNum,
  valorJusRef: posNum,

  fechaRegulacion: z.coerce.date({ invalid_type_error: "fechaRegulacion inválida" }),
  activo: z.boolean().optional(),
}).superRefine((val, ctx) => {
  const hasJus   = typeof val.jus === "number" && val.jus > 0;
  const hasPesos = typeof val.montoPesos === "number" && val.montoPesos > 0;
  if (!hasJus && !hasPesos) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe informar JUS o monto en pesos.", path: ["jus"] });
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Debe informar JUS o monto en pesos.", path: ["montoPesos"] });
  }
});

const planLite = z.object({
  crear: z.boolean().optional(),
  clienteId: z.coerce.number().int().positive().optional().nullable(),
  casoId: z.coerce.number().int().positive().optional().nullable(),
  descripcion: z.string().trim().optional().nullable(),
  fechaInicio: z.coerce.date().optional().nullable(),
  periodicidadId: z.coerce.number().int().positive().optional().nullable(),
  montoCuotaJus: z.preprocess(v => v===""||v==null? null : Number(v),
                  z.number().positive().min(0.0001)).nullable().optional(),
  montoCuotaPesos: z.preprocess(v => v===""||v==null? null : Number(v),
                  z.number().positive().min(0.01)).nullable().optional(),
  valorJusRef: z.preprocess(v => v===""||v==null? null : Number(v),
                  z.number().positive()).nullable().optional(),
}).partial();

// Crear: exigir monedaId aquí (siempre viene definida: JUS o ARS)
export const crearHonorarioSchema = honorarioBase
  .extend({
    monedaId: z.coerce.number().int().positive({ message: "monedaId es requerido" }),
    plan: planLite.optional(), // <-- acá
  });

// Actualizar: TODO opcional, incluidos monedaId/estadoId/etc.
export const actualizarHonorarioSchema = honorarioBase
  .partial({
    clienteId: true,
    casoId: true,
    conceptoId: true,
    parteId: true,
    estadoId: true,
    monedaId: true,         // 🔧 ahora opcional en actualizar
    politicaJusId: true,
    fechaRegulacion: true,
    jus: true,
    montoPesos: true,
    valorJusRef: true,
    activo: true,
  })
  .extend({
    jus: nonNegNum,
    montoPesos: nonNegNum,
    valorJusRef: nonNegNum,
  })
  .superRefine((val, ctx) => {
    if (val.jus != null && val.jus < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "JUS no puede ser negativo", path: ["jus"] });
    }
    if (val.montoPesos != null && val.montoPesos < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Monto en pesos no puede ser negativo", path: ["montoPesos"] });
    }
  });
