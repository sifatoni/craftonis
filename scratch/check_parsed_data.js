const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const candidate = await prisma.candidate.findFirst({
    where: { email: 'anikaashrafi1010@gmail.com' },
    include: { cvScore: true }
  });
  if (candidate && candidate.cvScore) {
    console.log('Parsed Data:', JSON.stringify(candidate.cvScore.parsedData, null, 2));
  } else {
    console.log('Candidate or CV score not found');
  }
}

main().finally(() => prisma.$disconnect());
