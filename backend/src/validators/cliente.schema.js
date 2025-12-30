import { z } from "zod";

export const clienteBase = z.object({
  // IDs: convertir string numérico -> number
  tipoPersonaId: z.coerce.number().int().positive(),
  localidadId: z.coerce.number().int().positive().optional().nullable(),

  // Identidad
  nombre: z.string().trim().min(1).optional().nullable(),
  apellido: z.string().trim().min(1).optional().nullable(),
  razonSocial: z.string().trim().min(1).optional().nullable(),

  // Doc
  dni: z.string().regex(/^\d{7,8}$/).optional().nullable(),
  cuit: z.string().regex(/^\d{11}$/).optional().nullable(),

  // ⬇️ Acepta "YYYY-MM-DD" y Date; lo parsea a Date automáticamente
  fechaNacimiento: z.coerce.date().optional().nullable(),

  // Contacto
  email: z.string().email().optional().nullable(),
  telFijo: z.string().optional().nullable(),
  telCelular: z.string().optional().nullable(),

  // Dirección (nombres de columnas del modelo)
  dirCalle: z.string().optional().nullable(),
  dirNro: z.string().optional().nullable(),
  dirPiso: z.string().optional().nullable(),
  dirDepto: z.string().optional().nullable(),
  codigoPostal: z.string().optional().nullable(),

  // Observaciones / estado
  observaciones: z.string().optional().nullable(),
  activo: z.boolean().optional(),

  /* ===== Aliases que puede mandar el front =====
     Los mapea el controlador a las columnas reales (dirCalle, etc.) */
  calle: z.string().optional().nullable(),
  nro: z.string().optional().nullable(),
  piso: z.string().optional().nullable(),
  depto: z.string().optional().nullable(),
  notas: z.string().optional().nullable(),
  // Permitimos que llegue aunque no persista en el modelo
  fechaInicioActividad: z.string().optional().nullable(),
})
.superRefine((val, ctx) => {
  // Regla: DNI o CUIT al menos uno
  if (!(val.dni || val.cuit)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dni"],              // anclar el error a algún campo
      message: "Debe informar DNI o CUIT",
    });
  }
});

export const crearClienteSchema = clienteBase;
export const actualizarClienteSchema = clienteBase.partial({ tipoPersonaId: true });
