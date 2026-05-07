const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  const candidate = await prisma.candidate.findFirst();
  if (!candidate) return console.log("No candidate");
  
  await prisma.cvScore.upsert({
    where: { candidateId: candidate.id },
    create: {
      candidateId: candidate.id,
      parsedData: {
        name: 'Candidate',
        email: null,
        phone: null,
        totalYearsExperience: 3,
        skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
        experience: [],
        education: [{ level: 'BACHELOR' }],
        certifications: [],
      },
      skillMatch: 0,
      stability: 0,
      education: 0,
      totalScore: 0,
    },
    update: {}
  });
  console.log("Seeded");
  await prisma.$disconnect();
}
seed();
