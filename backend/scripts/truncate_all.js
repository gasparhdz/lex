import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('⚠️  ATENCIÓN: Se van a truncar TODAS las tablas');
  console.log('🚨 Esta operación es IRREVERSIBLE');
  console.log('🔁 Los IDs se reiniciarán a 1');
  console.log('');

  try {
    // Nombres reales de las tablas en PostgreSQL (Prisma mapea a snake_case)
    const tablas = [
      'Adjunto',
      'ContactoCliente',
      'ClienteHistorial',
      'ClienteNota',
      'Cliente',
      'CasoHistorial',
      'CasoNota',
      'Caso',
      'Evento',
      'SubTarea',
      'Tarea',
      'Honorario',
      'PlanPago',
      'PlanCuota',
      'Ingreso',
      'IngresoCuota',
      'IngresoGasto',
      'Gasto',
      'Parametro',
      'Categoria',
      'ValorJUS',
      'RefreshToken',
      'UsuarioRol',
      'Usuario',
      'Permiso',
      'Rol',
      'Pais',
      'Provincia',
      'Localidad',
      'CodigoPostal',
    ];

    console.log(`📋 Tablas a truncar: ${tablas.length}`);
    console.log('');

    // Truncar todas las tablas con CASCADE (elimina dependencias) y RESTART IDENTITY (resetea IDs)
    // Primero desactivar temporalmente las restricciones de clave foránea
    await prisma.$executeRawUnsafe('SET session_replication_role = "replica";');
    console.log('✓ Restricciones de FK desactivadas temporalmente');
    
    // Truncar tablas individualmente con RESTART IDENTITY
    let truncadas = 0;
    for (const tabla of tablas) {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tabla}" RESTART IDENTITY CASCADE;`);
        console.log(`  ✓ ${tabla}: truncada y IDs reseteados`);
        truncadas++;
      } catch (error) {
        console.error(`  ✗ ${tabla}: ERROR - ${error.message}`);
      }
    }

    // Reactivar las restricciones de clave foránea
    await prisma.$executeRawUnsafe('SET session_replication_role = "origin";');
    console.log('✓ Restricciones de FK reactivadas');

    console.log('');
    console.log(`✅ ${truncadas} tablas truncadas exitosamente (IDs reseteados)`);
    console.log('');
    console.log('💡 Ejecuta los seeds para restaurar la parametría:');
    console.log('   node prisma/seedCategorias.js');
    console.log('   node prisma/seedParametros.js');
    console.log('   node prisma/seedValorJUS.js');
    console.log('   node prisma/seedUsuarioPermiso.js');
    console.log('   node prisma/seedUbicaciones.js');
  } catch (error) {
    console.error('❌ Error al truncar tablas:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

