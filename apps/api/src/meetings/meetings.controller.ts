import { Controller, Get, Post, Put, Body, Param, UseGuards, Query } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('v1/meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  async createMeeting(
    @CurrentUser() user: any,
    @Body() body: { title?: string },
  ) {
    return this.meetingsService.createMeeting(user.tenantId, user.id, body.title);
  }

  @Get()
  async getMeetings(@CurrentUser() user: any) {
    return this.meetingsService.getAllMeetings(user.tenantId);
  }

  @Get(':roomCode')
  async getMeeting(@Param('roomCode') roomCode: string) {
    return this.meetingsService.getMeeting(roomCode);
  }

  @Put(':roomCode/end')
  async endMeeting(@Param('roomCode') roomCode: string) {
    return this.meetingsService.endMeeting(roomCode);
  }

  @Post(':meetingId/transcripts')
  async saveTranscripts(
    @Param('meetingId') meetingId: string,
    @Body() body: { items: { speaker: string; text: string; timestampMs: number; flagged: boolean }[] },
  ) {
    return this.meetingsService.saveTranscriptBatch(meetingId, body.items);
  }

  @Put('transcripts/:transcriptId/bookmark')
  async toggleBookmark(@Param('transcriptId') transcriptId: string) {
    return this.meetingsService.toggleBookmark(transcriptId);
  }

  @Get(':meetingId/transcripts')
  async getMeetingTranscripts(
    @Param('meetingId') meetingId: string,
    @Query('flaggedOnly') flaggedOnly?: boolean,
  ) {
    const meeting = await this.meetingsService.getMeetingWithTranscripts(meetingId, flaggedOnly);
    return meeting?.transcripts || [];
  }
}
