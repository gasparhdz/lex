import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
const prisma = new PrismaClient();

async function main() {
  const email1 = 'gaspihenandez@gmail.com'; // con 'e'
  const email2 = 'gaspihernandez@gmail.com'; // sin 'e'
  const password = 'Pasgar96*';
  
  console.log(`🔍 Verificando: ${email1}`);
  const user1 = await prisma.usuario.findUnique({ where: { email: email1 } });
  if (user1) {
    console.log('✅ Existe');
    const valid = await argon2.verify(user1.password, password);
    console.log(`  Password válido: ${valid ? '✅' : '❌'}`);
  } else {
    console.log('❌ No existe');
  }
  
  console.log(`\n🔍 Verificando: ${email2}`);
  const user2 = await prisma.usuario.findUnique({ where: { email: email2 } });
  if (user2) {
    console.log('✅ Existe');
    const valid = await argon2.verify(user2.password, password);
    console.log(`  Password válido: ${valid ? '✅' : '❌'}`);
  } else {
    console.log('❌ No existe');
  }
  
  console.log('\n📊 Todos los usuarios:');
  const all = await prisma.usuario.findMany();
  all.forEach(u => console.log(`  ${u.email}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

