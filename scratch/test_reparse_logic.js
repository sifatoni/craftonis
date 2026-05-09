const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const pdfParseLib = require('pdf-parse');
const pdfParse = pdfParseLib.default || pdfParseLib;

// Simulation of the updated CvService logic
async function extractCvDataSim(cvText, basicInfo) {
  // Mock AI data (since we can't call external API easily here without keys)
  // But wait, I can use the environment keys!
  const aiData = {
    name: 'null',
    skills: [],
    experience: [],
    education: [],
    languages: [],
    achievements: [],
    personalDetails: {}
  };

  console.log('--- Simulation of Merge Logic ---');
  console.log('Regex extracted name:', basicInfo.name);
  console.log('AI data name:', aiData.name);

  const merged = {
    name: (aiData.name && aiData.name !== 'null') ? aiData.name : basicInfo.name,
    email: (aiData.email && aiData.email?.includes('@')) ? aiData.email : basicInfo.email,
    phone: (aiData.phone && aiData.phone !== 'null') ? aiData.phone : basicInfo.phone,
    skills: (aiData.skills && aiData.skills.length > 0) ? aiData.skills : basicInfo.skills,
    experience: (aiData.experience && aiData.experience.length > 0) ? aiData.experience : basicInfo.experience,
    education: (aiData.education && aiData.education.length > 0) ? aiData.education : basicInfo.education,
    languages: (aiData.languages && aiData.languages.length > 0) ? aiData.languages : basicInfo.languages,
    achievements: (aiData.achievements && aiData.achievements.length > 0) ? aiData.achievements : basicInfo.achievements,
    totalYearsExperience: aiData.totalYearsExperience || basicInfo.totalYearsExperience || 0,
    currentRole: aiData.currentRole || basicInfo.currentRole || null,
    currentCompany: aiData.currentCompany || basicInfo.currentCompany || null,
    personalDetails: (aiData.personalDetails && Object.values(aiData.personalDetails).some(v => v)) 
        ? aiData.personalDetails 
        : basicInfo.personalDetails,
  };

  console.log('Merged Name:', merged.name);
  console.log('Merged Skills Count:', merged.skills.length);
  return merged;
}

async function main() {
  const candidateId = '4bef1402-55ec-4e3c-ba9e-e1a5543e3307';
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId }
  });

  if (!candidate || !candidate.cvUrl) {
    console.log('Candidate or CV not found');
    return;
  }

  const base64Data = candidate.cvUrl.replace('data:application/pdf;base64,', '');
  const buffer = Buffer.from(base64Data, 'base64');
  const parsed = await pdfParse(buffer);
  const cvText = parsed.text;

  // Extract basic info via regex (same logic as in cv.service.ts)
  const lines = cvText.split('\n').map(l => l.trim()).filter(Boolean);
  const basicInfo = {
    name: lines[0] || null,
    email: cvText.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/)?.[0] || null,
    skills: ['Skill 1', 'Skill 2'], // Mocked for brevity
    experience: [{ role: 'Developer', company: 'Tech' }],
    education: [],
    languages: ['Bangla', 'English'],
    achievements: [],
    totalYearsExperience: 1,
    currentRole: 'Developer',
    currentCompany: 'Tech',
    personalDetails: { fatherName: 'Father' }
  };

  await extractCvDataSim(cvText, basicInfo);
}

main().finally(() => prisma.$disconnect());
