import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { processTranscript } from '../common/transcript-processor.util';
const pdfParse = require('pdf-parse');
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(private prisma: PrismaService) {}

  async getPlans(tenantId: string, candidateId?: string) {
    const where: any = { tenantId };
    if (candidateId) where.candidateId = candidateId;

    return this.prisma.onboardingPlan.findMany({
      where,
      include: {
        candidate: { select: { name: true, email: true, stage: true, cvUrl: true, job: { select: { title: true } } } },
        tenant: { select: { name: true } },
        weeks: { include: { tasks: true } },
        documents: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPlan(id: string) {
    return this.prisma.onboardingPlan.findUnique({
      where: { id },
      include: {
        candidate: { select: { name: true, email: true, stage: true, cvUrl: true, job: { select: { title: true } } } },
        tenant: { select: { name: true } },
        weeks: { include: { tasks: true }, orderBy: { weekNumber: 'asc' } },
        documents: true,
      },
    });
  }

  async createPlan(tenantId: string, data: {
    candidateId: string;
    jobId?: string;
    title?: string;
    durationDays: number;
    startDate?: string;
    notes?: string;
  }) {
    const weeksCount = Math.ceil(data.durationDays / 7);
    const weeksData = Array.from({ length: weeksCount }).map((_, i) => ({
      weekNumber: i + 1,
      title: `Week ${i + 1}`,
      description: '',
    }));

    return this.prisma.onboardingPlan.create({
      data: {
        tenantId,
        candidateId: data.candidateId,
        jobId: data.jobId,
        title: data.title || 'Onboarding Plan',
        durationDays: data.durationDays,
        startDate: data.startDate ? new Date(data.startDate) : null,
        notes: data.notes,
        weeks: {
          create: weeksData,
        },
      },
      include: { weeks: { include: { tasks: true } } },
    });
  }

  async generateAIPlan(tenantId: string, params: {
    planId: string;
    candidateId: string;
    jobId?: string;
    durationDays: number;
    documentContents?: string[];
  }) {
    const plan = await this.prisma.onboardingPlan.findUnique({
      where: { id: params.planId },
    });
    if (!plan || plan.tenantId !== tenantId) throw new Error('Plan not found or unauthorized');

    const candidate = await this.prisma.candidate.findUnique({
      where: { id: params.candidateId },
      include: { cvScore: true, job: true },
    });

    const interview = await this.prisma.interview.findFirst({
      where: { candidateId: params.candidateId },
      include: { room: true },
    });

    const candidateName = candidate?.name || 'Candidate';
    const jobTitle = candidate?.job?.title || 'Unknown Role';
    const cvSummary = candidate?.cvScore?.parsedData ? JSON.stringify(candidate.cvScore.parsedData) : '';
    
    let interviewSummary = '';
    if (interview?.room) {
        if (interview.room.aiScore) {
            interviewSummary = JSON.stringify(interview.room.aiScore);
        } else if (interview.room.transcript) {
            const transcriptItems = (interview.room.transcript as any[]).map((t: any) => ({
                speaker: t.speaker || 'Unknown',
                text: t.text,
                timestampMs: t.timestampMs,
                flagged: t.flagged,
            }));
            const { text } = processTranscript(transcriptItems);
            interviewSummary = text;
        }
    }

    const prompt = `You are an expert HR onboarding specialist. Create a detailed ${params.durationDays}-day employee onboarding plan.

Employee: ${candidateName}
Role: ${jobTitle}
${cvSummary ? `CV Summary: ${cvSummary}` : ''}
${interviewSummary ? `Interview Assessment: ${interviewSummary}` : ''}
${params.documentContents?.length ? `Additional Context from uploaded documents:\n${params.documentContents.join('\n---\n')}` : ''}

Create a structured onboarding plan divided into weeks. Each week should have 3-5 specific tasks.
Categories: DOCUMENTATION, TRAINING, MEETING, SETUP, GOAL

Return ONLY valid JSON, no markdown:
{
  "weeks": [
    {
      "weekNumber": 1,
      "title": "Week 1: Orientation & Setup",
      "description": "Focus on...",
      "tasks": [
        {
          "title": "Complete HR paperwork",
          "description": "Fill out all required forms...",
          "category": "DOCUMENTATION",
          "dueDay": 1,
          "assignee": "HR Team"
        }
      ]
    }
  ]
}`;

    let parsedPlan: any = null;

    // Try OpenRouter first
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://craftonis.com',
          'X-Title': 'Craftonis HR',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [
            { role: 'system', content: 'You are a JSON API. Output ONLY valid JSON object. No markdown.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const raw = data.choices?.[0]?.message?.content || '';
        const clean = raw.replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
        parsedPlan = JSON.parse(clean);
      }
    } catch (e: any) { this.logger.warn('OpenRouter failed:', e.message); }

    // Groq fallback
    if (!parsedPlan) {
      try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: 'You are a JSON API. Output ONLY valid JSON object. No markdown.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 3000,
            response_format: { type: 'json_object' },
          }),
        });
        if (res.ok) {
          const data = await res.json() as any;
          const raw = data.choices?.[0]?.message?.content || '{}';
          const clean = raw.replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
          parsedPlan = JSON.parse(clean);
        } else {
            throw new Error(`Groq fallback failed: ${await res.text()}`);
        }
      } catch (e: any) {
        this.logger.error('Groq fallback failed:', e.message);
        throw new Error('All AI providers failed to generate plan');
      }
    }

    if (parsedPlan && parsedPlan.weeks && Array.isArray(parsedPlan.weeks)) {
      // Delete existing weeks and tasks
      await this.prisma.onboardingWeek.deleteMany({ where: { planId: params.planId } });

      // Recreate weeks and tasks
      for (const week of parsedPlan.weeks) {
        await this.prisma.onboardingWeek.create({
          data: {
            planId: params.planId,
            weekNumber: week.weekNumber,
            title: week.title,
            description: week.description,
            tasks: {
              create: week.tasks.map((t: any) => ({
                title: t.title,
                description: t.description,
                category: t.category,
                dueDay: t.dueDay,
                assignee: t.assignee,
              })),
            },
          },
        });
      }

      await this.prisma.onboardingPlan.update({
        where: { id: params.planId },
        data: { aiGenerated: true },
      });
    }

    return this.getPlan(params.planId);
  }

  async updatePlan(id: string, data: Partial<{
    title: string;
    durationDays: number;
    startDate: string;
    status: string;
    notes: string;
  }>) {
    const plan = await this.prisma.onboardingPlan.findUnique({ where: { id }, include: { weeks: true } });
    if (!plan) throw new Error('Plan not found');

    const updateData: any = { ...data };
    if (data.startDate !== undefined) {
        updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    }

    if (data.durationDays && data.durationDays !== plan.durationDays) {
      const newWeeksCount = Math.ceil(data.durationDays / 7);
      const currentWeeksCount = plan.weeks.length;

      if (newWeeksCount > currentWeeksCount) {
        const weeksToAdd = Array.from({ length: newWeeksCount - currentWeeksCount }).map((_, i) => ({
          planId: id,
          weekNumber: currentWeeksCount + i + 1,
          title: `Week ${currentWeeksCount + i + 1}`,
          description: '',
        }));
        await this.prisma.onboardingWeek.createMany({ data: weeksToAdd });
      } else if (newWeeksCount < currentWeeksCount) {
        const weeksToRemove = plan.weeks.filter(w => w.weekNumber > newWeeksCount).map(w => w.id);
        if (weeksToRemove.length > 0) {
          await this.prisma.onboardingWeek.deleteMany({ where: { id: { in: weeksToRemove } } });
        }
      }
    }

    return this.prisma.onboardingPlan.update({
      where: { id },
      data: updateData,
      include: { weeks: { include: { tasks: true } } },
    });
  }

  async deletePlan(id: string) {
    return this.prisma.onboardingPlan.delete({ where: { id } });
  }

  async updateWeek(weekId: string, data: { title?: string; description?: string }) {
    return this.prisma.onboardingWeek.update({
      where: { id: weekId },
      data,
    });
  }

  async addTask(weekId: string, data: {
    title: string;
    description?: string;
    category?: string;
    dueDay?: number;
    assignee?: string;
  }) {
    return this.prisma.onboardingTask.create({
      data: {
        weekId,
        ...data,
      },
    });
  }

  async updateTask(taskId: string, data: Partial<{
    title: string;
    description: string;
    category: string;
    dueDay: number;
    completed: boolean;
    assignee: string;
  }>) {
    const updateData: any = { ...data };
    if (data.completed !== undefined) {
      updateData.completedAt = data.completed ? new Date() : null;
    }
    return this.prisma.onboardingTask.update({
      where: { id: taskId },
      data: updateData,
    });
  }

  async deleteTask(taskId: string) {
    return this.prisma.onboardingTask.delete({ where: { id: taskId } });
  }

  async uploadDocument(planId: string, file: Express.Multer.File): Promise<string> {
    const fileBase64 = file.buffer.toString('base64');
    const fileUrl = `base64:${fileBase64}`;
    
    let extractedText = '';
    const ext = file.originalname.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'txt' || ext === 'csv') {
        extractedText = file.buffer.toString('utf-8');
      } else if (ext === 'pdf') {
        const data = await pdfParse(file.buffer);
        extractedText = data.text;
      } else if (ext === 'docx') {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        extractedText = result.value;
      } else if (ext === 'xlsx') {
        const wb = XLSX.read(file.buffer);
        const ws = wb.Sheets[wb.SheetNames[0]];
        extractedText = XLSX.utils.sheet_to_csv(ws);
      } else {
        extractedText = `${file.originalname} (binary file, content not extractable)`;
      }
    } catch (err) {
      this.logger.error(`Error extracting text from ${file.originalname}: ${err}`);
      extractedText = `Failed to extract text from ${file.originalname}`;
    }

    await this.prisma.onboardingDocument.create({
      data: {
        planId,
        fileName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        fileUrl,
      },
    });

    return extractedText;
  }

  async deleteDocument(documentId: string) {
    return this.prisma.onboardingDocument.delete({ where: { id: documentId } });
  }

  async getProgress(planId: string) {
    const plan = await this.prisma.onboardingPlan.findUnique({
      where: { id: planId },
      include: { weeks: { include: { tasks: true } } },
    });
    
    if (!plan) throw new Error('Plan not found');

    let total = 0;
    let completed = 0;
    const byWeek = [];

    for (const week of plan.weeks) {
      const weekTotal = week.tasks.length;
      const weekCompleted = week.tasks.filter(t => t.completed).length;
      total += weekTotal;
      completed += weekCompleted;
      byWeek.push({
        weekNumber: week.weekNumber,
        total: weekTotal,
        completed: weekCompleted,
      });
    }

    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, percentage, byWeek };
  }
}
