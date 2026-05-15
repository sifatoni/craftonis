import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { sendInterviewRoomInviteEmail } from '../../services/email.service';
import { processTranscript } from '../../common/transcript-processor.util';

@Injectable()
export class InterviewRoomService {
  constructor(private prisma: PrismaService) {}

  async createRoom(interviewId: string) {
    const existing = await this.prisma.interviewRoom.findUnique({ where: { interviewId } });
    if (existing) return existing;

    const room = await this.prisma.interviewRoom.create({
      data: { interviewId, roomCode: uuidv4() },
    });

    const interview = await this.prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        candidate: { include: { tenant: { select: { name: true } } } },
        job: { select: { title: true } },
      },
    });

    if (interview && interview.candidate) {
      const roomLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/interview-room/${room.roomCode}?role=candidate`;
      try {
        await sendInterviewRoomInviteEmail({
          candidateEmail: interview.candidate.email,
          candidateName: interview.candidate.name,
          companyName: interview.candidate.tenant?.name || 'Craftonis',
          interviewType: Array.isArray(interview.types) ? interview.types.join(', ') : 'Interview',
          roomLink,
        });
      } catch (err) {
        console.error('Failed to send interview room invite email:', err);
      }
    }

    return room;
  }

  async getRoom(roomCode: string) {
    return this.prisma.interviewRoom.findUnique({
      where: { roomCode },
      include: {
        interview: {
          include: {
            candidate: true,
            job: true,
          },
        },
      },
    });
  }

  async endRoom(roomCode: string) {
    return this.prisma.interviewRoom.update({
      where: { roomCode },
      data: { status: 'ENDED', endedAt: new Date() },
    });
  }

  async updateCode(roomCode: string, codeContent: string, codeLanguage: string) {
    return this.prisma.interviewRoom.update({
      where: { roomCode },
      data: { codeContent, codeLanguage },
    });
  }

  async saveTranscript(roomCode: string, items: any[]) {
    const room = await this.prisma.interviewRoom.findUnique({ where: { roomCode } });
    const existing = (room?.transcript as any[]) || [];
    return this.prisma.interviewRoom.update({
      where: { roomCode },
      data: { transcript: [...existing, ...items] },
    });
  }

  async transcribeChunk(params: {
    audioBuffer: Buffer;
    audioMimeType: string;
    speaker: string;
    roomCode: string;
    previousWords?: string;
  }) {
    const FormData = require('form-data');
    const form = new FormData();
    const ext = params.audioMimeType.includes('webm') ? 'webm'
      : params.audioMimeType.includes('mp4') ? 'mp4' : 'webm';
    form.append('file', params.audioBuffer, { filename: `chunk.${ext}`, contentType: params.audioMimeType });
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'json');
    if (params.previousWords) form.append('prompt', params.previousWords);

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, ...form.getHeaders() },
      body: form,
    });
    if (!response.ok) throw new Error(`Groq error: ${await response.text()}`);
    const data = await response.json() as any;
    return { text: data.text?.trim() || '', speaker: params.speaker, timestampMs: Date.now() };
  }

  async generateAIScore(roomCode: string) {
    const room = await this.getRoom(roomCode);
    if (!room) throw new Error('Room not found');

    const transcriptItems = (room.transcript as any[] || []).map((t: any) => ({
      speaker: t.speaker || 'Unknown',
      text: t.text,
      timestampMs: t.timestampMs,
      flagged: t.flagged,
    }));

    const { text: processedTranscript, needsChunking, chunks } = processTranscript(transcriptItems);

    let transcriptText: string;

    if (needsChunking) {
      transcriptText = await this.summarizeChunksForScoring(chunks);
    } else {
      transcriptText = processedTranscript || 'No transcript available.';
    }

    const codeSection = room.codeContent
      ? `\nCANDIDATE CODE (${room.codeLanguage}):\n${room.codeContent}`
      : '';

    const interviewTypes = (room.interview as any).types || [];
    const candidateName = (room.interview as any).candidate?.name || 'Candidate';
    const jobTitle = (room.interview as any).job?.title || 'Position';

    const prompt = `You are an expert HR interviewer and technical assessor. Analyze this interview and provide objective scores.

IMPORTANT: Output ONLY in English regardless of transcript language.

Interview Type(s): ${interviewTypes.join(', ')}
Candidate: ${candidateName}
Role: ${jobTitle}

TRANSCRIPT:
${transcriptText}
${codeSection}

Analyze and score each dimension 0-100. Return ONLY valid JSON, no markdown:
{"communication":{"score":0,"notes":"assessment"},"technical":{"score":0,"notes":"assessment"},"behavioral":{"score":0,"notes":"assessment"},"overall":0,"summary":"2-3 sentence overall assessment in English","recommendation":"STRONG_YES"}

recommendation must be one of: STRONG_YES, YES, MAYBE, NO, STRONG_NO`;

    // Try OpenRouter first
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://craftonis.com',
          'X-Title': 'Craftonis HR',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.3-70b-instruct:free',
          messages: [
            { role: 'system', content: 'You are a JSON API. Output ONLY valid JSON. No markdown. No explanation.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });
      if (res.ok) {
        const data = await res.json() as any;
        const raw = data.choices?.[0]?.message?.content || '';
        const clean = raw.replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
        const score = JSON.parse(clean);
        await this.prisma.interviewRoom.update({ where: { roomCode }, data: { aiScore: score } });
        return score;
      }
    } catch (e: any) { console.warn('OpenRouter failed:', e.message); }

    // Groq fallback
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a JSON API. Output ONLY valid JSON object. No markdown.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
        response_format: { type: 'json_object' },
      }),
    });
    const data = await res.json() as any;
    const raw = data.choices?.[0]?.message?.content || '{}';
    const clean = raw.replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
    const score = JSON.parse(clean);
    await this.prisma.interviewRoom.update({ where: { roomCode }, data: { aiScore: score } });
    return score;
  }

  private async summarizeChunksForScoring(chunks: string[]): Promise<string> {
    const summaries: string[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const prompt = `Summarize this interview transcript portion (part ${i + 1} of ${chunks.length}). Focus on: candidate answers, communication style, technical knowledge shown, behavioral signals. Be concise. Plain text only.

TRANSCRIPT PART ${i + 1}:
${chunks[i]}`;

      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://craftonis.com',
            'X-Title': 'Craftonis HR',
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-3.3-70b-instruct:free',
            messages: [
              { role: 'system', content: 'You are an interview analyst. Output plain text summaries only.' },
              { role: 'user', content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 800,
          }),
        });
        if (res.ok) {
          const data = await res.json() as any;
          summaries.push(`[Part ${i + 1}]\n${data.choices?.[0]?.message?.content || ''}`);
        }
      } catch (e: any) {
        summaries.push(`[Part ${i + 1}] Summary unavailable`);
      }
    }

    return `[Long interview — summarized in ${chunks.length} parts]\n\n${summaries.join('\n\n')}`;
  }
}
