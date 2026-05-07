import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JobsService } from './jobs.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { CreateCandidateDto } from './dto/create-candidate.dto';
import { UpdateCandidateStageDto } from './dto/update-candidate-stage.dto';
import { JobQueryDto } from './dto/job-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Jobs & Candidates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  // ── JOBS ──────────────────────────────────────────
  @Get('jobs')
  @ApiOperation({ summary: 'List all jobs' })
  getJobs(@CurrentUser() user: any, @Query() query: JobQueryDto) {
    return this.jobsService.getJobs(user.tenantId, query);
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: 'Get job details' })
  getJob(@CurrentUser() user: any, @Param('id') id: string) {
    return this.jobsService.getJob(user.tenantId, id);
  }

  @Post('jobs')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Create a new job posting' })
  createJob(@CurrentUser() user: any, @Body() dto: CreateJobDto) {
    return this.jobsService.createJob(user.tenantId, dto);
  }

  @Put('jobs/:id')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Update a job posting' })
  updateJob(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobsService.updateJob(user.tenantId, id, dto);
  }

  @Delete('jobs/:id')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Archive a job posting' })
  deleteJob(@CurrentUser() user: any, @Param('id') id: string) {
    return this.jobsService.deleteJob(user.tenantId, id);
  }

  // ── CANDIDATES ────────────────────────────────────
  @Get('jobs/:jobId/candidates')
  @ApiOperation({ summary: 'List candidates for a job (sorted by score)' })
  getCandidates(
    @CurrentUser() user: any,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.getCandidates(user.tenantId, jobId);
  }

  @Get('jobs/:jobId/pipeline-stats')
  @ApiOperation({ summary: 'Get pipeline stage counts for a job' })
  getPipelineStats(
    @CurrentUser() user: any,
    @Param('jobId') jobId: string,
  ) {
    return this.jobsService.getPipelineStats(user.tenantId, jobId);
  }

  @Get('candidates/:id')
  @ApiOperation({ summary: 'Get full candidate 360 profile' })
  getCandidate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.jobsService.getCandidate(user.tenantId, id);
  }

  @Post('candidates')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Add a candidate manually' })
  createCandidate(@CurrentUser() user: any, @Body() dto: CreateCandidateDto) {
    return this.jobsService.createCandidate(user.tenantId, dto);
  }

  @Put('candidates/:id/stage')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Update candidate pipeline stage' })
  updateCandidateStage(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateCandidateStageDto,
  ) {
    return this.jobsService.updateCandidateStage(user.tenantId, id, dto);
  }

  @Post('jobs/:jobId/candidates/bulk')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Bulk add candidates to a job' })
  bulkUpload(
    @CurrentUser() user: any,
    @Param('jobId') jobId: string,
    @Body() candidates: CreateCandidateDto[],
  ) {
    return this.jobsService.bulkUploadCandidates(user.tenantId, jobId, candidates);
  }
}
