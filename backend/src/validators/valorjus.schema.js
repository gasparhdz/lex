// src/validators/valorjus.schema.js
import { z } from "zod";

/**
 * ValorJUS:
 * - valor: numérico > 0
 * - fecha: date (se valida unicidad en DB; acá sólo formato)
 * - activo: opcional (lo manejamos igual que en el resto)
 */
const base = z
  .object({
    valor: z.coerce
      .number({ invalid_type_error: "valor debe ser numérico" })
      .positive("valor debe ser mayor a 0")
      .optional(),
    fecha: z.coerce
      .date({ invalid_type_error: "fecha inválida" })
      .optional(),
    activo: z.boolean().optional(),
  })
  .strip();

// Crear: requiere valor y fecha
export const crearValorJusSchema = base.extend({
  valor: z.coerce
    .number({ invalid_type_error: "valor debe ser numérico" })
    .positive("valor debe ser mayor a 0"),
  fecha: z.coerce
    .date({ invalid_type_error: "fecha inválida" }),
});

// Actualizar: parcial (si vienen, validan)
export const actualizarValorJusSchema = base;
