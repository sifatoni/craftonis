'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/axios'
import Link from 'next/link'
import {
  Trophy, CheckCircle2, AlertCircle, XCircle, ChevronDown, 
  MessageSquare, BrainCircuit, Code2, ArrowLeft, LayoutDashboard,
  Star
} from 'lucide-react'

export default function InterviewResultsPage() {
  const { roomCode } = useParams() as { roomCode: string }
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<any>(null)
  const [showTranscript, setShowTranscript] = useState(false)
  const [room, setRoom] = useState<any>(null)

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const roomRes = await api.get(`/interviews/room/${roomCode}`)
        setRoom(roomRes.data)

        const scoreRes = await api.post(`/interviews/room/${roomCode}/generate-score`)
        setData(scoreRes.data)
      } catch (err) {
        console.error(err)
        setError('Failed to generate interview analysis. Ensure the interview has ended and transcript exists.')
      } finally {
        setLoading(false)
      }
    }
    fetchResults()
  }, [roomCode])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          className="mb-6"
        >
          <div className="w-16 h-16 border-4 border-[#A50000]/20 border-t-[#A50000] rounded-full" />
        </motion.div>
        <h2 className="text-xl font-semibold mb-2">🤖 Analyzing interview...</h2>
        <p className="text-[#808080]">This may take a moment. We're processing the transcript and code.</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center text-white p-6 text-center">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Analysis Failed</h2>
        <p className="text-[#808080] mb-8 max-w-md">{error}</p>
        <Link href="/interviews" className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition">
          Return to Interviews
        </Link>
      </div>
    )
  }

  const getOverallColor = (score: number) => {
    if (score >= 70) return '#10B981' // Green
    if (score >= 50) return '#F59E0B' // Yellow
    return '#EF4444' // Red
  }

  const getRecommendationStyle = (rec: string) => {
    switch (rec) {
      case 'STRONG_YES': return { bg: 'bg-green-500/10', text: 'text-green-500', icon: CheckCircle2, label: 'Strong Recommend' }
      case 'YES': return { bg: 'bg-teal-500/10', text: 'text-teal-500', icon: CheckCircle2, label: 'Recommend' }
      case 'MAYBE': return { bg: 'bg-yellow-500/10', text: 'text-yellow-500', icon: AlertCircle, label: 'Uncertain' }
      case 'NO': return { bg: 'bg-orange-500/10', text: 'text-orange-500', icon: XCircle, label: 'Not Recommended' }
      case 'STRONG_NO': return { bg: 'bg-red-500/10', text: 'text-red-500', icon: XCircle, label: 'Do Not Recommend' }
      default: return { bg: 'bg-gray-500/10', text: 'text-gray-400', icon: Star, label: rec }
    }
  }

  const recStyle = getRecommendationStyle(data.recommendation)
  const overallColor = getOverallColor(data.overall)
  const candidateName = room?.interview?.candidate?.name || 'Candidate'
  const jobTitle = room?.interview?.job?.title || 'Position'

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-6 md:p-12 overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#111111] border border-[#1A1A1A] p-6 rounded-2xl">
          <div>
            <h1 className="text-2xl font-bold mb-1">AI Interview Analysis</h1>
            <p className="text-[#808080]">{candidateName} • {jobTitle}</p>
          </div>
          <div className={`px-4 py-2 rounded-full flex items-center gap-2 border border-current ${recStyle.bg} ${recStyle.text}`}>
            <recStyle.icon size={18} />
            <span className="font-semibold">{recStyle.label}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Overall Score */}
          <div className="bg-[#111111] border border-[#1A1A1A] p-6 rounded-2xl flex flex-col items-center justify-center text-center">
            <h3 className="text-[#808080] font-medium mb-4">Overall Score</h3>
            <div className="relative w-32 h-32 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#2E2E2E" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke={overallColor} strokeWidth="3" strokeDasharray={`${data.overall}, 100`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                <span className="text-3xl font-bold" style={{ color: overallColor }}>{data.overall}</span>
                <span className="text-xs text-[#606060]">/ 100</span>
              </div>
            </div>
          </div>

          {/* Detailed Scores */}
          <div className="md:col-span-2 bg-[#111111] border border-[#1A1A1A] p-6 rounded-2xl flex flex-col justify-center gap-6">
            <ScoreBar label="Communication" score={data.communication?.score || 0} icon={MessageSquare} />
            <ScoreBar label="Technical" score={data.technical?.score || 0} icon={Code2} />
            <ScoreBar label="Behavioral" score={data.behavioral?.score || 0} icon={BrainCircuit} />
          </div>
        </div>

        {/* AI Summary */}
        <div className="bg-[#111111] border border-[#1A1A1A] p-6 rounded-2xl">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Trophy className="text-[#A50000]" /> Executive Summary
          </h3>
          <p className="text-[#D0D0D0] leading-relaxed text-sm md:text-base">
            {data.summary}
          </p>
        </div>

        {/* Dimension Notes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NoteCard title="Communication Notes" notes={data.communication?.notes} />
          <NoteCard title="Technical Notes" notes={data.technical?.notes} />
          <NoteCard title="Behavioral Notes" notes={data.behavioral?.notes} />
        </div>

        {/* Transcript Toggle */}
        {room?.transcript && room.transcript.length > 0 && (
          <div className="bg-[#111111] border border-[#1A1A1A] rounded-2xl overflow-hidden">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition"
            >
              <h3 className="text-lg font-semibold">View Full Transcript</h3>
              <motion.div animate={{ rotate: showTranscript ? 180 : 0 }}>
                <ChevronDown />
              </motion.div>
            </button>
            <AnimatePresence>
              {showTranscript && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-6 pt-0 border-t border-[#1A1A1A] bg-[#0A0A0A]/50">
                    <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-4">
                      {room.transcript.map((t: any, i: number) => (
                        <div key={i} className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-[#808080]">{t.speaker}</span>
                          <p className="text-sm text-[#D0D0D0] leading-relaxed">{t.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
          <Link href="/interviews" className="flex-1 w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#1A1A1A] hover:bg-[#2A2A2A] transition text-sm font-medium">
            <ArrowLeft size={16} /> Back to Interviews
          </Link>
          <Link href="/dashboard" className="flex-1 w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-[#A50000] hover:bg-red-700 transition text-sm font-medium">
            <LayoutDashboard size={16} /> View Dashboard
          </Link>
        </div>

      </div>
    </div>
  )
}

function ScoreBar({ label, score, icon: Icon }: { label: string, score: number, icon: any }) {
  return (
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-[#A0A0A0] shrink-0">
        <Icon size={20} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium text-sm">{label}</span>
          <span className="text-sm font-bold">{score}/100</span>
        </div>
        <div className="h-2 w-full bg-[#1A1A1A] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, delay: 0.5 }}
            className="h-full bg-gradient-to-r from-[#A50000] to-red-500 rounded-full"
          />
        </div>
      </div>
    </div>
  )
}

function NoteCard({ title, notes }: { title: string, notes: string }) {
  if (!notes) return null
  return (
    <div className="bg-[#111111] border border-[#1A1A1A] p-5 rounded-xl">
      <h4 className="text-sm font-medium text-[#808080] mb-3">{title}</h4>
      <p className="text-sm text-[#D0D0D0] leading-relaxed">{notes}</p>
    </div>
  )
}
