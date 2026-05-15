'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, ChevronDown, Code2, Loader2, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

type InterviewType = 'GENERAL' | 'BEHAVIORAL' | 'TECHNICAL'

interface ScheduleInterviewModalProps {
  open: boolean
  onClose: () => void
  preselectedJobId?: string
  preselectedJobTitle?: string
  preselectedCandidateId?: string
  preselectedCandidateName?: string
  lockCandidate?: boolean
}

const INTERVIEW_TYPES: Array<{ value: InterviewType; label: string; icon: typeof Calendar }> = [
  { value: 'GENERAL', label: 'General', icon: Calendar },
  { value: 'BEHAVIORAL', label: 'Behavioral', icon: MessageSquare },
  { value: 'TECHNICAL', label: 'Technical', icon: Code2 },
]

function scoreLabel(score: number | undefined | null): string {
  if (score == null || score === 0) return ''
  return ` — ${Math.round(score)}%`
}

export function ScheduleInterviewModal({
  open,
  onClose,
  preselectedJobId,
  preselectedJobTitle,
  preselectedCandidateId,
  preselectedCandidateName,
  lockCandidate = false,
}: ScheduleInterviewModalProps) {
  const qc = useQueryClient()
  const [jobId, setJobId] = useState(preselectedJobId || '')
  const [candidateId, setCandidateId] = useState(preselectedCandidateId || '')
  const [types, setTypes] = useState<InterviewType[]>(['GENERAL'])
  const [scheduledAt, setScheduledAt] = useState('')
  const [notes, setNotes] = useState('')

  // Reset all fields when modal opens
  useEffect(() => {
    if (!open) return
    setJobId(preselectedJobId || '')
    setCandidateId(preselectedCandidateId || '')
    setTypes(['GENERAL'])
    setScheduledAt('')
    setNotes('')
  }, [open, preselectedJobId, preselectedCandidateId])

  // Reset candidate when job changes (but not on first mount)
  const handleJobChange = (newJobId: string) => {
    setJobId(newJobId)
    setCandidateId('')
  }

  // Fetch jobs for the job dropdown (only when not locked)
  const { data: jobs = [] } = useQuery<any[]>({
    queryKey: ['jobs', { status: 'OPEN' }],
    queryFn: () => api.get('/jobs', { params: { status: 'OPEN' } }).then(r => r.data),
    enabled: open && !lockCandidate,
  })

  // Fetch candidates for the selected job
  const { data: candidates = [], isFetching: candidatesLoading } = useQuery<any[]>({
    queryKey: ['candidates', jobId],
    queryFn: () => api.get(`/jobs/${jobId}/candidates`).then(r => r.data),
    enabled: open && !!jobId && !lockCandidate,
  })

  const schedule = useMutation({
    mutationFn: (data: any) => api.post('/interviews', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['interviews'] })
      qc.invalidateQueries({ queryKey: ['candidates'] })
      qc.invalidateQueries({ queryKey: ['pipeline-stats'] })
      toast.success('Interview scheduled!')
      onClose()
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to schedule'),
  })

  const canSubmit = !!candidateId && types.length > 0 && !schedule.isPending

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" style={{ background: '#111111', border: '1px solid #2E2E2E' }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}>
            Schedule Interview
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">

          {/* ── Job selector ── */}
          <div className="space-y-1.5">
            <Label style={{ color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 }}>JOB *</Label>
            <div className="relative">
              <select
                value={jobId}
                onChange={e => handleJobChange(e.target.value)}
                disabled={lockCandidate}
                className="appearance-none w-full h-10 rounded-lg px-3 pr-10 text-sm disabled:cursor-not-allowed disabled:opacity-80"
                style={{ background: '#0A0A0A', border: '1px solid #2E2E2E', color: jobId ? '#FFFFFF' : '#606060' }}
              >
                {lockCandidate && preselectedJobId ? (
                  <option value={preselectedJobId}>{preselectedJobTitle || 'Selected Job'}</option>
                ) : (
                  <>
                    <option value="">Select job...</option>
                    {jobs.map((j: any) => (
                      <option key={j.id} value={j.id}>{j.title}</option>
                    ))}
                  </>
                )}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#606060' }} />
            </div>
          </div>

          {/* ── Candidate selector ── */}
          <div className="space-y-1.5">
            <Label style={{ color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 }}>CANDIDATE *</Label>
            <div className="relative">
              <select
                value={candidateId}
                onChange={e => setCandidateId(e.target.value)}
                disabled={lockCandidate || !jobId || candidatesLoading}
                className="appearance-none w-full h-10 rounded-lg px-3 pr-10 text-sm disabled:cursor-not-allowed disabled:opacity-80"
                style={{ background: '#0A0A0A', border: '1px solid #2E2E2E', color: candidateId ? '#FFFFFF' : '#606060' }}
              >
                {lockCandidate && preselectedCandidateId ? (
                  <option value={preselectedCandidateId}>
                    {preselectedCandidateName || 'Selected Candidate'}
                  </option>
                ) : (
                  <>
                    <option value="">
                      {!jobId ? 'Select a job first...' : candidatesLoading ? 'Loading...' : 'Select candidate...'}
                    </option>
                    {candidates.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{scoreLabel(c.cvScore?.totalScore)}
                      </option>
                    ))}
                  </>
                )}
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#606060' }} />
            </div>
          </div>

          {/* ── Interview type ── */}
          <div className="space-y-1.5">
            <Label style={{ color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 }}>INTERVIEW TYPE *</Label>
            <div className="grid grid-cols-3 gap-2">
              {INTERVIEW_TYPES.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setTypes(prev => 
                      prev.includes(value) ? prev.filter(t => t !== value) : [...prev, value]
                    )
                  }}
                  className="flex items-center gap-2 p-3 rounded-lg border transition-all"
                  style={{
                    background: types.includes(value) ? '#1A0000' : '#0A0A0A',
                    borderColor: types.includes(value) ? '#A50000' : '#2E2E2E',
                    color: types.includes(value) ? '#FFFFFF' : '#A0A0A0',
                  }}
                >
                  <Icon size={14} />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Date / time ── */}
          <div className="space-y-1.5">
            <Label style={{ color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 }}>SCHEDULED DATE & TIME</Label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={e => {
                setScheduledAt(e.target.value);
                if (e.target.value) {
                  setTimeout(() => e.target.blur(), 100);
                }
              }}
              onBlur={e => e.target.blur()}
              className="w-full h-10 rounded-lg px-3 text-sm cursor-pointer"
              style={{ background: '#0A0A0A', border: '1px solid #2E2E2E', color: '#FFFFFF', colorScheme: 'dark' }}
            />
          </div>

          {/* ── Notes ── */}
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
              onClick={() => schedule.mutate({
                candidateId,
                jobId: jobId || undefined,
                types,
                scheduledAt: scheduledAt || undefined,
                notes: notes || undefined,
              })}
              disabled={!canSubmit}
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
