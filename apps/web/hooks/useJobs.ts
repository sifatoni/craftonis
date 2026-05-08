import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { toast } from 'sonner'

export function useJobs(filters?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ['jobs', filters],
    queryFn: () => api.get('/jobs', { params: filters }).then((r) => r.data),
  })
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => api.get(`/jobs/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useCandidates(jobId: string) {
  return useQuery({
    queryKey: ['candidates', jobId],
    queryFn: () => api.get(`/jobs/${jobId}/candidates`).then((r) => r.data),
    enabled: !!jobId,
  })
}

export function usePipelineStats(jobId: string) {
  return useQuery({
    queryKey: ['pipeline-stats', jobId],
    queryFn: () => api.get(`/jobs/${jobId}/pipeline-stats`).then((r) => r.data),
    enabled: !!jobId,
  })
}

export function useCreateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/jobs', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
      toast.success('Job posted successfully!')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create job')
    },
  })
}

export function useUpdateCandidateStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      api.put(`/candidates/${id}/stage`, { stage }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidates'] })
      qc.invalidateQueries({ queryKey: ['pipeline-stats'] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
      toast.success('Stage updated!')
    },
    onError: () => toast.error('Failed to update stage'),
  })
}

export function useDeleteCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/candidates/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidates'] })
      qc.invalidateQueries({ queryKey: ['jobs'] })
      toast.success('Candidate removed')
    },
    onError: () => toast.error('Failed to remove candidate'),
  })
}

export function useCreateCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: any) => api.post('/candidates', data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['candidates'] })
      toast.success('Candidate added!')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to add candidate')
    },
  })
}
