'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { api } from '@/lib/axios'
import { toast } from 'sonner'
import { Video, Plus, Calendar, Clock, CheckCircle2, PlayCircle, FileText, Loader2, Bookmark, Users, Link as LinkIcon, Check, MoreVertical, Trash2, CalendarClock, Briefcase, User, ChevronDown } from 'lucide-react'
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
  const [copiedId, setCopiedId] = useState<string | null>(null)
  
  const [rescheduleModal, setRescheduleModal] = useState<{open: boolean, meetingId: string, current: string | null}>({ open: false, meetingId: '', current: null })
  const [newScheduledFor, setNewScheduledFor] = useState('')
  const [rescheduling, setRescheduling] = useState(false)

  // New Meeting Optional Fields
  const [meetingType, setMeetingType] = useState('')
  const [clientName, setClientName] = useState('')
  const [participants, setParticipants] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')

  // Departments & Filter
  const [departmentId, setDepartmentId] = useState('')
  const [activeDepartment, setActiveDepartment] = useState<string>('All Departments')
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false)
  const [isCreatingDepartment, setIsCreatingDepartment] = useState(false)
  const [newDepartmentName, setNewDepartmentName] = useState('')

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => api.get('/workspace/departments').then(r => r.data),
  })

  const [sharePopoverId, setSharePopoverId] = useState<string | null>(null)

  const handleShare = (platform: string, roomCode: string, meetingId: string) => {
    const meetingUrl = `${window.location.origin}/meeting/${roomCode}`
    
    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${encodeURIComponent('Join my meeting on Craftonis: ' + meetingUrl)}`, '_blank')
        break
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(meetingUrl)}&text=${encodeURIComponent('Join my meeting on Craftonis')}`, '_blank')
        break
      case 'email':
        window.open(`mailto:?subject=${encodeURIComponent('Meeting Invitation - Craftonis')}&body=${encodeURIComponent('You are invited to join a meeting.\n\nJoin here: ' + meetingUrl)}`, '_blank')
        break
      case 'messenger':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(meetingUrl)}`, '_blank')
        break
      case 'copy':
        navigator.clipboard.writeText(meetingUrl)
        setCopiedId(meetingId)
        setTimeout(() => setCopiedId(null), 2000)
        break
    }
    setSharePopoverId(null)
  }

  const createDepartment = useMutation({
    mutationFn: (name: string) => api.post('/workspace/departments', { name }).then(r => r.data),
    onSuccess: (newDept) => {
      qc.invalidateQueries({ queryKey: ['departments'] })
      setDepartmentId(newDept.id)
      setIsCreatingDepartment(false)
      setNewDepartmentName('')
      setIsDeptDropdownOpen(false)
      toast.success('Department created')
    },
    onError: () => toast.error('Failed to create department'),
  })

  const handleCreateDepartment = () => {
    if (newDepartmentName.trim()) {
      createDepartment.mutate(newDepartmentName.trim())
    }
  }

  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => api.get('/meetings').then(r => r.data),
  })

  const resetForm = () => {
    setMeetingTitle('')
    setMeetingType('')
    setClientName('')
    setParticipants('')
    setDepartmentId('')
    setScheduledFor('')
    setIsDeptDropdownOpen(false)
    setIsCreatingDepartment(false)
    setNewDepartmentName('')
  }

  const createMeeting = useMutation({
    mutationFn: (data: any) => api.post('/meetings', data).then(r => r.data),
    onSuccess: (data, variables: any) => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
      if (variables.startImmediately) {
        toast.success('Meeting room created!')
        window.location.href = `/meeting/${data.roomCode}`
      } else {
        if (variables.scheduledFor) {
          toast.success(`Meeting scheduled for ${new Date(variables.scheduledFor).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`)
        } else {
          toast.success('Meeting created successfully!')
        }
        setShowNewMeetingModal(false)
        resetForm()
      }
    },
    onError: () => toast.error('Failed to create meeting'),
  })

  const handleCreate = (startImmediately: boolean = false) => {
    setCreating(true)
    const payload: any = { startImmediately }
    if (meetingTitle) payload.title = meetingTitle
    if (meetingType) payload.meetingType = meetingType
    if (clientName) payload.clientName = clientName
    if (participants) payload.participants = participants.split(',').map(p => p.trim())
    if (departmentId) payload.departmentId = departmentId
    if (scheduledFor) payload.scheduledFor = new Date(scheduledFor)

    createMeeting.mutate(payload, { 
      onSettled: () => {
        setCreating(false)
      } 
    })
  }

  const deleteMeeting = useMutation({
    mutationFn: (id: string) => api.delete(`/meetings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
      toast.success('Meeting deleted')
    },
  })

  const handleDelete = (id: string) => {
    if (window.confirm("Delete this meeting? This cannot be undone.")) {
      deleteMeeting.mutate(id)
    }
  }

  const rescheduleMeeting = useMutation({
    mutationFn: ({ id, scheduledFor }: { id: string, scheduledFor: string }) => 
      api.patch(`/meetings/${id}`, { scheduledFor: new Date(scheduledFor) }),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
      toast.success('Meeting rescheduled')
      setRescheduleModal({ open: false, meetingId: '', current: null })
      setNewScheduledFor('')

      // Setup 15min reminder notification
      const scheduledTime = new Date(variables.scheduledFor).getTime();
      const timeUntilMeeting = scheduledTime - Date.now();
      if (timeUntilMeeting > 15 * 60 * 1000) {
        setTimeout(() => {
          toast.info(`Reminder: Your meeting is starting in 15 minutes!`, { duration: 10000 });
        }, timeUntilMeeting - 15 * 60 * 1000);
      }
    },
  })

  const handleReschedule = () => {
    if (!newScheduledFor) return
    rescheduleMeeting.mutate({ id: rescheduleModal.meetingId, scheduledFor: newScheduledFor }, {
      onSettled: () => setRescheduling(false)
    })
  }

  const stats = {
    total: meetings.length,
    live: meetings.filter((m: any) => m.status === 'LIVE').length,
    completed: meetings.filter((m: any) => m.status === 'ENDED').length,
    bookmarked: meetings.reduce((acc: number, m: any) => acc + (m.transcripts?.filter((t: any) => t.flagged).length || 0), 0),
  }

  const filteredMeetings = meetings.filter((m: any) => {
    if (activeDepartment === 'All Departments') return true
    return m.department?.name === activeDepartment
  })

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + 
      ' · ' + 
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

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

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setActiveDepartment('All Departments')}
          className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            activeDepartment === 'All Departments'
              ? 'bg-[#A50000] text-white'
              : 'border border-[#2E2E2E] text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white'
          }`}
        >
          All Departments
        </button>
        {departments.filter((d: any) => meetings.some((m: any) => m.department?.id === d.id)).map((dept: any) => (
          <button
            key={dept.id}
            onClick={() => setActiveDepartment(dept.name)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              activeDepartment === dept.name
                ? 'bg-[#A50000] text-white'
                : 'border border-[#2E2E2E] text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white'
            }`}
          >
            {dept.name}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: '#A50000' }} />
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl border"
          style={{ background: '#111111', borderColor: '#1A1A1A' }}>
          <Video size={40} style={{ color: '#2E2E2E' }} />
          <p className="text-sm mt-4" style={{ color: '#606060' }}>No meetings found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredMeetings.map((meeting: any) => {
            const status = STATUS_CONFIG[meeting.status as keyof typeof STATUS_CONFIG]
            return (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl border transition-all hover:border-[#2E2E2E] group relative"
                style={{ background: '#111111', borderColor: '#1A1A1A' }}
              >
                {/* Three Dot Menu */}
                {meeting.status !== 'LIVE' && (
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <div className="relative group/menu">
                      <button className="p-1 text-[#606060] hover:text-white rounded hover:bg-[#1A1A1A]">
                        <MoreVertical size={16} />
                      </button>
                      <div className="absolute right-0 top-full mt-1 w-36 bg-[#111] border border-[#1A1A1A] rounded-lg shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all flex flex-col py-1">
                        {meeting.status === 'SCHEDULED' && (
                          <button 
                            onClick={() => {
                              setRescheduleModal({ open: true, meetingId: meeting.id, current: meeting.scheduledFor });
                            }}
                            className="text-left px-3 py-1.5 text-xs text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white flex items-center gap-2"
                          >
                            <CalendarClock size={13} /> Reschedule
                          </button>
                        )}
                        <button 
                          onClick={() => handleDelete(meeting.id)}
                          className="text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-900/20 flex items-center gap-2"
                        >
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between pr-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: '#1A0000', color: '#A50000' }}>
                      <Video size={18} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>{meeting.title || 'Untitled Meeting'}</p>
                        {meeting.minutes && (
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Minutes available" />
                        )}
                      </div>
                      <p className="text-xs" style={{ color: '#606060' }}>Room: {meeting.roomCode.split('-')[0]}</p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium flex-shrink-0"
                    style={{ background: status?.bg, color: status?.color }}>
                    {status?.label}
                  </span>
                </div>

                <div className="flex flex-col gap-2 mt-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={14} className="text-white" />
                      <span className="text-sm font-medium text-white">
                        {formatDateTime(meeting.scheduledFor || meeting.createdAt)}
                      </span>
                    </div>
                    {meeting.department && (
                      <div className="flex items-center gap-1.5">
                         <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1A1A1A] text-[#A0A0A0] border border-[#2E2E2E]">
                           {meeting.department.name}
                         </span>
                      </div>
                    )}
                    {meeting.transcripts?.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <FileText size={13} style={{ color: '#D97706' }} />
                        <span className="text-xs" style={{ color: '#D97706' }}>
                          {meeting.transcripts.length} lines
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Additional Metadata */}
                  {(meeting.meetingType || meeting.clientName || (meeting.participants && meeting.participants.length > 0)) && (
                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      {meeting.meetingType && (
                         <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1A1A1A] text-[#A0A0A0] border border-[#2E2E2E]">
                           {meeting.meetingType}
                         </span>
                      )}
                      {meeting.clientName && (
                        <div className="flex items-center gap-1">
                          <Briefcase size={12} className="text-[#606060]" />
                          <span className="text-xs text-[#A0A0A0]">Client: {meeting.clientName}</span>
                        </div>
                      )}
                      {meeting.participants && meeting.participants.length > 0 && (
                        <div className="flex items-center gap-1">
                          <User size={12} className="text-[#606060]" />
                          <span className="text-xs text-[#A0A0A0]">👥 {meeting.participants.length} participants</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  {(meeting.status === 'SCHEDULED' || meeting.status === 'LIVE') && (
                    <div className="relative">
                      <Button
                        variant="outline"
                        className="h-8 gap-2 px-3 flex-shrink-0"
                        style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}
                        onClick={() => setSharePopoverId(sharePopoverId === meeting.id ? null : meeting.id)}
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="18" cy="5" r="3"/>
                          <circle cx="6" cy="12" r="3"/>
                          <circle cx="18" cy="19" r="3"/>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        <span className="text-xs">Share</span>
                      </Button>
                      
                      {sharePopoverId === meeting.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setSharePopoverId(null)} />
                          <div className="absolute left-0 bottom-full mb-2 w-52 bg-[#0D0D0D] border border-[#1A1A1A] rounded-lg shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                            {[
                              { 
                                id: 'whatsapp', 
                                label: 'WhatsApp', 
                                icon: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> 
                              },
                              { 
                                id: 'telegram', 
                                label: 'Telegram', 
                                icon: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#26A5E4"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                              },
                              { 
                                id: 'messenger', 
                                label: 'Messenger', 
                                icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><defs><linearGradient id="msgGrad" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stopColor="#0099FF"/><stop offset="100%" stopColor="#A033FF"/></linearGradient></defs><path fill="url(#msgGrad)" d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.652V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111S18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8l3.131 3.26L19.752 8l-6.561 6.963z"/></svg>
                              },
                              { 
                                id: 'email', 
                                label: 'Gmail', 
                                icon: <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="#EA4335" d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"/></svg>
                              },
                              { 
                                id: 'copy', 
                                label: copiedId === meeting.id ? 'Copied!' : 'Copy Link', 
                                icon: <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                              },
                            ].map((option) => (
                              <button
                                key={option.id}
                                onClick={() => handleShare(option.id, meeting.roomCode, meeting.id)}
                                className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-800 text-sm text-white transition-colors"
                              >
                                {option.icon}
                                <span>{option.label}</span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
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
                    <Link href={`/meeting-ledger/${meeting.id}/minutes`} className="flex-1">
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
      <Dialog 
        open={showNewMeetingModal} 
        onOpenChange={(open) => {
          setShowNewMeetingModal(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-[425px] bg-[#0D0D0D] border-[#1A1A1A] text-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>
              New Meeting
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="text-sm font-medium text-[#A0A0A0]">
                1. Meeting Title (Optional)
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
            <div className="grid gap-2">
              <Label className="text-sm font-medium text-[#A0A0A0]">
                2. Department (Optional)
              </Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDeptDropdownOpen(!isDeptDropdownOpen)}
                  className="flex h-10 w-full items-center justify-between rounded-md bg-[#111111] border border-[#1A1A1A] px-3 py-2 text-sm text-white focus:border-[#A50000] focus:outline-none focus:ring-1 focus:ring-[#A50000]"
                >
                  <span className={departmentId ? "text-white" : "text-[#606060]"}>
                    {departmentId ? departments.find((d: any) => d.id === departmentId)?.name || 'Select department...' : 'Select department...'}
                  </span>
                  <ChevronDown size={16} className="text-[#606060]" />
                </button>
                
                {isDeptDropdownOpen && (
                  <div className="absolute z-50 w-full mt-1 bg-[#111111] border border-[#1A1A1A] rounded-md shadow-xl max-h-60 overflow-y-auto">
                    <div className="p-1">
                      {isCreatingDepartment ? (
                        <div className="flex items-center gap-2 px-2 py-2">
                          <Input
                            autoFocus
                            placeholder="Department name..."
                            value={newDepartmentName}
                            onChange={e => setNewDepartmentName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreateDepartment()}
                            className="h-8 bg-[#0D0D0D] border-[#2E2E2E] text-white text-xs focus-visible:ring-[#A50000]"
                          />
                          <Button 
                            size="sm" 
                            onClick={handleCreateDepartment}
                            disabled={createDepartment.isPending || !newDepartmentName.trim()}
                            className="h-8 px-3 bg-[#A50000] hover:bg-red-800 text-white text-xs"
                          >
                            Add
                          </Button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsCreatingDepartment(true)}
                          className="w-full text-left px-2 py-2 text-sm font-bold text-[#A50000] hover:bg-[#1A1A1A] rounded"
                        >
                          + Create Department
                        </button>
                      )}
                      
                      {!isCreatingDepartment && departments.map((dept: any) => (
                        <button
                          key={dept.id}
                          type="button"
                          onClick={() => {
                            setDepartmentId(dept.id)
                            setIsDeptDropdownOpen(false)
                          }}
                          className="w-full text-left px-2 py-2 text-sm text-white hover:bg-[#1A1A1A] rounded"
                        >
                          {dept.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="meetingType" className="text-sm font-medium text-[#A0A0A0]">
                3. Meeting Type (Optional)
              </Label>
              <select
                id="meetingType"
                value={meetingType}
                onChange={(e) => setMeetingType(e.target.value)}
                className="flex h-10 w-full rounded-md bg-[#111111] border border-[#1A1A1A] pl-3 pr-8 py-2 text-sm text-white focus:border-[#A50000] focus:outline-none focus:ring-1 focus:ring-[#A50000]"
              >
                <option value="">Select type...</option>
                <option value="Interview">Interview</option>
                <option value="Team Standup">Team Standup</option>
                <option value="Client Meeting">Client Meeting</option>
                <option value="Project Review">Project Review</option>
                <option value="Sales Call">Sales Call</option>
                <option value="HR Discussion">HR Discussion</option>
                <option value="Performance Review">Performance Review</option>
                <option value="Others">Others</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="clientName" className="text-sm font-medium text-[#A0A0A0]">
                4. Company / Client Name (Optional)
              </Label>
              <Input
                id="clientName"
                placeholder="e.g. Acme Corp"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="bg-[#111111] border-[#1A1A1A] text-white focus:border-[#A50000] focus:ring-[#A50000]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="participants" className="text-sm font-medium text-[#A0A0A0]">
                5. Participants (Optional)
              </Label>
              <Input
                id="participants"
                placeholder="e.g. john@email.com, Sarah (separate with commas)"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                className="bg-[#111111] border-[#1A1A1A] text-white focus:border-[#A50000] focus:ring-[#A50000]"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="scheduledFor" className="text-sm font-medium text-[#A0A0A0]">
                6. Schedule Date & Time (Optional)
              </Label>
              <Input
                id="scheduledFor"
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => {
                  setScheduledFor(e.target.value);
                  if (e.target.value) {
                    setTimeout(() => e.target.blur(), 100);
                  }
                }}
                onBlur={(e) => e.target.blur()}
                style={{ colorScheme: 'dark' }}
                className="pl-3 bg-[#111111] border-[#1A1A1A] text-white focus:border-[#A50000] focus:ring-[#A50000]"
              />
              <p className="text-xs text-[#606060]">Leave empty to start immediately</p>
            </div>
          </div>
          <div className="flex justify-between items-center mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowNewMeetingModal(false)
                resetForm()
              }}
              className="border-[#1A1A1A] text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white"
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={() => handleCreate(true)}
                disabled={creating}
                className="gap-2 bg-green-600 hover:bg-green-700 text-white border-none"
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                Start Meeting
              </Button>
              <Button
                onClick={() => handleCreate(false)}
                disabled={creating}
                className="gap-2"
                style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                Create Meeting
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reschedule Meeting Modal */}
      {rescheduleModal.open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0D0D0D] border border-[#1A1A1A] rounded-xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'var(--font-syne)' }}>
              Reschedule Meeting
            </h2>
            {rescheduleModal.current && (
              <p className="text-sm text-gray-400 mb-6">
                Currently: {new Date(rescheduleModal.current).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            )}
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="newScheduledFor" className="text-sm font-medium text-[#A0A0A0]">
                  New Date & Time *
                </Label>
                <input
                  id="newScheduledFor"
                  type="datetime-local"
                  value={newScheduledFor}
                  onChange={(e) => {
                    setNewScheduledFor(e.target.value);
                    if (e.target.value) {
                      setTimeout(() => e.target.blur(), 100);
                    }
                  }}
                  onBlur={(e) => e.target.blur()}
                  style={{ colorScheme: 'dark' }}
                  className="flex h-10 w-full rounded-md border border-[#1A1A1A] bg-[#111111] pl-3 pr-3 py-2 text-sm text-white focus:border-[#A50000] focus:outline-none focus:ring-1 focus:ring-[#A50000]"
                />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRescheduleModal({ open: false, meetingId: '', current: null });
                    setNewScheduledFor('');
                  }}
                  className="border-[#1A1A1A] text-[#A0A0A0] hover:bg-[#1A1A1A] hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setRescheduling(true);
                    handleReschedule();
                  }}
                  disabled={rescheduling || !newScheduledFor}
                  className="gap-2 px-6"
                  style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
                >
                  {rescheduling && <Loader2 size={14} className="animate-spin" />}
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
