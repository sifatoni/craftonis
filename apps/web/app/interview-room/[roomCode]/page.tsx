'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/axios'
import { useAuthStore } from '@/store/auth.store'
import { useInterviewRTC } from '@/hooks/useInterviewRTC'
import { useSpeechTranscript } from '@/hooks/useSpeechTranscript'
import { toast } from 'sonner'
import Image from 'next/image'
import {
  Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, PhoneOff,
  ChevronLeft, ChevronRight, MessageSquare, List, Bookmark, Star, Send
} from 'lucide-react'

export default function InterviewRoomPage() {
  const { roomCode } = useParams() as { roomCode: string }
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user } = useAuthStore()

  const [room, setRoom] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'candidate' | 'interviewer'>('candidate')
  const [elapsed, setElapsed] = useState(0)

  // Interviewer tabs: 'questions' | 'transcript' | 'ratings'
  const [activeTab, setActiveTab] = useState<'questions' | 'transcript' | 'ratings'>('questions')
  
  // Code editor state
  const [codeContent, setCodeContent] = useState('')
  const [codeLanguage, setCodeLanguage] = useState('javascript')
  const codeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Questions state
  const [questions, setQuestions] = useState<any[]>([])
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)

  // Transcript state
  const [transcriptLines, setTranscriptLines] = useState<any[]>([])
  const transcriptEndRef = useRef<HTMLDivElement>(null)

  // Ratings state
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [savingRatings, setSavingRatings] = useState(false)

  // 1. Fetch Room Data
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const { data } = await api.get(`/interviews/room/${roomCode}`)
        setRoom(data)
        setCodeContent(data.codeContent || '')
        setCodeLanguage(data.codeLanguage || 'javascript')
        setTranscriptLines(data.transcript || [])

        // Determine role
        const urlRole = searchParams.get('role')
        if (urlRole === 'candidate') {
          setRole('candidate')
        } else if (urlRole === 'interviewer') {
          setRole('interviewer')
        } else if (user) {
          setRole('interviewer')
        }

        // Fetch questions if interviewer
        if (user && data.interview.types?.length > 0) {
          const type = data.interview.types[0]
          try {
            const res = await api.get(`/interviews/questions?type=${type}`)
            setQuestions(res.data)
          } catch (e) {
            console.error('Failed to load questions', e)
          }
        }
      } catch (err) {
        toast.error('Failed to load interview room')
        router.push('/')
      } finally {
        setLoading(false)
      }
    }
    fetchRoom()
  }, [roomCode, searchParams, user])

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcriptLines])

  // Current user display info
  const myName = role === 'candidate' 
    ? (room?.interview?.candidate?.name || 'Candidate') 
    : (user?.name || 'Interviewer')
  
  const myId = role === 'candidate' 
    ? `candidate-${room?.interview?.candidate?.id || 'guest'}` 
    : (user?.id || 'unknown')

  const isTechnical = room?.interview?.types?.includes('TECHNICAL')

  // RTC Hook
  const {
    localStream, participants, toggleMic, toggleCamera, startScreenShare, leaveRoom,
    isMicOn, isCameraOn, isScreenSharing, emitCodeChange, socket
  } = useInterviewRTC({
    roomCode,
    userId: myId,
    userName: myName,
    isInterviewer: role === 'interviewer',
    onCodeUpdate: (code, lang) => {
      setCodeContent(code)
      setCodeLanguage(lang)
    },
    onInterviewEnded: () => {
      router.push(`/interview-room/${roomCode}/results`)
    }
  })

  // Silent Transcription
  const { transcript, toggleBookmark } = useSpeechTranscript({
    endpoint: `/interviews/room/${roomCode}/transcribe-chunk`,
    roomCode,
    userName: myName,
    socket,
    isHost: role === 'interviewer',
  })

  useEffect(() => {
    if (!socket) return
    const handleTranscript = (data: any) => {
      setTranscriptLines(prev => [...prev, data])
    }
    socket.on('transcript-line', handleTranscript)
    return () => {
      socket.off('transcript-line', handleTranscript)
    }
  }, [socket])

  const handleEndInterview = async () => {
    try {
      if (socket) {
        socket.emit('end-interview', { roomCode })
      }
      await api.put(`/interviews/room/${roomCode}/end`)
      router.push(`/interview-room/${roomCode}/results`)
    } catch (e) {
      toast.error('Failed to end interview')
    }
  }

  const handleCandidateLeave = () => {
    leaveRoom()
    router.push('/')
  }

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const handleCodeChange = (val: string) => {
    setCodeContent(val)
    emitCodeChange(val, codeLanguage)

    if (codeTimeoutRef.current) clearTimeout(codeTimeoutRef.current)
    codeTimeoutRef.current = setTimeout(async () => {
      try {
        await api.patch(`/interviews/room/${roomCode}/code`, { code: val, language: codeLanguage })
      } catch (err) {
        console.error('Failed to save code')
      }
    }, 500)
  }

  const handleSaveRatings = async () => {
    setSavingRatings(true)
    try {
      await api.put(`/interviews/${room?.interviewId}/submit`, { ratings, notes })
      toast.success('Ratings saved')
    } catch (e) {
      toast.error('Failed to save ratings')
    } finally {
      setSavingRatings(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-white">Loading...</div>

  return (
    <div className="h-screen w-screen bg-[#0D0D0D] overflow-hidden text-white grid gap-0" style={{
      gridTemplateAreas: isTechnical 
        ? `
          "topbar topbar"
          "video  panel"
          "editor editor"
          "controls controls"
        `
        : `
          "topbar topbar"
          "video  panel"
          "controls controls"
        `,
      gridTemplateRows: isTechnical ? '60px minmax(200px, 1fr) minmax(200px, 1fr) 70px' : '60px 1fr 70px',
      gridTemplateColumns: role === 'candidate' ? '1fr 300px' : '1fr 400px',
    }}>

      {/* TOP BAR */}
      <div className="border-b border-[#1A1A1A] flex items-center justify-between px-6 z-10" style={{ gridArea: 'topbar', background: '#111111' }}>
        <div className="flex items-center gap-4">
          <Image src="/logo-dark.svg" alt="Craftonis" width={100} height={25} />
          <div className="h-4 w-[1px] bg-[#333]" />
          <div>
            <h2 className="text-sm font-semibold text-white">{room?.interview?.candidate?.name || 'Candidate'}</h2>
            <p className="text-xs text-[#808080]">{room?.interview?.job?.title || 'Position'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-mono text-[#A0A0A0]">{formatTime(elapsed)}</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-[#606060]">{participants.length + 1} participant(s)</span>
          {role === 'interviewer' ? (
            <button onClick={handleEndInterview} className="px-4 py-1.5 rounded-lg text-sm font-medium bg-[#A50000] hover:bg-red-700 text-white transition">
              End Interview
            </button>
          ) : (
            <div className="px-3 py-1 bg-white/5 rounded text-xs text-[#808080]">Candidate View</div>
          )}
        </div>
      </div>

      {/* VIDEO SECTION */}
      <div className="relative p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar" style={{ gridArea: 'video' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
          {/* Local Video */}
          <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center border border-[#1A1A1A]">
            <VideoPlayer stream={localStream} muted={true} mirrored={!isScreenSharing} />
            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
              <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="text-sm font-medium">{myName} (You)</span>
              </div>
              <div className="flex gap-2">
                {!isMicOn && <div className="p-1.5 bg-red-500/80 rounded-md backdrop-blur-sm"><MicOff size={16} /></div>}
                {!isCameraOn && <div className="p-1.5 bg-red-500/80 rounded-md backdrop-blur-sm"><VideoOff size={16} /></div>}
              </div>
            </div>
          </div>

          {/* Remote Videos */}
          {participants.map(p => (
            <div key={p.socketId} className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center border border-[#1A1A1A]">
              <VideoPlayer stream={p.stream || null} muted={false} mirrored={false} />
              <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="text-sm font-medium">{p.userName}</span>
                {p.isInterviewer && <Star size={14} className="text-yellow-500" />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="border-l border-[#1A1A1A] flex flex-col bg-[#0A0A0A] overflow-hidden" style={{ gridArea: 'panel' }}>
        {role === 'candidate' ? (
          <div className="p-6 flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Star className="text-[#A50000]" size={32} />
            </div>
            <h3 className="text-lg font-medium mb-1">Interview in Progress</h3>
            <p className="text-sm text-[#808080] mb-4">{room?.interview?.job?.title}</p>
            <div className="text-xs text-[#606060] p-4 bg-white/5 rounded-lg">
              Follow the interviewer's instructions. If this is a technical interview, your coding editor will appear below.
            </div>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex border-b border-[#1A1A1A]">
              <TabButton active={activeTab === 'questions'} onClick={() => setActiveTab('questions')} icon={List} label="Questions" />
              <TabButton active={activeTab === 'transcript'} onClick={() => setActiveTab('transcript')} icon={MessageSquare} label="Transcript" />
              <TabButton active={activeTab === 'ratings'} onClick={() => setActiveTab('ratings')} icon={Star} label="Ratings" />
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
              {activeTab === 'questions' && (
                <div className="flex flex-col h-full">
                  {questions.length > 0 ? (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-medium px-2 py-1 bg-white/5 rounded text-[#A0A0A0]">
                          Question {currentQuestionIdx + 1} of {questions.length}
                        </span>
                        <span className="text-xs px-2 py-1 rounded bg-[#A50000]/20 text-[#A50000]">
                          {questions[currentQuestionIdx].category}
                        </span>
                      </div>
                      <div className="text-sm leading-relaxed mb-8 flex-1">
                        {questions[currentQuestionIdx].content}
                      </div>
                      <div className="flex gap-2 mt-auto">
                        <button 
                          onClick={() => setCurrentQuestionIdx(i => Math.max(0, i - 1))}
                          disabled={currentQuestionIdx === 0}
                          className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                        >
                          <ChevronLeft size={16} /> Prev
                        </button>
                        <button 
                          onClick={() => setCurrentQuestionIdx(i => Math.min(questions.length - 1, i + 1))}
                          disabled={currentQuestionIdx === questions.length - 1}
                          className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                        >
                          Next <ChevronRight size={16} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-[#606060] text-center mt-10">No questions available for this interview type.</div>
                  )}
                </div>
              )}

              {activeTab === 'transcript' && (
                <div className="flex flex-col gap-3">
                  {transcriptLines.length === 0 && (
                    <div className="text-sm text-[#606060] text-center mt-10">Waiting for speech...</div>
                  )}
                  {transcriptLines.map((t, i) => (
                    <div key={i} className="group relative p-3 rounded-lg bg-white/5 hover:bg-white/10 transition">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium" style={{ color: t.speaker === myName ? '#A50000' : '#4dabf7' }}>
                          {t.speaker}
                        </span>
                        <button className="opacity-0 group-hover:opacity-100 transition p-1 hover:text-[#A50000]">
                          <Bookmark size={12} />
                        </button>
                      </div>
                      <p className="text-sm text-[#D0D0D0] leading-relaxed">{t.text}</p>
                    </div>
                  ))}
                  <div ref={transcriptEndRef} />
                </div>
              )}

              {activeTab === 'ratings' && (
                <div className="flex flex-col gap-6">
                  {['Communication', 'Motivation', 'Role Fit', 'Problem Solving'].map(cat => (
                    <div key={cat}>
                      <label className="block text-xs font-medium text-[#A0A0A0] mb-2">{cat}</label>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                          <button
                            key={val}
                            onClick={() => setRatings(r => ({ ...r, [cat]: val }))}
                            className={`flex-1 py-1 text-xs rounded transition ${
                              ratings[cat] === val ? 'bg-[#A50000] text-white' : 'bg-white/5 hover:bg-white/10 text-[#808080]'
                            }`}
                          >
                            {val}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium text-[#A0A0A0] mb-2">Interviewer Notes</label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Add private notes here..."
                      className="w-full bg-[#111111] border border-[#2E2E2E] rounded-lg p-3 text-sm min-h-[100px] outline-none focus:border-[#A50000] transition resize-none text-white"
                    />
                  </div>
                  <button
                    onClick={handleSaveRatings}
                    disabled={savingRatings}
                    className="w-full py-2.5 bg-white text-black font-medium text-sm rounded-lg hover:bg-gray-200 transition"
                  >
                    {savingRatings ? 'Saving...' : 'Save Ratings'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* EDITOR SECTION */}
      {isTechnical && (
        <div className="border-t border-[#1A1A1A] bg-[#111111] flex flex-col" style={{ gridArea: 'editor' }}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#1A1A1A] bg-[#0A0A0A]">
            <div className="flex items-center gap-3">
              <CodeIcon />
              <span className="text-xs font-medium text-[#A0A0A0]">Collaborative Editor</span>
            </div>
            <div className="flex items-center gap-3">
              {role === 'interviewer' && (
                <span className="text-xs text-[#A50000] bg-[#A50000]/10 px-2 py-1 rounded">Read Only</span>
              )}
              <select
                value={codeLanguage}
                onChange={e => {
                  setCodeLanguage(e.target.value)
                  if (role === 'candidate') emitCodeChange(codeContent, e.target.value)
                }}
                disabled={role === 'interviewer'}
                className="bg-[#1A1A1A] border border-[#2E2E2E] rounded px-2 py-1 text-xs text-[#D0D0D0] outline-none"
              >
                <option value="javascript">JavaScript</option>
                <option value="typescript">TypeScript</option>
                <option value="python">Python</option>
                <option value="java">Java</option>
                <option value="cpp">C++</option>
                <option value="go">Go</option>
              </select>
              <button disabled className="px-3 py-1 bg-white/5 rounded text-xs text-[#808080] cursor-not-allowed" title="Coming soon">
                Run Code
              </button>
            </div>
          </div>
          <textarea
            value={codeContent}
            onChange={e => handleCodeChange(e.target.value)}
            readOnly={role === 'interviewer'}
            spellCheck={false}
            className="flex-1 w-full bg-transparent p-4 text-sm font-mono text-[#4dabf7] outline-none resize-none custom-scrollbar"
            style={{ tabSize: 2 }}
          />
        </div>
      )}

      {/* CONTROLS */}
      <div className="border-t border-[#1A1A1A] flex items-center justify-center gap-4 bg-[#0A0A0A] z-10" style={{ gridArea: 'controls' }}>
        <ControlButton active={isMicOn} onClick={toggleMic} icon={isMicOn ? Mic : MicOff} color={isMicOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'} />
        <ControlButton active={isCameraOn} onClick={toggleCamera} icon={isCameraOn ? VideoIcon : VideoOff} color={isCameraOn ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'} />
        <ControlButton active={isScreenSharing} onClick={startScreenShare} icon={MonitorUp} color={isScreenSharing ? 'bg-[#A50000] hover:bg-red-700' : 'bg-white/10 hover:bg-white/20'} />
        
        <div className="w-[1px] h-8 bg-[#2E2E2E] mx-2" />
        
        {role === 'candidate' ? (
          <button onClick={handleCandidateLeave} className="px-6 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 font-medium transition">
            <PhoneOff size={20} /> Leave
          </button>
        ) : (
          <button onClick={handleEndInterview} className="px-6 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center gap-2 font-medium transition">
            <PhoneOff size={20} /> End Interview
          </button>
        )}
      </div>
    </div>
  )
}

function VideoPlayer({ stream, muted, mirrored }: { stream: MediaStream | null, muted: boolean, mirrored: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])
  if (!stream) return <div className="text-[#333]"><VideoOff size={48} /></div>
  return <video ref={videoRef} autoPlay playsInline muted={muted} className={`w-full h-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`} />
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean, onClick: () => void, icon: any, label: string }) {
  return (
    <button onClick={onClick} className={`flex-1 py-3 flex flex-col items-center gap-1 text-xs transition border-b-2 ${active ? 'border-[#A50000] text-white' : 'border-transparent text-[#606060] hover:text-[#A0A0A0] hover:bg-white/5'}`}>
      <Icon size={16} />
      {label}
    </button>
  )
}

function ControlButton({ active, onClick, icon: Icon, color }: { active: boolean, onClick: () => void, icon: any, color: string }) {
  return (
    <button onClick={onClick} className={`p-3 rounded-full transition text-white ${color}`}>
      <Icon size={20} />
    </button>
  )
}

function CodeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#A0A0A0]"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
}
