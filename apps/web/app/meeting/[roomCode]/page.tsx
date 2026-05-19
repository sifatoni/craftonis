'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useWebRTC } from '@/hooks/useWebRTC'
import { useSpeechTranscript } from '@/hooks/useSpeechTranscript'
import { useAuthStore } from '@/store/auth.store'
import { Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, PhoneOff, Users, Bookmark, Link as LinkIcon, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

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

/**
 * End Meeting confirmation dialog — shown only to the host before ending for all participants.
 */
function EndMeetingDialog({
  onConfirm,
  onCancel,
  isLoading,
}: {
  onConfirm: () => void
  onCancel: () => void
  isLoading: boolean
}) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#0D0D0D] border border-[#2E2E2E] rounded-xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-syne)' }}>
          End Meeting?
        </h2>
        <p className="text-sm text-[#A0A0A0] mb-6">
          This will end the meeting for <span className="text-white font-medium">all participants</span>. This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 border-[#2E2E2E] text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-red-700 hover:bg-red-800 text-white border-none gap-2"
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            End for All
          </Button>
        </div>
      </div>
    </div>
  )
}

function RoomUI({ 
  roomCode, 
  user, 
  guestName, 
  meeting,
  isHost 
}: { 
  roomCode: string, 
  user: any, 
  guestName: string, 
  meeting: any,
  isHost: boolean
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'TRANSCRIPT' | 'PARTICIPANTS'>(isHost ? 'TRANSCRIPT' : 'PARTICIPANTS')
  const transcriptEndRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  // End meeting confirmation dialog state
  const [showEndDialog, setShowEndDialog] = useState(false)
  const [isEndingMeeting, setIsEndingMeeting] = useState(false)
  const [isLeavingMeeting, setIsLeavingMeeting] = useState(false)

  // Create a stable guest ID if not logged in
  const [guestId] = useState(() => `guest-${Math.random().toString(36).substr(2, 9)}`)
  const currentUserId = user?.id || guestId
  const currentUserName = user?.name || guestName || 'Guest'

  const {
    localStream, participants, toggleMic, toggleCamera, startScreenShare,
    leaveRoom, endMeeting, isMicOn, isCameraOn, isScreenSharing, socket,
    isWaiting, waitingList, admitGuest, rejectGuest, kickParticipant
  } = useWebRTC({
    roomCode,
    userId: currentUserId,
    userName: currentUserName,
    isHost,
  })

  const { transcript, toggleBookmark } = useSpeechTranscript({
    roomCode,
    meetingId: meeting?.id,
    userName: currentUserName,
    socket,
    isHost
  })

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(`${window.location.origin}/meeting/${roomCode}`)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  /**
   * End Meeting — host only.
   * Called after user confirms the dialog.
   * 1. Calls endMeeting() which hits POST /meetings/:roomCode/end + socket broadcast
   * 2. Shows toast
   * 3. Navigates away
   */
  const handleConfirmEndMeeting = async () => {
    setIsEndingMeeting(true)
    try {
      await endMeeting()
      toast.success('Meeting ended')
      router.push('/meeting-ledger')
    } catch (err: any) {
      console.error('Failed to end meeting:', err)
      toast.error(err?.response?.data?.message || 'Failed to end meeting. Please try again.')
      setIsEndingMeeting(false)
      setShowEndDialog(false)
    }
  }

  /**
   * Leave Room — any participant (including host leaving without ending).
   * 1. Calls leaveRoom() which hits POST /meetings/:roomCode/leave + stops media + closes peers
   * 2. Shows toast
   * 3. Navigates away
   */
  const handleLeaveRoom = async () => {
    if (isLeavingMeeting) return
    setIsLeavingMeeting(true)
    try {
      await leaveRoom()
      toast.success('You left the meeting')
      router.push('/meeting-ledger')
    } catch (err: any) {
      console.error('Failed to leave meeting:', err)
      // Still navigate — the leave API is non-critical, media cleanup already happened
      toast.success('You left the meeting')
      router.push('/meeting-ledger')
    }
  }

  // Calculate grid layout based on number of people
  const totalPeople = participants.length + 1
  const gridClass = totalPeople === 1 ? 'grid-cols-1' :
                    totalPeople === 2 ? 'grid-cols-2' :
                    totalPeople <= 4 ? 'grid-cols-2 grid-rows-2' :
                    'grid-cols-3'

  if (isWaiting) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center p-4 z-50 animate-fade-in">
        <div className="w-full max-w-md bg-[#111] border border-[#1A1A1A] rounded-xl p-8 flex flex-col items-center text-center">
          <div className="relative w-16 h-16 mb-8 mt-4 flex items-center justify-center">
            <div className="absolute inset-0 bg-[#A50000] rounded-full animate-ping opacity-25"></div>
            <div className="absolute inset-2 bg-[#A50000] rounded-full animate-ping opacity-50" style={{ animationDelay: '0.5s' }}></div>
            <div className="relative w-8 h-8 bg-[#A50000] rounded-full"></div>
          </div>
          <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-syne)' }}>Waiting for host to admit you...</h2>
          <p className="text-sm text-[#A0A0A0] mb-8">Please wait. The host will let you in shortly.</p>
          <Button
            variant="outline"
            onClick={() => router.push('/meeting-ledger')}
            className="w-full border-[#1A1A1A] text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col z-50">
      {/* End Meeting Confirmation Dialog */}
      {showEndDialog && (
        <EndMeetingDialog
          onConfirm={handleConfirmEndMeeting}
          onCancel={() => { if (!isEndingMeeting) setShowEndDialog(false) }}
          isLoading={isEndingMeeting}
        />
      )}

      {/* Top Bar */}
      <div className="h-14 border-b border-[#1A1A1A] bg-[#111] flex items-center justify-between px-6 flex-shrink-0">
        <div>
          <h1 className="text-white font-semibold">{meeting?.title || 'Meeting Room'}</h1>
          <p className="text-xs text-[#606060]">Code: {roomCode}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyInvite}
            className="h-8 gap-1.5 border-[#2E2E2E] bg-[#1A1A1A] hover:bg-[#2E2E2E] text-white"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <LinkIcon size={14} />}
            {copied ? 'Copied!' : 'Invite'}
          </Button>
          <div className="flex items-center gap-1.5 bg-[#1A1A1A] px-3 py-1.5 rounded-lg">
            <Users size={14} className="text-[#A0A0A0]" />
            <span className="text-sm font-medium text-white">{totalPeople}</span>
          </div>
          {isHost && (
            <button
              onClick={() => setShowEndDialog(true)}
              disabled={isEndingMeeting}
              className="bg-red-900/50 text-red-400 hover:bg-red-900/80 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              {isEndingMeeting && <Loader2 size={12} className="animate-spin" />}
              End Meeting
            </button>
          )}
          <button
            onClick={handleLeaveRoom}
            disabled={isLeavingMeeting}
            className="bg-[#1A1A1A] hover:bg-[#2E2E2E] disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >
            Leave
          </button>
        </div>
      </div>

      {/* Host Waiting Banner */}
      {isHost && waitingList.length > 0 && (
        <div className="bg-amber-900/40 border-b border-amber-900/60 px-6 py-2 flex flex-col sm:flex-row items-center justify-between gap-4 flex-shrink-0 animate-fade-in">
          <div className="text-sm text-amber-500 font-medium">
            {waitingList.length} person(s) waiting to join
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {waitingList.map((p) => (
              <div key={p.socketId} className="flex items-center gap-2 bg-[#111] px-3 py-1 rounded-full border border-amber-900/50">
                <span className="text-xs text-white truncate max-w-[100px]">{p.userName}</span>
                <button onClick={() => admitGuest(p.socketId)} className="text-xs font-medium text-green-500 hover:text-green-400">Admit</button>
                <div className="w-px h-3 bg-[#2E2E2E]" />
                <button onClick={() => rejectGuest(p.socketId)} className="text-xs font-medium text-red-500 hover:text-red-400">Reject</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid */}
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className={`w-full max-w-6xl aspect-video grid gap-4 ${gridClass}`}>
            <VideoTile stream={localStream || undefined} name={currentUserName} isLocal />
            {participants.map((p: any) => (
              <VideoTile key={p.socketId} stream={p.stream} name={p.userName} />
            ))}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 border-l border-[#1A1A1A] bg-[#111] flex flex-col flex-shrink-0">
          <div className="flex p-2 gap-1 border-b border-[#1A1A1A]">
            {isHost && (
              <button onClick={() => setActiveTab('TRANSCRIPT')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'TRANSCRIPT' ? 'bg-[#2E2E2E] text-white' : 'text-[#606060] hover:bg-[#1A1A1A]'}`}>
                Transcript
              </button>
            )}
            <button onClick={() => setActiveTab('PARTICIPANTS')} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === 'PARTICIPANTS' ? 'bg-[#2E2E2E] text-white' : 'text-[#606060] hover:bg-[#1A1A1A]'}`}>
              Participants
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'TRANSCRIPT' && isHost ? (
              <div className="space-y-4">
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
                      <button onClick={() => toggleBookmark(line.id)} className={`p-1.5 rounded hover:bg-[#1A1A1A] transition-colors ${line.flagged ? 'text-yellow-500' : 'text-[#606060] opacity-0 group-hover:opacity-100'}`}>
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
                    {currentUserName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-white">{currentUserName} (You)</span>
                </div>
                {participants.map((p: any) => (
                  <div key={p.socketId} className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-full bg-[#2E2E2E] text-white flex items-center justify-center font-bold text-sm">
                      {p.userName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-[#A0A0A0] flex-1">{p.userName}</span>
                    {isHost && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove ${p.userName} from meeting?`)) {
                            kickParticipant(p.socketId)
                          }
                        }}
                        className="text-[10px] uppercase font-bold px-2 py-1 rounded bg-red-900/30 text-red-500 hover:bg-red-900 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                      >
                        Kick
                      </button>
                    )}
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
          {isCameraOn ? <VideoIcon size={20} /> : <VideoOff size={20} />}
        </button>
        <button onClick={startScreenShare} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isScreenSharing ? 'bg-blue-500 text-white' : 'bg-[#2E2E2E] hover:bg-[#3E3E3E] text-white'}`}>
          <MonitorUp size={20} />
        </button>
        <div className="w-px h-8 bg-[#2E2E2E] mx-2" />
        {/* End Call (red phone) button — leaves the meeting */}
        <button
          onClick={handleLeaveRoom}
          disabled={isLeavingMeeting}
          className="w-14 h-10 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
          title="Leave meeting"
        >
          {isLeavingMeeting
            ? <Loader2 size={20} className="animate-spin" />
            : <PhoneOff size={20} />
          }
        </button>
      </div>
    </div>
  )
}

export default function MeetingRoomPage() {
  const params = useParams()
  const roomCode = params.roomCode as string
  const user = useAuthStore(s => s.user)
  
  const [guestName, setGuestName] = useState('')
  const [hasJoined, setHasJoined] = useState(false)

  const { data: meeting } = useQuery({
    queryKey: ['meeting', roomCode],
    queryFn: () => api.get(`/meetings/${roomCode}`).then(r => r.data),
  })

  const isHost = !!(meeting && user && meeting.hostId === user.id)

  // Only host joins automatically. Guests must enter name and click Join.
  useEffect(() => {
    if (isHost) {
      setHasJoined(true)
    }
  }, [isHost])

  if (!hasJoined) {
    return (
      <div className="fixed inset-0 bg-[#0A0A0A] flex flex-col items-center justify-center p-4 z-50">
        <div className="w-full max-w-md bg-[#111] border border-[#1A1A1A] rounded-xl p-6 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-syne)' }}>Craftonis</h1>
            <p className="text-sm text-[#A0A0A0]">Joining: <span className="text-white font-medium">{meeting?.title || 'Meeting Room'}</span></p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#A0A0A0] mb-2 block">Your Name *</label>
              <Input
                value={guestName}
                onChange={e => setGuestName(e.target.value)}
                placeholder="Enter your name"
                className="bg-[#1A1A1A] border-[#2E2E2E] text-white focus:border-[#A50000] focus:ring-[#A50000]"
                onKeyDown={e => e.key === 'Enter' && guestName.trim() && setHasJoined(true)}
              />
            </div>
            <Button
              onClick={() => setHasJoined(true)}
              disabled={!guestName.trim()}
              className="w-full h-10"
              style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
            >
              Join Meeting
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <RoomUI roomCode={roomCode} user={user} guestName={guestName} meeting={meeting} isHost={isHost} />
}
