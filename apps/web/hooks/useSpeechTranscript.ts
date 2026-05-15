'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { Socket } from 'socket.io-client';
import { api } from '@/lib/axios';

interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestampMs: number;
  flagged: boolean;
}

interface UseSpeechTranscriptParams {
  roomCode: string;
  meetingId?: string; // Made optional since interview room doesn't use it
  userName: string;
  socket: Socket | null;
  isHost: boolean;
  endpoint?: string;
}

export function useSpeechTranscript({
  roomCode,
  meetingId,
  userName,
  socket,
  isHost,
  endpoint,
}: UseSpeechTranscriptParams) {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkIndexRef = useRef(0);
  const lastWordsRef = useRef('');
  const isRecordingRef = useRef(false);
  const overlapBufferRef = useRef<Blob[]>([]);
  const CHUNK_DURATION_MS = 60000; // 60 seconds

  // Listen for transcript lines from other participants via socket
  useEffect(() => {
    if (!socket) return;
    
    const handleTranscriptLine = (data: { speaker: string; text: string; timestampMs: number }) => {
      if (!data.text.trim()) return;
      setTranscript(prev => [...prev, {
        id: `${data.speaker}-${data.timestampMs}`,
        speaker: data.speaker,
        text: data.text,
        timestampMs: data.timestampMs,
        flagged: false,
      }]);
    };

    socket.on('transcript-line', handleTranscriptLine);
    return () => { socket.off('transcript-line', handleTranscriptLine); };
  }, [socket]);

  const sendChunk = useCallback(async (chunks: Blob[], mimeType: string) => {
    if (chunks.length === 0) return;
    
    const audioBlob = new Blob(chunks, { type: mimeType });
    if (audioBlob.size < 1000) return; // skip tiny/silent chunks
    
    const formData = new FormData();
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'webm';
    formData.append('audio', audioBlob, `chunk_${chunkIndexRef.current}.${ext}`);
    formData.append('speaker', userName);
    formData.append('roomCode', roomCode);
    formData.append('chunkIndex', String(chunkIndexRef.current));
    if (lastWordsRef.current) {
      formData.append('previousWords', lastWordsRef.current);
    }
    
    chunkIndexRef.current++;
    
    try {
      const url = endpoint || `/meetings/${meetingId}/transcribe-chunk`;
      const response = await api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const result = response.data;
      if (result.text) {
        // Update last words for next chunk context
        const words = result.text.split(' ');
        lastWordsRef.current = words.slice(-10).join(' ');
      }
    } catch (err) {
      console.error('[Transcript] Chunk send failed:', err);
    }
  }, [roomCode, meetingId, userName]);

  const startRecording = useCallback(async () => {
    if (isRecordingRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Determine best supported mime type
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/ogg';
      
      const startNewRecorder = () => {
        if (!streamRef.current) return;
        
        chunksRef.current = [...overlapBufferRef.current]; // start with overlap
        overlapBufferRef.current = [];
        
        const recorder = new MediaRecorder(streamRef.current, { mimeType });
        mediaRecorderRef.current = recorder;
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };
        
        recorder.onstop = async () => {
          const chunksToSend = [...chunksRef.current];
          // Save last 3 seconds as overlap for next chunk
          const overlapChunks = chunksToSend.slice(-2);
          overlapBufferRef.current = overlapChunks;
          
          await sendChunk(chunksToSend, mimeType);
          
          // Start next recorder if still recording
          if (isRecordingRef.current) {
            startNewRecorder();
          }
        };
        
        recorder.start(1000); // collect data every 1 second
        
        // Stop after 60 seconds to send chunk
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }, CHUNK_DURATION_MS);
      };
      
      isRecordingRef.current = true;
      startNewRecorder();
      
    } catch (err) {
      console.error('[Transcript] Microphone access failed:', err);
    }
  }, [sendChunk]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  // Auto-start recording on mount (silently for all participants)
  useEffect(() => {
    startRecording();
    return () => { stopRecording(); };
  }, [startRecording, stopRecording]);

  const toggleBookmark = useCallback(async (transcriptId: string) => {
    setTranscript(prev => prev.map(t => 
      t.id === transcriptId ? { ...t, flagged: !t.flagged } : t
    ));
    try {
      await api.put(`/meetings/transcripts/${transcriptId}/bookmark`);
    } catch (err) {
      console.error('[Transcript] Bookmark failed:', err);
    }
  }, []);

  return { transcript, toggleBookmark };
}
