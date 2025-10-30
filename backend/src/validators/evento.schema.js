import { z } from "zod";

const eventoBase = z
  .object({
    // Relaciones opcionales
    clienteId: z.coerce.number().int().positive().optional().nullable(),
    casoId: z.coerce.number().int().positive().optional().nullable(),

    // Obligatorios
    tipoId: z.coerce.number().int().positive(),
    fechaInicio: z.coerce.date(),

    // Opcionales
    fechaFin: z.coerce.date().optional().nullable(),
    allDay: z.boolean().optional(),
    timezone: z.string().trim().min(1).optional().nullable(),

    descripcion: z.string().optional().nullable(),
    observaciones: z.string().optional().nullable(),
    ubicacion: z.string().optional().nullable(),

    estadoId: z.coerce.number().int().positive().optional().nullable(),
    recordatorio: z.coerce.date().optional().nullable(),
    notificadoACliente: z.boolean().optional(),

    // Estado
    activo: z.boolean().optional(),
  })
  .superRefine((val, ctx) => {
    // fechaFin no puede ser anterior a fechaInicio (si viene)
    if (val.fechaFin && val.fechaFin < val.fechaInicio) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "fechaFin no puede ser anterior a fechaInicio",
        path: ["fechaFin"],
      });
    }
  });

// Crear requiere los obligatorios (tipoId, fechaInicio)
export const crearEventoSchema = eventoBase;

// Actualizar permite parcial (si llegan, validan con las mismas reglas)
export const actualizarEventoSchema = eventoBase.partial({
  tipoId: true,
  fechaInicio: true,
});
