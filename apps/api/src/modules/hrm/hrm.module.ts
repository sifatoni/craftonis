import { Module } from '@nestjs/common';
import { HrmController } from './hrm.controller';
import { HrmService } from './hrm.service';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule], // DatabaseModule exports PrismaService
  controllers: [HrmController, DepartmentController],
  providers: [HrmService, DepartmentService],
  exports: [HrmService, DepartmentService],
})
export class HrmModule {}
