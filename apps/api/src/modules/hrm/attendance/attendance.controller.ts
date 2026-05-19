import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CheckinDto } from './dto/checkin.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

@Controller('hrm/attendance')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('checkin')
  async checkin(@Req() req: any, @Body() dto: CheckinDto) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub ?? req.user.id ?? req.user.userId;
    return this.attendanceService.checkin(userId, tenantId, dto);
  }

  @Post('checkout')
  async checkout(@Req() req: any) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub ?? req.user.id ?? req.user.userId;
    return this.attendanceService.checkout(userId, tenantId);
  }

  @Get('today')
  async getTodayStatus(@Req() req: any) {
    const tenantId = req.user.tenantId;
    const userId = req.user.sub ?? req.user.id ?? req.user.userId;
    return this.attendanceService.getTodayStatus(userId, tenantId);
  }

  @Get(':employeeId/summary')
  async getMonthlySummary(
    @Req() req: any,
    @Param('employeeId') employeeId: string,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    const tenantId = req.user.tenantId;
    return this.attendanceService.getMonthlySummary(
      tenantId,
      employeeId,
      month,
      year,
    );
  }

  @Get(':employeeId')
  async getLogs(
    @Req() req: any,
    @Param('employeeId') employeeId: string,
    @Query('month', ParseIntPipe) month: number,
    @Query('year', ParseIntPipe) year: number,
  ) {
    const tenantId = req.user.tenantId;
    return this.attendanceService.getLogs(tenantId, employeeId, month, year);
  }
}
