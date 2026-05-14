'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useWebRTC } from '@/hooks/useWebRTC'
import { useSpeechTranscript } from '@/hooks/useSpeechTranscript'
import { useAuthStore } from '@/store/auth.store'
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Users, MessageSquare, Bookmark } from 'lucide-react'

function VideoTile({ stream, name, isLocal }: { stream?: MediaStream, name: string, isLocal?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className="relative w-full h-full bg-[#111] rounded-xl overflow-hidden border border-[#2E2E2E]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="w-full h-full object-cover"
        style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }}
      />
      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-2">
        <span className="text-sm font-medium text-white">{name} {isLocal && '(You)'}</span>
      </div>
    </div>
  )
}

export default function MeetingRoomPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.roomCode as string
  const user = useAuthStore(s => s.user)
  
  const [activeTab, setActiveTab] = useState<'TRANSCRIPT' | 'PARTICIPANTS'>('TRANSCRIPT')
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  const { data: meeting } = useQuery({
    queryKey: ['meeting', roomCode],
    queryFn: () => api.get(`/meetings/${roomCode}`).then(r => r.data),
  })

  const isHost = meeting?.hostId === user?.id

  const {
    localStream, participants, toggleMic, toggleCamera, startScreenShare,
    leaveRoom, endMeeting, isMicOn, isCameraOn, isScreenSharing, socket
  } = useWebRTC({
    roomCode,
    userId: user?.id || Math.random().toString(),
    userName: user?.name || 'Guest',
    isHost,
  })

  const { transcript, isListening, toggleListening, toggleBookmark } = useSpeechTranscript(
    meeting?.id, roomCode, user?.name || 'Guest', socket
  )

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  // Calculate grid layout based on number of people
  const totalPeople = participants.length + 1
  const gridClass = totalPeople === 1 ? 'grid-cols-1' :
                    totalPeople === 2 ? 'grid-cols-2' :
                    totalPeople <= 4 ? 'grid-cols-2 grid-rows-2' :
                    'grid-cols-3'

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col z-50">
      {/* Top Bar */}
      <div className="h-14 border-b border-[#1A1A1A] bg-[#111] flex items-center justify-between px-6 flex-shrink-0">
        <div>
          <h1 className="text-white font-semibold">{meeting?.title || 'Meeting Room'}</h1>
          <p className="text-xs text-[#606060]">Code: {roomCode}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#1A1A1A] px-3 py-1.5 rounded-lg">
            <Users size={14} className="text-[#A0A0A0]" />
            <span className="text-sm font-medium text-white">{totalPeople}</span>
          </div>
          {isHost && (
            <button onClick={endMeeting} className="bg-red-900/50 text-red-400 hover:bg-red-900/80 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
              End Meeting
            </button>
          )}
          <button onClick={() => { leaveRoom(); router.push('/meeting-ledger') }} className="bg-[#1A1A1A] hover:bg-[#2E2E2E] text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors">
            Leave
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className={`w-full max-w-6xl aspect-video grid gap-4 ${gridClass}`}>
            <VideoTile stream={localStream || undefined} name={user?.name || 'Guest'} isLocal />
            {participants.map((p: any) => (
              <VideoTile key={p.socketId} stream={p.stream} name={p.userName} />
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-[#1A1A1A] bg-[#111] flex flex-col flex-shrink-0">
          <div className="flex p-2 gap-1 border-b border-[#1A1A1A]">
            <button onClick={() => setActiveTab('TRANSCRIPT')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'TRANSCRIPT' ? 'bg-[#2E2E2E] text-white' : 'text-[#606060] hover:bg-[#1A1A1A]'}`}>
              Transcript
            </button>
            <button onClick={() => setActiveTab('PARTICIPANTS')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'PARTICIPANTS' ? 'bg-[#2E2E2E] text-white' : 'text-[#606060] hover:bg-[#1A1A1A]'}`}>
              Participants
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'TRANSCRIPT' ? (
              <div className="space-y-4">
                <button onClick={toggleListening} className={`w-full py-2 flex items-center justify-center gap-2 rounded-lg text-sm font-medium border ${isListening ? 'bg-red-900/20 text-red-500 border-red-900/50' : 'bg-[#1A1A1A] text-white border-[#2E2E2E]'}`}>
                  {isListening ? <Mic size={14} /> : <MicOff size={14} />}
                  {isListening ? 'Listening...' : 'Start Transcription'}
                </button>
                <div className="space-y-3">
                  {transcript.map((line: any, i: number) => (
                    <div key={line.id} className="group flex items-start gap-2">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="text-xs font-medium text-[#A0A0A0]">{line.speaker}</span>
                          <span className="text-[10px] text-[#606060]">{Math.floor(line.timestampMs / 1000)}s</span>
                        </div>
                        <p className="text-sm text-white">{line.text}</p>
                      </div>
                      <button onClick={() => toggleBookmark(line.id, i)} className={`p-1.5 rounded hover:bg-[#1A1A1A] transition-colors ${line.flagged ? 'text-yellow-500' : 'text-[#606060] opacity-0 group-hover:opacity-100'}`}>
                        <Bookmark size={14} fill={line.flagged ? 'currentColor' : 'none'} />
                      </button>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#A50000] text-white flex items-center justify-center font-bold text-sm">
                    {(user?.name || 'G').charAt(0)}
                  </div>
                  <span className="text-sm font-medium text-white">{user?.name} (You)</span>
                </div>
                {participants.map((p: any) => (
                  <div key={p.socketId} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#2E2E2E] text-white flex items-center justify-center font-bold text-sm">
                      {p.userName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-[#A0A0A0]">{p.userName}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="h-20 border-t border-[#1A1A1A] bg-[#111] flex items-center justify-center gap-4 flex-shrink-0">
        <button onClick={toggleMic} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isMicOn ? 'bg-[#2E2E2E] hover:bg-[#3E3E3E] text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
          {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
        </button>
        <button onClick={toggleCamera} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isCameraOn ? 'bg-[#2E2E2E] hover:bg-[#3E3E3E] text-white' : 'bg-red-500 hover:bg-red-600 text-white'}`}>
          {isCameraOn ? <Video size={20} /> : <VideoOff size={20} />}
        </button>
        <button onClick={startScreenShare} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? 'bg-blue-500 text-white' : 'bg-[#2E2E2E] hover:bg-[#3E3E3E] text-white'}`}>
          <MonitorUp size={20} />
        </button>
        <div className="w-px h-8 bg-[#2E2E2E] mx-2" />
        <button onClick={() => { leaveRoom(); router.push('/meeting-ledger') }} className="w-14 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-colors">
          <PhoneOff size={20} />
        </button>
      </div>
    </div>
  )
}
