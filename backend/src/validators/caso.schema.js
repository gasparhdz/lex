import { z } from "zod";

// Helper para convertir strings vacíos a null
const stringToNull = z.string().trim().transform((val) => (val === "" ? null : val)).nullable().optional();

export const casoBase = z.object({
  // Relaciones obligatorias
  clienteId: z.coerce.number().int().positive(),
  tipoId: z.coerce.number().int().positive(),

  // Campos opcionales (para trámites sin expediente como ciudadanías)
  // Convertir strings vacíos a null después del trim
  nroExpte: stringToNull,
  caratula: stringToNull,

  // Opcionales
  descripcion: stringToNull,
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
});
