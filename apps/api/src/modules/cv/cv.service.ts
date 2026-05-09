import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { ScoreCvDto } from './dto/score-cv.dto';
import Anthropic from '@anthropic-ai/sdk';
import { 
  CvParsedDataSchema, 
  normalizeCvData, 
  CvParsedData 
} from './schemas/cv-parsing.schema';

@Injectable()
export class CvService {
  private readonly logger = new Logger(CvService.name);
  private anthropic: Anthropic | null = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
    if (anthropicKey) {
      this.anthropic = new Anthropic({
        apiKey: anthropicKey,
      });
    }
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
      const pdfParseLib = require('pdf-parse');
      const PDFParseClass = pdfParseLib.PDFParse || pdfParseLib.default?.PDFParse;
      if (PDFParseClass) {
        const parser = new PDFParseClass({ data: fileBuffer });
        const result = await parser.getText();
        cvText = result.text;
      } else {
        const pdfParseFn = pdfParseLib.default || pdfParseLib;
        const parsed = await pdfParseFn(fileBuffer);
        cvText = parsed.text;
      }
    } catch (e: unknown) {
      this.logger.error(`PDF extraction failed: ${e instanceof Error ? e.message : String(e)}`);
      throw new BadRequestException('Could not parse PDF file');
    }

    if (!cvText || cvText.trim().length < 50) {
      throw new BadRequestException('PDF appears to be empty or unreadable');
    }

    // Use AI to extract structured data
    this.logger.log(`CV PARSE STARTED - CandidateID: ${candidateId}`);
    const extractedData = await this.extractCvData(cvText, candidateId);

    // Update candidate with parsed CV data
    this.logger.log(`[CV_SAVE_START] Model: Candidate, CandidateID: ${candidateId}, Name: ${extractedData.name}, Email: ${extractedData.email}`);
    try {
      const updatedCandidate = await this.prisma.candidate.update({
        where: { id: candidateId },
        data: { stage: 'CV_REVIEWED' },
      });
      this.logger.log(`[CV_SAVE_SUCCESS] Model: Candidate, ID: ${updatedCandidate.id}`);
    } catch (error) {
      this.logger.error(`[CV_SAVE_FAILED] Model: Candidate, CandidateID: ${candidateId}, Error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }

    // Save or update CV score with parsed data
    let cvScore: any;
    this.logger.log(`[CV_SAVE_START] Model: CvScore, CandidateID: ${candidateId}, Name: ${extractedData.name}, Email: ${extractedData.email}`);
    try {
      cvScore = await this.prisma.cvScore.upsert({
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
      this.logger.log(`[CV_SAVE_SUCCESS] Model: CvScore, ID: ${cvScore.id}`);
    } catch (error) {
      this.logger.error(`[CV_SAVE_FAILED] Model: CvScore, CandidateID: ${candidateId}, Error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }

    this.logger.log(`CV PARSE COMPLETE - CandidateID: ${candidateId} - Quality: ${extractedData.parsingMetadata?.confidenceScore}%`);

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
  private async extractCvData(cvText: string, candidateId?: string): Promise<any> {
    const deepseekKey = this.config.get<string>('DEEPSEEK_API_KEY');
    const openRouterKey = this.config.get<string>('OPENROUTER_API_KEY');
    const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');

    // Always extract basic info via regex first (guaranteed accuracy for simple fields)
    const basicInfo = this.extractBasicInfoFromText(cvText);
    
    let aiRawData: any = null;
    let provider = 'None';

    try {
      if (deepseekKey) {
        provider = 'DeepSeek';
        aiRawData = await this.extractWithDeepSeek(cvText, deepseekKey);
      } else if (openRouterKey) {
        provider = 'OpenRouter';
        aiRawData = await this.extractWithOpenRouter(cvText, openRouterKey);
      } else if (anthropicKey && this.anthropic) {
        provider = 'Anthropic';
        aiRawData = await this.extractWithAnthropic(cvText, anthropicKey);
      }
    } catch (e: unknown) {
      this.logger.error(`AI Extraction failed for provider ${provider}: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Normalization & Validation Layer
    const validatedData = this.normalizeAndValidate(aiRawData, basicInfo);
    
    // Add confidence scoring & metadata
    const confidenceScore = this.calculateConfidenceScore(validatedData, basicInfo, provider);
    
    return {
      ...validatedData,
      parsingMetadata: {
        provider,
        confidenceScore,
        parsedAt: new Date().toISOString(),
        regexUsed: true,
      }
    };
  }

  private normalizeAndValidate(aiData: any, basicInfo: any): CvParsedData {
    try {
      // 1. Normalize malformed fields (e.g., "null" strings)
      const normalized = normalizeCvData(aiData);

      // 2. Validate with Zod
      const result = CvParsedDataSchema.safeParse(normalized);

      if (!result.success) {
        this.logger.warn(`AI Data Validation Failed: ${JSON.stringify(result.error.format())}`);
        // If validation fails, return a safe blend of regex data and default values
        return this.createSafeFallback(normalized, basicInfo);
      }

      const validated = result.data;

      // 3. Smart Merge: Prioritize AI but fallback to regex for critical fields if AI is "too generic"
      const finalData: CvParsedData = {
        ...validated,
        name: (validated.name && validated.name !== 'Candidate') ? validated.name : basicInfo.name,
        email: (validated.email && validated.email.includes('@')) ? validated.email : basicInfo.email,
        phone: (validated.phone && validated.phone !== 'null') ? validated.phone : basicInfo.phone,
        secondaryPhone: validated.secondaryPhone || basicInfo.secondaryPhone,
        location: validated.location || basicInfo.location,
        linkedinUrl: validated.linkedinUrl || basicInfo.linkedinUrl,
        summary: validated.summary || basicInfo.summary,
        totalYearsExperience: validated.totalYearsExperience || basicInfo.totalYearsExperience,
        currentRole: validated.currentRole || basicInfo.currentRole,
        currentCompany: validated.currentCompany || basicInfo.currentCompany,
        // Ensure arrays are not hallucinated empty if regex found something
        skills: (validated.skills.length > 0) ? validated.skills : basicInfo.skills,
        experience: (validated.experience.length > 0) ? validated.experience : basicInfo.experience,
        education: (validated.education.length > 0) ? validated.education : basicInfo.education,
        languages: (validated.languages.length > 0) ? validated.languages : basicInfo.languages,
        personalDetails: {
          ...validated.personalDetails,
          ...basicInfo.personalDetails,
        }
      };

      return finalData;
    } catch (e) {
      this.logger.error(`Normalization/Validation Error: ${e instanceof Error ? e.message : String(e)}`);
      return this.createSafeFallback(aiData, basicInfo);
    }
  }

  private createSafeFallback(aiData: any, basicInfo: any): CvParsedData {
    return {
      name: basicInfo.name || 'Candidate',
      email: basicInfo.email || null,
      phone: basicInfo.phone || null,
      secondaryPhone: basicInfo.secondaryPhone || null,
      location: basicInfo.location || null,
      linkedinUrl: basicInfo.linkedinUrl || null,
      summary: basicInfo.summary || '',
      skills: basicInfo.skills || [],
      experience: basicInfo.experience || [],
      education: basicInfo.education || [],
      certifications: [],
      languages: basicInfo.languages || [],
      achievements: [],
      personalDetails: basicInfo.personalDetails || {},
      totalYearsExperience: basicInfo.totalYearsExperience || 0,
      currentRole: basicInfo.currentRole || null,
      currentCompany: basicInfo.currentCompany || null,
    };
  }

  private calculateConfidenceScore(data: CvParsedData, basicInfo: any, provider: string): number {
    let score = 0;

    // 1. Extraction Completeness (Max 30)
    if (data.name && data.name !== 'Candidate') score += 5;
    if (data.email) score += 5;
    if (data.phone) score += 5;
    if (data.experience.length > 0) score += 5;
    if (data.education.length > 0) score += 5;
    if (data.skills.length > 0) score += 5;

    // 2. Valid Contact Info (Max 15)
    if (data.email?.includes('@')) score += 10;
    if (data.phone?.match(/[\d]{8,}/)) score += 5;

    // 3. Experience & Education Quality (Max 30)
    const validExp = data.experience.filter(e => e.company !== 'Unknown' && e.role !== 'Unknown').length;
    if (validExp > 0) score += 15;
    const validEdu = data.education.filter(e => e.institution !== 'Unknown' && e.degree !== 'Unknown').length;
    if (validEdu > 0) score += 15;

    // 4. Regex Alignment (Max 25)
    // If AI and Regex found the same name or email, confidence is very high
    if (data.email && basicInfo.email && data.email.toLowerCase() === basicInfo.email.toLowerCase()) score += 15;
    if (data.name && basicInfo.name && data.name.toLowerCase() === basicInfo.name.toLowerCase()) score += 10;

    // Penalties
    if (provider === 'None') score = Math.min(score, 40); // Hard cap for regex only
    if (!data.summary) score -= 5;
    
    return Math.max(0, Math.min(100, score));
  }

  private async extractWithDeepSeek(cvText: string, apiKey: string): Promise<any> {
    const operation = 'DeepSeek Parsing';
    
    const executeRequest = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);

      try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: `You are a professional CV/Resume parser. Return ONLY valid JSON.
Extract ALL information accurately. Follow the schema exactly. If a value is unknown, use null or appropriate default.`
              },
              {
                role: 'user',
                content: `Extract information from this CV text:
${cvText.substring(0, 10000)}

Return JSON (no markdown):
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "secondaryPhone": "string | null",
  "location": "string",
  "linkedinUrl": "string | null",
  "summary": "string",
  "skills": ["string"],
  "experience": [{"company":"string","role":"string","startDate":"string","endDate":"string","tenureMonths":number,"description":"string"}],
  "education": [{"degree":"string","institution":"string","year":number,"level":"MASTER | BACHELOR | HIGH_SCHOOL | OTHER"}],
  "certifications": ["string"],
  "languages": ["string"],
  "achievements": ["string"],
  "personalDetails": {"dateOfBirth":"string|null","gender":"string|null","nationality":"string|null","religion":"string|null","maritalStatus":"string|null","nationalId":"string|null"}
}`
              }
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 2000
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errText = await response.text();
          const error: any = new Error(`DeepSeek API error: ${response.status} ${errText}`);
          error.status = response.status;
          throw error;
        }

        const data = await response.json() as any;
        const content = data.choices?.[0]?.message?.content;
        return this.safeJsonParse(content);
      } catch (e: unknown) {
        clearTimeout(timeoutId);
        throw e;
      }
    };

    return this.retry(operation, executeRequest).catch(() => null);
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
          model: 'google/gemma-4-31b-it:free',
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: `Extract structured data from this CV. Return ONLY JSON.
${cvText.substring(0, 5000)}`
            }
          ]
        })
      });

      if (!response.ok) return null;

      const data = (await response.json()) as any;
      const text = data.choices?.[0]?.message?.content || '';
      return this.safeJsonParse(text);
    } catch (e: unknown) {
      return null;
    }
  }

  private async extractWithAnthropic(cvText: string, apiKey: string): Promise<any> {
    if (!this.anthropic) return null;
    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: `Extract structured data from this CV. Return ONLY valid JSON.
CV Text: ${cvText.substring(0, 3000)}`
          }
        ]
      });

      const text = message.content[0].type === 'text' ? message.content[0].text : '';
      return this.safeJsonParse(text);
    } catch (e: unknown) {
      return null;
    }
  }

  private async retry<T>(
    operation: string,
    fn: () => Promise<T>,
    retries = 3,
    delay = 1000,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      const status = (error as any)?.status;
      const isRetryable = status === 429 || (status >= 500 && status <= 599) || (error instanceof Error && error.name === 'AbortError');
      
      if (retries > 0 && isRetryable) {
        this.logger.warn(`[${operation}] Request failed (Status: ${status}). Retrying in ${delay}ms... (${retries} retries left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retry(operation, fn, retries - 1, delay * 2);
      }
      
      this.logger.error(`[${operation}] Final failure after retries: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private safeJsonParse(text: string): any {
    try {
      if (!text) return null;
      let cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      cleanText = cleanText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const firstBrace = cleanText.indexOf('{');
      const lastBrace = cleanText.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) return null;
      const jsonStr = cleanText.substring(firstBrace, lastBrace + 1);
      return JSON.parse(jsonStr);
    } catch (e: unknown) {
      this.logger.error(`JSON parse failed: ${e instanceof Error ? e.message : String(e)}`);
      return null;
    }
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

    const certBonus = Math.min(certifications.length * 5, 15);
    return Math.min(100, score + certBonus);
  }

  // ── Bulk Parse with Concurrency Control ────────────
  private static readonly BULK_MAX_CONCURRENCY = 3;
  private static readonly BULK_DELAY_MS = 2000;

  async bulkParseCvs(tenantId: string, jobId: string, files: Express.Multer.File[]) {
    if (!files || files.length === 0) throw new BadRequestException('No files provided');

    const total = files.length;
    this.logger.log(`[BULK_PARSE_START] JobID: ${jobId}, TenantID: ${tenantId}, TotalFiles: ${total}, MaxConcurrency: ${CvService.BULK_MAX_CONCURRENCY}`);

    const results: Array<{
      filename: string;
      success: boolean;
      candidateId?: string;
      name?: string;
      action?: string;
      error?: string;
    }> = [];

    // Promise pool: run tasks with bounded concurrency
    await this.runPool(
      files,
      CvService.BULK_MAX_CONCURRENCY,
      CvService.BULK_DELAY_MS,
      async (file, index) => {
        const filename = file.originalname;
        try {
          const result = await this.processSingleBulkCv(tenantId, jobId, file);
          results.push(result);
          this.logger.log(
            `[BULK_PARSE_PROGRESS] ${index + 1}/${total} - ${filename} - ${result.success ? 'OK' : 'FAIL'}${result.action ? ` (${result.action})` : ''}`,
          );
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          results.push({ filename, success: false, error: errorMsg });
          this.logger.error(
            `[BULK_PARSE_FAILED] ${index + 1}/${total} - ${filename} - ${errorMsg}`,
          );
        }
      },
    );

    const successResults = results.filter((r) => r.success);
    const failedResults = results.filter((r) => !r.success);

    const summary = {
      total,
      success: successResults.length,
      created: results.filter((r) => r.success && r.action === 'created').length,
      updated: results.filter((r) => r.success && r.action === 'updated').length,
      failed: failedResults.length,
      failedCandidates: failedResults.map((r) => ({
        filename: r.filename,
        error: r.error,
      })),
    };

    this.logger.log(
      `[BULK_PARSE_COMPLETE] JobID: ${jobId} - Total: ${total}, Success: ${summary.success}, Failed: ${summary.failed}`,
    );

    return { results, summary };
  }

  /**
   * Lightweight Promise pool — runs tasks with bounded concurrency and
   * an inter-dispatch delay to prevent API bursts.
   */
  private async runPool<T>(
    items: T[],
    maxConcurrency: number,
    delayMs: number,
    task: (item: T, index: number) => Promise<void>,
  ): Promise<void> {
    let cursor = 0;
    const total = items.length;
    const active: Set<Promise<void>> = new Set();

    const enqueue = async (): Promise<void> => {
      if (cursor >= total) return;

      const index = cursor++;
      const item = items[index];

      // Inter-request delay (skip for the very first item)
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      const promise = task(item, index).finally(() => {
        active.delete(promise);
      });
      active.add(promise);

      // If pool is full, wait for one to finish before launching next
      if (active.size >= maxConcurrency) {
        await Promise.race(active);
      }

      await enqueue();
    };

    // Launch up to maxConcurrency initial workers
    const workers = Array.from(
      { length: Math.min(maxConcurrency, total) },
      () => enqueue(),
    );
    await Promise.all(workers);

    // Drain remaining
    if (active.size > 0) {
      await Promise.all(active);
    }
  }

  /**
   * Process a single CV file within the bulk pipeline.
   * Isolated — exceptions here do NOT propagate to other files.
   */
  private async processSingleBulkCv(
    tenantId: string,
    jobId: string,
    file: Express.Multer.File,
  ): Promise<{
    filename: string;
    success: boolean;
    candidateId?: string;
    name?: string;
    action?: string;
    error?: string;
  }> {
    const filename = file.originalname;

    // 1. Extract PDF text
    const pdfParseLib = require('pdf-parse');
    const PDFParseClass = pdfParseLib.PDFParse || pdfParseLib.default?.PDFParse;
    let cvText = '';
    if (PDFParseClass) {
      const parser = new PDFParseClass({ data: file.buffer });
      const result = await parser.getText();
      cvText = result.text;
    } else {
      const pdfParseFn = pdfParseLib.default || pdfParseLib;
      const parsed = await pdfParseFn(file.buffer);
      cvText = parsed.text;
    }

    if (!cvText || cvText.trim().length < 50) {
      return { filename, success: false, error: 'Could not read PDF' };
    }

    // 2. AI extraction (rate-limited by pool delay)
    const extractedData = await this.extractCvData(cvText);
    const name =
      extractedData.name && extractedData.name !== 'Candidate'
        ? extractedData.name
        : `Candidate (${filename.replace(/\.pdf$/i, '')})`;
    const email =
      extractedData.email && extractedData.email.includes('@')
        ? extractedData.email.toLowerCase()
        : `${name.toLowerCase().replace(/\s+/g, '.')}@pending.craftonis`;

    // 3. Upsert or create candidate
    const existing = await this.prisma.candidate.findFirst({
      where: { tenantId, email, jobId },
    });

    if (existing) {
      await this.prisma.cvScore.upsert({
        where: { candidateId: existing.id },
        create: {
          candidateId: existing.id,
          parsedData: extractedData,
          skillMatch: 0,
          stability: 0,
          education: 0,
          totalScore: 0,
        },
        update: { parsedData: extractedData },
      });
      return { filename, success: true, candidateId: existing.id, name, action: 'updated' };
    }

    const cvBase64 = file.buffer.toString('base64');
    const candidate = await this.prisma.candidate.create({
      data: {
        tenantId,
        jobId,
        name,
        email,
        phone:
          extractedData.phone && extractedData.phone !== 'null'
            ? extractedData.phone
            : undefined,
        cvUrl: `data:application/pdf;base64,${cvBase64}`,
        stage: 'CV_REVIEWED',
      },
    });

    await this.prisma.cvScore.create({
      data: {
        candidateId: candidate.id,
        parsedData: extractedData,
        skillMatch: 0,
        stability: 0,
        education: 0,
        totalScore: 0,
      },
    });

    return { filename, success: true, candidateId: candidate.id, name, action: 'created' };
  }

  async reparseCv(candidateId: string, tenantId: string) {
    const candidate = await this.prisma.candidate.findFirst({ where: { id: candidateId, tenantId }, include: { cvScore: true } });
    if (!candidate || !candidate.cvUrl) throw new BadRequestException('Candidate or CV not found');
    const base64Data = candidate.cvUrl.replace('data:application/pdf;base64,', '');
    const buffer = Buffer.from(base64Data, 'base64');

    const pdfParseLib = require('pdf-parse');
    const PDFParseClass = pdfParseLib.PDFParse || pdfParseLib.default?.PDFParse;
    let cvText = '';
    if (PDFParseClass) {
      const result = await new PDFParseClass({ data: buffer }).getText();
      cvText = result.text;
    } else {
      cvText = (await (pdfParseLib.default || pdfParseLib)(buffer)).text;
    }

    const extractedData = await this.extractCvData(cvText, candidateId);
    this.logger.log(`[CV_SAVE_START] Model: CvScore, CandidateID: ${candidateId}, Name: ${extractedData.name}, Email: ${extractedData.email}`);
    try {
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
      this.logger.log(`[CV_SAVE_SUCCESS] Model: CvScore, ID: ${cvScore.id}`);
    } catch (error) {
      this.logger.error(`[CV_SAVE_FAILED] Model: CvScore, CandidateID: ${candidateId}, Error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
    
    this.logger.log(`[CV_SAVE_START] Model: Candidate, CandidateID: ${candidateId}, Name: ${extractedData.name}, Email: ${extractedData.email}`);
    try {
      const updatedCandidate = await this.prisma.candidate.update({
        where: { id: candidateId },
        data: {
          name: (extractedData.name && extractedData.name !== 'Candidate') ? extractedData.name : candidate.name,
          email: (extractedData.email && extractedData.email.includes('@')) ? extractedData.email : candidate.email,
          phone: (extractedData.phone && extractedData.phone !== 'null') ? extractedData.phone : candidate.phone,
        }
      });
      this.logger.log(`[CV_SAVE_SUCCESS] Model: Candidate, ID: ${updatedCandidate.id}`);
    } catch (error) {
      this.logger.error(`[CV_SAVE_FAILED] Model: Candidate, CandidateID: ${candidateId}, Error: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
    return { success: true, message: 'CV re-parsed successfully', extractedData };
  }

  async fetchAndParseCvFromUrl(url: string): Promise<any> {
    try {
      let downloadUrl = url;
      const gdriveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (gdriveMatch) downloadUrl = `https://drive.google.com/uc?export=download&id=${gdriveMatch[1]}`;
      if (url.includes('dropbox.com')) downloadUrl = url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');

      const fetchModule = (await import('node-fetch')) as any;
      const fetchFn = fetchModule.default || fetchModule;
      const response = await fetchFn(downloadUrl, { timeout: 15000 } as any);
      if (!response.ok) throw new Error(`Failed to fetch CV: ${response.statusText}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      const pdfParseLib = require('pdf-parse');
      let cvText = (await (pdfParseLib.default || pdfParseLib)(buffer)).text;
      return await this.extractCvData(cvText);
    } catch (err: unknown) {
      throw new Error(`Could not fetch CV from URL: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private extractBasicInfoFromText(cvText: string): any {
    const lines = cvText.split('\n').map(l => l.trim()).filter(Boolean);
    const name = lines.find(line => line.length > 5 && line.length < 50 && !/curriculum|vitae|resume|cv|biodata|objective|experience|education|personal|skills| proficiency|contact|mobile|email|address/i.test(line)) || lines[0] || 'Candidate';
    const emailMatch = cvText.match(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : null;
    const phoneMatch = cvText.match(/(?:Primary Mobile No\.|Mobile No\.|Phone|Tel)[.:\s]*([+\d\s()-]{10,})/i) || cvText.match(/(\+?880\d{10}|01\d{9})/);
    const phone = phoneMatch ? phoneMatch[1]?.replace(/[\s()-]/g, '').trim() : null;
    const secPhoneMatch = cvText.match(/Secondary Mobile No\.[.:\s]*([+\d\s()-]{10,})/i);
    const secondaryPhone = secPhoneMatch ? secPhoneMatch[1]?.replace(/[\s()-]/g, '').trim() : null;
    const addressMatch = cvText.match(/Address[:\s]+([^\n]+)/i);
    const location = addressMatch ? addressMatch[1].trim() : null;
    const linkedinMatch = cvText.match(/linkedin\.com\/in\/[\w-]+/i);
    const linkedinUrl = linkedinMatch ? `https://${linkedinMatch[0]}` : null;
    const summaryMatch = cvText.match(/(?:Career Objective|Caree Objective|Professional Summary|Objective)[:\s]*\n([\s\S]{50,300}?)(?:\n\n|\nWork|\nExperience|\nEducation|$)/i);
    const summary = summaryMatch ? summaryMatch[1].replace(/\n/g, ' ').trim() : null;
    
    const experience: any[] = [];
    const expSection = cvText.match(/Work Experience[:\s]*\n([\s\S]+?)(?:\nAcademic|\nEducation|\nKey Skills|\nLanguage|\nPersonal|$)/i);
    if (expSection) {
      const expText = expSection[1];
      const oneLineMatches = [...expText.matchAll(/^([A-Z][a-zA-Z]+\s[A-Z][a-zA-Z]+|[A-Z][a-zA-Z\s]+?)\s+((?:[A-Z][^\n(,]+?(?:School|Company|Ltd|Inc|Corp|Institute|University|Bank|Group|International|National|Global|K\.G|KG)[^\n(,]*))(?:[,\s]+([A-Za-z,\s]+?))?\s*\(([^)]+)\)/gm)];
      for (const match of oneLineMatches) {
        const dates = (match[4] || '').split(/[–\-]/).map(d => d.trim());
        experience.push({ role: match[1].trim(), company: match[2].trim(), location: match[3]?.trim() || null, startDate: dates[0] || null, endDate: dates[1] || 'Present', tenureMonths: 0, description: '' });
      }
      if (experience.length === 0) {
        const expLines = expText.split('\n').filter(l => l.trim());
        let currentExp: any = null;
        for (const line of expLines) {
          const trimmed = line.trim();
          const dateMatch = trimmed.match(/\(([A-Za-z]+ \d{4})\s*[–\-]\s*([A-Za-z]+ \d{4}|Present)\)/i);
          if (dateMatch) {
            const beforeDate = trimmed.replace(dateMatch[0], '').trim();
            const parts = beforeDate.split(',');
            const companyPart = parts.slice(0, -1).join(',').trim();
            const loc = parts[parts.length - 1]?.trim();
            const roleCompanyMatch = companyPart.match(/^([A-Z][a-zA-Z]+\s[A-Z][a-zA-Z]+|[A-Z][a-zA-Z]+)\s+((?:[A-Z][a-zA-Z&.]+\s*)*(?:School|Company|Ltd|Inc|Corp|Institute|University|Bank|Group|International|K\.G|K\.G\.|KG).*)/);
            if (roleCompanyMatch) {
              currentExp = { role: roleCompanyMatch[1].trim(), company: roleCompanyMatch[2].trim(), location: loc, startDate: dateMatch[1], endDate: dateMatch[2], tenureMonths: 0, description: '' };
            } else {
              currentExp = { role: companyPart, company: '', location: loc, startDate: dateMatch[1], endDate: dateMatch[2], tenureMonths: 0, description: '' };
            }
            experience.push(currentExp);
          } else if (currentExp && trimmed.startsWith('•')) {
            currentExp.description += (currentExp.description ? ' ' : '') + trimmed.replace(/^•\s*/, '');
          }
        }
      }
    }
    
    const education: any[] = [];
    const eduLines = cvText.match(/(?:Masters?|Honours?|Bachelor|HSC|SSC|MBA|BBA|BSc|MSc)[^\n]*/gi);
    if (eduLines) {
      const degreeMap: Record<string, string> = { 'masters': 'MASTER', 'master': 'MASTER', 'msc': 'MASTER', 'mba': 'MASTER', 'honours': 'BACHELOR', 'bachelor': 'BACHELOR', 'bsc': 'BACHELOR', 'bba': 'BACHELOR', 'hsc': 'HIGH_SCHOOL', 'ssc': 'HIGH_SCHOOL' };
      eduLines.forEach(eduLine => {
        const lineIdx = lines.findIndex(l => l.includes(eduLine));
        let level = 'OTHER';
        for (const [key, val] of Object.entries(degreeMap)) { if (eduLine.toLowerCase().includes(key)) { level = val; break; } }
        const yearMatch = eduLine.match(/\b(19|20)\d{2}\b/);
        let institution = 'Unknown';
        if (lineIdx !== -1) {
          for (let j = 0; j <= 2; j++) {
            const targetLine = lines[lineIdx + j];
            if (targetLine && /University|College|School|Institute|Academy/i.test(targetLine)) {
              institution = (targetLine.length < 15 && lines[lineIdx + j - 1]) ? lines[lineIdx + j - 1] + ' ' + targetLine : targetLine;
              break;
            }
          }
        }
        education.push({ level: level as any, degree: eduLine.substring(0, 100), institution, year: yearMatch ? parseInt(yearMatch[0]) : 0 });
      });
    }
    
    const skillsMatch = cvText.match(/(?:Key Skills|Skills)[:\s]*\n([\s\S]+?)(?:\n\n|\nLanguage|\nPersonal|$)/i);
    const skills: string[] = [];
    if (skillsMatch) {
      skillsMatch[1].split('\n').forEach(line => {
        const clean = line.replace(/^[\u2022\-*]\s*/, '').trim();
        if (clean.length > 5 && clean.length < 100) skills.push(clean);
      });
    }
    
    const extractField = (label: string): string | null => {
      const m1 = cvText.match(new RegExp(label + '[ \\t]*\\n[ \\t]*:[ \\t]*([^\\n:]{2,100})', 'i'));
      if (m1) return m1[1].trim();
      const m2 = cvText.match(new RegExp(label + '[ \\t]*[:\\-][ \\t]*([^\\n:]{2,100})', 'i'));
      return m2 ? m2[1].trim() : null;
    };
    
    const personalDetails: Record<string, string | null> = { 
      dateOfBirth: extractField('Date of Birth'), 
      gender: extractField('Gender'), 
      nationality: extractField('Nationality'), 
      religion: extractField('Religion'), 
      maritalStatus: extractField('Marital Status'), 
      nationalId: extractField('National ID No.') 
    };

    const personalSection = cvText.match(/Personal Details?:?\s*([\s\S]+?)(?=Reference|Education|Experience|Key Skills|Language|Declaration|$)/i);
    if (personalSection) {
      const pLines = personalSection[1].split('\n').map(l => l.trim()).filter(Boolean);
      const labels = pLines.filter(l => !l.startsWith(':') && l.length < 40);
      const values = pLines.filter(l => l.startsWith(':'));
      if (labels.length > 0 && values.length > 0) {
        const getVal = (lbl: string) => { const idx = labels.findIndex(l => l.toLowerCase().includes(lbl.toLowerCase())); return idx !== -1 && values[idx] ? values[idx].replace(/^[:\s]*/, '').trim() : null; };
        
        type PersonalDetailsKey = 'dateOfBirth' | 'gender' | 'nationality' | 'religion' | 'maritalStatus' | 'nationalId';
        const personalFields: PersonalDetailsKey[] = ['dateOfBirth', 'gender', 'nationality', 'religion', 'maritalStatus', 'nationalId'];
        
        personalFields.forEach(f => { 
          if (!personalDetails[f]) {
            personalDetails[f] = getVal(f.replace(/([A-Z])/g, ' $1').trim()); 
          }
        });
      }
    }

    return {
      name, email, phone, secondaryPhone, location, linkedinUrl, summary, skills, experience,
      totalYearsExperience: experience.length > 0 ? Math.ceil(experience.reduce((acc, e) => acc + (e.tenureMonths || 0), 0) / 12) : 0,
      education, languages: ['Bangla', 'English'].filter(l => cvText.match(new RegExp(l, 'i'))),
      currentRole: experience[0]?.role || null, currentCompany: experience[0]?.company || null, certifications: [], achievements: [], personalDetails
    };
  }
}
