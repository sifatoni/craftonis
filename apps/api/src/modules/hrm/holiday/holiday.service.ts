import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { HolidayType } from '@prisma/client';

@Injectable()
export class HolidayService {
  private readonly logger = new Logger(HolidayService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, year: number) {
    try {
      const startDate = new Date(Date.UTC(year, 0, 1));
      const endDate = new Date(Date.UTC(year + 1, 0, 1));

      return await this.prisma.holiday.findMany({
        where: {
          tenantId,
          date: { gte: startDate, lt: endDate },
        },
        orderBy: { date: 'asc' },
      });
    } catch (error) {
      this.logger.error(`Error fetching holidays for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to retrieve holidays');
    }
  }

  async create(tenantId: string, dto: CreateHolidayDto) {
    try {
      return await this.prisma.holiday.create({
        data: {
          tenantId,
          name: dto.name,
          date: new Date(dto.date),
          type: dto.type ?? HolidayType.PUBLIC,
        },
      });
    } catch (error) {
      this.logger.error(`Error creating holiday for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to create holiday');
    }
  }

  async remove(tenantId: string, id: string) {
    try {
      const holiday = await this.prisma.holiday.findFirst({
        where: { id, tenantId },
      });

      if (!holiday) {
        throw new NotFoundException(`Holiday with ID ${id} not found`);
      }

      return await this.prisma.holiday.delete({ where: { id } });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error deleting holiday ${id} for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to delete holiday');
    }
  }
}
