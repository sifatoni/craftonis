import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/axios'

// ── Types ─────────────────────────────────────────
export interface CvScoreEntry {
  rank: number
  candidateId: string
  name: string
  email: string
  stage: string
  scores: {
    skillMatch: number
    stability: number
    education: number
    totalScore: number
  } | null
}

export interface CandidateScoreCard {
  id: string
  tenantId: string
  jobId: string
  name: string
  email: string
  phone: string | null
  stage: string
  totalScore: number | null
  cvScore: {
    id: string
    skillMatch: number
    stability: number
    education: number
    totalScore: number
    parsedData: any
  } | null
  job: {
    id: string
    title: string
  } | null
}

// ── Hooks ─────────────────────────────────────────
export function useLeaderboard(jobId: string) {
  return useQuery<CvScoreEntry[]>({
    queryKey: ['cv-leaderboard', jobId],
    queryFn: () =>
      api.get(`/cv/leaderboard/${jobId}`).then((r) => r.data),
    enabled: !!jobId,
  })
}

export function useScoreCard(candidateId: string) {
  return useQuery<CandidateScoreCard>({
    queryKey: ['cv-scorecard', candidateId],
    queryFn: () =>
      api.get(`/cv/${candidateId}/scorecard`).then((r) => r.data),
    enabled: !!candidateId,
  })
}

export function useJobsList() {
  return useQuery<any[]>({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs').then((r) => r.data),
  })
}
