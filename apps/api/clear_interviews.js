const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const result = await prisma.interview.deleteMany({});
  console.log('Deleted interviews:', result.count);
}
main().finally(() => prisma.$disconnect());
