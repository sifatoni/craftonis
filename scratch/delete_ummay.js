const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const candidates = await prisma.candidate.findMany({
      where: {
        OR: [
          { name: { contains: 'Ummay', mode: 'insensitive' } },
          { email: { contains: 'ummay', mode: 'insensitive' } }
        ]
      }
    });
    console.log(JSON.stringify(candidates, null, 2));
    
    if (candidates.length > 0) {
      for (const c of candidates) {
        // Delete related cvScore first if it exists
        await prisma.cvScore.deleteMany({ where: { candidateId: c.id } });
        await prisma.candidate.delete({ where: { id: c.id } });
        console.log(`Deleted candidate: ${c.name} (${c.id})`);
      }
    } else {
      console.log('No candidates found matching Ummay');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
