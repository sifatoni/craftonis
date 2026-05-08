import {
  Controller, Get, Post, Body, Param,
  UseGuards, UseInterceptors, UploadedFile, UploadedFiles,
  ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CvService } from './cv.service';
import { ScoreCvDto } from './dto/score-cv.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('CV & Scoring')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cv')
export class CvController {
  constructor(private readonly cvService: CvService) {}

  @Post(':candidateId/parse')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Upload and parse CV PDF for a candidate' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async parseCv(
    @CurrentUser() user: any,
    @Param('candidateId') candidateId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: 'application/pdf' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.cvService.parseCv(candidateId, user.tenantId, file.buffer);
  }

  @Post('score')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Score a candidate CV against job description' })
  scoreCv(@CurrentUser() user: any, @Body() dto: ScoreCvDto) {
    return this.cvService.scoreCv(user.tenantId, dto);
  }

  @Get(':candidateId/scorecard')
  @ApiOperation({ summary: 'Get CV score card for a candidate' })
  getScoreCard(
    @CurrentUser() user: any,
    @Param('candidateId') candidateId: string,
  ) {
    return this.cvService.getScoreCard(user.tenantId, candidateId);
  }

  @Get('leaderboard/:jobId')
  @ApiOperation({ summary: 'Get ranked candidate leaderboard for a job' })
  getJobLeaderboard(
    @CurrentUser() user: any,
    @Param('jobId') jobId: string,
  ) {
    return this.cvService.getJobLeaderboard(user.tenantId, jobId);
  }

  @Post('bulk-parse/:jobId')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Bulk upload and parse multiple CV PDFs — auto-creates candidates' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 50))
  async bulkParseCvs(
    @CurrentUser() user: any,
    @Param('jobId') jobId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.cvService.bulkParseCvs(user.tenantId, jobId, files)
  }
}
