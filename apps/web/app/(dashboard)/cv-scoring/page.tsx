'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileSearch, Trophy, TrendingUp, Users, Clock,
  ChevronDown, X, Briefcase, GraduationCap,
  Shield, Star, Loader2, BarChart3,
} from 'lucide-react'
import { useJobsList, useLeaderboard, useScoreCard } from '@/hooks/useCvScoring'

// ── Score Badge ───────────────────────────────────
function ScoreBadge({ score, size = 'sm' }: { score: number; size?: 'sm' | 'lg' }) {
  const tier =
    score >= 90 ? { label: 'Excellent', bg: '#052E16', color: '#22C55E' } :
    score >= 75 ? { label: 'Strong', bg: '#0C1A2E', color: '#3B82F6' } :
    score >= 60 ? { label: 'Moderate', bg: '#1C1007', color: '#F59E0B' } :
                  { label: 'Weak', bg: '#1A0000', color: '#EF4444' }
  const cls = size === 'lg' ? 'text-sm px-3 py-1.5 font-bold' : 'text-xs px-2 py-0.5 font-semibold'
  return (
    <span className={`${cls} rounded-lg inline-flex items-center gap-1.5`} style={{ background: tier.bg, color: tier.color }}>
      {Math.round(score)}
      {size === 'lg' && <span className="text-xs font-normal opacity-70">({tier.label})</span>}
    </span>
  )
}

