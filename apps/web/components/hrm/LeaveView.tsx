'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, X, Loader2, FileText, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RequestLeaveModal } from './RequestLeaveModal'

interface LeaveRequest {
  id: string
  employeeId: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string | null
  status: string
  approverId: string | null
  approverComment: string | null
  createdAt: string
  employee?: { firstName: string; lastName: string }
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  PENDING:   { bg: '#1C1007', color: '#D97706', label: 'Pending' },
  APPROVED:  { bg: '#052E16', color: '#16A34A', label: 'Approved' },
  REJECTED:  { bg: '#1A0000', color: '#DC2626', label: 'Rejected' },
  CANCELLED: { bg: '#1A1A1A', color: '#606060', label: 'Cancelled' },
}

const LEAVE_TYPE_LABELS: Record<string, string> = {
  ANNUAL:    'Annual',
  SICK:      'Sick',
  CASUAL:    'Casual',
  MATERNITY: 'Maternity',
  PATERNITY: 'Paternity',
  UNPAID:    'Unpaid',
}

const LEAVE_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  ANNUAL:    { bg: '#0C1A2E', color: '#0284C7' },
  SICK:      { bg: '#1A0000', color: '#A50000' },
  CASUAL:    { bg: '#1C1007', color: '#D97706' },
  MATERNITY: { bg: '#1A0020', color: '#A855F7' },
  PATERNITY: { bg: '#0A1A0A', color: '#16A34A' },
  UNPAID:    { bg: '#1A1A1A', color: '#606060' },
}

const LEAVE_BALANCES = [
  { type: 'Annual',  total: 20, used: 3, color: '#0284C7', bg: '#0C1A2E' },
  { type: 'Sick',    total: 10, used: 1, color: '#A50000', bg: '#1A0000' },
  { type: 'Casual',  total: 5,  used: 0, color: '#D97706', bg: '#1C1007' },
]

const FILTER_TABS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const
type FilterTab = (typeof FILTER_TABS)[number]

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function LeaveTypeBadge({ type }: { type: string }) {
  const style = LEAVE_TYPE_COLORS[type] ?? { bg: '#1A1A1A', color: '#A0A0A0' }
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full"
      style={{ background: style.bg, color: style.color }}
    >
      {LEAVE_TYPE_LABELS[type] ?? type}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.PENDING
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ background: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  )
}

