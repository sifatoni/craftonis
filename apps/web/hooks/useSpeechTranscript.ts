import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/axios';
import { Socket } from 'socket.io-client';

interface TranscriptLine {
  id: string;
  speaker: string;
  text: string;
  timestampMs: number;
  flagged: boolean;
  isTemp?: boolean;
}

export function useSpeechTranscript(meetingId: string | undefined, roomCode: string, userName: string, socket: Socket | null) {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const startTimeRef = useRef<number>(Date.now());
  const unsavedBatchRef = useRef<TranscriptLine[]>([]);

  useEffect(() => {
    if (!socket) return;

    socket.on('transcript-line', (line: TranscriptLine) => {
      setTranscript(prev => [...prev, { ...line, isTemp: true, id: Math.random().toString() }]);
    });

    return () => {
      socket.off('transcript-line');
    };
  }, [socket]);

  useEffect(() => {
    // Auto-batch every 10 seconds
    const interval = setInterval(async () => {
      if (unsavedBatchRef.current.length > 0 && meetingId) {
        const batch = [...unsavedBatchRef.current];
        unsavedBatchRef.current = [];
        try {
          await api.post(`/meetings/${meetingId}/transcripts`, { items: batch });
        } catch (err) {
          console.error('Failed to save transcript batch', err);
          unsavedBatchRef.current = [...batch, ...unsavedBatchRef.current]; // restore on fail
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [meetingId]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported in this browser');
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onresult = (event: any) => {
      const lastResultIndex = event.results.length - 1;
      const text = event.results[lastResultIndex][0].transcript;
      
      const newLine: TranscriptLine = {
        id: Math.random().toString(),
        speaker: userName,
        text,
        timestampMs: Date.now() - startTimeRef.current,
        flagged: false,
        isTemp: true,
      };

      setTranscript(prev => [...prev, newLine]);
      unsavedBatchRef.current.push(newLine);

      if (socket) {
        socket.emit('transcript-line', { roomCode, speaker: userName, text, timestampMs: newLine.timestampMs });
      }
    };

    recognitionRef.current.onend = () => {
      if (isListening) {
        // Auto-restart if it disconnected while we still want to listen
        try {
          recognitionRef.current.start();
        } catch (e) {
          setIsListening(false);
        }
      }
    };

    recognitionRef.current.start();
    setIsListening(true);
  }, [isListening, userName, socket, roomCode]);

  const toggleBookmark = async (transcriptId: string, index: number) => {
    setTranscript(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], flagged: !copy[index].flagged };
      return copy;
    });

    try {
      // In a real scenario, we'd ensure it's saved in DB first or we'd bookmark the actual DB ID.
      // Since we use temp IDs until fetched, this is a simplified stub.
      // await api.put(`/meetings/transcripts/${transcriptId}/bookmark`);
    } catch (err) {
      console.error('Failed to bookmark transcript', err);
    }
  };

  return { transcript, isListening, toggleListening, toggleBookmark };
}
