import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards, Query, HttpException, HttpStatus, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MeetingsService } from './meetings.service';
import { MinutesService } from './minutes.service';
import { MeetingsGateway } from './meetings.gateway';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('meetings')
export class MeetingsController {
  constructor(
    private readonly meetingsService: MeetingsService,
    private readonly minutesService: MinutesService,
    private readonly meetingsGateway: MeetingsGateway
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createMeeting(
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    return this.meetingsService.createMeeting(user.tenantId, user.id, body);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getMeetings(@CurrentUser() user: any) {
    return this.meetingsService.getAllMeetings(user.tenantId);
  }

  @Get(':roomCode')
  async getMeeting(@Param('roomCode') roomCode: string) {
    return this.meetingsService.getMeeting(roomCode);
  }

  /**
   * POST /meetings/:roomCode/end
   *
   * Ends the meeting for ALL participants:
   *   1. Marks the meeting status as ENDED in the database (sets endedAt timestamp).
   *   2. Broadcasts the 'meeting-ended' socket event so all connected clients navigate away.
   *
   * Previously only PUT was available and the socket broadcast was done client-side after the
   * PUT returned — meaning if the PUT failed silently the socket event was never emitted, and
   * vice-versa. This endpoint combines both operations atomically on the server.
   */
  @Post(':roomCode/end')
  @UseGuards(JwtAuthGuard)
  async endMeetingPost(
    @Param('roomCode') roomCode: string,
    @CurrentUser() user: any,
  ) {
    const meeting = await this.meetingsService.endMeeting(roomCode);
    // Broadcast to all participants so their clients navigate away automatically
    this.meetingsGateway.server.to(roomCode).emit('meeting-ended');
    return { success: true, meeting };
  }

  /**
   * PUT /meetings/:roomCode/end  (kept for backwards compatibility)
   *
   * Same as POST but without the gateway broadcast — the client is expected to
   * emit 'end-meeting' via socket itself (legacy behaviour).
   */
  @Put(':roomCode/end')
  @UseGuards(JwtAuthGuard)
  async endMeetingPut(@Param('roomCode') roomCode: string) {
    return this.meetingsService.endMeeting(roomCode);
  }

  /**
   * POST /meetings/:roomCode/leave
   *
   * Removes a participant from the meeting on the backend.
   * This is a lightweight record-keeping call — the actual WebRTC/socket cleanup
   * is handled by the gateway's disconnect event handler, so this endpoint is
   * non-critical and always returns success even if the participant wasn't tracked.
   */
  @Post(':roomCode/leave')
  async leaveMeeting(
    @Param('roomCode') roomCode: string,
    @Body() body: { userId?: string },
  ) {
    await this.meetingsService.leaveMeeting(roomCode, body.userId);
    return { success: true };
  }

  @Post(':meetingId/transcripts')
  @UseGuards(JwtAuthGuard)
  async saveTranscripts(
    @Param('meetingId') meetingId: string,
    @Body() body: { items: { speaker: string; text: string; timestampMs: number; flagged: boolean }[] },
  ) {
    return this.meetingsService.saveTranscriptBatch(meetingId, body.items);
  }

  @Put('transcripts/:transcriptId/bookmark')
  @UseGuards(JwtAuthGuard)
  async toggleBookmark(@Param('transcriptId') transcriptId: string) {
    return this.meetingsService.toggleBookmark(transcriptId);
  }

  @Get(':meetingId/transcripts')
  @UseGuards(JwtAuthGuard)
  async getMeetingTranscripts(
    @Param('meetingId') meetingId: string,
    @Query('flaggedOnly') flaggedOnly?: boolean,
  ) {
    const meeting = await this.meetingsService.getMeetingWithTranscripts(meetingId, flaggedOnly);
    return meeting?.transcripts || [];
  }

  @Post(':meetingId/transcribe-chunk')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('audio'))
  async transcribeChunk(
    @Param('meetingId') meetingId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { speaker: string; roomCode: string; chunkIndex: string; previousWords?: string }
  ) {
    if (!file) {
      throw new HttpException('Audio file missing', HttpStatus.BAD_REQUEST);
    }
    
    const result = await this.meetingsService.transcribeChunk({
      audioBuffer: file.buffer,
      audioMimeType: file.mimetype,
      speaker: body.speaker,
      roomCode: body.roomCode,
      meetingId,
      previousWords: body.previousWords,
    });

    if (result.text) {
      await this.meetingsService.saveTranscriptBatch(meetingId, [{
        speaker: result.speaker,
        text: result.text,
        timestampMs: result.timestampMs,
        flagged: false,
      }]);

      this.meetingsGateway.server.to(body.roomCode).emit('transcript-line', {
        speaker: result.speaker,
        text: result.text,
        timestampMs: result.timestampMs,
      });
    }

    return result;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async updateMeeting(
    @Param('id') id: string,
    @Body() body: { scheduledFor?: Date; title?: string; meetingType?: string; clientName?: string; participants?: any; departmentId?: string },
  ) {
    return this.meetingsService.updateMeeting(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteMeeting(@Param('id') id: string) {
    await this.meetingsService.deleteMeeting(id);
    return { success: true };
  }

  @Post(':meetingId/generate-minutes')
  @UseGuards(JwtAuthGuard)
  async generateMinutes(@Param('meetingId') meetingId: string) {
    try {
      return await this.minutesService.generateMinutes(meetingId);
    } catch (error: any) {
      throw new HttpException(error.message || 'Failed to generate minutes', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':meetingId/minutes')
  @UseGuards(JwtAuthGuard)
  async getMinutes(@Param('meetingId') meetingId: string) {
    return this.minutesService.getMinutes(meetingId);
  }
}
