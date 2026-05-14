import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { CvModule } from './modules/cv/cv.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DebugModule } from './modules/debug/debug.module';
import { InterviewsModule } from './modules/interviews/interviews.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { MeetingsModule } from './meetings/meetings.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
    }),
    DatabaseModule,
    CommonModule,
    AuthModule,
    WorkspaceModule,
    JobsModule,
    CvModule,
    AnalyticsModule,
    DebugModule, // ⚠️ TEMPORARY — remove before production
    InterviewsModule,
    QuestionsModule,
    MeetingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
