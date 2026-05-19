import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { LeaveService } from './leave.service';
import { CreateLeaveDto } from './dto/create-leave.dto';
import { RejectLeaveDto } from './dto/reject-leave.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { LeaveStatus } from '@prisma/client';

@Controller('hrm/leave')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Post()
  async createLeave(@Req() req: any, @Body() dto: CreateLeaveDto) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub ?? req.user.id ?? req.user.userId;
    return this.leaveService.createLeave(userId, tenantId, dto);
  }

  @Get()
  async getLeaves(
    @Req() req: any,
    @Query('status') status?: LeaveStatus,
    @Query('employeeId') employeeId?: string,
  ) {
    const tenantId = req.user.tenantId;
    return this.leaveService.getLeaves(tenantId, { status, employeeId });
  }

  @Get('my')
  async getMyLeaves(@Req() req: any) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub ?? req.user.id ?? req.user.userId;
    return this.leaveService.getMyLeaves(userId, tenantId);
  }

  @Put(':id/approve')
  async approveLeave(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    const approverId = req.user.id;
    return this.leaveService.approveLeave(tenantId, id, approverId);
  }

  @Put(':id/reject')
  async rejectLeave(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: RejectLeaveDto,
  ) {
    const tenantId = req.user.tenantId;
    const approverId = req.user.id;
    return this.leaveService.rejectLeave(tenantId, id, approverId, dto);
  }

  @Delete(':id')
  async cancelLeave(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub ?? req.user.id ?? req.user.userId;
    return this.leaveService.cancelLeave(userId, tenantId, id);
  }
}
