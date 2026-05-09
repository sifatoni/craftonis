import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { DebugController } from './debug.controller';
import { CvModule } from '../cv/cv.module';

/**
 * ⚠️ TEMPORARY DEBUG MODULE — Remove before production deployment.
 * Imports CvModule to access CvService without duplicating any logic.
 */
@Module({
  imports: [
    CvModule,
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  ],
  controllers: [DebugController],
})
export class DebugModule {}
