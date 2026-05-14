import { Module } from '@nestjs/common';
import { MeetingsGateway } from './meetings.gateway';
import { MeetingsService } from './meetings.service';
import { MinutesService } from './minutes.service';
import { MeetingsController } from './meetings.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [MeetingsGateway, MeetingsService, MinutesService],
  controllers: [MeetingsController],
  exports: [MeetingsService, MinutesService],
})
export class MeetingsModule {}
