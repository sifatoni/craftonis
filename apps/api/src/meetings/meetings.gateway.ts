import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface Participant {
  userId: string;
  userName: string;
  socketId: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/meetings' })
export class MeetingsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  // roomCode -> Set<Participant>
  private rooms = new Map<string, Set<Participant>>();
  // roomCode -> Set<Participant>
  private waitingRooms = new Map<string, Set<Participant>>();
  // socketId -> roomCode
  private socketToRoom = new Map<string, string>();

  handleConnection(client: Socket) {
    console.log(`[MeetingsGateway] Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[MeetingsGateway] Client disconnected: ${client.id}`);
    const roomCode = this.socketToRoom.get(client.id);
    if (roomCode) {
      // Clean up from main room
      const room = this.rooms.get(roomCode);
      if (room) {
        let disconnectedParticipant: Participant | undefined;
        room.forEach((p) => {
          if (p.socketId === client.id) {
            disconnectedParticipant = p;
            room.delete(p);
          }
        });

        if (disconnectedParticipant) {
          this.server.to(roomCode).emit('user-left', { userId: disconnectedParticipant.userId });
        }

        if (room.size === 0) {
          this.rooms.delete(roomCode);
        }
      }

      // Clean up from waiting room
      const waitingRoom = this.waitingRooms.get(roomCode);
      if (waitingRoom) {
        waitingRoom.forEach((p) => {
          if (p.socketId === client.id) {
            waitingRoom.delete(p);
          }
        });
        if (waitingRoom.size === 0) {
          this.waitingRooms.delete(roomCode);
        }
      }

      this.socketToRoom.delete(client.id);
    }
  }

  @SubscribeMessage('request-join')
  handleRequestJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; userId: string; userName: string },
  ) {
    const { roomCode, userId, userName } = payload;
    this.socketToRoom.set(client.id, roomCode);

    if (!this.waitingRooms.has(roomCode)) {
      this.waitingRooms.set(roomCode, new Set());
    }

    const participant = { userId, userName, socketId: client.id };
    this.waitingRooms.get(roomCode)!.add(participant);

    // Emit to room (host will listen)
    this.server.to(roomCode).emit('guest-waiting', participant);
  }

  @SubscribeMessage('admit-guest')
  handleAdmitGuest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; targetSocketId: string },
  ) {
    const { roomCode, targetSocketId } = payload;
    
    // Find and remove from waiting room
    const waitingRoom = this.waitingRooms.get(roomCode);
    if (waitingRoom) {
      waitingRoom.forEach((p) => {
        if (p.socketId === targetSocketId) {
          waitingRoom.delete(p);
        }
      });
    }

    // Tell the guest they are admitted
    this.server.to(targetSocketId).emit('admitted');
  }

  @SubscribeMessage('reject-guest')
  handleRejectGuest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; targetSocketId: string },
  ) {
    const { roomCode, targetSocketId } = payload;
    
    // Find and remove from waiting room
    const waitingRoom = this.waitingRooms.get(roomCode);
    if (waitingRoom) {
      waitingRoom.forEach((p) => {
        if (p.socketId === targetSocketId) {
          waitingRoom.delete(p);
        }
      });
    }

    this.server.to(targetSocketId).emit('rejected');
  }

  @SubscribeMessage('kick-participant')
  handleKickParticipant(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; targetSocketId: string },
  ) {
    const { roomCode, targetSocketId } = payload;
    
    // Tell the participant they are kicked
    this.server.to(targetSocketId).emit('kicked');
    
    // The client will disconnect on its own, which triggers user-left automatically,
    // but we can also manually emit user-left to others right away for responsiveness
    const room = this.rooms.get(roomCode);
    if (room) {
      let kickedUserId: string | undefined;
      room.forEach((p) => {
        if (p.socketId === targetSocketId) {
          kickedUserId = p.userId;
        }
      });
      if (kickedUserId) {
        this.server.to(roomCode).emit('user-left', { userId: kickedUserId });
      }
    }
  }

  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; userId: string; userName: string },
  ) {
    const { roomCode, userId, userName } = payload;
    client.join(roomCode);
    this.socketToRoom.set(client.id, roomCode);

    if (!this.rooms.has(roomCode)) {
      this.rooms.set(roomCode, new Set());
    }

    const room = this.rooms.get(roomCode)!;
    
    // Remove if already exists with same userId (e.g., reconnect)
    room.forEach((p) => {
      if (p.userId === userId) {
        room.delete(p);
      }
    });

    const participant = { userId, userName, socketId: client.id };
    room.add(participant);

    // Notify others in the room
    client.to(roomCode).emit('user-joined', participant);

    // Return current participants to the joining client
    return { participants: Array.from(room) };
  }

  @SubscribeMessage('offer')
  handleOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; offer: any; targetSocketId: string },
  ) {
    client.to(payload.targetSocketId).emit('offer', {
      offer: payload.offer,
      senderSocketId: client.id,
    });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; answer: any; targetSocketId: string },
  ) {
    client.to(payload.targetSocketId).emit('answer', {
      answer: payload.answer,
      senderSocketId: client.id,
    });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; candidate: any; targetSocketId: string },
  ) {
    client.to(payload.targetSocketId).emit('ice-candidate', {
      candidate: payload.candidate,
      senderSocketId: client.id,
    });
  }

  @SubscribeMessage('leave-room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; userId: string },
  ) {
    client.leave(payload.roomCode);
    this.handleDisconnect(client);
  }

  @SubscribeMessage('end-meeting')
  handleEndMeeting(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; hostId: string },
  ) {
    this.server.to(payload.roomCode).emit('meeting-ended');
  }

  @SubscribeMessage('transcript-line')
  handleTranscriptLine(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomCode: string; speaker: string; text: string; timestampMs: number },
  ) {
    this.server.to(payload.roomCode).emit('transcript-line', payload);
  }
}
