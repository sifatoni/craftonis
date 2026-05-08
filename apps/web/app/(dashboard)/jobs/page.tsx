'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Briefcase, Users, Clock,
  ChevronRight, X, Loader2, User,
  ArrowRight, CheckCircle2, Circle,
  FileText, FileSpreadsheet, UserPlus,
  Upload, Download, Trash2, Mail, Phone, ExternalLink
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
  useDeleteCandidate,
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

// ── Candidate Detail Panel ──────────────────────────────────
function CandidateDetailPanel({
  candidate,
  onClose,
  onDelete,
}: {
  candidate: any
  onClose: () => void
  onDelete: (id: string) => void
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const deleteCandidate = useDeleteCandidate()
  const parsedData = candidate.cvScore?.parsedData as any
  const stage = STAGES.find((s) => s.key === candidate.stage)

  const handleDelete = async () => {
    await deleteCandidate.mutateAsync(candidate.id)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="w-96 flex-shrink-0 rounded-xl border overflow-y-auto"
      style={{ background: '#111111', borderColor: '#1A1A1A', maxHeight: 'calc(100vh - 160px)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b sticky top-0 z-10"
        style={{ background: '#111111', borderColor: '#1A1A1A' }}
      >
        <h3 className="text-sm font-semibold" style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}>
          Candidate Profile
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-1.5 rounded-lg transition-colors hover:bg-red-950"
            style={{ color: '#DC2626' }}
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: '#606060' }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Avatar + Name */}
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0"
            style={{ background: '#1A0000', color: '#A50000' }}
          >
            {candidate.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <h2 className="text-base font-bold" style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}>
              {candidate.name}
            </h2>
            <div
              className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full mt-1"
              style={{ background: `${stage?.color}15`, color: stage?.color }}
            >
              <Circle size={5} fill={stage?.color} />
              {stage?.label}
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>Contact</p>
          {[
            { icon: Mail, label: candidate.email },
            { icon: Phone, label: candidate.phone || 'Not provided' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <item.icon size={13} style={{ color: '#A50000', flexShrink: 0 }} />
              <span className="text-sm" style={{ color: candidate.phone || i === 0 ? '#A0A0A0' : '#3D3D3D' }}>
                {item.label}
              </span>
            </div>
          ))}
          {parsedData?.linkedinUrl && (
            <div className="flex items-center gap-2">
              <ExternalLink size={13} style={{ color: '#A50000', flexShrink: 0 }} />
              <a
                href={parsedData.linkedinUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm hover:underline"
                style={{ color: '#0284C7' }}
              >
                LinkedIn Profile
              </a>
            </div>
          )}
        </div>

        {/* Summary */}
        {parsedData?.summary && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>Summary</p>
            <p className="text-sm leading-relaxed" style={{ color: '#A0A0A0' }}>
              {parsedData.summary}
            </p>
          </div>
        )}

        {/* Skills */}
        {parsedData?.skills?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {parsedData.skills.slice(0, 15).map((skill: string, i: number) => (
                <span
                  key={i}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: '#1A1A1A', color: '#A0A0A0' }}
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Experience */}
        {parsedData?.experience?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>
              Experience ({parsedData.totalYearsExperience || '?'} years)
            </p>
            <div className="space-y-3">
              {parsedData.experience.map((exp: any, i: number) => (
                <div key={i} className="pl-3 border-l-2" style={{ borderColor: '#2E2E2E' }}>
                  <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{exp.role}</p>
                  <p className="text-xs" style={{ color: '#A50000' }}>{exp.company}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#606060' }}>
                    {exp.startDate} — {exp.endDate} · {exp.tenureMonths ? `${Math.round(exp.tenureMonths / 12 * 10) / 10} yrs` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {parsedData?.education?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>Education</p>
            <div className="space-y-2">
              {parsedData.education.map((edu: any, i: number) => (
                <div key={i} className="pl-3 border-l-2" style={{ borderColor: '#2E2E2E' }}>
                  <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{edu.degree}</p>
                  <p className="text-xs" style={{ color: '#A0A0A0' }}>{edu.institution}</p>
                  {edu.year && <p className="text-xs" style={{ color: '#606060' }}>{edu.year}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements */}
        {parsedData?.achievements?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>Achievements</p>
            <ul className="space-y-1.5">
              {parsedData.achievements.map((a: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#A0A0A0' }}>
                  <span style={{ color: '#A50000', flexShrink: 0 }}>•</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Certifications */}
        {parsedData?.certifications?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>Certifications</p>
            <ul className="space-y-1">
              {parsedData.certifications.map((c: string, i: number) => (
                <li key={i} className="text-sm" style={{ color: '#A0A0A0' }}>
                  🏅 {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Languages */}
        {parsedData?.languages?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>Languages</p>
            <div className="flex flex-wrap gap-1.5">
              {parsedData.languages.map((lang: string, i: number) => (
                <span key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#1A1A1A', color: '#A0A0A0' }}>
                  {lang}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirm */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)' }}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="rounded-xl p-6 w-full max-w-sm"
              style={{ background: '#111111', border: '1px solid #2E2E2E' }}
            >
              <h3 className="text-base font-bold mb-2" style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}>
                Remove Candidate?
              </h3>
              <p className="text-sm mb-4" style={{ color: '#A0A0A0' }}>
                This will permanently delete <strong style={{ color: '#FFFFFF' }}>{candidate.name}</strong> and all their data. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  variant="outline"
                  className="flex-1 h-9"
                  style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDelete}
                  disabled={deleteCandidate.isPending}
                  className="flex-1 h-9"
                  style={{ background: '#DC2626', color: '#FFFFFF', border: 'none' }}
                >
                  {deleteCandidate.isPending ? <Loader2 size={14} className="animate-spin" /> : 'Remove'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Candidate Card ────────────────────────────────────────
function CandidateCard({
  candidate, onStageChange, onSelect, isSelected,
}: {
  candidate: any
  onStageChange: (id: string, stage: string) => void
  onSelect: (candidate: any) => void
  isSelected: boolean
}) {
  const stage = STAGES.find((s) => s.key === candidate.stage)
  const score = candidate.cvScore?.totalScore
  const nextStage = STAGES[STAGES.findIndex((s) => s.key === candidate.stage) + 1]
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const handleCvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') { toast.error('Only PDF files are supported'); return }
    if (file.size > 5 * 1024 * 1024) { toast.error('File size must be under 5MB'); return }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const token = localStorage.getItem('craftonis_access_token')
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/cv/${candidate.id}/parse`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }
      )
      if (!response.ok) { const err = await response.json(); throw new Error(err.message || 'Upload failed') }
      toast.success('CV uploaded and parsed successfully!')
      qc.invalidateQueries({ queryKey: ['candidates'] })
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
      className="p-4 rounded-xl border mb-3 cursor-pointer transition-all"
      style={{
        background: isSelected ? '#1A0000' : '#111111',
        borderColor: isSelected ? '#A50000' : '#1A1A1A',
      }}
      onClick={() => onSelect(candidate)}
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
            <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{candidate.name}</p>
            <p className="text-xs" style={{ color: '#606060' }}>{candidate.email}</p>
          </div>
        </div>
        {score !== undefined && score !== null && score > 0 ? (
          <div className="text-xs font-bold px-2 py-1 rounded-lg" style={{
            background: score >= 70 ? '#052E16' : score >= 50 ? '#1C1007' : '#1A0000',
            color: score >= 70 ? '#16A34A' : score >= 50 ? '#D97706' : '#A50000',
          }}>
            {Math.round(score)}%
          </div>
        ) : (
          <div className="text-xs px-2 py-1 rounded-lg" style={{ background: '#1A1A1A', color: '#606060' }}>No score</div>
        )}
      </div>

      <div className="mt-3 pt-3 flex items-center gap-2" style={{ borderTop: '1px solid #1A1A1A' }} onClick={(e) => e.stopPropagation()}>
        <input ref={fileInputRef} type="file" accept=".pdf" className="hidden" onChange={handleCvUpload} />
        {!candidate.cvScore ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{ background: '#1A1A1A', color: uploading ? '#606060' : '#A0A0A0', border: '1px dashed #2E2E2E' }}
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? 'Uploading...' : 'Upload CV'}
          </button>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{ background: '#052E16', color: '#16A34A', border: '1px solid #16A34A20' }}
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {uploading ? 'Uploading...' : 'CV Uploaded — Replace'}
          </button>
        )}
        <div className="flex-1" />
        {nextStage && nextStage.key !== 'REJECTED' && (
          <button
            onClick={(e) => { e.stopPropagation(); onStageChange(candidate.id, nextStage.key) }}
            className="flex items-center gap-1 text-xs transition-colors hover:opacity-80 flex-shrink-0"
            style={{ color: nextStage.color }}
          >
            {nextStage.label} <ArrowRight size={12} />
          </button>
        )}
      </div>

      <div className="mt-2">
        <div className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full" style={{ background: `${stage?.color}15`, color: stage?.color }}>
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
  const [mode, setMode] = useState<'select' | 'cv' | 'excel' | 'manual'>('select')
  const [cvFiles, setCvFiles] = useState<File[]>([])
  const [excelFile, setExcelFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<any>(null)
  const cvInputRef = useRef<HTMLInputElement>(null)
  const excelInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const createCandidate = useCreateCandidate()

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(createCandidateSchema),
  })

  const handleClose = () => {
    setMode('select')
    setCvFiles([])
    setExcelFile(null)
    setResults(null)
    reset()
    onClose()
  }

  const handleCvSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const pdfs = files.filter((f) => f.type === 'application/pdf')
    if (pdfs.length !== files.length) toast.warning('Only PDF files are accepted. Non-PDFs were skipped.')
    setCvFiles(pdfs)
  }

  const handleCvUpload = async () => {
    if (!cvFiles.length) return
    setUploading(true)
    try {
      const formData = new FormData()
      cvFiles.forEach((file) => formData.append('files', file))
      const token = localStorage.getItem('craftonis_access_token')
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/cv/bulk-parse/${jobId}`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Upload failed')
      setResults(data)
      qc.invalidateQueries({ queryKey: ['candidates', jobId] })
      toast.success(`${data.summary.created} candidate(s) added from CV!`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload CVs')
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadTemplate = async () => {
    const token = localStorage.getItem('craftonis_access_token')
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/candidates/template/excel`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'craftonis-candidate-template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Template downloaded!')
  }

  const handleExcelUpload = async () => {
    if (!excelFile) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', excelFile)
      const token = localStorage.getItem('craftonis_access_token')
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/jobs/${jobId}/import-excel`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: formData }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Import failed')
      setResults(data)
      qc.invalidateQueries({ queryKey: ['candidates', jobId] })
      toast.success(`${data.summary.created} candidate(s) imported from Excel!`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to import Excel')
    } finally {
      setUploading(false)
    }
  }

  const onManualSubmit = async (data: any) => {
    await createCandidate.mutateAsync({ ...data, jobId })
    reset()
    handleClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-lg"
        style={{ background: '#111111', border: '1px solid #2E2E2E' }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}>
            {mode === 'select' && 'Add Candidate'}
            {mode === 'cv' && 'Add from CV'}
            {mode === 'excel' && 'Add from Excel'}
            {mode === 'manual' && 'Manual Entry'}
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">

          {/* ── MODE SELECT ── */}
          {mode === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3 mt-2"
            >
              {[
                {
                  mode: 'cv' as const,
                  icon: FileText,
                  title: 'From CV (PDF)',
                  desc: 'Upload one or multiple CVs — AI auto-extracts name, contact, skills, experience',
                  badge: 'Recommended',
                  badgeColor: '#16A34A',
                },
                {
                  mode: 'excel' as const,
                  icon: FileSpreadsheet,
                  title: 'From Excel',
                  desc: 'Bulk import from spreadsheet. Include CV links for auto-parse.',
                  badge: 'Bulk',
                  badgeColor: '#0284C7',
                },
                {
                  mode: 'manual' as const,
                  icon: UserPlus,
                  title: 'Manual Entry',
                  desc: 'Fill in candidate details manually.',
                  badge: null,
                  badgeColor: '',
                },
              ].map((option) => (
                <button
                  key={option.mode}
                  onClick={() => setMode(option.mode)}
                  className="w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all hover:border-crimson"
                  style={{ background: '#0A0A0A', borderColor: '#2E2E2E' }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: '#1A1A1A' }}
                  >
                    <option.icon size={20} style={{ color: '#A50000' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
                        {option.title}
                      </span>
                      {option.badge && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ background: `${option.badgeColor}20`, color: option.badgeColor }}
                        >
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: '#606060' }}>
                      {option.desc}
                    </p>
                  </div>
                  <ChevronRight size={16} style={{ color: '#606060', flexShrink: 0, marginTop: 2 }} />
                </button>
              ))}
            </motion.div>
          )}

          {/* ── FROM CV ── */}
          {mode === 'cv' && !results && (
            <motion.div
              key="cv"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4 mt-2"
            >
              <input
                ref={cvInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={handleCvSelect}
              />

              <button
                onClick={() => cvInputRef.current?.click()}
                className="w-full h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 transition-colors"
                style={{ borderColor: cvFiles.length ? '#A50000' : '#2E2E2E', background: '#0A0A0A' }}
              >
                {cvFiles.length === 0 ? (
                  <>
                    <Upload size={28} style={{ color: '#606060' }} />
                    <div className="text-center">
                      <p className="text-sm font-medium" style={{ color: '#A0A0A0' }}>
                        Click to select PDF files
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#606060' }}>
                        Multiple CVs supported — max 5MB each
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={28} style={{ color: '#A50000' }} />
                    <div className="text-center">
                      <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
                        {cvFiles.length} PDF{cvFiles.length > 1 ? 's' : ''} selected
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#606060' }}>
                        Click to change selection
                      </p>
                    </div>
                  </>
                )}
              </button>

              {cvFiles.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {cvFiles.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                      style={{ background: '#1A1A1A' }}
                    >
                      <FileText size={12} style={{ color: '#A50000' }} />
                      <span className="flex-1 truncate" style={{ color: '#A0A0A0' }}>{f.name}</span>
                      <span style={{ color: '#606060' }}>{(f.size / 1024).toFixed(0)}KB</span>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs" style={{ color: '#606060' }}>
                AI will automatically extract: Name, Email, Phone, LinkedIn, Skills, Experience, Education from each CV.
              </p>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setMode('select')}
                  variant="outline"
                  className="flex-1 h-10"
                  style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}
                >
                  Back
                </Button>
                <Button
                  onClick={handleCvUpload}
                  disabled={!cvFiles.length || uploading}
                  className="flex-1 h-10"
                  style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
                >
                  {uploading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Processing {cvFiles.length} CV{cvFiles.length > 1 ? 's' : ''}...
                    </span>
                  ) : (
                    `Upload & Parse ${cvFiles.length > 0 ? `(${cvFiles.length})` : ''}`
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── FROM EXCEL ── */}
          {mode === 'excel' && !results && (
            <motion.div
              key="excel"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-4 mt-2"
            >
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
              />

              {/* Download template */}
              <button
                onClick={handleDownloadTemplate}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors"
                style={{ background: '#0A0A0A', borderColor: '#2E2E2E' }}
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#052E16' }}
                >
                  <Download size={16} style={{ color: '#16A34A' }} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
                    Download Excel Template
                  </p>
                  <p className="text-xs" style={{ color: '#606060' }}>
                    Fill this template and upload it back
                  </p>
                </div>
              </button>

              {/* Upload Excel */}
              <button
                onClick={() => excelInputRef.current?.click()}
                className="w-full h-28 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors"
                style={{ borderColor: excelFile ? '#A50000' : '#2E2E2E', background: '#0A0A0A' }}
              >
                {excelFile ? (
                  <>
                    <CheckCircle2 size={24} style={{ color: '#A50000' }} />
                    <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{excelFile.name}</p>
                    <p className="text-xs" style={{ color: '#606060' }}>Click to change file</p>
                  </>
                ) : (
                  <>
                    <Upload size={24} style={{ color: '#606060' }} />
                    <p className="text-sm" style={{ color: '#A0A0A0' }}>
                      Upload filled Excel file (.xlsx)
                    </p>
                  </>
                )}
              </button>

              <p className="text-xs" style={{ color: '#606060' }}>
                Include CV links (Google Drive/Dropbox) in the template for automatic CV parsing.
              </p>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setMode('select')}
                  variant="outline"
                  className="flex-1 h-10"
                  style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}
                >
                  Back
                </Button>
                <Button
                  onClick={handleExcelUpload}
                  disabled={!excelFile || uploading}
                  className="flex-1 h-10"
                  style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
                >
                  {uploading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Importing...
                    </span>
                  ) : 'Import Candidates'}
                </Button>
              </div>
            </motion.div>
          )}

          {/* ── MANUAL ── */}
          {mode === 'manual' && (
            <motion.div
              key="manual"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <form onSubmit={handleSubmit(onManualSubmit)} className="space-y-4 mt-2">
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
                    onClick={() => setMode('select')}
                    variant="outline"
                    className="flex-1 h-10"
                    style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={createCandidate.isPending}
                    className="flex-1 h-10"
                    style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
                  >
                    {createCandidate.isPending ? <Loader2 size={16} className="animate-spin" /> : 'Add Candidate'}
                  </Button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ── RESULTS ── */}
          {results && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 mt-2"
            >
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total', value: results.summary.total, color: '#A0A0A0' },
                  { label: 'Added', value: results.summary.created, color: '#16A34A' },
                  { label: 'Failed', value: results.summary.failed, color: results.summary.failed > 0 ? '#DC2626' : '#606060' },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="text-center p-3 rounded-xl"
                    style={{ background: '#0A0A0A', border: '1px solid #1A1A1A' }}
                  >
                    <div className="text-2xl font-bold" style={{ color: s.color, fontFamily: 'var(--font-syne)' }}>
                      {s.value}
                    </div>
                    <div className="text-xs mt-1" style={{ color: '#606060' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Result list */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {results.results?.map((r: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                    style={{ background: '#0A0A0A' }}
                  >
                    {r.success ? (
                      <CheckCircle2 size={12} style={{ color: '#16A34A' }} />
                    ) : (
                      <X size={12} style={{ color: '#DC2626' }} />
                    )}
                    <span className="flex-1 truncate" style={{ color: r.success ? '#FFFFFF' : '#606060' }}>
                      {r.name || r.filename}
                    </span>
                    {!r.success && (
                      <span style={{ color: '#DC2626' }}>{r.error}</span>
                    )}
                  </div>
                ))}
              </div>

              <Button
                onClick={handleClose}
                className="w-full h-10"
                style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
              >
                Done
              </Button>
            </motion.div>
          )}

        </AnimatePresence>
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
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null)

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
                      isSelected={selectedCandidate?.id === candidate.id}
                      onSelect={setSelectedCandidate}
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

      {/* Candidate Detail Panel */}
      <AnimatePresence>
        {selectedCandidate && (
          <CandidateDetailPanel
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
            onDelete={() => setSelectedCandidate(null)}
          />
        )}
      </AnimatePresence>

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
