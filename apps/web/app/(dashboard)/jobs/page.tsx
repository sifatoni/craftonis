'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import {
  Upload, Plus, Search, Briefcase, Users, Clock,
  ChevronRight, X, Loader2, User,
  ArrowRight, CheckCircle2, Circle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useJobs,
  useCreateJob,
  useCandidates,
  usePipelineStats,
  useUpdateCandidateStage,
  useCreateCandidate,
} from '@/hooks/useJobs'

// ── Constants ─────────────────────────────────────────────
const STAGES = [
  { key: 'APPLIED',      label: 'Applied',      color: '#606060' },
  { key: 'CV_REVIEWED',  label: 'CV Reviewed',  color: '#0284C7' },
  { key: 'PHONE_SCREEN', label: 'Phone Screen', color: '#D97706' },
  { key: 'INTERVIEW',    label: 'Interview',    color: '#5521B5' },
  { key: 'OFFER',        label: 'Offer',        color: '#16A34A' },
  { key: 'HIRED',        label: 'Hired',        color: '#A50000' },
  { key: 'REJECTED',     label: 'Rejected',     color: '#374151' },
]

const createJobSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().optional(),
  requirements: z.string().optional(),
  salaryMin: z.string().optional(),
  salaryMax: z.string().optional(),
})

const createCandidateSchema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Valid email required'),
  phone: z.string().optional(),
})

// ── Job Card ──────────────────────────────────────────────
function JobCard({
  job, isSelected, onClick,
}: {
  job: any; isSelected: boolean; onClick: () => void
}) {
  const statusColors: Record<string, string> = {
    OPEN: '#16A34A', PAUSED: '#D97706', CLOSED: '#606060',
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onClick}
      className="p-4 rounded-xl border cursor-pointer transition-all"
      style={{
        background: isSelected ? '#1A0000' : '#111111',
        borderColor: isSelected ? '#A50000' : '#1A1A1A',
        borderLeft: isSelected ? '3px solid #A50000' : '3px solid transparent',
      }}
    >
      <div className="flex items-start justify-between mb-2">
        <h3
          className="text-sm font-semibold leading-tight"
          style={{ color: '#FFFFFF' }}
        >
          {job.title}
        </h3>
        <div
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
          style={{ background: statusColors[job.status] || '#606060' }}
        />
      </div>

      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1">
          <Users size={12} style={{ color: '#606060' }} />
          <span className="text-xs" style={{ color: '#606060' }}>
            {job.candidateCount ?? 0}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock size={12} style={{ color: '#606060' }} />
          <span className="text-xs" style={{ color: '#606060' }}>
            {job.daysOpen ?? 0}d
          </span>
        </div>
        {job.department && (
          <Badge
            variant="outline"
            className="text-xs px-1.5 py-0"
            style={{ borderColor: '#2E2E2E', color: '#A0A0A0' }}
          >
            {job.department.name}
          </Badge>
        )}
      </div>
    </motion.div>
  )
}

