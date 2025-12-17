import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function ensureParam(categoriaId, codigo, nombre, orden) {
  const existing = await prisma.parametro.findFirst({
    where: { categoriaId, codigo }
  });
  if (!existing) {
    await prisma.parametro.create({
      data: { categoriaId, codigo, nombre, orden }
    });
  }
}

async function main() {
  console.log('📍 Iniciando seed de ubicaciones...');

  // 1. PAIS
  const argentina = await prisma.pais.upsert({
    where: { codigoIso: 'AR' },
    update: {},
    create: { nombre: 'Argentina', codigoIso: 'AR' }
  });
  console.log('✅ País Argentina creado (ID: ' + argentina.id + ')');

  // 2. PROVINCIA
  const santaFe = await prisma.provincia.upsert({
    where: { id: 1 },
    update: { nombre: 'Santa Fe', paisId: argentina.id },
    create: { id: 1, nombre: 'Santa Fe', paisId: argentina.id }
  });
  console.log('✅ Provincia Santa Fe creada (ID: ' + santaFe.id + ')');

  // 3. LOCALIDADES
  const localidades = [
    { id: 1, nombre: 'Aldao', provinciaId: 1 },
    { id: 2, nombre: 'Andino', provinciaId: 1 },
    { id: 3, nombre: 'Bustinza', provinciaId: 1 },
    { id: 4, nombre: 'Cañada de Gomez', provinciaId: 1 },
    { id: 5, nombre: 'Carrizales', provinciaId: 1 },
    { id: 6, nombre: 'Lucio V. Lopez', provinciaId: 1 },
    { id: 7, nombre: 'Rosario', provinciaId: 1 },
    { id: 8, nombre: 'Salto Grande', provinciaId: 1 },
    { id: 9, nombre: 'San Lorenzo', provinciaId: 1 },
    { id: 10, nombre: 'Santa Fé', provinciaId: 1 },
    { id: 11, nombre: 'Serodino', provinciaId: 1 },
    { id: 12, nombre: 'Totoras', provinciaId: 1 },
  ];

  for (const loc of localidades) {
    await prisma.localidad.upsert({
      where: { id: loc.id },
      update: { nombre: loc.nombre, provinciaId: loc.provinciaId },
      create: { id: loc.id, nombre: loc.nombre, provinciaId: loc.provinciaId }
    });
  }
  console.log(`✅ ${localidades.length} localidades creadas`);

  // 4. CÓDIGOS POSTALES
  const codigosPostales = [
    { id: 1, codigo: '2214', localidadId: 1 },
    { id: 2, codigo: '2214', localidadId: 2 },
    { id: 3, codigo: '2501', localidadId: 3 },
    { id: 4, codigo: '2500', localidadId: 4 },
    { id: 5, codigo: '2218', localidadId: 5 },
    { id: 6, codigo: '2142', localidadId: 6 },
    { id: 7, codigo: '2000', localidadId: 7 },
    { id: 8, codigo: '2142', localidadId: 8 },
    { id: 9, codigo: '2200', localidadId: 9 },
    { id: 10, codigo: '3000', localidadId: 10 },
    { id: 11, codigo: '2216', localidadId: 11 },
    { id: 12, codigo: '2144', localidadId: 12 },
  ];

  for (const cp of codigosPostales) {
    await prisma.codigoPostal.upsert({
      where: { id: cp.id },
      update: { codigo: cp.codigo, localidadId: cp.localidadId },
      create: { id: cp.id, codigo: cp.codigo, localidadId: cp.localidadId }
    });
  }
  console.log(`✅ ${codigosPostales.length} códigos postales creados`);

  console.log('🎉 Seed de ubicaciones completado');
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

