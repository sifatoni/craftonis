import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { api } from '@/lib/axios';

interface UseWebRTCParams {
  roomCode: string;
  userId: string;
  userName: string;
  isHost: boolean;
}

interface Participant {
  userId: string;
  userName: string;
  socketId: string;
  stream?: MediaStream;
}

const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useWebRTC({ roomCode, userId, userName, isHost }: UseWebRTCParams) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isWaiting, setIsWaiting] = useState(!isHost);
  const [waitingList, setWaitingList] = useState<Participant[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  const initSocketAndMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      localStreamRef.current = stream;
      originalVideoTrackRef.current = stream.getVideoTracks()[0];

      socketRef.current = io(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/meetings`);

      socketRef.current.on('connect', () => {
        if (isHost) {
          setIsWaiting(false);
          socketRef.current?.emit('join-room', { roomCode, userId, userName }, (response: { participants: Participant[] }) => {
            const others = response.participants.filter(p => p.userId !== userId);
            setParticipants(others);
          });
        } else {
          socketRef.current?.emit('request-join', { roomCode, userId, userName });
        }
      });

      socketRef.current.on('admitted', () => {
        setIsWaiting(false);
        socketRef.current?.emit('join-room', { roomCode, userId, userName }, (response: { participants: Participant[] }) => {
          const others = response.participants.filter(p => p.userId !== userId);
          setParticipants(others);
        });
      });

      socketRef.current.on('rejected', () => {
        // Redirection handled in page.tsx if needed, but we should do it here or let UI know
        window.location.href = '/meeting-ledger?rejected=true';
      });

      socketRef.current.on('kicked', () => {
        leaveRoom();
        window.location.href = '/meeting-ledger?kicked=true';
      });

      socketRef.current.on('guest-waiting', (guest: Participant) => {
        if (isHost) {
          setWaitingList(prev => {
            if (!prev.find(p => p.userId === guest.userId)) {
              return [...prev, guest];
            }
            return prev;
          });
        }
      });

      socketRef.current.on('user-joined', async (participant: Participant) => {
        setParticipants(prev => {
          if (!prev.find(p => p.userId === participant.userId)) {
            return [...prev, participant];
          }
          return prev;
        });

        const pc = createPeerConnection(participant.socketId);
        peerConnectionsRef.current.set(participant.socketId, pc);

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current!);
          });
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current?.emit('offer', { roomCode, offer, targetSocketId: participant.socketId });
      });

      socketRef.current.on('offer', async ({ offer, senderSocketId }: { offer: RTCSessionDescriptionInit, senderSocketId: string }) => {
        const pc = createPeerConnection(senderSocketId);
        peerConnectionsRef.current.set(senderSocketId, pc);

        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current!);
          });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current?.emit('answer', { roomCode, answer, targetSocketId: senderSocketId });
      });

      socketRef.current.on('answer', async ({ answer, senderSocketId }: { answer: RTCSessionDescriptionInit, senderSocketId: string }) => {
        const pc = peerConnectionsRef.current.get(senderSocketId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      });

      socketRef.current.on('ice-candidate', async ({ candidate, senderSocketId }: { candidate: RTCIceCandidateInit, senderSocketId: string }) => {
        const pc = peerConnectionsRef.current.get(senderSocketId);
        if (pc && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      });

      socketRef.current.on('user-left', ({ userId: leftUserId }: { userId: string }) => {
        setParticipants(prev => {
          const participant = prev.find(p => p.userId === leftUserId);
          if (participant) {
            const pc = peerConnectionsRef.current.get(participant.socketId);
            if (pc) {
              pc.close();
              peerConnectionsRef.current.delete(participant.socketId);
            }
          }
          return prev.filter(p => p.userId !== leftUserId);
        });
        
        // Also remove from waiting list if they were there
        if (isHost) {
          setWaitingList(prev => prev.filter(p => p.userId !== leftUserId));
        }
      });

      socketRef.current.on('meeting-ended', () => {
        leaveRoom();
        window.location.href = '/meeting-ledger';
      });

    } catch (err) {
      console.error('Failed to init media or socket', err);
    }
  };

  const createPeerConnection = (targetSocketId: string) => {
    const pc = new RTCPeerConnection({ iceServers });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('ice-candidate', {
          roomCode,
          candidate: event.candidate,
          targetSocketId,
        });
      }
    };

    pc.ontrack = (event) => {
      setParticipants(prev => prev.map(p => {
        if (p.socketId === targetSocketId) {
          return { ...p, stream: event.streams[0] };
        }
        return p;
      }));
    };

    return pc;
  };

  useEffect(() => {
    initSocketAndMedia();
    return () => leaveRoom();
  }, [roomCode, userId, isHost]);

  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicOn(audioTrack.enabled);
      }
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks().find(t => t.kind === 'video');
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCameraOn(videoTrack.enabled);
      }
    }
  }, []);

  const startScreenShare = async () => {
    if (isScreenSharing) {
      if (originalVideoTrackRef.current && localStreamRef.current) {
        const senders = Array.from(peerConnectionsRef.current.values()).map(pc => 
          pc.getSenders().find(s => s.track?.kind === 'video')
        );
        
        senders.forEach(sender => {
          if (sender) sender.replaceTrack(originalVideoTrackRef.current);
        });

        localStreamRef.current.getVideoTracks()[0].stop();
        localStreamRef.current.removeTrack(localStreamRef.current.getVideoTracks()[0]);
        localStreamRef.current.addTrack(originalVideoTrackRef.current);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setIsScreenSharing(false);
      }
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];

      screenTrack.onended = () => {
        startScreenShare();
      };

      if (localStreamRef.current) {
        const senders = Array.from(peerConnectionsRef.current.values()).map(pc => 
          pc.getSenders().find(s => s.track?.kind === 'video')
        );
        
        senders.forEach(sender => {
          if (sender) sender.replaceTrack(screenTrack);
        });

        localStreamRef.current.removeTrack(localStreamRef.current.getVideoTracks()[0]);
        localStreamRef.current.addTrack(screenTrack);
        setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.error('Failed to share screen', err);
    }
  };

  const leaveRoom = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room', { roomCode, userId });
      socketRef.current.disconnect();
    }

    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (originalVideoTrackRef.current) {
      originalVideoTrackRef.current.stop();
    }
  }, [roomCode, userId]);

  const endMeeting = useCallback(async () => {
    if (isHost && socketRef.current) {
      try {
        await api.put(`/meetings/${roomCode}/end`);
        socketRef.current.emit('end-meeting', { roomCode, hostId: userId });
        
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (originalVideoTrackRef.current) {
          originalVideoTrackRef.current.stop();
        }
        
        window.location.href = '/meeting-ledger';
      } catch (err) {
        console.error('Failed to end meeting API call', err);
      }
    }
  }, [roomCode, userId, isHost]);

  const admitGuest = useCallback((targetSocketId: string) => {
    if (isHost && socketRef.current) {
      socketRef.current.emit('admit-guest', { roomCode, targetSocketId });
      setWaitingList(prev => prev.filter(p => p.socketId !== targetSocketId));
    }
  }, [roomCode, isHost]);

  const rejectGuest = useCallback((targetSocketId: string) => {
    if (isHost && socketRef.current) {
      socketRef.current.emit('reject-guest', { roomCode, targetSocketId });
      setWaitingList(prev => prev.filter(p => p.socketId !== targetSocketId));
    }
  }, [roomCode, isHost]);

  const kickParticipant = useCallback((targetSocketId: string) => {
    if (isHost && socketRef.current) {
      socketRef.current.emit('kick-participant', { roomCode, targetSocketId });
    }
  }, [roomCode, isHost]);

  return {
    localStream,
    participants,
    toggleMic,
    toggleCamera,
    startScreenShare,
    leaveRoom,
    endMeeting,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    socket: socketRef.current,
    isWaiting,
    waitingList,
    admitGuest,
    rejectGuest,
    kickParticipant,
  };
}
