import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { useUpdateCandidateStage } from '@/hooks/useJobs'

export const PIPELINE_STAGES = [
  { key: 'APPLIED',      label: 'Applied',      color: '#606060', emoji: '📋' },
  { key: 'CV_REVIEWED',  label: 'CV Reviewed',  color: '#0284C7', emoji: '📄' },
  { key: 'PHONE_SCREEN', label: 'Phone Screen', color: '#D97706', emoji: '📞' },
  { key: 'INTERVIEW',    label: 'Interview',    color: '#8B5CF6', emoji: '🎤' },
  { key: 'OFFER',        label: 'Offer',        color: '#16A34A', emoji: '💼' },
  { key: 'HIRED',        label: 'Hired',        color: '#A50000', emoji: '🎉' },
  { key: 'REJECTED',     label: 'Rejected',     color: '#374151', emoji: '✖' },
] as const

export type StageKey = typeof PIPELINE_STAGES[number]['key']

export interface PipelineCandidate {
  id: string
  name: string
  email: string
  phone: string | null
  stage: StageKey
  totalScore: number | null
  cvUrl: string | null
  cvScore: {
    skillMatch: number
    stability: number
    education: number
    totalScore: number
    parsedData: any
  } | null
}

export function usePipelineCandidates(jobId: string) {
  return useQuery<PipelineCandidate[]>({
    queryKey: ['candidates', jobId],
    queryFn: () => api.get(`/jobs/${jobId}/candidates`).then((r) => r.data),
    enabled: !!jobId,
  })
}

export function usePipelineColumns(candidates: PipelineCandidate[] | undefined) {
  return useMemo(() => {
    const columns: Record<string, PipelineCandidate[]> = {}
    PIPELINE_STAGES.forEach((s) => { columns[s.key] = [] })
    candidates?.forEach((c) => {
      if (columns[c.stage]) columns[c.stage].push(c)
    })
    return columns
  }, [candidates])
}

export function usePipelineStats(candidates: PipelineCandidate[] | undefined) {
  return useMemo(() => {
    if (!candidates?.length) return { total: 0, avgScore: 0, hired: 0, rejected: 0, conversion: '0' }
    const total = candidates.length
    const scores = candidates.filter(c => c.cvScore?.totalScore).map(c => c.cvScore!.totalScore)
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
    const hired = candidates.filter(c => c.stage === 'HIRED').length
    const rejected = candidates.filter(c => c.stage === 'REJECTED').length
    const conversion = total > 0 ? ((hired / total) * 100).toFixed(1) : '0'
    return { total, avgScore, hired, rejected, conversion }
  }, [candidates])
}

export function useMoveCandidate() {
  return useUpdateCandidateStage()
}
