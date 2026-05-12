'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import {
  Code2, MessageSquare, Plus, Calendar, Clock,
  CheckCircle2, XCircle, PlayCircle, ChevronRight,
  User, Briefcase, Star, Send, Loader2, X,
  AlertCircle, Trophy, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

// ── Types ─────────────────────────────────────────────────
const STATUS_CONFIG = {
  SCHEDULED: { label: 'Scheduled', color: '#0284C7', bg: '#0C1A2E' },
  IN_PROGRESS: { label: 'In Progress', color: '#D97706', bg: '#1C1007' },
  COMPLETED: { label: 'Completed', color: '#16A34A', bg: '#052E16' },
  CANCELLED: { label: 'Cancelled', color: '#606060', bg: '#1A1A1A' },
}

const RATING_CATEGORIES = {
  BEHAVIORAL: [
    { key: 'communication', label: 'Communication', icon: '💬' },
    { key: 'leadership', label: 'Leadership', icon: '🎯' },
    { key: 'culturalFit', label: 'Cultural Fit', icon: '🤝' },
    { key: 'problemSolving', label: 'Problem Solving', icon: '🧩' },
  ],
  TECHNICAL: [
    { key: 'technicalSkill', label: 'Technical Skill', icon: '⚡' },
    { key: 'problemSolving', label: 'Problem Solving', icon: '🧩' },
    { key: 'codeQuality', label: 'Code Quality', icon: '✨' },
    { key: 'communication', label: 'Communication', icon: '💬' },
  ],
}

// ── Hooks ─────────────────────────────────────────────────
function useInterviews() {
  return useQuery({
    queryKey: ['interviews'],
    queryFn: () => api.get('/interviews').then(r => r.data),
  })
}

function useInterview(id: string) {
  return useQuery({
    queryKey: ['interview', id],
    queryFn: () => api.get(`/interviews/${id}`).then(r => r.data),
    enabled: !!id,
  })
}

function useQuestions(type: string) {
  return useQuery({
    queryKey: ['interview-questions', type],
    queryFn: () => api.get(`/interviews/questions?type=${type}`).then(r => r.data),
    enabled: !!type,
  })
}

