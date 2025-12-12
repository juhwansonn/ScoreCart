const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const utorid = 'cashier0';
  const email = 'cashier0@mail.utoronto.ca';
  const password = 'password123'; 

  try {
    const user = await prisma.user.create({
      data: {
        utorid,
        name: 'Cashier Zero',
        email,
        password, 
        role: 'cashier',
        points: 0,
        verified: true, 
        suspicious: false,
        createdAt: new Date(),
      },
    });
    console.log('Success! Created cashier:', user.utorid);
  } catch (e) {
    if (e.code === 'P2002') {
      console.error('Error: User with this utorid or email already exists.');
    } else {
      console.error(e);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();