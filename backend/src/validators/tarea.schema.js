import { z } from "zod";

const subItemSchema = z.object({
  titulo: z.string().trim().min(1, "El título de la subtarea es requerido"),
  descripcion: z.string().optional().nullable(),
  completada: z.boolean().optional(),
  completadaAt: z.coerce.date().optional().nullable(),
  orden: z.coerce.number().int().min(0).optional(),
});

const tareaBase = z
  .object({
    // Requeridos
    titulo: z.string().trim().min(1, "El título es requerido"),

    // Opcionales
    descripcion: z.string().optional().nullable(),
    fechaLimite: z.coerce.date().optional().nullable(),
    prioridadId: z.coerce.number().int().positive().optional().nullable(),
    recordatorio: z.coerce.date().optional().nullable(),

    completada: z.boolean().optional(),
    completadaAt: z.coerce.date().optional().nullable(),

    asignadoA: z.coerce.number().int().positive().optional().nullable(),

    clienteId: z.coerce.number().int().positive().optional().nullable(),
    casoId: z.coerce.number().int().positive().optional().nullable(),

    // Subtareas (checklist)
    items: z.array(subItemSchema).optional(),

    // Estado
    activo: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    // Si viene completadaAt, exigimos completada = true
    if (val.completadaAt && !val.completada) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Si completadaAt tiene valor, la tarea debe estar marcada como completada.",
        path: ["completada"],
      });
    }
    // fechaLimite no puede ser anterior a la fecha actual
    if (val.fechaLimite && val.fechaLimite < new Date()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha límite no puede ser anterior a la fecha actual",
        path: ["fechaLimite"],
      });
    }
    // recordatorio no puede ser posterior a fechaLimite
    if (val.recordatorio && val.fechaLimite && val.recordatorio > val.fechaLimite) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El recordatorio no puede ser posterior a la fecha límite",
        path: ["recordatorio"],
      });
    }
  });

// Crear requiere los obligatorios (título)
export const crearTareaSchema = tareaBase;

// Actualizar permite parcial
export const actualizarTareaSchema = tareaBase.partial({
  titulo: true,
});
