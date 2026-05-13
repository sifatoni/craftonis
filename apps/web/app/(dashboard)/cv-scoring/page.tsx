'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileSearch, Trophy, TrendingUp, Users, Clock,
  ChevronDown, X, Briefcase, GraduationCap,
  Shield, Star, Loader2, BarChart3, AlertCircle,
  CheckCircle2, MapPin, Mail, Phone, Award, Calendar
} from 'lucide-react'
import { useJobsList, useLeaderboard, useScoreCard } from '@/hooks/useCvScoring'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { ScheduleInterviewModal } from '@/components/interviews/ScheduleInterviewModal'

// ── Score Badge (Reusable & Semantic) ───────────────────────────────────
function ScoreBadge({ score, size = 'sm' }: { score: number | null | undefined; size?: 'sm' | 'lg' }) {
  if (typeof score !== 'number') return <span className="text-muted-foreground text-xs">—</span>

  let tier = { label: 'Weak', bg: 'bg-red-500/10 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400' }
  if (score >= 90) tier = { label: 'Excellent', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400' }
  else if (score >= 75) tier = { label: 'Strong', bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400' }
  else if (score >= 60) tier = { label: 'Moderate', bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400' }

  const cls = size === 'lg' ? 'text-sm px-3 py-1.5' : 'text-xs px-2 py-0.5'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md font-medium ${tier.bg} ${tier.text} ${cls}`}>
      {Math.round(score)}
      {size === 'lg' && <span className="text-xs font-normal opacity-80 ml-1">({tier.label})</span>}
    </span>
  )
}

// ── Stat Card ─────────────────────────────────────
function StatCard({ icon: Icon, label, value, subtext, isLoading }: { icon: any; label: string; value: React.ReactNode; subtext?: string; isLoading?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground truncate">{label}</p>
          <div className="mt-1 flex items-baseline gap-2">
            {isLoading ? (
              <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
            ) : (
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">{value}</h3>
            )}
          </div>
          {subtext && !isLoading && <p className="mt-1 text-xs text-muted-foreground truncate">{subtext}</p>}
        </div>
      </div>
    </div>
  )
}

// ── Candidate Detail Drawer ───────────────────────
function CandidateDrawer({ candidateId, onClose }: { candidateId: string; onClose: () => void }) {
  const { data: card, isLoading } = useScoreCard(candidateId)
  const parsed = card?.cvScore?.parsedData as any

  // Guard loading state
  if (isLoading) return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="w-96 shrink-0 rounded-xl border bg-card shadow-lg flex items-center justify-center h-[calc(100vh-160px)] sticky top-6"
    >
      <Loader2 size={24} className="animate-spin text-primary" />
    </motion.div>
  )

  // Guard empty state
  if (!card) return null

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="w-96 shrink-0 rounded-xl border bg-card shadow-lg overflow-hidden flex flex-col h-[calc(100vh-160px)] sticky top-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b bg-muted/30">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
            {card.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground truncate">{card.name || 'Unknown Candidate'}</h3>
            {card.email && <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate"><Mail size={12} /> {card.email}</p>}
            {card.phone && <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5 truncate"><Phone size={12} /> {card.phone}</p>}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Close details"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-8">
        {/* AI Match Insights */}
        {card.cvScore && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-primary" />
              <h4 className="text-sm font-semibold tracking-wide text-foreground">AI Match Insights</h4>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Skill Match', value: card.cvScore.skillMatch, color: 'bg-blue-500' },
                { label: 'Stability', value: card.cvScore.stability, color: 'bg-emerald-500' },
                { label: 'Education', value: card.cvScore.education, color: 'bg-amber-500' },
                { label: 'Final Score', value: card.cvScore.totalScore, color: 'bg-primary' },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border bg-background p-3 shadow-sm">
                  <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                  <div className="mt-1.5 flex items-end gap-1">
                    <span className="text-xl font-bold text-foreground leading-none">{Math.round(s.value || 0)}</span>
                    <span className="text-xs text-muted-foreground mb-0.5">/100</span>
                  </div>
                  <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className={`h-full rounded-full ${s.color} transition-all duration-500 ease-out`} style={{ width: `${s.value || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Skills */}
        {parsed?.skills?.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Star size={16} className="text-amber-500" />
              <h4 className="text-sm font-semibold tracking-wide text-foreground">Top Skills</h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {parsed.skills.slice(0, 15).map((s: string, i: number) => (
                <span key={i} className="inline-flex items-center rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground border">
                  {s}
                </span>
              ))}
              {parsed.skills.length > 15 && (
                <span className="inline-flex items-center rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  +{parsed.skills.length - 15} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Experience Timeline */}
        {parsed?.experience?.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Briefcase size={16} className="text-blue-500" />
              <h4 className="text-sm font-semibold tracking-wide text-foreground">
                Experience {parsed.totalYearsExperience > 0 ? `· ${parsed.totalYearsExperience} yrs` : ''}
              </h4>
            </div>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[9px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {parsed.experience.map((exp: any, i: number) => (
                <div key={i} className="relative flex items-start justify-between gap-4">
                  <div className="absolute left-0 mt-1.5 h-2 w-2 rounded-full bg-border ring-4 ring-card" />
                  <div className="ml-6 min-w-0 flex-1">
                    <h5 className="text-sm font-medium text-foreground">{exp.role || 'Role unspecified'}</h5>
                    <p className="mt-0.5 text-xs text-primary font-medium">{exp.company || 'Company unspecified'}</p>
                    <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock size={12} />
                      {exp.startDate || '?'} — {exp.endDate || 'Present'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Education Timeline */}
        {parsed?.education?.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <GraduationCap size={16} className="text-emerald-500" />
              <h4 className="text-sm font-semibold tracking-wide text-foreground">Education</h4>
            </div>
            <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[9px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
              {parsed.education.map((edu: any, i: number) => (
                <div key={i} className="relative flex items-start justify-between gap-4">
                  <div className="absolute left-0 mt-1.5 h-2 w-2 rounded-full bg-border ring-4 ring-card" />
                  <div className="ml-6 min-w-0 flex-1">
                    <h5 className="text-sm font-medium text-foreground">{edu.degree || 'Degree unspecified'}</h5>
                    {edu.institution && <p className="mt-0.5 text-xs text-emerald-600 dark:text-emerald-500 font-medium">{edu.institution}</p>}
                    {edu.year > 0 && <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1.5"><Clock size={12} /> {edu.year}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Score Distribution Chart ──────────────────────
function ScoreDistribution({ leaderboard }: { leaderboard: any[] }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const data = useMemo(() => {
    if (!leaderboard) return []
    const bins = [
      { name: '0-50', count: 0 },
      { name: '50-60', count: 0 },
      { name: '60-70', count: 0 },
      { name: '70-80', count: 0 },
      { name: '80-90', count: 0 },
      { name: '90-100', count: 0 },
    ]
    leaderboard.forEach(c => {
      const s = c.scores?.totalScore ?? 0
      if (s === 0) return // skip unscored
      if (s < 50) bins[0].count++
      else if (s < 60) bins[1].count++
      else if (s < 70) bins[2].count++
      else if (s < 80) bins[3].count++
      else if (s < 90) bins[4].count++
      else bins[5].count++
    })
    return bins
  }, [leaderboard])

  if (!mounted) return <div className="h-24 w-full animate-pulse bg-muted rounded-md" />

  const maxCount = Math.max(...data.map(d => d.count))
  if (maxCount === 0) return (
    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
      Not enough data for chart
    </div>
  )

  return (
    <div className="h-24 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <Tooltip
            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
            contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.count > 0 ? (index >= 4 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))') : 'transparent'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────
export default function CvScoringPage() {
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<string>('totalScore')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [jobDropdownOpen, setJobDropdownOpen] = useState(false)
  const [scheduleCandidate, setScheduleCandidate] = useState<{ id: string; name: string } | null>(null)

  const { data: jobs, isLoading: jobsLoading } = useJobsList()
  const { data: leaderboard, isLoading: lbLoading } = useLeaderboard(selectedJobId)

  // Auto-select first job
  useEffect(() => {
    if (!selectedJobId && jobs?.length) {
      const firstJob = Array.isArray(jobs) ? jobs[0] : null
      if (firstJob?.id) setSelectedJobId(firstJob.id)
    }
  }, [jobs, selectedJobId])

  const selectedJob = useMemo(() => jobs?.find((j: any) => j.id === selectedJobId), [jobs, selectedJobId])

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
    if (!leaderboard?.length) return { total: 0, avgScore: 0, topName: '—', pending: 0, topScore: 0 }
    const scored = leaderboard.filter(c => c.scores?.totalScore)
    const scores = scored.map(c => c.scores!.totalScore)
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    const top = scored.reduce((best, c) => (c.scores?.totalScore ?? 0) > (best.scores?.totalScore ?? 0) ? c : best, scored[0])
    const pending = leaderboard.filter(c => !c.scores?.totalScore).length
    return { 
      total: leaderboard.length, 
      avgScore: Math.round(avg), 
      topName: top?.name ?? '—', 
      topScore: top?.scores?.totalScore ?? 0,
      pending 
    }
  }, [leaderboard])

  const handleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const SortIcon = ({ field }: { field: string }) => (
    <ChevronDown 
      size={14} 
      className={`transition-transform duration-200 ${sortField === field ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'} ${sortField === field && sortDir === 'asc' ? 'rotate-180' : ''}`} 
    />
  )

  // Skeletons for table
  const renderTableSkeleton = () => (
    Array.from({ length: 5 }).map((_, i) => (
      <tr key={i} className="border-b bg-card">
        <td className="px-6 py-4"><div className="h-4 w-4 rounded bg-muted animate-pulse" /></td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="h-3 w-24 rounded bg-muted/50 animate-pulse" />
            </div>
          </div>
        </td>
        <td className="px-6 py-4"><div className="h-6 w-20 rounded-full bg-muted animate-pulse" /></td>
        <td className="px-6 py-4"><div className="h-6 w-12 rounded-md bg-muted animate-pulse mx-auto" /></td>
        <td className="px-6 py-4"><div className="h-6 w-12 rounded-md bg-muted animate-pulse mx-auto" /></td>
        <td className="px-6 py-4"><div className="h-6 w-12 rounded-md bg-muted animate-pulse mx-auto" /></td>
        <td className="px-6 py-4"><div className="h-8 w-16 rounded-md bg-muted animate-pulse mx-auto" /></td>
        <td className="px-6 py-4 text-right"><div className="h-8 w-16 rounded-md bg-muted animate-pulse ml-auto" /></td>
      </tr>
    ))
  )

  return (
    <div className="flex h-full w-full max-w-full overflow-hidden">
      {/* Main Content Area */}
      <div className="flex-1 min-w-0 overflow-y-auto pr-2 pb-10 space-y-8">
        
        {/* Header & Job Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-background pt-2 sticky top-0 z-20 pb-4 border-b">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">AI CV Scoring</h1>
            <p className="text-sm text-muted-foreground mt-1">Intelligent candidate evaluation & matching</p>
          </div>
          
          <div className="relative">
            <button
              onClick={() => setJobDropdownOpen(!jobDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-card text-sm font-medium transition-all hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary shadow-sm"
            >
              <Briefcase size={16} className="text-primary" />
              <span className="truncate max-w-[200px]">{selectedJob?.title || 'Select Position'}</span>
              <ChevronDown size={16} className="text-muted-foreground ml-2" />
            </button>
            <AnimatePresence>
              {jobDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setJobDropdownOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }} 
                    animate={{ opacity: 1, y: 0, scale: 1 }} 
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-72 rounded-xl border bg-popover shadow-xl overflow-hidden z-50 origin-top-right"
                  >
                    {jobsLoading ? (
                      <div className="p-8 flex justify-center"><Loader2 size={20} className="animate-spin text-primary" /></div>
                    ) : jobs?.length ? (
                      <div className="py-2 max-h-80 overflow-y-auto">
                        <div className="px-3 pb-2 mb-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Active Positions
                        </div>
                        {jobs.map((job: any) => (
                          <button
                            key={job.id}
                            onClick={() => { setSelectedJobId(job.id); setJobDropdownOpen(false); setSelectedCandidateId(null) }}
                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-accent flex items-center justify-between ${job.id === selectedJobId ? 'bg-primary/5 text-primary font-medium' : 'text-foreground'}`}
                          >
                            <span className="truncate pr-4">{job.title}</span>
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground shrink-0">{job.candidateCount ?? 0}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <Briefcase size={24} className="mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-foreground">No jobs found</p>
                      </div>
                    )}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Hero Analytics Row */}
        {selectedJobId && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard 
              isLoading={lbLoading}
              icon={Users} 
              label="Total Pipeline" 
              value={stats.total} 
              subtext="Candidates in current job" 
            />
            <StatCard 
              isLoading={lbLoading}
              icon={TrendingUp} 
              label="Avg Match Score" 
              value={stats.avgScore > 0 ? `${stats.avgScore}%` : '—'} 
              subtext="Overall AI confidence" 
            />
            
            {/* Spotlight Card */}
            <div className="lg:col-span-2 rounded-xl border bg-card p-5 shadow-sm flex flex-col sm:flex-row items-center sm:justify-between gap-4 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
              <div className="relative z-10 flex items-center gap-4 w-full">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                  <Award size={24} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Top Candidate Match</p>
                  <h3 className="text-lg font-semibold text-foreground truncate mt-0.5">
                    {stats.topName !== '—' ? stats.topName : 'No candidates scored'}
                  </h3>
                  {stats.topScore > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                      <ScoreBadge score={stats.topScore} />
                      <span className="text-xs text-muted-foreground">Highly recommended for this role</span>
                    </div>
                  )}
                </div>
                <div className="hidden sm:block shrink-0 w-32 border-l pl-4">
                  <p className="text-[10px] uppercase text-muted-foreground mb-1 font-semibold tracking-wider">Score Dist</p>
                  <ScoreDistribution leaderboard={leaderboard || []} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Table Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Candidate Leaderboard</h2>
            {sorted.length > 0 && (
              <span className="text-sm text-muted-foreground bg-muted px-2.5 py-1 rounded-md font-medium">
                Showing {sorted.length} records
              </span>
            )}
          </div>

          {!selectedJobId ? (
            <div className="rounded-xl border border-dashed p-16 text-center bg-card shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <FileSearch size={28} className="text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">Select a job position</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Choose a position from the dropdown above to view AI-scored candidates and match insights.</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card shadow-sm overflow-hidden flex flex-col relative max-w-full">
              <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-sm text-left min-w-[900px]">
                  <thead className="bg-muted/50 text-muted-foreground sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider w-16">Rank</th>
                      <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider cursor-pointer group hover:text-foreground transition-colors" onClick={() => handleSort('name')}>
                        <span className="flex items-center gap-2">Candidate <SortIcon field="name" /></span>
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider">Stage</th>
                      <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider cursor-pointer group hover:text-foreground transition-colors text-center" onClick={() => handleSort('skillMatch')}>
                        <span className="flex items-center justify-center gap-2">Skill Match <SortIcon field="skillMatch" /></span>
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider cursor-pointer group hover:text-foreground transition-colors text-center" onClick={() => handleSort('education')}>
                        <span className="flex items-center justify-center gap-2">Education <SortIcon field="education" /></span>
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider cursor-pointer group hover:text-foreground transition-colors text-center" onClick={() => handleSort('stability')}>
                        <span className="flex items-center justify-center gap-2">Stability <SortIcon field="stability" /></span>
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider cursor-pointer group hover:text-foreground transition-colors text-center" onClick={() => handleSort('totalScore')}>
                        <span className="flex items-center justify-center gap-2">Final Score <SortIcon field="totalScore" /></span>
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs uppercase tracking-wider text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {lbLoading ? (
                      renderTableSkeleton()
                    ) : !sorted.length ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-16 text-center">
                          <Users size={32} className="mx-auto text-muted-foreground mb-3 opacity-50" />
                          <p className="text-sm font-medium text-foreground">No candidates scored yet</p>
                          <p className="text-xs text-muted-foreground mt-1">Process CVs in the jobs pipeline to generate AI scores.</p>
                        </td>
                      </tr>
                    ) : (
                      sorted.map((entry, idx) => {
                        const isSelected = selectedCandidateId === entry.candidateId
                        const stageMap: Record<string, { label: string; bg: string; text: string }> = {
                          APPLIED: { label: 'Applied', bg: 'bg-slate-500/10 dark:bg-slate-500/20', text: 'text-slate-700 dark:text-slate-400' },
                          CV_REVIEWED: { label: 'Reviewed', bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-400' },
                          PHONE_SCREEN: { label: 'Screening', bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-400' },
                          INTERVIEW: { label: 'Interview', bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-400' },
                          OFFER: { label: 'Offer', bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-400' },
                          HIRED: { label: 'Hired', bg: 'bg-primary/10 dark:bg-primary/20', text: 'text-primary' },
                          REJECTED: { label: 'Rejected', bg: 'bg-red-500/10 dark:bg-red-500/20', text: 'text-red-700 dark:text-red-400' },
                        }
                        const stage = stageMap[entry.stage] || stageMap.APPLIED

                        return (
                          <motion.tr
                            key={entry.candidateId}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.2) }}
                            className={`group cursor-pointer transition-colors hover:bg-muted/50 ${isSelected ? 'bg-primary/5 hover:bg-primary/5' : ''}`}
                            onClick={() => setSelectedCandidateId(isSelected ? null : entry.candidateId)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx < 3 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'text-muted-foreground bg-muted'}`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3 min-w-[200px]">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground font-semibold">
                                  {entry.name?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground truncate max-w-[180px]">{entry.name || 'Unnamed'}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">{entry.email || 'No email'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${stage.bg} ${stage.text}`}>
                                {stage.label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              {entry.scores ? <ScoreBadge score={entry.scores.skillMatch} /> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              {entry.scores ? <ScoreBadge score={entry.scores.education} /> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              {entry.scores ? <ScoreBadge score={entry.scores.stability} /> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              {entry.scores ? <ScoreBadge score={entry.scores.totalScore} size="lg" /> : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedCandidateId(entry.candidateId) }}
                                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                                >
                                  View
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setScheduleCandidate({ id: entry.candidateId, name: entry.name || 'Unnamed' })
                                  }}
                                  className="inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2"
                                >
                                  <Calendar size={14} />
                                  Set Interview
                                </button>
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Drawer Sidebar */}
      <AnimatePresence>
        {selectedCandidateId && (
          <div className="hidden lg:block w-96 shrink-0 pl-6 h-full relative z-30 border-l border-border/50">
            <CandidateDrawer
              candidateId={selectedCandidateId}
              onClose={() => setSelectedCandidateId(null)}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer (Overlay) */}
      <AnimatePresence>
        {selectedCandidateId && (
          <div className="lg:hidden">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
              onClick={() => setSelectedCandidateId(null)}
            />
            <motion.div
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.25, ease: "easeOut" }}
              className="fixed inset-y-0 right-0 w-full sm:w-96 bg-background shadow-2xl z-50 overflow-y-auto border-l flex flex-col"
            >
              <div className="flex-1 p-4">
                <CandidateDrawer
                  candidateId={selectedCandidateId}
                  onClose={() => setSelectedCandidateId(null)}
                />
              </div>
            </motion.div>
          </div>
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
