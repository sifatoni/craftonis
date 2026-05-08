import { Module } from '@nestjs/common'
import { JobsController } from './jobs.controller'
import { JobsService } from './jobs.service'
import { CvModule } from '../cv/cv.module'
import { MulterModule } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'

@Module({
  imports: [
    CvModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
