import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMeeting(tenantId: string, hostId: string, data: any) {
    const meeting = await this.prisma.meeting.create({
      data: {
        tenantId,
        hostId,
        title: data.title,
        scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : undefined,
        meetingType: data.meetingType,
        clientName: data.clientName,
        departmentId: data.departmentId,
        participants: data.participants,
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
        department: true,
        transcripts: true,
        minutes: {
          select: { id: true }
        }
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

  async transcribeChunk(params: {
    audioBuffer: Buffer;
    audioMimeType: string;
    speaker: string;
    roomCode: string;
    meetingId: string;
    previousWords?: string;
  }): Promise<{ text: string; speaker: string; timestampMs: number }> {
    const FormData = require('form-data');
    const form = new FormData();
    
    const ext = params.audioMimeType.includes('webm') ? 'webm'
      : params.audioMimeType.includes('mp4') ? 'mp4'
      : params.audioMimeType.includes('ogg') ? 'ogg'
      : 'webm';
  
    form.append('file', params.audioBuffer, {
      filename: `chunk.${ext}`,
      contentType: params.audioMimeType,
    });
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'json');
    if (params.previousWords) {
      form.append('prompt', params.previousWords);
    }
  
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        ...form.getHeaders(),
      },
      body: form as any,
    });
  
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Groq Whisper error: ${err}`);
    }
  
    const data = await response.json() as any;
    return {
      text: data.text?.trim() || '',
      speaker: params.speaker,
      timestampMs: Date.now(),
    };
  }

  async updateMeeting(id: string, data: { scheduledFor?: Date, title?: string, meetingType?: string, clientName?: string, participants?: any, departmentId?: string }) {
    return this.prisma.meeting.update({
      where: { id },
      data,
    });
  }

  async deleteMeeting(id: string) {
    // Delete associated records first
    await this.prisma.transcript.deleteMany({ where: { meetingId: id } });
    await this.prisma.meetingMinutes.deleteMany({ where: { meetingId: id } });
    
    // Delete the meeting
    return this.prisma.meeting.delete({ where: { id } });
  }
}
