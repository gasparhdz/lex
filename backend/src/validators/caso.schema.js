import { z } from "zod";

export const casoBase = z.object({
  // Relaciones obligatorias
  clienteId: z.coerce.number().int().positive(),
  tipoId: z.coerce.number().int().positive(),

  // Campos obligatorios
  nroExpte: z.string().trim().min(1, "nroExpte es requerido"),
  caratula: z.string().trim().min(1, "caratula es requerida"),

  // Opcionales
  descripcion: z.string().optional().nullable(),
  estadoId: z.coerce.number().int().positive().optional().nullable(),
  fechaEstado: z.coerce.date().optional().nullable(),
  radicacionId: z.coerce.number().int().positive().optional().nullable(),
  estadoRadicacionId: z.coerce.number().int().positive().optional().nullable(),
  fechaEstadoRadicacion: z.coerce.date().optional().nullable(),

  // Estado
  activo: z.boolean().optional(),
});

// Crear requiere todos los obligatorios
export const crearCasoSchema = casoBase;

// Actualizar permite parcial (pero clienteId/tipoId siguen validando si llegan)
export const actualizarCasoSchema = casoBase.partial({
  clienteId: true,
  tipoId: true,
  nroExpte: true,
  caratula: true,
});
