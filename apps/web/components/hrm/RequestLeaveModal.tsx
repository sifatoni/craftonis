'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface RequestLeaveModalProps {
  open: boolean
  onClose: () => void
}

const LEAVE_TYPES = [
  { value: 'ANNUAL',    label: 'Annual Leave' },
  { value: 'SICK',      label: 'Sick Leave' },
  { value: 'CASUAL',    label: 'Casual Leave' },
  { value: 'MATERNITY', label: 'Maternity Leave' },
  { value: 'PATERNITY', label: 'Paternity Leave' },
  { value: 'UNPAID',    label: 'Unpaid Leave' },
]

function calcBusinessDays(start: string, end: string): number {
  if (!start || !end) return 0
  const s = new Date(start)
  const e = new Date(end)
  if (s > e) return 0
  let count = 0
  const cur = new Date(s)
  while (cur <= e) {
    const day = cur.getDay()
    if (day !== 0 && day !== 6) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

export const RequestLeaveModal = memo(function RequestLeaveModal({
  open,
  onClose,
}: RequestLeaveModalProps) {
  const qc = useQueryClient()
  const [leaveType, setLeaveType] = useState('ANNUAL')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setLeaveType('ANNUAL')
    setStartDate('')
    setEndDate('')
    setReason('')
  }, [open])

  const businessDays = calcBusinessDays(startDate, endDate)
  const hasValidRange = startDate !== '' && endDate !== ''

  const handleSubmit = useCallback(async () => {
    if (!startDate || !endDate) {
      toast.error('Please select start and end dates')
      return
    }
    if (businessDays === 0) {
      toast.error('Selected range contains no business days')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/hrm/leave', {
        leaveType,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      })
      toast.success('Leave request submitted')
      qc.invalidateQueries({ queryKey: ['hrm-leave'] })
      qc.invalidateQueries({ queryKey: ['hrm-leave-my'] })
      onClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit leave request')
    } finally {
      setSubmitting(false)
    }
  }, [leaveType, startDate, endDate, reason, businessDays, qc, onClose])

  const INPUT = {
    background: '#0A0A0A',
    border: '1px solid #2E2E2E',
    color: '#FFFFFF',
    outline: 'none',
  }
  const LABEL = { color: '#A0A0A0', fontSize: '0.75rem', fontWeight: 600 as const }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="max-w-md"
        style={{ background: '#111111', border: '1px solid #2E2E2E' }}
      >
        <DialogHeader>
          <DialogTitle style={{ fontFamily: 'var(--font-syne)', color: '#FFFFFF' }}>
            Request Leave
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Leave Type */}
          <div className="space-y-1.5">
            <Label style={LABEL}>LEAVE TYPE</Label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value)}
              className="appearance-none w-full h-10 rounded-lg px-3 text-sm"
              style={INPUT}
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label style={LABEL}>START DATE</Label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  // Auto-correct end date if it's before new start
                  if (endDate && e.target.value > endDate) setEndDate(e.target.value)
                }}
                className="w-full h-10 rounded-lg px-3 text-sm"
                style={{ ...INPUT, colorScheme: 'dark' }}
              />
            </div>
            <div className="space-y-1.5">
              <Label style={LABEL}>END DATE</Label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-10 rounded-lg px-3 text-sm"
                style={{ ...INPUT, colorScheme: 'dark' }}
              />
            </div>
          </div>

          {/* Business days indicator */}
          {hasValidRange && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
              style={{
                background: businessDays > 0 ? '#0C1A2E' : '#1A0000',
                border: `1px solid ${businessDays > 0 ? '#0284C730' : '#DC262630'}`,
              }}
            >
              <CalendarDays
                size={14}
                style={{ color: businessDays > 0 ? '#0284C7' : '#DC2626', flexShrink: 0 }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: businessDays > 0 ? '#0284C7' : '#DC2626' }}
              >
                {businessDays > 0
                  ? `${businessDays} business day${businessDays !== 1 ? 's' : ''}`
                  : 'No business days in selected range'}
              </span>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <Label style={LABEL}>REASON (OPTIONAL)</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Briefly describe the reason for your leave..."
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none"
              style={INPUT}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-10"
              style={{ borderColor: '#2E2E2E', color: '#A0A0A0', background: 'transparent' }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || !startDate || !endDate || businessDays === 0}
              className="flex-1 h-10"
              style={{ background: '#A50000', color: '#FFFFFF', border: 'none' }}
            >
              {submitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                'Submit Request'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
})
