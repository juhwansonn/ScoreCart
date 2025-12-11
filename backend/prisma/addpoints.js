// this file is created for testing purposes only
// we are adding 5000 points to user named "admin2" 
// so admin2 can have enough points to transfer to other users


const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const targetUtorid = process.argv[2] || 'admin2'; // Default to admin2 if no name provided
const amountToAdd = 5000;

async function main() {
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { utorid: targetUtorid },
  });

  if (!user) {
    console.error(`Error: User '${targetUtorid}' not found.`);
    process.exit(1);
  }

  // Add the points
  const updatedUser = await prisma.user.update({
    where: { utorid: targetUtorid },
    data: { 
        points: { increment: amountToAdd } 
    },
  });

  console.log(`Added ${amountToAdd} points to ${updatedUser.utorid}.`);
  console.log(`New Balance: ${updatedUser.points}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });