'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import { Video, Plus, Calendar, Clock, CheckCircle2, PlayCircle, FileText, Loader2, Bookmark, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const STATUS_CONFIG = {
  SCHEDULED: { label: 'Scheduled', color: '#0284C7', bg: '#0C1A2E' },
  LIVE: { label: 'Live Now', color: '#DC2626', bg: '#2A0808' },
  ENDED: { label: 'Completed', color: '#16A34A', bg: '#052E16' },
}

export default function MeetingLedgerPage() {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false)
  const [meetingTitle, setMeetingTitle] = useState('')

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => api.get('/meetings').then(r => r.data),
  })

  const createMeeting = useMutation({
    mutationFn: (data: { title: string }) => api.post('/meetings', data).then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
      toast.success('Meeting room created!')
      // Automatically redirect host to the newly created room
      window.location.href = `/meeting/${data.roomCode}`
    },
    onError: () => toast.error('Failed to create meeting'),
  })

  const handleCreate = () => {
    setCreating(true)
    createMeeting.mutate({ title: meetingTitle }, { 
      onSettled: () => {
        setCreating(false)
        setShowNewMeetingModal(false)
        setMeetingTitle('')
      } 
    })
  }

  const stats = {
    total: meetings.length,
    live: meetings.filter((m: any) => m.status === 'LIVE').length,
    completed: meetings.filter((m: any) => m.status === 'ENDED').length,
    bookmarked: meetings.reduce((acc: number, m: any) => acc + (m.transcripts?.filter((t: any) => t.flagged).length || 0), 0),
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}>
            Meeting Ledger
          </h1>
          <p className="text-sm mt-1" style={{ color: '#606060' }}>
            Integrated Video Meetings & Intelligence
          </p>
        </div>
        <Button
          onClick={() => setShowNewMeetingModal(true)}
          disabled={creating}
          className="h-9 gap-2"
          style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          New Meeting
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Meetings', value: stats.total, icon: Video, color: '#A50000' },
          { label: 'Live Now', value: stats.live, icon: PlayCircle, color: '#DC2626' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: '#16A34A' },
          { label: 'Bookmarked Moments', value: stats.bookmarked, icon: Bookmark, color: '#D97706' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="p-4 rounded-xl border"
            style={{ background: '#111111', borderColor: '#1A1A1A', borderTop: `3px solid ${stat.color}` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: '#606060' }}>{stat.label}</span>
              <stat.icon size={16} style={{ color: stat.color }} />
            </div>
            <div className="text-2xl font-bold" style={{ fontFamily: 'var(--font-syne)', color: stat.color }}>
              {stat.value}
            </div>
          </motion.div>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: '#A50000' }} />
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border"
          style={{ background: '#111111', borderColor: '#1A1A1A' }}>
          <Video size={40} style={{ color: '#2E2E2E' }} />
          <p className="text-sm mt-4" style={{ color: '#606060' }}>No meetings yet. Start your first meeting.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {meetings.map((meeting: any) => {
            const status = STATUS_CONFIG[meeting.status as keyof typeof STATUS_CONFIG]
            return (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl border transition-all hover:border-[#2E2E2E]"
                style={{ background: '#111111', borderColor: '#1A1A1A' }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: '#1A0000', color: '#A50000' }}>
                      <Video size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{meeting.title || 'Untitled Meeting'}</p>
                      <p className="text-xs" style={{ color: '#606060' }}>Room: {meeting.roomCode.split('-')[0]}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0"
                    style={{ background: status?.bg, color: status?.color }}>
                    {status?.label}
                  </span>
                </div>

                <div className="flex items-center gap-4 mt-3">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={13} style={{ color: '#606060' }} />
                    <span className="text-xs" style={{ color: '#606060' }}>
                      {new Date(meeting.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {meeting.transcripts?.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <FileText size={13} style={{ color: '#D97706' }} />
                      <span className="text-xs" style={{ color: '#D97706' }}>
                        {meeting.transcripts.length} lines
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  {meeting.status === 'SCHEDULED' && (
                    <Link href={`/meeting/${meeting.roomCode}`} className="flex-1">
                      <Button className="w-full h-8 text-xs" style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}>
                        Start Meeting
                      </Button>
                    </Link>
                  )}
                  {meeting.status === 'LIVE' && (
                    <Link href={`/meeting/${meeting.roomCode}`} className="flex-1">
                      <Button className="w-full h-8 text-xs" style={{ background: '#DC2626', color: '#FFFFFF', border: 'none' }}>
                        Join Live Room
                      </Button>
                    </Link>
                  )}
                  {meeting.status === 'ENDED' && (
                    <Link href={`/minutes/${meeting.id}`} className="flex-1">
                      <Button variant="outline" className="w-full h-8 text-xs" style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}>
                        View Minutes
                      </Button>
                    </Link>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
      {/* New Meeting Modal */}
      <Dialog open={showNewMeetingModal} onOpenChange={setShowNewMeetingModal}>
        <DialogContent className="sm:max-w-[425px] bg-[#0D0D0D] border-[#1A1A1A] text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>
              New Meeting
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="text-sm font-medium text-[#A0A0A0]">
                Meeting Title (Optional)
              </Label>
              <Input
                id="title"
                placeholder="e.g. Interview with John, Team Standup..."
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                className="bg-[#111111] border-[#1A1A1A] text-white focus:border-[#A50000] focus:ring-[#A50000]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                }}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowNewMeetingModal(false)}
              className="border-[#1A1A1A] text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="gap-2"
              style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
            >
              {creating && <Loader2 size={14} className="animate-spin" />}
              Start Meeting
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
