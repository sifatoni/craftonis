'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/axios'
import { ArrowLeft, Bookmark, Bot, Calendar, FileText, Loader2, Clock, Briefcase, User, CheckCircle2, List, Play, Download, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function MeetingMinutesPage() {
  const params = useParams()
  const router = useRouter()
  const qc = useQueryClient()
  const meetingId = params.meetingId as string
  const [isGenerating, setIsGenerating] = useState(false)

  // Fetch all meetings (usually cached from ledger) to find the meeting metadata
  const { data: meetings = [], isLoading: meetingsLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => api.get('/meetings').then(r => r.data),
  })

  // Fetch generated minutes
  const { data: minutes, isLoading: minutesLoading, refetch: refetchMinutes } = useQuery({
    queryKey: ['minutes', meetingId],
    queryFn: () => api.get(`/meetings/${meetingId}/minutes`).then(r => r.data),
    enabled: !!meetingId
  })

  const generateMutation = useMutation({
    mutationFn: () => api.post(`/meetings/${meetingId}/generate-minutes`),
    onSuccess: () => {
      refetchMinutes()
      toast.success('Minutes generated successfully!')
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to generate minutes')
    },
    onSettled: () => setIsGenerating(false)
  })

  const handleGenerate = () => {
    if (minutes && !window.confirm("Regenerate minutes? This will overwrite existing minutes.")) {
      return
    }
    setIsGenerating(true)
    generateMutation.mutate()
  }

  const downloadPDF = () => {
    const printContent = document.getElementById('minutes-content');
    if (!printContent) return;
    
    const originalBody = document.body.innerHTML;
    
    // Create a printable version of the content
    document.body.innerHTML = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 40px; color: #000; background: #fff; }
        h1 { font-size: 24px; margin-bottom: 8px; border-bottom: 2px solid #A50000; padding-bottom: 8px; }
        h2 { font-size: 18px; margin-top: 24px; color: #A50000; border-bottom: 1px solid #eee; padding-bottom: 4px; }
        h3 { font-size: 16px; margin-top: 20px; font-weight: bold; margin-bottom: 10px; }
        p, li { font-size: 14px; line-height: 1.6; color: #333; margin-bottom: 8px; }
        ul { padding-left: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 12px; }
        th, td { border: 1px solid #eee; padding: 10px; text-align: left; font-size: 13px; }
        th { background: #f9f9f9; font-weight: bold; }
        .meta { font-size: 12px; color: #666; margin-bottom: 20px; }
        @media print {
          button { display: none !important; }
          .no-print { display: none !important; }
        }
      </style>
      <div>
        <h1>Meeting Minutes: ${meeting?.title || 'Untitled Meeting'}</h1>
        <div class="meta">
          Date: ${meeting?.scheduledFor ? new Date(meeting.scheduledFor).toLocaleDateString() : new Date(meeting?.createdAt).toLocaleDateString()} | 
          Type: ${meeting?.meetingType || 'General'}
        </div>
        ${printContent.innerHTML}
      </div>
    `;
    
    window.print();
    document.body.innerHTML = originalBody;
    window.location.reload();
  };

  const meeting = meetings.find((m: any) => m.id === meetingId)
  const transcripts = meeting?.transcripts || []

  if (meetingsLoading || minutesLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-[#A50000]" />
      </div>
    )
  }

  if (!meeting) {
    return (
      <div className="text-center py-12 text-[#A0A0A0]">
        Meeting not found.
        <Button variant="link" onClick={() => router.push('/meeting-ledger')} className="text-[#A50000]">
          Go back to Ledger
        </Button>
      </div>
    )
  }

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => router.push('/meeting-ledger')}
            className="border-[#1A1A1A] bg-[#111] text-[#A0A0A0] hover:text-white hover:bg-[#1A1A1A]"
          >
            <ArrowLeft size={16} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'var(--font-syne)' }}>
              {meeting.title || 'Untitled Meeting'}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-[#606060]">
              <div className="flex items-center gap-1.5">
                <Calendar size={13} />
                <span>
                  {meeting.scheduledFor ? new Date(meeting.scheduledFor).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : new Date(meeting.createdAt).toLocaleDateString()}
                </span>
              </div>
              {meeting.meetingType && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-[#2E2E2E]" />
                  <span>{meeting.meetingType}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className={`gap-2 ${minutes ? 'bg-transparent border border-[#1A1A1A] text-[#A0A0A0] hover:bg-[#1A1A1A]' : 'bg-[#A50000] text-white hover:bg-[#A50000]/90'}`}
          >
            {isGenerating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : minutes ? (
              <RefreshCw size={16} />
            ) : (
              <Bot size={16} />
            )}
            {isGenerating ? 'Generating...' : minutes ? 'Regenerate' : 'Generate Minutes'}
          </Button>
          {minutes && (
            <Button 
              onClick={downloadPDF}
              className="gap-2 bg-[#A50000] text-white hover:bg-[#A50000]/90"
            >
              <Download size={16} />
              Download PDF
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div id="minutes-content" className="space-y-6">
            {minutes ? (
              <>
                {/* Summary Section */}
                <div className="bg-[#111] border border-[#1A1A1A] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#1A1A1A] bg-[#161616] flex items-center gap-2">
                    <FileText size={16} className="text-[#A0A0A0]" />
                    <h3 className="font-semibold text-white">Meeting Summary</h3>
                  </div>
                  <div className="p-4">
                    <p className="text-gray-300 leading-relaxed">
                      {minutes.summary}
                    </p>
                  </div>
                </div>

                {/* Key Points Section */}
                {minutes.keyPoints && minutes.keyPoints.length > 0 && (
                  <div className="bg-[#111] border border-[#1A1A1A] rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#1A1A1A] bg-[#161616] flex items-center gap-2">
                      <List size={16} className="text-[#A0A0A0]" />
                      <h3 className="font-semibold text-white">Key Discussion Points</h3>
                    </div>
                    <div className="p-4">
                      <ul className="space-y-2">
                        {(minutes.keyPoints as string[]).map((point: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#A50000] flex-shrink-0" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Decisions Section */}
                <div className="bg-[#111] border border-[#1A1A1A] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#1A1A1A] bg-[#161616] flex items-center gap-2">
                    <CheckCircle2 size={16} className="text-[#16A34A]" />
                    <h3 className="font-semibold text-white">Decisions Made</h3>
                  </div>
                  <div className="p-4">
                    {minutes.decisions && (minutes.decisions as string[]).length > 0 ? (
                      <ul className="space-y-2">
                        {(minutes.decisions as string[]).map((decision: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                            <CheckCircle2 size={14} className="mt-0.5 text-[#16A34A] flex-shrink-0" />
                            {decision}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[#606060]">No explicit decisions recorded.</p>
                    )}
                  </div>
                </div>

                {/* Action Items Section */}
                <div className="bg-[#111] border border-[#1A1A1A] rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#1A1A1A] bg-[#161616] flex items-center gap-2">
                    <Play size={16} className="text-[#0284C7]" />
                    <h3 className="font-semibold text-white">Action Items</h3>
                  </div>
                  <div className="overflow-x-auto">
                    {minutes.actionItems && (minutes.actionItems as any[]).length > 0 ? (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#1A1A1A] bg-[#0A0A0A]">
                            <th className="px-4 py-2 text-xs font-medium text-[#606060] uppercase">Task</th>
                            <th className="px-4 py-2 text-xs font-medium text-[#606060] uppercase w-28">Assignee</th>
                            <th className="px-4 py-2 text-xs font-medium text-[#606060] uppercase w-24">Deadline</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(minutes.actionItems as any[]).map((item: any, i: number) => (
                            <tr key={i} className="border-b border-[#1A1A1A] hover:bg-[#1A1A1A]/30 transition-colors">
                              <td className="px-4 py-3 text-sm text-gray-300">{item.task}</td>
                              <td className="px-4 py-3 text-sm text-[#A0A0A0]">
                                <span className="px-2 py-0.5 bg-[#1A1A1A] border border-[#2E2E2E] rounded-md text-[11px]">
                                  {item.assignee || 'TBD'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-[#606060] text-xs">{item.deadline || 'TBD'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-4 text-sm text-[#606060]">No action items assigned.</div>
                    )}
                  </div>
                </div>

                {/* Next Steps Section */}
                {minutes.nextSteps && (
                  <div className="bg-[#111] border border-[#1A1A1A] rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-[#1A1A1A] bg-[#161616] flex items-center gap-2">
                      <RefreshCw size={16} className="text-[#D97706]" />
                      <h3 className="font-semibold text-white">Next Steps</h3>
                    </div>
                    <div className="p-4">
                      <p className="text-gray-300 text-sm leading-relaxed">
                        {minutes.nextSteps}
                      </p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Transcript View */
              <div className="bg-[#111] border border-[#1A1A1A] rounded-xl overflow-hidden flex flex-col h-[700px]">
                <div className="px-4 py-3 border-b border-[#1A1A1A] bg-[#161616] flex justify-between items-center flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText size={16} className="text-[#A0A0A0]" />
                    <h3 className="font-semibold text-white">Meeting Transcript</h3>
                  </div>
                  <span className="text-xs text-[#606060] bg-[#1A1A1A] px-2 py-1 rounded-full">
                    {transcripts.length} lines
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {transcripts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[#606060]">
                      <FileText size={32} className="mb-2 opacity-50" />
                      <p>No transcript recorded for this meeting.</p>
                    </div>
                  ) : (
                    transcripts.map((line: any, i: number) => (
                      <div key={line.id || i} className="group flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-sm font-semibold text-[#A0A0A0]">{line.speaker}</span>
                            <span className="text-xs text-[#606060]">{formatTime(line.timestampMs)}</span>
                          </div>
                          <p className="text-[15px] leading-relaxed text-gray-300">{line.text}</p>
                        </div>
                        {line.flagged && (
                          <div className="text-yellow-500 mt-1" title="Bookmarked">
                            <Bookmark size={14} fill="currentColor" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* If minutes exist, also show transcript below as collapsible or separate section */}
          {minutes && transcripts.length > 0 && (
            <div className="bg-[#111] border border-[#1A1A1A] rounded-xl overflow-hidden flex flex-col max-h-[400px] no-print">
              <div className="px-4 py-3 border-b border-[#1A1A1A] bg-[#161616] flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-[#A0A0A0]" />
                  <h3 className="font-semibold text-white">Transcript Reference</h3>
                </div>
              </div>
              <div className="overflow-y-auto p-4 space-y-4">
                {transcripts.map((line: any, i: number) => (
                  <div key={line.id || i} className="flex items-start gap-3 opacity-60 hover:opacity-100 transition-opacity">
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-[#A0A0A0]">{line.speaker}</span>
                        <span className="text-[10px] text-[#606060]">{formatTime(line.timestampMs)}</span>
                      </div>
                      <p className="text-xs text-gray-400">{line.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Details */}
        <div className="space-y-4 no-print">
          <div className="bg-[#111] border border-[#1A1A1A] rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-white mb-4">Meeting Details</h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <Clock size={16} className="text-[#606060] mt-0.5" />
                <div>
                  <p className="text-[#A0A0A0]">Duration</p>
                  <p className="text-white">
                    {meeting.startedAt && meeting.endedAt 
                      ? `${Math.round((new Date(meeting.endedAt).getTime() - new Date(meeting.startedAt).getTime()) / 60000)} mins`
                      : 'Unknown'}
                  </p>
                </div>
              </div>
              
              {meeting.clientName && (
                <div className="flex items-start gap-3 text-sm">
                  <Briefcase size={16} className="text-[#606060] mt-0.5" />
                  <div>
                    <p className="text-[#A0A0A0]">Client / Company</p>
                    <p className="text-white">{meeting.clientName}</p>
                  </div>
                </div>
              )}

              {meeting.participants && (meeting.participants as string[]).length > 0 && (
                <div className="flex items-start gap-3 text-sm">
                  <User size={16} className="text-[#606060] mt-0.5" />
                  <div>
                    <p className="text-[#A0A0A0]">Participants</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(meeting.participants as string[]).map((p: string, i: number) => (
                        <span key={i} className="px-2 py-0.5 bg-[#1A1A1A] border border-[#2E2E2E] rounded-md text-xs text-white">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {minutes?.sentiment && (
                <div className="flex items-start gap-3 text-sm border-t border-[#1A1A1A] pt-3">
                  <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                    minutes.sentiment === 'positive' ? 'bg-green-900/20 text-green-500 border border-green-900/50' : 
                    minutes.sentiment === 'negative' ? 'bg-red-900/20 text-red-500 border border-red-900/50' : 
                    'bg-gray-800/50 text-gray-400 border border-gray-700'
                  }`}>
                    Sentiment: {minutes.sentiment}
                  </div>
                </div>
              )}
            </div>
          </div>

          {!minutes && transcripts.length > 0 && (
            <div className="bg-[#111] border border-[#1A1A1A] rounded-xl p-4">
              <h3 className="font-semibold text-white mb-3">AI Intelligence</h3>
              <p className="text-sm text-[#606060] leading-relaxed mb-4">
                Analyze the transcript with Gemini 2.0 Flash to extract structured minutes and action items.
              </p>
              <Button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-[#A50000] text-white hover:bg-[#A50000]/90">
                {isGenerating ? <Loader2 size={16} className="animate-spin mr-2" /> : <Bot size={16} className="mr-2" />}
                {isGenerating ? 'Generating...' : 'Start Analysis'}
              </Button>
            </div>
          )}

          {minutes && (
            <div className="bg-[#111] border border-[#1A1A1A] rounded-xl p-4">
              <h3 className="font-semibold text-white mb-2">Download Report</h3>
              <p className="text-xs text-[#606060] mb-4">Export these minutes as a professional PDF document.</p>
              <Button variant="outline" className="w-full border-[#1A1A1A] text-[#A0A0A0] hover:text-white" onClick={downloadPDF}>
                <Download size={14} className="mr-2" />
                Download PDF
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
