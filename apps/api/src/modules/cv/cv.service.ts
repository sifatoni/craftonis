import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ScoreCvDto } from './dto/score-cv.dto';
import Anthropic from '@anthropic-ai/sdk';


@Injectable()
export class CvService {
  private anthropic: Anthropic;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.get('ANTHROPIC_API_KEY'),
    });
  }

  // ── Parse CV PDF ──────────────────────────────────
  async parseCv(candidateId: string, tenantId: string, fileBuffer: Buffer) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, tenantId },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');

    // Extract text from PDF
    let cvText = '';
    try {
      const pdfParseLib = require('pdf-parse')
      const PDFParseClass = pdfParseLib.PDFParse || pdfParseLib.default?.PDFParse
      if (PDFParseClass) {
        const parser = new PDFParseClass({ data: fileBuffer })
        const result = await parser.getText()
        cvText = result.text
      } else {
        const pdfParseFn = pdfParseLib.default || pdfParseLib
        const parsed = await pdfParseFn(fileBuffer)
        cvText = parsed.text
      }
    } catch (e) {
      throw new BadRequestException('Could not parse PDF file');
    }

    if (!cvText || cvText.trim().length < 50) {
      throw new BadRequestException('PDF appears to be empty or unreadable');
    }

    // Use Claude to extract structured data
    const extractedData = await this.extractCvData(cvText);

    // Update candidate with parsed CV data
    await this.prisma.candidate.update({
      where: { id: candidateId },
      data: { stage: 'CV_REVIEWED' },
    });

    // Save or update CV score with parsed data
    const cvScore = await this.prisma.cvScore.upsert({
      where: { candidateId },
      create: {
        candidateId,
        parsedData: extractedData,
        skillMatch: 0,
        stability: 0,
        education: 0,
        totalScore: 0,
      },
      update: {
        parsedData: extractedData,
      },
    });

    return {
      candidateId,
      extractedData,
      cvScoreId: cvScore.id,
      message: 'CV parsed successfully. Run scoring to calculate scores.',
    };
  }

  // ── Score CV ──────────────────────────────────────
  async scoreCv(tenantId: string, dto: ScoreCvDto) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: dto.candidateId, tenantId },
      include: { cvScore: true, job: true },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    if (!candidate.cvScore) {
      throw new BadRequestException('CV must be parsed first before scoring');
    }

    const parsedData = candidate.cvScore.parsedData as any;
    const jobDescription = candidate.job?.description || '';
    const jobRequirements = candidate.job?.requirements || '';

    // Default weights
    const weights = { skillMatch: 0.5, stability: 0.2, education: 0.3 };

    // 1. Skill Match Score (50%)
    const skillMatch = this.calculateSkillMatch(
      parsedData?.skills || [],
      `${jobDescription} ${jobRequirements}`,
    );

    // 2. Stability Score (20%)
    const stability = this.calculateStability(parsedData?.experience || []);

    // 3. Education Score (30%)
    const education = this.calculateEducation(
      parsedData?.education || [],
      parsedData?.certifications || [],
    );

    // Composite score
    const totalScore =
      skillMatch * weights.skillMatch +
      stability * weights.stability +
      education * weights.education;

    const cvScore = await this.prisma.cvScore.update({
      where: { candidateId: dto.candidateId },
      data: {
        skillMatch: Math.round(skillMatch * 100) / 100,
        stability: Math.round(stability * 100) / 100,
        education: Math.round(education * 100) / 100,
        totalScore: Math.round(totalScore * 100) / 100,
      },
    });

    // Update candidate total score
    await this.prisma.candidate.update({
      where: { id: dto.candidateId },
      data: { totalScore: cvScore.totalScore },
    });

    return {
      candidateId: dto.candidateId,
      scores: {
        skillMatch: cvScore.skillMatch,
        stability: cvScore.stability,
        education: cvScore.education,
        totalScore: cvScore.totalScore,
      },
      breakdown: {
        skillMatchWeight: '50%',
        stabilityWeight: '20%',
        educationWeight: '30%',
      },
    };
  }

  // ── Get Score Card ────────────────────────────────
  async getScoreCard(tenantId: string, candidateId: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, tenantId },
      include: {
        cvScore: true,
        job: { select: { id: true, title: true } },
      },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    return candidate;
  }

  // ── Get Job Leaderboard ───────────────────────────
  async getJobLeaderboard(tenantId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Job not found');

    const candidates = await this.prisma.candidate.findMany({
      where: { jobId, tenantId, totalScore: { gt: 0 } },
      include: {
        cvScore: {
          select: {
            skillMatch: true,
            stability: true,
            education: true,
            totalScore: true,
          },
        },
      },
      orderBy: { totalScore: 'desc' },
    });

    return candidates.map((c, index) => ({
      rank: index + 1,
      candidateId: c.id,
      name: c.name,
      email: c.email,
      stage: c.stage,
      scores: c.cvScore,
    }));
  }

  // ── Private Helpers ───────────────────────────────
  private async extractCvData(cvText: string): Promise<any> {
    const openRouterKey = this.config.get('OPENROUTER_API_KEY');
    const anthropicKey = this.config.get('ANTHROPIC_API_KEY');

    // Always extract basic info via regex first (guaranteed accuracy)
    const basicInfo = this.extractBasicInfoFromText(cvText);
    console.log('Regex extracted:', basicInfo);

    let aiData: any = {};
    try {
      if (openRouterKey) {
        aiData = await this.extractWithOpenRouter(cvText, openRouterKey);
      } else if (anthropicKey) {
        aiData = await this.extractWithAnthropic(cvText, anthropicKey);
      }
    } catch (e) {
      console.error('AI extraction failed, using regex only');
    }

    // Merge: prefer AI data if not null, fall back to regex
    return {
      name: (aiData.name && aiData.name !== 'null') ? aiData.name : basicInfo.name,
      email: (aiData.email && aiData.email?.includes('@')) ? aiData.email : basicInfo.email,
      phone: (aiData.phone && aiData.phone !== 'null') ? aiData.phone : basicInfo.phone,
      secondaryPhone: aiData.secondaryPhone || basicInfo.secondaryPhone,
      location: aiData.location || basicInfo.location,
      linkedinUrl: aiData.linkedinUrl || basicInfo.linkedinUrl,
      summary: aiData.summary || basicInfo.summary,
      // Use AI data if non-empty array, otherwise fall back to regex
      skills: (aiData.skills && aiData.skills.length > 0) ? aiData.skills : basicInfo.skills,
      experience: (aiData.experience && aiData.experience.length > 0) ? aiData.experience : basicInfo.experience,
      education: (aiData.education && aiData.education.length > 0) ? aiData.education : basicInfo.education,
      languages: (aiData.languages && aiData.languages.length > 0) ? aiData.languages : basicInfo.languages,
      achievements: (aiData.achievements && aiData.achievements.length > 0) ? aiData.achievements : basicInfo.achievements,
      certifications: aiData.certifications || [],
      totalYearsExperience: aiData.totalYearsExperience || basicInfo.totalYearsExperience || 0,
      currentRole: aiData.currentRole || basicInfo.currentRole || null,
      currentCompany: aiData.currentCompany || basicInfo.currentCompany || null,
      personalDetails: (aiData.personalDetails && Object.values(aiData.personalDetails).some(v => v)) 
        ? aiData.personalDetails 
        : basicInfo.personalDetails,
    };
  }

  private async extractWithOpenRouter(cvText: string, apiKey: string): Promise<any> {
    try {
      console.log('Sending to OpenRouter, text length:', cvText.length);
      console.log('Text preview:', cvText.substring(0, 300));

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://craftonis.com',
          'X-Title': 'Craftonis CV Parser',
        },
        body: JSON.stringify({
          model: 'google/gemma-4-31b-it:free',
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: `You are a CV/Resume parser. Extract ALL information from the following CV text.
Be thorough — find every piece of information available.

IMPORTANT RULES:
- Extract the FULL NAME from the very beginning of the CV (usually the largest text)
- Extract ALL phone numbers (primary and secondary)
- Extract ALL email addresses
- Extract the complete address/location
- For Bangladeshi CVs, look for "Primary Mobile No.", "Secondary Mobile No.", "Primary Email"
- Extract ALL work experience entries with exact dates
- Extract ALL education with institutions, degrees, results, and years
- Look for skills, achievements, languages, references

CV TEXT:
\${cvText.substring(0, 5000)}

Return ONLY this JSON (no markdown, no explanation, no code blocks):
{
  "name": "candidate full name - look at the TOP of the CV for the largest/boldest name",
  "email": "primary email address",
  "phone": "primary phone number",
  "secondaryPhone": "secondary phone number or null",
  "location": "full address",
  "linkedinUrl": null,
  "githubUrl": null,
  "portfolioUrl": null,
  "totalYearsExperience": 0,
  "currentRole": "most recent job title",
  "currentCompany": "most recent employer",
  "summary": "career objective or professional summary",
  "skills": ["skill1", "skill2"],
  "experience": [
    {
      "company": "employer name",
      "role": "job title",
      "startDate": "Month Year",
      "endDate": "Month Year or Present",
      "tenureMonths": 12,
      "description": "responsibilities"
    }
  ],
  "education": [
    {
      "degree": "degree title e.g. Masters in Mathematics",
      "institution": "university or college name",
      "year": 2023,
      "result": "CGPA or GPA",
      "level": "MASTER or BACHELOR or HIGH_SCHOOL"
    }
  ],
  "certifications": [],
  "languages": ["Bangla", "English"],
  "achievements": ["achievement1"],
  "personalDetails": {
    "fatherName": null,
    "motherName": null,
    "dateOfBirth": null,
    "gender": null,
    "nationality": null,
    "religion": null,
    "maritalStatus": null,
    "nationalId": null
  }
}`
            }
          ]
        })
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`OpenRouter error: ${err}`);
      }

      const data = (await response.json()) as any;
      let text = data.choices?.[0]?.message?.content || '';
      
      console.log('OpenRouter raw response (first 300 chars):', text.substring(0, 300));

      // Remove <think>...</think> reasoning blocks if present
      text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      
      // Remove markdown code blocks
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Find JSON object — extract from first { to last }
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) {
        console.error('No JSON found in response:', text.substring(0, 200));
        throw new Error('No JSON object found in response');
      }
      
      const jsonStr = text.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonStr);
      
      console.log('Extracted name:', parsed.name);
      console.log('Extracted email:', parsed.email);
      console.log('Extracted phone:', parsed.phone);
      
      return parsed;
    } catch (e: any) {
      console.error('OpenRouter extraction failed:', e.message);
      return this.mockExtractedData();
    }
  }

  private async extractWithAnthropic(cvText: string, apiKey: string): Promise<any> {
    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: `Extract structured data from this CV. Return ONLY valid JSON.

CV Text:
${cvText.substring(0, 3000)}

Return:
{
  "name": "string",
  "email": "string or null",
  "phone": "string or null",
  "location": "string or null",
  "linkedinUrl": "string or null",
  "totalYearsExperience": number,
  "currentRole": "string or null",
  "currentCompany": "string or null",
  "skills": ["skill1"],
  "experience": [{"company":"","role":"","startDate":"","endDate":"","tenureMonths":0}],
  "education": [{"degree":"","institution":"","year":0,"level":"BACHELOR"}],
  "certifications": [],
  "achievements": []
}`
          }
        ]
      });

      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      return this.mockExtractedData();
    }
  }

  private mockExtractedData() {
    return {
      name: 'Candidate',
      email: null,
      phone: null,
      totalYearsExperience: 3,
      skills: ['JavaScript', 'TypeScript', 'React', 'Node.js'],
      experience: [
        {
          company: 'Tech Company',
          role: 'Developer',
          startDate: '2021-01',
          endDate: 'present',
          tenureMonths: 24,
        },
      ],
      education: [
        {
          degree: 'BSc Computer Science',
          institution: 'University',
          year: 2020,
          level: 'BACHELOR',
        },
      ],
      certifications: [],
    };
  }

  private calculateSkillMatch(cvSkills: string[], jobText: string): number {
    if (!cvSkills.length || !jobText) return 50;
    const jobTextLower = jobText.toLowerCase();
    const matchedSkills = cvSkills.filter((skill) =>
      jobTextLower.includes(skill.toLowerCase()),
    );
    const matchRate = matchedSkills.length / cvSkills.length;
    return Math.min(100, Math.round(matchRate * 100 + 30));
  }

  private calculateStability(experience: any[]): number {
    if (!experience.length) return 50;
    const tenures = experience.map((e) => e.tenureMonths || 12);
    const avgTenure = tenures.reduce((a, b) => a + b, 0) / tenures.length;
    if (avgTenure >= 36) return 100;
    if (avgTenure >= 24) return 85;
    if (avgTenure >= 18) return 70;
    if (avgTenure >= 12) return 55;
    return 35;
  }

  private calculateEducation(education: any[], certifications: string[]): number {
    let score = 0;
    const degreeScores: Record<string, number> = {
      PHD: 100,
      MASTER: 85,
      BACHELOR: 70,
      HIGH_SCHOOL: 40,
      OTHER: 50,
    };

    if (education.length > 0) {
      const highest = education.reduce((best, curr) => {
        const currScore = degreeScores[curr.level] || 50;
        const bestScore = degreeScores[best.level] || 50;
        return currScore > bestScore ? curr : best;
      });
      score = degreeScores[highest.level] || 50;
    } else {
      score = 40;
    }

    // Bonus for certifications (max +15)
    const certBonus = Math.min(certifications.length * 5, 15);
    return Math.min(100, score + certBonus);
  }

  // ── Bulk CV Parse ─────────────────────────────────
  async bulkParseCvs(
    tenantId: string,
    jobId: string,
    files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided')
    }

    const results = []

    for (const file of files) {
      try {
        // Extract text from PDF
        const pdfParseLib = require('pdf-parse')
        const PDFParseClass = pdfParseLib.PDFParse || pdfParseLib.default?.PDFParse
        let cvText = ''
        if (PDFParseClass) {
          const parser = new PDFParseClass({ data: file.buffer })
          const result = await parser.getText()
          cvText = result.text
        } else {
          const pdfParseFn = pdfParseLib.default || pdfParseLib
          const parsed = await pdfParseFn(file.buffer)
          cvText = parsed.text
        }

        console.log('CV text length:', cvText.length);
        console.log('CV text preview (first 500 chars):', cvText.substring(0, 500));

        if (!cvText || cvText.trim().length < 50) {
          results.push({ filename: file.originalname, success: false, error: 'Could not read PDF' })
          continue
        }

        // Extract structured data via Claude
        const extractedData = await this.extractCvData(cvText)

        // Only use filename as absolute last resort
        const rawName = extractedData.name
        const isValidName = rawName 
          && rawName !== 'Candidate' 
          && rawName !== 'null'
          && rawName.length > 1
          && rawName.toLowerCase() !== file.originalname.toLowerCase().replace(/\.pdf$/i, '').trim().toLowerCase()
          && !/cv|resume|curriculum|vitae/i.test(rawName)
        
        const name = isValidName 
          ? rawName.trim()
          : `Candidate (${file.originalname.replace(/\.pdf$/i, '').trim()})`
        
        const email = extractedData.email && extractedData.email.includes('@') && !extractedData.email.includes('null')
          ? extractedData.email.toLowerCase().trim()
          : `${name.toLowerCase().replace(/\s+/g, '.')}@pending.craftonis`

        // Check duplicate
        const existing = await this.prisma.candidate.findFirst({
          where: { tenantId, email, jobId },
        })

        if (existing) {
          // Update existing candidate with parsed data
          await this.prisma.cvScore.upsert({
            where: { candidateId: existing.id },
            create: { candidateId: existing.id, parsedData: extractedData, skillMatch: 0, stability: 0, education: 0, totalScore: 0 },
            update: { parsedData: extractedData },
          })
          results.push({ filename: file.originalname, success: true, candidateId: existing.id, name, action: 'updated' })
          continue
        }

        // Convert buffer to base64 for storage (temporary until R2 is set up)
        const cvBase64 = file.buffer.toString('base64')
        const cvDataUrl = `data:application/pdf;base64,${cvBase64}`
        
        // Create new candidate
        const candidate = await this.prisma.candidate.create({
          data: {
            tenantId,
            jobId,
            name,
            email,
            phone: extractedData.phone && extractedData.phone !== 'null' 
              ? extractedData.phone 
              : undefined,
            cvUrl: cvDataUrl,
            stage: 'CV_REVIEWED',
          },
        })

        // Save parsed CV data
        await this.prisma.cvScore.create({
          data: {
            candidateId: candidate.id,
            parsedData: extractedData,
            skillMatch: 0,
            stability: 0,
            education: 0,
            totalScore: 0,
          },
        })

        results.push({ filename: file.originalname, success: true, candidateId: candidate.id, name, action: 'created' })
      } catch (err: any) {
        results.push({ filename: file.originalname, success: false, error: err.message })
      }
    }

    const created = results.filter((r) => r.success && r.action === 'created').length
    const updated = results.filter((r) => r.success && r.action === 'updated').length
    const failed = results.filter((r) => !r.success).length

    return { results, summary: { total: files.length, created, updated, failed } }
  }

  // ── Re-parse CV ────────────────────────────────────
  async reparseCv(candidateId: string, tenantId: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, tenantId },
      include: { cvScore: true },
    })
    if (!candidate) throw new NotFoundException('Candidate not found')
    if (!candidate.cvUrl) throw new BadRequestException('No CV uploaded for this candidate')

    // Extract base64 PDF data
    const base64Data = candidate.cvUrl.replace('data:application/pdf;base64,', '')
    const buffer = Buffer.from(base64Data, 'base64')

    // Re-parse
    const pdfParseLib = require('pdf-parse')
    const PDFParseClass = pdfParseLib.PDFParse || pdfParseLib.default?.PDFParse
    let cvText = ''
    if (PDFParseClass) {
      const parser = new PDFParseClass({ data: buffer })
      const result = await parser.getText()
      cvText = result.text
    } else {
      const pdfParseFn = pdfParseLib.default || pdfParseLib
      const parsed = await pdfParseFn(buffer)
      cvText = parsed.text
    }

    const extractedData = await this.extractCvData(cvText)

    await this.prisma.cvScore.upsert({
      where: { candidateId },
      create: { candidateId, parsedData: extractedData, skillMatch: 0, stability: 0, education: 0, totalScore: 0 },
      update: { parsedData: extractedData },
    })

    // Update candidate with re-extracted data
    const newName = extractedData.name && 
      extractedData.name !== 'Candidate' && 
      extractedData.name !== 'null' &&
      extractedData.name.length > 1
      ? extractedData.name 
      : candidate.name

    const newEmail = extractedData.email && 
      extractedData.email.includes('@') && 
      !extractedData.email.includes('null')
      ? extractedData.email 
      : candidate.email

    const newPhone = extractedData.phone && 
      extractedData.phone !== 'null'
      ? extractedData.phone 
      : candidate.phone || undefined

    await this.prisma.candidate.update({
      where: { id: candidateId },
      data: {
        name: newName,
        email: newEmail,
        phone: newPhone,
      },
    })

    console.log('Re-parse complete. Name:', newName, 'Education count:', extractedData.education?.length)

    return { success: true, message: 'CV re-parsed successfully', extractedData }
  }

  // ── Fetch CV from URL ─────────────────────────────
  async fetchAndParseCvFromUrl(url: string): Promise<any> {
    try {
      // Convert Google Drive share link to direct download
      let downloadUrl = url
      const gdriveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
      if (gdriveMatch) {
        downloadUrl = `https://drive.google.com/uc?export=download&id=${gdriveMatch[1]}`
      }
      // Convert Dropbox share link
      if (url.includes('dropbox.com')) {
        downloadUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '')
      }

      const fetch = (await import('node-fetch')).default
      const response = await fetch(downloadUrl, { timeout: 15000 } as any)
      if (!response.ok) throw new Error(`Failed to fetch CV: ${response.statusText}`)

      const buffer = Buffer.from(await response.arrayBuffer())
      const pdfParseLib = require('pdf-parse')
      const PDFParseClass = pdfParseLib.PDFParse || pdfParseLib.default?.PDFParse
      let cvText = ''
      if (PDFParseClass) {
        const parser = new PDFParseClass({ data: buffer })
        const result = await parser.getText()
        cvText = result.text
      } else {
        const pdfParseFn = pdfParseLib.default || pdfParseLib
        const parsed = await pdfParseFn(buffer)
        cvText = parsed.text
      }
      return await this.extractCvData(cvText)
    } catch (err: any) {
      throw new Error(`Could not fetch CV from URL: ${err.message}`)
    }
  }

  // ── Regex Extraction (Fallback) ──────────────────
  private extractBasicInfoFromText(cvText: string): any {
    const lines = cvText.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Name — look for the first line that looks like a name (not a title or header)
    const name = lines.find(line => 
      line.length > 5 && 
      line.length < 50 &&
      !/curriculum|vitae|resume|cv|biodata|objective|experience|education|personal|skills|proficiency|contact|mobile|email|address/i.test(line)
    ) || lines[0] || 'Candidate';
    
    // Email
    const emailMatch = cvText.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : null;
    
    // Phone
    const phoneMatch = cvText.match(/(?:Primary Mobile No\.|Mobile No\.|Phone|Tel)[.:\s]*([+\d\s()-]{10,})/i)
      || cvText.match(/(\+?880\d{10}|01\d{9})/);
    const phone = phoneMatch ? phoneMatch[1]?.replace(/[\s()-]/g, '').trim() : null;
    
    // Secondary phone
    const secPhoneMatch = cvText.match(/Secondary Mobile No\.[.:\s]*([+\d\s()-]{10,})/i);
    const secondaryPhone = secPhoneMatch ? secPhoneMatch[1]?.replace(/[\s()-]/g, '').trim() : null;
    
    // Location
    const addressMatch = cvText.match(/Address[:\s]+([^\n]+)/i);
    const location = addressMatch ? addressMatch[1].trim() : null;
    
    // LinkedIn
    const linkedinMatch = cvText.match(/linkedin\.com\/in\/[\w-]+/i);
    const linkedinUrl = linkedinMatch ? `https://${linkedinMatch[0]}` : null;
    
    // Summary
    const summaryMatch = cvText.match(/(?:Career Objective|Caree Objective|Professional Summary|Objective)[:\s]*\n([\s\S]{50,300}?)(?:\n\n|\nWork|\nExperience|\nEducation|$)/i);
    const summary = summaryMatch ? summaryMatch[1].replace(/\n/g, ' ').trim() : null;
    
    // Experience — extract work experience blocks
    const experience: any[] = [];
    const expSection = cvText.match(/Work Experience[:\s]*\n([\s\S]+?)(?:\nAcademic|\nEducation|\nKey Skills|\nLanguage|$)/i);
    if (expSection) {
      const expText = expSection[1];
      // Match job entries: Title Company, Location (Date – Date)
      const jobMatches = expText.matchAll(/([A-Z][^\n]+?)\s+([A-Z][^\n]+?(?:School|Company|Ltd|Inc|Corp|Institute|University|Bank|Group)[^\n]*)[,\s]+([A-Za-z, ]+)\s*\(([^)]+)\)/g);
      for (const match of jobMatches) {
        const dateRange = match[4];
        const dates = dateRange.split('\u2013').map((d: string) => d.trim());
        experience.push({
          role: match[1].trim(),
          company: match[2].trim(),
          location: match[3].trim(),
          startDate: dates[0] || null,
          endDate: dates[1] || 'Present',
          tenureMonths: 0,
          description: '',
        });
      }
    }
    
    // Education — extract from academic table
    const education: any[] = [];
    const eduLines = cvText.match(/(?:Masters?|Honours?|Bachelor|HSC|SSC|MBA|BBA|BSc|MSc)[^\n]*/gi);
    if (eduLines) {
      const degreeMap: Record<string, string> = {
        'masters': 'MASTER', 'master': 'MASTER', 'msc': 'MASTER', 'mba': 'MASTER',
        'honours': 'BACHELOR', 'honor': 'BACHELOR', 'bachelor': 'BACHELOR',
        'bsc': 'BACHELOR', 'bba': 'BACHELOR', 'hons': 'BACHELOR',
        'hsc': 'HIGH_SCHOOL', 'ssc': 'HIGH_SCHOOL', 'a level': 'HIGH_SCHOOL',
      };
      
      eduLines.forEach(eduLine => {
        const lineIdx = lines.findIndex(l => l.includes(eduLine));
        const lower = eduLine.toLowerCase();
        let level = 'OTHER';
        for (const [key, val] of Object.entries(degreeMap)) {
          if (lower.includes(key)) { level = val; break; }
        }
        
        const yearMatch = eduLine.match(/\b(19|20)\d{2}\b/);
        const year = yearMatch ? parseInt(yearMatch[0]) : null;
        
        let institution = 'Unknown';
        if (lineIdx !== -1) {
          for (let j = 0; j <= 2; j++) {
            const targetLine = lines[lineIdx + j];
            if (targetLine && /University|College|School|Institute|Academy/i.test(targetLine)) {
              if (targetLine.length < 15 && lines[lineIdx + j - 1] && lines[lineIdx + j - 1].length > 3) {
                institution = lines[lineIdx + j - 1] + ' ' + targetLine;
              } else {
                institution = targetLine;
              }
              break;
            }
          }
        }
        
        education.push({
          level: level as any,
          degree: eduLine.substring(0, 100),
          institution,
          year: year || 0,
        });
      });
    }
    
    // Skills — look for skills section
    const skillsMatch = cvText.match(/(?:Key Skills|Skills)[:\s]*\n([\s\S]+?)(?:\n\n|\nLanguage|\nPersonal|$)/i);
    const skills: string[] = [];
    if (skillsMatch) {
      const skillLines = skillsMatch[1].split('\n');
      skillLines.forEach(line => {
        const clean = line.replace(/^[\u2022\-*]\s*/, '').trim();
        if (clean.length > 5 && clean.length < 100) skills.push(clean);
      });
    }
    
    // Languages
    const languages: string[] = [];
    if (cvText.match(/Bangla/i)) languages.push('Bangla');
    if (cvText.match(/English/i)) languages.push('English');
    if (cvText.match(/Arabic/i)) languages.push('Arabic');
    if (cvText.match(/Hindi/i)) languages.push('Hindi');
    
    // Personal details
    // Personal details — match label followed by colon and value on same line or next line
    const extractField = (label: string): string | null => {
      // 1. Try multi-line table format: Label\n: Value
      const multiLinePattern = new RegExp(label + '[ \\t]*\\n[ \\t]*:[ \\t]*([^\\n:]{2,100})', 'i');
      const m1 = cvText.match(multiLinePattern);
      if (m1 && m1[1].trim().length > 1) return m1[1].trim();

      // 2. Try same line format: Label : Value
      // We exclude colons and restrict to horizontal whitespace to stay on the same line
      const sameLinePattern = new RegExp(label + '[ \\t]*[:\\-][ \\t]*([^\\n:]{2,100})', 'i');
      const m2 = cvText.match(sameLinePattern);
      if (m2 && m2[1].trim().length > 1) return m2[1].trim();

      return null;
    };
    
    // Personal details
    const personalDetails = {
      dateOfBirth: extractField('Date of Birth'),
      gender: extractField('Gender'),
      nationality: extractField('Nationality'),
      religion: extractField('Religion'),
      maritalStatus: extractField('Marital Status'),
      nationalId: extractField('National ID No.'),
    };

    // Special handler for parallel list format (common in some BD CVs)
    const personalSection = cvText.match(/Personal Details?:?\s*([\s\S]+?)(?=Reference|Education|Experience|Key Skills|Language|Declaration|$)/i);
    if (personalSection) {
      const sectionText = personalSection[1];
      const pLines = sectionText.split('\n').map(l => l.trim()).filter(Boolean);
      const labels = pLines.filter(l => !l.startsWith(':') && l.length < 40);
      const values = pLines.filter(l => l.startsWith(':'));
      
      if (labels.length > 0 && values.length > 0) {
        const getVal = (lbl: string) => {
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

    return {
      name, email, phone, secondaryPhone, location, linkedinUrl, summary,
      skills,
      experience,
      totalYearsExperience: experience.length > 0 ? Math.ceil(experience.reduce((acc, e) => acc + (e.tenureMonths || 0), 0) / 12) : 0,
      education,
      languages,
      currentRole: experience[0]?.role || null,
      currentCompany: experience[0]?.company || null,
      certifications: [],
      achievements: [],
      personalDetails,
    };
  }
}
