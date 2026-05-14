import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMeeting(tenantId: string, hostId: string, title?: string) {
    const meeting = await this.prisma.meeting.create({
      data: {
        tenantId,
        hostId,
        title,
        status: 'SCHEDULED',
      },
    });

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/meeting/${meeting.roomCode}`;

    return {
      ...meeting,
      inviteLink,
    };
  }

  async getMeeting(roomCode: string) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { roomCode },
      include: {
        transcripts: {
          orderBy: { timestampMs: 'asc' },
        },
      },
    });

    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    return meeting;
  }

  async getAllMeetings(tenantId: string) {
    return this.prisma.meeting.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        transcripts: true,
      },
    });
  }

  async endMeeting(roomCode: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { roomCode } });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    return this.prisma.meeting.update({
      where: { roomCode },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
      },
    });
  }

  async saveTranscriptBatch(meetingId: string, items: { speaker: string; text: string; timestampMs: number; flagged: boolean }[]) {
    // Validate meeting exists
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) {
      throw new NotFoundException('Meeting not found');
    }

    if (items.length === 0) return { count: 0 };

    const result = await this.prisma.transcript.createMany({
      data: items.map(item => ({
        meetingId,
        speaker: item.speaker,
        text: item.text,
        timestampMs: item.timestampMs,
        flagged: item.flagged,
      })),
    });

    return { count: result.count };
  }

  async toggleBookmark(transcriptId: string) {
    const transcript = await this.prisma.transcript.findUnique({ where: { id: transcriptId } });
    if (!transcript) {
      throw new NotFoundException('Transcript not found');
    }

    return this.prisma.transcript.update({
      where: { id: transcriptId },
      data: {
        flagged: !transcript.flagged,
      },
    });
  }

  async getMeetingWithTranscripts(meetingId: string, flaggedOnly?: boolean) {
    return this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        transcripts: {
          where: flaggedOnly ? { flagged: true } : undefined,
          orderBy: { timestampMs: 'asc' },
        },
      },
    });
  }
}