export function LeaveView() {
  const qc = useQueryClient()
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL')
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null)
  const [rejectComment, setRejectComment] = useState('')
  const [approving, setApproving] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)

  const { data: allLeaves = [], isLoading: allLoading } = useQuery<LeaveRequest[]>({
    queryKey: ['hrm-leave', filterTab],
    queryFn: () =>
      api
        .get('/hrm/leave', {
          params: { status: filterTab === 'ALL' ? undefined : filterTab },
        })
        .then((r) => r.data),
  })

  const { data: myLeaves = [], isLoading: myLoading } = useQuery<LeaveRequest[]>({
    queryKey: ['hrm-leave-my'],
    queryFn: () => api.get('/hrm/leave/my').then((r) => r.data),
  })

  const handleApprove = async (id: string) => {
    setApproving(id)
    try {
      await api.put(`/hrm/leave/${id}/approve`)
      toast.success('Leave request approved')
      qc.invalidateQueries({ queryKey: ['hrm-leave'] })
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve')
    } finally {
      setApproving(null)
    }
  }

  const openReject = (leave: LeaveRequest) => {
    setRejectTarget(leave)
    setRejectComment('')
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    if (!rejectComment.trim()) {
      toast.error('A comment is required to reject a request')
      return
    }
    setRejecting(true)
    try {
      await api.put(`/hrm/leave/${rejectTarget.id}/reject`, {
        comment: rejectComment.trim(),
      })
      toast.success('Leave request rejected')
      qc.invalidateQueries({ queryKey: ['hrm-leave'] })
      setRejectTarget(null)
      setRejectComment('')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject')
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-5">

      {/* ── LEFT PANEL — All requests (manager view) ── */}
      <div className="lg:w-[40%] flex flex-col gap-4 flex-shrink-0">
        <div>
          <h3
            className="text-sm font-bold mb-3"
            style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}
          >
            All Leave Requests
          </h3>

          {/* Filter tabs */}
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: '#0A0A0A' }}>
            {FILTER_TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterTab(tab)}
                className="flex-1 py-1.5 rounded-md text-xs font-medium transition-all"
                style={{
                  background: filterTab === tab ? '#A50000' : 'transparent',
                  color: filterTab === tab ? '#FFFFFF' : '#A0A0A0',
                }}
              >
                {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Request cards */}
        <div className="space-y-3 overflow-y-auto pr-0.5" style={{ maxHeight: '620px' }}>
          {allLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl p-4 animate-pulse"
                style={{ background: '#111111', border: '1px solid #2E2E2E' }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full" style={{ background: '#1A1A1A' }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded" style={{ background: '#1A1A1A', width: '55%' }} />
                    <div className="h-3 rounded" style={{ background: '#1A1A1A', width: '75%' }} />
                  </div>
                </div>
                <div className="h-7 rounded-lg" style={{ background: '#1A1A1A' }} />
              </div>
            ))
          ) : allLeaves.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-14 rounded-xl"
              style={{ background: '#111111', border: '1px solid #2E2E2E' }}
            >
              <FileText size={36} style={{ color: '#2E2E2E' }} />
              <p className="text-sm mt-3" style={{ color: '#606060' }}>
                No {filterTab !== 'ALL' ? filterTab.toLowerCase() : ''} requests
              </p>
            </div>
          ) : (
            allLeaves.map((leave) => {
              const emp = leave.employee
              return (
                <div
                  key={leave.id}
                  className="rounded-xl p-4"
                  style={{ background: '#111111', border: '1px solid #2E2E2E' }}
                >
                  {/* Card header */}
                  <div className="flex items-start gap-3 mb-3">
                    {emp && (
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: '#A50000', color: '#FFFFFF' }}
                      >
                        {getInitials(emp.firstName, emp.lastName)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold truncate" style={{ color: '#FFFFFF' }}>
                          {emp ? `${emp.firstName} ${emp.lastName}` : 'Employee'}
                        </p>
                        <StatusBadge status={leave.status} />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <LeaveTypeBadge type={leave.leaveType} />
                        <span className="text-xs" style={{ color: '#606060' }}>
                          {leave.totalDays} day{leave.totalDays !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#A0A0A0' }}>
                        {fmtDate(leave.startDate)} — {fmtDate(leave.endDate)}
                      </p>
                      {leave.reason && (
                        <p className="text-xs mt-1 line-clamp-2" style={{ color: '#606060' }}>
                          {leave.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Approve / Reject actions */}
                  {leave.status === 'PENDING' && (
                    <div
                      className="flex gap-2 pt-3"
                      style={{ borderTop: '1px solid #1A1A1A' }}
                    >
                      <Button
                        onClick={() => handleApprove(leave.id)}
                        disabled={approving === leave.id}
                        size="sm"
                        className="flex-1 h-7 text-xs gap-1"
                        style={{
                          background: '#052E16',
                          color: '#16A34A',
                          border: '1px solid #16A34A40',
                        }}
                      >
                        {approving === leave.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <Check size={11} />
                        )}
                        Approve
                      </Button>
                      <Button
                        onClick={() => openReject(leave)}
                        size="sm"
                        className="flex-1 h-7 text-xs gap-1"
                        style={{
                          background: '#1A0000',
                          color: '#DC2626',
                          border: '1px solid #DC262640',
                        }}
                      >
                        <X size={11} />
                        Reject
                      </Button>
                    </div>
                  )}

                  {/* Approver comment */}
                  {leave.approverComment && (
                    <div
                      className="mt-2.5 px-2.5 py-2 rounded-lg"
                      style={{ background: '#0A0A0A' }}
                    >
                      <p className="text-xs" style={{ color: '#606060' }}>
                        Comment: {leave.approverComment}
                      </p>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── RIGHT PANEL — Balance + My requests ── */}
      <div className="flex-1 flex flex-col gap-5">

        {/* Leave balance card */}
        <div
          className="rounded-xl p-5"
          style={{ background: '#111111', border: '1px solid #2E2E2E' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3
              className="text-sm font-bold"
              style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}
            >
              Leave Balance
            </h3>
            <Button
              onClick={() => setShowRequestModal(true)}
              size="sm"
              className="gap-1.5"
              style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
            >
              <CalendarDays size={13} />
              Request Leave
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {LEAVE_BALANCES.map((b) => (
              <div
                key={b.type}
                className="rounded-lg p-3 text-center"
                style={{ background: b.bg, border: `1px solid ${b.color}30` }}
              >
                <p
                  className="text-2xl font-bold"
                  style={{ color: b.color, fontFamily: 'var(--font-syne)' }}
                >
                  {b.total - b.used}
                </p>
                <p className="text-xs mt-0.5 font-medium" style={{ color: b.color }}>
                  {b.type}
                </p>
                <p className="text-xs mt-1" style={{ color: '#606060' }}>
                  {b.used} used / {b.total} total
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* My leave history */}
        <div
          className="rounded-xl p-5 flex-1"
          style={{ background: '#111111', border: '1px solid #2E2E2E' }}
        >
          <h3
            className="text-sm font-bold mb-4"
            style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}
          >
            My Leave Requests
          </h3>

          {myLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="animate-spin" style={{ color: '#A50000' }} />
            </div>
          ) : myLeaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <FileText size={36} style={{ color: '#2E2E2E' }} />
              <p className="text-sm mt-3" style={{ color: '#606060' }}>
                No leave requests yet
              </p>
              <button
                onClick={() => setShowRequestModal(true)}
                className="text-xs mt-2 hover:underline"
                style={{ color: '#A50000' }}
              >
                Request your first leave
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto" style={{ maxHeight: '340px' }}>
              {myLeaves.map((leave) => (
                <div
                  key={leave.id}
                  className="flex items-center gap-3 px-3 py-3 rounded-lg"
                  style={{ background: '#0A0A0A', border: '1px solid #1A1A1A' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <LeaveTypeBadge type={leave.leaveType} />
                      <span className="text-xs" style={{ color: '#606060' }}>
                        {leave.totalDays}d
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: '#A0A0A0' }}>
                      {fmtDate(leave.startDate)} — {fmtDate(leave.endDate)}
                    </p>
                    {leave.reason && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: '#606060' }}>
                        {leave.reason}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={leave.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Reject Comment Modal ── */}
      {rejectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }}
          onClick={() => setRejectTarget(null)}
        >
          <div
            className="rounded-xl p-6 w-full max-w-sm"
            style={{ background: '#111111', border: '1px solid #2E2E2E' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="text-base font-bold mb-1"
              style={{ color: '#FFFFFF', fontFamily: 'var(--font-syne)' }}
            >
              Reject Leave Request
            </h3>
            <p className="text-sm mb-4" style={{ color: '#A0A0A0' }}>
              {rejectTarget.employee
                ? `${rejectTarget.employee.firstName} ${rejectTarget.employee.lastName} — `
                : ''}
              {LEAVE_TYPE_LABELS[rejectTarget.leaveType] ?? rejectTarget.leaveType},{' '}
              {rejectTarget.totalDays} day{rejectTarget.totalDays !== 1 ? 's' : ''}
            </p>
            <div className="space-y-1.5 mb-4">
              <Label
                style={{ color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 }}
              >
                COMMENT *
              </Label>
              <textarea
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                placeholder="Reason for rejection..."
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none"
                style={{
                  background: '#0A0A0A',
                  border: '1px solid #2E2E2E',
                  color: '#FFFFFF',
                  outline: 'none',
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => { setRejectTarget(null); setRejectComment('') }}
                variant="outline"
                className="flex-1 h-10"
                style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                disabled={rejecting || !rejectComment.trim()}
                className="flex-1 h-10"
                style={{ background: '#DC2626', color: '#FFFFFF', border: 'none' }}
              >
                {rejecting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  'Reject'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Always mounted — open prop controls visibility */}
      <RequestLeaveModal
        open={showRequestModal}
        onClose={() => setShowRequestModal(false)}
      />
    </div>
  )
}
