'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Users, TrendingUp, Trophy, XCircle, Percent,
  Briefcase, ChevronDown, Loader2, X, Star,
  GraduationCap, Shield, Mail, Phone, MapPin,
  FileSearch, Calendar, UserX, UserCheck, Eye,
} from 'lucide-react'
import { useJobs } from '@/hooks/useJobs'
import {
  PIPELINE_STAGES, usePipelineCandidates,
  usePipelineColumns, usePipelineStats, useMoveCandidate,
  type PipelineCandidate, type StageKey,
} from '@/hooks/usePipeline'
import { ScheduleInterviewModal } from '@/components/interviews/ScheduleInterviewModal'

// ── Score Badge ──────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const t = score >= 90 ? { bg: '#052E16', c: '#22C55E' }
    : score >= 75 ? { bg: '#0C1A2E', c: '#3B82F6' }
    : score >= 60 ? { bg: '#1C1007', c: '#F59E0B' }
    : { bg: '#1A0000', c: '#EF4444' }
  return <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: t.bg, color: t.c }}>{Math.round(score)}%</span>
}

// ── Stat Card ────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent: string }) {
  return (
    <div className="rounded-xl border p-4 flex items-center gap-3" style={{ background: '#111111', borderColor: '#1A1A1A' }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent}15`, color: accent }}><Icon size={18} /></div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#606060' }}>{label}</p>
        <p className="text-lg font-bold" style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}>{value}</p>
      </div>
    </div>
  )
}

// ── Kanban Card ──────────────────────────────────
function KanbanCard({ c, onView, dragStart }: {
  c: PipelineCandidate
  onView: (c: PipelineCandidate) => void
  dragStart: (e: React.DragEvent, c: PipelineCandidate) => void
}) {
  const parsed = c.cvScore?.parsedData as any
  const score = c.cvScore?.totalScore
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      draggable
      onDragStart={(e: any) => dragStart(e, c)}
      onClick={() => onView(c)}
      className="rounded-lg border p-3 cursor-grab active:cursor-grabbing transition-colors hover:border-[#2E2E2E] group"
      style={{ background: '#0D0D0D', borderColor: '#1A1A1A' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#1A0000', color: '#A50000' }}>
            {c.name?.charAt(0)?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: '#FFFFFF' }}>{c.name}</p>
            {parsed?.currentRole && <p className="text-[11px] truncate" style={{ color: '#606060' }}>{parsed.currentRole}</p>}
          </div>
        </div>
        {score != null && score > 0 && <ScoreBadge score={score} />}
      </div>

      {/* Skills preview */}
      {parsed?.skills?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {parsed.skills.slice(0, 3).map((s: string, i: number) => (
            <span key={i} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#1A1A1A', color: '#606060' }}>{s}</span>
          ))}
          {parsed.skills.length > 3 && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#606060' }}>+{parsed.skills.length - 3}</span>}
        </div>
      )}

      {/* Bottom row */}
      <div className="flex items-center justify-between mt-2 pt-2" style={{ borderTop: '1px solid #1A1A1A' }}>
        <div className="flex items-center gap-2">
          {c.cvUrl && <FileSearch size={11} style={{ color: '#0284C7' }} />}
          {parsed?.experience?.length > 0 && (
            <span className="text-[10px]" style={{ color: '#606060' }}>{parsed.totalYearsExperience || parsed.experience.length} yrs</span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onView(c) }}
          className="text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: '#A50000', background: '#1A0000' }}
        >View</button>
      </div>
    </motion.div>
  )
}

// ── Kanban Column ────────────────────────────────
function KanbanColumn({ stage, cards, onView, dragStart, onDrop }: {
  stage: typeof PIPELINE_STAGES[number]
  cards: PipelineCandidate[]
  onView: (c: PipelineCandidate) => void
  dragStart: (e: React.DragEvent, c: PipelineCandidate) => void
  onDrop: (stageKey: StageKey) => void
}) {
  const [over, setOver] = useState(false)
  return (
    <div
      className="flex-shrink-0 w-[280px] flex flex-col rounded-xl border transition-colors"
      style={{
        background: over ? '#0F0F0F' : '#0A0A0A',
        borderColor: over ? stage.color : '#1A1A1A',
        maxHeight: 'calc(100vh - 280px)',
      }}
      onDragOver={(e) => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(stage.key as StageKey) }}
    >
      {/* Column header */}
      <div className="px-3 py-2.5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: `2px solid ${stage.color}30` }}>
        <div className="flex items-center gap-2">
          <span className="text-sm">{stage.emoji}</span>
          <span className="text-xs font-semibold" style={{ color: '#FFFFFF' }}>{stage.label}</span>
        </div>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${stage.color}20`, color: stage.color }}>{cards.length}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[60px]">
        <AnimatePresence>
          {cards.map((c) => <KanbanCard key={c.id} c={c} onView={onView} dragStart={dragStart} />)}
        </AnimatePresence>
        {cards.length === 0 && (
          <div className="flex items-center justify-center h-20 rounded-lg border border-dashed" style={{ borderColor: '#1A1A1A' }}>
            <p className="text-[10px]" style={{ color: '#404040' }}>Drop here</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Candidate Detail Modal ───────────────────────
function CandidateModal({ c, onClose, onStage, onSchedule }: {
  c: PipelineCandidate
  onClose: () => void
  onStage: (id: string, stage: string) => void
  onSchedule: (c: PipelineCandidate) => void
}) {
  const parsed = c.cvScore?.parsedData as any

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border"
        style={{ background: '#111111', borderColor: '#1A1A1A' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b sticky top-0 z-10" style={{ background: '#111111', borderColor: '#1A1A1A' }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#1A0000', color: '#A50000' }}>
              {c.name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}>{c.name}</h2>
              {parsed?.currentRole && <p className="text-xs" style={{ color: '#A50000' }}>{parsed.currentRole}{parsed?.currentCompany ? ` at ${parsed.currentCompany}` : ''}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5" style={{ color: '#606060' }}><X size={18} /></button>
        </div>

        <div className="p-5 space-y-6">
          {/* Contact */}
          <div className="flex flex-wrap gap-3">
            {c.email && <span className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: '#0A0A0A', color: '#A0A0A0' }}><Mail size={12} />{c.email}</span>}
            {(c.phone || parsed?.phone) && <span className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: '#0A0A0A', color: '#A0A0A0' }}><Phone size={12} />{c.phone || parsed?.phone}</span>}
            {parsed?.location && <span className="text-xs flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: '#0A0A0A', color: '#A0A0A0' }}><MapPin size={12} />{parsed.location}</span>}
          </div>

          {/* AI Score Breakdown */}
          {c.cvScore && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: '#606060' }}>AI Score Breakdown</p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { l: 'Match', v: c.cvScore.skillMatch, c2: '#3B82F6' },
                  { l: 'Stability', v: c.cvScore.stability, c2: '#22C55E' },
                  { l: 'Education', v: c.cvScore.education, c2: '#F59E0B' },
                  { l: 'Final', v: c.cvScore.totalScore, c2: '#A50000' },
                ].map((s) => (
                  <div key={s.l} className="rounded-lg p-3 text-center" style={{ background: '#0A0A0A', border: '1px solid #1A1A1A' }}>
                    <p className="text-[10px] uppercase" style={{ color: '#606060' }}>{s.l}</p>
                    <p className="text-xl font-bold mt-1" style={{ color: s.c2 }}>{Math.round(s.v)}</p>
                    <div className="w-full h-1 rounded-full mt-2" style={{ background: '#1A1A1A' }}>
                      <div className="h-1 rounded-full" style={{ width: `${s.v}%`, background: s.c2 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {parsed?.skills?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#606060' }}>Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {parsed.skills.map((s: string, i: number) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#1A1A1A', color: '#A0A0A0' }}>{s}</span>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          {parsed?.experience?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#606060' }}>Experience</p>
              <div className="space-y-3">
                {parsed.experience.slice(0, 5).map((exp: any, i: number) => (
                  <div key={i} className="pl-3 border-l-2" style={{ borderColor: '#2E2E2E' }}>
                    <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{exp.role}</p>
                    <p className="text-xs" style={{ color: '#A50000' }}>{exp.company}</p>
                    <p className="text-xs" style={{ color: '#606060' }}>{exp.startDate} — {exp.endDate}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {parsed?.education?.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#606060' }}>Education</p>
              <div className="space-y-2">
                {parsed.education.map((edu: any, i: number) => (
                  <div key={i} className="pl-3 border-l-2" style={{ borderColor: '#2E2E2E' }}>
                    <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{edu.degree}</p>
                    {edu.institution && <p className="text-xs" style={{ color: '#A50000' }}>{edu.institution}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2" style={{ borderTop: '1px solid #1A1A1A' }}>
            {c.stage !== 'HIRED' && (
              <button onClick={() => { onStage(c.id, 'HIRED'); onClose() }} className="text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors hover:opacity-80" style={{ background: '#052E16', color: '#22C55E' }}><UserCheck size={13} />Mark Hired</button>
            )}
            {c.stage !== 'REJECTED' && (
              <button onClick={() => { onStage(c.id, 'REJECTED'); onClose() }} className="text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors hover:opacity-80" style={{ background: '#1A0000', color: '#EF4444' }}><UserX size={13} />Reject</button>
            )}
            {c.stage !== 'INTERVIEW' && c.stage !== 'HIRED' && c.stage !== 'REJECTED' && (
              <button onClick={() => { onStage(c.id, 'INTERVIEW'); onSchedule(c); onClose() }} className="text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors hover:opacity-80" style={{ background: '#0C1A2E', color: '#8B5CF6' }}><Calendar size={13} />Schedule Interview</button>
            )}
            <a href="/cv-scoring" className="text-xs px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors hover:opacity-80" style={{ background: '#111', color: '#0284C7', border: '1px solid #1A1A1A' }}><FileSearch size={13} />CV Scoring</a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Main Page ────────────────────────────────────
export default function JobsPipelinePage() {
  const [selectedJobId, setSelectedJobId] = useState('')
  const [selectedCandidate, setSelectedCandidate] = useState<PipelineCandidate | null>(null)
  const [scheduleCandidate, setScheduleCandidate] = useState<PipelineCandidate | null>(null)
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false)
  const draggedRef = useRef<PipelineCandidate | null>(null)

  const { data: jobs, isLoading: jobsLoading } = useJobs()
  const { data: candidates, isLoading: candidatesLoading } = usePipelineCandidates(selectedJobId)
  const columns = usePipelineColumns(candidates)
  const stats = usePipelineStats(candidates)
  const moveCandidate = useMoveCandidate()

  // Auto-select first job
  const jobsList = Array.isArray(jobs) ? jobs : []
  if (!selectedJobId && jobsList.length) setSelectedJobId(jobsList[0].id)
  const selectedJob = jobsList.find((j: any) => j.id === selectedJobId)

  const handleDragStart = useCallback((_e: React.DragEvent, c: PipelineCandidate) => {
    draggedRef.current = c
  }, [])

  const handleDrop = useCallback((targetStage: StageKey) => {
    const c = draggedRef.current
    if (!c || c.stage === targetStage) return
    moveCandidate.mutate({ id: c.id, stage: targetStage })
    if (targetStage === 'INTERVIEW') setScheduleCandidate(c)
    draggedRef.current = null
  }, [moveCandidate])

  const handleStageAction = useCallback((id: string, stage: string) => {
    moveCandidate.mutate({ id, stage })
  }, [moveCandidate])

  return (
    <div className="space-y-5 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}>Pipeline</h1>
          <p className="text-sm mt-0.5" style={{ color: '#606060' }}>Drag candidates across stages</p>
        </div>
        <div className="relative">
          <button
            onClick={() => setJobDropdownOpen(!jobDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm hover:border-[#A50000] transition-colors"
            style={{ background: '#111111', borderColor: '#1A1A1A', color: '#FFFFFF' }}
          >
            <Briefcase size={14} style={{ color: '#A50000' }} />
            {selectedJob?.title || 'Select Job'}
            <ChevronDown size={14} style={{ color: '#606060' }} />
          </button>
          <AnimatePresence>
            {jobDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                className="absolute right-0 top-full mt-2 w-64 rounded-xl border overflow-hidden z-50"
                style={{ background: '#111111', borderColor: '#1A1A1A' }}
              >
                {jobsLoading ? (
                  <div className="p-4 flex justify-center"><Loader2 size={16} className="animate-spin" style={{ color: '#A50000' }} /></div>
                ) : jobsList.length ? (
                  <div className="py-1 max-h-64 overflow-y-auto">
                    {jobsList.map((job: any) => (
                      <button key={job.id} onClick={() => { setSelectedJobId(job.id); setJobDropdownOpen(false) }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                        style={{ color: job.id === selectedJobId ? '#A50000' : '#A0A0A0' }}
                      >
                        {job.title}
                      </button>
                    ))}
                  </div>
                ) : <p className="p-4 text-sm" style={{ color: '#606060' }}>No jobs</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Stats Row */}
      {selectedJobId && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 flex-shrink-0">
          <StatCard icon={Users} label="Total" value={stats.total} accent="#3B82F6" />
          <StatCard icon={TrendingUp} label="Avg Score" value={stats.avgScore > 0 ? `${stats.avgScore}%` : '—'} accent="#22C55E" />
          <StatCard icon={Trophy} label="Hired" value={stats.hired} accent="#A50000" />
          <StatCard icon={XCircle} label="Rejected" value={stats.rejected} accent="#EF4444" />
          <StatCard icon={Percent} label="Conversion" value={`${stats.conversion}%`} accent="#F59E0B" />
        </div>
      )}

      {/* Kanban Board */}
      {!selectedJobId ? (
        <div className="rounded-xl border p-12 text-center flex-1" style={{ background: '#111111', borderColor: '#1A1A1A' }}>
          <Briefcase size={40} className="mx-auto mb-4" style={{ color: '#2E2E2E' }} />
          <p className="text-sm" style={{ color: '#606060' }}>Select a job to view the pipeline</p>
        </div>
      ) : candidatesLoading ? (
        <div className="rounded-xl border p-12 flex justify-center flex-1" style={{ background: '#111111', borderColor: '#1A1A1A' }}>
          <Loader2 size={28} className="animate-spin" style={{ color: '#A50000' }} />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {PIPELINE_STAGES.map((stage) => (
              <KanbanColumn
                key={stage.key}
                stage={stage}
                cards={columns[stage.key] || []}
                onView={setSelectedCandidate}
                dragStart={handleDragStart}
                onDrop={handleDrop}
              />
            ))}
          </div>
        </div>
      )}

      {/* Candidate Detail Modal */}
      <AnimatePresence>
        {selectedCandidate && (
          <CandidateModal
            c={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
            onStage={handleStageAction}
            onSchedule={setScheduleCandidate}
          />
        )}
      </AnimatePresence>

      <ScheduleInterviewModal
        open={!!scheduleCandidate}
        onClose={() => setScheduleCandidate(null)}
        preselectedCandidateId={scheduleCandidate?.id}
        preselectedCandidateName={scheduleCandidate?.name}
        lockCandidate
      />
    </div>
  )
}
