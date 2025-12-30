// src/validators/subtarea.schema.js
import { z } from "zod";

const subtareaBase = z.object({
  titulo: z.string().trim().min(1, "titulo es requerido"),
  descripcion: z.string().trim().optional().nullable(),
  completada: z.boolean().optional(),
  completadaAt: z.coerce.date().optional().nullable(),
  orden: z.coerce.number().int().min(0).optional(),
});

// Crear: requiere titulo, el resto opcional
export const crearSubtareaSchema = subtareaBase;

// Actualizar: todo opcional, pero si viene titulo, valida igual
export const actualizarSubtareaSchema = subtareaBase.partial({
  titulo: true,
  descripcion: true,
  completada: true,
  completadaAt: true,
  orden: true,
});
