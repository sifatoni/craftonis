import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeStatus } from '@prisma/client';

@Injectable()
export class HrmService {
  private readonly logger = new Logger(HrmService.name);

  constructor(private readonly prisma: PrismaService) {}

  private sanitizeEmployeeData(data: any) {
    const sanitized = { ...data };
    
    // Convert empty strings to null
    Object.keys(sanitized).forEach(key => {
      if (sanitized[key] === '') {
        sanitized[key] = null;
      }
    });

    // Convert dates
    if (sanitized.dateOfBirth) {
      sanitized.dateOfBirth = new Date(sanitized.dateOfBirth);
    }
    if (sanitized.joinDate) {
      sanitized.joinDate = new Date(sanitized.joinDate);
    }

    // Convert numeric fields
    const numericFields = ['basicSalary', 'houseAllowance', 'transportAllowance', 'medicalAllowance', 'otherAllowance'];
    numericFields.forEach(field => {
      if (sanitized[field] !== undefined && sanitized[field] !== null) {
        sanitized[field] = Number(sanitized[field]);
      }
    });

    return sanitized;
  }

  async findAll(tenantId: string, filters: any) {
    try {
      const where: any = { tenantId };

      if (filters.departmentId) {
        where.departmentId = filters.departmentId;
      }
      if (filters.status) {
        where.status = filters.status;
      }
      if (filters.employmentType) {
        where.employmentType = filters.employmentType;
      }
      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search, mode: 'insensitive' } },
          { lastName: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      return await this.prisma.employee.findMany({
        where,
        include: {
          department: true,
          reportingTo: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Error finding employees for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to retrieve employees');
    }
  }

  async create(tenantId: string, dto: CreateEmployeeDto) {
    try {
      const sanitizedData = this.sanitizeEmployeeData(dto);

      return await this.prisma.employee.create({
        data: {
          tenantId,
          // Existing employee schema in your Prisma has a required 'userId'. Generating a placeholder
          // if it's missing from the new instruction's schema.
          userId: `usr_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          ...sanitizedData,
        },
      });
    } catch (error) {
      this.logger.error(`Error creating employee for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to create employee');
    }
  }

  async findOne(tenantId: string, id: string) {
    try {
      const employee = await this.prisma.employee.findFirst({
        where: { id, tenantId },
        include: {
          department: true,
          reportingTo: true,
        },
      });

      if (!employee) {
        throw new NotFoundException(`Employee with ID ${id} not found`);
      }

      return employee;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error finding employee ${id} for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to retrieve employee');
    }
  }

  async update(tenantId: string, id: string, dto: UpdateEmployeeDto) {
    try {
      const employee = await this.prisma.employee.findFirst({
        where: { id, tenantId },
      });

      if (!employee) {
        throw new NotFoundException(`Employee with ID ${id} not found`);
      }

      const sanitizedData = this.sanitizeEmployeeData(dto);

      return await this.prisma.employee.update({
        where: { id },
        data: sanitizedData,
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error updating employee ${id} for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to update employee');
    }
  }

  async archive(tenantId: string, id: string) {
    try {
      const employee = await this.prisma.employee.findFirst({
        where: { id, tenantId },
      });

      if (!employee) {
        throw new NotFoundException(`Employee with ID ${id} not found`);
      }

      return await this.prisma.employee.update({
        where: { id },
        data: {
          status: EmployeeStatus.INACTIVE,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      this.logger.error(`Error archiving employee ${id} for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to archive employee');
    }
  }

  async getOrgChart(tenantId: string) {
    try {
      const employees = await this.prisma.employee.findMany({
        where: { tenantId },
        include: {
          department: true,
        },
      });

      // Build nested tree
      const employeeMap = new Map();
      const roots: any[] = [];

      employees.forEach(emp => {
        employeeMap.set(emp.id, { ...emp, children: [] });
      });

      employees.forEach(emp => {
        if (emp.reportingToId && employeeMap.has(emp.reportingToId)) {
          employeeMap.get(emp.reportingToId).children.push(employeeMap.get(emp.id));
        } else {
          roots.push(employeeMap.get(emp.id));
        }
      });

      return roots;
    } catch (error) {
      this.logger.error(`Error generating org chart for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Failed to generate org chart');
    }
  }
}
