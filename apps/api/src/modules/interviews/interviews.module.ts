import { Module } from '@nestjs/common'
import { InterviewsController } from './interviews.controller'
import { InterviewsService } from './interviews.service'
import { InterviewRoomService } from './interview-room.service'
import { InterviewRoomGateway } from './interview-room.gateway'
import { MulterModule } from '@nestjs/platform-express'

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 50 * 1024 * 1024, // 50 MB
      },
    }),
  ],
  controllers: [InterviewsController],
  providers: [InterviewsService, InterviewRoomService, InterviewRoomGateway],
  exports: [InterviewsService, InterviewRoomService],
})
export class InterviewsModule {}
