import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): string {
    return 'Craftonis API v1.0.0 - OK';
  }
}