// ── Schedule Modal ─────────────────────────────────────────
function ScheduleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [candidateId, setCandidateId] = useState('')
  const [type, setType] = useState<'BEHAVIORAL' | 'TECHNICAL'>('BEHAVIORAL')
  const [scheduledAt, setScheduledAt] = useState('')
  const [notes, setNotes] = useState('')

  const { data: allCandidates } = useQuery({
    queryKey: ['all-interview-candidates'],
    queryFn: () => api.get('/jobs').then(async r => {
      const jobs = r.data
      const allCands: any[] = []
      for (const job of jobs.slice(0, 10)) {
        const cands = await api.get(`/jobs/${job.id}/candidates`).then(r => r.data)
        allCands.push(...cands.map((c: any) => ({ ...c, jobTitle: job.title })))
      }
      return allCands
    }),
    enabled: open,
  })

  const schedule = useMutation({
    mutationFn: (data: any) => api.post('/interviews', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interviews'] })
      toast.success('Interview scheduled!')
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to schedule'),
  })

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" style={{ background: '#111111', border: '1px solid #2E2E2E' }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}>
            Schedule Interview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Candidate */}
          <div className="space-y-1.5">
            <Label style={{ color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 }}>CANDIDATE *</Label>
            <select
              value={candidateId}
              onChange={e => setCandidateId(e.target.value)}
              className="w-full h-10 rounded-lg px-3 text-sm"
              style={{ background: '#0A0A0A', border: '1px solid #2E2E2E', color: candidateId ? '#FFFFFF' : '#606060' }}
            >
              <option value="">Select candidate...</option>
              {allCandidates?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name} — {c.jobTitle}</option>
              ))}
            </select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label style={{ color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 }}>INTERVIEW TYPE *</Label>
            <div className="grid grid-cols-2 gap-2">
              {(['BEHAVIORAL', 'TECHNICAL'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className="flex items-center gap-2 p-3 rounded-lg border transition-all"
                  style={{
                    background: type === t ? '#1A0000' : '#0A0A0A',
                    borderColor: type === t ? '#A50000' : '#2E2E2E',
                    color: type === t ? '#FFFFFF' : '#A0A0A0',
                  }}
                >
                  {t === 'BEHAVIORAL' ? <MessageSquare size={14} /> : <Code2 size={14} />}
                  <span className="text-xs font-medium">{t === 'BEHAVIORAL' ? 'Behavioral' : 'Technical'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label style={{ color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 }}>SCHEDULED DATE & TIME</Label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => setScheduledAt(e.target.value)}
              className="w-full h-10 rounded-lg px-3 text-sm"
              style={{ background: '#0A0A0A', border: '1px solid #2E2E2E', color: '#FFFFFF' }}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label style={{ color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 }}>NOTES</Label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any special instructions..."
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none"
              style={{ background: '#0A0A0A', border: '1px solid #2E2E2E', color: '#FFFFFF', outline: 'none' }}
            />
          </div>

          <div className="flex gap-3">
            <Button onClick={onClose} variant="outline" className="flex-1 h-10"
              style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}>
              Cancel
            </Button>
            <Button
              onClick={() => schedule.mutate({ candidateId, type, scheduledAt: scheduledAt || undefined, notes })}
              disabled={!candidateId || schedule.isPending}
              className="flex-1 h-10"
              style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
            >
              {schedule.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Schedule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Interview Session ──────────────────────────────────────
function InterviewSession({ interview, onClose }: { interview: any; onClose: () => void }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState<'BEHAVIORAL' | 'TECHNICAL'>(interview.type)
  const [currentQ, setCurrentQ] = useState(0)
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState(interview.notes || '')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tabSwitches, setTabSwitches] = useState(0)

  const { data: questions } = useQuestions(mode)
  const categories = RATING_CATEGORIES[mode]

  const handleSubmit = async () => {
    const allRated = categories.every(c => ratings[c.key] !== undefined)
    if (!allRated) {
      toast.error('Please rate all categories before submitting')
      return
    }
    setSubmitting(true)
    try {
      await api.put(`/interviews/${interview.id}/submit`, {
        ratings,
        notes,
        codeSubmission: code,
        codeLanguage: 'javascript',
      })
      qc.invalidateQueries({ queryKey: ['interviews'] })
      toast.success('Interview submitted successfully!')
      onClose()
    } catch (err: any) {
      toast.error('Failed to submit interview')
    } finally {
      setSubmitting(false)
    }
  }

  const avgRating = Object.values(ratings).length > 0
    ? (Object.values(ratings).reduce((a, b) => a + b, 0) / Object.values(ratings).length).toFixed(1)
    : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex"
      style={{ background: '#0A0A0A' }}
    >
      {/* Left Panel — Interview Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 h-14 border-b flex-shrink-0"
          style={{ background: '#111111', borderColor: '#1A1A1A' }}
        >
          <div className="flex items-center gap-4">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: '#606060' }}>
              <X size={16} />
            </button>
            <div>
              <span className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
                {interview.candidate?.name}
              </span>
              <span className="text-xs ml-2" style={{ color: '#606060' }}>
                {interview.candidate?.job?.title}
              </span>
            </div>
          </div>

          {/* Mode Toggle */}
          <div
            className="flex rounded-lg p-1 gap-1"
            style={{ background: '#0A0A0A', border: '1px solid #1A1A1A' }}
          >
            {(['BEHAVIORAL', 'TECHNICAL'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: mode === m ? '#A50000' : 'transparent',
                  color: mode === m ? '#FFFFFF' : '#606060',
                }}
              >
                {m === 'BEHAVIORAL' ? <MessageSquare size={12} /> : <Code2 size={12} />}
                {m === 'BEHAVIORAL' ? 'Behavioral' : 'Technical'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {tabSwitches > 0 && (
              <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
                style={{ background: '#1C1007', color: '#D97706' }}>
                <AlertCircle size={12} />
                {tabSwitches} tab switch{tabSwitches > 1 ? 'es' : ''}
              </div>
            )}
            {avgRating && (
              <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
                style={{ background: '#052E16', color: '#16A34A' }}>
                <Star size={12} />
                Avg: {avgRating}/10
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {mode === 'BEHAVIORAL' ? (
            /* Behavioral — Question Cards */
            <div className="flex-1 flex flex-col p-6 gap-4">
              {questions && questions.length > 0 && (
                <>
                  {/* Question Navigation */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {questions.map((_: any, i: number) => (
                      <button
                        key={i}
                        onClick={() => setCurrentQ(i)}
                        className="w-7 h-7 rounded-full text-xs font-bold transition-all"
                        style={{
                          background: i === currentQ ? '#A50000' : '#1A1A1A',
                          color: i === currentQ ? '#FFFFFF' : '#606060',
                        }}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>

                  {/* Question Card */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentQ}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="rounded-xl border p-6 flex-shrink-0"
                      style={{ background: '#111111', borderColor: '#1A1A1A' }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: '#1A0000', color: '#A50000' }}>
                          {questions[currentQ]?.category}
                        </span>
                        <span className="text-xs" style={{ color: '#606060' }}>
                          Question {currentQ + 1} of {questions.length}
                        </span>
                      </div>
                      <p className="text-base" style={{ color: '#FFFFFF', lineHeight: 1.6 }}>
                        {questions[currentQ]?.question}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  {/* Prev/Next */}
                  <div className="flex gap-3 flex-shrink-0">
                    <Button
                      onClick={() => setCurrentQ(Math.max(0, currentQ - 1))}
                      disabled={currentQ === 0}
                      variant="outline"
                      className="flex-1 h-9"
                      style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={() => setCurrentQ(Math.min(questions.length - 1, currentQ + 1))}
                      disabled={currentQ === questions.length - 1}
                      className="flex-1 h-9"
                      style={{ background: '#1A1A1A', color: '#FFFFFF', border: 'none' }}
                    >
                      Next Question
                    </Button>
                  </div>
                </>
              )}

              {/* Notes */}
              <div className="flex-1">
                <Label style={{ color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 }}>
                  INTERVIEW NOTES
                </Label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Type your notes here..."
                  className="w-full mt-2 rounded-lg px-3 py-2 text-sm resize-none"
                  style={{
                    background: '#111111', border: '1px solid #1A1A1A',
                    color: '#FFFFFF', outline: 'none', height: '120px',
                  }}
                />
              </div>
            </div>
          ) : (
            /* Technical — Code Editor */
            <div className="flex-1 flex flex-col p-6 gap-4">
              {questions && questions.length > 0 && (
                <>
                  {/* Question */}
                  <div className="rounded-xl border p-4 flex-shrink-0"
                    style={{ background: '#111111', borderColor: '#1A1A1A' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: '#1A0000', color: '#A50000' }}>
                        {questions[currentQ]?.category}
                      </span>
                      <div className="flex gap-2">
                        {questions.map((_: any, i: number) => (
                          <button key={i} onClick={() => {
                            setCurrentQ(i)
                            setCode(questions[i]?.starterCode || '')
                          }}
                            className="w-6 h-6 rounded text-xs font-bold transition-all"
                            style={{
                              background: i === currentQ ? '#A50000' : '#1A1A1A',
                              color: i === currentQ ? '#FFFFFF' : '#606060',
                            }}
                          >{i + 1}</button>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm" style={{ color: '#FFFFFF' }}>{questions[currentQ]?.question}</p>
                  </div>

                  {/* Code Area */}
                  <div className="flex-1 rounded-xl border overflow-hidden"
                    style={{ background: '#0D0D0D', borderColor: '#1A1A1A' }}>
                    <div className="flex items-center px-4 h-9 border-b"
                      style={{ background: '#111111', borderColor: '#1A1A1A' }}>
                      <span className="text-xs" style={{ color: '#606060' }}>JavaScript</span>
                    </div>
                    <textarea
                      value={code || questions[currentQ]?.starterCode || ''}
                      onChange={e => setCode(e.target.value)}
                      className="w-full h-full p-4 text-sm font-mono resize-none"
                      style={{
                        background: 'transparent', border: 'none',
                        color: '#E6E6E6', outline: 'none',
                        minHeight: '280px',
                      }}
                      spellCheck={false}
                    />
                  </div>
                </>
              )}

              {/* Notes */}
              <div className="flex-shrink-0">
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Interviewer notes..."
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                  style={{
                    background: '#111111', border: '1px solid #1A1A1A',
                    color: '#FFFFFF', outline: 'none',
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel — Ratings + Candidate */}
      <div
        className="w-80 flex-shrink-0 flex flex-col border-l overflow-y-auto"
        style={{ background: '#111111', borderColor: '#1A1A1A' }}
      >
        {/* Candidate Info */}
        <div className="p-4 border-b" style={{ borderColor: '#1A1A1A' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ background: '#1A0000', color: '#A50000' }}>
              {interview.candidate?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{interview.candidate?.name}</p>
              <p className="text-xs" style={{ color: '#606060' }}>{interview.candidate?.job?.title}</p>
            </div>
          </div>
          {interview.candidate?.cvScore?.totalScore > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <Trophy size={12} style={{ color: '#D97706' }} />
              <span className="text-xs" style={{ color: '#A0A0A0' }}>
                CV Score: <strong style={{ color: '#D97706' }}>{Math.round(interview.candidate.cvScore.totalScore)}%</strong>
              </span>
            </div>
          )}
        </div>

        {/* Ratings */}
        <div className="flex-1 p-4 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>
            RATINGS (1–10)
          </p>
          {categories.map(cat => (
            <div key={cat.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#A0A0A0' }}>
                  {cat.icon} {cat.label}
                </span>
                <span className="text-sm font-bold" style={{
                  color: ratings[cat.key] >= 8 ? '#16A34A' : ratings[cat.key] >= 5 ? '#D97706' : ratings[cat.key] ? '#A50000' : '#606060'
                }}>
                  {ratings[cat.key] ?? '—'}
                </span>
              </div>
              <div className="flex gap-1">
                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                  <button
                    key={n}
                    onClick={() => setRatings(prev => ({ ...prev, [cat.key]: n }))}
                    className="flex-1 h-7 rounded text-xs font-bold transition-all"
                    style={{
                      background: (ratings[cat.key] || 0) >= n
                        ? n >= 8 ? '#16A34A' : n >= 5 ? '#D97706' : '#A50000'
                        : '#1A1A1A',
                      color: (ratings[cat.key] || 0) >= n ? '#FFFFFF' : '#606060',
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="p-4 border-t space-y-2" style={{ borderColor: '#1A1A1A' }}>
          {avgRating && (
            <div className="text-center py-2 rounded-lg mb-2"
              style={{ background: '#0A0A0A' }}>
              <p className="text-xs" style={{ color: '#606060' }}>Average Rating</p>
              <p className="text-2xl font-bold" style={{
                fontFamily: 'var(--font-syne)',
                color: Number(avgRating) >= 7 ? '#16A34A' : Number(avgRating) >= 5 ? '#D97706' : '#A50000'
              }}>
                {avgRating}<span className="text-sm">/10</span>
              </p>
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-10"
            style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 size={16} className="animate-spin" />
                Submitting...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send size={14} />
                Submit Interview
              </span>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Interview Card ─────────────────────────────────────────
function InterviewCard({ interview, onStart }: { interview: any; onStart: (i: any) => void }) {
  const status = STATUS_CONFIG[interview.status as keyof typeof STATUS_CONFIG]
  const qc = useQueryClient()

  const cancel = useMutation({
    mutationFn: () => api.put(`/interviews/${interview.id}/cancel`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interviews'] })
      toast.success('Interview cancelled')
    },
  })

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border transition-all hover:border-[#2E2E2E]"
      style={{ background: '#111111', borderColor: '#1A1A1A' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: '#1A0000', color: '#A50000' }}>
            {interview.candidate?.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{interview.candidate?.name}</p>
            <p className="text-xs" style={{ color: '#606060' }}>{interview.candidate?.job?.title}</p>
          </div>
        </div>
        <span
          className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0"
          style={{ background: status?.bg, color: status?.color }}
        >
          {status?.label}
        </span>
      </div>

      <div className="flex items-center gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          {interview.type === 'TECHNICAL' ? (
            <Code2 size={13} style={{ color: '#5521B5' }} />
          ) : (
            <MessageSquare size={13} style={{ color: '#0284C7' }} />
          )}
          <span className="text-xs" style={{ color: '#A0A0A0' }}>
            {interview.type === 'TECHNICAL' ? 'Technical' : 'Behavioral'}
          </span>
        </div>

        {interview.scheduledAt && (
          <div className="flex items-center gap-1.5">
            <Calendar size={13} style={{ color: '#606060' }} />
            <span className="text-xs" style={{ color: '#606060' }}>
              {new Date(interview.scheduledAt).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
        )}

        {interview.ratings && (
          <div className="flex items-center gap-1.5">
            <Star size={13} style={{ color: '#D97706' }} />
            <span className="text-xs" style={{ color: '#D97706' }}>
              {(Object.values(interview.ratings as Record<string, number>)
                .reduce((a, b) => a + b, 0) / Object.values(interview.ratings).length).toFixed(1)}/10
            </span>
          </div>
        )}
      </div>

      {interview.status === 'SCHEDULED' && (
        <div className="flex gap-2 mt-3">
          <Button
            onClick={() => onStart(interview)}
            className="flex-1 h-8 text-xs"
            style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
          >
            <PlayCircle size={13} className="mr-1.5" />
            Start Interview
          </Button>
          <Button
            onClick={() => cancel.mutate()}
            variant="outline"
            className="h-8 px-3 text-xs"
            style={{ borderColor: '#2E2E2E', color: '#606060', background: 'transparent' }}
          >
            Cancel
          </Button>
        </div>
      )}

      {interview.status === 'COMPLETED' && interview.ratings && (
        <div className="mt-3 p-2 rounded-lg grid grid-cols-2 gap-1.5"
          style={{ background: '#0A0A0A' }}>
          {Object.entries(interview.ratings as Record<string, number>).map(([key, val]) => (
            <div key={key} className="flex justify-between items-center">
              <span className="text-xs capitalize" style={{ color: '#606060' }}>
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </span>
              <span className="text-xs font-bold" style={{
                color: val >= 8 ? '#16A34A' : val >= 5 ? '#D97706' : '#A50000'
              }}>{val}/10</span>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

// ── Main Page ──────────────────────────────────────────────
export default function InterviewsPage() {
  const [showSchedule, setShowSchedule] = useState(false)
  const [activeInterview, setActiveInterview] = useState<any>(null)
  const [filter, setFilter] = useState<string>('ALL')

  const { data: interviews, isLoading } = useInterviews()

  const filtered = interviews?.filter((i: any) =>
    filter === 'ALL' ? true : i.status === filter
  ) || []

  const stats = {
    total: interviews?.length || 0,
    scheduled: interviews?.filter((i: any) => i.status === 'SCHEDULED').length || 0,
    completed: interviews?.filter((i: any) => i.status === 'COMPLETED').length || 0,
    avgScore: interviews?.filter((i: any) => i.ratings)
      .map((i: any) => Object.values(i.ratings as Record<string, number>)
        .reduce((a, b) => a + b, 0) / Object.values(i.ratings).length)
      .reduce((a: number, b: number, _: number, arr: number[]) => a + b / arr.length, 0) || 0,
  }

  const handleStart = async (interview: any) => {
    try {
      await api.put(`/interviews/${interview.id}/start`)
      setActiveInterview(interview)
    } catch {
      setActiveInterview(interview)
    }
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}>
              Interviews
            </h1>
            <p className="text-sm mt-1" style={{ color: '#606060' }}>
              Technical & Behavioral assessment suite
            </p>
          </div>
          <Button
            onClick={() => setShowSchedule(true)}
            className="h-9 gap-2"
            style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
          >
            <Plus size={14} />
            Schedule Interview
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, icon: FileText, color: '#A50000' },
            { label: 'Scheduled', value: stats.scheduled, icon: Calendar, color: '#0284C7' },
            { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: '#16A34A' },
            { label: 'Avg Score', value: stats.avgScore > 0 ? `${stats.avgScore.toFixed(1)}/10` : '—', icon: Star, color: '#D97706' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="p-4 rounded-xl border"
              style={{ background: '#111111', borderColor: '#1A1A1A', borderTop: `3px solid ${stat.color}` }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: '#606060' }}>{stat.label}</span>
                <stat.icon size={16} style={{ color: stat.color }} />
              </div>
              <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-syne)', color: stat.color }}>
                {stat.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2">
          {['ALL', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
              style={{
                background: filter === f ? '#A50000' : '#111111',
                color: filter === f ? '#FFFFFF' : '#606060',
                border: `1px solid ${filter === f ? '#A50000' : '#2E2E2E'}`,
              }}
            >
              {f === 'ALL' ? 'All' : f.replace('_', ' ')}
              {f !== 'ALL' && ` (${interviews?.filter((i: any) => i.status === f).length || 0})`}
            </button>
          ))}
        </div>

        {/* Interview List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin" style={{ color: '#A50000' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 rounded-xl border"
            style={{ background: '#111111', borderColor: '#1A1A1A' }}
          >
            <Code2 size={40} style={{ color: '#2E2E2E' }} />
            <p className="text-sm mt-4" style={{ color: '#606060' }}>No interviews yet</p>
            <button
              onClick={() => setShowSchedule(true)}
              className="text-xs mt-2"
              style={{ color: '#A50000' }}
            >
              Schedule your first interview
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((interview: any) => (
              <InterviewCard
                key={interview.id}
                interview={interview}
                onStart={handleStart}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <ScheduleModal open={showSchedule} onClose={() => setShowSchedule(false)} />

      <AnimatePresence>
        {activeInterview && (
          <InterviewSession
            interview={activeInterview}
            onClose={() => setActiveInterview(null)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
