const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const candidate = await prisma.candidate.findFirst({
    where: { email: 'anikaashrafi1010@gmail.com' }
  });
  console.log(JSON.stringify(candidate, null, 2));
}

main().finally(() => prisma.$disconnect());
