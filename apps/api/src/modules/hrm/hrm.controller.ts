import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { HrmService } from './hrm.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('hrm')
@UseGuards(JwtAuthGuard)
export class HrmController {
  constructor(private readonly hrmService: HrmService) {}

  @Get('employees')
  async findAll(
    @CurrentUser() user: any,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: string,
    @Query('employmentType') employmentType?: string,
    @Query('search') search?: string,
  ) {
    return this.hrmService.findAll(user.tenantId, { departmentId, status, employmentType, search });
  }

  @Post('employees')
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.hrmService.create(user.tenantId, dto);
  }

  @Get('employees/:id')
  async findOne(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.hrmService.findOne(user.tenantId, id);
  }

  @Put('employees/:id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.hrmService.update(user.tenantId, id, dto);
  }

  @Delete('employees/:id')
  async archive(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.hrmService.archive(user.tenantId, id);
  }

  @Get('org-chart')
  async getOrgChart(@CurrentUser() user: any) {
    return this.hrmService.getOrgChart(user.tenantId);
  }
}
