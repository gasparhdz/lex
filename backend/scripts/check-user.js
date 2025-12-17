import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
const prisma = new PrismaClient();

async function main() {
  const email = 'gaspihenandez@gmail.com';
  const password = 'Pasgar96*';
  
  console.log(`🔍 Verificando usuario: ${email}`);
  
  const user = await prisma.usuario.findUnique({
    where: { email },
    include: {
      roles: {
        include: {
          rol: {
            include: {
              permisos: true
            }
          }
        }
      }
    }
  });
  
  if (!user) {
    console.log('❌ Usuario no encontrado');
    return;
  }
  
  console.log('✅ Usuario encontrado:');
  console.log(`  ID: ${user.id}`);
  console.log(`  Nombre: ${user.nombre} ${user.apellido}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Activo: ${user.activo}`);
  console.log(`  Password hash length: ${user.password.length}`);
  console.log(`  Roles: ${user.roles.length}`);
  
  console.log('\n🔐 Verificando password...');
  const isValid = await argon2.verify(user.password, password);
  console.log(`  Password válido: ${isValid ? '✅ SÍ' : '❌ NO'}`);
  
  if (isValid) {
    console.log('\n✅ LOGIN FUNCIONA');
  } else {
    console.log('\n❌ LOGIN NO FUNCIONA - Password incorrecto');
    console.log('\n💡 Actualizando password...');
    const newHash = await argon2.hash(password);
    await prisma.usuario.update({
      where: { id: user.id },
      data: { password: newHash }
    });
    console.log('✅ Password actualizado');
    
    console.log('\n🔐 Verificando nuevo password...');
    const updatedUser = await prisma.usuario.findUnique({ where: { id: user.id } });
    const isValidNow = await argon2.verify(updatedUser.password, password);
    console.log(`  Password válido: ${isValidNow ? '✅ SÍ' : '❌ NO'}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

