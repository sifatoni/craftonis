import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MinutesService {
  private readonly logger = new Logger(MinutesService.name);

  constructor(private prisma: PrismaService) {}

  async generateMinutes(meetingId: string): Promise<any> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { transcripts: { orderBy: { timestampMs: 'asc' } } },
    });

    if (!meeting) throw new Error('Meeting not found');

    const transcriptText = meeting.transcripts.length > 0
      ? meeting.transcripts
          .map(t => `[${Math.floor(t.timestampMs / 60000)}:${String(Math.floor((t.timestampMs % 60000) / 1000)).padStart(2, '0')}] ${t.speaker || 'Unknown'}: ${t.text}`)
          .join('\n')
      : 'No transcript available. Generate a professional template for meeting minutes.';

    const prompt = `IMPORTANT: Write ALL output in English only. Translate from any language if needed. Do not use any non-English words in the output.
You are a professional meeting minutes writer for a company HR platform called Craftonis.

Meeting Title: ${meeting.title || 'Untitled Meeting'}
Meeting Type: ${(meeting as any).meetingType || 'General'}
${(meeting as any).clientName ? `Client/Company: ${(meeting as any).clientName}` : ''}
Date: ${meeting.createdAt.toISOString().split('T')[0]}

TRANSCRIPT:
${transcriptText}

Generate meeting minutes. Return ONLY a JSON object with NO markdown, NO backticks, NO explanation:
{"summary":"2-3 sentence overview","keyPoints":["point 1","point 2","point 3"],"decisions":["decision 1"],"actionItems":[{"task":"task description","assignee":"person or Unknown","deadline":"deadline or TBD"}],"nextSteps":"brief next steps paragraph","sentiment":"positive"}`;

    // Try OpenRouter first
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://craftonis.com',
          'X-Title': 'Craftonis HR',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.1-8b-instruct:free',
          messages: [
            { role: 'system', content: 'You are a professional meeting minutes writer for Craftonis HR platform. CRITICAL RULES: 1) You MUST respond ONLY in English regardless of the language spoken in the transcript. 2) Even if the transcript is in Bangla, Hindi, Arabic, or any other language, translate everything and write the minutes in English only. 3) Respond ONLY with a valid JSON object. No markdown. No backticks. Start with { and end with }.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const raw = data.choices?.[0]?.message?.content || '';
        const clean = raw.replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
        const parsed = JSON.parse(clean);
        this.logger.log('OpenRouter success');
        return await this.saveMinutes(meetingId, parsed);
      } else {
        const errText = await response.text();
        this.logger.warn(`OpenRouter failed: ${response.status} - ${errText}`);
      }
    } catch (err: any) {
      this.logger.warn(`OpenRouter error: ${err.message}`);
    }

    // Fallback to Groq
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are a professional meeting minutes writer for Craftonis HR platform. CRITICAL RULES: 1) You MUST respond ONLY in English regardless of the language spoken in the transcript. 2) Even if the transcript is in Bangla, Hindi, Arabic, or any other language, translate everything and write the minutes in English only. 3) Respond ONLY with a valid JSON object. No markdown. No backticks. Start with { and end with }.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 1500,
          response_format: { type: 'json_object' },
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        const raw = data.choices?.[0]?.message?.content || '';
        const clean = raw.replace(/^[^{]*/, '').replace(/[^}]*$/, '').trim();
        const parsed = JSON.parse(clean);
        this.logger.log('Groq fallback success');
        return await this.saveMinutes(meetingId, parsed);
      } else {
        const errText = await response.text();
        this.logger.warn(`Groq failed: ${response.status} - ${errText}`);
      }
    } catch (err: any) {
      this.logger.error(`Groq error: ${err.message}`);
    }

    throw new Error('All AI providers failed to generate minutes');
  }

  private async saveMinutes(meetingId: string, data: any) {
    return this.prisma.meetingMinutes.upsert({
      where: { meetingId },
      create: {
        meetingId,
        summary: data.summary || '',
        decisions: data.decisions || [],
        actionItems: data.actionItems || [],
        keyPoints: data.keyPoints || [],
        nextSteps: data.nextSteps || '',
        sentiment: data.sentiment || 'neutral',
        approved: false,
      },
      update: {
        summary: data.summary || '',
        decisions: data.decisions || [],
        actionItems: data.actionItems || [],
        keyPoints: data.keyPoints || [],
        nextSteps: data.nextSteps || '',
        sentiment: data.sentiment || 'neutral',
      },
    });
  }

  async getMinutes(meetingId: string) {
    return this.prisma.meetingMinutes.findUnique({ where: { meetingId } });
  }
}
