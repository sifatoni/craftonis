const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const candidate = await prisma.candidate.findFirst({
    where: { email: 'anikaashrafi1010@gmail.com' }
  });
  if (candidate) {
    console.log('ID:', candidate.id);
    console.log('TenantID:', candidate.tenantId);
  } else {
    console.log('Candidate not found');
  }
}

main().finally(() => prisma.$disconnect());
