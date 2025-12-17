import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Iniciando seed de valores JUS...');

  const valores = [
    { id: 1, valor: 28615, fecha: '2023-07-01' },
    { id: 2, valor: 32048.81, fecha: '2023-08-01' },
    { id: 3, valor: 35253.69, fecha: '2023-09-01' },
    { id: 4, valor: 38602.79, fecha: '2023-10-01' },
    { id: 5, valor: 42463.07, fecha: '2023-11-01' },
    { id: 6, valor: 47770.95, fecha: '2023-12-01' },
    { id: 7, valor: 56369.72, fecha: '2024-01-01' },
    { id: 8, valor: 63134.09, fecha: '2024-02-01' },
    { id: 9, valor: 68184.82, fecha: '2024-03-01' },
    { id: 10, valor: 72957.75, fecha: '2024-04-01' },
    { id: 11, valor: 76021.98, fecha: '2024-05-01' },
    { id: 12, valor: 79214.90, fecha: '2024-06-01' },
    { id: 13, valor: 81987.42, fecha: '2024-07-01' },
    { id: 14, valor: 84447.05, fecha: '2024-08-01' },
    { id: 15, valor: 86135.99, fecha: '2024-09-01' },
    { id: 16, valor: 88289.39, fecha: '2024-10-01' },
    { id: 17, valor: 90496.62, fecha: '2024-11-01' },
    { id: 18, valor: 92306.55, fecha: '2024-12-01' },
    { id: 19, valor: 93968.07, fecha: '2025-01-01' },
    { id: 20, valor: 95847.43, fecha: '2025-02-01' },
    { id: 21, valor: 98243.62, fecha: '2025-03-01' },
    { id: 22, valor: 100404.98, fecha: '2025-04-01' },
    { id: 23, valor: 101710.24, fecha: '2025-05-01' },
    { id: 24, valor: 103337.61, fecha: '2025-06-01' },
    { id: 25, valor: 105301.02, fecha: '2025-07-01' },
    { id: 26, valor: 107301.74, fecha: '2025-08-01' },
  ];

  console.log(`📊 Cargando ${valores.length} valores JUS...`);

  for (const v of valores) {
    await prisma.valorJUS.upsert({
      where: { fecha: new Date(v.fecha) },
      update: { 
        valor: v.valor,
        activo: true,
        updatedAt: new Date(),
        updatedBy: 1
      },
      create: {
        id: v.id,
        valor: v.valor,
        fecha: new Date(v.fecha),
        activo: true,
        createdBy: 1,
        updatedBy: 1
      }
    });
    console.log(`  ✓ ${v.fecha}: $${v.valor.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  }

  // Actualizar la secuencia de PostgreSQL para que el próximo ID sea mayor que el máximo ID existente
  const maxId = Math.max(...valores.map(v => v.id));
  await prisma.$executeRawUnsafe(`SELECT setval('"ValorJUS_id_seq"', ${maxId}, true);`);
  console.log(`🔄 Secuencia actualizada: próximo ID será ${maxId + 1}`);

  console.log(`✅ ${valores.length} valores JUS cargados exitosamente`);
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

