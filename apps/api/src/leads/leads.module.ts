import { Module } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { LeadsController } from './leads.controller';
import { LeadsGateway } from './leads.gateway';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, LeadsGateway],
  exports: [LeadsService],
})
export class LeadsModule {}
