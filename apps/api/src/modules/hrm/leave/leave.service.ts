import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { RejectLeaveDto } from './dto/reject-leave.dto';
import { LeaveStatus } from '@prisma/client';

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createLeave(tenantId: string, employeeId: string, dto: CreateLeaveDto) {
    try {
      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);

      if (startDate > endDate) {
        throw new BadRequestException('Start date must be before or equal to end date');
      }

      // Calculate totalDays = business days between startDate and endDate
      let totalDays = 0;
      const current = new Date(startDate);
      while (current <= endDate) {
        const day = current.getUTCDay();
        if (day !== 0 && day !== 6) { // Skip Sunday(0) and Saturday(6)
          totalDays++;
        }
        current.setUTCDate(current.getUTCDate() + 1);
      }

      if (totalDays === 0) {
        throw new BadRequestException('Selected date range contains no business days');
      }

      return await this.prisma.leaveRequest.create({
        data: {
          tenantId,
          employeeId,
          leaveType: dto.leaveType,
          startDate,
          endDate,
          totalDays,
          reason: dto.reason,
          status: LeaveStatus.PENDING,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error creating leave request for employee ${employeeId}`, error);
      throw new InternalServerErrorException('Failed to create leave request');
    }
  }

  async getLeaves(tenantId: string, filters: { status?: LeaveStatus; employeeId?: string }) {
    try {
      const where: any = { tenantId };
      if (filters.status) where.status = filters.status;
      if (filters.employeeId) where.employeeId = filters.employeeId;

      return await this.prisma.leaveRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      this.logger.error(`Error getting leave requests for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to retrieve leave requests');
    }
  }

  async getMyLeaves(tenantId: string, employeeId: string) {
    try {
      return await this.prisma.leaveRequest.findMany({
        where: {
          tenantId,
          employeeId,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } catch (error) {
      this.logger.error(`Error getting leave requests for employee ${employeeId}`, error);
      throw new InternalServerErrorException('Failed to retrieve leave requests');
    }
  }

  async approveLeave(tenantId: string, id: string, approverId: string) {
    try {
      const leave = await this.prisma.leaveRequest.findFirst({
        where: { id, tenantId },
      });

      if (!leave) {
        throw new NotFoundException('Leave request not found');
      }

      if (leave.status !== LeaveStatus.PENDING) {
        throw new BadRequestException(`Cannot approve leave request with status ${leave.status}`);
      }

      return await this.prisma.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.APPROVED,
          approverId,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error approving leave request ${id}`, error);
      throw new InternalServerErrorException('Failed to approve leave request');
    }
  }

  async rejectLeave(tenantId: string, id: string, approverId: string, dto: RejectLeaveDto) {
    try {
      const leave = await this.prisma.leaveRequest.findFirst({
        where: { id, tenantId },
      });

      if (!leave) {
        throw new NotFoundException('Leave request not found');
      }

      if (leave.status !== LeaveStatus.PENDING) {
        throw new BadRequestException(`Cannot reject leave request with status ${leave.status}`);
      }

      return await this.prisma.leaveRequest.update({
        where: { id },
        data: {
          status: LeaveStatus.REJECTED,
          approverId,
          approverComment: dto.comment,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error rejecting leave request ${id}`, error);
      throw new InternalServerErrorException('Failed to reject leave request');
    }
  }

  async cancelLeave(tenantId: string, id: string, employeeId: string) {
    try {
      const leave = await this.prisma.leaveRequest.findFirst({
        where: { id, tenantId, employeeId },
      });

      if (!leave) {
        throw new NotFoundException('Leave request not found or not owned by you');
      }

      if (leave.status !== LeaveStatus.PENDING) {
        throw new BadRequestException('Only pending leave requests can be cancelled');
      }

      return await this.prisma.leaveRequest.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error cancelling leave request ${id}`, error);
      throw new InternalServerErrorException('Failed to cancel leave request');
    }
  }
}
