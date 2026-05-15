import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { api } from '@/lib/axios';

interface UseInterviewRTCParams {
  roomCode: string;
  userId: string;
  userName: string;
  isInterviewer: boolean;
  onCodeUpdate?: (code: string, language: string) => void;
  onInterviewEnded?: () => void;
}

interface Participant {
  userId: string;
  userName: string;
  socketId: string;
  isInterviewer: boolean;
  stream?: MediaStream;
}

const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useInterviewRTC({ roomCode, userId, userName, isInterviewer, onCodeUpdate, onInterviewEnded }: UseInterviewRTCParams) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const originalVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const onCodeUpdateRef = useRef(onCodeUpdate);
  const onInterviewEndedRef = useRef(onInterviewEnded);

  useEffect(() => {
    onCodeUpdateRef.current = onCodeUpdate;
  }, [onCodeUpdate]);

  useEffect(() => {
    onInterviewEndedRef.current = onInterviewEnded;
  }, [onInterviewEnded]);

  const initSocketAndMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      localStreamRef.current = stream;
      originalVideoTrackRef.current = stream.getVideoTracks()[0];

      socketRef.current = io(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/interview-room`);

      socketRef.current.on('connect', () => {
        socketRef.current?.emit('join-room', { roomCode, userId, userName, isInterviewer }, (response: { participants: Participant[] }) => {
          const others = response.participants.filter(p => p.userId !== userId);
          setParticipants(others);
        });
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
      });

      socketRef.current.on('interview-ended', () => {
        leaveRoom();
        if (onInterviewEndedRef.current) {
          onInterviewEndedRef.current();
        }
      });

      socketRef.current.on('code-update', ({ code, language }: { code: string, language: string }) => {
        if (onCodeUpdateRef.current) {
          onCodeUpdateRef.current(code, language);
        }
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
  }, [roomCode, userId, isInterviewer]);

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

  const emitCodeChange = useCallback((code: string, language: string) => {
    if (socketRef.current) {
      socketRef.current.emit('code-change', { roomCode, code, language });
    }
  }, [roomCode]);

  return {
    localStream,
    participants,
    toggleMic,
    toggleCamera,
    startScreenShare,
    leaveRoom,
    isMicOn,
    isCameraOn,
    isScreenSharing,
    socket: socketRef.current,
    emitCodeChange,
  };
}
