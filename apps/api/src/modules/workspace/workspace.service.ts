import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { CreateDepartmentDto } from './dto/create-department.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  // ── Workspace ─────────────────────────────────────
  async getWorkspace(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        _count: {
          select: {
            users: true,
            jobs: true,
            candidates: true,
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Workspace not found');
    return tenant;
  }

  async updateWorkspace(tenantId: string, dto: UpdateWorkspaceDto) {
    if (dto.domain) {
      const existing = await this.prisma.tenant.findFirst({
        where: { domain: dto.domain, id: { not: tenantId } },
      });
      if (existing) throw new ConflictException('Domain already taken');
    }

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: dto,
    });
  }

  // ── Members ───────────────────────────────────────
  async getMembers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async inviteMember(tenantId: string, dto: InviteMemberDto) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email, tenantId },
    });
    if (existing) throw new ConflictException('User already in workspace');

    const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await this.prisma.user.create({
      data: {
        tenantId,
        name: dto.email.split('@')[0],
        email: dto.email,
        passwordHash,
        role: dto.role,
        status: 'INVITED',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return { ...user, tempPassword };
  }

  async updateMemberRole(
    tenantId: string,
    memberId: string,
    role: string,
    currentUserId: string,
  ) {
    if (memberId === currentUserId) {
      throw new ForbiddenException('Cannot change your own role');
    }

    const member = await this.prisma.user.findFirst({
      where: { id: memberId, tenantId },
    });
    if (!member) throw new NotFoundException('Member not found');

    return this.prisma.user.update({
      where: { id: memberId },
      data: { role: role as any },
      select: { id: true, name: true, email: true, role: true },
    });
  }

  async removeMember(tenantId: string, memberId: string, currentUserId: string) {
    if (memberId === currentUserId) {
      throw new ForbiddenException('Cannot remove yourself');
    }

    const member = await this.prisma.user.findFirst({
      where: { id: memberId, tenantId },
    });
    if (!member) throw new NotFoundException('Member not found');

    await this.prisma.user.update({
      where: { id: memberId },
      data: { status: 'INACTIVE' },
    });

    return { success: true, message: 'Member removed' };
  }

  // ── Departments ───────────────────────────────────
  async getDepartments(tenantId: string) {
    return this.prisma.department.findMany({
      where: { tenantId },
      include: {
        _count: { select: { jobs: true, employees: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDepartment(tenantId: string, dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (existing) throw new ConflictException('Department already exists');

    return this.prisma.department.create({
      data: { tenantId, name: dto.name },
    });
  }

  async deleteDepartment(tenantId: string, departmentId: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id: departmentId, tenantId },
    });
    if (!dept) throw new NotFoundException('Department not found');

    await this.prisma.department.delete({ where: { id: departmentId } });
    return { success: true, message: 'Department deleted' };
  }

  // ── Audit Log ─────────────────────────────────────
  async getAuditLog(tenantId: string) {
    const activities: any[] = [];

    const recentCandidates = await this.prisma.candidate.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { name: true, createdAt: true, stage: true },
    });

    const recentJobs = await this.prisma.job.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { title: true, createdAt: true, status: true },
    });

    recentCandidates.forEach((c) =>
      activities.push({
        type: 'CANDIDATE',
        message: `Candidate ${c.name} — ${c.stage}`,
        timestamp: c.createdAt,
      }),
    );

    recentJobs.forEach((j) =>
      activities.push({
        type: 'JOB',
        message: `Job posted: ${j.title}`,
        timestamp: j.createdAt,
      }),
    );

    return activities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }
}
