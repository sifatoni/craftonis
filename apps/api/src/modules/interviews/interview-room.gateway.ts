import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface RoomParticipant {
  userId: string;
  userName: string;
  socketId: string;
  isInterviewer: boolean;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/interview-room' })
export class InterviewRoomGateway implements OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private rooms = new Map<string, Set<RoomParticipant>>();

  handleDisconnect(client: Socket) {
    this.rooms.forEach((participants, roomCode) => {
      const found = [...participants].find(p => p.socketId === client.id);
      if (found) {
        participants.delete(found);
        client.to(roomCode).emit('user-left', { userId: found.userId, socketId: found.socketId });
      }
    });
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(@MessageBody() data: { roomCode: string; userId: string; userName: string; isInterviewer: boolean }, @ConnectedSocket() client: Socket) {
    const { roomCode, userId, userName, isInterviewer } = data;
    client.join(roomCode);
    if (!this.rooms.has(roomCode)) this.rooms.set(roomCode, new Set());
    const participants = this.rooms.get(roomCode)!;
    participants.add({ userId, userName, socketId: client.id, isInterviewer });
    const others = [...participants].filter(p => p.socketId !== client.id);
    client.to(roomCode).emit('user-joined', { userId, userName, socketId: client.id, isInterviewer });
    return { participants: others };
  }

  @SubscribeMessage('offer')
  handleOffer(@MessageBody() data: { roomCode: string; offer: any; targetSocketId: string }, @ConnectedSocket() client: Socket) {
    this.server.to(data.targetSocketId).emit('offer', { offer: data.offer, senderSocketId: client.id });
  }

  @SubscribeMessage('answer')
  handleAnswer(@MessageBody() data: { roomCode: string; answer: any; targetSocketId: string }, @ConnectedSocket() client: Socket) {
    this.server.to(data.targetSocketId).emit('answer', { answer: data.answer, senderSocketId: client.id });
  }

  @SubscribeMessage('ice-candidate')
  handleIce(@MessageBody() data: { roomCode: string; candidate: any; targetSocketId: string }, @ConnectedSocket() client: Socket) {
    this.server.to(data.targetSocketId).emit('ice-candidate', { candidate: data.candidate, senderSocketId: client.id });
  }

  @SubscribeMessage('leave-room')
  handleLeave(@MessageBody() data: { roomCode: string; userId: string }, @ConnectedSocket() client: Socket) {
    const participants = this.rooms.get(data.roomCode);
    if (participants) {
      const found = [...participants].find(p => p.socketId === client.id);
      if (found) participants.delete(found);
    }
    client.to(data.roomCode).emit('user-left', { userId: data.userId, socketId: client.id });
    client.leave(data.roomCode);
  }

  @SubscribeMessage('end-interview')
  handleEnd(@MessageBody() data: { roomCode: string }, @ConnectedSocket() client: Socket) {
    this.server.to(data.roomCode).emit('interview-ended');
  }

  @SubscribeMessage('transcript-line')
  handleTranscript(@MessageBody() data: { roomCode: string; speaker: string; text: string; timestampMs: number }, @ConnectedSocket() client: Socket) {
    this.server.to(data.roomCode).emit('transcript-line', data);
  }

  @SubscribeMessage('code-change')
  handleCodeChange(@MessageBody() data: { roomCode: string; code: string; language: string }, @ConnectedSocket() client: Socket) {
    // Broadcast to all INTERVIEWERS in room (not back to sender)
    const participants = this.rooms.get(data.roomCode);
    if (participants) {
      [...participants]
        .filter(p => p.isInterviewer && p.socketId !== client.id)
        .forEach(p => {
          this.server.to(p.socketId).emit('code-update', { code: data.code, language: data.language });
        });
    }
  }
}
