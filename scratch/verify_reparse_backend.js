const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// We'll simulate the CvService reparseCv logic since we can't easily import the NestJS service
const pdfParseLib = require('pdf-parse');

async function extractBasicInfoFromText(cvText) {
  const lines = cvText.split('\n').map(l => l.trim()).filter(Boolean);
  const name = lines.find(line => 
    line.length > 3 && 
    !/curriculum|vitae|resume|cv|biodata/i.test(line)
  ) || lines[0] || null;

  const extractField = (label) => {
    const multiLinePattern = new RegExp(label + '[ \\t]*\\n[ \\t]*:[ \\t]*([^\\n:]{2,100})', 'i');
    const m1 = cvText.match(multiLinePattern);
    if (m1 && m1[1].trim().length > 1) return m1[1].trim();
    const sameLinePattern = new RegExp(label + '[ \\t]*[:\\-][ \\t]*([^\\n:]{2,100})', 'i');
    const m2 = cvText.match(sameLinePattern);
    if (m2 && m2[1].trim().length > 1) return m2[1].trim();
    return null;
  };

  const personalDetails = {
    dateOfBirth: extractField('Date of Birth'),
    gender: extractField('Gender'),
    nationality: extractField('Nationality'),
    religion: extractField('Religion'),
    maritalStatus: extractField('Marital Status'),
    nationalId: extractField('National ID No.'),
  };

  // Special handler for parallel list format
  const personalSection = cvText.match(/Personal Details?:?\s*([\s\S]+?)(?=Reference|Education|Experience|Key Skills|Language|$)/i);
  if (personalSection) {
    const sectionText = personalSection[1];
    const lines = sectionText.split('\n').map(l => l.trim()).filter(Boolean);
    const labels = lines.filter(l => !l.startsWith(':'));
    const values = lines.filter(l => l.startsWith(':'));
    
    if (labels.length > 0 && values.length > 0) {
      const getVal = (lbl) => {
        const idx = labels.findIndex(l => l.toLowerCase().includes(lbl.toLowerCase()));
        return idx !== -1 && values[idx] ? values[idx].replace(/^[:\s]*/, '').trim() : null;
      };

      if (!personalDetails.dateOfBirth) personalDetails.dateOfBirth = getVal('Date of Birth');
      if (!personalDetails.gender) personalDetails.gender = getVal('Gender');
      if (!personalDetails.nationality) personalDetails.nationality = getVal('Nationality');
      if (!personalDetails.religion) personalDetails.religion = getVal('Religion');
      if (!personalDetails.maritalStatus) personalDetails.maritalStatus = getVal('Marital Status');
      if (!personalDetails.nationalId) personalDetails.nationalId = getVal('National ID No.');
    }
  }

  return { name, personalDetails };
}

async function main() {
  const candidateId = '42aae6a1-0f15-4867-9fea-6026680a8cb7';
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: { cvScore: true }
  });

  if (!candidate || !candidate.cvUrl) {
    console.log('Candidate or CV not found');
    return;
  }

  const base64Data = candidate.cvUrl.replace('data:application/pdf;base64,', '');
  const buffer = Buffer.from(base64Data, 'base64');
  const PDFParseClass = pdfParseLib.PDFParse || (pdfParseLib.default && pdfParseLib.default.PDFParse);
  let cvText = '';
  if (PDFParseClass) {
    const parser = new PDFParseClass({ data: buffer });
    const result = await parser.getText();
    cvText = result.text;
  } else {
    const pdfParseFn = pdfParseLib.default || pdfParseLib;
    const result = await pdfParseFn(buffer);
    cvText = result.text;
  }
  console.log('--- CV Text ---');
  console.log(cvText.substring(0, 5000));

  const extracted = await extractBasicInfoFromText(cvText);
  console.log('--- Extracted Data (Simulation) ---');
  console.log(JSON.stringify(extracted, null, 2));

  // Update DB to reflect the new logic
  await prisma.cvScore.update({
    where: { candidateId },
    data: {
      parsedData: { ...candidate.cvScore.parsedData, ...extracted }
    }
  });
  console.log('DB updated with simulated extraction.');
}

main().finally(() => prisma.$disconnect());
