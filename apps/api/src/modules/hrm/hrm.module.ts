import { Module } from '@nestjs/common';
import { HrmController } from './hrm.controller';
import { HrmService } from './hrm.service';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { DatabaseModule } from '../../database/database.module';
import { AttendanceModule } from './attendance/attendance.module';
import { LeaveModule } from './leave/leave.module';
import { HolidayModule } from './holiday/holiday.module';

@Module({
  imports: [DatabaseModule, AttendanceModule, LeaveModule, HolidayModule],
  controllers: [HrmController, DepartmentController],
  providers: [HrmService, DepartmentService],
  exports: [HrmService, DepartmentService],
})
export class HrmModule {}

