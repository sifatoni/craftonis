import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';

@Injectable()
export class DepartmentService {
  private readonly logger = new Logger(DepartmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    try {
      return await this.prisma.department.findMany({
        where: { tenantId },
        include: {
          _count: {
            select: { employees: true },
          },
        },
      });
    } catch (error) {
      this.logger.error(`Error finding departments for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to retrieve departments');
    }
  }

  async create(tenantId: string, dto: CreateDepartmentDto) {
    try {
      return await this.prisma.department.create({
        data: {
          tenantId,
          ...dto,
        },
      });
    } catch (error) {
      this.logger.error(`Error creating department for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to create department');
    }
  }

  async update(tenantId: string, id: string, dto: Partial<CreateDepartmentDto>) {
    try {
      const department = await this.prisma.department.findFirst({
        where: { id, tenantId },
      });

      if (!department) {
        throw new NotFoundException(`Department with ID ${id} not found`);
      }

      return await this.prisma.department.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error updating department ${id} for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to update department');
    }
  }

  async delete(tenantId: string, id: string) {
    try {
      const department = await this.prisma.department.findFirst({
        where: { id, tenantId },
        include: {
          _count: {
            select: { employees: true },
          },
        },
      });

      if (!department) {
        throw new NotFoundException(`Department with ID ${id} not found`);
      }

      if (department._count.employees > 0) {
        throw new BadRequestException('Cannot delete department with assigned employees');
      }

      return await this.prisma.department.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) throw error;
      this.logger.error(`Error deleting department ${id} for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to delete department');
    }
  }
}
