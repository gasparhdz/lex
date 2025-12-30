import { z } from 'zod';

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#.\-_])[A-Za-z\d@$!%*?&#.\-_]{8,}$/;

export const crearUsuarioSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100),
  apellido: z.string().min(1, 'El apellido es requerido').max(100),
  dni: z.string().max(20).nullable().optional().or(z.literal('')),
  email: z.string().email('Email inválido').max(255),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(
      passwordRegex,
      'La contraseña debe tener al menos una mayúscula, una minúscula, un número y un carácter especial (@$!%*?&#.-)'
    ),
  telefono: z.string().max(50).nullable().optional().or(z.literal('')),
  activo: z.boolean().optional(),
  mustChangePass: z.boolean().optional(),
  roles: z.array(z.number()).optional().default([]),
});

export const actualizarUsuarioSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  apellido: z.string().min(1).max(100).optional(),
  dni: z.string().max(20).nullable().optional(),
  email: z.string().email().max(255).optional(),
  password: z
    .string()
    .min(8)
    .regex(passwordRegex, 'La contraseña debe tener al menos una mayúscula, una minúscula, un número y un carácter especial (@$!%*?&#.-)')
    .optional(),
  telefono: z.string().max(50).nullable().optional(),
  activo: z.boolean().optional(),
  mustChangePass: z.boolean().optional(),
  roles: z.array(z.number()).optional(),
});
