import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CheckinDto } from './dto/checkin.dto';
import { AttendanceStatus } from '@prisma/client';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async resolveEmployee(userId: string, tenantId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { userId, tenantId, status: 'ACTIVE' },
    });
    if (!employee) {
      throw new NotFoundException(
        'No employee profile linked to your account. Please contact HR.',
      );
    }
    return employee;
  }

  async checkin(userId: string, tenantId: string, dto?: CheckinDto) {
    try {
      const employee = await this.resolveEmployee(userId, tenantId);
      const employeeId = employee.id;

      const now = new Date();
      const startOfDay = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const endOfDay = new Date(startOfDay);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

      const existingLog = await this.prisma.attendanceLog.findFirst({
        where: {
          tenantId,
          employeeId,
          date: { gte: startOfDay, lt: endOfDay },
        },
      });

      if (existingLog) {
        throw new BadRequestException('Already checked in today');
      }

      const isLate = now.getUTCHours() >= 10;
      const status = isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT;

      return await this.prisma.attendanceLog.create({
        data: {
          tenantId,
          employeeId,
          date: startOfDay,
          checkinTime: now,
          status,
          notes: dto?.notes,
          lat: dto?.lat ?? null,
          lon: dto?.lon ?? null,
          locationName: dto?.locationName ?? null,
          timezone: dto?.timezone ?? null,
        },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`Error during checkin for user ${userId}`, error);
      throw new InternalServerErrorException('Failed to check in');
    }
  }

  async checkout(userId: string, tenantId: string) {
    try {
      const employee = await this.resolveEmployee(userId, tenantId);
      const employeeId = employee.id;

      const now = new Date();
      const startOfDay = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const endOfDay = new Date(startOfDay);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

      const log = await this.prisma.attendanceLog.findFirst({
        where: {
          tenantId,
          employeeId,
          date: { gte: startOfDay, lt: endOfDay },
        },
      });

      if (!log) {
        throw new BadRequestException('No check-in found for today');
      }

      if (log.checkoutTime) {
        throw new BadRequestException('Already checked out');
      }

      let hoursWorked = null;
      if (log.checkinTime) {
        hoursWorked =
          (now.getTime() - log.checkinTime.getTime()) / 3600000;
        hoursWorked = Math.round(hoursWorked * 100) / 100;
      }

      return await this.prisma.attendanceLog.update({
        where: { id: log.id },
        data: { checkoutTime: now, hoursWorked },
      });
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      this.logger.error(`Error during checkout for user ${userId}`, error);
      throw new InternalServerErrorException('Failed to check out');
    }
  }

  async getTodayStatus(userId: string, tenantId: string) {
    try {
      const employee = await this.resolveEmployee(userId, tenantId);
      const employeeId = employee.id;

      const now = new Date();
      const startOfDay = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
      );
      const endOfDay = new Date(startOfDay);
      endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

      return await this.prisma.attendanceLog.findFirst({
        where: {
          tenantId,
          employeeId,
          date: { gte: startOfDay, lt: endOfDay },
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(
        `Error getting today status for user ${userId}`,
        error,
      );
      throw new InternalServerErrorException('Failed to retrieve today status');
    }
  }

  async getLogs(
    tenantId: string,
    employeeId: string,
    month: number,
    year: number,
  ) {
    try {
      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month, 1));

      return await this.prisma.attendanceLog.findMany({
        where: {
          tenantId,
          employeeId,
          date: { gte: startDate, lt: endDate },
        },
        orderBy: { date: 'asc' },
      });
    } catch (error) {
      this.logger.error(
        `Error getting attendance logs for employee ${employeeId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve attendance logs',
      );
    }
  }

  async getMonthlySummary(
    tenantId: string,
    employeeId: string,
    month: number,
    year: number,
  ) {
    try {
      const startDate = new Date(Date.UTC(year, month - 1, 1));
      const endDate = new Date(Date.UTC(year, month, 1));

      const logs = await this.prisma.attendanceLog.findMany({
        where: {
          tenantId,
          employeeId,
          date: { gte: startDate, lt: endDate },
        },
      });

      const summary = { PRESENT: 0, LATE: 0, ABSENT: 0, LEAVE: 0 };

      for (const log of logs) {
        if (log.status === AttendanceStatus.PRESENT) summary.PRESENT++;
        else if (log.status === AttendanceStatus.LATE) summary.LATE++;
        else if (log.status === AttendanceStatus.ABSENT) summary.ABSENT++;
        else if (log.status === AttendanceStatus.LEAVE) summary.LEAVE++;
      }

      return summary;
    } catch (error) {
      this.logger.error(
        `Error getting monthly summary for employee ${employeeId}`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve monthly summary',
      );
    }
  }
}
