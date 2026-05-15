import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ScrapeSignal } from './scrapers/google-search-scraper';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/leads' })
export class LeadsGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  static cancelSignals = new Map<string, ScrapeSignal>();

  emitProgress(clientId: string, data: any) {
    this.server.to(clientId).emit('leads:progress', data);
  }

  emitLeads(clientId: string, leads: any[]) {
    this.server.to(clientId).emit('leads:data', leads);
  }

  emitComplete(clientId: string, summary: any) {
    this.server.to(clientId).emit('leads:complete', summary);
  }

  emitError(clientId: string, message: string) {
    this.server.to(clientId).emit('leads:error', { message });
  }

  emitCaptcha(clientId: string, data: any) {
    this.server.to(clientId).emit('leads:captcha', data);
  }

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() data: { clientId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.clientId);
    return { joined: data.clientId };
  }

  @SubscribeMessage('cancel')
  handleCancel(@MessageBody() data: { jobId: string }) {
    const signal = LeadsGateway.cancelSignals.get(data.jobId);
    if (signal) signal.cancelled = true;
  }

  @SubscribeMessage('captcha:solved')
  handleCaptchaSolved(@MessageBody() data: { jobId: string }) {
    const signal = LeadsGateway.cancelSignals.get(data.jobId);
    if (signal) signal.captchaSolved = true;
  }

  handleDisconnect(client: Socket) {}
}
