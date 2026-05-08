import * as XLSX from 'xlsx'

export function generateCandidateTemplate(): Buffer {
  const wb = XLSX.utils.book_new()

  // Instructions sheet
  const instructions = [
    ['CRAFTONIS — CANDIDATE IMPORT TEMPLATE'],
    [''],
    ['INSTRUCTIONS:'],
    ['1. Fill in candidate details in the "Candidates" sheet'],
    ['2. CV Link column: paste a public Google Drive or Dropbox link to the candidate CV PDF'],
    ['3. Do not modify column headers'],
    ['4. Leave optional fields blank if not available'],
    ['5. Upload this file back to Craftonis when done'],
    [''],
    ['REQUIRED FIELDS: Full Name, Email'],
    ['OPTIONAL FIELDS: All others'],
  ]
  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions)
  wsInstructions['!cols'] = [{ wch: 80 }]
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions')

  // Candidates sheet with headers + sample row
  const headers = [
    'Full Name *',
    'Email *',
    'Phone',
    'LinkedIn URL',
    'CV Link (Google Drive/Dropbox public link)',
    'Current Company',
    'Current Role/Title',
    'Years of Experience',
    'Skills (comma separated)',
    'Location',
    'Notes',
  ]

  const sampleRow = [
    'Arif Hassan',
    'arif@example.com',
    '+8801712345678',
    'https://linkedin.com/in/arif-hassan',
    'https://drive.google.com/file/d/XXXX/view?usp=sharing',
    'Tech Company Ltd',
    'Senior Software Engineer',
    '5',
    'React, TypeScript, Node.js, PostgreSQL',
    'Dhaka, Bangladesh',
    'Referred by team',
  ]

  const data = [headers, sampleRow]
  const wsCandidates = XLSX.utils.aoa_to_sheet(data)

  // Column widths
  wsCandidates['!cols'] = [
    { wch: 20 }, { wch: 25 }, { wch: 18 }, { wch: 35 },
    { wch: 50 }, { wch: 25 }, { wch: 25 }, { wch: 10 },
    { wch: 40 }, { wch: 20 }, { wch: 30 },
  ]

  XLSX.utils.book_append_sheet(wb, wsCandidates, 'Candidates')

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

export function parseExcelCandidates(buffer: Buffer): any[] {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const ws = wb.Sheets['Candidates']
  if (!ws) throw new Error('Sheet "Candidates" not found in Excel file')

  const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
  if (rows.length < 2) return []

  // Skip header row, parse data rows
  return rows.slice(1)
    .filter((row) => row[0] || row[1]) // Must have name or email
    .map((row) => ({
      name: String(row[0] || '').trim(),
      email: String(row[1] || '').trim().toLowerCase(),
      phone: String(row[2] || '').trim() || undefined,
      linkedinUrl: String(row[3] || '').trim() || undefined,
      cvLink: String(row[4] || '').trim() || undefined,
      currentCompany: String(row[5] || '').trim() || undefined,
      currentRole: String(row[6] || '').trim() || undefined,
      yearsExperience: parseInt(String(row[7] || '0')) || 0,
      skills: String(row[8] || '').split(',').map((s: string) => s.trim()).filter(Boolean),
      location: String(row[9] || '').trim() || undefined,
      notes: String(row[10] || '').trim() || undefined,
    }))
    .filter((c) => c.name && c.email) // Both required
}
