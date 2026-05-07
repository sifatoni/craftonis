import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('kpis')
  @ApiOperation({ summary: 'Get dashboard KPI tiles' })
  getKpis(@CurrentUser() user: any) {
    return this.analyticsService.getKpis(user.tenantId);
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Get recruitment funnel data' })
  getFunnel(@CurrentUser() user: any) {
    return this.analyticsService.getFunnel(user.tenantId);
  }

  @Get('source-attribution')
  @ApiOperation({ summary: 'Get candidate source attribution' })
  getSourceAttribution(@CurrentUser() user: any) {
    return this.analyticsService.getSourceAttribution(user.tenantId);
  }

  @Get('department-heatmap')
  @ApiOperation({ summary: 'Get department hiring heat map' })
  getDepartmentHeatMap(@CurrentUser() user: any) {
    return this.analyticsService.getDepartmentHeatMap(user.tenantId);
  }

  @Get('activity-feed')
  @ApiOperation({ summary: 'Get chronological activity feed' })
  getActivityFeed(@CurrentUser() user: any) {
    return this.analyticsService.getActivityFeed(user.tenantId);
  }

  @Get('time-to-hire')
  @ApiOperation({ summary: 'Get average time to hire metrics' })
  getTimeToHire(@CurrentUser() user: any) {
    return this.analyticsService.getTimeToHire(user.tenantId);
  }
}
