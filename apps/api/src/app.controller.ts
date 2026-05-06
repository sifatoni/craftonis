import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth() {
    return {
      success: true,
      message: 'Craftonis API is running',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
