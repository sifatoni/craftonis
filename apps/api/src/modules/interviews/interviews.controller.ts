import {
  Controller, Get, Post, Put, Patch, Body, Param,
  Query, UseGuards,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Role } from '@prisma/client'
import { InterviewsService } from './interviews.service'
import { CreateInterviewDto } from './dto/create-interview.dto'
import { UpdateInterviewDto } from './dto/update-interview.dto'
import { SubmitRatingsDto } from './dto/submit-ratings.dto'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Roles } from '../../common/decorators/roles.decorator'

@ApiTags('Interviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('interviews')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List all interviews' })
  getInterviews(
    @CurrentUser() user: any,
    @Query('candidateId') candidateId?: string,
    @Query('status') status?: string,
  ) {
    return this.interviewsService.getInterviews(user.tenantId, { candidateId, status })
  }

  @Get('questions')
  @ApiOperation({ summary: 'Get question bank by type' })
  getQuestions(
    @Query('type') type: string,
    @Query('department') department?: string,
  ) {
    return this.interviewsService.getQuestions(type, department)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get interview details' })
  getInterview(@CurrentUser() user: any, @Param('id') id: string) {
    return this.interviewsService.getInterview(user.tenantId, id)
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Schedule a new interview' })
  createInterview(@CurrentUser() user: any, @Body() dto: CreateInterviewDto) {
    return this.interviewsService.createInterview(user.tenantId, dto, user.id)
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Update a scheduled interview (type, scheduledAt, notes)' })
  updateInterview(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateInterviewDto,
  ) {
    return this.interviewsService.updateInterview(user.tenantId, id, dto)
  }

  @Put(':id/start')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Start interview session' })
  startInterview(@CurrentUser() user: any, @Param('id') id: string) {
    return this.interviewsService.startInterview(user.tenantId, id)
  }

  @Put(':id/submit')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Submit interview ratings and notes' })
  submitRatings(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: SubmitRatingsDto,
  ) {
    return this.interviewsService.submitRatings(user.tenantId, id, dto)
  }

  @Put(':id/cancel')
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Cancel an interview' })
  cancelInterview(@CurrentUser() user: any, @Param('id') id: string) {
    return this.interviewsService.cancelInterview(user.tenantId, id)
  }
}
