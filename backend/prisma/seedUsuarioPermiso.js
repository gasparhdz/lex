import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
const prisma = new PrismaClient();

async function main() {
  console.log('👤 Iniciando seed de usuario y permisos...');

  // Rol ADMIN + permisos full
  const adminRole = await prisma.rol.upsert({
    where: { codigo: 'ADMIN' },
    update: {},
    create: { codigo: 'ADMIN', nombre: 'Administrador' }
  });
  console.log('✅ Rol ADMIN creado');

  const modulos = ['DASHBOARD','CLIENTES','CASOS','AGENDA','TAREAS','EVENTOS','FINANZAS','ADJUNTOS','CONFIGURACION','USUARIOS'];
  for (const m of modulos) {
    await prisma.permiso.upsert({
      where: { rolId_modulo: { rolId: adminRole.id, modulo: m } },
      update: { ver: true, crear: true, editar: true, eliminar: true },
      create: { rolId: adminRole.id, modulo: m, ver: true, crear: true, editar: true, eliminar: true }
    });
  }
  console.log(`✅ ${modulos.length} permisos creados para ADMIN`);

  // Usuario admin
  const pass = await argon2.hash('Pasgar96*');
  
  // Buscar si existe
  const existingUser = await prisma.usuario.findUnique({
    where: { email: 'gaspihernandez@gmail.com' }
  });
  
  if (existingUser) {
    // Si existe, actualizar el password forzosamente
    await prisma.usuario.update({
      where: { email: 'gaspihernandez@gmail.com' },
      data: { password: pass, activo: true }
    });
    console.log('✅ Usuario admin actualizado con nuevo password');
  } else {
    // Si no existe, crearlo
    await prisma.usuario.create({
      data: { nombre: 'Gaspar', apellido: 'Hernández', email: 'gaspihenandez@gmail.com', password: pass, activo: true }
    });
    console.log('✅ Usuario admin creado');
  }
  
  const adminUser = await prisma.usuario.findUnique({
    where: { email: 'gaspihenandez@gmail.com' }
  });

  await prisma.usuarioRol.upsert({
    where: { usuarioId_rolId: { usuarioId: adminUser.id, rolId: adminRole.id } },
    update: {},
    create: { usuarioId: adminUser.id, rolId: adminRole.id }
  });
  console.log('✅ Relación usuario-rol creada');

  console.log('🎉 Seed de usuario y permisos completado');
}

main()
  .then(() => console.log('✅ Seed ejecutado exitosamente'))
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

