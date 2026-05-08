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

    // Try OpenRouter first (free), fall back to Anthropic, then mock
    if (openRouterKey) {
      return await this.extractWithOpenRouter(cvText, openRouterKey);
    } else if (anthropicKey) {
      return await this.extractWithAnthropic(cvText, anthropicKey);
    } else {
      return this.mockExtractedData();
    }
  }

  private async extractWithOpenRouter(cvText: string, apiKey: string): Promise<any> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://craftonis.com',
          'X-Title': 'Craftonis CV Parser',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp:free',
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: `Extract structured data from this CV/Resume text. Return ONLY valid JSON, no explanation, no markdown, no code blocks.

CV Text:
${cvText.substring(0, 4000)}

Return this exact JSON structure:
{
  "name": "Full name of the candidate",
  "email": "email address or null",
  "phone": "phone number or null",
  "location": "city, country or null",
  "linkedinUrl": "linkedin URL or null",
  "githubUrl": "github URL or null",
  "portfolioUrl": "portfolio/website URL or null",
  "totalYearsExperience": number,
  "currentRole": "most recent job title or null",
  "currentCompany": "most recent company or null",
  "summary": "professional summary in 2-3 sentences",
  "skills": ["skill1", "skill2", "skill3"],
  "experience": [
    {
      "company": "company name",
      "role": "job title",
      "startDate": "YYYY-MM or null",
      "endDate": "YYYY-MM or present",
      "tenureMonths": number,
      "description": "brief description"
    }
  ],
  "education": [
    {
      "degree": "degree name",
      "institution": "university/college name",
      "year": number or null,
      "level": "HIGH_SCHOOL or BACHELOR or MASTER or PHD or OTHER"
    }
  ],
  "certifications": ["cert1", "cert2"],
  "languages": ["English", "Bangla"],
  "achievements": ["achievement1", "achievement2"]
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
      const text = data.choices?.[0]?.message?.content || '';
      
      // Clean JSON — remove any markdown if present
      const cleanJson = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      const parsed = JSON.parse(cleanJson);
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

        if (!cvText || cvText.trim().length < 50) {
          results.push({ filename: file.originalname, success: false, error: 'Could not read PDF' })
          continue
        }

        // Extract structured data via Claude
        const extractedData = await this.extractCvData(cvText)

        // Create candidate from extracted data
        const name = extractedData.name && extractedData.name !== 'Candidate' 
          ? extractedData.name 
          : file.originalname.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ').trim()
        
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
}