// ── Candidate Card ────────────────────────────────────────
function CandidateCard({
  candidate, onStageChange,
}: {
  candidate: any; onStageChange: (id: string, stage: string) => void
}) {
  const stage = STAGES.find((s) => s.key === candidate.stage)
  const score = candidate.cvScore?.totalScore
  const nextStage = STAGES[STAGES.findIndex((s) => s.key === candidate.stage) + 1]
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Only PDF files are supported')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const token = localStorage.getItem('craftonis_access_token')
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/cv/${candidate.id}/parse`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      )

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message || 'Upload failed')
      }

      toast.success('CV uploaded and parsed successfully!')
      // Refresh candidates
      window.location.reload()
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload CV')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 rounded-xl border mb-3"
      style={{ background: '#111111', borderColor: '#1A1A1A' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: '#1A1A1A', color: '#A50000' }}
          >
            {candidate.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>
              {candidate.name}
            </p>
            <p className="text-xs" style={{ color: '#606060' }}>
              {candidate.email}
            </p>
          </div>
        </div>

        {score !== undefined && score !== null && score > 0 ? (
          <div
            className="text-xs font-bold px-2 py-1 rounded-lg"
            style={{
              background: score >= 70 ? '#052E16' : score >= 50 ? '#1C1007' : '#1A0000',
              color: score >= 70 ? '#16A34A' : score >= 50 ? '#D97706' : '#A50000',
            }}
          >
            {Math.round(score)}%
          </div>
        ) : (
          <div
            className="text-xs px-2 py-1 rounded-lg"
            style={{ background: '#1A1A1A', color: '#606060' }}
          >
            No score
          </div>
        )}
      </div>

      {/* CV Upload / Score section */}
      <div
        className="mt-3 pt-3 flex items-center gap-2"
        style={{ borderTop: '1px solid #1A1A1A' }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleCvUpload}
        />

        {!candidate.cvScore ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{
              background: '#1A1A1A',
              color: uploading ? '#606060' : '#A0A0A0',
              border: '1px dashed #2E2E2E',
            }}
          >
            {uploading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Upload size={12} />
            )}
            {uploading ? 'Uploading...' : 'Upload CV (PDF)'}
          </button>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{
              background: '#052E16',
              color: '#16A34A',
              border: '1px solid #16A34A20',
            }}
          >
            {uploading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <CheckCircle2 size={12} />
            )}
            {uploading ? 'Uploading...' : 'CV Uploaded — Replace'}
          </button>
        )}

        <div className="flex-1" />

        {nextStage && nextStage.key !== 'REJECTED' && (
          <button
            onClick={() => onStageChange(candidate.id, nextStage.key)}
            className="flex items-center gap-1 text-xs transition-colors hover:opacity-80 flex-shrink-0"
            style={{ color: nextStage.color }}
          >
            {nextStage.label}
            <ArrowRight size={12} />
          </button>
        )}
      </div>

      {/* Stage badge */}
      <div className="mt-2">
        <div
          className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
          style={{ background: `${stage?.color}15`, color: stage?.color }}
        >
          <Circle size={6} fill={stage?.color} />
          {stage?.label}
        </div>
      </div>
    </motion.div>
  )
}

// ── Create Job Modal ──────────────────────────────────────
function CreateJobModal({
  open, onClose,
}: {
  open: boolean; onClose: () => void
}) {
  const createJob = useCreateJob()
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(createJobSchema),
  })

  const onSubmit = async (data: any) => {
    await createJob.mutateAsync({
      ...data,
      salaryMin: data.salaryMin ? parseInt(data.salaryMin) : undefined,
      salaryMax: data.salaryMax ? parseInt(data.salaryMax) : undefined,
    })
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-lg"
        style={{ background: '#111111', border: '1px solid #2E2E2E' }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}>
            Post New Job
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {[
            { id: 'title', label: 'JOB TITLE *', placeholder: 'e.g. Senior Frontend Engineer' },
            { id: 'description', label: 'DESCRIPTION', placeholder: 'Job description...', textarea: true },
            { id: 'requirements', label: 'REQUIREMENTS', placeholder: 'Required skills and experience...', textarea: true },
          ].map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label style={{ color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 }}>
                {field.label}
              </Label>
              {field.textarea ? (
                <textarea
                  {...register(field.id as any)}
                  placeholder={field.placeholder}
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                  style={{
                    background: '#0A0A0A',
                    border: '1px solid #2E2E2E',
                    color: '#FFFFFF',
                    outline: 'none',
                  }}
                />
              ) : (
                <Input
                  {...register(field.id as any)}
                  placeholder={field.placeholder}
                  className="h-10"
                  style={{ background: '#0A0A0A', border: '1px solid #2E2E2E', color: '#FFFFFF' }}
                />
              )}
              {(errors as any)[field.id] && (
                <p className="text-xs" style={{ color: '#DC2626' }}>
                  {(errors as any)[field.id]?.message}
                </p>
              )}
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'salaryMin', label: 'SALARY MIN', placeholder: '50000' },
              { id: 'salaryMax', label: 'SALARY MAX', placeholder: '80000' },
            ].map((field) => (
              <div key={field.id} className="space-y-1.5">
                <Label style={{ color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 }}>
                  {field.label}
                </Label>
                <Input
                  {...register(field.id as any)}
                  placeholder={field.placeholder}
                  type="number"
                  className="h-10"
                  style={{ background: '#0A0A0A', border: '1px solid #2E2E2E', color: '#FFFFFF' }}
                />
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-10"
              style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createJob.isPending}
              className="flex-1 h-10"
              style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
            >
              {createJob.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : 'Post Job'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Add Candidate Modal ────────────────────────────────────
function AddCandidateModal({
  open, onClose, jobId,
}: {
  open: boolean; onClose: () => void; jobId: string
}) {
  const createCandidate = useCreateCandidate()
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(createCandidateSchema),
  })

  const onSubmit = async (data: any) => {
    await createCandidate.mutateAsync({ ...data, jobId })
    reset()
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md"
        style={{ background: '#111111', border: '1px solid #2E2E2E' }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}>
            Add Candidate
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-2">
          {[
            { id: 'name', label: 'FULL NAME *', placeholder: 'Arif Hassan' },
            { id: 'email', label: 'EMAIL *', placeholder: 'arif@example.com' },
            { id: 'phone', label: 'PHONE', placeholder: '+8801712345678' },
          ].map((field) => (
            <div key={field.id} className="space-y-1.5">
              <Label style={{ color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 }}>
                {field.label}
              </Label>
              <Input
                {...register(field.id as any)}
                placeholder={field.placeholder}
                className="h-10"
                style={{ background: '#0A0A0A', border: '1px solid #2E2E2E', color: '#FFFFFF' }}
              />
              {(errors as any)[field.id] && (
                <p className="text-xs" style={{ color: '#DC2626' }}>
                  {(errors as any)[field.id]?.message}
                </p>
              )}
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 h-10"
              style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createCandidate.isPending}
              className="flex-1 h-10"
              style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
            >
              {createCandidate.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : 'Add Candidate'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ─────────────────────────────────────────────
export default function JobsPage() {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showCreateJob, setShowCreateJob] = useState(false)
  const [showAddCandidate, setShowAddCandidate] = useState(false)
  const [stageFilter, setStageFilter] = useState<string | null>(null)

  const { data: jobs, isLoading: jobsLoading } = useJobs({ search: search || undefined })
  const { data: candidates, isLoading: candidatesLoading } = useCandidates(selectedJobId || '')
  const { data: pipelineStats } = usePipelineStats(selectedJobId || '')
  const updateStage = useUpdateCandidateStage()

  const selectedJob = jobs?.find((j: any) => j.id === selectedJobId)

  const filteredCandidates = stageFilter
    ? candidates?.filter((c: any) => c.stage === stageFilter)
    : candidates

  return (
    <div className="flex gap-6 h-full animate-fade-in" style={{ minHeight: 'calc(100vh - 120px)' }}>

      {/* Left — Job List */}
      <div className="w-72 flex flex-col flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h1
            className="text-xl font-bold"
            style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}
          >
            Jobs
          </h1>
          <Button
            onClick={() => setShowCreateJob(true)}
            size="sm"
            className="h-8 gap-1.5"
            style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
          >
            <Plus size={14} />
            Post Job
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: '#606060' }}
          />
          <Input
            placeholder="Search jobs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8 text-sm"
            style={{
              background: '#111111',
              border: '1px solid #1A1A1A',
              color: '#FFFFFF',
            }}
          />
        </div>

        {/* Job list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {jobsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="animate-spin" style={{ color: '#606060' }} />
            </div>
          ) : !jobs || jobs.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-48 rounded-xl border"
              style={{ background: '#111111', borderColor: '#1A1A1A' }}
            >
              <Briefcase size={32} style={{ color: '#2E2E2E' }} />
              <p className="text-sm mt-3" style={{ color: '#606060' }}>
                No jobs yet
              </p>
              <button
                onClick={() => setShowCreateJob(true)}
                className="text-xs mt-2"
                style={{ color: '#A50000' }}
              >
                Post your first job
              </button>
            </div>
          ) : (
            jobs.map((job: any) => (
              <JobCard
                key={job.id}
                job={job}
                isSelected={selectedJobId === job.id}
                onClick={() => setSelectedJobId(job.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right — Candidate Pipeline */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedJobId ? (
          <div
            className="flex-1 flex flex-col items-center justify-center rounded-xl border"
            style={{ background: '#111111', borderColor: '#1A1A1A' }}
          >
            <Briefcase size={48} style={{ color: '#2E2E2E' }} />
            <p className="text-base mt-4 font-medium" style={{ color: '#606060' }}>
              Select a job to view candidates
            </p>
            <p className="text-sm mt-1" style={{ color: '#3D3D3D' }}>
              or post a new job to get started
            </p>
          </div>
        ) : (
          <>
            {/* Pipeline Header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2
                  className="text-lg font-bold"
                  style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}
                >
                  {selectedJob?.title}
                </h2>
                <p className="text-sm" style={{ color: '#606060' }}>
                  {candidates?.length ?? 0} candidates
                </p>
              </div>
              <Button
                onClick={() => setShowAddCandidate(true)}
                size="sm"
                className="h-8 gap-1.5"
                style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
              >
                <Plus size={14} />
                Add Candidate
              </Button>
            </div>

            {/* Stage Filter */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              <button
                onClick={() => setStageFilter(null)}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0"
                style={{
                  background: !stageFilter ? '#A50000' : '#111111',
                  color: !stageFilter ? '#FFFFFF' : '#606060',
                  border: `1px solid ${!stageFilter ? '#A50000' : '#2E2E2E'}`,
                }}
              >
                All ({candidates?.length ?? 0})
              </button>
              {STAGES.map((stage) => {
                const count = pipelineStats?.find((s: any) => s.stage === stage.key)?.count ?? 0
                const isActive = stageFilter === stage.key
                return (
                  <button
                    key={stage.key}
                    onClick={() => setStageFilter(isActive ? null : stage.key)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0"
                    style={{
                      background: isActive ? `${stage.color}20` : '#111111',
                      color: isActive ? stage.color : '#606060',
                      border: `1px solid ${isActive ? stage.color : '#2E2E2E'}`,
                    }}
                  >
                    {stage.label} ({count})
                  </button>
                )
              })}
            </div>

            {/* Candidates */}
            <div className="flex-1 overflow-y-auto">
              {candidatesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 size={20} className="animate-spin" style={{ color: '#606060' }} />
                </div>
              ) : !filteredCandidates || filteredCandidates.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center h-48 rounded-xl border"
                  style={{ background: '#111111', borderColor: '#1A1A1A' }}
                >
                  <User size={32} style={{ color: '#2E2E2E' }} />
                  <p className="text-sm mt-3" style={{ color: '#606060' }}>
                    No candidates {stageFilter ? `in ${STAGES.find(s => s.key === stageFilter)?.label}` : 'yet'}
                  </p>
                  {!stageFilter && (
                    <button
                      onClick={() => setShowAddCandidate(true)}
                      className="text-xs mt-2"
                      style={{ color: '#A50000' }}
                    >
                      Add first candidate
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filteredCandidates.map((candidate: any) => (
                    <CandidateCard
                      key={candidate.id}
                      candidate={candidate}
                      onStageChange={(id, stage) =>
                        updateStage.mutate({ id, stage })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <CreateJobModal
        open={showCreateJob}
        onClose={() => setShowCreateJob(false)}
      />
      {selectedJobId && (
        <AddCandidateModal
          open={showAddCandidate}
          onClose={() => setShowAddCandidate(false)}
          jobId={selectedJobId}
        />
      )}
    </div>
  )
}