// ── Stat Card ─────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string | number; accent: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border p-5 flex items-start gap-4"
      style={{ background: '#111111', borderColor: '#1A1A1A' }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent}15`, color: accent }}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#606060' }}>{label}</p>
        <p className="text-xl font-bold mt-0.5" style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}>{value}</p>
      </div>
    </motion.div>
  )
}

// ── Candidate Detail Drawer ───────────────────────
function CandidateDrawer({ candidateId, onClose }: { candidateId: string; onClose: () => void }) {
  const { data: card, isLoading } = useScoreCard(candidateId)
  const parsed = card?.cvScore?.parsedData as any

  if (isLoading) return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      className="w-96 flex-shrink-0 rounded-xl border flex items-center justify-center"
      style={{ background: '#111111', borderColor: '#1A1A1A', minHeight: 400 }}
    >
      <Loader2 size={24} className="animate-spin" style={{ color: '#A50000' }} />
    </motion.div>
  )

  if (!card) return null

  const sections = [
    { key: 'scores', label: 'AI Scores', icon: BarChart3 },
    { key: 'skills', label: 'Skills', icon: Star },
    { key: 'experience', label: 'Experience', icon: Briefcase },
    { key: 'education', label: 'Education', icon: GraduationCap },
    { key: 'personal', label: 'Personal Info', icon: Users },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      className="w-96 flex-shrink-0 rounded-xl border overflow-y-auto"
      style={{ background: '#111111', borderColor: '#1A1A1A', maxHeight: 'calc(100vh - 160px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b sticky top-0 z-10" style={{ background: '#111111', borderColor: '#1A1A1A' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#1A0000', color: '#A50000' }}>
            {card.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}>{card.name}</h3>
            <p className="text-xs" style={{ color: '#606060' }}>{card.email}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5" style={{ color: '#606060' }}><X size={16} /></button>
      </div>

      <div className="p-4 space-y-5">
        {/* Score Overview */}
        {card.cvScore && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>AI Scores</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Skill Match', value: card.cvScore.skillMatch, color: '#3B82F6' },
                { label: 'Stability', value: card.cvScore.stability, color: '#22C55E' },
                { label: 'Education', value: card.cvScore.education, color: '#F59E0B' },
                { label: 'Final Score', value: card.cvScore.totalScore, color: '#A50000' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg p-3" style={{ background: '#0A0A0A', border: '1px solid #1A1A1A' }}>
                  <p className="text-xs" style={{ color: '#606060' }}>{s.label}</p>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-lg font-bold" style={{ color: s.color }}>{Math.round(s.value)}</span>
                    <span className="text-xs" style={{ color: '#606060' }}>/100</span>
                  </div>
                  <div className="w-full h-1 rounded-full mt-2" style={{ background: '#1A1A1A' }}>
                    <div className="h-1 rounded-full transition-all" style={{ width: `${s.value}%`, background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {parsed?.skills?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {parsed.skills.slice(0, 20).map((s: string, i: number) => (
                <span key={i} className="text-xs px-2 py-1 rounded-lg" style={{ background: '#1A1A1A', color: '#A0A0A0' }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        {/* Experience */}
        {parsed?.experience?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>
              Experience {parsed.totalYearsExperience > 0 ? `(${parsed.totalYearsExperience} yrs)` : ''}
            </p>
            <div className="space-y-3">
              {parsed.experience.map((exp: any, i: number) => (
                <div key={i} className="pl-3 border-l-2" style={{ borderColor: '#2E2E2E' }}>
                  <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{exp.role}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#A50000' }}>{exp.company}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#606060' }}>{exp.startDate} — {exp.endDate}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education */}
        {parsed?.education?.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>Education</p>
            <div className="space-y-2">
              {parsed.education.map((edu: any, i: number) => (
                <div key={i} className="pl-3 border-l-2" style={{ borderColor: '#2E2E2E' }}>
                  <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{edu.degree}</p>
                  {edu.institution && <p className="text-xs mt-0.5" style={{ color: '#A50000' }}>{edu.institution}</p>}
                  {edu.year > 0 && <p className="text-xs mt-0.5" style={{ color: '#606060' }}>{edu.year}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal Info */}
        {parsed?.personalDetails && Object.values(parsed.personalDetails).some((v: any) => v && v !== 'null') && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>Personal Info</p>
            <div className="space-y-1.5">
              {[
                { label: 'Date of Birth', value: parsed.personalDetails?.dateOfBirth },
                { label: 'Gender', value: parsed.personalDetails?.gender },
                { label: 'Nationality', value: parsed.personalDetails?.nationality },
                { label: 'Marital Status', value: parsed.personalDetails?.maritalStatus },
              ].filter(item => item.value && item.value !== 'null').map((item, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span className="text-xs" style={{ color: '#606060' }}>{item.label}</span>
                  <span className="text-xs text-right" style={{ color: '#A0A0A0' }}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Page ─────────────────────────────────────
export default function CvScoringPage() {
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<string>('totalScore')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false)

  const { data: jobs, isLoading: jobsLoading } = useJobsList()
  const { data: leaderboard, isLoading: lbLoading } = useLeaderboard(selectedJobId)

  // Auto-select first job
  if (!selectedJobId && jobs?.length) {
    const firstJob = Array.isArray(jobs) ? jobs[0] : null
    if (firstJob?.id) setSelectedJobId(firstJob.id)
  }

  const selectedJob = jobs?.find((j: any) => j.id === selectedJobId)

  // Sorted leaderboard
  const sorted = useMemo(() => {
    if (!leaderboard) return []
    return [...leaderboard].sort((a, b) => {
      const aVal = sortField === 'name' ? a.name : (a.scores as any)?.[sortField] ?? 0
      const bVal = sortField === 'name' ? b.name : (b.scores as any)?.[sortField] ?? 0
      if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal)
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [leaderboard, sortField, sortDir])

  // Stats
  const stats = useMemo(() => {
    if (!leaderboard?.length) return { total: 0, avgScore: 0, topName: '—', pending: 0 }
    const scores = leaderboard.filter(c => c.scores?.totalScore).map(c => c.scores!.totalScore)
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const top = leaderboard.reduce((best, c) => (c.scores?.totalScore ?? 0) > (best.scores?.totalScore ?? 0) ? c : best, leaderboard[0])
    const pending = leaderboard.filter(c => !c.scores?.totalScore).length
    return { total: leaderboard.length, avgScore: Math.round(avg), topName: top?.name ?? '—', pending }
  }, [leaderboard])

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const SortIcon = ({ field }: { field: string }) => (
    <ChevronDown size={12} className={`transition-transform ${sortField === field ? 'opacity-100' : 'opacity-30'} ${sortField === field && sortDir === 'asc' ? 'rotate-180' : ''}`} />
  )

  return (
    <div className="flex gap-6 h-full">
      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}>CV Scoring</h1>
            <p className="text-sm mt-1" style={{ color: '#606060' }}>AI-powered candidate evaluation</p>
          </div>
          {/* Job Selector */}
          <div className="relative">
            <button
              onClick={() => setJobDropdownOpen(!jobDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-colors hover:border-[#A50000]"
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
                  ) : jobs?.length ? (
                    <div className="py-1 max-h-64 overflow-y-auto">
                      {jobs.map((job: any) => (
                        <button
                          key={job.id}
                          onClick={() => { setSelectedJobId(job.id); setJobDropdownOpen(false); setSelectedCandidateId(null) }}
                          className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5"
                          style={{ color: job.id === selectedJobId ? '#A50000' : '#A0A0A0' }}
                        >
                          {job.title}
                          <span className="text-xs ml-2" style={{ color: '#606060' }}>{job.candidateCount ?? 0} candidates</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="p-4 text-sm" style={{ color: '#606060' }}>No jobs found</p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Stats */}
        {selectedJobId && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={FileSearch} label="Total Parsed CVs" value={stats.total} accent="#3B82F6" />
            <StatCard icon={TrendingUp} label="Avg Match Score" value={stats.avgScore > 0 ? `${stats.avgScore}%` : '—'} accent="#22C55E" />
            <StatCard icon={Trophy} label="Top Candidate" value={stats.topName} accent="#F59E0B" />
            <StatCard icon={Clock} label="Pending Reviews" value={stats.pending} accent="#A50000" />
          </div>
        )}

        {/* Leaderboard Table */}
        {!selectedJobId ? (
          <div className="rounded-xl border p-12 text-center" style={{ background: '#111111', borderColor: '#1A1A1A' }}>
            <Briefcase size={40} className="mx-auto mb-4" style={{ color: '#2E2E2E' }} />
            <p className="text-sm" style={{ color: '#606060' }}>Select a job to view the candidate leaderboard</p>
          </div>
        ) : lbLoading ? (
          <div className="rounded-xl border p-12 flex justify-center" style={{ background: '#111111', borderColor: '#1A1A1A' }}>
            <Loader2 size={28} className="animate-spin" style={{ color: '#A50000' }} />
          </div>
        ) : !sorted.length ? (
          <div className="rounded-xl border p-12 text-center" style={{ background: '#111111', borderColor: '#1A1A1A' }}>
            <Users size={40} className="mx-auto mb-4" style={{ color: '#2E2E2E' }} />
            <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>No scored candidates yet</p>
            <p className="text-xs mt-1" style={{ color: '#606060' }}>Upload and score CVs from the Jobs pipeline to see results here.</p>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl border overflow-hidden"
            style={{ background: '#111111', borderColor: '#1A1A1A' }}
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid #1A1A1A' }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none" style={{ color: '#606060' }} onClick={() => handleSort('name')}>
                      <span className="inline-flex items-center gap-1">Candidate <SortIcon field="name" /></span>
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>Stage</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none" style={{ color: '#606060' }} onClick={() => handleSort('skillMatch')}>
                      <span className="inline-flex items-center gap-1">Match <SortIcon field="skillMatch" /></span>
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none" style={{ color: '#606060' }} onClick={() => handleSort('education')}>
                      <span className="inline-flex items-center gap-1">Education <SortIcon field="education" /></span>
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none" style={{ color: '#606060' }} onClick={() => handleSort('stability')}>
                      <span className="inline-flex items-center gap-1">Stability <SortIcon field="stability" /></span>
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none" style={{ color: '#606060' }} onClick={() => handleSort('totalScore')}>
                      <span className="inline-flex items-center gap-1">Final <SortIcon field="totalScore" /></span>
                    </th>
                    <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wide" style={{ color: '#606060' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((entry, idx) => {
                    const isSelected = selectedCandidateId === entry.candidateId
                    const stageMap: Record<string, { label: string; color: string }> = {
                      APPLIED: { label: 'Applied', color: '#606060' },
                      CV_REVIEWED: { label: 'CV Reviewed', color: '#0284C7' },
                      PHONE_SCREEN: { label: 'Phone Screen', color: '#D97706' },
                      INTERVIEW: { label: 'Interview', color: '#5521B5' },
                      OFFER: { label: 'Offer', color: '#16A34A' },
                      HIRED: { label: 'Hired', color: '#A50000' },
                      REJECTED: { label: 'Rejected', color: '#374151' },
                    }
                    const stage = stageMap[entry.stage] || stageMap.APPLIED

                    return (
                      <motion.tr
                        key={entry.candidateId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        className="transition-colors cursor-pointer"
                        style={{
                          borderBottom: '1px solid #1A1A1A',
                          background: isSelected ? '#1A0000' : 'transparent',
                        }}
                        onClick={() => setSelectedCandidateId(isSelected ? null : entry.candidateId)}
                        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#0D0D0D' }}
                        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                      >
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold" style={{ color: idx < 3 ? '#F59E0B' : '#606060' }}>
                            {idx < 3 ? ['🥇', '🥈', '🥉'][idx] : idx + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: '#1A1A1A', color: '#A50000' }}>
                              {entry.name?.charAt(0)?.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#FFFFFF' }}>{entry.name}</p>
                              <p className="text-xs" style={{ color: '#606060' }}>{entry.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${stage.color}15`, color: stage.color }}>
                            {stage.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">{entry.scores ? <ScoreBadge score={entry.scores.skillMatch} /> : <span className="text-xs" style={{ color: '#606060' }}>—</span>}</td>
                        <td className="px-4 py-3 text-center">{entry.scores ? <ScoreBadge score={entry.scores.education} /> : <span className="text-xs" style={{ color: '#606060' }}>—</span>}</td>
                        <td className="px-4 py-3 text-center">{entry.scores ? <ScoreBadge score={entry.scores.stability} /> : <span className="text-xs" style={{ color: '#606060' }}>—</span>}</td>
                        <td className="px-4 py-3 text-center">{entry.scores ? <ScoreBadge score={entry.scores.totalScore} size="lg" /> : <span className="text-xs" style={{ color: '#606060' }}>—</span>}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedCandidateId(entry.candidateId) }}
                            className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/5"
                            style={{ color: '#A50000', border: '1px solid #A5000030' }}
                          >
                            View
                          </button>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {selectedCandidateId && (
          <CandidateDrawer
            candidateId={selectedCandidateId}
            onClose={() => setSelectedCandidateId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
