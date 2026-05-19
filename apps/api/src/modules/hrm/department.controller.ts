import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('hrm/departments')
@UseGuards(JwtAuthGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  async findAll(@CurrentUser() user: any) {
    return this.departmentService.findAll(user.tenantId);
  }

  @Post()
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departmentService.create(user.tenantId, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: Partial<CreateDepartmentDto>,
  ) {
    return this.departmentService.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  async delete(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.departmentService.delete(user.tenantId, id);
  }
}
