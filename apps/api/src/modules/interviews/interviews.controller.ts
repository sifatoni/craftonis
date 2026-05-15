import {
  Controller, Get, Post, Put, Patch, Body, Param,
  Query, UseGuards, UseInterceptors, UploadedFile, HttpException, HttpStatus
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
import { InterviewRoomService } from './interview-room.service'
import { InterviewRoomGateway } from './interview-room.gateway'
import { FileInterceptor } from '@nestjs/platform-express'

@ApiTags('Interviews')
@ApiBearerAuth()
@Controller('interviews')
export class InterviewsController {
  constructor(
    private readonly interviewsService: InterviewsService,
    private readonly interviewRoomService: InterviewRoomService,
    private readonly interviewRoomGateway: InterviewRoomGateway
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'List all interviews' })
  getInterviews(
    @CurrentUser() user: any,
    @Query('candidateId') candidateId?: string,
    @Query('status') status?: string,
  ) {
    return this.interviewsService.getInterviews(user.tenantId, { candidateId, status })
  }

  @Get('questions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get question bank by type' })
  getQuestions(
    @Query('type') type: string,
    @Query('department') department?: string,
  ) {
    return this.interviewsService.getQuestions(type, department)
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get interview details' })
  getInterview(@CurrentUser() user: any, @Param('id') id: string) {
    return this.interviewsService.getInterview(user.tenantId, id)
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Schedule a new interview' })
  createInterview(@CurrentUser() user: any, @Body() dto: CreateInterviewDto) {
    return this.interviewsService.createInterview(user.tenantId, dto, user.id)
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Start interview session' })
  startInterview(@CurrentUser() user: any, @Param('id') id: string) {
    return this.interviewsService.startInterview(user.tenantId, id)
  }

  @Put(':id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER)
  @ApiOperation({ summary: 'Cancel an interview' })
  cancelInterview(@CurrentUser() user: any, @Param('id') id: string) {
    return this.interviewsService.cancelInterview(user.tenantId, id)
  }

  // ── INTERVIEW ROOM ENDPOINTS ──────────────────────────────

  @Post(':id/room')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Create an interview room' })
  async createRoom(@CurrentUser() user: any, @Param('id') id: string) {
    const room = await this.interviewRoomService.createRoom(id)
    await this.interviewsService.startInterview(user.tenantId, id)
    return { roomCode: room.roomCode, id: room.id }
  }

  @Get('room/:roomCode')
  @ApiOperation({ summary: 'Get interview room details (Public)' })
  getRoom(@Param('roomCode') roomCode: string) {
    // Public endpoint so candidates can fetch without login
    return this.interviewRoomService.getRoom(roomCode)
  }

  @Put('room/:roomCode/end')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER, Role.INTERVIEWER)
  @ApiOperation({ summary: 'End the interview room session' })
  endRoom(@Param('roomCode') roomCode: string) {
    return this.interviewRoomService.endRoom(roomCode)
  }

  @Post('room/:roomCode/transcribe-chunk')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @UseInterceptors(FileInterceptor('audio'))
  async transcribeChunk(
    @Param('roomCode') roomCode: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { speaker: string; previousWords?: string }
  ) {
    if (!file) {
      throw new HttpException('Audio file missing', HttpStatus.BAD_REQUEST)
    }

    const result = await this.interviewRoomService.transcribeChunk({
      audioBuffer: file.buffer,
      audioMimeType: file.mimetype,
      speaker: body.speaker,
      roomCode,
      previousWords: body.previousWords,
    })

    if (result.text) {
      await this.interviewRoomService.saveTranscript(roomCode, [{
        speaker: result.speaker,
        text: result.text,
        timestampMs: result.timestampMs,
      }])

      this.interviewRoomGateway.server.to(roomCode).emit('transcript-line', {
        speaker: result.speaker,
        text: result.text,
        timestampMs: result.timestampMs,
      })
    }

    return result
  }

  @Post('room/:roomCode/generate-score')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.HR_MANAGER, Role.INTERVIEWER)
  @ApiOperation({ summary: 'Generate AI score for the interview room' })
  generateScore(@Param('roomCode') roomCode: string) {
    return this.interviewRoomService.generateAIScore(roomCode)
  }

  @Patch('room/:roomCode/code')
  @ApiOperation({ summary: 'Update candidate submitted code (Public)' })
  updateCode(
    @Param('roomCode') roomCode: string,
    @Body() body: { code: string; language: string }
  ) {
    // This is called by candidate so it must be public
    return this.interviewRoomService.updateCode(roomCode, body.code, body.language)
  }
}
