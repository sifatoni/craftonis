import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateStageDto } from './dto/update-candidate-stage.dto';
import { JobQueryDto } from './dto/job-query.dto';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  // ── JOBS ──────────────────────────────────────────
  async getJobs(tenantId: string, query: JobQueryDto) {
    const where: any = { tenantId };
    if (query.status) where.status = query.status;
    if (query.departmentId) where.departmentId = query.departmentId;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const jobs = await this.prisma.job.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        _count: { select: { candidates: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return jobs.map((job) => ({
      ...job,
      candidateCount: job._count.candidates,
      daysOpen: Math.floor(
        (Date.now() - new Date(job.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      ),
    }));
  }

  async getJob(tenantId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
      include: {
        department: true,
        _count: { select: { candidates: true } },
      },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async createJob(tenantId: string, dto: CreateJobDto) {
    if (dto.departmentId) {
      const dept = await this.prisma.department.findFirst({
        where: { id: dto.departmentId, tenantId },
      });
      if (!dept) throw new NotFoundException('Department not found');
    }

    return this.prisma.job.create({
      data: { tenantId, ...dto },
      include: { department: { select: { id: true, name: true } } },
    });
  }

  async updateJob(tenantId: string, jobId: string, dto: UpdateJobDto) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Job not found');

    return this.prisma.job.update({
      where: { id: jobId },
      data: dto,
      include: { department: { select: { id: true, name: true } } },
    });
  }

  async deleteJob(tenantId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Job not found');

    await this.prisma.job.update({
      where: { id: jobId },
      data: { status: 'CLOSED' },
    });

    return { success: true, message: 'Job archived successfully' };
  }

  // ── CANDIDATES ────────────────────────────────────
  async getCandidates(tenantId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Job not found');

    return this.prisma.candidate.findMany({
      where: { jobId, tenantId },
      include: {
        cvScore: {
          select: {
            totalScore: true,
            skillMatch: true,
            stability: true,
            education: true,
          },
        },
      },
      orderBy: [
        { cvScore: { totalScore: 'desc' } },
        { createdAt: 'desc' },
      ],
    });
  }

  async getCandidate(tenantId: string, candidateId: string) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, tenantId },
      include: {
        job: { select: { id: true, title: true } },
        cvScore: true,
        interviews: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');
    return candidate;
  }

  async createCandidate(tenantId: string, dto: CreateCandidateDto) {
    if (dto.jobId) {
      const job = await this.prisma.job.findFirst({
        where: { id: dto.jobId, tenantId },
      });
      if (!job) throw new NotFoundException('Job not found');
    }

    const existing = await this.prisma.candidate.findFirst({
      where: { tenantId, email: dto.email, jobId: dto.jobId },
    });
    if (existing) throw new ConflictException('Candidate already applied for this job');

    return this.prisma.candidate.create({
      data: { tenantId, ...dto },
    });
  }

  async updateCandidateStage(
    tenantId: string,
    candidateId: string,
    dto: UpdateCandidateStageDto,
  ) {
    const candidate = await this.prisma.candidate.findFirst({
      where: { id: candidateId, tenantId },
    });
    if (!candidate) throw new NotFoundException('Candidate not found');

    return this.prisma.candidate.update({
      where: { id: candidateId },
      data: { stage: dto.stage },
    });
  }

  async bulkUploadCandidates(tenantId: string, jobId: string, candidates: CreateCandidateDto[]) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Job not found');

    const results = await Promise.allSettled(
      candidates.map((c) =>
        this.prisma.candidate.create({
          data: { tenantId, jobId, ...c },
        }),
      ),
    );

    const created = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      success: true,
      created,
      failed,
      message: `${created} candidates added, ${failed} skipped (duplicates)`,
    };
  }

  // ── PIPELINE STATS ────────────────────────────────
  async getPipelineStats(tenantId: string, jobId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Job not found');

    const stages = await this.prisma.candidate.groupBy({
      by: ['stage'],
      where: { jobId, tenantId },
      _count: { stage: true },
    });

    const stageOrder = [
      'APPLIED', 'CV_REVIEWED', 'PHONE_SCREEN',
      'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED',
    ];

    return stageOrder.map((stage) => ({
      stage,
      count: stages.find((s) => s.stage === stage)?._count?.stage ?? 0,
    }));
  }
}
