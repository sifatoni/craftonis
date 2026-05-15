import { Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OnboardingService } from './onboarding.service';
import { FileInterceptor } from '@nestjs/platform-express';
const pdfParse = require('pdf-parse');
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Get()
  async getPlans(@Request() req: any, @Query('candidateId') candidateId?: string) {
    return this.onboardingService.getPlans(req.user.tenantId, candidateId);
  }

  @Post()
  async createPlan(@Request() req: any, @Body() body: any) {
    return this.onboardingService.createPlan(req.user.tenantId, body);
  }

  @Put('weeks/:weekId')
  async updateWeek(@Param('weekId') weekId: string, @Body() body: any) {
    return this.onboardingService.updateWeek(weekId, body);
  }

  @Post('weeks/:weekId/tasks')
  async addTask(@Param('weekId') weekId: string, @Body() body: any) {
    return this.onboardingService.addTask(weekId, body);
  }

  @Put('tasks/:taskId')
  async updateTask(@Param('taskId') taskId: string, @Body() body: any) {
    return this.onboardingService.updateTask(taskId, body);
  }

  @Delete('tasks/:taskId')
  async deleteTask(@Param('taskId') taskId: string) {
    return this.onboardingService.deleteTask(taskId);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    const text = await this.onboardingService.uploadDocument(id, file);
    return { success: true, textPreview: text.substring(0, 200) };
  }

  @Delete('documents/:documentId')
  async deleteDocument(@Param('documentId') documentId: string) {
    return this.onboardingService.deleteDocument(documentId);
  }

  @Get(':id')
  async getPlan(@Param('id') id: string) {
    return this.onboardingService.getPlan(id);
  }

  @Put(':id')
  async updatePlan(@Param('id') id: string, @Body() body: any) {
    return this.onboardingService.updatePlan(id, body);
  }

  @Delete(':id')
  async deletePlan(@Param('id') id: string) {
    return this.onboardingService.deletePlan(id);
  }

  @Post(':id/generate')
  async generateAIPlan(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    const plan = await this.onboardingService.getPlan(id);
    if (!plan) throw new Error('Plan not found');
    
    // Extract text from base64 files
    const documentContents: string[] = [];
    if (plan.documents && plan.documents.length > 0) {
      for (const doc of plan.documents) {
        if (doc.fileUrl && doc.fileUrl.startsWith('base64:')) {
          const base64Str = doc.fileUrl.replace('base64:', '');
          const buffer = Buffer.from(base64Str, 'base64');
          const ext = doc.fileName.split('.').pop()?.toLowerCase();
          try {
            if (ext === 'txt' || ext === 'csv') {
              documentContents.push(buffer.toString('utf-8'));
            } else if (ext === 'pdf') {
              const data = await pdfParse(buffer);
              documentContents.push(data.text);
            } else if (ext === 'docx') {
              const result = await mammoth.extractRawText({ buffer });
              documentContents.push(result.value);
            } else if (ext === 'xlsx') {
              const wb = XLSX.read(buffer);
              const ws = wb.Sheets[wb.SheetNames[0]];
              documentContents.push(XLSX.utils.sheet_to_csv(ws));
            }
          } catch (e) {
            console.warn('Failed to parse document for AI generation:', doc.fileName);
          }
        }
      }
    }

    return this.onboardingService.generateAIPlan(req.user.tenantId, {
      planId: id,
      candidateId: plan.candidateId,
      jobId: plan.jobId || undefined,
      durationDays: body.durationDays || plan.durationDays,
      documentContents,
    });
  }

  @Get(':id/progress')
  async getProgress(@Param('id') id: string) {
    return this.onboardingService.getProgress(id);
  }
}
