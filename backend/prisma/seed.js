import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
const prisma = new PrismaClient();

async function main() {
  // Categoría: TIPO_PERSONA
  const cat = await prisma.categoria.upsert({
    where: { codigo: 'TIPO_PERSONA' },
    update: {},
    create: { codigo: 'TIPO_PERSONA', nombre: 'Tipo de Persona' }
  });

  await prisma.parametro.upsert({
    where: { categoriaId_codigo: { categoriaId: cat.id, codigo: 'FISICA' } },
    update: {},
    create: { categoriaId: cat.id, codigo: 'FISICA', nombre: 'Persona Física' }
  });
  await prisma.parametro.upsert({
    where: { categoriaId_codigo: { categoriaId: cat.id, codigo: 'JURIDICA' } },
    update: {},
    create: { categoriaId: cat.id, codigo: 'JURIDICA', nombre: 'Persona Jurídica' }
  });

  // Rol ADMIN + permisos full
  const adminRole = await prisma.rol.upsert({
    where: { codigo: 'ADMIN' },
    update: {},
    create: { codigo: 'ADMIN', nombre: 'Administrador' }
  });
  const modulos = ['DASHBOARD','CLIENTES','CASOS','AGENDA','TAREAS','EVENTOS','FINANZAS','ADJUNTOS','CONFIGURACION','USUARIOS'];
  for (const m of modulos) {
    await prisma.permiso.upsert({
      where: { rolId_modulo: { rolId: adminRole.id, modulo: m } },
      update: { ver: true, crear: true, editar: true, eliminar: true },
      create: { rolId: adminRole.id, modulo: m, ver: true, crear: true, editar: true, eliminar: true }
    });
  }

  // Usuario admin
  const pass = await argon2.hash('Admin1234!');
  const adminUser = await prisma.usuario.upsert({
    where: { email: 'admin@lex.local' },
    update: {},
    create: { nombre: 'Admin', apellido: 'Root', email: 'admin@lex.local', password: pass, activo: true }
  });
  await prisma.usuarioRol.upsert({
    where: { usuarioId_rolId: { usuarioId: adminUser.id, rolId: adminRole.id } },
    update: {},
    create: { usuarioId: adminUser.id, rolId: adminRole.id }
  });
}

main().finally(() => prisma.$disconnect());
