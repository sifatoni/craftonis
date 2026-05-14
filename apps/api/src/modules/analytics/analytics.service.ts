import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // ── KPI Tiles ─────────────────────────────────────
  async getKpis(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      interviewsToday,
      pendingCvs,
      totalCandidates,
      hiredThisMonth,
      openJobs,
      totalLeads,
    ] = await Promise.all([
      this.prisma.interview.count({
        where: {
          candidate: { tenantId },
          scheduledAt: { gte: today, lt: tomorrow },
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.candidate.count({
        where: { tenantId, stage: 'APPLIED' },
      }),
      this.prisma.candidate.count({
        where: { tenantId },
      }),
      this.prisma.candidate.count({
        where: {
          tenantId,
          stage: 'HIRED',
          updatedAt: {
            gte: new Date(today.getFullYear(), today.getMonth(), 1),
          },
        },
      }),
      this.prisma.job.count({
        where: { tenantId, status: 'OPEN' },
      }),
      this.prisma.lead.count({
        where: { tenantId },
      }),
    ]);

    const conversionRate =
      totalCandidates > 0
        ? Math.round((hiredThisMonth / totalCandidates) * 100)
        : 0;

    return {
      interviewsToday,
      pendingCvs,
      totalCandidates,
      hiredThisMonth,
      openJobs,
      totalLeads,
      conversionRate,
    };
  }

  // ── Recruitment Funnel ────────────────────────────
  async getFunnel(tenantId: string) {
    const stages = await this.prisma.candidate.groupBy({
      by: ['stage'],
      where: { tenantId },
      _count: { stage: true },
    });

    const stageOrder = [
      'APPLIED',
      'CV_REVIEWED',
      'PHONE_SCREEN',
      'INTERVIEW',
      'OFFER',
      'HIRED',
    ];

    return stageOrder.map((stage) => ({
      stage,
      label: stage.replace('_', ' '),
      count: stages.find((s) => s.stage === stage)?._count?.stage ?? 0,
    }));
  }

  // ── Source Attribution ────────────────────────────
  async getSourceAttribution(tenantId: string) {
    const total = await this.prisma.candidate.count({ where: { tenantId } });
    if (total === 0) {
      return [
        { source: 'Direct Apply', count: 0, percentage: 0 },
        { source: 'LinkedIn', count: 0, percentage: 0 },
        { source: 'Referral', count: 0, percentage: 0 },
        { source: 'Job Board', count: 0, percentage: 0 },
      ];
    }

    // Simulate source distribution based on total candidates
    const sources = [
      { source: 'LinkedIn', ratio: 0.40 },
      { source: 'Direct Apply', ratio: 0.30 },
      { source: 'Referral', ratio: 0.20 },
      { source: 'Job Board', ratio: 0.10 },
    ];

    return sources.map((s) => ({
      source: s.source,
      count: Math.round(total * s.ratio),
      percentage: Math.round(s.ratio * 100),
    }));
  }

  // ── Department Heat Map ───────────────────────────
  async getDepartmentHeatMap(tenantId: string) {
    const departments = await this.prisma.department.findMany({
      where: { tenantId },
      include: {
        jobs: {
          where: { status: 'OPEN' },
          include: {
            _count: { select: { candidates: true } },
          },
        },
        _count: { select: { employees: true } },
      },
    });

    return departments.map((dept) => {
      const openPositions = dept.jobs.length;
      const totalCandidates = dept.jobs.reduce(
        (sum, job) => sum + job._count.candidates,
        0,
      );
      const hiringVelocity =
        openPositions > 0
          ? Math.min(100, Math.round((totalCandidates / (openPositions * 10)) * 100))
          : 0;

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        openPositions,
        totalCandidates,
        employeeCount: dept._count.employees,
        hiringVelocity,
        status:
          hiringVelocity >= 70
            ? 'HIGH'
            : hiringVelocity >= 40
              ? 'MEDIUM'
              : 'LOW',
      };
    });
  }

  // ── Activity Feed ─────────────────────────────────
  async getActivityFeed(tenantId: string, limit = 20) {
    const activities: any[] = [];

    const [recentCandidates, recentJobs, recentInterviews, recentMeetings] =
      await Promise.all([
        this.prisma.candidate.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, name: true, stage: true, createdAt: true },
        }),
        this.prisma.job.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, title: true, status: true, createdAt: true },
        }),
        this.prisma.interview.findMany({
          where: { candidate: { tenantId } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            types: true,
            status: true,
            scheduledAt: true,
            createdAt: true,
            candidate: { select: { name: true } },
          },
        }),
        this.prisma.meeting.findMany({
          where: { tenantId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: {
            id: true,
            title: true,
            status: true,
            startedAt: true,
            createdAt: true,
          },
        }),
      ]);

    recentCandidates.forEach((c) =>
      activities.push({
        type: 'CANDIDATE',
        icon: 'user',
        color: 'blue',
        message: `${c.name} applied — stage: ${c.stage}`,
        timestamp: c.createdAt,
        refId: c.id,
      }),
    );

    recentJobs.forEach((j) =>
      activities.push({
        type: 'JOB',
        icon: 'briefcase',
        color: 'green',
        message: `Job posted: ${j.title}`,
        timestamp: j.createdAt,
        refId: j.id,
      }),
    );

    recentInterviews.forEach((i) =>
      activities.push({
        type: 'INTERVIEW',
        icon: 'calendar',
        color: 'purple',
        message: `Interview scheduled — ${i.candidate.name} (${Array.isArray(i.types) ? i.types.join(', ') : 'Interview'})`,
        timestamp: i.createdAt,
        refId: i.id,
      }),
    );

    recentMeetings.forEach((m) =>
      activities.push({
        type: 'MEETING',
        icon: 'video',
        color: 'pink',
        message: `Meeting: ${m.title || 'Untitled'} — ${m.status}`,
        timestamp: m.createdAt,
        refId: m.id,
      }),
    );

    return activities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, limit);
  }

  // ── Time to Hire ──────────────────────────────────
  async getTimeToHire(tenantId: string) {
    const hiredCandidates = await this.prisma.candidate.findMany({
      where: { tenantId, stage: 'HIRED' },
      select: { createdAt: true, updatedAt: true },
      take: 50,
    });

    if (hiredCandidates.length === 0) {
      return { averageDays: 0, totalHired: 0 };
    }

    const totalDays = hiredCandidates.reduce((sum, c) => {
      const days = Math.floor(
        (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      return sum + days;
    }, 0);

    return {
      averageDays: Math.round(totalDays / hiredCandidates.length),
      totalHired: hiredCandidates.length,
    };
  }
}
