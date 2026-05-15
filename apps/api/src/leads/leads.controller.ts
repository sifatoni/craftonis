import { Controller, Post, Get, Put, Body, Query, Param, UseGuards, Req, Res, Headers } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { LeadsService } from './leads.service';
import { Response } from 'express';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('search')
  async startScrape(@Req() req: any, @Body() body: any) {
    return this.leadsService.startScrape(req.user.tenantId, body);
  }

  @Post('cancel')
  async cancelScrape(@Body('jobId') jobId: string) {
    await this.leadsService.cancelScrape(jobId);
    return { success: true };
  }

  @Get()
  async getLeads(@Req() req: any, @Query() query: any) {
    return this.leadsService.getLeads(req.user.tenantId, query);
  }

  @Post(':id/reveal')
  async revealLead(@Req() req: any, @Param('id') leadId: string) {
    return this.leadsService.revealLead(req.user.tenantId, leadId);
  }

  @Post('bulk-reveal')
  async bulkReveal(@Req() req: any, @Body('leadIds') leadIds: string[]) {
    const count = await this.leadsService.bulkReveal(req.user.tenantId, leadIds);
    return { revealed: count };
  }

  @Put(':id/stage')
  async updateStage(
    @Req() req: any,
    @Param('id') leadId: string,
    @Body('stage') stage: string,
  ) {
    return this.leadsService.updateCrmStage(req.user.tenantId, leadId, stage);
  }

  @Get('export')
  async exportLeads(
    @Req() req: any,
    @Query() query: any,
    @Res() res: Response,
  ) {
    const format = query.format === 'excel' ? 'excel' : 'csv';
    const buffer = await this.leadsService.exportLeads(req.user.tenantId, format, query);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
    } else {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="leads.xlsx"');
    }

    res.send(buffer);
  }

  @Get('tokens/balance')
  async getTokenBalance(@Req() req: any) {
    const balance = await this.leadsService.getTokenBalance(req.user.tenantId);
    return { balance };
  }

  @Post('tokens/add')
  async addTokens(@Req() req: any, @Body('amount') amount: number) {
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Not allowed in production' };
    }
    const balance = await this.leadsService.addTokens(req.user.tenantId, amount || 10);
    return { balance };
  }
}
